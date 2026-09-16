import axios from "axios";
import { readWebConfig, writeWebConfig } from "./io-json.js";

const WEB_CONFIG_SECTION = "groqAI";
const DEFAULT_MODEL = "openai/gpt-oss-20b";

function getConfigFromEnv() {
  return {
    enabled: String(process.env.GROQ_AI_ENABLED || "true").toLowerCase() !== "false",
    apiKey: process.env.GROQ_API_KEY || "",
    model: process.env.GROQ_AI_MODEL || DEFAULT_MODEL,
    systemPrompt:
      process.env.GROQ_AI_SYSTEM_PROMPT ||
      "Bạn là Trợ lý AI Chăm sóc Khách hàng chính thức của website redfinger.vn và nhóm Cộng đồng Redfinger Việt Nam. Bạn hỗ trợ tư vấn dịch vụ thuê Cloud Phone Android treo game 24/7 và giải đáp thắc mắc của khách hàng với thái độ lịch sự, chuyên nghiệp, tận tâm.",
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
      "Bạn là Trợ lý AI Chăm sóc Khách hàng chính thức của website redfinger.vn và nhóm Cộng đồng Redfinger Việt Nam. Bạn hỗ trợ tư vấn dịch vụ thuê Cloud Phone Android treo game 24/7 và giải đáp thắc mắc của khách hàng với thái độ lịch sự, chuyên nghiệp, tận tâm.",
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
  const groupNameLower = String(nameGroup || "").toLowerCase().trim();

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

export function ensureGroqAiConfigDefaults() {
  const webConfig = readWebConfig();
  if (!webConfig[WEB_CONFIG_SECTION]) {
    webConfig[WEB_CONFIG_SECTION] = normalizeConfig(getConfigFromEnv());
    writeWebConfig(webConfig);
  }
}

export function getGroqAiStatus() {
  const config = getGroqAiConfig();
  return {
    enabled: config.enabled,
    model: config.model,
    hasApiKey: Boolean(config.apiKey),
    ready: Boolean(config.enabled && config.apiKey),
    replyMode: config.replyMode,
    cooldownMs: config.cooldownMs,
  };
}

export async function callGroqAi(prompt, options = {}) {
  const config = getGroqAiConfig();
  const requireEnabled = options.requireEnabled !== false;
  if ((requireEnabled && !config.enabled) || !config.apiKey) {
    throw new Error("Groq AI chưa được cấu hình API key");
  }

  const messages = [];
  const systemPrompt = options.systemPrompt ?? config.systemPrompt;
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }

  if (Array.isArray(options.history)) {
    for (const item of options.history.slice(-8)) {
      if (item?.role && item?.content) {
        messages.push({ role: item.role, content: item.content });
      }
    }
  }
  messages.push({ role: "user", content: prompt });

  const response = await axios.post(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      model: options.model || config.model,
      messages,
      temperature: options.temperature ?? config.temperature,
      max_tokens: options.maxTokens ?? config.maxTokens,
    },
    {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: options.timeout || 45000,
    }
  );

  const answer = response.data?.choices?.[0]?.message?.content;
  if (!answer) {
    throw new Error("Groq AI không trả về nội dung");
  }

  return String(answer).trim();
}
