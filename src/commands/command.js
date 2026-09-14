import { writeGroupSettings } from "../utils/io-json.js";
import { handleMuteList, handleMuteUser, handleUnmuteUser } from "../service-dqt/anti-service/mute-user.js";
import { handleWelcomeBye, handleApprove } from "./bot-manager/welcome-bye.js";
import { handleBlock, handleKick } from "./bot-manager/group-manage.js";
import { managerData } from "./bot-manager/active-bot.js";
import { helpCommand, adminCommand } from "./instructions/help.js";

import { groupInfoCommand } from "../service-dqt/info-service/group-info.js";
import { userInfoCommand } from "../service-dqt/info-service/user-info.js";

import { handleLearnCommand, handleReplyCommand } from "../service-dqt/chat-bot/bot-learning/dqt-bot.js";
import { handleOnlyText } from "../service-dqt/anti-service/anti-not-text.js";
import { getBotDetails } from "../service-dqt/info-service/bot-info.js";
import { handleAntiLinkCommand } from "../service-dqt/anti-service/anti-link.js";
import { getCommandConfig, isAdmin } from "../index.js";
import {
  sendMessageInsufficientAuthority,
} from "../service-dqt/chat-zalo/chat-style/chat-style.js";
import { handleAdminHighLevelCommands, handleListAdmin } from "./bot-manager/admin-manager.js";
import { handleAntiSpamCommand } from "../service-dqt/anti-service/anti-spam.js";
import {
  handleKeyCommands,
  handleBlockBot,
  handleUnblockBot,
  handleListBlockBot,
} from "./bot-manager/group-manage.js";
import { handlePrefixCommand } from "./bot-manager/prefix.js";
import { getGlobalPrefix } from "../service-dqt/service.js";
import { userBussinessCardCommand } from "../service-dqt/info-service/bussiness-card.js";
import { handleStickerCommand } from "../service-dqt/chat-zalo/chat-special/send-sticker/send-sticker.js";
import {
  checkNotFindCommand,
  handleAliasCommand,
  handleChangeGroupLink,
  handleSendTaskCommand,
  handleSendToDo,
  handleUndoMessage,
} from "./bot-manager/utilities.js";
import { handleAutoSendCommand } from "../service-dqt/scheduler/auto-send.js";
import { handleAntiBadWordCommand } from "../service-dqt/anti-service/anti-badword.js";
import {
  handleVoiceCommand,
} from "../service-dqt/chat-zalo/chat-special/send-voice/send-voice.js";
import { handleMusicCommand } from "../service-dqt/api-crawl/music/soundcloud.js";
import { handleAntiNudeCommand } from "../service-dqt/anti-service/anti-nude/anti-nude.js";
import { handleAntiImageSpamCommand } from "../service-dqt/anti-service/anti-image-spam.js";
import { handleMuteScheduleCommand } from "../service-dqt/anti-service/mute-schedule.js";
import { handleSettingGroupCommand } from "./bot-manager/group-manage.js";
import { handleJoinGroup, handleLeaveGroup, handleShowGroupsList } from "./bot-manager/remote-action-group.js";
import { removeMention } from "../utils/format-util.js";
import { handleWhiteList } from "../service-dqt/anti-service/white-list.js";
import { handleAntiUndoCommand } from "../service-dqt/anti-service/anti-undo.js";
import { sendReactionWaitingCountdown } from "./manager-command/check-countdown.js";
import { getPermissionCommandName, handleSetCommandActive } from "./manager-command/set-command.js";
import { scanGroupsWithAction } from "./bot-manager/scan-group.js";
import { handleDeleteMessage } from "./bot-manager/recent-message.js";
import { handleSpeedTestCommand } from "../service-dqt/utilities/speedtest.js";
import { handleAiCommand } from "../service-dqt/utilities/ai-command.js";
import { executeWithCircuitBreaker } from "../utils/circuit-breaker.js";
import {
  handleDailyCommand,
  handleWalletCommand,
  handleBankCommand,
  handleTopCommand,
  handleTaiXiuCommand,
  handleBauCuaCommand,
  handleKBBCommand,
  handleGameMenuCommand,
  handleAdminMoneyCommand,
} from "../service-dqt/game-service/index.js";


const lastCommandUsage = {};
const HARD_DISABLED_COMMANDS = new Set([
  "tagall",
  "sendp",
]);

