import { sendMessageFailed } from "../chat-zalo/chat-style/chat-style.js";

export async function handleAiCommand(api, message, aliasCommand) {
  await sendMessageFailed(api, message, "⚠️ Chức năng AI hiện đã được gỡ bỏ khỏi hệ thống bot.", true);
}
