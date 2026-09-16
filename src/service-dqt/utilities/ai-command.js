import { callGroqAi, isRedfingerSupportGroup } from "../../utils/groq-ai.js";
import { removeMention } from "../../utils/format-util.js";
import { getGlobalPrefix } from "../service.js";
import { getGroupInfoData } from "../info-service/group-info.js";
import {
  appendConversation,
  clearConversation,
  getAiUserContextKey,
  getConversationHistory,
} from "../../utils/ai-memory.js";

const AI_COMMAND_PROMPT = [
  "Bạn là Trợ lý AI Chăm sóc Khách hàng chính thức của website redfinger.vn và nhóm Cộng đồng Redfinger Việt Nam.",
  "Nhiệm vụ của bạn là tư vấn, giải đáp thắc mắc và hỗ trợ khách hàng về dịch vụ thuê điện thoại đám mây (Android Cloud Phone) treo game 24/7 và mã quà tặng (Redfinger Redeem Code).",
  "Luôn giữ phong cách lịch sự, thân thiện, nhiệt tình và chuyên nghiệp. Xưng 'Em' (hoặc 'Redfinger Support') và gọi khách hàng là 'Bạn', 'Anh/Chị' hoặc 'Quý khách'. Tuyệt đối không xưng tao-mày, không cộc cằn hay thô lỗ.",
  "Trả lời ngắn gọn, chính xác, bám sát các chính sách và thông tin chính hãng trên website redfinger.vn.",
  "Nhắc nhở khách hàng bảo mật mã thẻ 12 ký tự, không gửi mã lên nhóm công khai.",
  "Nếu khách hàng hỏi về nạp tiền: Nhấn mạnh tối thiểu 50.000 VNĐ, CHỈ chuyển khoản NGÂN HÀNG, TUYỆT ĐỐI KHÔNG dùng MoMo/ZaloPay quét mã QR Shop.",
  "Nếu khách hàng gặp lỗi 'Điện thoại đám mây đã hết hàng': Giải thích đây là do máy chủ toàn cầu tạm thời hết máy trống, không phải lỗi mã hay lỗi web. Hướng dẫn kiên nhẫn chờ 3-5 phút thử lại hoặc chọn server khác còn máy rồi dùng tính năng Replace (Đổi máy chủ) sau.",
  "Nếu khách hỏi về cách sử dụng: Hướng dẫn vào app Redfinger hoặc web cloudemulator.vn, vào mục Mã quà tặng trả trước -> Thêm mới hoặc Gia hạn -> Nhập mã 12 ký tự."
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
  if (message.type === 1) {
    let groupName = "";
    try {
      const groupInfo = await getGroupInfoData(api, message.threadId);
      groupName = groupInfo?.name || "";
    } catch (e) {
      groupName = "";
    }

    if (!isRedfingerSupportGroup(message.threadId, groupName)) {
      await api.sendMessage(
        {
          msg: "Dạ, Trợ lý AI Chăm sóc Khách hàng Redfinger chỉ hỗ trợ trong nhóm 'Cộng đồng Redfinger Việt Nam' thôi ạ! Quý khách vui lòng đặt câu hỏi tại nhóm cộng đồng để được hỗ trợ nhé. 🙏",
          quote: message,
          ttl: 30000,
        },
        message.threadId,
        message.type
      );
      return;
    }
  }

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
        msg: "Dạ, em đã xóa lịch sử hội thoại trước đó rồi ạ. Quý khách có thể hỏi lại câu hỏi mới nhé!",
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
        msg: `Em đang lưu nhớ ${historyCount} lượt hội thoại gần nhất của bạn. Nếu muốn làm mới cuộc trò chuyện, bạn gõ ${prefix}${aliasCommand} reset nhé!`,
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
          `Quý khách vui lòng nhập nội dung cần Redfinger hỗ trợ.\n` +
          `Ví dụ: ${prefix}${aliasCommand} giá thuê VIP 1 tháng bao nhiêu?\n` +
          `Hoặc: ${prefix}${aliasCommand} cách khắc phục lỗi hết hàng khi nhập code`,
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
      temperature: 0.7,
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