async function executeExternalCrawlCommand(api, message, serviceName, handler) {
  try {
    return await executeWithCircuitBreaker(serviceName, handler);
  } catch (error) {
    if (error?.code === "CIRCUIT_OPEN") {
      await api.sendMessage(
        {
          msg: `Dịch vụ ${serviceName} đang tạm ngắt do lỗi liên tiếp. Vui lòng thử lại sau ${Math.ceil((error.retryAfterMs || 1000) / 1000)} giây.`,
          quote: message,
          ttl: 15000,
        },
        message.threadId,
        message.type
      );
      return null;
    }
    throw error;
  }
}

export const permissionLevels = {
  all: 0,
  adminBox: 1,
  adminBot: 2,
  adminLevelHigh: 3,
};

export function getCommand(command, commandConfig) {
  let commandConfigFinal = null;
  if (commandConfig) {
    commandConfigFinal = commandConfig;
  } else {
    commandConfigFinal = getCommandConfig().commands;
  }

  return commandConfigFinal.find((cmd) => cmd.name === command || (cmd.alias && cmd.alias.includes(command)));
}

async function checkPermission(api, message, commandName, userPermissionLevel, isNotify = true) {
  const commandConfig = getCommandConfig().commands;
  const command = getCommand(commandName, commandConfig);

  if (!command) {
    return true;
  }

  const requiredPermission = permissionLevels[command.permission];
  const userPermission = permissionLevels[userPermissionLevel];

  if (userPermission >= requiredPermission) {
    return true;
  }

  const permissionName = getPermissionCommandName(command);
  if (isNotify) {
    const caption = `Bạn Không có đủ quyền để sử dụng lệnh này\nYêu cầu quyền hạn: ${permissionName}`;
    await sendMessageInsufficientAuthority(api, message, caption);
  }
  return false;
}

export async function checkCommandCountdown(api, message, userId, commandName, commandUsage) {
  const commandConfig = getCommandConfig().commands;
  const command = getCommand(commandName, commandConfig);

  if (!command) {
    return true;
  }

  const currentTime = Date.now();
  const lastUsage = commandUsage[userId]?.[command.name] || 0;
  const countdown = command.countdown * 1000;

  if (currentTime - lastUsage < countdown) {
    const remainingTime = Math.ceil((countdown - (currentTime - lastUsage)) / 1000);
    await sendReactionWaitingCountdown(api, message, remainingTime, commandName);
    return false;
  }

  if (!commandUsage[userId]) {
    commandUsage[userId] = {};
  }
  commandUsage[userId][command.name] = currentTime;

  return true;
}

export async function sendReactionConfirmReceive(api, message, numHandleCommand) {
  if (numHandleCommand === 1 || numHandleCommand === 5) {
    await api.addReaction("OK", message);
  }
}

export function initGroupSettings(groupSettings, threadId, nameGroup) {
  const defaultSettings = {
    adminList: {},
    muteList: {},
    whileList: {},
    welcomeGroup: false,
    byeGroup: false,
    antiSpam: false,
    filterBadWords: false,
    removeLinks: false,
    antiLinkMode: "all",
    antiLinkAllowDomains: [],
    antiLinkDomain: "",
    learnEnabled: false,
    replyEnabled: false,
    aiEnabled: false,
    onlyText: false,
    memberApprove: false,
    antiNude: false,
    antiImageSpam: false,
    muteSchedule: { enabled: false, startHour: 22, endHour: 6 },
    whiteList: {},
    autoSend: {
      enabled: false,
      intervalMs: 60000,
      nextSendAt: 0,
      lastSentAt: 0,
      content: {
        text: "",
        attachments: [],
      },
    },
  };

  if (!groupSettings[threadId]) {
    groupSettings[threadId] = { nameGroup: nameGroup };
  }

  Object.assign(
    groupSettings[threadId],
    Object.fromEntries(Object.entries(defaultSettings).filter(([key]) => !(key in groupSettings[threadId])))
  );

  if (!groupSettings[threadId].nameGroup || groupSettings[threadId].nameGroup != nameGroup) {
    groupSettings[threadId].nameGroup = nameGroup;
    writeGroupSettings(groupSettings);
  }
}

export async function checkAdminLevelHighest(api, message, isAdminLevelHighest) {
  if (!isAdminLevelHighest) {
    await sendMessageInsufficientAuthority(
      api,
      message,
      "Chỉ có quản trị viên cấp cao mới được sử dụng lệnh này!"
    );
    return false;
  }
  return true;
}

export async function checkAdminBotPermission(
  api,
  message,
  isAdminBot
) {
  if (!isAdminBot) {
    await sendMessageInsufficientAuthority(
      api,
      message,
      "Chỉ có quản trị viên bot mới được sử dụng lệnh này!"
    );
    return false;
  }
  return true;
}

