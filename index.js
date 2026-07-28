import { Zalo } from "./api-zalo/index.js";

import { gruopEvents } from "./automations/events-group.js";
import { messagesUser } from "./automations/event-send-msg.js";
import { undoMessageEvents } from "./automations/event-undo-msg.js";

import {
  readAdmins,
  readConfig,
  readGroupSettings,
  readCommandConfig,
  writeProphylacticConfig,
  readProphylacticConfig
} from "./utils/io-json.js";

import { logManagerBot } from "./utils/io-json.js";
import { initService } from "./service-dqt/service.js";
import { reactionEvents } from "./automations/events-reaction.js";
import { typingEvents } from "./automations/event-typing.msg.js";
import { updateMessageCache } from "./utils/message-cache.js";

let idBot = -1;
const prophylacticConfig = readProphylacticConfig();
export let admins = readAdmins();
let config = readConfig();
let commandConfig = readCommandConfig();

const zalo = new Zalo(
  {
    cookie: config.cookie,
    imei: config.imei,
    userAgent: config.userAgent,
  },
  {
    selfListen: true, // Trả lời bản thân
    checkUpdate: false, // Cập nhật code
  }
);

export function getApi() {
  return api;
}

export function getBotId() {
  return idBot;
}

export function setBotId(id) {
  idBot = id;
}

export function getCommandConfig() {
  return commandConfig;
}

export function reloadCommandConfig() {
  commandConfig = readCommandConfig();
  return commandConfig;
}

export function getProphylacticConfig() {
  return prophylacticConfig;
}

export function getProphylacticUploadAttachment() {
  return prophylacticConfig.prophylacticUploadAttachment.enable;
}

export function setProphylacticUploadAttachment(enable, resetNum = false) {
  prophylacticConfig.prophylacticUploadAttachment.enable = enable;
  prophylacticConfig.prophylacticUploadAttachment.lastBlocked = Date.now();
  if (resetNum) prophylacticConfig.prophylacticUploadAttachment.numRequestZalo = 0;
  writeProphylacticConfig(prophylacticConfig);
}

const timeResetNumberRequestUpload = 120 * 60 * 1000;
const timeDisableProphylacticConfig = 120 * 60 * 1000;
const maxRequestUploadIntoNotProphylactic = 300;

export function checkDisableProphylacticConfig() {
  if (prophylacticConfig.prophylacticUploadAttachment.enable) {
    const currentTime = Date.now();
    const lastBlockedTime = prophylacticConfig.prophylacticUploadAttachment.lastBlocked;
    const timeDifference = currentTime - lastBlockedTime;

    if (timeDifference > timeDisableProphylacticConfig) {
      setProphylacticUploadAttachment(false, true);
    }
  }
}

export function checkConfigUploadAttachment(extFile, isUseProphylactic = false) {
  if (["jpg", "jpeg", "png", "webp"].includes(extFile)) {
    const currentTime = Date.now();
    if ((!prophylacticConfig.prophylacticUploadAttachment?.lastRequestTime) 
      || (currentTime - prophylacticConfig.prophylacticUploadAttachment.lastRequestTime > timeResetNumberRequestUpload)) {
      prophylacticConfig.prophylacticUploadAttachment.numRequestZalo = 0;
      prophylacticConfig.prophylacticUploadAttachment.lastRequestTime = currentTime;
      setProphylacticUploadAttachment(false);
    }

    if (!isUseProphylactic) {
      prophylacticConfig.prophylacticUploadAttachment.numRequestZalo++;
    }
    writeProphylacticConfig(prophylacticConfig);

    if (prophylacticConfig.prophylacticUploadAttachment.numRequestZalo > maxRequestUploadIntoNotProphylactic) {
      setProphylacticUploadAttachment(true);
      prophylacticConfig.prophylacticUploadAttachment.lastBlocked = currentTime;
    }
  }
}

export function isAdmin(userId, threadId, groupAdmins) {
  if (admins.includes(userId.toString())) {
    return true;
  }

  const groupSettings = readGroupSettings();
  if (threadId && groupSettings[threadId] && typeof groupSettings[threadId]["adminList"] === "object") {
    if (Object.keys(groupSettings[threadId]["adminList"]).includes(userId.toString())) {
      return true;
    }
  }

  if (groupAdmins && Array.isArray(groupAdmins) && groupAdmins.includes(userId.toString())) {
    return true;
  }

  return false;
}

const api = await zalo.login();

// Khởi động server
initService(api);

// Xử Lý Tin Nhắn Riêng Và Tin Nhắn Nhóm
api.listener.on("message", async (message) => {
  try {
    await messagesUser(api, message);
  } catch (error) {
    const detailError = `Mã Lỗi: ${error.code} - > Chú Thích Lỗi Tin Nhắn: ${error.message}\nNội Dung Lỗi: ${error.stack}`;
    console.error(detailError);
    logManagerBot(detailError);
  }
  updateMessageCache(message);
});

// Xử Lý Sự Kiện Nhóm
api.listener.on("group_event", async (event) => {
  try {
    await gruopEvents(api, event);
  } catch (error) {
    const detailError = `Mã Lỗi: ${error.code} - > Chú Thích Lỗi Sự Kiện Nhóm: ${error.message}\nNội Dung Lỗi: ${error.stack}`;
    console.error(detailError);
    logManagerBot(detailError);
  }
});

//Xử Lý Sự Kiện Undo Message
api.listener.on("undo", async (undo) => {
  try {
    await undoMessageEvents(api, undo);
  } catch (error) {
    const detailError = `Mã Lỗi: ${error.code} - > Chú Thích Lỗi Sự Kiện Delete Message: ${error.message}\nNội Dung Lỗi: ${error.stack}`;
    console.error(detailError);
    logManagerBot(detailError);
  }
});

//Xử Lý Sự Kiện Reaction
api.listener.on("reaction", async (reaction) => {
  try {
    await reactionEvents(api, reaction);
  } catch (error) {
    const detailError = `Mã Lỗi: ${error.code} - > Chú Thích Lỗi Sự Kiện Reaction: ${error.message}\nNội Dung Lỗi: ${error.stack}`;
    console.error(detailError);
    logManagerBot(detailError);
  }
});

//Xử Lý Sự Kiện Reaction
// api.listener.on("typing", async (typing) => {
//   try {
//     await typingEvents(api, typing);
//   } catch (error) {
//     const detailError = `Mã Lỗi: ${error.code} - > Chú Thích Lỗi Sự Kiện Typing: ${error.message}\nNội Dung Lỗi: ${error.stack}`;
//     console.error(detailError);
//     logManagerBot(detailError);
//   }
// });

api.listener.start();
