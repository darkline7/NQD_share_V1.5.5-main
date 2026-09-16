import fs from "fs";
import path from "path";
import axios from "axios";
import { readGroupSettings, readWebConfig, writeWebConfig } from "./io-json.js";

const WEB_CONFIG_SECTION = "groqAI";
const DEFAULT_MODEL = "openai/gpt-oss-20b";

export const REDFINGER_SYSTEM_PROMPT = [
  "Bạn là Trợ lý AI Chăm sóc Khách hàng chính thức của website redfinger.vn và nhóm Cộng đồng Redfinger Việt Nam.",
  "Nhiệm vụ của bạn là tư vấn, giải đáp thắc mắc và hỗ trợ thành viên về dịch vụ thuê điện thoại đám mây (Android Cloud Phone) treo game 24/7 và mã quà tặng (Redfinger Redeem Code).",
  "Luôn giữ phong cách lịch sự, thân thiện, nhiệt tình và chuyên nghiệp. Xưng 'Em' (hoặc 'Redfinger Support') và gọi khách hàng là 'Bạn', 'Anh/Chị' hoặc 'Quý khách'. Tuyệt đối không xưng tao-mày, không cộc cằn hay thô lỗ.",
  "QUY TẮC XƯNG HÔ (RẤT QUAN TRỌNG): Luôn chào đúng người gửi tin nhắn (dựa vào 'Người gửi: [Tên]'). Tuyệt đối không chào nhầm tên người khác xuất hiện trong nội dung trích dẫn hoặc các tag @tên.",
  "HỖ TRỢ ĐA TÀI KHOẢN (TREO NHIỀU ACC GAME): Nếu khách hỏi về cách chơi hoặc treo nhiều tài khoản trên cùng máy (như Tân Võ Lâm, Roblox, MMO...):",
  "- Giải thích: Để treo nhiều tài khoản cùng lúc mượt mà và an toàn nhất, giải pháp chính thức của Redfinger là thuê NHIỀU Cloud Phone độc lập (mỗi Cloud Phone nhập 1 mã Redeem Code riêng). Mỗi Cloud Phone chạy 1 tài khoản riêng biệt, treo ổn định 24/7, không lo trùng IP hay bị game quét khóa nick.",
  "- Nếu chạy nhiều acc trên cùng 1 Cloud Phone: Không khuyến khích vì hầu hết game online chỉ cho phép 1 tài khoản đăng nhập đồng thời trên một thiết bị; dùng app nhân bản dễ gây xung đột, giật lag và văng game.",
  "Trả lời ngắn gọn, đúng trọng tâm, bám sát các chính sách và thông tin chính hãng trên website redfinger.vn.",
  "Nhắc nhở khách hàng bảo mật mã thẻ 12 ký tự, không gửi mã lên nhóm công khai.",
  "Nếu khách hàng hỏi về nạp tiền: Nhấn mạnh tối thiểu 50.000 VNĐ, CHỈ chuyển khoản NGÂN HÀNG, TUYỆT ĐỐI KHÔNG dùng MoMo/ZaloPay quét mã QR Shop.",
  "Nếu khách hàng gặp lỗi 'Điện thoại đám mây đã hết hàng': Giải thích đây là do máy chủ toàn cầu tạm thời hết máy trống, không phải lỗi mã hay lỗi web. Hướng dẫn kiên nhẫn chờ 3-5 phút thử lại hoặc chọn server khác còn máy rồi dùng tính năng Replace (Đổi máy chủ) sau.",
  "Nếu khách hỏi về cách sử dụng: Hướng dẫn vào app Redfinger hoặc web cloudemulator.vn, vào mục Mã quà tặng trả trước -> Thêm mới hoặc Gia hạn -> Nhập mã 12 ký tự."
].join(" ");

export const DEFAULT_AI_PROMPT = [
  "Bạn là một trợ lý AI thông minh, thân thiện và hiểu chuyện trong bot Zalo của Thanh Bình.",
  "Mặc định xưng 'tao' và gọi người dùng là 'mày' hoặc xưng hô linh hoạt, tự nhiên như bạn bè thân thiết ngoài đời.",
  "Nói tiếng Việt đời thường như người thật đang nhắn tin: ngắn gọn, thẳng thắn, cộc, vui vẻ, không văn mẫu giả tạo hay giọng nhân viên chăm sóc khách hàng.",
  "Trả lời đúng trọng tâm câu hỏi, hỗ trợ giải đáp thắc mắc, trò chuyện vui vẻ hoặc chia sẻ thông tin hữu ích.",
  "Tuyệt đối không tự nhận là ChatGPT, Claude hay Groq."
].join(" ");

