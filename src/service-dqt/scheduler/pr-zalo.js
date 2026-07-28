import fs from "fs";
import axios from "axios";
import path from "path";
import schedule from "node-schedule";
import chalk from "chalk";
import { MessageType } from "zlbotdqt";
import { readWebConfig, writeWebConfig } from "../../utils/io-json.js";
import { getBotId } from "../../index.js";
import { getDataAllGroup, getGroupAdmins } from "../info-service/group-info.js";
import { checkUrlStatus } from "../../utils/util.js";

const FILE_PR_PATH = path.join(process.cwd(), "assets", "web-config");
const IMAGE_PR_PATH = path.join(FILE_PR_PATH, "image-pr");
const VIDEO_PR_PATH = path.join(FILE_PR_PATH, "video-pr");

const CAPTION_CARD = "Danh Thiếp Liên Hệ";

function calculateTimeLive(currentTime, prObjects) {
  const sortedPRs = prObjects
    .flatMap((obj) => obj.thoiGianGui.map((time) => ({ time, object: obj })))
    .sort((a, b) => {
      const timeA = new Date(currentTime.toDateString() + " " + a.time);
      const timeB = new Date(currentTime.toDateString() + " " + b.time);
      return timeA - timeB;
    });

  const currentIndex = sortedPRs.findIndex(
    (pr) =>
      pr.time ===
      `${currentTime.getHours().toString().padStart(2, "0")}:${currentTime.getMinutes().toString().padStart(2, "0")}`
  );

  if (currentIndex === -1) return 0;

  const nextPRIndex = (currentIndex + 1) % sortedPRs.length;
  const nextPRTime = new Date(currentTime.toDateString() + " " + sortedPRs[nextPRIndex].time);

  if (nextPRIndex <= currentIndex) {
    nextPRTime.setDate(nextPRTime.getDate() + 1);
  }

  return nextPRTime.getTime() - currentTime.getTime();
}

async function checkAndFixAttachments(api, prObject, idZaloGroup) {
  const { hinhAnh, video, link } = prObject;
  const updatedLinks = { ...link };

  // Kiểm tra và xóa các link Không có file tương ứng
  for (const fileName in updatedLinks) {
    if (!hinhAnh.includes(fileName) && !video.includes(fileName)) {
      delete updatedLinks[fileName];
    }
  }

  // Kiểm tra và thêm link cho các file mới
  for (const imageName of hinhAnh) {
    const imagePath = path.join(IMAGE_PR_PATH, imageName);
    if (!fs.existsSync(imagePath)) {
      continue;
    }
    let imageUrl = updatedLinks[imageName];
    if (imageUrl) {
      const response = await checkUrlStatus(imageUrl);
      if (!response) {
        imageUrl = null;
      }
    }
    if (!imageUrl) {
      try {
        const uploadResult = await api.uploadAttachment([imagePath], idZaloGroup, MessageType.GroupMessage);
        if (uploadResult && uploadResult[0]) {
          updatedLinks[imageName] = uploadResult[0].fileUrl || uploadResult[0].normalUrl;
        }
      } catch (error) {
        console.error(`Lỗi khi upload ảnh ${imageName}:`, error);
      }
    }
  }

  for (const videoName of video) {
    const videoPath = path.join(VIDEO_PR_PATH, videoName);
    if (!fs.existsSync(videoPath)) {
      continue;
    }
    let videoUrl = updatedLinks[videoName];
    if (videoUrl) {
      const response = await checkUrlStatus(videoUrl);
      if (!response) {
        videoUrl = null;
      }
    }
    if (!videoUrl) {
      try {
        const uploadResult = await api.uploadAttachment([videoPath], idZaloGroup, MessageType.GroupMessage);
        if (uploadResult && uploadResult[0]) {
          updatedLinks[videoName] = uploadResult[0].fileUrl || uploadResult[0].normalUrl;
        }
      } catch (error) {
        console.error(`Lỗi khi upload video ${videoName}:`, error);
      }
    }
  }

  return updatedLinks;
}

