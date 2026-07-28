import { getCommandConfig } from "../../index.js";
import * as cv from "../../utils/canvas/index.js";
import { getGlobalPrefix } from "../../service-dqt/service.js";

const ADMIN_PERMISSIONS = new Set(["adminBox", "adminBot", "adminLevelHigh"]);

function isActiveCommand(cmd) {
  return cmd.active !== false;
}

function commandToCardRow(cmd, prefix) {
  return {
    command: cmd.syntax ? cmd.syntax.replace(/{p}/g, prefix) : `${prefix}${cmd.name}`,
    description: cmd.description || "",
    icon: cmd.icon || "🔖",
  };
}

function rowsToCardMap(commands, prefix) {
  return Object.fromEntries(
    commands.map((cmd, index) => [`cmd_${index}`, commandToCardRow(cmd, prefix)])
  );
}

function buildCommandCardContent(title, commands, prefix) {
  const allMembers = {};

  commands.forEach((cmd, index) => {
    allMembers[`cmd_${index}`] = {
      command: cmd.syntax ? cmd.syntax.replace(/{p}/g, prefix) : `${prefix}${cmd.name}`,
      description: cmd.description || "",
      icon: cmd.icon || "🔖",
    };
  });

  return {
    title,
    titleAdmin: "",
    allMembers,
    admin: {},
  };
}

async function sendCommandCards(api, message, cards) {
  for (let i = 0; i < cards.length; i++) {
    const cardPath = await cv.createInstructionsImage(cards[i], false, 900);
    await api.sendMessage(
      {
        msg: i === 0 ? `🌟 ${message.data.dName} - Danh sách lệnh 🌟` : "",
        attachments: cardPath ? [cardPath] : [],
        quote: i === 0 ? message : null,
        ttl: 180000,
      },
      message.threadId,
      message.type
    );
    await cv.clearImagePath(cardPath);
  }
}

export async function helpCommand(api, message, groupAdmins) {
  const prefix = getGlobalPrefix();
  const senderId = message.data.uidFrom;
  const threadId = message.threadId;
  const senderName = message.data.dName;
  const commandConfig = getCommandConfig();
  const memberCommands = commandConfig.commands.filter(
    (cmd) => isActiveCommand(cmd) && cmd.permission === "all"
  );

  let helpMessage = "🌟 DANH SÁCH LỆNH 🌟\n\n";
  helpMessage += "📌 Các lệnh có sẵn:\n";
  helpMessage += "╔═════════════\n";
  helpMessage += `║ 📚 ${prefix}help - Xem danh sách lệnh\n`;
  helpMessage += `║ 💰 ${prefix}info - Xem thông tin tài khoản\n`;
  helpMessage += `║ 📋 ${prefix}group - Xem thông tin nhóm\n`;
  helpMessage += "╚═════════════\n\n";

  let helpCommand = {
    title: "🌟 DANH SÁCH LỆNH 🌟",
    allMembers: rowsToCardMap(memberCommands, prefix),
    titleAdmin: "",
    admin: {},
  };

  try {
    // await api.sendMessage({ msg: helpMessage, quote: message }, threadId, message.type);
    const imagePath = await cv.createInstructionsImage(
      helpCommand,
      false,
      699
    );
    await api.sendMessage(
      {
        msg: `🌟 ${senderName} - Danh sách lệnh của tôi 🌟`,
        attachments: imagePath ? [imagePath] : [],
        mentions: [{ pos: 3, uid: senderId, len: senderName.length }],
        ttl:500000,
      },
      threadId,
      message.type
    );
    await cv.clearImagePath(imagePath);
  } catch (error) {
    console.error("Lỗi khi gửi tin nhắn trợ giúp:", error);
  }
}

export async function adminCommand(api, message) {
  const prefix = getGlobalPrefix();
  const commandConfig = getCommandConfig();
  const adminCommands = commandConfig.commands.filter(
    (cmd) => isActiveCommand(cmd) && ADMIN_PERMISSIONS.has(cmd.permission)
  );

  let commandMessage = "👮 Danh sách lệnh Admin:\n";
  commandMessage += "╔���════════\n";
  commandMessage += `║ 📋 ${prefix}listmute - Xem danh sách mute\n`;
  commandMessage += `║ 🔖 ${prefix}listadmin - xem danh sách admin bot nhóm\n`;
  commandMessage += `║ 📥 ${prefix}add/remove - thêm/xóa admin bot nhóm\n`;
  commandMessage += `║ 🚫 ${prefix}antibadword on/off - Lọc từ không phù hợp\n`;
  commandMessage += `║ 🔗 ${prefix}antilink on [domain] | allow/add/remove/show/clear | vip [domain] | test | list | off - Quản lý chặn liên kết\n`;
  commandMessage += `║ ⛔ ${prefix}antispam on/off - Chống spam\n`;
  commandMessage += `║ 🅰 ${prefix}onlytext on/off - Chỉ nhắn tin văn bản\n`;
  commandMessage += `║ 👢 ${prefix}kick @mention - Kick thành viên\n`;
  commandMessage += `║ 🔇 ${prefix}mute @mention - Mute thành viên\n`;
  commandMessage += `║ 🔊 ${prefix}unmute @mention - Unmute thành viên\n`;
  commandMessage += `║ 👋 ${prefix}welcome on/off - Chào mừng thành viên mới\n`;
  commandMessage += `║ 👋 ${prefix}bye on/off - Tạm biệt thành viên rời nhóm\n`;
  commandMessage += `║ 📢 ${prefix}all [Cụm từ cần tag all] - Chat với tất cả thành viên\n`;
  commandMessage += "╚═════════\n";

  try {
    // await api.sendMessage({ msg: commandMessage, quote: message }, threadId, message.type);
    const chunkSize = 14;
    const cards = [];
    for (let i = 0; i < adminCommands.length; i += chunkSize) {
      cards.push(
        buildCommandCardContent(
          `👮 DANH SÁCH LỆNH ADMIN ${Math.floor(i / chunkSize) + 1}`,
          adminCommands.slice(i, i + chunkSize),
          prefix
        )
      );
    }
    await sendCommandCards(api, message, cards);
  } catch (error) {
    console.error("Lỗi khi gửi tin nhắn danh sách lệnh admin:", error);
  }
}
