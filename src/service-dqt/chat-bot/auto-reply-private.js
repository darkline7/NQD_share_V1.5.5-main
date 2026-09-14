import fs from "fs";
import path from "path";
import { readCommandConfig } from "../../utils/io-json.js";

const CONFIG_PATH = path.join(process.cwd(), "assets", "json-data", "auto-reply-private.json");

const DEFAULT_CONFIG = {
  enabled: true,
  message: "📩 Vui lòng nhắn qua *Zalo chính: 0392956738* để được hỗ trợ nhanh nhất nhé!\nCảm ơn bạn!",
  cooldownMs: 60000,
};

function getPrefix() {
  try {
    const config = readCommandConfig();
    return config?.prefix || "/";
  } catch {
    return "/";
  }
}

let cachedConfig = null;
const userLastReplyTime = new Map();

// Dọn dẹp bộ nhớ mỗi 30 phút
setInterval(() => {
  const now = Date.now();
  const config = getAutoReplyConfig();
  const maxAge = Math.max((config.cooldownMs || 60000) * 5, 300000);
  for (const [userId, time] of userLastReplyTime.entries()) {
    if (now - time > maxAge) {
      userLastReplyTime.delete(userId);
    }
  }
}, 30 * 60 * 1000);

export function getAutoReplyConfig() {
  if (cachedConfig) return cachedConfig;
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, "utf8");
      cachedConfig = { ...DEFAULT_CONFIG, ...JSON.parse(data.replace(/^\uFEFF/, "")) };
      return cachedConfig;
    }
  } catch (error) {
    console.error("Lỗi đọc config auto-reply-private:", error.message);
  }
  cachedConfig = { ...DEFAULT_CONFIG };
  saveAutoReplyConfig(cachedConfig);
  return cachedConfig;
}

export function saveAutoReplyConfig(config) {
  try {
    cachedConfig = config;
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
    return true;
  } catch (error) {
    console.error("Lỗi ghi config auto-reply-private:", error.message);
    return false;
  }
}

async function sendReply(api, message, text) {
  const threadId = message.threadId || message.data?.uidFrom;
  try {
    await api.sendMessage(
      {
        msg: text,
        quote: message,
      },
      threadId,
      message.type
    );
  } catch (quoteErr) {
    try {
      await api.sendMessage(
        {
          msg: text,
        },
        threadId,
        message.type
      );
    } catch (sendErr) {
      console.error("Lỗi khi gửi tin nhắn autoreply:", sendErr.message);
    }
  }
}

export async function handleAutoReplyPrivate(api, message) {
  try {
    const senderId = message.data?.uidFrom;
    const config = getAutoReplyConfig();

    if (!config.enabled) return;

    const now = Date.now();
    const lastTime = userLastReplyTime.get(senderId) || 0;
    const cooldown = config.cooldownMs || 60000;

    if (now - lastTime < cooldown) {
      return;
    }

    userLastReplyTime.set(senderId, now);
    await sendReply(api, message, config.message);
  } catch (error) {
    console.error("Lỗi khi tự động trả lời tin nhắn riêng tư:", error.message);
  }
}

export async function handleAutoReplyCommand(api, message, commandParts) {
  const prefix = getPrefix();
  const subCommand = commandParts[1]?.toLowerCase();
  const config = getAutoReplyConfig();

  if (!subCommand) {
    const statusText = config.enabled ? "🟢 Đang BẬT" : "🔴 Đang TẮT";
    const cooldownSec = Math.round((config.cooldownMs || 60000) / 1000);
    const caption =
      `⚙️ CẤU HÌNH TỰ ĐỘNG TRẢ LỜI TIN NHẮN RIÊNG\n` +
      `• Trạng thái: ${statusText}\n` +
      `• Cooldown: ${cooldownSec} giây/người\n` +
      `• Nội dung hiện tại:\n` +
      `──────────────────\n` +
      `${config.message}\n` +
      `──────────────────\n` +
      `💡 Cú pháp hướng dẫn:\n` +
      `• ${prefix}autoreply on : Bật tự động trả lời\n` +
      `• ${prefix}autoreply off : Tắt tự động trả lời\n` +
      `• ${prefix}autoreply set <nội dung> : Đổi nội dung tin nhắn\n` +
      `• ${prefix}autoreply cooldown <giây> : Cài thời gian chờ (cooldown)\n` +
      `• ${prefix}autoreply reset : Khôi phục mặc định ban đầu`;
    await sendReply(api, message, caption);
    return;
  }

  if (subCommand === "on") {
    config.enabled = true;
    saveAutoReplyConfig(config);
    await sendReply(api, message, "✅ Đã BẬT tự động trả lời tin nhắn riêng tư.");
    return;
  }

  if (subCommand === "off") {
    config.enabled = false;
    saveAutoReplyConfig(config);
    await sendReply(api, message, "🔴 Đã TẮT tự động trả lời tin nhắn riêng tư.");
    return;
  }

  if (subCommand === "set") {
    const rawContent = message.data?.content ? String(message.data.content).trim() : "";
    const match = rawContent.match(/\bset\s+([\s\S]+)/i);
    const newMsg = match ? match[1].trim() : "";
    if (!newMsg) {
      await sendReply(
        api,
        message,
        `⚠️ Vui lòng nhập nội dung cần cài đặt.\nVí dụ: ${prefix}autoreply set Vui lòng liên hệ Zalo chính: 0392956738`
      );
      return;
    }
    config.message = newMsg;
    saveAutoReplyConfig(config);
    await sendReply(
      api,
      message,
      `✅ Đã cập nhật nội dung tự động trả lời tin nhắn riêng tư:\n──────────────────\n${newMsg}`
    );
    return;
  }

  if (subCommand === "cooldown") {
    const seconds = parseInt(commandParts[2]);
    if (isNaN(seconds) || seconds < 0) {
      await sendReply(
        api,
        message,
        `⚠️ Vui lòng nhập số giây hợp lệ (từ 0 trở lên).\nVí dụ: ${prefix}autoreply cooldown 30`
      );
      return;
    }
    config.cooldownMs = seconds * 1000;
    saveAutoReplyConfig(config);
    await sendReply(
      api,
      message,
      `✅ Đã cài đặt thời gian chờ (cooldown) là ${seconds} giây mỗi người.`
    );
    return;
  }

  if (subCommand === "reset") {
    config.enabled = true;
    config.message = DEFAULT_CONFIG.message;
    config.cooldownMs = DEFAULT_CONFIG.cooldownMs;
    saveAutoReplyConfig(config);
    await sendReply(
      api,
      message,
      `✅ Đã khôi phục cài đặt mặc định:\n──────────────────\n${config.message}`
    );
    return;
  }

  await sendReply(api, message, `⚠️ Lệnh Không hợp lệ. Dùng "${prefix}autoreply" để xem hướng dẫn.`);
}

