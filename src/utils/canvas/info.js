import { createCanvas, loadImage } from "canvas";
import fs from "fs";
import path from "path";
import * as cv from "./index.js";
import { formatCurrency } from "../format-util.js";

export function hanldeNameUser(name) {
  const words = name.split(" ");
  let line1 = "";
  let line2 = "";

  if (name.length <= 16) {
    return [name, ""];
  }

  if (words.length === 1) {
    line1 = name.substring(0, 16);
    line2 = name.substring(16);
  } else {
    for (let i = 0; i < words.length; i++) {
      if ((line1 + " " + words[i]).trim().length <= 16) {
        line1 += (line1 ? " " : "") + words[i];
      } else {
        line2 = words.slice(i).join(" ");
        break;
      }
    }
  }

  return [line1.trim(), line2.trim()];
}

export function handleNameLong(name, lengthLine = 16) {
  const words = name.split(" ");
  const lines = [];
  let currentLine = "";

  for (const word of words) {
    if ((currentLine + " " + word).trim().length <= lengthLine) {
      currentLine += (currentLine ? " " : "") + word;
    } else {
      if (currentLine) {
        lines.push(currentLine.trim());
      }
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine.trim());
  }

  if (lines.length === 0) {
    lines.push(name);
  }

  return {
    lines: lines,
    totalLines: lines.length,
  };
}

