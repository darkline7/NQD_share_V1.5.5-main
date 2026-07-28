import { MessageMention, MessageType } from "zlbotdqt";
import { getBotId } from "../../index.js";
import { sendMessageStateQuote } from "../chat-zalo/chat-style/chat-style.js";
import { createBlockSpamLinkImage } from "../../utils/canvas/event-image.js";
import { clearImagePath } from "../../utils/canvas/index.js";
import { getGroupInfoData } from "../info-service/group-info.js";
import { getUserInfoData } from "../info-service/user-info.js";
import { isInWhiteList } from "./white-list.js";
import { removeMention } from "../../utils/format-util.js";
import { getAntiState } from "./index.js";
import { scanQRCode } from "../utilities/qr-scan.js";

async function loadLinkRegex() {
  try {
    const antiState = getAntiState();
    if (!antiState.data.linkRegex) {
      antiState.data.linkRegex =
        "(?:https?:\\/\\/|www\\.)\\S+|(?<!\\w)[a-zA-Z0-9-]+[.,](?:com|net|org|vn|info|biz|io|xyz|me|tv|online|store|club|site|app|blog|dev|tech|cloud|game|shop|click|space|asia|fun|tokyo|xyz|website)(?:\\/\\S*)?(?!\\w)";
    }
    return new RegExp(antiState.data.linkRegex, "gi");
  } catch (error) {
    console.error("Lỗi khi đọc regex link:", error);
    return null;
  }
}

const linkRegex = await loadLinkRegex();
const URL_PARSE_REGEX = /(?:https?:\/\/|www\.)\S+|(?<!\w)[a-zA-Z0-9-]+\.(?:[a-zA-Z]{2,})(?:\/\S*)?(?!\w)/gi;

let linkSendCount = {}; // Đếm số link đã gửi của mỗi người dùng
let linkSendTime = {}; // Thời gian gửi link của mỗi người dùng

function checkLink(content) {
  if (!content) return false;
  linkRegex.lastIndex = 0;
  return linkRegex.test(content);
}

