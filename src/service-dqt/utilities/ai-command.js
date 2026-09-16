import {
  callGroqAi,
  isRedfingerSupportGroup,
  getEffectiveAiPrompt,
} from "../../utils/groq-ai.js";
import { removeMention } from "../../utils/format-util.js";
import { getGlobalPrefix } from "../service.js";
import { getGroupInfoData, getGroupAdmins } from "../info-service/group-info.js";
import {
  appendConversation,
  clearConversation,
  getAiUserContextKey,
  getConversationHistory,
} from "../../utils/ai-memory.js";
import { readGroupSettings, writeGroupSettings } from "../../utils/io-json.js";
import { isAdmin } from "../../index.js";
import { learnNewResponse } from "../chat-bot/bot-learning/dqt-bot.js";

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
  const rawInput = content.replace(new RegExp(`^${prefix}${aliasCommand}\\s*`, "i"), "").trim();
  const quoteText = getQuoteText(message);
  const memoryKey = getAiUserContextKey(message);
  const senderName = message.data?.dName || "người dùng";
  const senderId = message.data?.uidFrom;
  const threadId = message.threadId;
  const isGroup = message.type === 1;

  let groupName = "";
  let groupAdmins = [];
  if (isGroup) {
    try {
      const groupInfo = await getGroupInfoData(api, threadId);
      groupName = groupInfo?.name || "";
      groupAdmins = await getGroupAdmins(groupInfo);
    } catch (e) {
      groupName = "";
    }
  }

  // 1. Lệnh xóa trí nhớ hội thoại cá nhân
  if (/^(reset|clear|xoa|xóa|forget|quen|quên)$/i.test(rawInput)) {
    clearConversation(memoryKey);
    await api.sendMessage(
      {
        msg: "Dạ, em đã xóa lịch sử hội thoại trước đó rồi ạ. Bạn có thể hỏi lại câu hỏi mới nhé!",
        quote: message,
        ttl: 60000,
      },
      threadId,
      message.type
    );
    return;
  }

  // 2. Xem số lượt hội thoại đang ghi nhớ
  if (/^(memory|history|lichsu|lịch sử|nho gi|nhớ gì)$/i.test(rawInput)) {
    const historyCount = getConversationHistory(memoryKey).length;
    await api.sendMessage(
      {
        msg: `Em đang lưu nhớ ${historyCount} lượt hội thoại gần nhất của bạn. Nếu muốn làm mới cuộc trò chuyện, bạn gõ ${prefix}${aliasCommand} reset nhé!`,
        quote: message,
        ttl: 60000,
      },
      threadId,
      message.type
    );
    return;
  }

  // 3. Quản lý / Xem / Đổi prompt AI riêng cho nhóm
  if (/^prompt(\s+.*)?$/i.test(rawInput)) {
    const promptArg = rawInput.replace(/^prompt\s*/i, "").trim();

    if (!promptArg) {
      if (isRedfingerSupportGroup(threadId, groupName)) {
        await api.sendMessage(
          {
            msg: `🤖 Nhóm này đang áp dụng: Trợ lý AI Chăm sóc Khách hàng Redfinger Việt Nam (Hỗ trợ tư vấn dịch vụ Cloud Phone, Giftcode, nạp tiền ngân hàng).`,
            quote: message,
            ttl: 60000,
          },
          threadId,
          message.type
        );
      } else {
        const groupSettings = readGroupSettings();
        const customPrompt = groupSettings[threadId]?.aiPrompt?.trim();
        if (customPrompt) {
          await api.sendMessage(
            {
              msg: `🤖 Nhóm đang dùng Prompt AI huấn luyện riêng:\n"${customPrompt}"\n\n💡 Quản trị viên có thể gõ:\n• ${prefix}${aliasCommand} prompt [nội dung mới] để cập nhật\n• ${prefix}${aliasCommand} prompt reset để xóa về mặc định`,
              quote: message,
              ttl: 60000,
            },
            threadId,
            message.type
          );
        } else {
          await api.sendMessage(
            {
              msg: `🤖 Nhóm đang dùng Prompt AI mặc định (Trợ lý bạn bè thân thiết).\n\n💡 Quản trị viên nhóm có thể huấn luyện tính cách / prompt riêng bằng lệnh:\n${prefix}${aliasCommand} prompt [nội dung prompt của nhóm]`,
              quote: message,
              ttl: 60000,
            },
            threadId,
            message.type
          );
        }
      }
      return;
    }

    if (/^reset$/i.test(promptArg)) {
      if (isGroup && !isAdmin(senderId, threadId, groupAdmins)) {
        await api.sendMessage(
          {
            msg: "⚠️ Chỉ Quản trị viên nhóm hoặc Admin bot mới có quyền đặt lại Prompt AI của nhóm!",
            quote: message,
            ttl: 30000,
          },
          threadId,
          message.type
        );
        return;
      }
      const groupSettings = readGroupSettings();
      if (groupSettings[threadId]) {
        delete groupSettings[threadId].aiPrompt;
        writeGroupSettings(groupSettings);
      }
      await api.sendMessage(
        {
          msg: "✅ Đã xóa prompt riêng. Nhóm sẽ sử dụng prompt mặc định cùng dữ liệu học của nhóm!",
          quote: message,
          ttl: 60000,
        },
        threadId,
        message.type
      );
      return;
    }

    if (isGroup && !isAdmin(senderId, threadId, groupAdmins)) {
      await api.sendMessage(
        {
          msg: "⚠️ Chỉ Quản trị viên nhóm hoặc Admin bot mới có quyền cài đặt Prompt AI cho nhóm!",
          quote: message,
          ttl: 30000,
        },
        threadId,
        message.type
      );
      return;
    }

    const groupSettings = readGroupSettings();
    if (!groupSettings[threadId]) groupSettings[threadId] = {};
    groupSettings[threadId].aiPrompt = promptArg;
    writeGroupSettings(groupSettings);

    await api.sendMessage(
      {
        msg: `✅ Đã cài đặt Prompt huấn luyện AI riêng cho nhóm thành công!\n\n📝 Nội dung:\n"${promptArg}"`,
        quote: message,
        ttl: 60000,
      },
      threadId,
      message.type
    );
    return;
  }

  // 4. Huấn luyện câu trả lời mới cho AI của nhóm
  if (/^train\s+/i.test(rawInput)) {
    if (isGroup && !isAdmin(senderId, threadId, groupAdmins)) {
      await api.sendMessage(
        {
          msg: "⚠️ Chỉ Quản trị viên nhóm hoặc Admin bot mới có quyền huấn luyện AI cho nhóm!",
          quote: message,
          ttl: 30000,
        },
        threadId,
        message.type
      );
      return;
    }

    const trainContent = rawInput.replace(/^train\s+/i, "").trim();
    if (!trainContent.includes("=>")) {
      await api.sendMessage(
        {
          msg: `⚠️ Cú pháp không hợp lệ. Vui lòng sử dụng:\n${prefix}${aliasCommand} train [câu hỏi] => [câu trả lời]`,
          quote: message,
          ttl: 30000,
        },
        threadId,
        message.type
      );
      return;
    }

    const [q, ...aParts] = trainContent.split("=>");
    const question = q.trim();
    const answer = aParts.join("=>").trim();

    if (!question || !answer) {
      await api.sendMessage(
        {
          msg: `⚠️ Cả câu hỏi và câu trả lời đều không được để trống!`,
          quote: message,
          ttl: 30000,
        },
        threadId,
        message.type
      );
      return;
    }

    const success = await learnNewResponse(api, threadId, question, answer);
    if (success) {
      await api.sendMessage(
        {
          msg: `✅ Đã huấn luyện câu trả lời mới cho AI của nhóm thành công!\n• Câu hỏi: "${question}"\n• Câu trả lời: "${answer}"`,
          quote: message,
          ttl: 60000,
        },
        threadId,
        message.type
      );
    } else {
      await api.sendMessage(
        {
          msg: `⚠️ Câu trả lời "${answer}" đã tồn tại cho câu hỏi "${question}" trong nhóm này!`,
          quote: message,
          ttl: 30000,
        },
        threadId,
        message.type
      );
    }
    return;
  }

  // 5. Trống câu hỏi -> Hướng dẫn sử dụng
  if (!rawInput && !quoteText) {
    await api.sendMessage(
      {
        msg:
          `🤖 Hướng dẫn sử dụng lệnh AI:\n` +
          `• ${prefix}${aliasCommand} [câu hỏi] : Hỏi đáp trực tiếp với AI.\n` +
          `• ${prefix}${aliasCommand} prompt : Xem prompt / tính cách AI của nhóm.\n` +
          `• ${prefix}${aliasCommand} prompt [nội dung] : Cài đặt prompt riêng cho nhóm (Admin).\n` +
          `• ${prefix}${aliasCommand} prompt reset : Đặt lại prompt mặc định (Admin).\n` +
          `• ${prefix}${aliasCommand} train [hỏi] => [đáp] : Dạy câu trả lời cho AI nhóm (Admin).\n` +
          `• ${prefix}${aliasCommand} reset : Xóa lịch sử trò chuyện cá nhân.\n` +
          `• ${prefix}${aliasCommand} memory : Xem số lượng hội thoại AI đang nhớ.`,
        quote: message,
        ttl: 60000,
      },
      threadId,
      message.type
    );
    return;
  }

  // 6. Hỏi đáp AI thông thường
  const prompt = [
    `Người đang hỏi: ${senderName}`,
    quoteText ? `Tin nhắn được reply:\n${quoteText}` : "",
    rawInput ? `Yêu cầu của người dùng:\n${rawInput}` : "Hãy xử lý tin nhắn được reply một cách hữu ích.",
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const history = getConversationHistory(memoryKey);
    const systemPrompt = getEffectiveAiPrompt(threadId, groupName);

    const answer = await callGroqAi(prompt, {
      systemPrompt,
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
        threadId,
        message.type
      );
    }
  } catch (error) {
    console.error("Lỗi khi xử lý lệnh AI:", error.message);
    await api.sendMessage(
      {
        msg: "AI đang bận hoặc gặp lỗi tạm thời. Bạn vui lòng thử lại sau nhé.",
        quote: message,
        ttl: 60000,
      },
      threadId,
      message.type
    );
  }
}
