const DEFAULT_MEDIA_QUEUE_SETTINGS = {
  enabled: true,
  maxConcurrentPerGroup: 1,
  maxPendingPerGroup: 50,
  acquireTimeoutMs: 120000,
};

const settings = { ...DEFAULT_MEDIA_QUEUE_SETTINGS };
const queues = new Map();

function getQueueState(queueKey) {
  if (!queues.has(queueKey)) {
    queues.set(queueKey, {
      running: 0,
      pending: [],
      totalProcessed: 0,
      totalFailed: 0,
      lastError: null,
      lastActiveAt: null,
    });
  }
  return queues.get(queueKey);
}

function scheduleNext(queueKey) {
  const state = getQueueState(queueKey);
  while (state.running < settings.maxConcurrentPerGroup && state.pending.length > 0) {
    const next = state.pending.shift();
    state.running += 1;
    state.lastActiveAt = Date.now();
    next.resolve(createRelease(queueKey));
  }
}

function createRelease(queueKey) {
  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    const state = getQueueState(queueKey);
    state.running = Math.max(0, state.running - 1);
    state.lastActiveAt = Date.now();
    scheduleNext(queueKey);
  };
}

async function acquireSlot(queueKey) {
  if (!settings.enabled) {
    return () => {};
  }

  const state = getQueueState(queueKey);
  if (state.running < settings.maxConcurrentPerGroup) {
    state.running += 1;
    state.lastActiveAt = Date.now();
    return createRelease(queueKey);
  }

  if (state.pending.length >= settings.maxPendingPerGroup) {
    throw new Error(`Media queue for ${queueKey} is full`);
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      const idx = state.pending.findIndex((item) => item.reject === reject);
      if (idx >= 0) {
        state.pending.splice(idx, 1);
      }
      reject(new Error(`Media queue timeout for ${queueKey}`));
    }, settings.acquireTimeoutMs);

    state.pending.push({
      resolve: (releaseFn) => {
        clearTimeout(timeout);
        resolve(releaseFn);
      },
      reject: (err) => {
        clearTimeout(timeout);
        reject(err);
      },
    });
  });
}

function markResult(queueKey, ok, error = null) {
  const state = getQueueState(queueKey);
  state.totalProcessed += 1;
  if (!ok) {
    state.totalFailed += 1;
    state.lastError = error?.message || String(error || "Unknown error");
  }
  state.lastActiveAt = Date.now();
}

export async function withMediaUploadQueue(queueKey, taskFn) {
  const release = await acquireSlot(queueKey);
  try {
    const result = await taskFn();
    markResult(queueKey, true);
    return result;
  } catch (error) {
    markResult(queueKey, false, error);
    throw error;
  } finally {
    release();
  }
}

export function getMediaQueueSettings() {
  return { ...settings };
}

export function updateMediaQueueSettings(nextSettings = {}) {
  const maxConcurrent = Number(nextSettings.maxConcurrentPerGroup);
  const maxPending = Number(nextSettings.maxPendingPerGroup);
  const timeoutMs = Number(nextSettings.acquireTimeoutMs);

  if (typeof nextSettings.enabled === "boolean") {
    settings.enabled = nextSettings.enabled;
  }
  if (!Number.isNaN(maxConcurrent) && maxConcurrent > 0 && maxConcurrent <= 10) {
    settings.maxConcurrentPerGroup = Math.floor(maxConcurrent);
  }
  if (!Number.isNaN(maxPending) && maxPending >= 1 && maxPending <= 200) {
    settings.maxPendingPerGroup = Math.floor(maxPending);
  }
  if (!Number.isNaN(timeoutMs) && timeoutMs >= 1000 && timeoutMs <= 600000) {
    settings.acquireTimeoutMs = Math.floor(timeoutMs);
  }

  return getMediaQueueSettings();
}

export function getMediaQueueSnapshot() {
  const entries = [];
  for (const [queueKey, state] of queues.entries()) {
    entries.push({
      queueKey,
      running: state.running,
      pending: state.pending.length,
      totalProcessed: state.totalProcessed,
      totalFailed: state.totalFailed,
      lastError: state.lastError,
      lastActiveAt: state.lastActiveAt,
    });
  }
  return entries.sort((a, b) => (b.lastActiveAt || 0) - (a.lastActiveAt || 0));
}
