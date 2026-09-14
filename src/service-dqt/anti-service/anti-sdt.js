import { MessageMention } from "zlbotdqt";
import { sendMessageStateQuote } from "../chat-zalo/chat-style/chat-style.js";
import { isInWhiteList } from "./white-list.js";
import { removeMention } from "../../utils/format-util.js";
import { extendMuteDuration } from "./mute-user.js";
import { writeGroupSettings } from "../../utils/io-json.js";

// Bảng chuyển đổi chữ số tiếng Việt sang ký tự số
const VIETNAMESE_DIGIT_WORDS = {
  khong: "0",
  không: "0",
  mot: "1",
  một: "1",
  mốt: "1",
  hai: "2",
  ba: "3",
  bon: "4",
  bốn: "4",
  tu: "4",
  tư: "4",
  nam: "5",
  năm: "5",
  sau: "6",
  sáu: "6",
  bay: "7",
  bảy: "7",
  tam: "8",
  tám: "8",
  chin: "9",
  chín: "9",
};

// Map theo dõi vi phạm SĐT theo từng nhóm và user
const phoneViolations = new Map();
const VIOLATION_EXPIRE_MS = 60 * 60 * 1000; // 1 tiếng
const MUTE_DURATION_SECONDS = 15 * 60; // 15 phút khi vi phạm lần 3

/**
 * Chuẩn hóa các số unicode toàn chiều rộng (full-width: ０-９)
 */
function normalizeFullWidthDigits(str = "") {
  return String(str).replace(/[\uFF10-\uFF19]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
  );
}

/**
 * Chuyển đổi các từ chữ số tiếng Việt sang ký tự số
 */
function wordsToDigits(text = "") {
  let normalized = text.toLowerCase();
  for (const [w, d] of Object.entries(VIETNAMESE_DIGIT_WORDS)) {
    const reg = new RegExp(`(?<=^|[^\\p{L}\\d])${w}(?=[^\\p{L}\\d]|$)`, "gui");
    normalized = normalized.replace(reg, d);
  }
  return normalized;
}

/**
 * Trích xuất nội dung văn bản từ các định dạng tin nhắn của Zalo
 */
function extractMessageContent(message) {
  const content = message?.data?.content;
  if (!content) return "";
  if (typeof content === "string") return content;

  const texts = [];
  if (content.text) texts.push(content.text);
  if (content.title) texts.push(content.title);
  if (content.caption) texts.push(content.caption);

  if (content.description) {
    if (typeof content.description === "string") {
      try {
        const parsed = JSON.parse(content.description);
        if (parsed.phone) texts.push(String(parsed.phone));
        if (parsed.title) texts.push(String(parsed.title));
        if (parsed.text) texts.push(String(parsed.text));
      } catch (_) {
        texts.push(content.description);
      }
    } else if (typeof content.description === "object") {
      if (content.description.phone) texts.push(String(content.description.phone));
    }
  }

  if (content.phone) {
    texts.push(String(content.phone));
  }

  return texts.join(" ");
}

/**
 * Kiểm tra xem chuỗi có chứa số điện thoại hay không
 */
