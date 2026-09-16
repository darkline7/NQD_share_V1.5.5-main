import {
  sendMessageStateQuote,
  sendMessageWarning,
  sendMessageQuery,
} from "../../service-dqt/chat-zalo/chat-style/chat-style.js";
import { getGlobalPrefix } from "../../service-dqt/service.js";
import { writeGroupSettings, readAdmins } from "../../utils/io-json.js";
import { getGroupAdmins } from "../../service-dqt/info-service/group-info.js";
import { isAdmin } from "../../index.js";

export function isBotControlCommand(content, prefix) {
  if (!content || typeof content !== "string") return false;
  const trimmed = content.trim().toLowerCase();
  const pref = (prefix || "/").toLowerCase();

  // Kiểm tra cú pháp có tiền tố hoặc không có tiền tố
  if (trimmed === `${pref}bot` || trimmed.startsWith(`${pref}bot `)) {
    return true;
  }
  if (trimmed === "/bot" || trimmed.startsWith("/bot ")) {
    return true;
  }
  if (trimmed === ".bot" || trimmed.startsWith(".bot ")) {
    return true;
  }
  if (trimmed === "!bot" || trimmed.startsWith("!bot ")) {
    return true;
  }
  return false;
}

export async function handleBotControlCommand(
  api,
  message,
  groupSettings,
  commandParts,
  isAuthorized,
  nameGroup
) {
  const threadId = message.threadId;
  if (!threadId) return false;

  const prefix = getGlobalPrefix();

  let action;
  if (Array.isArray(commandParts) && commandParts.length > 0) {
    if (commandParts[0].toLowerCase().endsWith("bot") && commandParts.length > 1) {
      action = commandParts[1]?.toLowerCase();
    } else if (commandParts.length > 1) {
      action = commandParts[1]?.toLowerCase();
    } else if (commandParts.length === 1 && !commandParts[0].toLowerCase().endsWith("bot")) {
      action = commandParts[0]?.toLowerCase();
    }
  }

  if (!action) {
    const rawContent = (message?.data?.content || "").trim();
    const tokens = rawContent.split(/\s+/);
    if (tokens.length > 1) {
      action = tokens[1]?.toLowerCase();
    }
  }

  if (isAuthorized === undefined) {
    const senderId = message.data?.uidFrom;
    const groupAdmins = await getGroupAdmins(api, threadId);
    const isAdminBox = Array.isArray(groupAdmins) && groupAdmins.includes(senderId);
    const botAdmins = readAdmins();
    const isAdminBot = Array.isArray(botAdmins) && botAdmins.includes(senderId);
    const isAdminLevelHighest = isAdmin(senderId);
    isAuthorized = isAdminBox || isAdminBot || isAdminLevelHighest;
  }

  if (!isAuthorized) {
    await sendMessageWarning(
      api,
      message,
      "⚠️ Bạn không có đủ quyền để sử dụng lệnh này!\nChỉ Trưởng/Phó nhóm hoặc Quản trị Bot mới có thể Bật/Tắt Bot."
    );
    return false;
  }

  if (!groupSettings[threadId]) {
    groupSettings[threadId] = {};
  }

  const currentStatus = groupSettings[threadId].activeBot !== false;

  if (!action || action === "status" || action === "info") {
    const statusText = currentStatus ? "🟢 Đang BẬT" : "🔴 Đang TẮT (Chỉ giữ Anti & Cài đặt)";
    const groupTitle = nameGroup || groupSettings[threadId]?.nameGroup || "Nhóm hiện tại";
    const caption =
      `🤖 TRẠNG THÁI TƯƠNG TÁC BOT TRONG NHÓM\n` +
      `• Nhóm: ${groupTitle}\n` +
      `• Tương tác thành viên: ${statusText}\n` +
      `• Chức năng bảo vệ Anti: 🟢 Luôn hoạt động\n` +
      `• Chức năng cài đặt/quản trị: 🟢 Luôn hoạt động\n` +
      `──────────────────\n` +
      `💡 Hướng dẫn sử dụng:\n` +
      `• ${prefix}bot on : Bật tương tác thành viên trong nhóm\n` +
      `• ${prefix}bot off : Tắt tương tác thành viên (chức năng setting & anti vẫn hoạt động)\n` +
      `*(Chỉ Trưởng/Phó nhóm hoặc Quản trị Bot mới có thể Bật/Tắt)*`;
    await sendMessageQuery(api, message, caption);
    return false;
  }

  if (action === "on") {
    if (currentStatus) {
      await sendMessageWarning(
        api,
        message,
        "⚠️ Tương tác bot hiện đã đang BẬT trong nhóm này rồi!"
      );
      return false;
    }
    groupSettings[threadId].activeBot = true;
    writeGroupSettings(groupSettings);
    await sendMessageStateQuote(
      api,
      message,
      "Đã BẬT tương tác bot trong nhóm thành công!\nBot đã sẵn sàng trò chuyện, phản hồi lệnh và tương tác với thành viên.",
      true,
      300000
    );
    return true;
  }

  if (action === "off") {
    if (!currentStatus) {
      await sendMessageWarning(
        api,
        message,
        "⚠️ Tương tác bot hiện đã đang TẮT trong nhóm này rồi!"
      );
      return false;
    }
    groupSettings[threadId].activeBot = false;
    writeGroupSettings(groupSettings);
    await sendMessageStateQuote(
      api,
      message,
      `Đã TẮT tương tác bot trong nhóm thành công!\nBot sẽ tạm dừng tương tác và phản hồi thành viên thường.\n💡 Lưu ý: Các chức năng bảo vệ Anti (chống sđt, link, spam, từ cấm, v.v.) và các lệnh cài đặt quản trị của Quản trị viên vẫn hoạt động bình thường.\nDùng "${prefix}bot on" để mở lại tương tác.`,
      false,
      300000
    );
    return true;
  }

  await sendMessageWarning(
    api,
    message,
    `⚠️ Cú pháp Không hợp lệ. Vui lòng sử dụng:\n• ${prefix}bot on : Bật tương tác thành viên\n• ${prefix}bot off : Tắt tương tác thành viên (giữ anti & cài đặt)`
  );
  return false;
}
