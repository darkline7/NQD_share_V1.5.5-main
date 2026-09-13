import schedule from "node-schedule";
import { MessageType } from "zlbotdqt";

import { getConnectedClientsCount, getIO } from "../web-service/web-server.js";

import { getBotId, isAdmin, checkDisableProphylacticConfig } from "../index.js";

import { antiLink } from "../service-dqt/anti-service/anti-link.js";
import { antiSpam } from "../service-dqt/anti-service/anti-spam.js";
import { antiBadWord } from "../service-dqt/anti-service/anti-badword.js";
import { antiNotText } from "../service-dqt/anti-service/anti-not-text.js";
import { handleMute } from "../service-dqt/anti-service/mute-user.js";

import { handleOnChatUser, handleOnReplyFromUser } from "../service-dqt/service.js";

import { handleChatBot } from "../service-dqt/chat-bot/bot-learning/dqt-bot.js";

import { getGroupAdmins, getGroupInfoData } from "../service-dqt/info-service/group-info.js";

import { pushMessageToWebLog } from "../utils/io-json.js";
import { handleCommand, initGroupSettings, handleCommandPrivate } from "../commands/command.js";
import { logMessageToFile, readGroupSettings } from "../utils/io-json.js";

import { antiNude } from "../service-dqt/anti-service/anti-nude/anti-nude.js";
import { isUserBlocked } from "../commands/bot-manager/group-manage.js";

const userLastMessageTime = new Map();
const COOLDOWN_TIME = 1000;

async function canReplyToUser(senderId) {
  const currentTime = Date.now();
  const lastMessageTime = userLastMessageTime.get(senderId);

  if (!lastMessageTime || currentTime - lastMessageTime >= COOLDOWN_TIME) {
    userLastMessageTime.set(senderId, currentTime);
    return true;
  }
  return false;
}

schedule.scheduleJob("*/1 * * * *", () => {
  const currentTime = Date.now();
  for (const [userId, lastTime] of userLastMessageTime.entries()) {
    if (currentTime - lastTime > 60000) {
      userLastMessageTime.delete(userId);
    }
  }
  checkDisableProphylacticConfig();
});

export async function messagesUser(api, message) {
  const senderId = message.data.uidFrom;
  const threadId = message.threadId;
  let content = message.data.content;
  const isPlainText = typeof message.data.content === "string";
  const senderName = message.data.dName;
  let isAdminLevelHighest = false;
  let isAdminBot = false;
  isAdminLevelHighest = isAdmin(senderId);
  isAdminBot = isAdmin(senderId, threadId);
  const idBot = getBotId();
  const io = getIO();
  let isSelf = idBot === senderId;
  const contentText = isPlainText
    ? content
    : content.href
      ? "Caption: " + content.title + "\nLink: " + content.href
      : content.catId
        ? "Sticker ID: " + content.id + " | " + content.catId + " | " + content.type
        : null;

  switch (message.type) {
    case MessageType.DirectMessage: {
      if (getConnectedClientsCount() > 0) {
        const userInfo = await api.getGroupMembers([senderId + "_0"]);
        pushMessageToWebLog(io, "Tin Nhắn Riêng Tư", senderName, content, userInfo.profiles[senderId].avatar);
      }
      if (contentText) {
        const logMessage = `Có Mesage Riêng tư mới:
              - Sender Name: [ ${senderName} ] | ID: ${threadId}
              - Content: ${contentText}\n`;
        logMessageToFile(logMessage);
      }
      if (isPlainText) {
        let continueProcessingChat = true;
        continueProcessingChat = !isUserBlocked(senderId);
        continueProcessingChat = continueProcessingChat && (await canReplyToUser(senderId));
        continueProcessingChat = continueProcessingChat && !(await handleOnReplyFromUser(api, message));
        if (continueProcessingChat) {
          const commandResult = await handleCommandPrivate(api, message);
          continueProcessingChat = continueProcessingChat && commandResult === 1 && !isSelf;
        }
      }
      break;
    }
    case MessageType.GroupMessage: {
      let groupAdmins = [];
      let nameGroup = "";
      let isAdminBox = false;
      let botIsAdminBox = false;
      let groupInfo = {};
      if (threadId) {
        groupInfo = await getGroupInfoData(api, threadId);
        groupAdmins = await getGroupAdmins(groupInfo);
        botIsAdminBox = groupAdmins.includes(idBot.toString());
        nameGroup = groupInfo.name;
        isAdminBox = isAdmin(senderId, threadId, groupAdmins);
      }

      if (contentText) {
        const logMessage = `Có Mesage nhóm mới:
              - Tên Nhóm: ${nameGroup} | Group ID: ${threadId}
              - Người Gửi: ${senderName} | Sender ID: ${senderId}
              - Nội Dung: ${contentText}\n`;
        logMessageToFile(logMessage);
      }

      const groupSettings = readGroupSettings();
      initGroupSettings(groupSettings, threadId, nameGroup);
      if (getConnectedClientsCount() > 0) {
        pushMessageToWebLog(io, nameGroup, senderName, content, groupInfo.avt);
      }


      let handleChat = true;
      handleChat = !(await handleMute(api, message, groupSettings, isAdminBox, botIsAdminBox, isSelf));
      handleChat = handleChat && !(await antiBadWord(api, message, groupSettings, isAdminBox, botIsAdminBox, isSelf));
      handleChat = handleChat && !isUserBlocked(senderId);
      const numberHandleCommand = await handleCommand(
        api,
        message,
        groupInfo,
        groupAdmins,
        groupSettings,
        isAdminLevelHighest,
        isAdminBot,
        isAdminBox,
        handleChat
      );
      if (isPlainText) {
        // numberHandleCommand = -1: Không Có Lệnh Nào Được Xử Lý
        // numberHandleCommand = 1: Đã xử lý lệnh thành viên
        // numberHandleCommand = 2: Bỏ Qua Xử Lý Lệnh Chat Bot
        // numberHandleCommand = 3: Đã Xử Lý Lệnh Quản Trị
        // numberHandleCommand = 99: Phát Hiện Dùng Lệnh Không Tồn Tại
        handleChat = handleChat && !isSelf;
        if (handleChat || (!isSelf && isAdminBot)) {
          const isGameChat = await handleOnChatUser(api, message, false, groupSettings);
          if (isGameChat) return;
        }
        if (handleChat || isAdminBot) {
          handleChat = await handleOnReplyFromUser(
            api,
            message,
            groupInfo,
            groupAdmins,
            groupSettings,
            isAdminLevelHighest,
            isAdminBot,
            isAdminBox,
            handleChat || isAdminBot
          );
        }

        if (!isSelf) {
          await handleChatBot(api, message, threadId, groupSettings, nameGroup, numberHandleCommand === 2);
        }
      }

      await Promise.all([
        antiNotText(api, message, isAdminBox, groupSettings, botIsAdminBox, isSelf),
        antiLink(api, message, isAdminBox, groupSettings, botIsAdminBox, isSelf),
        antiSpam(api, message, isAdminBox, groupSettings, botIsAdminBox, isSelf),
        antiNude(api, message, isAdminBox, groupSettings, botIsAdminBox, isSelf)
      ]);
      break;
    }
  }
}
