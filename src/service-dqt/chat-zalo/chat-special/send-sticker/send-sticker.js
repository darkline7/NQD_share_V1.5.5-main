import axios from "axios";
import fs from "fs";
import path from "path";
import { getGlobalPrefix } from "../../../service.js";
import { checkExstentionFileRemote, deleteFile, downloadFile, execAsync } from "../../../../utils/util.js";
import { MessageMention } from "../../../../api-zalo/index.js";
import { tempDir } from "../../../../utils/io-json.js";
import { removeMention } from "../../../../utils/format-util.js";
import { getVideoMetadata } from "../../../../api-zalo/utils.js";
import { isAdmin } from "../../../../index.js";
import { convertToWebp } from "./create-webp.js";
import { removeBackground } from "../../../utilities/remove-background.js";

/**
 * Kiểm tra URL có phải là media hợp lệ Không
 */
async function isValidMediaUrl(url) {
  try {
    const ext = await checkExstentionFileRemote(url);
    if (!ext) {
      return {
        isValid: false,
        isVideo: false,
      };
    }
    if (ext === "mp4" || ext === "mov" || ext === "webm") {
      return {
        isValid: true,
        isVideo: true,
      };
    } else if (ext === "png" || ext === "jpg" || ext === "jpeg" || ext === "gif" || ext === "webp") {
      return {
        isValid: true,
        isVideo: false,
      };
    } else {
      return {
        isValid: false,
        isVideo: false,
      };
    }
  } catch (error) {
    console.error("Lỗi khi kiểm tra URL:", error);
    return {
      isValid: false,
      isVideo: false,
    };
  }
}

function normalizeStickerErrorMessage(error) {
  const message = error?.message || "Lỗi không xác định";
  if (message.toLowerCase().includes("cannot find ffmpeg")) {
    return "Máy chủ chưa cài ffmpeg nên chưa tạo được sticker. Cài ffmpeg và thêm vào PATH rồi thử lại.";
  }
  return message;
}

/**
 * Xử lý tạo và gửi sticker từ URL hoặc local path
 */
async function processAndSendSticker(api, message, mediaSource) {
  const senderName = message.data.dName;
  const senderId = message.data.uidFrom;
  let pathSticker = path.join(tempDir, `sticker_${Date.now()}.templink`);
  let pathWebp = path.join(tempDir, `sticker_${Date.now()}.webp`);
  let isLocalFile = false;

  try {
    try {
      await fs.promises.access(mediaSource);
      isLocalFile = true;
    } catch {
      isLocalFile = false;
    }

    if (!isLocalFile) {
      const ext = await checkExstentionFileRemote(mediaSource);
      pathSticker = path.join(tempDir, `sticker_${Date.now()}.${ext}`);
      await downloadFile(mediaSource, pathSticker);
    } else {
      pathSticker = mediaSource;
    }

    await convertToWebp(pathSticker, pathWebp);
    const linkUploadZalo = await api.uploadAttachment([pathWebp], message.threadId, message.type);

    const stickerData = await getVideoMetadata(pathSticker);
    const finalUrl = linkUploadZalo[0].fileUrl || linkUploadZalo[0].normalUrl;

    await api.sendMessage(
      {
        msg: `${senderName} Sticker của bạn đây!`,
        quote: message,
        mentions: [MessageMention(senderId, senderName.length, 0)],
        ttl: 300000,
      },
      message.threadId,
      message.type
    );

    await api.sendCustomSticker(
      message,
      finalUrl,
      finalUrl,
      stickerData.width,
      stickerData.height
    );

    return true;
  } catch (error) {
    console.error("Lỗi khi xử lý sticker:", error);
    throw error;
  } finally {
    await deleteFile(pathSticker);
    await deleteFile(pathWebp);
  }
}

/**
 * Xử lý lệnh tạo sticker
 */
