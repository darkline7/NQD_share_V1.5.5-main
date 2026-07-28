import { callGroqAi } from "../../utils/groq-ai.js";
import { removeMention } from "../../utils/format-util.js";
import { getGlobalPrefix } from "../service.js";
import {
  appendConversation,
  clearConversation,
  getAiUserContextKey,
  getConversationHistory,
} from "../../utils/ai-memory.js";

const AI_COMMAND_PROMPT = [
  "Bạn là một AI nói chuyện kiểu bạn bè cực thân trong bot Zalo của Thanh Bình.",
  "Mặc định xưng 'tao' và gọi người dùng là 'mày' trong toàn bộ câu trả lời.",
  "Nói tiếng Việt đời thường như người thật đang nhắn tin: cộc, thẳng, gọn, không giữ hình tượng.",
  "Được cà khịa, khịa đểu, phản ứng mạnh và dùng vài câu chửi đời thường khi người dùng làm sai hoặc hỏi lộn xộn.",
  "Không dùng giọng nhân viên tư vấn, chăm sóc khách hàng, giáo viên hay văn mẫu lịch sự giả tạo.",
  "Đi thẳng vào vấn đề: nếu sai thì nói sai ở đâu, vì sao sai, rồi đưa cách làm đúng.",
  "Nếu người dùng cãi nhưng sai, phản bác thẳng bằng bằng chứng hoặc lý do rõ ràng.",
  "Không đồng ý bừa chỉ để chiều người dùng.",
  "Nếu bạn trả lời sai, nhận ngay: 'Ừ, đoạn này tao nói sai.' hoặc 'Tao tính nhầm mẹ rồi, sửa lại như sau.'",
  "Bạn có bộ nhớ riêng theo từng người dùng. Dùng lịch sử chat để nhớ cách xưng hô, sở thích, việc đang làm và ngữ cảnh trước đó của người đang hỏi.",
  "Không trộn thông tin giữa người này với người khác. Nếu không có trong lịch sử của người đó thì nói không biết, đừng bịa.",
  "Giữ mức mỏ hỗn ở dạng bạn bè thân: không đe dọa, không kỳ thị, không xúc phạm nhóm yếu thế, không kích động gây hại.",
  "Nếu câu hỏi thiếu dữ kiện, hỏi lại đúng phần cần bổ sung, đừng đoán mò.",
  "Nếu liên quan pháp lý, y tế, tài chính nghiêm trọng, nói thẳng đây không phải chỗ phán chắc và nhắc người dùng kiểm chứng với chuyên gia.",
].join(" ");

function getQuoteText(message) {
  const quote = message.data?.quote;
  if (!quote) return "";

  if (typeof quote.msg === "string" && quote.msg.trim()) {
    return quote.msg.trim();
  }

  if (typeof quote.attach === "string") {
    try {
      const attach = JSON.parse(quote.attach);
      return [attach.title, attach.description, attach.href].filter(Boolean).join("\n").trim();
    } catch {
      return "";
    }
  }

  return "";
}

function splitMessage(text, maxLength = 1800) {
  if (text.length <= maxLength) return [text];

  const parts = [];
  let current = "";
  for (const line of text.split("\n")) {
    if ((current + line + "\n").length > maxLength) {
      if (current.trim()) parts.push(current.trim());
      current = "";
    }
    current += line + "\n";
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

export async function handleAiCommand(api, message, aliasCommand) {
  const prefix = getGlobalPrefix();
  const content = removeMention(message);
  const question = content.replace(`${prefix}${aliasCommand}`, "").trim();
  const quoteText = getQuoteText(message);
  const memoryKey = getAiUserContextKey(message);
  const senderName = message.data?.dName || "người dùng";

  if (/^(reset|clear|xoa|xóa|forget|quen|quên)$/i.test(question)) {
    clearConversation(memoryKey);
    await api.sendMessage(
      {
        msg: "Xóa trí nhớ riêng của mày rồi. Giờ hỏi lại từ đầu, đỡ lẫn mấy chuyện cũ.",
        quote: message,
        ttl: 60000,
      },
      message.threadId,
      message.type
    );
    return;
  }

  if (/^(memory|history|lichsu|lịch sử|nho gi|nhớ gì)$/i.test(question)) {
    const historyCount = getConversationHistory(memoryKey).length;
    await api.sendMessage(
      {
        msg: `Tao đang nhớ ${historyCount} mẩu hội thoại gần nhất của riêng mày. Muốn xóa thì dùng ${prefix}${aliasCommand} reset.`,
        quote: message,
        ttl: 60000,
      },
      message.threadId,
      message.type
    );
    return;
  }

  if (!question && !quoteText) {
    await api.sendMessage(
      {
        msg:
          `Nhập nội dung cần hỏi AI.\n` +
          `Ví dụ: ${prefix}${aliasCommand} tóm tắt giúp tôi cách tạo sticker\n` +
          `Hoặc reply một tin nhắn rồi dùng ${prefix}${aliasCommand} tóm tắt`,
        quote: message,
        ttl: 60000,
      },
      message.threadId,
      message.type
    );
    return;
  }

  const prompt = [
    `Người đang hỏi: ${senderName}`,
    quoteText ? `Tin nhắn được reply:\n${quoteText}` : "",
    question ? `Yêu cầu của người dùng:\n${question}` : "Hãy xử lý tin nhắn được reply một cách hữu ích.",
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const history = getConversationHistory(memoryKey);
    const answer = await callGroqAi(prompt, {
      systemPrompt: AI_COMMAND_PROMPT,
      history,
      requireEnabled: false,
      temperature: 0.9,
      maxTokens: 700,
      timeout: 60000,
    });

    appendConversation(memoryKey, "user", prompt);
    appendConversation(memoryKey, "assistant", answer);

    const parts = splitMessage(answer);
    for (let i = 0; i < parts.length; i++) {
      await api.sendMessage(
        {
          msg: parts[i],
          quote: i === 0 ? message : null,
          ttl: 300000,
        },
        message.threadId,
        message.type
      );
    }
  } catch (error) {
    console.error("Lỗi khi xử lý lệnh AI:", error.message);
    await api.sendMessage(
      {
        msg: "AI đang lỗi hoặc API key Groq chưa dùng được. Thử lại sau nhé.",
        quote: message,
        ttl: 60000,
      },
      message.threadId,
      message.type
    );
  }
}
