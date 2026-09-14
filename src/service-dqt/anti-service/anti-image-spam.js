import { MessageMention, MessageType } from "zlbotdqt";
import { sendMessageStateQuote } from "../chat-zalo/chat-style/chat-style.js";
import { createBlockSpamImage } from "../../utils/canvas/event-image.js";
import { clearImagePath } from "../../utils/canvas/index.js";
import { getGroupInfoData } from "../info-service/group-info.js";
import { getUserInfoData } from "../info-service/user-info.js";
import { isInWhiteList } from "./white-list.js";
import { removeMention } from "../../utils/format-util.js";
import { extendMuteDuration } from "./mute-user.js";
import { writeGroupSettings } from "../../utils/io-json.js";

// ─── Cấu hình ngưỡng ─────────────────────────────────────────────────────────
const IMAGE_WINDOW_MS   = 60 * 60 * 1000; // Cửa sổ theo dõi: 1 giờ
const WARN_THRESHOLD    = 5;              // Số ảnh → cảnh cáo lần 1
const MUTE_THRESHOLD    = 10;             // Số ảnh → tự động mute 30 phút
const BLOCK_THRESHOLD   = 15;            // Số ảnh → block khỏi nhóm
const MUTE_DURATION_SEC = 30 * 60;       // Thời gian mute: 30 phút (giây)

// ─── In-memory state ─────────────────────────────────────────────────────────
const imageTrackers = new Map();
const processingBlock = new Set();

function getTracker(senderId) {
  const now = Date.now();
  if (imageTrackers.has(senderId)) {
    const tracker = imageTrackers.get(senderId);
    if (now - tracker.firstSendTime > IMAGE_WINDOW_MS) {
      imageTrackers.set(senderId, { count: 0, firstSendTime: now, warned: false, muted: false });
    }
    return imageTrackers.get(senderId);
  }
  const tracker = { count: 0, firstSendTime: now, warned: false, muted: false };
  imageTrackers.set(senderId, tracker);
  return tracker;
}

function isImageMessage(message) {
  const msgType = message.data?.msgType;
  if (msgType === "chat.photo") return true;
  if (typeof message.data?.content === "object" && message.data?.content?.thumb) return true;
  return false;
}

export async function antiImageSpam(api, message, isAdminBox, groupSettings, botIsAdminBox, isSelf) {
  const threadId   = message.threadId;
  const senderId   = message.data.uidFrom;
  const senderName = message.data.dName || "Người Dùng";

  if (!groupSettings[threadId]?.antiImageSpam) return false;
  if (isAdminBox || isSelf || !botIsAdminBox) return false;
  if (isInWhiteList(groupSettings, threadId, senderId)) return false;
  if (!isImageMessage(message)) return false;
  if (processingBlock.has(senderId)) return false;

  const tracker = getTracker(senderId);
  tracker.count++;
  const count = tracker.count;

  // ── BLOCK ──────────────────────────────────────────────────────────────────
  if (count >= BLOCK_THRESHOLD) {
    if (processingBlock.has(senderId)) return true;
    processingBlock.add(senderId);
    try { await api.deleteMessage(message, false); } catch (_) {}

    let imagePath = null;
    try {
      const groupInfo = await getGroupInfoData(api, threadId);
      const userInfo  = await getUserInfoData(api, senderId);
      imagePath = await createBlockSpamImage(userInfo, groupInfo.name, groupInfo.groupType, userInfo.genderId ?? 0);
      try {
        await api.sendMessage(
          { msg: "", attachments: imagePath ? [imagePath] : [], quote: message },
          threadId, MessageType.GroupMessage
        );
      } catch (_) {
        await api.sendMessage(
          { msg: `🚫 ${senderName} đã bị chặn do spam ảnh (${count} ảnh/1h)!`, quote: message },
          threadId, MessageType.GroupMessage
        );
      }
      await api.blockUsers(threadId, [senderId]).catch(console.error);
      try {
        await api.sendMessage(
          { msg: `Bạn đã bị chặn khỏi nhóm vì gửi quá nhiều ảnh (${count} ảnh / 1 giờ).` },
          senderId, MessageType.DirectMessage
        );
      } catch (_) {}
    } catch (err) {
      console.error("[AntiImageSpam] Lỗi block:", err);
    } finally {
      await clearImagePath(imagePath);
      imageTrackers.delete(senderId);
      setTimeout(() => processingBlock.delete(senderId), 5000);
    }
    return true;
  }

  // ── MUTE ───────────────────────────────────────────────────────────────────
  if (count >= MUTE_THRESHOLD && !tracker.muted) {
    tracker.muted = true;
    try { await api.deleteMessage(message, false); } catch (_) {}
    const changed = await extendMuteDuration(threadId, senderId, senderName, groupSettings, MUTE_DURATION_SEC);
    if (changed) writeGroupSettings(groupSettings);
    await api.sendMessage(
      {
        msg: `🔇 ${senderName} bị tắt tiếng 30 phút vì spam ảnh (${count} ảnh/1h)!\n⚠️ Gửi thêm sẽ bị chặn!`,
        mentions: [MessageMention(senderId, senderName.length, "🔇 ".length)],
        ttl: 30000,
      },
      threadId, MessageType.GroupMessage
    );
    return true;
  }

  // ── Xóa ảnh khi đã vượt mute nhưng chưa block ─────────────────────────────
  if (count > MUTE_THRESHOLD) {
    try { await api.deleteMessage(message, false); } catch (_) {}
    return true;
  }

  // ── CẢNH CÁO ──────────────────────────────────────────────────────────────
  if (count === WARN_THRESHOLD && !tracker.warned) {
    tracker.warned = true;
    await api.sendMessage(
      {
        msg: `⚠️ Cảnh báo ${senderName}: đã gửi ${count} ảnh/1h!\n📌 Giới hạn: ${MUTE_THRESHOLD} ảnh → tắt tiếng | ${BLOCK_THRESHOLD} ảnh → bị chặn.`,
        mentions: [MessageMention(senderId, senderName.length, "⚠️ Cảnh báo ".length)],
        ttl: 20000,
      },
      threadId, MessageType.GroupMessage
    );
  }

  return false;
}

export async function handleAntiImageSpamCommand(api, message, groupSettings) {
  const threadId = message.threadId;
  const content  = removeMention(message);
  const status   = content.split(/\s+/)[1]?.toLowerCase();

  if (!groupSettings[threadId]) groupSettings[threadId] = {};

  let newStatus;
  if (status === "on") {
    groupSettings[threadId].antiImageSpam = true;
    newStatus = "bật";
  } else if (status === "off") {
    groupSettings[threadId].antiImageSpam = false;
    newStatus = "tắt";
  } else {
    groupSettings[threadId].antiImageSpam = !groupSettings[threadId].antiImageSpam;
    newStatus = groupSettings[threadId].antiImageSpam ? "bật" : "tắt";
  }

  const caption =
    `Chức năng chống spam ảnh đã được ${newStatus}!\n` +
    `📌 >${WARN_THRESHOLD} ảnh/h → cảnh cáo | >${MUTE_THRESHOLD} ảnh/h → mute 30p | >${BLOCK_THRESHOLD} ảnh/h → chặn`;

  await sendMessageStateQuote(api, message, caption, groupSettings[threadId].antiImageSpam, 300000);
  return true;
}