export async function createUserInfoImage(userInfo) {
  const [nameLine1, nameLine2] = hanldeNameUser(userInfo.name);
  const width = 1000;
  let yTemp = 400;
  const lineBio = 35;

  if (userInfo.bio !== "Không có thông tin bio") {
    const bioLines = [...userInfo.bio.split("\n")];
    const lineHeight = lineBio;
    yTemp += 20;

    bioLines.forEach((line, index) => {
      const { lines, totalLines } = handleNameLong(line, 56);
      yTemp += lineHeight * totalLines;
    });
  }

  yTemp += 30;
  const height = yTemp > 430 ? yTemp : 430;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  if (userInfo.cover && cv.isValidUrl(userInfo.cover)) {
    try {
      const cover = await loadImage(userInfo.cover);
      ctx.drawImage(cover, 0, 0, width, height);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, width, height);

    } catch (error) {
      console.error("Lỗi load cover:", error);
      const backgroundGradient = ctx.createLinearGradient(0, 0, 0, height);
      backgroundGradient.addColorStop(0, "#3B82F6");
      backgroundGradient.addColorStop(1, "#111827");
      ctx.fillStyle = backgroundGradient;
      ctx.fillRect(0, 0, width, height);
    }
  } else {
    const backgroundGradient = ctx.createLinearGradient(0, 0, 0, height);
    backgroundGradient.addColorStop(0, "#3B82F6");
    backgroundGradient.addColorStop(1, "#111827");
    ctx.fillStyle = backgroundGradient;
    ctx.fillRect(0, 0, width, height);
  }

  let xAvatar = 170;
  let widthAvatar = 180;
  let heightAvatar = 180;
  let yAvatar = 100;
  let yA1 = height / 2 - heightAvatar / 2 - yAvatar;

  if (userInfo && cv.isValidUrl(userInfo.avatar)) {
    try {
      const avatar = await loadImage(userInfo.avatar);

      const borderWidth = 10;
      const gradient = ctx.createLinearGradient(
        xAvatar - widthAvatar / 2 - borderWidth,
        yAvatar - borderWidth,
        xAvatar + widthAvatar / 2 + borderWidth,
        yAvatar + heightAvatar + borderWidth
      );

      const rainbowColors = [
        "#FF0000",
        "#FF7F00",
        "#FFFF00",
        "#00FF00",
        "#0000FF",
        "#4B0082",
        "#9400D3",
      ];

      const shuffledColors = [...rainbowColors].sort(() => Math.random() - 0.5);

      shuffledColors.forEach((color, index) => {
        gradient.addColorStop(index / (shuffledColors.length - 1), color);
      });

      ctx.save();
      ctx.beginPath();
      ctx.arc(
        xAvatar,
        yAvatar + heightAvatar / 2,
        widthAvatar / 2 + borderWidth,
        0,
        Math.PI * 2,
        true
      );
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(
        xAvatar,
        yAvatar + heightAvatar / 2,
        widthAvatar / 2,
        0,
        Math.PI * 2,
        true
      );
      ctx.clip();
      ctx.drawImage(
        avatar,
        xAvatar - widthAvatar / 2,
        yAvatar,
        widthAvatar,
        heightAvatar
      );
      ctx.restore();

      const dotSize = 26;
      const dotX = xAvatar + widthAvatar / 2 - dotSize / 2;
      const dotY = yAvatar + heightAvatar - dotSize / 2;
      ctx.beginPath();
      ctx.arc(dotX, dotY, dotSize / 2, 0, Math.PI * 2);
      if (userInfo.isOnline) {
        ctx.fillStyle = "#00FF00";
      } else {
        ctx.fillStyle = "#808080";
      }
      ctx.fill();
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.font = "bold 32px Tahoma";
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      const nameY = yAvatar + heightAvatar + 54;
      if (nameLine2) {
        ctx.font = "bold 24px Tahoma";
        ctx.fillText(nameLine1, xAvatar, nameY);
        ctx.font = "bold 24px Tahoma";
        ctx.fillText(nameLine2, xAvatar, nameY + 28);
      } else {
        ctx.fillText(nameLine1, xAvatar, nameY);
      }

      const iconSize = 24;
      const iconSpacing = 10;
      const icons = [];

      if (userInfo.isActive) icons.push("📱");
      if (userInfo.isActivePC) icons.push("💻");
      if (userInfo.isActiveWeb) icons.push("🌐");

      const totalWidth =
        icons.length * iconSize + (icons.length - 1) * iconSpacing;
      const iconsY = nameY + (nameLine2 ? 68 : 40);

      ctx.font = `${iconSize}px Arial`;
      icons.forEach((icon, index) => {
        const x =
          xAvatar + (index - (icons.length - 1) / 2) * (iconSize + iconSpacing);
        ctx.fillText(icon, x, iconsY);
      });
    } catch (error) {
      console.error("Lỗi load avatar:", error);
    }
  }

  let y1 = 60;

  ctx.textAlign = "center";
  ctx.font = "bold 48px BeVietnamPro";
  ctx.fillStyle = cv.getRandomGradient(ctx, width);
  ctx.fillText(userInfo.title, width / 2, y1);

  const infoStartX = xAvatar + widthAvatar / 2 + 86;

  ctx.textAlign = "left";
  let y = y1 + 60;

  const fields = [
    { label: "🆔 Username", value: userInfo.username },
    { label: "🎂 Ngày sinh", value: userInfo.birthday },
    { label: "🧑‍🤝‍🧑 Giới tính", value: userInfo.gender },
    { label: "💼 Tài khoản Business", value: userInfo.businessType },
    { label: "📅 Ngày tạo tài khoản", value: userInfo.createdDate },
    { label: "🕰️ Lần cuối hoạt động", value: userInfo.lastActive },
  ];

  ctx.font = "bold 28px BeVietnamPro";
  for (const field of fields) {
    ctx.fillStyle = cv.getRandomGradient(ctx, width);
    const labelText = field.label + ":";
    const labelWidth = ctx.measureText(labelText).width;
    ctx.fillText(labelText, infoStartX, y);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(" " + field.value, infoStartX + labelWidth, y);
    y += 52;
  }

  if (userInfo.bio !== "Không có thông tin bio") {
    ctx.textAlign = "center";

    ctx.beginPath();
    ctx.moveTo(width * 0.05, y - 20);
    ctx.lineTo(width * 0.95, y - 20);
    ctx.strokeStyle = "rgba(255, 255, 255)";
    ctx.lineWidth = 2;
    ctx.stroke();

    y += 25;
    const bioLines = [...userInfo.bio.split("\n")];

    bioLines.forEach((line, index) => {
      const { lines } = handleNameLong(line, 56);
      for (const line of lines) {
        const lineGradient = cv.getRandomGradient(ctx, width);
        ctx.fillStyle = lineGradient;

        ctx.fillText(line, width / 2, y);
        y += lineBio;
      }
    });
  }

  const filePath = path.resolve(`./assets/temp/user_info_${Date.now()}.png`);
  const out = fs.createWriteStream(filePath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);
  return new Promise((resolve, reject) => {
    out.on("finish", () => resolve(filePath));
    out.on("error", reject);
  });
}