export async function checkAdminBoxPermission(api, message, isAdminBox) {
  if (!isAdminBox) {
    await sendMessageInsufficientAuthority(
      api,
      message,
      "Chỉ có trưởng / phó cộng đồng hoặc quản trị bot mới được sử dụng lệnh này!"
    );
    return false;
  }
  return true;
}

function checkSpecialCommand(content, prefix) {
  const specialCommands = ["todo", "learnnow"];
  return specialCommands.some((cmd) => content.startsWith(`${prefix}${cmd}`));
}

export async function handleCommandPrivate(api, message) {
  const threadId = message.threadId;
  const senderId = message.data.uidFrom;
  const content = message.data.content.trim();
  const prefix = getGlobalPrefix();
  const isAdminLevelHighest = isAdmin(senderId);

  if (typeof content === "string") {
    let command;
    let commandParts;

    // Kiểm tra xem có phải là lệnh prefix Không
    if (content.startsWith(`${prefix}prefix`) || content.startsWith(`prefix`)) {
      return await handlePrefixCommand(api, message, threadId, isAdminLevelHighest);
    }

    // Kiểm tra xem tin nhắn có bắt đầu bằng prefix Không
    if (!content.startsWith(prefix)) {
      return 1;
    }

    if (checkSpecialCommand(content, prefix)) {
      commandParts = content.split("_");
      command = commandParts[0].slice(prefix.length).toLowerCase();
    } else {
      commandParts = content.slice(prefix.length).trim().split(/\s+/);
      command = commandParts[0].toLowerCase();
    }

    if (HARD_DISABLED_COMMANDS.has(command)) {
      await sendMessageInsufficientAuthority(api, message, `Lệnh ${prefix}${command} hiện đã bị tắt trên bot.`);
      return 0;
    }

    if (!(await checkCommandCountdown(api, message, senderId, `${prefix}${command}`, lastCommandUsage))) {
      return;
    }

    const isAdminBot = isAdmin(senderId, threadId);

    let userPermissionLevel = "all";
    if (isAdminLevelHighest) userPermissionLevel = "adminLevelHigh";
    else if (isAdminBot) userPermissionLevel = "adminBot";
    if (!(await checkPermission(api, message, command, userPermissionLevel))) {
      return;
    }

    const commandConfig = getCommandConfig().commands;
    const aliasCommand = command;
    const commandInfo = getCommand(command, commandConfig);
    const activeCommand = commandInfo ? commandInfo.active : true;
    if (!isAdminLevelHighest && aliasCommand !== "" && !activeCommand) {
      return 0;
    }
    command = commandInfo?.name || command;
    let numHandleCommand = commandInfo?.type || 99;

    if (numHandleCommand === 3) {
      switch (command) {
        case "join":
          await handleJoinGroup(api, message);
          return 0;
        case "listgroups":
          await handleShowGroupsList(api, message, aliasCommand);
          return 0;
        case "todo":
          await handleSendToDo(api, message);
          return 0;
        case "blockbot":
          await handleBlockBot(api, message);
          return 0;
        case "unblockbot":
          await handleUnblockBot(api, message);
          return 0;
        case "alias":
          await handleAliasCommand(api, message, commandParts);
          return 0;
        case "setcmd":
          await handleSetCommandActive(api, message, commandParts);
          return 0;
        case "givemoney":
          await handleAdminMoneyCommand(api, message, isAdminBot);
          return 0;

      }
    }

    if (numHandleCommand === 1) {
      if (managerData.data.onBotPrivate || isAdminLevelHighest) {
        await sendReactionConfirmReceive(api, message, numHandleCommand);
        switch (command) {
          case "detail":
            await getBotDetails(api, message);
            return 0;
          case "speedtest":
            await handleSpeedTestCommand(api, message);
            return 0;
          case "info":
            await userInfoCommand(api, message, aliasCommand);
            return 0;
          case "card":
            await userBussinessCardCommand(api, message, aliasCommand);
            return 0;
          case "help":
            await helpCommand(api, message);
            return 0;
          case "ai":
            await handleAiCommand(api, message, aliasCommand);
            return 0;
          case "sticker":
            await handleStickerCommand(api, message);
            return 0;
          case "voice":
            await handleVoiceCommand(api, message, aliasCommand);
            return 0;
          case "soundcloud":
            await executeExternalCrawlCommand(api, message, "soundcloud", () => handleMusicCommand(api, message, aliasCommand));
            return 0;
          case "game":
            await handleGameMenuCommand(api, message);
            return 0;
          case "diemdanh":
            await handleDailyCommand(api, message);
            return 0;
          case "vi":
            await handleWalletCommand(api, message, aliasCommand);
            return 0;
          case "top":
            await handleTopCommand(api, message);
            return 0;
          case "taixiu":
            await handleTaiXiuCommand(api, message, aliasCommand);
            return 0;
          case "baucua":
            await handleBauCuaCommand(api, message, aliasCommand);
            return 0;
          case "keobuabao":
            await handleKBBCommand(api, message, aliasCommand);
            return 0;

        }
      } else {
        await sendMessageInsufficientAuthority(api, message, "Tương tác lệnh trong tin nhắn riêng tư đã bị tắt!");
        return 0;
      }
    }

    if (numHandleCommand === 99) {
      await checkNotFindCommand(api, message, command, commandConfig);
    } else {
      await sendMessageInsufficientAuthority(api, message, "Lệnh chỉ áp dụng đối với nhóm hoặc cộng đồng!");
    }
    return 0;
  }

  return 1;
}

