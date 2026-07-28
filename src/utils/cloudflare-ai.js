import axios from "axios";
import fs from "fs";
import path from "path";
import { readWebConfig, writeWebConfig } from "./io-json.js";

const DEFAULT_MODEL = "@cf/meta/llama-3.1-8b-instruct";
const WEB_CONFIG_SECTION = "cloudflareAI";

function getConfigFromEnv() {
  return {
    enabled: String(process.env.CLOUDFLARE_AI_ENABLED || "false").toLowerCase() === "true",
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID || "",
    apiToken: process.env.CLOUDFLARE_API_TOKEN || "",
    model: process.env.CLOUDFLARE_AI_MODEL || DEFAULT_MODEL,
    systemPrompt: process.env.CLOUDFLARE_AI_SYSTEM_PROMPT || "Bạn là bot trợ lý tiếng Việt của Thanh Bình. Trả lời ngắn gọn, chính xác, lịch sự.",
    temperature: Number(process.env.CLOUDFLARE_AI_TEMPERATURE || 0.7),
    maxTokens: Number(process.env.CLOUDFLARE_AI_MAX_TOKENS || 1024),
  };
}

function normalizeConfig(config = {}) {
  return {
    enabled: Boolean(config.enabled),
    accountId: config.accountId || "",
    apiToken: config.apiToken || "",
    model: config.model || DEFAULT_MODEL,
    systemPrompt: config.systemPrompt || "Bạn là bot trợ lý tiếng Việt của Thanh Bình. Trả lời ngắn gọn, chính xác, lịch sự.",
    temperature: Number.isFinite(Number(config.temperature)) ? Number(config.temperature) : 0.7,
    maxTokens: Number.isFinite(Number(config.maxTokens)) ? Number(config.maxTokens) : 1024,
  };
}

export function getCloudflareAiConfig() {
  const webConfig = readWebConfig();
  const fileConfig = normalizeConfig(webConfig[WEB_CONFIG_SECTION]);
  const envConfig = normalizeConfig(getConfigFromEnv());

  return {
    ...envConfig,
    ...fileConfig,
    enabled: fileConfig.enabled || envConfig.enabled,
    accountId: fileConfig.accountId || envConfig.accountId,
    apiToken: fileConfig.apiToken || envConfig.apiToken,
    model: fileConfig.model || envConfig.model,
    systemPrompt: fileConfig.systemPrompt || envConfig.systemPrompt,
    temperature: fileConfig.temperature ?? envConfig.temperature,
    maxTokens: fileConfig.maxTokens ?? envConfig.maxTokens,
  };
}

export function updateCloudflareAiConfig(nextConfig = {}) {
  const webConfig = readWebConfig();
  const current = getCloudflareAiConfig();
  const merged = normalizeConfig({
    ...current,
    ...nextConfig,
    apiToken: typeof nextConfig.apiToken === "string" && nextConfig.apiToken.trim() !== ""
      ? nextConfig.apiToken.trim()
      : current.apiToken,
  });

  webConfig[WEB_CONFIG_SECTION] = merged;
  writeWebConfig(webConfig);
  return merged;
}

export function getCloudflareAiStatus() {
  const config = getCloudflareAiConfig();
  return {
    enabled: config.enabled,
    model: config.model,
    hasAccountId: Boolean(config.accountId),
    hasApiToken: Boolean(config.apiToken),
    ready: Boolean(config.enabled && config.accountId && config.apiToken),
  };
}

export function hasCloudflareAiConfig() {
  const config = getCloudflareAiConfig();
  return Boolean(config.enabled && config.accountId && config.apiToken);
}

export async function callCloudflareAi(prompt, options = {}) {
  const config = getCloudflareAiConfig();
  if (!config.enabled || !config.accountId || !config.apiToken) {
    throw new Error("Cloudflare AI chưa được cấu hình");
  }

  const model = options.model || config.model || DEFAULT_MODEL;
  const messages = [];

  if (config.systemPrompt) {
    messages.push({ role: "system", content: config.systemPrompt });
  }

  if (Array.isArray(options.history)) {
    for (const item of options.history.slice(-12)) {
      if (item && item.role && item.content) {
        messages.push({ role: item.role, content: item.content });
      }
    }
  }

  messages.push({ role: "user", content: prompt });

  const response = await axios.post(
    `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run/${model}`,
    {
      messages,
      temperature: options.temperature ?? config.temperature,
      max_tokens: options.maxTokens ?? config.maxTokens,
    },
    {
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        "Content-Type": "application/json",
      },
      timeout: options.timeout || 60000,
    }
  );

  const result = response.data?.result;
  const answer =
    result?.response ||
    result?.output_text ||
    result?.text ||
    result?.message ||
    result?.content ||
    null;

  if (!answer) {
    throw new Error("Cloudflare AI không trả về nội dung");
  }

  return String(answer).trim();
}
