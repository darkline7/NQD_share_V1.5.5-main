import { MessageMention, MessageType } from "zlbotdqt";
import axios from "axios";
import fs from "fs";
import path from "path";
import { getGlobalPrefix } from "../../service.js";
import { tempDir } from "../../../utils/io-json.js";
import { removeMention } from "../../../utils/format-util.js";
import { deleteFile, downloadFile } from "../../../utils/util.js";

// Tách các config thành map riêng
const CONFIG = {
  paths: {
    saveDir: tempDir,
  },
  download: {
    maxAttempts: 3,
    timeout: 5000,
    minSize: 1024, // 1KB
  },
  api: {
    pinterestLimit: 16
  },
  messages: {
    noQuery: (name, prefix, command) => `${name} Vui lòng nhập từ khóa tìm kiếm. Ví dụ: ${prefix}${command} con mèo`,
    searchResult: (name, query) => `[${name}] [${query}]`,
    downloadFailed: (name, attempts) => `${name} Không thể tải ảnh sau ${attempts} lần thử. Vui lòng thử lại sau.`,
    noResults: (name) => `${name} Không tìm thấy ảnh. Vui lòng thử lại sau.`,
    apiError: (name) => `${name} Gãy mẹ API rồi :(((.`,
  },
  headers: {
    pinterestOriginal: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    },
  },
};

// Hàm xử lý response từ API Pinterest gốc
async function handleOriginalPinterest(query) {
  try {
    const encodedQuery = encodeURIComponent(query);
    const searchUrl = `https://www.pinterest.com/resource/BaseSearchResource/get/`;
    
    const data = {
      options: {
        query: query,
        scope: "pins",
        auto_correction_disabled: false,
        redux_normalize_feed: true,
        rs: "typed",
        applied_unified_filters: null,
        appliedProductFilters: "---",
        filters: null,
        bookmarks: [], // Thêm bookmarks để phân trang
        field_set_key: "unauth_react", // Thêm field set key
        page_size: CONFIG.api.pinterestLimit, // Thêm số lượng kết quả mong muốn
        source_url: `/search/pins/?q=${encodedQuery}&rs=typed`
      },
      context: {}
    };

    const response = await axios({
      method: 'get',
      url: searchUrl,
      headers: {
        ...CONFIG.headers.pinterestOriginal,
        'Accept': 'application/json',
        'Referer': `https://www.pinterest.com/search/pins/?q=${encodedQuery}&rs=typed`
      },
      params: {
        source_url: `/search/pins/?q=${encodedQuery}&rs=typed`,
        data: JSON.stringify(data),
        _: Date.now()
      }
    });

    if (response.data && response.data.resource_response && response.data.resource_response.data) {
      const results = response.data.resource_response.data.results;
      
      const imageUrls = results
        .filter(pin => pin.images && (pin.images.orig || pin.images['736x'] || pin.images['474x']))
        .map(pin => {
          return (
            pin.images.orig?.url ||
            pin.images['736x']?.url ||
            pin.images['474x']?.url
          );
        })
        .filter(url => url);

      return imageUrls;
    }
    return [];
  } catch (error) {
    console.error('Lỗi Pinterest gốc:', error);
    return [];
  }
}

// Hàm download và gửi ảnh
async function downloadAndSendImage(api, message, imageUrls, query) {
  const { threadId, type } = message;
  const senderId = message.data.uidFrom;
  const senderName = message.data.dName;

  let attempts = 0;
  let success = false;

  while (attempts < CONFIG.download.maxAttempts && !success) {
    const randomIndex = Math.floor(Math.random() * imageUrls.length);
    const imageUrl = imageUrls[randomIndex];
    const tempFileName = `search_${Date.now()}.jpg`;
    const imagePath = path.join(CONFIG.paths.saveDir, tempFileName);

    try {
      await downloadFile(imageUrl, imagePath);

      const stats = fs.statSync(imagePath);
      if (stats.size < CONFIG.download.minSize) {
        throw new Error("Ảnh tải về quá nhỏ");
      }

      await api.sendMessage(
        {
          msg: CONFIG.messages.searchResult(senderName, query),
          mentions: [MessageMention(senderId, senderName.length, 1)],
          attachments: [imagePath],
        },
        threadId,
        type
      );

      success = true;
    } catch (error) {
      console.error(`Lần thử ${attempts + 1} thất bại:`, error);
      attempts++;

      if (attempts === CONFIG.download.maxAttempts) {
        await api.sendMessage(
          {
            msg: CONFIG.messages.downloadFailed(senderName, CONFIG.download.maxAttempts),
            quote: message,
            mentions: [MessageMention(senderId, senderName.length, 0)],
            ttl: 300000
          },
          threadId,
          type
        );
      }
    } finally {
      await deleteFile(imagePath);
    }
  }
  return success;
}

// Hàm chính được sửa đổi để sử dụng API source linh hoạt
export async function searchImagePinterest(api, message, command) {
  const content = removeMention(message);
  const senderId = message.data.uidFrom;
  const senderName = message.data.dName;
  const threadId = message.threadId;
  const prefix = getGlobalPrefix();

  const query = content.replace(`${prefix}${command}`, "").trim();

  if (!query) {
    await api.sendMessage(
      {
        msg: CONFIG.messages.noQuery(senderName, prefix, command),
        quote: message,
        mentions: [MessageMention(senderId, senderName.length, 0)],
      },
      threadId,
      message.type
    );
    return;
  }

  try {

    let finalImageUrls = await handleOriginalPinterest(query);

    if (finalImageUrls.length === 0) {
      await api.sendMessage(
        {
          msg: CONFIG.messages.noResults(senderName),
          quote: message,
          mentions: [MessageMention(senderId, senderName.length, 0)],
          ttl: 30000
        },
        threadId,
        message.type
      );
      return;
    }

    await downloadAndSendImage(api, message, finalImageUrls, query);
  } catch (error) {
    console.error("Lỗi khi tìm kiếm ảnh:", error);
    await api.sendMessage(
      {
        msg: CONFIG.messages.apiError(senderName),
        quote: message,
        mentions: [MessageMention(senderId, senderName.length, 0)],
      },
      threadId,
      message.type
    );
  }
}
