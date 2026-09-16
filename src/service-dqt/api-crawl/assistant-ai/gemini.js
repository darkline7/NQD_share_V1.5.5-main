import { sendMessageFailed } from "../../chat-zalo/chat-style/chat-style.js";

export async function callGeminiAPI(api, message, question) {
  return null;
}

export async function askGeminiCommand(api, message, aliasCommand) {
  await sendMessageFailed(api, message, "Chức năng AI hiện đã bị gỡ bỏ khỏi bot.", true);
}

export async function viewChatHistory(api, message) {
  await sendMessageFailed(api, message, "Chức năng AI hiện đã bị gỡ bỏ khỏi bot.", false);
}