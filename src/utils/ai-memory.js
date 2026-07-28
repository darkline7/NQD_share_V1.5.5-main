import fs from "fs";
import path from "path";

const MEMORY_FILE = path.resolve(process.cwd(), "assets", "json-data", "ai-memory.json");
const MAX_HISTORY_ITEMS = 20;
const MAX_CONTEXTS = 250;
const contextMemory = new Map();
let memoryLoaded = false;
let saveTimer = null;

function ensureMemoryFile() {
  const dirPath = path.dirname(MEMORY_FILE);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  if (!fs.existsSync(MEMORY_FILE)) {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify({}, null, 2), "utf-8");
  }
}

function loadMemory() {
  if (memoryLoaded) return;
  memoryLoaded = true;
  try {
    ensureMemoryFile();
    const rawData = fs.readFileSync(MEMORY_FILE, "utf-8");
    const parsed = JSON.parse(rawData || "{}");
    for (const [contextKey, value] of Object.entries(parsed)) {
      if (value && Array.isArray(value.messages)) {
        contextMemory.set(contextKey, {
          messages: value.messages.slice(-MAX_HISTORY_ITEMS),
          updatedAt: value.updatedAt || Date.now(),
        });
      }
    }
  } catch (error) {
    console.error("Lỗi khi tải ai-memory.json:", error.message);
  }
}

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      ensureMemoryFile();
      const payload = {};
      for (const [contextKey, value] of contextMemory.entries()) {
        payload[contextKey] = value;
      }
      fs.writeFileSync(MEMORY_FILE, JSON.stringify(payload, null, 2), "utf-8");
    } catch (error) {
      console.error("Lỗi khi lưu ai-memory.json:", error.message);
    }
  }, 250);
}

function pruneContexts() {
  if (contextMemory.size <= MAX_CONTEXTS) return;
  const entries = Array.from(contextMemory.entries()).sort((a, b) => (a[1].updatedAt || 0) - (b[1].updatedAt || 0));
  while (entries.length > 0 && contextMemory.size > MAX_CONTEXTS) {
    const [key] = entries.shift();
    contextMemory.delete(key);
  }
}

export function getAiContextKey(message, explicitUserId = null) {
  const threadType = message?.type;
  if (threadType && String(threadType).includes("Group")) {
    return `group:${message?.threadId || "unknown"}`;
  }
  const userId = explicitUserId || message?.data?.uidFrom || message?.senderID || "unknown";
  return `user:${userId}`;
}

export function getAiUserContextKey(message, explicitUserId = null) {
  const userId = explicitUserId || message?.data?.uidFrom || message?.senderID || "unknown";
  return `user:${userId}`;
}

export function getConversationHistory(contextKey) {
  loadMemory();
  return contextMemory.get(contextKey)?.messages || [];
}

export function appendConversation(contextKey, role, content) {
  loadMemory();
  if (!contextMemory.has(contextKey)) {
    contextMemory.set(contextKey, { messages: [], updatedAt: Date.now() });
  }

  const entry = contextMemory.get(contextKey);
  entry.messages.push({ role, content, timestamp: Date.now() });
  entry.messages = entry.messages.slice(-MAX_HISTORY_ITEMS);
  entry.updatedAt = Date.now();
  contextMemory.set(contextKey, entry);
  pruneContexts();
  scheduleSave();
}

export function clearConversation(contextKey) {
  loadMemory();
  contextMemory.delete(contextKey);
  scheduleSave();
}

export function getAiMemorySnapshot() {
  loadMemory();
  return {
    contexts: contextMemory.size,
    items: Array.from(contextMemory.entries()).map(([contextKey, value]) => ({
      contextKey,
      count: value.messages?.length || 0,
      updatedAt: value.updatedAt || null,
    })),
  };
}
