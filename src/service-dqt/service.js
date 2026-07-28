import { startWebServer } from "../web-service/web-server.js";
import { readCommandConfig } from "../utils/io-json.js";
import { initializeAutoSendScheduler } from "./scheduler/auto-send.js";
import { startMuteCheck } from "./anti-service/mute-user.js";
import { startBadWordViolationCheck } from "./anti-service/anti-badword.js";
import { handleMusicReply } from "./api-crawl/music/soundcloud.js";
import { startNudeViolationCheck } from "./anti-service/anti-nude/anti-nude.js";
import { handleActionGroupReply } from "../commands/bot-manager/remote-action-group.js";
import { checkReplySelectionsMapData } from "./api-crawl/index.js";
import { notifyResetGroup } from "../commands/bot-manager/active-bot.js";
import { handleScanGroupsReply } from "../commands/bot-manager/scan-group.js";
import { startAntiConfigCheck } from "./anti-service/index.js";
import { initializeCacheService } from "../utils/link-platform-cache.js";

let globalPrefix = "@";

export function getGlobalPrefix() {
  return globalPrefix;
}

export function setGlobalPrefix(newPrefix) {
  globalPrefix = newPrefix;
}

export async function initService(api) {
  const commandConfig = readCommandConfig();
  globalPrefix = commandConfig.prefix || "!";

  await Promise.all([
    initializeCacheService(),
    initializeAutoSendScheduler(api),
    startWebServer(api),
    startAntiConfigCheck(),
    startMuteCheck(api),
    startBadWordViolationCheck(),
    startNudeViolationCheck(),
    notifyResetGroup(api),
  ]);
}

export async function handleOnChatUser(
  api,
  message,
  isCallGame,
  groupSettings
) {
  return false;
}

export async function handleOnReplyFromUser(
  api,
  message,
  groupInfo,
  groupAdmins,
  groupSettings,
  isAdminLevelHighest,
  isAdminBot,
  isAdminBox,
  handleChat
) {
  if (await checkReplySelectionsMapData(api, message)) return true;
  if (await handleScanGroupsReply(api, message)) return true;
  if (await handleMusicReply(api, message)) return true;
  if (
    await handleActionGroupReply(
      api,
      message,
      groupInfo,
      groupAdmins,
      groupSettings,
      isAdminLevelHighest,
      isAdminBot,
      isAdminBox,
      handleChat
    )
  )
    return true;
  return false;
}