export async function handleCommand(
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
  const threadId = message.threadId;
  const senderId = message.data.uidFrom;
  let content = removeMention(message);
  const prefix = getGlobalPrefix();
  let numHandleCommand = -1;

  if ((content.startsWith(`${prefix}prefix`) || content.startsWith(`prefix`)) && isAdminBot) {
    return await handlePrefixCommand(api, message, threadId, isAdminLevelHighest);
  }

  if (!content.startsWith(prefix)) {
    return numHandleCommand;
  }

  let commandParts;
  let command;

  if (checkSpecialCommand(content, prefix)) {
    commandParts = content.split("_");
    command = commandParts[0].slice(prefix.length).toLowerCase();
  } else {
    commandParts = content.slice(prefix.length).trim().split(/\s+/);
    command = commandParts[0].toLowerCase();
  }

  if (HARD_DISABLED_COMMANDS.has(command)) {
    await sendMessageInsufficientAuthority(api, message, `Lệnh ${prefix}${command} hiện đã bị tắt trên bot.`);
    return 0;
  }

  if (!handleChat) return;
  const commandConfig = getCommandConfig().commands;
  let isChangeSetting = false;
  numHandleCommand = 99;

  if (typeof content === "string") {
    if (!isAdminLevelHighest && !(await checkCommandCountdown(api, message, senderId, command, lastCommandUsage))) {
      return numHandleCommand;
    }

    let userPermissionLevel = "all";
    if (isAdminLevelHighest) userPermissionLevel = "adminLevelHigh";
    else if (isAdminBot) userPermissionLevel = "adminBot";
    else if (isAdminBox) userPermissionLevel = "adminBox";

    if (!(await checkPermission(api, message, command, userPermissionLevel, true))) {
      return numHandleCommand;
    }

    const aliasCommand = command;
    const commandInfo = getCommand(command, commandConfig);
    const activeCommand = commandInfo ? commandInfo.active : true;
    if (!isAdminLevelHighest && (aliasCommand != "" && !activeCommand)) {
      return numHandleCommand;
    }
    numHandleCommand = commandInfo?.type || 99;
    command = commandInfo?.name || command;

    switch (command) {
      case "add":
      case "remove":
        await handleAdminHighLevelCommands(api, message, groupAdmins, groupSettings, isAdminLevelHighest);
        break;

      case "listadmin":
        await handleListAdmin(api, message, groupSettings);
        break;

      case "join":
        await handleJoinGroup(api, message);
        break;

      case "leave":
        await handleLeaveGroup(api, message);
        break;

      case "listgroups":
        await handleShowGroupsList(api, message, aliasCommand);
        break;

      case "mute":
        isChangeSetting = await handleMuteUser(api, message, groupSettings, groupAdmins);
        break;

      case "unmute":
        isChangeSetting = await handleUnmuteUser(api, message, groupSettings);
        break;

      case "listmute":
        await handleMuteList(api, message, groupSettings);
        break;

      case "sendtask":
        isChangeSetting = await handleSendTaskCommand(api, message, groupSettings);
        break;

      case "autosend":
        isChangeSetting = await handleAutoSendCommand(api, message, groupSettings);
        break;

      case "welcome":
      case "bye":
        isChangeSetting = await handleWelcomeBye(api, message, groupSettings);
        break;

      case "kick":
        await handleKick(api, message, groupInfo);
        break;

      case "block":
        await handleBlock(api, message, groupInfo);
        break;

      case "manager":
        await adminCommand(api, message);
        break;

      case "learn":
      case "learnnow":
      case "unlearn":
        isChangeSetting = await handleLearnCommand(api, message, groupSettings);
        break;

      case "reply":
        isChangeSetting = await handleReplyCommand(api, message, groupSettings);
        break;

      case "onlytext":
        isChangeSetting = await handleOnlyText(api, message, groupSettings);
        break;

      case "antilink":
        isChangeSetting = await handleAntiLinkCommand(api, message, groupSettings);
        break;

      case "antispam":
        isChangeSetting = await handleAntiSpamCommand(api, message, groupSettings);
        break;

      case "antibadword":
        isChangeSetting = await handleAntiBadWordCommand(api, message, groupSettings);
        break;

      case "approve":
        isChangeSetting = await handleApprove(api, message, groupSettings);
        break;

      case "keygold":
      case "keysilver":
      case "unkey":
        if (!(await checkAdminLevelHighest(api, message, isAdminLevelHighest))) return;
        isChangeSetting = await handleKeyCommands(api, message, groupSettings, isAdminLevelHighest);
        break;

      case "changelink":
        await handleChangeGroupLink(api, message);
        break;

      case "undo":
        await handleUndoMessage(api, message);
        break;

      case "todo":
        await handleSendToDo(api, message);
        break;

      case "blockbot":
        await handleBlockBot(api, message, groupSettings);
        break;

      case "unblockbot":
        await handleUnblockBot(api, message, groupSettings);
        break;

      case "listblockbot":
        await handleListBlockBot(api, message);
        break;

      case "alias":
        await handleAliasCommand(api, message, commandParts);
        break;

      case "antinude":
        isChangeSetting = await handleAntiNudeCommand(api, message, groupSettings);
        break;

      case "antianh":
        isChangeSetting = await handleAntiImageSpamCommand(api, message, groupSettings);
        break;

      case "mutegiochinh":
        isChangeSetting = await handleMuteScheduleCommand(api, message, groupSettings);
        break;

      case "antiundo":
        isChangeSetting = await handleAntiUndoCommand(api, message, groupSettings);
        break;

      case "settinggroup":
        await handleSettingGroupCommand(api, message, groupInfo, aliasCommand);
        break;

      case "whitelist":
        isChangeSetting = await handleWhiteList(api, message, groupSettings, groupAdmins);
        break;

      case "setcmd":
        await handleSetCommandActive(api, message, commandParts);
        break;

      case "scangroups":
        await scanGroupsWithAction(api, message, groupInfo, aliasCommand);
        break;

      case "deletemessage":
        await handleDeleteMessage(api, message, groupAdmins, aliasCommand);
        break;

      case "givemoney":
        if (isAdminLevelHighest || isAdminBot) {
          await handleAdminMoneyCommand(api, message, true);
        } else {
          await sendMessageInsufficientAuthority(api, message, "Chỉ Admin Bot mới có thể dùng lệnh này!");
        }
        break;

      default:
        if (numHandleCommand === 1) {
          await sendReactionConfirmReceive(api, message, numHandleCommand);
          switch (command) {
              case "group":
                await groupInfoCommand(api, message);
                break;

              case "detail":
                await getBotDetails(api, message, groupSettings);
                break;

              case "speedtest":
                await handleSpeedTestCommand(api, message);
                break;

              case "info":
                await userInfoCommand(api, message, aliasCommand);
                break;

              case "card":
                await userBussinessCardCommand(api, message, aliasCommand);
                break;

              case "help":
                await helpCommand(api, message, groupAdmins);
                break;

              case "ai":
                await handleAiCommand(api, message, aliasCommand);
                break;

              case "sticker":
                await handleStickerCommand(api, message);
                break;

              case "voice":
                await handleVoiceCommand(api, message, aliasCommand);
                break;

              case "soundcloud":
                await executeExternalCrawlCommand(api, message, "soundcloud", () => handleMusicCommand(api, message, aliasCommand));
                break;
              case "game":
                await handleGameMenuCommand(api, message);
                break;

              case "diemdanh":
                await handleDailyCommand(api, message);
                break;

              case "vi":
                await handleWalletCommand(api, message, aliasCommand);
                break;

              case "bank":
                await handleBankCommand(api, message, aliasCommand);
                break;

              case "top":
                await handleTopCommand(api, message);
                break;

              case "taixiu":
                await handleTaiXiuCommand(api, message, aliasCommand);
                break;

              case "baucua":
                await handleBauCuaCommand(api, message, aliasCommand);
                break;

              case "keobuabao":
                await handleKBBCommand(api, message, aliasCommand);
                break;

          }
        }

        if (numHandleCommand === 99) {
          await checkNotFindCommand(api, message, command, commandConfig);
        }
        break;
    }
  }

  if (isChangeSetting) {
    writeGroupSettings(groupSettings);
  }

  return numHandleCommand;
}