async function sendPRMessage(api, config, prObject, ttl) {
  const { idZalo } = prObject;
  const selectedFriends = config.selectedFriends;
  const selectedGroups = config.selectedGroups;

  try {
    const defaultLinks = await checkAndFixAttachments(api, prObject, Object.keys(selectedGroups)[0]);
    let hasLinksChanged = JSON.stringify(prObject.link) !== JSON.stringify(defaultLinks);
    
    if (hasLinksChanged) {
      prObject.link = defaultLinks;
      const prIndex = config.prObjects.findIndex(pr => pr.ten === prObject.ten);
      if (prIndex !== -1) {
        config.prObjects[prIndex] = prObject;
        writeWebConfig(config);
      }
    }

    for (const groupId in selectedGroups) {
      if (selectedGroups[groupId]) {
        const customGroupContent = prObject.customContent?.[groupId];

        const tempPrObject = {
          ...prObject,
          noiDung: customGroupContent?.noiDung || prObject.noiDung,
          hinhAnh: customGroupContent?.hinhAnh || prObject.hinhAnh,
          video: customGroupContent?.video || prObject.video,
          link: defaultLinks
        };

        if (idZalo != -1) {
          try {
            await api.sendBusinessCard(null, idZalo, CAPTION_CARD, MessageType.GroupMessage, groupId, ttl);
          } catch (error) { }
        }

        if (customGroupContent) {
          const customLinks = await checkAndFixAttachments(api, tempPrObject, groupId);
          if (JSON.stringify(tempPrObject.link) !== JSON.stringify(customLinks)) {
            tempPrObject.link = customLinks;
            const prIndex = config.prObjects.findIndex(pr => pr.ten === prObject.ten);
            if (prIndex !== -1) {
              config.prObjects[prIndex].customContent[groupId] = {
                ...customGroupContent,
                link: customLinks
              };
              await writeWebConfig(config);
            }
          }
        }

        try {
          const point = (tempPrObject.hinhAnh.length > 0 ? 1 : 0) + (tempPrObject.video.length > 0 ? 2 : 0);

          if (point === 0) {
            await api.sendMessage(
              {
                msg: tempPrObject.noiDung,
                ttl: ttl,
              },
              groupId,
              MessageType.GroupMessage
            );
          } else if (point === 1) {
            if (tempPrObject.hinhAnh.length > 1) {
              let groupLayout = {
                groupLayoutId: Date.now(),
                totalItemInGroup: tempPrObject.hinhAnh.length,
                isGroupLayout: 1
              }
              for (let i = 0; i < tempPrObject.hinhAnh.length; i++) {
                let link = tempPrObject.link[tempPrObject.hinhAnh[i]];
                await api.sendImage(link,
                  {
                    type: MessageType.GroupMessage,
                    threadId: groupId,
                  },
                  null,
                  ttl,
                  {
                    ...groupLayout,
                    idInGroup: i + 1,
                  }
                );
              }
              await api.sendMessage(
                {
                  msg: tempPrObject.noiDung,
                  ttl: ttl,
                },
                groupId,
                MessageType.GroupMessage
              );
            } else {
              let link = tempPrObject.link[tempPrObject.hinhAnh[0]];
              await api.sendImage(link,
                {
                  type: MessageType.GroupMessage,
                  threadId: groupId,
                },
                tempPrObject.noiDung,
                ttl
              );
            }
          } else if (point === 2 || point === 3) {
            if (tempPrObject.hinhAnh.length > 0) {
              let groupLayout = {
                groupLayoutId: Date.now(),
                totalItemInGroup: tempPrObject.hinhAnh.length,
                isGroupLayout: 1
              }
              for (let i = 0; i < tempPrObject.hinhAnh.length; i++) {
                let link = tempPrObject.link[tempPrObject.hinhAnh[i]];
                await api.sendImage(link,
                  {
                    type: MessageType.GroupMessage,
                    threadId: groupId,
                  },
                  null,
                  ttl,
                  {
                    ...groupLayout,
                    idInGroup: i + 1,
                  }
                );
              }
            }

            for (const videoName of tempPrObject.video) {
              let videoUrl = tempPrObject.link[videoName];
              if (videoUrl) {
                try {
                  await api.sendVideo({
                    videoUrl,
                    threadId: groupId,
                    threadType: MessageType.GroupMessage,
                    message: {
                      text: tempPrObject.noiDung,
                    },
                    ttl: ttl,
                  });
                } catch (error) {
                  console.error(`Lỗi khi gửi video ${videoName}:`, error);
                }
              }
            }
          }
        } catch (error) { }
        new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    const defaultPrObject = {
      ...prObject,
      link: defaultLinks
    };

    for (const friendId in selectedFriends) {
      if (selectedFriends[friendId]) {
        if (idZalo != -1) {
          try {
            await api.sendBusinessCard(null, idZalo, CAPTION_CARD, MessageType.DirectMessage, friendId, ttl);
          } catch (error) { }
        }
        try {
          if (point === 0) {
            await api.sendMessage(
              {
                msg: defaultPrObject.noiDung,
                ttl: ttl,
              },
              friendId,
              MessageType.DirectMessage
            );
          } else if (point === 1) {
            if (defaultPrObject.hinhAnh.length > 1) {
              let groupLayout = {
                groupLayoutId: Date.now(),
                totalItemInGroup: defaultPrObject.hinhAnh.length,
                isGroupLayout: 1
              }
              for (let i = 0; i < defaultPrObject.hinhAnh.length; i++) {
                let link = defaultPrObject.link[defaultPrObject.hinhAnh[i]];
                await api.sendImage(link,
                  {
                    type: MessageType.DirectMessage,
                    threadId: friendId,
                  },
                  null,
                  ttl,
                  {
                    ...groupLayout,
                    idInGroup: i + 1,
                  }
                );
              }
              await api.sendMessage(
                {
                  msg: defaultPrObject.noiDung,
                  ttl: ttl,
                },
                friendId,
                MessageType.DirectMessage
              );
            } else {
              let link = defaultPrObject.link[defaultPrObject.hinhAnh[0]];
              await api.sendImage(link,
                {
                  type: MessageType.DirectMessage,
                  threadId: friendId,
                },
                defaultPrObject.noiDung,
                ttl
              );
            }
          } else if (point === 2 || point === 3) {
            if (defaultPrObject.hinhAnh.length > 0) {
              let groupLayout = {
                groupLayoutId: Date.now(),
                totalItemInGroup: defaultPrObject.hinhAnh.length,
                isGroupLayout: 1
              }
              for (let i = 0; i < defaultPrObject.hinhAnh.length; i++) {
                let link = defaultPrObject.link[defaultPrObject.hinhAnh[i]];
                await api.sendImage(link,
                  {
                    type: MessageType.DirectMessage,
                    threadId: friendId,
                  },
                  null,
                  ttl,
                  {
                    ...groupLayout,
                    idInGroup: i + 1,
                  }
                );
              }
            }

            for (const videoName of defaultPrObject.video) {
              let videoUrl = defaultPrObject.link[videoName];
              if (videoUrl) {
                try {
                  await api.sendVideo({
                    videoUrl,
                    threadId: friendId,
                    threadType: MessageType.DirectMessage,
                    message: {
                      text: defaultPrObject.noiDung,
                    },
                    ttl: ttl,
                  });
                } catch (error) {
                  console.error(`Lỗi khi gửi video ${videoName}:`, error);
                }
              }
            }
          }
        } catch (error) { }
      }
    }

    console.log(`Đã gửi PR thành công cho ${prObject.ten}`);
  } catch (error) {
    console.error(`Lỗi khi gửi PR cho ${prObject.ten}:`, error);
  }
}

async function schedulePR(api) {
  schedule.scheduleJob("*/1 * * * *", async function () {
    const config = await readWebConfig();
    const currentTime = new Date();
    const currentHourMinute = `${currentTime.getHours().toString().padStart(2, "0")}:${currentTime
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;

    const ttl = calculateTimeLive(currentTime, config.prObjects);

    for (const prObject of config.prObjects) {
      if (prObject.thoiGianGui.includes(currentHourMinute)) {
        await sendPRMessage(api, config, prObject, ttl);
      }
    }
    writeWebConfig(config);
  });
}

export async function initPRService(api) {
  await schedulePR(api);
  console.log(chalk.yellow("Dịch vụ PR đã khởi tạo thành công"));
}