export async function handleStickerCommand(api, message) {
  const quote = message.data.quote;
  const senderName = message.data.dName;
  const senderId = message.data.uidFrom;
  const threadId = message.threadId;
  const isAdminLevelHighest = isAdmin(senderId);
  const isAdminBot = isAdmin(senderId, threadId);
  const content = removeMention(message);
  const prefix = getGlobalPrefix();
  const tempPath = path.join(tempDir, `sticker_${Date.now()}.png`);

  if (!quote) {
    await api.sendMessage(
      {
        msg: `${senderName}, Hãy reply vào tin nhắn chứa ảnh hoặc video cần tạo sticker và dùng lại lệnh ${prefix}sticker.`,
        quote: message,
        mentions: [MessageMention(senderId, senderName.length, 0)],
        ttl: 30000,
      },
      message.threadId,
      message.type
    );
    return;
  }

  const attach = quote.attach;
  if (!attach) {
    await api.sendMessage(
      {
        msg: `${senderName}, Không có đính kèm nào trong nội dung reply của bạn.`,
        quote: message,
        mentions: [MessageMention(senderId, senderName.length, 0)],
        ttl: 30000,
      },
      message.threadId,
      message.type
    );
    return;
  }

  try {
    const attachData = JSON.parse(attach);
    const mediaUrl = attachData.hdUrl || attachData.href;

    if (!mediaUrl) {
      await api.sendMessage(
        {
          msg: `${senderName}, Không tìm thấy URL trong đính kèm của tin nhắn bạn đã reply.`,
          quote: message,
          mentions: [MessageMention(senderId, senderName.length, 0)],
          ttl: 30000,
        },
        message.threadId,
        message.type
      );
      return;
    }

    const decodedUrl = decodeURIComponent(mediaUrl.replace(/\\\//g, "/"));

    const mediaCheck = await isValidMediaUrl(decodedUrl);
    if (!mediaCheck.isValid) {
      console.error("URL Không hợp lệ:", decodedUrl);
      await api.sendMessage(
        {
          msg: `${senderName}, URL trong tin nhắn bạn reply Không phải là ảnh, GIF hoặc video hợp lệ.`,
          quote: message,
          mentions: [MessageMention(senderId, senderName.length, 0)],
          ttl: 30000,
        },
        message.threadId,
        message.type
      );
      return;
    }

    const isVideo = mediaCheck.isVideo;
    const isXoaPhong = content.includes("xp");

    if (isXoaPhong && isVideo) {
      await api.sendMessage(
        {
          msg: `${senderName} Chưa hỗ trợ xóa phong cho sticker video!`,
          quote: message,
          mentions: [MessageMention(senderId, senderName.length, 0)],
          ttl: 6000,
        },
        message.threadId,
        message.type
      );
      return;
    }

    if (!isAdminBot && mediaCheck.isVideo) {
      await api.sendMessage(
        {
          msg: `${senderName}, Đại ca tao Không cho phép thành viên tạo sticker video.`,
          quote: message,
          mentions: [MessageMention(senderId, senderName.length, 0)],
          ttl: 30000,
        },
        message.threadId,
        message.type
      );
      return;
    }

    await api.sendMessage(
      {
        msg: `${senderName} Ok, đang tạo sticker, chờ bố một chút!`,
        quote: message,
        mentions: [MessageMention(senderId, senderName.length, 0)],
        ttl: 6000,
      },
      message.threadId,
      message.type
    );

    if (isXoaPhong) {
      const imageData = await removeBackground(decodedUrl);
      if (!imageData) {
        await api.sendMessage(
          {
            msg: `${senderName}, Ựa, xóa phông lỗi hoặc hết cụ mịa ròi.`,
            quote: message,
            mentions: [MessageMention(senderId, senderName.length, 0)],
            ttl: 30000,
          },
          message.threadId,
          message.type
        );
        return;
      }
      fs.writeFileSync(tempPath, imageData);
      await processAndSendSticker(api, message, tempPath);
    } else {
      await processAndSendSticker(api, message, decodedUrl);
    }
  } catch (error) {
    console.error("Lỗi khi xử lý lệnh sticker:", error);
    const detailMessage = normalizeStickerErrorMessage(error);
    await api.sendMessage(
      {
        msg: `${senderName} Lỗi Khi Xử Lý Lệnh Sticker -> ${detailMessage}`,
        quote: message,
        mentions: [MessageMention(senderId, senderName.length, 0)],
        ttl: 30000,
      },
      message.threadId,
      message.type
    );
  } finally {
    await deleteFile(tempPath);
  }
}