export async function createUserCardGame(playerInfo) {
  const [nameLine1, nameLine2] = cv.hanldeNameUser(playerInfo.playerName);
  const width = 1080;

  const height = 535;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  cv.drawDynamicGradientBackground(ctx, width, height);
  cv.drawAnimatedBackground(ctx, width, height);

  let xAvatar = 180;
  let widthAvatar = 180;
  let heightAvatar = 180;
  let yAvatar = 100;
  let yA1 = height / 2 - heightAvatar / 2 - yAvatar;

  if (playerInfo && cv.isValidUrl(playerInfo.avatar)) {
    try {
      const avatar = await loadImage(playerInfo.avatar);

      const borderWidth = 10;
      const gradient = ctx.createLinearGradient(
        xAvatar - widthAvatar / 2 - borderWidth,
        yAvatar - borderWidth,
        xAvatar + widthAvatar / 2 + borderWidth,
        yAvatar + heightAvatar + borderWidth
      );

      const rainbowColors = [
        "#FF0000",
        "#FF7F00",
        "#FFFF00",
        "#00FF00",
        "#0000FF",
        "#4B0082",
        "#9400D3",
      ];

      const shuffledColors = [...rainbowColors].sort(() => Math.random() - 0.5);

      shuffledColors.forEach((color, index) => {
        gradient.addColorStop(index / (shuffledColors.length - 1), color);
      });

      ctx.save();
      ctx.beginPath();
      ctx.arc(
        xAvatar,
        yAvatar + heightAvatar / 2,
        widthAvatar / 2 + borderWidth,
        0,
        Math.PI * 2,
        true
      );
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.shadowColor = "rgba(255, 255, 255, 0.5)";
      ctx.shadowBlur = 20;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      ctx.beginPath();
      ctx.arc(
        xAvatar,
        yAvatar + heightAvatar / 2,
        widthAvatar / 2,
        0,
        Math.PI * 2,
        true
      );
      ctx.clip();
      ctx.drawImage(
        avatar,
        xAvatar - widthAvatar / 2,
        yAvatar,
        widthAvatar,
        heightAvatar
      );
      ctx.restore();

      ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
      ctx.shadowBlur = 20;
      ctx.shadowOffsetX = 5;
      ctx.shadowOffsetY = 5;

      const dotSize = 26;
      const dotX = xAvatar + widthAvatar / 2 - dotSize / 2;
      const dotY = yAvatar + heightAvatar - dotSize / 2;
      ctx.beginPath();
      ctx.arc(dotX, dotY, dotSize / 2, 0, Math.PI * 2);
      if (playerInfo.isOnline) {
        ctx.fillStyle = "#00FF00";
      } else {
        ctx.fillStyle = "#808080";
      }
      ctx.fill();
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.font = "bold 32px Tahoma";
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      const nameY = yAvatar + heightAvatar + 54;
      if (nameLine2) {
        ctx.font = "bold 24px Tahoma";
        ctx.fillText(nameLine1, xAvatar, nameY);
        ctx.font = "bold 24px Tahoma";
        ctx.fillText(nameLine2, xAvatar, nameY + 28);
      } else {
        ctx.fillText(nameLine1, xAvatar, nameY);
      }

      const nameGradient = ctx.createLinearGradient(
        xAvatar,
        nameY,
        xAvatar,
        nameY + 30
      );
      nameGradient.addColorStop(0, "#ff4b1f");
      nameGradient.addColorStop(1, "#1fddff");
      ctx.fillStyle = nameGradient;

      ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
      ctx.shadowBlur = 20;
      ctx.shadowOffsetX = 5;
      ctx.shadowOffsetY = 5;

      const iconSize = 24;
      const iconSpacing = 10;
      const icons = [];

      if (playerInfo.isActive) icons.push("📱");
      if (playerInfo.isActivePC) icons.push("💻");
      if (playerInfo.isActiveWeb) icons.push("🌐");
      const iconsY = nameY + (nameLine2 ? 68 : 40);

      ctx.font = `${iconSize}px Arial`;
      icons.forEach((icon, index) => {
        const x =
          xAvatar + (index - (icons.length - 1) / 2) * (iconSize + iconSpacing);
        ctx.fillText(icon, x, iconsY);
      });
    } catch (error) {
      console.error("Lỗi load avatar:", error);
    }
  }

  let y1 = 60;

  ctx.textAlign = "center";
  ctx.font = "bold 48px Tahoma";
  ctx.fillStyle = cv.getRandomGradient(ctx, width);
  ctx.fillText(playerInfo.title, width / 2, y1);

  const nameWidth = ctx.measureText(nameLine1).width;
  const infoStartX = Math.max(
    xAvatar + widthAvatar / 2 + 60,
    xAvatar + nameWidth / 2 - 20
  );

  ctx.textAlign = "left";
  let y = y1 + 45;

  const fields = [
    { label: "🆔 Tên Đăng Nhập", value: playerInfo.account },
    {
      label: "💰 Số Dư Hiện Tại",
      value: formatCurrency(playerInfo.balance) + " VNĐ",
    },
    {
      label: "🏆 Tổng Thắng",
      value: formatCurrency(playerInfo.totalWinnings) + " VNĐ",
    },
    {
      label: "💸 Tổng Thua",
      value: formatCurrency(playerInfo.totalLosses) + " VNĐ",
    },
    {
      label: "💹 Lợi Nhuận Ròng",
      value: formatCurrency(playerInfo.netProfit) + " VNĐ",
    },
    {
      label: "🎮 Số Lượt Chơi",
      value:
        playerInfo.totalGames +
        " Games " +
        "(" +
        playerInfo.totalWinGames +
        "W/" +
        (playerInfo.totalGames - playerInfo.totalWinGames) +
        "L)",
    },
    { label: "📊 Tỉ Lệ Thắng", value: playerInfo.winRate + "%" },
    { label: "📅 Created Time", value: playerInfo.registrationTime },
    { label: "🎁 Nhận Quà Daily", value: playerInfo.lastDailyReward },
  ];

  ctx.font = "bold 28px Tahoma";
  for (const field of fields) {
    ctx.fillStyle = cv.getRandomGradient(ctx, width);
    const labelText = field.label + ":";
    const labelWidth = ctx.measureText(labelText).width;
    ctx.fillText(labelText, infoStartX, y);

    if (field.label === "📊 Tỉ Lệ Thắng") {
      const barWidth = 200;
      const winRate = parseFloat(field.value);
      const filledWidth = (winRate / 100) * barWidth;

      const barGradient = ctx.createLinearGradient(
        infoStartX + labelWidth,
        y - 20,
        infoStartX + labelWidth + barWidth,
        y
      );
      barGradient.addColorStop(0, "#b8e994");
      barGradient.addColorStop(0.5, "#96e6a1");
      barGradient.addColorStop(1, "#b8e994");

      ctx.fillStyle = "#ddd";
      cv.roundRect(
        ctx,
        infoStartX + labelWidth + 20,
        y - 20,
        barWidth,
        20,
        5,
        true,
        false
      );

      ctx.fillStyle = barGradient;
      cv.roundRect(
        ctx,
        infoStartX + labelWidth + 20,
        y - 20,
        filledWidth,
        20,
        5,
        true,
        false
      );

      ctx.fillStyle = "#fff";
      ctx.fillText(field.value, infoStartX + labelWidth + 30 + barWidth + 5, y);
    } else {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(" " + field.value, infoStartX + labelWidth, y);
    }

    y += 42;
  }

  ctx.beginPath();
  ctx.moveTo(width * 0.05, y - 20);
  ctx.lineTo(width * 0.95, y - 20);
  ctx.strokeStyle = "white";
  ctx.lineWidth = 2;
  ctx.stroke();
  y += 20;

  ctx.font = "bold 28px Tahoma";
  ctx.fillStyle = cv.getRandomGradient(ctx, width);
  ctx.textAlign = "center";
  ctx.fillText("Chúc Bạn 8386 | Mãi Đỉnh Mãi Đỉnh", width / 2, y);

  const filePath = path.resolve(`./assets/temp/user_info_${Date.now()}.png`);
  const out = fs.createWriteStream(filePath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);
  return new Promise((resolve, reject) => {
    out.on("finish", () => resolve(filePath));
    out.on("error", reject);
  });
}