function getConfigFromEnv() {
  return {
    enabled: String(process.env.GROQ_AI_ENABLED || "true").toLowerCase() !== "false",
    apiKey: process.env.GROQ_API_KEY || "",
    model: process.env.GROQ_AI_MODEL || DEFAULT_MODEL,
    systemPrompt:
      process.env.GROQ_AI_SYSTEM_PROMPT ||
      "Bạn là bot Zalo tiếng Việt thông minh, thân thiện và hữu ích. Trả lời tự nhiên, ngắn gọn, chính xác, không spam, không bịa đặt thông tin.",
    redfingerPrompt: process.env.GROQ_AI_REDFINGER_PROMPT || REDFINGER_SYSTEM_PROMPT,
    temperature: Number(process.env.GROQ_AI_TEMPERATURE || 0.7),
    maxTokens: Number(process.env.GROQ_AI_MAX_TOKENS || 800),
    cooldownMs: Number(process.env.GROQ_AI_COOLDOWN_MS || 15000),
    replyMode: process.env.GROQ_AI_REPLY_MODE || "all",
    allowedGroups: process.env.GROQ_AI_ALLOWED_GROUPS
      ? process.env.GROQ_AI_ALLOWED_GROUPS.split(",").map((s) => s.trim())
      : ["Cộng đồng Redfinger Việt Nam"],
    allowedThreads: process.env.GROQ_AI_ALLOWED_THREADS
      ? process.env.GROQ_AI_ALLOWED_THREADS.split(",").map((s) => s.trim())
      : [],
  };
}

function normalizeConfig(config = {}) {
  return {
    enabled: config.enabled !== false,
    apiKey: config.apiKey || "",
    model: config.model || DEFAULT_MODEL,
    systemPrompt:
      config.systemPrompt ||
      "Bạn là bot Zalo tiếng Việt thông minh, thân thiện và hữu ích. Trả lời tự nhiên, ngắn gọn, chính xác, không spam, không bịa đặt thông tin.",
    redfingerPrompt: config.redfingerPrompt || REDFINGER_SYSTEM_PROMPT,
    temperature: Number.isFinite(Number(config.temperature)) ? Number(config.temperature) : 0.7,
    maxTokens: Number.isFinite(Number(config.maxTokens)) ? Number(config.maxTokens) : 800,
    cooldownMs: Number.isFinite(Number(config.cooldownMs)) ? Number(config.cooldownMs) : 15000,
    replyMode: ["all", "mention"].includes(config.replyMode) ? config.replyMode : "all",
    allowedGroups: Array.isArray(config.allowedGroups)
      ? config.allowedGroups
      : ["Cộng đồng Redfinger Việt Nam"],
    allowedThreads: Array.isArray(config.allowedThreads) ? config.allowedThreads : [],
  };
}

export function getGroqAiConfig() {
  const webConfig = readWebConfig();
  const fileConfig = normalizeConfig(webConfig[WEB_CONFIG_SECTION]);
  const envConfig = normalizeConfig(getConfigFromEnv());

  return {
    ...envConfig,
    ...fileConfig,
    enabled: fileConfig.enabled && envConfig.enabled,
    apiKey: fileConfig.apiKey || envConfig.apiKey,
    model: fileConfig.model || envConfig.model,
    systemPrompt: fileConfig.systemPrompt || envConfig.systemPrompt,
    redfingerPrompt: fileConfig.redfingerPrompt || REDFINGER_SYSTEM_PROMPT,
    temperature: fileConfig.temperature ?? envConfig.temperature,
    maxTokens: fileConfig.maxTokens ?? envConfig.maxTokens,
    cooldownMs: fileConfig.cooldownMs ?? envConfig.cooldownMs,
    replyMode: fileConfig.replyMode || envConfig.replyMode,
    allowedGroups: fileConfig.allowedGroups || envConfig.allowedGroups,
    allowedThreads: fileConfig.allowedThreads || envConfig.allowedThreads,
  };
}

