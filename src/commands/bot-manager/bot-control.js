import {
  sendMessageStateQuote,
  sendMessageWarning,
  sendMessageQuery,
} from "../../service-dqt/chat-zalo/chat-style/chat-style.js";
import { getGlobalPrefix } from "../../service-dqt/service.js";
import { writeGroupSettings, readAdmins } from "../../utils/io-json.js";
import { getGroupAdmins } from "../../service-dqt/info-service/group-info.js";
import { isHighestAdmin } from "../manager-command/set-command.js";

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
  if (trimmed === "bot" || trimmed.startsWith("bot ")) {
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
    const isAdminLevelHighest = isHighestAdmin(senderId);
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
    const statusText = currentStatus ? "🟢 Đang BẬT" : "🔴 Đang TẮT";
    const groupTitle = nameGroup || groupSettings[threadId]?.nameGroup || "Nhóm hiện tại";
    const caption =
      `🤖 TRẠNG THÁI BOT TRONG NHÓM\n` +
      `• Nhóm: ${groupTitle}\n` +
      `• Trạng thái: ${statusText}\n` +
      `──────────────────\n` +
      `💡 Hướng dẫn sử dụng:\n` +
      `• ${prefix}bot on : Bật bot hoạt động trong nhóm\n` +
      `• ${prefix}bot off : Tắt bot trong nhóm\n` +
      `*(Chỉ Trưởng/Phó nhóm hoặc Quản trị Bot mới có thể Bật/Tắt)*`;
    await sendMessageQuery(api, message, caption);
    return false;
  }

  if (action === "on") {
    if (currentStatus) {
      await sendMessageWarning(
        api,
        message,
        "⚠️ Bot hiện đã đang BẬT trong nhóm này rồi!"
      );
      return false;
    }
    groupSettings[threadId].activeBot = true;
    writeGroupSettings(groupSettings);
    await sendMessageStateQuote(
      api,
      message,
      "Đã BẬT bot trong nhóm thành công!\nBot đã sẵn sàng hoạt động trở lại.",
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
        "⚠️ Bot hiện đã đang TẮT trong nhóm này rồi!"
      );
      return false;
    }
    groupSettings[threadId].activeBot = false;
    writeGroupSettings(groupSettings);
    await sendMessageStateQuote(
      api,
      message,
      `Đã TẮT bot trong nhóm thành công!\nBot sẽ tạm dừng mọi hoạt động trong nhóm này cho đến khi Quản trị viên bật lại bằng "${prefix}bot on".`,
      false,
      300000
    );
    return true;
  }

  await sendMessageWarning(
    api,
    message,
    `⚠️ Cú pháp Không hợp lệ. Vui lòng sử dụng:\n• ${prefix}bot on : Bật bot\n• ${prefix}bot off : Tắt bot`
  );
  return false;
}
