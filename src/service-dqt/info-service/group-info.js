import { MessageType } from "zlbotdqt";
import { createGroupInfoImage, clearImagePath } from "../../utils/canvas/index.js";
import { sendMessageWarning } from "../chat-zalo/chat-style/chat-style.js";
import { getUserInfoData } from "./user-info.js";

const groupInfoCache = new Map();
const CACHE_DURATION = 10000;
const MAX_GROUP_INFO_CACHE_SIZE = 300;
const MAX_GROUP_INFO_RETRY = 2;
const GROUP_INFO_RETRY_DELAY_MS = 700;

function pruneGroupInfoCache(now) {
  if (groupInfoCache.size <= MAX_GROUP_INFO_CACHE_SIZE) {
    return;
  }

  for (const [cacheThreadId, value] of groupInfoCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION * 20) {
      groupInfoCache.delete(cacheThreadId);
    }
  }

  while (groupInfoCache.size > MAX_GROUP_INFO_CACHE_SIZE) {
    const oldestKey = groupInfoCache.keys().next().value;
    if (!oldestKey) {
      break;
    }
    groupInfoCache.delete(oldestKey);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildFallbackGroupInfo(threadId) {
  return {
    name: `Nhóm ${threadId}`,
    memberCount: 0,
    createdTime: "",
    groupType: 0,
    memVerList: [],
    creatorId: "",
    adminIds: [],
    admins: [],
    avt: "",
    fullAvt: "",
    globalId: "",
    groupId: threadId,
    desc: "",
    setting: {},
    totalMember: 0,
  };
}

async function fetchGroupInfoWithRetry(api, threadId) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_GROUP_INFO_RETRY; attempt++) {
    try {
      return await api.getGroupInfo(threadId);
    } catch (error) {
      lastError = error;
      if (attempt < MAX_GROUP_INFO_RETRY) {
        await sleep(GROUP_INFO_RETRY_DELAY_MS * attempt);
      }
    }
  }
  throw lastError;
}

export async function groupInfoCommand(api, message) {
  const threadId = message.threadId;

  try {
    const groupInfo = await getGroupInfoData(api, threadId);
    const owner = await getUserInfoData(api, groupInfo.creatorId);
    const imagePath = await createGroupInfoImage(groupInfo, owner);
    await api.sendMessage({ msg: "", attachments: [imagePath], quote: message }, threadId, MessageType.GroupMessage);
    clearImagePath(imagePath);
  } catch (error) {
    await sendMessageWarning(api, message, "Đã xảy ra lỗi khi lấy thông tin nhóm. Vui lòng thử lại sau!");
  }
}

export async function getGroupAdmins(groupInfo) {
  try {
    const admins = groupInfo.adminIds || [];
    const creatorId = groupInfo.creatorId;

    if (creatorId && !admins.includes(creatorId)) {
      admins.push(creatorId);
    }

    return admins;
  } catch (error) {
    console.error("Lỗi khi lấy danh sách quản trị viên nhóm:", error);
    return [];
  }
}

export async function getGroupName(api, threadId) {
  try {
    const groupInfoResponse = await api.getGroupInfo(threadId);
    const groupName = groupInfoResponse.gridInfoMap[threadId].name;

    return groupName;
  } catch (error) {
    console.error("Lỗi khi lấy tên nhóm:", error);
    return [];
  }
}

export async function getGroupInfoData(api, threadId) {
  const now = Date.now();
  const cachedData = groupInfoCache.get(threadId);

  if (cachedData && (now - cachedData.timestamp) < CACHE_DURATION) {
    return cachedData.data;
  }

  try {
    const groupInfo = await fetchGroupInfoWithRetry(api, threadId);
    const processedInfo = getAllInfoGroup(groupInfo, threadId);

    groupInfoCache.set(threadId, {
      data: processedInfo,
      timestamp: now
    });
    pruneGroupInfoCache(now);

    return processedInfo;
  } catch (error) {
    if (cachedData?.data) {
      console.warn(`Dùng cache groupInfo cũ cho nhóm ${threadId} do lỗi API:`, error.message);
      return cachedData.data;
    }
    console.warn(`Không lấy được groupInfo cho nhóm ${threadId}, dùng dữ liệu mặc định:`, error.message);
    return buildFallbackGroupInfo(threadId);
  }
}

function getAllInfoGroup(groupInfo, threadId) {
  const groupData = groupInfo?.gridInfoMap?.[threadId];
  if (!groupData) {
    return buildFallbackGroupInfo(threadId);
  }

  return {
    name: groupData.name,
    memberCount: (groupData.memVerList || []).length,
    createdTime: groupData.createdTime ? new Date(groupData.createdTime).toLocaleString() : "",
    groupType: groupData.type,
    memVerList: groupData.memVerList || [],
    creatorId: groupData.creatorId,
    adminIds: groupData.adminIds || [],
    admins: groupData.admins || [],
    avt: groupData.avt,
    fullAvt: groupData.fullAvt,
    globalId: groupData.globalId,
    groupId: groupData.groupId,
    desc: groupData.desc,
    setting: groupData.setting || {},
    totalMember: groupData.totalMember || 0,
  };
}

export async function getDataAllGroup(api) {
  try {
    const allGroupsResult = await api.getAllGroups();

    if (!allGroupsResult || !allGroupsResult.gridVerMap) {
      throw new Error("Không thể lấy danh sách nhóm");
    }

    const groupIds = Object.keys(allGroupsResult.gridVerMap);

    const allGroupsInfo = await Promise.all(
      groupIds.map(async (threadId) => {
        try {
          const groupInfo = await getGroupInfoData(api, threadId);
          return groupInfo;
        } catch (error) {
          console.error(`Lỗi khi lấy thông tin nhóm ${threadId}:`, error);
          return null;
        }
      })
    );

    const validGroupsInfo = allGroupsInfo.filter((info) => info !== null);

    return validGroupsInfo;
  } catch (error) {
    console.error("Lỗi khi lấy thông tin tất cả các nhóm:", error);
    throw error;
  }
}