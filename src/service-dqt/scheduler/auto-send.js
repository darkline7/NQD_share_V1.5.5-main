import { MessageType } from "../../api-zalo/index.js";
import { sendMessageFromSQL } from "../chat-zalo/chat-style/chat-style.js";
import { removeMention } from "../../utils/format-util.js";
import { readGroupSettings, writeGroupSettings } from "../../utils/io-json.js";
import { checkExstentionFileRemote, checkLinkIsValid } from "../../utils/util.js";

const CHECK_INTERVAL_MS = 5000;
const DEFAULT_TTL = 15 * 60 * 1000;
let autoSendTimer = null;
const runningThreads = new Set();

function parseIntervalToMs(rawValue) {
  if (!rawValue || typeof rawValue !== "string") return null;

  const value = rawValue.trim().toLowerCase();
  const match = value.match(/^(\d+)([spmh])$/);
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2];

  if (!Number.isFinite(amount) || amount <= 0) return null;

  switch (unit) {
    case "s":
      return amount * 1000;
    case "p":
    case "m":
      return amount * 60 * 1000;
    case "h":
      return amount * 60 * 60 * 1000;
    default:
      return null;
  }
}

function formatInterval(ms) {
  if (!ms || !Number.isFinite(ms) || ms <= 0) return "0s";
  if (ms % (60 * 60 * 1000) === 0) return `${ms / (60 * 60 * 1000)}h`;
  if (ms % (60 * 1000) === 0) return `${ms / (60 * 1000)}p`;
  return `${Math.floor(ms / 1000)}s`;
}

function extractUrlsFromObject(data, urls) {
  if (!data) return;

  if (typeof data === "string") {
    if (checkLinkIsValid(data)) {
      urls.add(data.trim());
    }
    return;
  }

  if (Array.isArray(data)) {
    for (const item of data) {
      extractUrlsFromObject(item, urls);
    }
    return;
  }

  if (typeof data !== "object") return;

  const urlKeys = [
    "href",
    "hdUrl",
    "normalUrl",
    "thumb",
    "src",
    "url",
    "fileUrl",
    "downloadUrl",
    "playUrl",
    "previewUrl",
    "streamUrl",
  ];

  for (const key of urlKeys) {
    if (typeof data[key] === "string" && checkLinkIsValid(data[key])) {
      urls.add(data[key].trim());
    }
  }

  for (const value of Object.values(data)) {
    extractUrlsFromObject(value, urls);
  }
}

function parseQuotedContent(quote) {
  const text = typeof quote?.msg === "string" ? quote.msg.trim() : "";
  const urls = new Set();

  if (quote?.attach) {
    try {
      const attachData = typeof quote.attach === "string" ? JSON.parse(quote.attach) : quote.attach;
      extractUrlsFromObject(attachData, urls);
    } catch {
      // Ignore parse errors and keep processing text-only payload.
    }
  }

  return {
    text,
    attachments: Array.from(urls),
  };
}

function ensureAutoSendConfig(groupSettings, threadId) {
  if (!groupSettings[threadId]) groupSettings[threadId] = {};
  if (!groupSettings[threadId].autoSend || typeof groupSettings[threadId].autoSend !== "object") {
    groupSettings[threadId].autoSend = {};
  }

  const config = groupSettings[threadId].autoSend;
  if (!config.content || typeof config.content !== "object") {
    config.content = {};
  }

  if (!Array.isArray(config.content.attachments)) {
    config.content.attachments = [];
  }

  if (typeof config.content.text !== "string") {
    config.content.text = "";
  }

  if (!Number.isFinite(config.intervalMs) || config.intervalMs <= 0) {
    config.intervalMs = 60 * 1000;
  }

  if (!Number.isFinite(config.nextSendAt) || config.nextSendAt < 0) {
    config.nextSendAt = 0;
  }

  if (typeof config.enabled !== "boolean") {
    config.enabled = false;
  }

  return config;
}

async function sendAttachmentByUrl(api, target, url, caption, shouldSendCaption) {
  const ext = (await checkExstentionFileRemote(url)) || "";

  if (["jpg", "jpeg", "png"].includes(ext)) {
    await api.sendImage(url, target, shouldSendCaption ? caption : "", DEFAULT_TTL);
    return;
  }

  if (ext === "gif") {
    await api.sendGif(url, target, shouldSendCaption ? caption : "", DEFAULT_TTL);
    return;
  }

  if (["mp4", "webm", "mov"].includes(ext)) {
    await api.sendVideo({
      videoUrl: url,
      thumbnail: "",
      threadId: target.threadId,
      threadType: target.type,
      message: { text: shouldSendCaption ? caption : "" },
      ttl: DEFAULT_TTL,
    });
    return;
  }

  if (ext === "webp") {
    await api.sendCustomSticker(target, url, url, null, null, DEFAULT_TTL);
    if (shouldSendCaption && caption) {
      await api.sendMessage({ msg: caption, ttl: DEFAULT_TTL }, target.threadId, target.type);
    }
    return;
  }

  const fallbackMessage = caption ? `${caption}\n${url}` : url;
  await api.sendMessage({ msg: fallbackMessage, ttl: DEFAULT_TTL }, target.threadId, target.type);
}

async function sendAutoSendContent(api, threadId, autoSendConfig) {
  const target = { threadId, type: MessageType.GroupMessage };
  const text = autoSendConfig?.content?.text?.trim() || "";
  const attachments = Array.isArray(autoSendConfig?.content?.attachments)
    ? autoSendConfig.content.attachments.filter((item) => typeof item === "string" && checkLinkIsValid(item))
    : [];

  if (!text && attachments.length === 0) {
    return;
  }

  if (attachments.length === 0) {
    await api.sendMessage({ msg: text, ttl: DEFAULT_TTL }, threadId, MessageType.GroupMessage);
    return;
  }

  for (let index = 0; index < attachments.length; index++) {
    const url = attachments[index];
    const shouldSendCaption = index === 0;
    await sendAttachmentByUrl(api, target, url, text, shouldSendCaption);
  }
}