export function isRedfingerSupportGroup(threadId, nameGroup) {
  const config = getGroqAiConfig();
  const threadStr = String(threadId || "");
  let groupNameLower = String(nameGroup || "").toLowerCase().trim();

  // Bổ sung: nếu nameGroup chưa có hoặc chỉ là fallback "nhóm ...", đọc từ group_settings.json
  if (!groupNameLower || groupNameLower.startsWith("nhóm ")) {
    try {
      const groupSettings = readGroupSettings();
      if (groupSettings[threadId]?.nameGroup) {
        groupNameLower = String(groupSettings[threadId].nameGroup).toLowerCase().trim();
      }
    } catch (e) {}
  }

  // Kiểm tra nếu threadId nằm trong danh sách được chỉ định
  if (Array.isArray(config.allowedThreads) && config.allowedThreads.length > 0) {
    if (config.allowedThreads.map(String).includes(threadStr)) {
      return true;
    }
  }

  // Kiểm tra tên nhóm hoặc threadId trong allowedGroups
  if (Array.isArray(config.allowedGroups) && config.allowedGroups.length > 0) {
    for (const item of config.allowedGroups) {
      const itemStr = String(item).toLowerCase().trim();
      if (!itemStr) continue;
      if (
        itemStr === threadStr ||
        groupNameLower.includes(itemStr) ||
        itemStr.includes(groupNameLower)
      ) {
        return true;
      }
    }
  }

  // Mặc định khớp nếu tên nhóm chứa từ khóa 'redfinger'
  if (/redfinger/i.test(groupNameLower)) {
    return true;
  }

  return false;
}

export function getGroupTrainingContext(threadId) {
  if (!threadId) return "";
  try {
    const dataPath = path.resolve(process.cwd(), "assets", "json-data", "data-training.json");
    if (!fs.existsSync(dataPath)) return "";
    const data = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
    const groupData = data[threadId]?.listTrain;
    if (!groupData || typeof groupData !== "object") return "";

    const entries = Object.entries(groupData);
    if (entries.length === 0) return "";

    const pairs = [];
    for (const [q, val] of entries) {
      if (!q) continue;
      const responses = Array.isArray(val) ? val : [val];
      for (const item of responses) {
        const text = typeof item === "string" ? item : item?.response;
        if (text && typeof text === "string" && text.trim()) {
          pairs.push(`- Hỏi/từ khóa: "${q.trim()}" => Trả lời: "${text.trim()}"`);
          break;
        }
      }
    }

    if (pairs.length === 0) return "";
    return (
      "[Dữ liệu huấn luyện riêng của nhóm này]:\n" +
      pairs.slice(-30).join("\n") +
      "\n(Lưu ý: Hãy ưu tiên áp dụng các kiến thức và cách trả lời trên khi giải đáp thắc mắc phù hợp của thành viên trong nhóm)."
    );
  } catch (error) {
    return "";
  }
}

export function getEffectiveAiPrompt(threadId, nameGroup) {
  const config = getGroqAiConfig();

  // 1. Nhóm hỗ trợ Redfinger: Dùng prompt CSKH Redfinger
  if (isRedfingerSupportGroup(threadId, nameGroup)) {
    return config.redfingerPrompt || REDFINGER_SYSTEM_PROMPT;
  }

  // 2. Nhóm có cấu hình prompt riêng trong groupSettings
  let basePrompt = DEFAULT_AI_PROMPT;
  if (threadId) {
    const groupSettings = readGroupSettings();
    const customPrompt = groupSettings[threadId]?.aiPrompt?.trim();
    if (customPrompt) {
      basePrompt = customPrompt;
    }
  }

  // 3. Bổ sung dữ liệu huấn luyện riêng của nhóm (data-training.json)
  const trainingContext = getGroupTrainingContext(threadId);
  if (trainingContext) {
    basePrompt += `\n\n${trainingContext}`;
  }

  return basePrompt;
}

export function ensureGroqAiConfigDefaults() {
  const webConfig = readWebConfig();
  if (!webConfig[WEB_CONFIG_SECTION]) {
    webConfig[WEB_CONFIG_SECTION] = normalizeConfig(getConfigFromEnv());
    writeWebConfig(webConfig);
  }
}

export function getGroqAiStatus() {
  return {
    enabled: false,
    model: "",
    hasApiKey: false,
    ready: false,
    replyMode: "off",
    cooldownMs: 0,
  };
}

export async function callGroqAi(prompt, options = {}) {
  return null;
}