export async function createBotInfoImage(
  botInfo,
  uptime,
  botStats,
  onConfigs,
  offConfigs
) {
  const width = 1000;
  let yTemp = 86;

  const maxConfigCount = Math.max(onConfigs.length, offConfigs.length);

  let fields = [
    { label: "Phiên bản vận hành", value: botStats.version },
    { label: "Bộ nhớ bot sử dụng", value: botStats.memoryUsage },
    { label: "Hệ điều hành", value: botStats.os },
    { label: "CPU Model", value: botStats.cpuModel },
    { label: "CPU Usage", value: botStats.cpu },
    { label: "CPU Temp", value: botStats.cpuTemp },
    { label: "RAM Usage", value: botStats.ram },
    { label: "Disk Usage", value: botStats.disk },
    { label: "Bot V1.5.5 Share By", value: "Thanh Bình" },
  ];
  fields = fields.filter(field => field.value !== undefined);
  yTemp += 90;
  yTemp += 42 * fields.length;
  yTemp += 12;
  let spaceConfig = yTemp;
  if (onConfigs.length > 0 || offConfigs.length > 0) {
    yTemp += 12;
    yTemp += 46;
    yTemp += maxConfigCount * 40;
  }

  const height = yTemp;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  if (botInfo && cv.isValidUrl(botInfo.avatar)) {
    try {
      const avatar = await loadImage(botInfo.avatar);
      
      const scale = Math.max(width / avatar.width, height / avatar.height);
      const scaledWidth = avatar.width * scale;
      const scaledHeight = avatar.height * scale;
      const x = (width - scaledWidth) / 2;
      const y = (height - scaledHeight) / 2;
      
      ctx.drawImage(avatar, x, y, scaledWidth, scaledHeight);
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, width, height);
    } catch (error) {
      console.error("Lỗi load avatar background:", error);
      const backgroundGradient = ctx.createLinearGradient(0, 0, 0, height);
      backgroundGradient.addColorStop(0, "#2C3E50");
      backgroundGradient.addColorStop(1, "#2C3E50");
      ctx.fillStyle = backgroundGradient;
      ctx.fillRect(0, 0, width, height);
    }
  } else {
    const backgroundGradient = ctx.createLinearGradient(0, 0, 0, height);
    backgroundGradient.addColorStop(0, "#2C3E50");
    backgroundGradient.addColorStop(1, "#2C3E50");
    ctx.fillStyle = backgroundGradient;
    ctx.fillRect(0, 0, width, height);
  }

  const metallicGradient = ctx.createLinearGradient(0, 0, width, height);
  metallicGradient.addColorStop(0, "rgba(255, 255, 255, 0.05)");
  metallicGradient.addColorStop(0.5, "rgba(255, 255, 255, 0.1)");
  metallicGradient.addColorStop(1, "rgba(255, 255, 255, 0.05)");
  ctx.fillStyle = metallicGradient;
  ctx.fillRect(0, 0, width, height);

  let y1 = 60;

  ctx.textAlign = "center";
  ctx.font = "bold 48px Tahoma";
  ctx.fillStyle = cv.getRandomGradient(ctx, width);
  ctx.fillText(botInfo.name, width / 2, y1);

  let y = y1 + 60;
  ctx.font = "bold 28px Tahoma";

  let xCenter = width / 2;

  ctx.textAlign = "center";
  ctx.fillStyle = cv.getRandomGradient(ctx, width);
  const labelText = "⏱️ Thời gian hoạt động";
  ctx.fillText(labelText, xCenter, y);
  y += 42;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(uptime, xCenter, y);
  y += 42;

  for (const field of fields) {
    ctx.fillStyle = cv.getRandomGradient(ctx, width);
    const labelText = field.label + ":";
    const labelWidth = ctx.measureText(labelText).width;
    const valueText = field.value;
    const valueWidth = ctx.measureText(valueText).width;
    const totalWidth = labelWidth + ctx.measureText(" ").width + valueWidth;
    
    const startX = xCenter - totalWidth / 2;
    ctx.textAlign = "left";
    ctx.fillText(labelText, startX, y);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(" " + valueText, startX + labelWidth, y);
    y += 42;
  }

  if (onConfigs.length > 0 || offConfigs.length > 0) {
    let endY1 = spaceConfig;

    ctx.beginPath();
    ctx.moveTo(width * 0.05, endY1);
    ctx.lineTo(width * 0.95, endY1);
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.stroke();

    endY1 += 40;

    ctx.textAlign = "center";
    ctx.font = "bold 32px Tahoma";
    ctx.fillStyle = cv.getRandomGradient(ctx, width);
    ctx.fillText("📊 Cấu hình hiện tại trong nhóm:", xCenter, endY1);
    endY1 += 40;

    const leftColumnX = width * 0.25;
    const rightColumnX = width * 0.75;
    let leftY = endY1;
    let rightY = endY1;

    ctx.font = "bold 24px Tahoma";

    if (onConfigs.length === 0 && offConfigs.length > 0) {
      ctx.textAlign = "center";
      ctx.fillStyle = "#FF6B6B";
      ctx.fillText("Tất cả cấu hình đang tắt:", xCenter, endY1);
      endY1 += 35;
      offConfigs.forEach((line) => {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(line, xCenter, endY1);
        endY1 += 35;
      });
    } else if (offConfigs.length === 0 && onConfigs.length > 0) {
      ctx.textAlign = "center";
      ctx.fillStyle = "#4ECB71";
      ctx.fillText("Tất cả cấu hình đang bật:", xCenter, endY1);
      endY1 += 35;
      onConfigs.forEach((line) => {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(line, xCenter, endY1);
        endY1 += 35;
      });
    } else {
      if (offConfigs.length > 0) {
        ctx.fillStyle = "#FF6B6B";
        ctx.fillText("Cấu hình đang tắt:", leftColumnX, leftY);
        leftY += 35;
        offConfigs.forEach((line) => {
          ctx.fillStyle = "#FFFFFF";
          ctx.fillText(line, leftColumnX, leftY);
          leftY += 35;
        });
      }

      if (onConfigs.length > 0) {
        ctx.fillStyle = "#4ECB71";
        ctx.fillText("Cấu hình đang bật:", rightColumnX, rightY);
        rightY += 35;
        onConfigs.forEach((line) => {
          ctx.fillStyle = "#FFFFFF";
          ctx.fillText(line, rightColumnX, rightY);
          rightY += 35;
        });
      }
    }
  }

  const filePath = path.resolve(`./assets/temp/bot_info_${Date.now()}.png`);
  const out = fs.createWriteStream(filePath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);
  return new Promise((resolve, reject) => {
    out.on("finish", () => resolve(filePath));
    out.on("error", reject);
  });
}