export function checkPhoneNumber(rawText = "") {
  if (!rawText) return { found: false, matches: [] };

  const rawString = typeof rawText === "string" ? rawText : String(rawText);
  let text = normalizeFullWidthDigits(rawString);

  // Xử lý thay chữ cái o/O cho số 0 đầu số
  text = text.replace(/(?<=^|[^\p{L}\d])[oO](?=[\s().-]*[35789][\s().-]*\d)/gu, "0");
  text = text.replace(/(?<=^|[^\p{L}\d])[oO](?=[\s().-]*2[\s().-]*\d)/gu, "0");

  const textWithWordDigits = wordsToDigits(text);

  const patterns = [
    // Mẫu 1: Di động Việt Nam (0, 84, +84) theo sau bởi đầu số 3, 5, 7, 8, 9 và 8 chữ số
    /(?:(?:\+84|\(?\+84\)?|84|0)[\s().-]*[35789])(?:[\s().-]*\d){8}(?!\d)/g,

    // Mẫu 2: Điện thoại bàn Việt Nam (02x) 10-11 chữ số
    /(?:(?:\+84|\(?\+84\)?|84|0)[\s().-]*2)(?:[\s().-]*\d){8,9}(?!\d)/g,

    // Mẫu 3: Định dạng số điện thoại quốc tế (+ quốc gia kèm 8-12 chữ số)
    /\+(?:[1-9]\d{0,2})(?:[\s().-]*\d){8,12}(?!\d)/g,
  ];

  const foundMatches = [];

  for (const t of [text, textWithWordDigits]) {
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(t)) !== null) {
        const matchIndex = match.index;
        if (matchIndex > 0 && /\d/.test(t[matchIndex - 1])) {
          continue;
        }

        const rawMatch = match[0];
        const digitsOnly = rawMatch.replace(/\D/g, "");

        if (digitsOnly.startsWith("84")) {
          if (digitsOnly.length < 10 || digitsOnly.length > 12) continue;
        } else if (digitsOnly.startsWith("0")) {
          if (digitsOnly.length < 10 || digitsOnly.length > 11) continue;
        }

        foundMatches.push(rawMatch.trim());
      }
    }
  }

  const uniqueMatches = Array.from(new Set(foundMatches));
  return {
    found: uniqueMatches.length > 0,
    matches: uniqueMatches,
  };
}

/**
 * Xử lý kiểm tra và chặn số điện thoại khi có tin nhắn mới
 */
export async function antiSdt(
  api,
  message,
  isAdminBox,
  groupSettings,
  botIsAdminBox,
  isSelf
) {
  const threadId = message.threadId;
  const senderId = message.data.uidFrom;
  const senderName = message.data.dName || "Thành viên";

  // Miễn trừ nếu: bot tự gửi, người gửi là Quản trị nhóm, bot không có quyền admin nhóm, hoặc chưa bật AntiSĐT
  if (isSelf || isAdminBox || !botIsAdminBox) return false;
  if (!groupSettings[threadId]?.antiSdt) return false;
  if (isInWhiteList(groupSettings, threadId, senderId)) return false;

  const contentText = extractMessageContent(message);
  const checkResult = checkPhoneNumber(contentText);

  if (!checkResult.found) {
    return false;
  }

  // Phát hiện chia sẻ số điện thoại -> Xóa tin nhắn ngay lập tức
  try {
    await api.deleteMessage(message, false);
  } catch (err) {
    console.error(`[AntiSĐT] Lỗi khi xóa tin nhắn vi phạm tại nhóm ${threadId}:`, err.message);
  }

  // Quản lý số lần vi phạm
  const violationKey = `${threadId}_${senderId}`;
  const now = Date.now();
  let violation = phoneViolations.get(violationKey);

  if (!violation || now - violation.lastTime > VIOLATION_EXPIRE_MS) {
    violation = { count: 0, lastTime: now };
  }

  violation.count++;
  violation.lastTime = now;
  phoneViolations.set(violationKey, violation);

  try {
    if (violation.count === 1) {
      const warningMsg = `⚠️ ${senderName}, tin nhắn đã bị thu hồi do nhóm đang BẬT chế độ Chống gửi Số điện thoại (AntiSĐT)!\n📌 Vui lòng không chia sẻ số điện thoại vào nhóm. [Cảnh cáo 1/3]`;
      await api.sendMessage(
        {
          msg: warningMsg,
          quote: message,
          mentions: [MessageMention(senderId, senderName.length, 3)],
          ttl: 30000,
        },
        threadId,
        message.type
      );
    } else if (violation.count === 2) {
      const warningMsg = `⚠️ ${senderName}, CẢNH CÁO LẦN 2/3!\nTuyệt đối không gửi số điện thoại vào nhóm. Vi phạm lần thứ 3 bạn sẽ bị CẤM CHAT (MUTE) 15 phút!`;
      await api.sendMessage(
        {
          msg: warningMsg,
          quote: message,
          mentions: [MessageMention(senderId, senderName.length, 3)],
          ttl: 30000,
        },
        threadId,
        message.type
      );
    } else {
      // Vi phạm lần 3 -> Cấm chat 15 phút
      const changed = await extendMuteDuration(
        threadId,
        senderId,
        senderName,
        groupSettings,
        MUTE_DURATION_SECONDS
      );
      if (changed) {
        writeGroupSettings(groupSettings);
      }
      violation.count = 0; // Reset số lần vi phạm sau khi mute

      const muteMsg = `🔇 ${senderName} đã bị cấm chat 15 phút do vi phạm gửi số điện thoại 3 lần liên tiếp!`;
      await api.sendMessage(
        {
          msg: muteMsg,
          quote: message,
          mentions: [MessageMention(senderId, senderName.length, 3)],
          ttl: 60000,
        },
        threadId,
        message.type
      );
    }
  } catch (sendErr) {
    console.error(`[AntiSĐT] Lỗi gửi tin nhắn cảnh báo/mute:`, sendErr.message);
  }

  return true;
}

