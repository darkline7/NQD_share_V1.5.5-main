import { readWebConfig, writeWebConfig } from "../utils/io-json.js";
import {
  getMediaQueueSettings,
  updateMediaQueueSettings,
} from "../utils/media-upload-queue.js";
import {
  getCircuitBreakerSettings,
  updateCircuitBreakerSettings,
} from "../utils/circuit-breaker.js";

const DEFAULT_RUNTIME_CONTROLS = {
  mediaQueue: getMediaQueueSettings(),
  circuitBreaker: getCircuitBreakerSettings(),
};

function mergeControls(config) {
  return {
    mediaQueue: {
      ...DEFAULT_RUNTIME_CONTROLS.mediaQueue,
      ...(config?.mediaQueue || {}),
    },
    circuitBreaker: {
      ...DEFAULT_RUNTIME_CONTROLS.circuitBreaker,
      ...(config?.circuitBreaker || {}),
    },
  };
}

export function applyRuntimeControlsFromConfig() {
  const webConfig = readWebConfig();
  const merged = mergeControls(webConfig.runtimeControls);
  updateMediaQueueSettings(merged.mediaQueue);
  updateCircuitBreakerSettings(merged.circuitBreaker);
  return merged;
}

export function updateRuntimeControls({ mediaQueue, circuitBreaker }) {
  const webConfig = readWebConfig();
  const runtimeControls = mergeControls(webConfig.runtimeControls);

  if (mediaQueue) {
    runtimeControls.mediaQueue = updateMediaQueueSettings(mediaQueue);
  }

  if (circuitBreaker) {
    runtimeControls.circuitBreaker = updateCircuitBreakerSettings(circuitBreaker);
  }

  webConfig.runtimeControls = runtimeControls;
  writeWebConfig(webConfig);
  return runtimeControls;
}
