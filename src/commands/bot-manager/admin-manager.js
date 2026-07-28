import { writeGroupSettings } from "../../utils/io-json.js";
import { readFileSync } from 'fs';
import { join } from 'path';
import { sendMessageComplete, sendMessageInsufficientAuthority, sendMessageQuery, sendMessageWarning } from "../../service-dqt/chat-zalo/chat-style/chat-style.js";
import { getGlobalPrefix } from "../../service-dqt/service.js";
import { removeMention } from "../../utils/format-util.js";

export async function handleAdminHighLevelCommands(api, message, groupAdmins, groupSettings, isAdminLevelHighest) {
  const content = removeMention(message);
  const prefix = getGlobalPrefix();

  if (!content.includes(`${prefix}add`) && !content.includes(`${prefix}remove`)) {
    return false;
  }

  let action = null;
  if (content.includes(`${prefix}add`)) action = "add";
  if (content.includes(`${prefix}remove`)) action = "remove";

  if (!action) return false;

  if (!isAdminLevelHighest) {
    if (groupAdmins.includes(message.data.uidFrom)) {
      const caption = "Chỉ có quản trị bot cấp cao mới được sử dụng lệnh này!";
      await sendMessageInsufficientAuthority(api, message, caption);
    }
    return false;
  }

  await handleAddRemoveAdmin(api, message, groupSettings, action);
  writeGroupSettings(groupSettings);
  return true;
}

export async function handleListAdmin(api, message, groupSettings) {
  const threadId = message.threadId;
  let response = '';

  const highLevelAdmins = JSON.parse(readFileSync(join(process.cwd(), 'assets', 'data', 'list_admin.json'), 'utf8'));

  const highLevelAdminInfo = await api.getUserInfo(highLevelAdmins);

  let highLevelAdminListTxt = '';
  let index = 1;

  if (highLevelAdminInfo.unchanged_profiles && Object.keys(highLevelAdminInfo.unchanged_profiles).length > 0) {
    highLevelAdminListTxt += Object.values(highLevelAdminInfo.unchanged_profiles)
      .map(user => `${index++}. ${user.zaloName}`)
      .join('\n');
  }

  if (highLevelAdminInfo.changed_profiles && Object.keys(highLevelAdminInfo.changed_profiles).length > 0) {
    if (highLevelAdminListTxt) highLevelAdminListTxt += '\n';
    highLevelAdminListTxt += Object.values(highLevelAdminInfo.changed_profiles)
      .map(user => `${index++}. ${user.zaloName}`)
      .join('\n');
  }

  if (highLevelAdminListTxt) {
    response += `Danh sách Quản trị Cấp Cao của Bot:\n${highLevelAdminListTxt}\n\n`;
  } else {
    response += "Không thể lấy thông tin Quản trị Cấp Cao của Bot.\n\n";
  }

  if (Object.keys(groupSettings[threadId].adminList).length === 0) {
    response += "Không có quản trị viên nào được thiết lập cho nhóm này.";
  } else {
    const idAdminList = Object.keys(groupSettings[threadId].adminList).map(id => `${id}_0`);
    const adminListInfo = await api.getGroupMembers(idAdminList);
    const groupAdminListTxt = idAdminList.map((id, index) => {
      const userId = id.split('_')[0];
      const profile = adminListInfo.profiles[userId];
      return `${index + 1}. ${profile.zaloName}`;
    }).join("\n");

    response += `Danh sách quản trị viên của nhóm:\n${groupAdminListTxt}`;
  }

  await api.sendMessage(
    {
      msg: response,
      quote: message,
    },
    threadId,
    message.type
  );
}

async function handleAddRemoveAdmin(api, message, groupSettings, action) {
  const mentions = message.data.mentions;
  const threadId = message.threadId;
  const content = removeMention(message);

  if (action === "remove" && /\d+/.test(content)) {
    const indexMatch = content.match(/\d+/);
    if (indexMatch) {
      const index = parseInt(indexMatch[0]) - 1;
      const adminList = Object.entries(groupSettings[threadId].adminList);

      if (index >= 0 && index < adminList.length) {
        const [targetId, targetName] = adminList[index];
        delete groupSettings[threadId]["adminList"][targetId];
        await sendMessageComplete(api, message, `Đã xóa ${targetName} khỏi danh sách quản trị bot của nhóm này.`);
        return;
      } else {
        await sendMessageWarning(api, message, `Số thứ tự Không hợp lệ. Vui lòng kiểm tra lại danh sách quản trị viên.`);
        return;
      }
    }
  }

  if (!mentions || mentions.length === 0) {
    const caption = "Vui lòng đề cập (@mention) người dùng cần thêm/xóa khỏi danh sách quản trị bot.";
    await sendMessageQuery(api, message, caption);
    return;
  }

  for (const mention of mentions) {
    const targetId = mention.uid;
    const targetName = message.data.content.substring(mention.pos, mention.pos + mention.len).replace("@", "");

    switch (action) {
      case "add":
        if (!groupSettings[threadId]["adminList"][targetId]) {
          groupSettings[threadId]["adminList"][targetId] = targetName;
          await sendMessageComplete(api, message, `Đã thêm ${targetName} vào danh sách quản trị bot của nhóm này.`);
        } else {
          await sendMessageWarning(api, message, `${targetName} đã có trong danh sách quản trị bot của nhóm này.`);
        }
        break;
      case "remove":
        if (groupSettings[threadId]["adminList"][targetId]) {
          delete groupSettings[threadId]["adminList"][targetId];
          await sendMessageComplete(api, message, `Đã xóa ${targetName} khỏi danh sách quản trị bot của nhóm này.`);
        } else {
          await sendMessageWarning(api, message, `${targetName} Không có trong danh sách quản trị bot của nhóm này.`);
        }
        break;
    }
  }
}