export async function createGroupInfoImage(groupInfo, owner) {
  const { lines: nameLines, totalLines: nameTotalLines } = handleNameLong(
    groupInfo.name
  );
  const width = 930;
  let yTemp = 300;

  if (nameTotalLines > 1) {
    yTemp += 32 * (nameTotalLines - 1);
  }

  let bioLinesArray = [];

  if (groupInfo.desc !== "") {
    const bioLines = [...groupInfo.desc.split("\n")];
    const lineHeight = 32;
    yTemp += 20;

    bioLines.forEach((line, index) => {
      const { lines: bioLines, totalLines: bioTotalLines } = handleNameLong(
        line,
        56
      );
      bioLines.forEach((bioLine) => {
        bioLinesArray.push(bioLine);
      });
      yTemp += bioTotalLines * lineHeight;
    });
  }

  yTemp += 30;
  const height = yTemp > 300 ? yTemp : 300;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const backgroundGradient = ctx.createLinearGradient(0, 0, 0, height);
  backgroundGradient.addColorStop(0, "#3B82F6");
  backgroundGradient.addColorStop(1, "#111827");
  ctx.fillStyle = backgroundGradient;
  ctx.fillRect(0, 0, width, height);

  let xAvatar = 160;
  let widthAvatar = 160;
  let heightAvatar = 160;
  let yAvatar = 100;
  let yA1 = height / 2 - heightAvatar / 2 - yAvatar;
  let yBottom = 0;

  if (groupInfo && cv.isValidUrl(groupInfo.avt)) {
    try {
      const avatar = await loadImage(groupInfo.avt);

      const borderWidth = 10;
      const gradient = ctx.createLinearGradient(
        xAvatar - widthAvatar / 2 - borderWidth,
        yAvatar - borderWidth,
        xAvatar + widthAvatar / 2 + borderWidth,
        yAvatar + heightAvatar + borderWidth
      );

      const rainbowColors = [
        "#FF0000",
        "#FF7F00",
        "#FFFF00",
        "#00FF00",
        "#0000FF",
        "#4B0082",
        "#9400D3",
      ];

      const shuffledColors = [...rainbowColors].sort(() => Math.random() - 0.5);

      shuffledColors.forEach((color, index) => {
        gradient.addColorStop(index / (shuffledColors.length - 1), color);
      });

      ctx.save();
      ctx.beginPath();
      ctx.arc(
        xAvatar,
        yAvatar + heightAvatar / 2,
        widthAvatar / 2 + borderWidth,
        0,
        Math.PI * 2,
        true
      );
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(
        xAvatar,
        yAvatar + heightAvatar / 2,
        widthAvatar / 2,
        0,
        Math.PI * 2,
        true
      );
      ctx.clip();
      ctx.drawImage(
        avatar,
        xAvatar - widthAvatar / 2,
        yAvatar,
        widthAvatar,
        heightAvatar
      );
      ctx.restore();

      ctx.font = "bold 32px Tahoma";
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      const nameY = yAvatar + heightAvatar + 48;
      yBottom = nameY;

      const lineHeight = 28;
      nameLines.forEach((line, index) => {
        ctx.font = "bold 24px Tahoma";
        ctx.fillText(line, xAvatar, nameY + index * lineHeight);
        yBottom = nameY + index * lineHeight;
      });

      yBottom += 38;
    } catch (error) {
      console.error("Lỗi load avatar:", error);
    }
  }

  let y1 = 52;

  const groupType = groupInfo.groupType
    ? groupInfo.groupType === 2
      ? "Cộng Đồng"
      : "Nhóm"
    : "Nhóm";
  ctx.textAlign = "center";
  ctx.font = "bold 48px Tahoma";
  ctx.fillStyle = cv.getRandomGradient(ctx, width);
  ctx.fillText(`Card Group`, width / 2, y1);

  const nameWidth = ctx.measureText(nameLines[0]).width;
  const infoStartX = Math.max(
    xAvatar + widthAvatar / 2 + 60,
    xAvatar + nameWidth / 2 - 40
  );

  ctx.textAlign = "left";
  let y = y1 + 52;

  const fields = [
    { label: `🔢 ID`, value: groupInfo.groupId },
    { label: `👑 Trưởng Nhóm`, value: owner.name },
    { label: "👥 Số thành viên", value: groupInfo.memberCount },
    { label: `🕰️ Ngày tạo`, value: groupInfo.createdTime },
    { label: "🏷️ Phân Loại", value: groupType },
  ];

  ctx.font = "bold 28px Tahoma";
  for (const field of fields) {
    ctx.fillStyle = cv.getRandomGradient(ctx, width);
    const labelText = field.label + ":";
    const labelWidth = ctx.measureText(labelText).width;
    ctx.fillText(labelText, infoStartX, y);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(" " + field.value, infoStartX + labelWidth, y);
    y += 48;
  }

  if (groupInfo.desc !== "") {
    ctx.textAlign = "center";
    ctx.font = "bold 24px Tahoma";

    ctx.beginPath();
    ctx.moveTo(width * 0.05, yBottom - 20);
    ctx.lineTo(width * 0.95, yBottom - 20);
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.stroke();

    yBottom += 25;
    const lineHeight = 32;

    bioLinesArray.forEach((line, index) => {
      const lineGradient = cv.getRandomGradient(ctx, width);
      ctx.fillStyle = lineGradient;

      ctx.fillText(line, width / 2, yBottom);
      yBottom += lineHeight;
    });
  }

  const filePath = path.resolve(`./assets/temp/group_info_${Date.now()}.png`);
  const out = fs.createWriteStream(filePath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);
  return new Promise((resolve, reject) => {
    out.on("finish", () => resolve(filePath));
    out.on("error", reject);
  });
}