const DEFAULT_CIRCUIT_SETTINGS = {
  enabled: true,
  failureThreshold: 4,
  successThreshold: 2,
  openTimeoutMs: 45000,
};

const circuitSettings = { ...DEFAULT_CIRCUIT_SETTINGS };
const circuits = new Map();

function ensureCircuit(name) {
  if (!circuits.has(name)) {
    circuits.set(name, {
      state: "closed",
      failures: 0,
      successes: 0,
      openedAt: 0,
      lastFailureAt: 0,
      lastError: null,
      trialInProgress: false,
    });
  }
  return circuits.get(name);
}

function toPublicCircuit(name, circuit) {
  return {
    name,
    state: circuit.state,
    failures: circuit.failures,
    successes: circuit.successes,
    openedAt: circuit.openedAt,
    lastFailureAt: circuit.lastFailureAt,
    lastError: circuit.lastError,
    trialInProgress: circuit.trialInProgress,
  };
}

function createOpenError(name, waitMs) {
  const seconds = Math.max(1, Math.ceil(waitMs / 1000));
  const error = new Error(`Circuit breaker for ${name} is open. Retry in about ${seconds}s.`);
  error.code = "CIRCUIT_OPEN";
  error.retryAfterMs = waitMs;
  error.service = name;
  return error;
}

function canTryHalfOpen(circuit) {
  if (circuit.state !== "open") {
    return false;
  }
  const elapsed = Date.now() - circuit.openedAt;
  return elapsed >= circuitSettings.openTimeoutMs;
}

function beforeExecution(name) {
  if (!circuitSettings.enabled) {
    return { allow: true, circuit: ensureCircuit(name) };
  }

  const circuit = ensureCircuit(name);

  if (circuit.state === "open") {
    if (!canTryHalfOpen(circuit)) {
      const waitMs = circuitSettings.openTimeoutMs - (Date.now() - circuit.openedAt);
      throw createOpenError(name, waitMs);
    }

    if (circuit.trialInProgress) {
      throw createOpenError(name, 1000);
    }

    circuit.state = "half-open";
    circuit.trialInProgress = true;
    return { allow: true, circuit };
  }

  if (circuit.state === "half-open" && circuit.trialInProgress) {
    throw createOpenError(name, 1000);
  }

  return { allow: true, circuit };
}

function onSuccess(circuit) {
  if (circuit.state === "half-open") {
    circuit.successes += 1;
    circuit.trialInProgress = false;
    if (circuit.successes >= circuitSettings.successThreshold) {
      circuit.state = "closed";
      circuit.failures = 0;
      circuit.successes = 0;
      circuit.lastError = null;
    }
    return;
  }

  circuit.failures = 0;
  circuit.successes = 0;
}

function onFailure(circuit, error) {
  circuit.lastError = error?.message || String(error || "Unknown error");
  circuit.lastFailureAt = Date.now();

  if (circuit.state === "half-open") {
    circuit.state = "open";
    circuit.failures = circuitSettings.failureThreshold;
    circuit.successes = 0;
    circuit.openedAt = Date.now();
    circuit.trialInProgress = false;
    return;
  }

  circuit.failures += 1;
  if (circuit.failures >= circuitSettings.failureThreshold) {
    circuit.state = "open";
    circuit.openedAt = Date.now();
    circuit.successes = 0;
    circuit.trialInProgress = false;
  }
}

export async function executeWithCircuitBreaker(name, taskFn) {
  const { circuit } = beforeExecution(name);

  try {
    const result = await taskFn();
    onSuccess(circuit);
    return result;
  } catch (error) {
    if (error?.code === "CIRCUIT_OPEN") {
      throw error;
    }
    onFailure(circuit, error);
    throw error;
  }
}

export function getCircuitBreakerSettings() {
  return { ...circuitSettings };
}

export function updateCircuitBreakerSettings(nextSettings = {}) {
  const failureThreshold = Number(nextSettings.failureThreshold);
  const successThreshold = Number(nextSettings.successThreshold);
  const openTimeoutMs = Number(nextSettings.openTimeoutMs);

  if (typeof nextSettings.enabled === "boolean") {
    circuitSettings.enabled = nextSettings.enabled;
  }
  if (!Number.isNaN(failureThreshold) && failureThreshold >= 1 && failureThreshold <= 20) {
    circuitSettings.failureThreshold = Math.floor(failureThreshold);
  }
  if (!Number.isNaN(successThreshold) && successThreshold >= 1 && successThreshold <= 10) {
    circuitSettings.successThreshold = Math.floor(successThreshold);
  }
  if (!Number.isNaN(openTimeoutMs) && openTimeoutMs >= 1000 && openTimeoutMs <= 600000) {
    circuitSettings.openTimeoutMs = Math.floor(openTimeoutMs);
  }

  return getCircuitBreakerSettings();
}

export function getCircuitBreakerSnapshot() {
  const list = [];
  for (const [name, circuit] of circuits.entries()) {
    list.push(toPublicCircuit(name, circuit));
  }
  return list;
}
