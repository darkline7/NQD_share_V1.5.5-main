import fs from "fs";
import path from "path";

const CONFIG_PATH = path.resolve(process.cwd(), "assets", "json-data", "mixu-key-config.json");
const cooldownByThread = new Map();

function removeVietnameseAccents(str) {
  if (!str || typeof str !== "string") return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

export function getMixuKeyConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Lỗi khi đọc file mixu-key-config.json:", error.message);
  }
  return {
    enabled: true,
    groupKeywords: ["mixu", "dua hau"],
    triggerKeywords: ["key", "getkey"],
    cooldownSeconds: 10,
    messageTemplate: `🍉 ─── THÔNG BÁO UPDATE KEY MIXU ─── 🍉

📢 Bản Mới: Đã có getkey vượt link (2 link / 12 tiếng)
⚠️ Lưu ý: Ai đang dùng key cũ vui lòng KHÔNG UPDATE!

🔗 Link Get Key:
👉 https://mrlightvn.fun/app/getkey?ref=nnq1801

📲 Link Tải Bản Cài Đặt:
🔹 Multi APK:
https://www.mediafire.com/file/szapu3yb9q5tmuo/MixuMulti_16-9[1].apk/file

🔹 Module ZIP:
https://www.mediafire.com/file/bg3ahcu2fv1j4g5/MixuModule_16-9[1].zip/file

🍉 ─── BẢNG GIÁ KEY ─── 🍉
  ▪️  3 Ngày  ➜  40 🍉
  ▪️  7 Ngày  ➜  70 🍉
  ▪️ 30 Ngày  ➜ 200 🍉
─────────────────────────────
💬 Nhắn tin Admin để mua key & kích hoạt ngay!`,
  };
}

export function isMixuDuaHauGroup(threadId, nameGroup) {
  const config = getMixuKeyConfig();
  if (!config.enabled) return false;

  const cleanGroup = removeVietnameseAccents(nameGroup || "").toLowerCase();
  const keywords = Array.isArray(config.groupKeywords) && config.groupKeywords.length > 0
    ? config.groupKeywords
    : ["mixu", "dua hau"];

  return keywords.every((kw) => cleanGroup.includes(removeVietnameseAccents(kw).toLowerCase()));
}

export function isMixuKeyTrigger(content) {
  if (typeof content !== "string") return false;
  const clean = content.trim().toLowerCase();
  if (!clean) return false;

  // Khớp từ "key", "xin key", "lấy key", "getkey", "get key", v.v.
  return /\bkey\b/i.test(clean) || /get\s*key/i.test(clean);
}

export async function handleMixuKeyAutoResponse(api, message, threadId, nameGroup) {
  try {
    if (!isMixuDuaHauGroup(threadId, nameGroup)) {
      return false;
    }

    const content = message?.data?.content;
    if (!isMixuKeyTrigger(content)) {
      return false;
    }

    const config = getMixuKeyConfig();
    if (!config.enabled) return false;

    // Kiểm tra cooldown chống spam nhóm
    const cooldownMs = (Number(config.cooldownSeconds) || 10) * 1000;
    const lastSent = cooldownByThread.get(threadId) || 0;
    const now = Date.now();
    if (now - lastSent < cooldownMs) {
      return true; // Đã nhận diện lệnh nhưng đang trong cooldown, chặn không kích hoạt bot khác
    }
    cooldownByThread.set(threadId, now);

    const replyMsg = config.messageTemplate;
    const senderName = message?.data?.dName || "";
    const senderId = message?.data?.uidFrom;

    try {
      if (senderId && senderName) {
        await api.sendMessage(
          {
            msg: `${senderName}\n${replyMsg}`,
            quote: message,
            mentions: [{ pos: 0, uid: senderId, len: senderName.length }],
          },
          threadId,
          message.type
        );
      } else {
        await api.sendMessage({ msg: replyMsg, quote: message }, threadId, message.type);
      }
    } catch (sendErr) {
      // Fallback gửi không quote nếu có lỗi Zalo quote
      await api.sendMessage(replyMsg, threadId, message.type);
    }

    return true;
  } catch (error) {
    console.error("Lỗi khi xử lý handleMixuKeyAutoResponse:", error.message);
    return false;
  }
}