/**
 * Xử lý lệnh cấu hình .antisdt
 */
export async function handleAntiSdtCommand(api, message, groupSettings) {
  const threadId = message.threadId;
  const content = removeMention(message);
  const parts = content.trim().split(/\s+/);
  const subCommand = parts[1]?.toLowerCase();

  if (!groupSettings[threadId]) {
    groupSettings[threadId] = {};
  }

  // Xem trạng thái
  if (subCommand === "status") {
    const isEnabled = !!groupSettings[threadId]?.antiSdt;
    const caption = [
      "📞 [ CẤU HÌNH ANTISĐT ]",
      `- Trạng thái: ${isEnabled ? "Đang BẬT ✅" : "Đang TẮT ❌"}`,
      "- Cơ chế: Tự động thu hồi tin nhắn chứa SĐT",
      "- Xử lý vi phạm: Cảnh cáo 2 lần, lần 3 MUTE cấm chat 15 phút",
      "- Lệnh: .antisdt on | .antisdt off | .antisdt test <nội dung>",
    ].join("\n");

    await sendMessageStateQuote(api, message, caption, isEnabled, 300000);
    return false;
  }

  // Kiểm tra thử nghiệm một nội dung
  if (subCommand === "test") {
    const probeText = parts.slice(2).join(" ").trim();
    if (!probeText) {
      await sendMessageStateQuote(
        api,
        message,
        "Vui lòng nhập nội dung cần kiểm tra. Ví dụ: .antisdt test 0912345678",
        false,
        300000
      );
      return false;
    }

    const testResult = checkPhoneNumber(probeText);
    const resultText = [
      "🧪 [ KẾT QUẢ KIỂM TRA ANTISĐT ]",
      `- Nội dung: "${probeText}"`,
      `- Nhận diện: ${testResult.found ? `Phát hiện SĐT [${testResult.matches.join(", ")}]` : "Không có SĐT"}`,
      `- Kết luận: ${testResult.found ? "❌ Tin nhắn sẽ bị CHẶN & THU HỒI" : "✅ Tin nhắn ĐƯỢC PHÉP"}`,
    ].join("\n");

    await sendMessageStateQuote(api, message, resultText, !testResult.found, 300000);
    return false;
  }

  let newStatus;
  if (subCommand === "on") {
    newStatus = true;
  } else if (subCommand === "off") {
    newStatus = false;
  } else {
    // Không có tham số -> Chuyển đổi trạng thái (toggle)
    newStatus = !groupSettings[threadId].antiSdt;
  }

  groupSettings[threadId].antiSdt = newStatus;
  writeGroupSettings(groupSettings);

  const statusText = newStatus ? "BẬT" : "TẮT";
  const caption = `Chức năng chống chia sẻ số điện thoại (AntiSĐT) đã được ${statusText}!`;
  await sendMessageStateQuote(api, message, caption, newStatus, 300000);

  return true;
}

