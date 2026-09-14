import {
  sendMessageStateQuote,
  sendMessageWarning,
  sendMessageQuery,
} from "../../service-dqt/chat-zalo/chat-style/chat-style.js";
import { getGlobalPrefix } from "../../service-dqt/service.js";

export async function handleBotControlCommand(api, message, groupSettings, commandParts, isAuthorized, nameGroup) {
  const threadId = message.threadId;
  if (!threadId) return false;

  const prefix = getGlobalPrefix();
  const action = commandParts[1]?.toLowerCase();

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
