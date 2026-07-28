import { LRUCache } from 'lru-cache';
import { removeMention } from "../../utils/format-util.js";
import { getMessageCacheByMsgId } from "../../utils/message-cache.js";
import { getBotId, isAdmin } from "../../index.js";
import { handleSendTrackSoundCloud } from "./music/soundcloud.js";

const TIME_TO_SELECT = 60000;
export const selectionsMapData = new LRUCache({
  max: 500,
  ttl: TIME_TO_SELECT
});

export const getSelectionsMapData = () => selectionsMapData;
export function setSelectionsMapData(idUser, data) {
  deleteSelectionsMapData(idUser);
  selectionsMapData.set(idUser, { ...data });
};
export function deleteSelectionsMapData(idUser) {
  if (selectionsMapData.has(idUser)) {
    selectionsMapData.delete(idUser);
  }
}
export async function checkReplySelectionsMapData(api, message) {
  const senderId = message.data.uidFrom;
  const isAdminLevelHighest = isAdmin(senderId);
  if (message.data?.quote) return false;
  if (selectionsMapData.has(senderId)) {
    const data = selectionsMapData.get(senderId);
    let selection = removeMention(message);
    let [selectedIndex, subCommand] = selection.split(" ");
    selectedIndex = parseInt(selectedIndex) - 1;
    if (isNaN(selectedIndex)) {
      return false;
    }
    const { collection, quotedMsgId } = data;
    if (selectedIndex < 0 || selectedIndex >= collection.length) {
      return false;
    }
    const media = collection[selectedIndex];
    if (!isAdminLevelHighest && media.duration && media.duration > 30 * 60 * 1000) {
      const object = {
        caption: `Thời lượng của lựa chọn bạn chọn vượt quá thời gian tin nhắn tồn tại, vui lòng chọn lựa chọn khác.`,
      };
      await sendMessageWarningRequest(api, message, object, 30000);
      return true;
    }
    deleteSelectionsMapData(senderId);
    const cacheMessage = getMessageCacheByMsgId(quotedMsgId);
    if (cacheMessage) {
      const msgDel = {
        type: cacheMessage.type,
        threadId: cacheMessage.threadId,
        data: {
          cliMsgId: cacheMessage.cliMsgId,
          msgId: cacheMessage.msgId,
          uidFrom: getBotId(),
        },
      };
      await api.deleteMessage(msgDel, false);
    }
    switch (data.platform) {
      case "soundcloud":
        return await handleSendTrackSoundCloud(api, message, media);
    }
  }
  return false;
};
