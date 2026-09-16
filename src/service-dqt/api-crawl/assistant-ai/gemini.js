import { callGroqAi } from "../../../utils/groq-ai.js";
import { getGlobalPrefix } from "../../service.js";
import { getContent } from "../../../utils/format-util.js";
import { sendMessageComplete, sendMessageFailed, sendMessageQuery, sendMessageStateQuote } from "../../chat-zalo/chat-style/chat-style.js";

// Đã chuyển toàn bộ sang sử dụng Groq API miễn phí (không còn sử dụng Gemini API)
export async function callGeminiAPI(api, message, question) {
  return await callGroqAi(question);
}

export async function askGeminiCommand(api, message, aliasCommand) {
  const content = getContent(message);
  const prefix = getGlobalPrefix();
  const question = content.replace(`${prefix}${aliasCommand}`, "").trim();

  if (!question) {
    await sendMessageQuery(api, message, "Vui lòng nhập câu hỏi cần giải đáp! 🤔");
    return;
  }

  try {
    const replyText = await callGroqAi(question);
    await sendMessageStateQuote(api, message, replyText, true, 1800000, false);
  } catch (error) {
    console.error("Lỗi khi xử lý yêu cầu AI:", error);
    await sendMessageFailed(api, message, "Xin lỗi, có lỗi xảy ra khi xử lý yêu cầu của bạn. 😢", true);
  }
}

export async function viewChatHistory(api, message) {
  await sendMessageComplete(api, message, "Hệ thống AI hiện hoạt động qua Groq API miễn phí!", false);
}