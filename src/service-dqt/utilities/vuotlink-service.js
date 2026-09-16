import axios from "axios";
import fs from "fs";
import path from "path";
import { readAdmins } from "../../utils/io-json.js";
import { getGlobalPrefix } from "../service.js";
import { removeMention } from "../../utils/format-util.js";
import {
  sendMessageCompleteRequest,
  sendMessageFailed,
  sendMessageProcessingRequest,
  sendMessageWarningRequest,
} from "../chat-zalo/chat-style/chat-style.js";

const CONFIG_PATH = path.resolve(process.cwd(), "assets", "json-data", "vuotlink-config.json");

// Cache các link đã vượt thành công: Map<url, { finalUrl, title, workflow, hops, timestamp }>
const bypassCache = new Map();
const CACHE_TTL_MS = 20 * 60 * 1000; // 20 phút

// Tránh 1 người dùng spam gửi nhiều request đồng thời
const activeUsers = new Set();

function isBotAdmin(userId) {
  if (!userId) return false;
  const admins = readAdmins();
  return Array.isArray(admins) && admins.includes(String(userId));
}

/**
 * Đọc cấu hình VuotLink
 */
export function getVuotLinkConfig() {
  const defaultConfig = {
    apiKey: process.env.VUOTLINK_API_KEY || "",
    apiUrl: "https://browser-agent.hommi.io.vn/api/v1/bypass",
    autoSolveCaptcha: true,
    maxHops: 10,
    timeoutMs: 90000,
    lastBalance: null,
  };

  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, "utf-8");
      const parsed = JSON.parse(data);
      return {
        ...defaultConfig,
        ...parsed,
        apiKey: parsed.apiKey || process.env.VUOTLINK_API_KEY || "",
      };
    }
  } catch (error) {
    console.error("[VuotLink] Lỗi khi đọc file cấu hình:", error.message);
  }

  return defaultConfig;
}

/**
 * Lưu cấu hình VuotLink
 */
export function saveVuotLinkConfig(newConfig) {
  try {
    const current = getVuotLinkConfig();
    const updated = { ...current, ...newConfig };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2), "utf-8");
    return true;
  } catch (error) {
    console.error("[VuotLink] Lỗi khi lưu file cấu hình:", error.message);
    return false;
  }
}

/**
 * Che một phần API key để hiển thị an toàn
 */
function maskApiKey(key) {
  if (!key || typeof key !== "string") return "Chưa cấu hình";
  if (key.length <= 8) return "******";
  return key.substring(0, 6) + "..." + key.substring(key.length - 4);
}

/**
 * Trích xuất URL từ text hoặc quote
 */