function normalizeDomain(input = "") {
  let value = String(input || "").trim().toLowerCase();
  value = value.replace(/^https?:\/\//, "").replace(/^www\./, "");
  value = value.split("/")[0].split("?")[0].split("#")[0];
  return value;
}

function normalizeAndSortDomains(domains = []) {
  const normalized = domains.map((item) => normalizeDomain(item)).filter(Boolean);
  return Array.from(new Set(normalized)).sort((a, b) => a.localeCompare(b, "vi"));
}

function parseDomainList(input = "") {
  return normalizeAndSortDomains(String(input || "").split(","));
}

function getAllowDomains(groupConfig = {}) {
  const list = Array.isArray(groupConfig.antiLinkAllowDomains)
    ? groupConfig.antiLinkAllowDomains.map((item) => normalizeDomain(item)).filter(Boolean)
    : [];

  if (list.length > 0) {
    return normalizeAndSortDomains(list);
  }

  const legacyDomain = normalizeDomain(groupConfig.antiLinkDomain || "");
  return legacyDomain ? normalizeAndSortDomains([legacyDomain]) : [];
}

function normalizeUrlCandidate(raw = "") {
  let text = String(raw || "").trim();
  if (!text) return null;
  if (!/^https?:\/\//i.test(text)) {
    text = `https://${text}`;
  }

  try {
    return new URL(text);
  } catch {
    return null;
  }
}

function extractLinkDomains(content = "") {
  const result = [];
  const text = String(content || "");
  const matches = text.match(URL_PARSE_REGEX) || [];

  for (const match of matches) {
    const parsed = normalizeUrlCandidate(match);
    if (!parsed?.hostname) continue;
    const domain = normalizeDomain(parsed.hostname);
    if (domain) {
      result.push(domain);
    }
  }

  return Array.from(new Set(result));
}

function isDomainMatched(domain, targetDomain) {
  if (!domain || !targetDomain) return false;
  return (
    domain === targetDomain ||
    domain.endsWith(`.${targetDomain}`) ||
    domain.startsWith(`${targetDomain}.`)
  );
}

function shouldDeleteByPolicy(content, groupConfig = {}) {
  if (!checkLink(content)) {
    return { shouldDelete: false, matchedDomains: [] };
  }

  const domains = extractLinkDomains(content);
  if (!domains.length) {
    return { shouldDelete: true, matchedDomains: [] };
  }

  const mode = groupConfig.antiLinkMode || "all";
  const policyDomain = normalizeDomain(groupConfig.antiLinkDomain || "");
  const allowDomains = getAllowDomains(groupConfig);

  if (mode === "block-domain" && policyDomain) {
    const matchedDomains = domains.filter((domain) => isDomainMatched(domain, policyDomain));
    return { shouldDelete: matchedDomains.length > 0, matchedDomains };
  }

  if (mode === "allow-only" && allowDomains.length > 0) {
    const blocked = domains.filter((domain) => !allowDomains.some((allowed) => isDomainMatched(domain, allowed)));
    return { shouldDelete: blocked.length > 0, matchedDomains: blocked };
  }

  if (mode === "allow-only" && policyDomain) {
    const blocked = domains.filter((domain) => !isDomainMatched(domain, policyDomain));
    return { shouldDelete: blocked.length > 0, matchedDomains: blocked };
  }

  return { shouldDelete: true, matchedDomains: domains };
}

export async function antiLink(
  api,
  message,
  isAdminBox,
  groupSettings,
  botIsAdminBox,
  isSelf
) {
  const senderId = message.data.uidFrom;
  const senderName = message.data.dName;
  const threadId = message.threadId;

  if (
    isSelf ||
    isAdminBox ||
    !botIsAdminBox ||
    !groupSettings[threadId]?.removeLinks
  )
    return false;

  // Kiểm tra và xử lý tin nhắn chứa link
  await handleLinkMessage(
    api,
    message,
    groupSettings,
    isAdminBox,
    threadId,
    senderId,
    senderName
  );
}

export async function handleAntiLinkCommand(
  api,
  message,
  groupSettings
) {
  const threadId = message.threadId;
  let isChangeSetting = false;
  const content = removeMention(message);
  const args = content.trim().split(/\s+/).slice(1);
  const status = args[0]?.toLowerCase();
  const rawDomain = args[1] || "";
  const normalizedDomain = normalizeDomain(rawDomain);

  if (!groupSettings[threadId]) {
    groupSettings[threadId] = {};
  }

  const currentMode = groupSettings[threadId].antiLinkMode || "all";
  const currentDomain = groupSettings[threadId].antiLinkDomain || "";
  const currentAllowDomains = getAllowDomains(groupSettings[threadId]);

  const buildStatusText = () => {
    if (!groupSettings[threadId].removeLinks) {
      return "AntiLink hiện đang tắt.";
    }

    if (currentMode === "allow-only" && currentAllowDomains.length > 0) {
      return `AntiLink đang bật ở chế độ ALLOW: chỉ cho phép ${currentAllowDomains.join(", ")}.`;
    }

    if (currentMode === "allow-only" && currentDomain) {
      return `AntiLink đang bật ở chế độ VIP: chỉ cho phép link ${currentDomain}.`;
    }

    if (currentMode === "block-domain" && currentDomain) {
      return `AntiLink đang bật: chỉ chặn domain ${currentDomain}.`; 
    }

    return "AntiLink đang bật: chặn toàn bộ liên kết.";
  };

  if (status === "status") {
    await sendMessageStateQuote(api, message, buildStatusText(), true, 300000);
    return false;
  }

  if (status === "list") {
    const prettyMode = currentMode === "all"
      ? "chặn toàn bộ"
      : currentMode === "block-domain"
        ? "chặn theo domain"
        : currentMode === "allow-only"
          ? "whitelist domain"
          : currentMode;
    const detail = [
      "📋 Cấu hình AntiLink hiện tại:",
      `- Trạng thái: ${groupSettings[threadId].removeLinks ? "Bật" : "Tắt"}`,
      `- Chế độ: ${prettyMode}`,
      `- Domain chặn (on [domain]): ${currentDomain || "(không cấu hình)"}`,
      `- Domain cho phép (allow): ${currentAllowDomains.length > 0 ? currentAllowDomains.join(", ") : "(không cấu hình)"}`,
    ].join("\n");
    await sendMessageStateQuote(api, message, detail, true, 300000);
    return false;
  }

  if (status === "test") {
    const probeRaw = args.slice(1).join(" ").trim();
    if (!probeRaw) {
      await sendMessageStateQuote(
        api,
        message,
        "Vui lòng nhập link hoặc domain cần kiểm tra. Ví dụ: .antilink test https://fb.com/abc",
        false,
        300000
      );
      return false;
    }

    const probeContent = checkLink(probeRaw) ? probeRaw : `https://${normalizeDomain(probeRaw)}`;
    const decision = shouldDeleteByPolicy(probeContent, groupSettings[threadId] || {});
    const domains = extractLinkDomains(probeContent);
    const resultMessage = [
      `🧪 Kết quả kiểm tra AntiLink`,
      `- Mẫu: ${probeRaw}`,
      `- Domain nhận diện: ${domains.length > 0 ? domains.join(", ") : "(không xác định)"}`,
      `- Kết luận: ${decision.shouldDelete ? "Bị chặn" : "Được phép"}`,
    ].join("\n");

    await sendMessageStateQuote(api, message, resultMessage, !decision.shouldDelete, 300000);
    return false;
  }

  if (status === "allow") {
    const action = args[1]?.toLowerCase();
    const isIncrementalAction = ["add", "remove", "show", "clear"].includes(action);

    if (action === "show") {
      const allowList = getAllowDomains(groupSettings[threadId]);
      await sendMessageStateQuote(
        api,
        message,
        allowList.length > 0
          ? `Danh sách domain được phép: ${allowList.join(", ")}`
          : "Danh sách allow hiện đang trống.",
        true,
        300000
      );
      return false;
    }

    if (action === "clear") {
      groupSettings[threadId].antiLinkAllowDomains = [];
      groupSettings[threadId].antiLinkDomain = "";
      groupSettings[threadId].antiLinkMode = "allow-only";
      groupSettings[threadId].removeLinks = true;
      await sendMessageStateQuote(
        api,
        message,
        "Đã xóa toàn bộ domain trong allow list.",
        true,
        300000
      );
      return true;
    }

    if (action === "add" || action === "remove") {
      const domainInput = args.slice(2).join(" ");
      const inputDomains = parseDomainList(domainInput);
      if (inputDomains.length === 0) {
        await sendMessageStateQuote(
          api,
          message,
          `Vui lòng nhập domain hợp lệ. Ví dụ: .antilink allow ${action} zalo.me,fb.com`,
          false,
          300000
        );
        return false;
      }

      const current = getAllowDomains(groupSettings[threadId]);
      let nextAllowDomains = current;

      if (action === "add") {
        nextAllowDomains = normalizeAndSortDomains([...current, ...inputDomains]);
      } else {
        const removeSet = new Set(inputDomains);
        nextAllowDomains = normalizeAndSortDomains(current.filter((domain) => !removeSet.has(domain)));
      }

      groupSettings[threadId].removeLinks = true;
      groupSettings[threadId].antiLinkMode = "allow-only";
      groupSettings[threadId].antiLinkAllowDomains = nextAllowDomains;
      groupSettings[threadId].antiLinkDomain = nextAllowDomains[0] || "";

      const summary = nextAllowDomains.length > 0
        ? nextAllowDomains.join(", ")
        : "(trống)";
      const actionText = action === "add" ? "thêm" : "xóa";
      await sendMessageStateQuote(
        api,
        message,
        `Đã ${actionText} domain thành công. Allow list hiện tại: ${summary}`,
        true,
        300000
      );
      return true;
    }

    const domainInput = isIncrementalAction ? "" : args.slice(1).join(" ");
    const allowDomains = parseDomainList(domainInput);
    if (allowDomains.length === 0) {
      await sendMessageStateQuote(
        api,
        message,
        "Vui lòng nhập danh sách domain cần cho phép. Ví dụ: .antilink allow zalo.me,fb.com hoặc .antilink allow add fb.com",
        false,
        300000
      );
      return false;
    }

    groupSettings[threadId].removeLinks = true;
    groupSettings[threadId].antiLinkMode = "allow-only";
    groupSettings[threadId].antiLinkAllowDomains = normalizeAndSortDomains(allowDomains);
    groupSettings[threadId].antiLinkDomain = allowDomains[0] || "";
    isChangeSetting = true;
    await sendMessageStateQuote(
      api,
      message,
      `Đã bật AntiLink ALLOW. Chỉ cho phép các domain: ${normalizeAndSortDomains(allowDomains).join(", ")}.`,
      true,
      300000
    );
    return isChangeSetting;
  }

  if (status === "vip") {
    if (!normalizedDomain) {
      await sendMessageStateQuote(
        api,
        message,
        "Vui lòng nhập domain cho chế độ VIP. Ví dụ: .antilink vip fb.com",
        false,
        300000
      );
      return false;
    }

    groupSettings[threadId].removeLinks = true;
    groupSettings[threadId].antiLinkMode = "allow-only";
    groupSettings[threadId].antiLinkAllowDomains = [normalizedDomain];
    groupSettings[threadId].antiLinkDomain = normalizedDomain;
    isChangeSetting = true;
    await sendMessageStateQuote(
      api,
      message,
      `Đã bật AntiLink VIP. Chỉ cho phép link thuộc domain ${normalizedDomain}.`,
      true,
      300000
    );
    return isChangeSetting;
  }

  if (status === "on") {
    groupSettings[threadId].removeLinks = true;
    if (normalizedDomain) {
      groupSettings[threadId].antiLinkMode = "block-domain";
      groupSettings[threadId].antiLinkAllowDomains = [];
      groupSettings[threadId].antiLinkDomain = normalizedDomain;
      await sendMessageStateQuote(
        api,
        message,
        `Đã bật AntiLink. Bot sẽ chặn các link thuộc domain ${normalizedDomain}.`,
        true,
        300000
      );
    } else {
      groupSettings[threadId].antiLinkMode = "all";
      groupSettings[threadId].antiLinkAllowDomains = [];
      groupSettings[threadId].antiLinkDomain = "";
      await sendMessageStateQuote(
        api,
        message,
        "Đã bật AntiLink. Bot sẽ chặn toàn bộ liên kết.",
        true,
        300000
      );
    }
    return true;
  }

  if (status === "off") {
    groupSettings[threadId].removeLinks = false;
    groupSettings[threadId].antiLinkMode = "all";
    groupSettings[threadId].antiLinkAllowDomains = [];
    groupSettings[threadId].antiLinkDomain = "";
    await sendMessageStateQuote(api, message, "Đã tắt AntiLink.", false, 300000);
    return true;
  }

  if (status) {
    await sendMessageStateQuote(
      api,
      message,
      "Cú pháp AntiLink: .antilink on [domain] | .antilink allow <d1,d2> | .antilink allow add <d1,d2> | .antilink allow remove <d1,d2> | .antilink allow show | .antilink allow clear | .antilink vip <domain> | .antilink test <link> | .antilink list | .antilink status | .antilink off",
      false,
      300000
    );
    return false;
  }

  const newStatus = !groupSettings[threadId].removeLinks;
  groupSettings[threadId].removeLinks = newStatus;
  groupSettings[threadId].antiLinkMode = "all";
  groupSettings[threadId].antiLinkAllowDomains = [];
  groupSettings[threadId].antiLinkDomain = "";
  isChangeSetting = true;
  const statusText = newStatus ? "bật" : "tắt";
  const caption = `Chức năng AntiLink đã được ${statusText}.`;
  await sendMessageStateQuote(api, message, caption, newStatus, 300000);

  return isChangeSetting;
}

async function handleLinkMessage(
  api,
  message,
  groupSettings,
  isAdminBox,
  threadId,
  senderId,
  senderName
) {
  let content = message.data.content;
  content = content.title ? content.title : content;
  const isRecommendedMessage = message.data.msgType === "chat.recommended";
  const isImage = message.data.msgType === "chat.photo";
  const isPlainText = typeof content === "string";
  let isDeleteLink = false;
  const botId = getBotId();
  const isUserWhiteList = isInWhiteList(groupSettings, threadId, senderId);

  if (isUserWhiteList) return isDeleteLink;

  if (isRecommendedMessage) {
    await api.deleteMessage(message, false).catch(console.error);
    isDeleteLink = true;
  }

  if (!isDeleteLink && isImage) {
    const linkImage = message.data?.content?.href;
    if (linkImage) {
      const result = await scanQRCode(linkImage);
      if (result.success) {
        const qrDecision = shouldDeleteByPolicy(result.data.content, groupSettings[threadId] || {});
        if (qrDecision.shouldDelete) {
          await api.deleteMessage(message, false).catch(console.error);
          isDeleteLink = true;
        }
      }
    }
  }

  const currentGroupSettings = groupSettings[threadId] || {};
  const linkDecision = isPlainText ? shouldDeleteByPolicy(content, currentGroupSettings) : { shouldDelete: false };
  const hasLink = isPlainText && linkDecision.shouldDelete;

  if (!isDeleteLink && hasLink) {
    await api.deleteMessage(message, false).catch(console.error);
    isDeleteLink = true;
  }

  if (isDeleteLink) {
    if (!isUserWhiteList) {
      await updateLinkCount(
        api,
        message,
        threadId,
        senderId,
        senderName,
        botId,
        isAdminBox
      );
    }
  }
  return isDeleteLink;
}

async function updateLinkCount(
  api,
  message,
  threadId,
  senderId,
  senderName,
  botId,
  isAdminBox
) {
  if (!linkSendCount[senderId]) {
    linkSendCount[senderId] = 0;
    linkSendTime[senderId] = Date.now();
  }

  linkSendCount[senderId]++;

  if (isAdminBox && senderId !== botId) {
    return;
  }

  if (Date.now() - linkSendTime[senderId] < 60 * 1000) {
    if (linkSendCount[senderId] > 2) {
      await blockUser(api, message, threadId, senderId, senderName);
      return;
    }
  } else {
    linkSendCount[senderId] = 1;
    linkSendTime[senderId] = Date.now();
  }

  await sendWarningMessage(api, message, senderId, senderName, linkSendCount[senderId]);
}

async function blockUser(api, message, threadId, senderId, senderName) {
  try {
    await api.blockUsers(threadId, [senderId]);
    const groupInfo = await getGroupInfoData(api, threadId);
    const userInfo = await getUserInfoData(api, senderId);
    const imagePath = await createBlockSpamLinkImage(
      userInfo,
      groupInfo.name,
      groupInfo.groupType,
      userInfo.gender
    );

    await api.sendMessage(
      {
        msg: "",
        attachments: imagePath ? [imagePath] : [],
        quote: message,
      },
      threadId,
      MessageType.GroupMessage
    );

    try {
      await api.sendMessage(
        {
          msg: `Chào [ ${senderName} ]\nBạn đã bị chặn khỏi nhóm vì gửi quá nhiều link!`,
          attachments: imagePath ? [imagePath] : [],
          quote: message,
        },
        senderId,
        MessageType.DirectMessage
      );
    } catch (error) {
      console.error(`Không thể gửi tin nhắn tới ${senderId}:`, error.message);
    }

    await clearImagePath(imagePath);
  } catch {
    console.error(`Không thể chặn người dùng ${senderName}`);
  }
}

async function sendWarningMessage(api, message, senderId, senderName, count) {
  try {
    let caption = `⚠️ Nhắc nhở ${senderName}: nhóm đang bật AntiLink, vui lòng không gửi liên kết không phù hợp.`;
    switch (count) {
      case 2:
        caption = `⚠️ ${senderName}, bạn đã vi phạm lần 2. Nếu tiếp tục gửi link sai quy định, bot sẽ tự động chặn.`;
        break;
    }
    await api.sendMessage(
      {
        msg: caption,
        mentions: [
          MessageMention(senderId, senderName.length, "⚠️ Cảnh cáo ".length),
        ],
        quote: message,
        ttl: 300000,
      },
      message.threadId,
      MessageType.GroupMessage
    );
    await api.sendMessage(
      {
        msg: `Liên kết của bạn đã bị xóa do không đúng chính sách AntiLink của nhóm.`,
        quote: message,
      },
      senderId,
      MessageType.DirectMessage
    );
  } catch (error) {
    console.error(`Không thể gửi tin nhắn tới ${senderId}:`, error.message);
  }
}