async function processAutoSendJobs(api) {
  const groupSettings = readGroupSettings();
  let hasChanges = false;
  const now = Date.now();

  for (const threadId of Object.keys(groupSettings)) {
    if (groupSettings[threadId]?.activeBot === false) continue;
    const config = ensureAutoSendConfig(groupSettings, threadId);
    if (!config.enabled) continue;
    if (config.nextSendAt > now) continue;
    if (runningThreads.has(threadId)) continue;

    runningThreads.add(threadId);
    try {
      await sendAutoSendContent(api, threadId, config);
      config.lastSentAt = Date.now();
      config.nextSendAt = Date.now() + config.intervalMs;
      hasChanges = true;
    } catch (error) {
      console.error(`Lỗi auto send ở nhóm ${threadId}:`, error);
      config.nextSendAt = Date.now() + config.intervalMs;
      hasChanges = true;
    } finally {
      runningThreads.delete(threadId);
    }
  }

  if (hasChanges) {
    writeGroupSettings(groupSettings);
  }
}

export function initializeAutoSendScheduler(api) {
  if (autoSendTimer) return;

  autoSendTimer = setInterval(() => {
    processAutoSendJobs(api).catch((error) => {
      console.error("Lỗi tiến trình auto send:", error);
    });
  }, CHECK_INTERVAL_MS);
}

export async function handleAutoSendCommand(api, message, groupSettings) {
  const threadId = message.threadId;
  const rawContent = removeMention(message);
  const parts = rawContent.trim().split(/\s+/);
  const args = parts.slice(1);

  const autoSendConfig = ensureAutoSendConfig(groupSettings, threadId);

  if (args.length === 0 || args[0].toLowerCase() === "status") {
    const statusText = autoSendConfig.enabled ? "BẬT" : "TẮT";
    const intervalText = formatInterval(autoSendConfig.intervalMs);
    const nextSendText = autoSendConfig.nextSendAt ? new Date(autoSendConfig.nextSendAt).toLocaleString("vi-VN") : "Chưa có";
    const numAttachment = autoSendConfig.content.attachments.length;
    const hasText = autoSendConfig.content.text ? "Có" : "Không";

    await sendMessageFromSQL(
      api,
      message,
      {
        success: true,
        message:
          `AutoSend hiện: ${statusText}\n` +
          `Chu kỳ: ${intervalText}\n` +
          `Có text: ${hasText}\n` +
          `Số file/link media: ${numAttachment}\n` +
          `Lần gửi kế tiếp: ${nextSendText}`,
      },
      false,
      60000
    );
    return false;
  }

  const firstArg = args[0].toLowerCase();

  if (["off", "stop", "0"].includes(firstArg)) {
    autoSendConfig.enabled = false;
    autoSendConfig.nextSendAt = 0;

    await sendMessageFromSQL(
      api,
      message,
      {
        success: true,
        message: "Đã tắt AutoSend cho nhóm này.",
      },
      false,
      30000
    );
    return true;
  }

  let intervalToken = firstArg;
  if (["on", "start", "1"].includes(firstArg)) {
    intervalToken = args[1] || "";
  }

  const intervalMs = parseIntervalToMs(intervalToken);
  if (!intervalMs) {
    await sendMessageFromSQL(
      api,
      message,
      {
        success: false,
        message:
          "Sai cú pháp thời gian. Ví dụ: .autosend 1p hoặc .autosend on 30s hoặc .autosend 2h.\n" +
          "Để dừng: .autosend off",
      },
      false,
      60000
    );
    return false;
  }

  const quote = message.data?.quote;
  if (quote) {
    const quotedContent = parseQuotedContent(quote);
    if (!quotedContent.text && quotedContent.attachments.length === 0) {
      await sendMessageFromSQL(
        api,
        message,
        {
          success: false,
          message: "Không đọc được nội dung từ tin nhắn reply. Hãy reply tin nhắn có text hoặc ảnh/video/link.",
        },
        false,
        60000
      );
      return false;
    }

    autoSendConfig.content.text = quotedContent.text;
    autoSendConfig.content.attachments = quotedContent.attachments;
  }

  if (!autoSendConfig.content.text && autoSendConfig.content.attachments.length === 0) {
    await sendMessageFromSQL(
      api,
      message,
      {
        success: false,
        message:
          "Chưa có nội dung AutoSend. Hãy reply tin cần gửi rồi dùng lệnh:\n" +
          ".autosend 1p",
      },
      false,
      60000
    );
    return false;
  }

  autoSendConfig.intervalMs = intervalMs;
  autoSendConfig.enabled = true;
  autoSendConfig.nextSendAt = Date.now() + intervalMs;

  const totalMedia = autoSendConfig.content.attachments.length;
  const intervalText = formatInterval(intervalMs);

  await sendMessageFromSQL(
    api,
    message,
    {
      success: true,
      message:
        `Đã bật AutoSend mỗi ${intervalText} cho nhóm này.\n` +
        `Nội dung text: ${autoSendConfig.content.text ? "Có" : "Không"}\n` +
        `Số media: ${totalMedia}\n` +
        `Mẹo: reply tin mới + dùng .autosend ${intervalText} để cập nhật nội dung.`,
    },
    false,
    60000
  );

  return true;
}