function extractUrl(text, quote) {
  const urlRegex = /(https?:\/\/[^\s<>"']+)/gi;

  if (text) {
    const matches = text.match(urlRegex);
    if (matches && matches.length > 0) {
      return matches[0].trim();
    }
  }

  if (quote) {
    if (quote.attach) {
      try {
        const parsed = typeof quote.attach === "string" ? JSON.parse(quote.attach) : quote.attach;
        if (parsed?.href && typeof parsed.href === "string") return parsed.href.trim();
        if (parsed?.oriUrl && typeof parsed.oriUrl === "string") return parsed.oriUrl.trim();
        if (parsed?.url && typeof parsed.url === "string") return parsed.url.trim();
      } catch {}
    }

    if (quote.content) {
      if (typeof quote.content === "string") {
        const matches = quote.content.match(urlRegex);
        if (matches && matches.length > 0) return matches[0].trim();
      } else if (typeof quote.content === "object") {
        if (quote.content.href) return String(quote.content.href).trim();
        if (quote.content.title && typeof quote.content.title === "string") {
          const matches = quote.content.title.match(urlRegex);
          if (matches && matches.length > 0) return matches[0].trim();
        }
      }
    }

    if (quote.msg && typeof quote.msg === "string") {
      const matches = quote.msg.match(urlRegex);
      if (matches && matches.length > 0) return matches[0].trim();
    }

    if (quote.propertyExt?.url) {
      return String(quote.propertyExt.url).trim();
    }
  }

  if (text) {
    const domainRegex = /([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+\/[^\s<>"']+)/gi;
    const matches = text.match(domainRegex);
    if (matches && matches.length > 0) {
      return "https://" + matches[0].trim();
    }
  }

  return null;
}

/**
 * Gọi API VuotLink bypass
 */
async function callVuotLinkApi({ url, autoSolveCaptcha, maxHops }) {
  const config = getVuotLinkConfig();
  const apiKey = config.apiKey;

  if (!apiKey) {
    return {
      success: false,
      code: "NO_API_KEY",
      message: "Chưa cấu hình API Key VuotLink! Quản trị viên vui lòng dùng lệnh /vuotlink setkey <key> để cấu hình.",
    };
  }

  const endpoint = config.apiUrl || "https://browser-agent.hommi.io.vn/api/v1/bypass";
  const timeoutMs = config.timeoutMs || 90000;

  try {
    const response = await axios.post(
      endpoint,
      {
        url: url,
        auto_solve_captcha: autoSolveCaptcha !== undefined ? autoSolveCaptcha : config.autoSolveCaptcha,
        max_hops: maxHops !== undefined ? maxHops : config.maxHops,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey.trim(),
        },
        timeout: timeoutMs,
      }
    );

    const data = response.data;

    // Lưu lại số dư mới nhất nếu API trả về
    if (typeof data.remaining_balance === "number") {
      saveVuotLinkConfig({ lastBalance: data.remaining_balance });
    }

    return {
      success: true,
      data: data,
    };
  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      const resData = error.response.data || {};
      const detail = resData.detail || resData.message || "";

      if (status === 401) {
        return {
          success: false,
          code: 401,
          message: "API Key VuotLink không hợp lệ hoặc đã bị thu hồi! Vui lòng kiểm tra lại key.",
        };
      }
      if (status === 402) {
        return {
          success: false,
          code: 402,
          message: "Tài khoản VuotLink không đủ số dư xu! Vui lòng nạp thêm xu trên vuotlink.hommi.io.vn.",
        };
      }
      if (status === 403) {
        return {
          success: false,
          code: 403,
          message: "Tài khoản VuotLink bị khóa hoặc API Key chưa được kích hoạt.",
        };
      }
      if (status === 502) {
        return {
          success: false,
          code: 502,
          message: `Vượt link thất bại qua hệ thống workflow (Yêu cầu đã được tự động hoàn phí). Chi tiết: ${detail || "Workflow failed"}`,
        };
      }

      return {
        success: false,
        code: status,
        message: `Máy chủ VuotLink trả về mã lỗi ${status}: ${detail || "Yêu cầu thất bại"}`,
      };
    }

    if (error.code === "ECONNABORTED" || error.message.includes("timeout")) {
      return {
        success: false,
        code: "TIMEOUT",
        message: "Hết thời gian chờ phản hồi từ máy chủ VuotLink (Timeout 90s). Link này có thể cần nhiều bước chuyển hướng phức tạp hoặc web nguồn phản hồi chậm.",
      };
    }

    return {
      success: false,
      code: "NETWORK_ERROR",
      message: `Lỗi kết nối đến VuotLink API: ${error.message}`,
    };
  }
}


/**
 * Xử lý lệnh chính /vuotlink
 */
export async function handleVuotLinkCommand(api, message, aliasCommand) {
  const prefix = getGlobalPrefix();
  const senderId = message.data.uidFrom;
  const content = removeMention(message);

  // Lấy các tham số sau tên lệnh
  const rawArgs = content.replace(new RegExp(`^\\${prefix}${aliasCommand}\\s*`, "i"), "").trim();
  const parts = rawArgs.split(/\s+/).filter(Boolean);
  const subCommand = parts[0]?.toLowerCase();

  // 1. Lệnh Trợ giúp: /vuotlink help
  if (subCommand === "help" || subCommand === "huongdan") {
    const helpMsg =
      `🔗 ─── HƯỚNG DẪN VƯỢT LINK (VUOTLINK API) ─── 🔗\n\n` +
      `📌 Tính năng: Vượt qua các trang rút gọn, đếm ngược, quảng cáo tự động và trả về link đích.\n\n` +
      `💡 Cách sử dụng:\n` +
      `1️⃣ Dán link trực tiếp:\n` +
      `   👉 ${prefix}${aliasCommand} <đường_dẫn_link>\n` +
      `2️⃣ Hoặc Reply (trích dẫn) tin nhắn chứa link và gõ:\n` +
      `   👉 ${prefix}${aliasCommand}\n\n` +
      `⚙️ Tuỳ chọn nâng cao (Gõ kèm link):\n` +
      `   • --captcha     : Bật giải captcha tự động\n` +
      `   • --no-captcha  : Tắt giải captcha\n` +
      `   • --hops <số>   : Giới hạn số bước chuyển hướng (mặc định: 10)\n` +
      `   • --force       : Bỏ qua bộ nhớ tạm (bypass mới)\n\n` +
      `👑 Lệnh Quản Trị Viên Bot:\n` +
      `   • ${prefix}${aliasCommand} info               : Xem trạng thái cấu hình & số dư\n` +
      `   • ${prefix}${aliasCommand} setkey <key>       : Cài đặt / cập nhật API key\n` +
      `   • ${prefix}${aliasCommand} captcha <on|off>   : Bật/tắt tự động giải captcha\n` +
      `   • ${prefix}${aliasCommand} hops <1-30>        : Đổi số bước tối đa mặc định\n` +
      `   • ${prefix}${aliasCommand} cleancache         : Xóa bộ nhớ cache link\n\n` +
      `🌐 Nền tảng hỗ trợ: Linkvertise, Shrinkme, Ouo, Laylink, Link4m, Bitly, Tinyurl, layma, yeumoney và hàng chục nền tảng khác!`;

    await api.sendMessage(
      {
        msg: helpMsg,
        quote: message,
        ttl: 120000,
      },
      message.threadId,
      message.type
    );
    return;
  }

  // 2. Lệnh Xem trạng thái: /vuotlink info hoặc /vuotlink status
  if (subCommand === "info" || subCommand === "status") {
    const config = getVuotLinkConfig();
    const balanceText = config.lastBalance !== null && config.lastBalance !== undefined
      ? `${Number(config.lastBalance).toLocaleString("vi-VN")} xu`
      : "Chưa ghi nhận (sẽ cập nhật sau lần vượt link)";

    const infoMsg =
      `ℹ️ ─── THÔNG TIN CẤU HÌNH VUOTLINK ─── ℹ️\n\n` +
      `🔑 API Key      : ${maskApiKey(config.apiKey)}\n` +
      `🌐 API Endpoint : ${config.apiUrl}\n` +
      `🧩 Giải Captcha : ${config.autoSolveCaptcha ? "Bật (Tự động)" : "Tắt"}\n` +
      `🔄 Max Hops     : ${config.maxHops} bước\n` +
      `⏱️ Timeout      : ${Math.round(config.timeoutMs / 1000)}s\n` +
      `💰 Số dư gần nhất: ${balanceText}\n` +
      `💾 Cache đã lưu : ${bypassCache.size} link trong RAM\n\n` +
      `💡 Dùng \`${prefix}${aliasCommand} help\` để xem hướng dẫn đầy đủ.`;

    await api.sendMessage(
      {
        msg: infoMsg,
        quote: message,
        ttl: 60000,
      },
      message.threadId,
      message.type
    );
    return;
  }

  // 3. Lệnh Cài đặt API key (Chỉ dành cho Admin Bot): /vuotlink setkey <key>
  if (subCommand === "setkey") {
    if (!isBotAdmin(senderId)) {
      await sendMessageWarningRequest(api, message, {
        caption: "❌ Bạn Không có quyền thực hiện lệnh này! Chỉ Admin Bot mới được cài đặt API Key.",
      }, 30000);
      return;
    }

    const newKey = parts[1]?.trim();
    if (!newKey) {
      await sendMessageWarningRequest(api, message, {
        caption: `Cú pháp không đúng! Sử dụng: ${prefix}${aliasCommand} setkey <api_key_cua_ban>`,
      }, 30000);
      return;
    }

    const ok = saveVuotLinkConfig({ apiKey: newKey });
    if (ok) {
      await sendMessageCompleteRequest(api, message, {
        caption: `✅ Đã lưu API Key VuotLink thành công!\nKey hiện tại: ${maskApiKey(newKey)}`,
      }, 60000);
    } else {
      await sendMessageFailed(api, message, "❌ Lưu API Key thất bại do lỗi ghi file.", true);
    }
    return;
  }

  // 4. Lệnh Đổi cài đặt captcha (Chỉ Admin): /vuotlink captcha <on|off>
  if (subCommand === "captcha") {
    if (!isBotAdmin(senderId)) {
      await sendMessageWarningRequest(api, message, {
        caption: "❌ Bạn Không có quyền thực hiện lệnh này! Chỉ Admin Bot mới được thay đổi cài đặt.",
      }, 30000);
      return;
    }

    const opt = parts[1]?.toLowerCase();
    if (opt !== "on" && opt !== "off") {
      await sendMessageWarningRequest(api, message, {
        caption: `Cú pháp không đúng! Sử dụng: ${prefix}${aliasCommand} captcha on hoặc ${prefix}${aliasCommand} captcha off`,
      }, 30000);
      return;
    }

    const autoSolveCaptcha = opt === "on";
    saveVuotLinkConfig({ autoSolveCaptcha });
    await sendMessageCompleteRequest(api, message, {
      caption: `✅ Đã ${autoSolveCaptcha ? "BẬT" : "TẮT"} tự động giải captcha mặc định!`,
    }, 60000);
    return;
  }

  // 5. Lệnh Đổi số hops (Chỉ Admin): /vuotlink hops <1-30>
  if (subCommand === "hops") {
    if (!isBotAdmin(senderId)) {
      await sendMessageWarningRequest(api, message, {
        caption: "❌ Bạn Không có quyền thực hiện lệnh này! Chỉ Admin Bot mới được thay đổi cài đặt.",
      }, 30000);
      return;
    }

    const hopsNum = parseInt(parts[1], 10);
    if (isNaN(hopsNum) || hopsNum < 1 || hopsNum > 30) {
      await sendMessageWarningRequest(api, message, {
        caption: "Vui lòng nhập số bước hợp lệ từ 1 đến 30!",
      }, 30000);
      return;
    }

    saveVuotLinkConfig({ maxHops: hopsNum });
    await sendMessageCompleteRequest(api, message, {
      caption: `✅ Đã cập nhật số bước tối đa (max_hops) thành ${hopsNum}!`,
    }, 60000);
    return;
  }

  // 6. Lệnh Xóa cache: /vuotlink cleancache
  if (subCommand === "cleancache") {
    if (!isBotAdmin(senderId)) {
      await sendMessageWarningRequest(api, message, {
        caption: "❌ Bạn Không có quyền thực hiện lệnh này! Chỉ Admin Bot mới được xóa cache.",
      }, 30000);
      return;
    }

    const count = bypassCache.size;
    bypassCache.clear();
    await sendMessageCompleteRequest(api, message, {
      caption: `✅ Đã xóa toàn bộ ${count} link trong bộ nhớ tạm (cache)!`,
    }, 30000);
    return;
  }

  // 7. Xử lý vượt link chính
  // Trích xuất flag tùy chọn: --captcha, --no-captcha, --hops <n>, --force / --nocache
  let optCaptcha = undefined;
  if (rawArgs.includes("--captcha")) optCaptcha = true;
  if (rawArgs.includes("--no-captcha")) optCaptcha = false;

  let optForce = rawArgs.includes("--force") || rawArgs.includes("--nocache");

  let optHops = undefined;
  const hopsMatch = rawArgs.match(/--hops\s+(\d+)/i);
  if (hopsMatch) {
    const parsedHops = parseInt(hopsMatch[1], 10);
    if (!isNaN(parsedHops) && parsedHops >= 1 && parsedHops <= 30) {
      optHops = parsedHops;
    }
  }

  // Làm sạch chuỗi trước khi tìm link
  const cleanedText = rawArgs
    .replace(/--captcha/gi, "")
    .replace(/--no-captcha/gi, "")
    .replace(/--hops\s+\d+/gi, "")
    .replace(/--force/gi, "")
    .replace(/--nocache/gi, "")
    .trim();

  const quote = message.data?.quote;
  const targetUrl = extractUrl(cleanedText, quote);

  if (!targetUrl) {
    const errorGuide =
      `⚠️ Vui lòng cung cấp link cần vượt hoặc reply tin nhắn có link!\n\n` +
      `💡 Ví dụ:\n` +
      `👉 ${prefix}${aliasCommand} https://linkvertise.com/...\n` +
      `👉 Hoặc reply tin nhắn chứa link rồi gõ: ${prefix}${aliasCommand}\n\n` +
      `ℹ️ Gõ \`${prefix}${aliasCommand} help\` để xem hướng dẫn chi tiết.`;

    await api.sendMessage(
      {
        msg: errorGuide,
        quote: message,
        ttl: 45000,
      },
      message.threadId,
      message.type
    );
    return;
  }

  // Kiểm tra tính hợp lệ cơ bản của URL
  let parsedUrlObj;
  try {
    parsedUrlObj = new URL(targetUrl);
    if (!parsedUrlObj.protocol.startsWith("http")) {
      throw new Error("Invalid protocol");
    }
  } catch {
    await sendMessageWarningRequest(api, message, {
      caption: `Link "${targetUrl}" không đúng định dạng HTTP/HTTPS hợp lệ!`,
    }, 30000);
    return;
  }

  // Kiểm tra cache nội bộ nếu không dùng --force
  const normalizedKey = targetUrl.toLowerCase().trim();
  if (!optForce && bypassCache.has(normalizedKey)) {
    const cachedItem = bypassCache.get(normalizedKey);
    if (Date.now() - cachedItem.timestamp < CACHE_TTL_MS) {
      const cacheResponse =
        `⚡ [KẾT QUẢ VƯỢT LINK (CACHE)] ⚡\n\n` +
        `📌 Tiêu đề: ${cachedItem.title || "Không có"}\n` +
        `🌐 Nền tảng: ${cachedItem.workflow || "Chung"}\n` +
        `🔄 Số bước: ${cachedItem.hops || 1} hop\n` +
        `📥 Link gốc: ${targetUrl}\n\n` +
        `🚀 LINK ĐÍCH:\n👉 ${cachedItem.finalUrl}\n\n` +
        `💡 Kết quả lấy từ bộ nhớ đệm (nhanh & tiết kiệm xu). Thêm --force để bypass lại.`;

      await api.sendMessage(
        {
          msg: cacheResponse,
          quote: message,
          ttl: 300000,
        },
        message.threadId,
        message.type
      );
      return;
    } else {
      bypassCache.delete(normalizedKey);
    }
  }

  // Kiểm tra xem người dùng có đang có request chạy không
  if (activeUsers.has(senderId)) {
    await sendMessageWarningRequest(api, message, {
      caption: "⏳ Bạn đang có 1 yêu cầu vượt link đang được xử lý, vui lòng chờ trong giây lát!",
    }, 20000);
    return;
  }

  activeUsers.add(senderId);

  // Gửi thông báo bắt đầu xử lý với TTL ngắn để tự biến mất
  await sendMessageProcessingRequest(api, message, {
    caption: `⏳ Đang gửi yêu cầu vượt link đến VuotLink API, vui lòng đợi trong giây lát...\n🔗 Link: ${targetUrl}`,
  }, 25000).catch(() => null);

  const startTime = Date.now();

  try {
    const result = await callVuotLinkApi({
      url: targetUrl,
      autoSolveCaptcha: optCaptcha,
      maxHops: optHops,
    });

    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);

    if (!result.success) {
      let errorMsg = `❌ VƯỢT LINK THẤT BẠI (${elapsedSeconds}s)\n\n`;
      errorMsg += `⚠️ Nguyên nhân: ${result.message}\n`;
      errorMsg += `🔗 Link yêu cầu: ${targetUrl}\n\n`;
      errorMsg += `💡 Mẹo: Kiểm tra lại xem link còn truy cập được không hoặc thử lại sau ít phút.`;

      await api.sendMessage(
        {
          msg: errorMsg,
          quote: message,
          ttl: 60000,
        },
        message.threadId,
        message.type
      );
      return;
    }

    const data = result.data;
    const finalUrl = data.final_url || data.resolved_url || "";
    const title = data.title || "Không có";
    const workflow = data.workflow || "Tự động";
    const hopsUsed = data.hops_used ?? (Array.isArray(data.solved_workflows) ? data.solved_workflows.length : 1);
    const totalCost = data.total_cost !== undefined ? `${data.total_cost} xu` : "N/A";
    const remainingBalance = data.remaining_balance !== undefined
      ? `${Number(data.remaining_balance).toLocaleString("vi-VN")} xu`
      : "N/A";

    // Lưu vào cache
    if (finalUrl) {
      bypassCache.set(normalizedKey, {
        finalUrl: finalUrl,
        title: title,
        workflow: workflow,
        hops: hopsUsed,
        timestamp: Date.now(),
      });
    }

    let successMsg =
      `🎉 ─── VƯỢT LINK THÀNH CÔNG (${elapsedSeconds}s) ─── 🎉\n\n` +
      `📌 Tiêu đề     : ${title}\n` +
      `🌐 Nền tảng    : ${workflow}\n` +
      `🔄 Số bước     : ${hopsUsed} hop\n` +
      `💰 Chi phí     : ${totalCost} (Còn lại: ${remainingBalance})\n` +
      `📥 Link gốc    : ${data.requested_url || targetUrl}\n\n` +
      `🚀 LINK ĐÍCH (KẾT QUẢ):\n` +
      `👉 ${finalUrl || "Không tìm thấy URL đích"}`;

    if (data.hops_exceeded) {
      successMsg += `\n\n⚠️ Chú ý: Đã đạt giới hạn số bước chuyển hướng tối đa (hops_exceeded = true).`;
    }

    await api.sendMessage(
      {
        msg: successMsg,
        quote: message,
        ttl: 600000,
      },
      message.threadId,
      message.type
    );
  } catch (error) {
    console.error("[VuotLink] Lỗi không xử lý được:", error);
    await sendMessageFailed(
      api,
      message,
      `❌ Đã xảy ra lỗi bất ngờ khi vượt link: ${error.message}`,
      true
    );
  } finally {
    activeUsers.delete(senderId);
  }
}


