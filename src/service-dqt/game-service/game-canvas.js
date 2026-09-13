import { createCanvas } from "canvas";
import fs from "fs";
import path from "path";
import { formatCurrency } from "../../utils/format-util.js";

function drawRoundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawDie(ctx, x, y, size, value) {
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetX = 4;
  ctx.shadowOffsetY = 6;

  drawRoundedRect(ctx, x, y, size, size, 16);
  const dieGradient = ctx.createLinearGradient(x, y, x + size, y + size);
  dieGradient.addColorStop(0, "#ffffff");
  dieGradient.addColorStop(1, "#e2e8f0");
  ctx.fillStyle = dieGradient;
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, x, y, size, size, 16);
  ctx.stroke();

  const dotRadius = size * 0.1;
  const c = x + size / 2;
  const m = y + size / 2;
  const offset = size * 0.26;

  const drawDot = (dotX, dotY, color = "#1e293b") => {
    ctx.beginPath();
    ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  };

  const redDot = "#dc2626";
  const darkDot = "#0f172a";

  switch (value) {
    case 1:
      drawDot(c, m, redDot);
      break;
    case 2:
      drawDot(c - offset, m - offset, darkDot);
      drawDot(c + offset, m + offset, darkDot);
      break;
    case 3:
      drawDot(c - offset, m - offset, darkDot);
      drawDot(c, m, redDot);
      drawDot(c + offset, m + offset, darkDot);
      break;
    case 4:
      drawDot(c - offset, m - offset, redDot);
      drawDot(c + offset, m - offset, redDot);
      drawDot(c - offset, m + offset, redDot);
      drawDot(c + offset, m + offset, redDot);
      break;
    case 5:
      drawDot(c - offset, m - offset, darkDot);
      drawDot(c + offset, m - offset, darkDot);
      drawDot(c, m, redDot);
      drawDot(c - offset, m + offset, darkDot);
      drawDot(c + offset, m + offset, darkDot);
      break;
    case 6:
      drawDot(c - offset, m - offset, darkDot);
      drawDot(c + offset, m - offset, darkDot);
      drawDot(c - offset, m, darkDot);
      drawDot(c + offset, m, darkDot);
      drawDot(c - offset, m + offset, darkDot);
      drawDot(c + offset, m + offset, darkDot);
      break;
  }
}

export async function createTaiXiuImage({ dice, total, resultType, isWin, betAmount, winProfit, balance, playerName, choice }) {
  const width = 850;
  const height = 480;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#090d16");
  bg.addColorStop(0.5, "#131b2e");
  bg.addColorStop(1, "#080c14");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width / 2, height / 2, 20, width / 2, height / 2, width * 0.55);
  glow.addColorStop(0, isWin ? "rgba(34, 197, 94, 0.18)" : "rgba(239, 68, 68, 0.15)");
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = isWin ? "rgba(34, 197, 94, 0.4)" : "rgba(239, 68, 68, 0.4)";
  ctx.lineWidth = 4;
  drawRoundedRect(ctx, 16, 16, width - 32, height - 32, 20);
  ctx.stroke();

  ctx.font = "bold 32px Tahoma";
  ctx.textAlign = "center";
  ctx.fillStyle = "#f8fafc";
  ctx.fillText("🎲 TÀI XỈU MAY MẮN 🎲", width / 2, 60);

  ctx.font = "20px Tahoma";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText(`Người chơi: ${playerName}  |  Đặt: ${choice.toUpperCase()} (${formatCurrency(betAmount)} VNĐ)`, width / 2, 95);

  const dieSize = 100;
  const dieGap = 35;
  const totalDiceWidth = dieSize * 3 + dieGap * 2;
  const startX = (width - totalDiceWidth) / 2;
  const dieY = 130;

  dice.forEach((val, idx) => {
    drawDie(ctx, startX + idx * (dieSize + dieGap), dieY, dieSize, val);
  });

  const badgeY = 270;
  const badgeW = 340;
  const badgeH = 50;
  const badgeX = (width - badgeW) / 2;

  drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 14);
  ctx.fillStyle = resultType === "TÀI" ? "#dc2626" : resultType === "XỈU" ? "#2563eb" : "#d97706";
  ctx.fill();

  ctx.font = "bold 24px Tahoma";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(`TỔNG: ${total} ĐIỂM  👉  ${resultType}`, width / 2, badgeY + 34);

  const statusY = 345;
  const statusW = 540;
  const statusH = 55;
  const statusX = (width - statusW) / 2;

  drawRoundedRect(ctx, statusX, statusY, statusW, statusH, 12);
  ctx.fillStyle = isWin ? "rgba(22, 101, 52, 0.85)" : "rgba(153, 27, 27, 0.85)";
  ctx.fill();
  ctx.strokeStyle = isWin ? "#4ade80" : "#f87171";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = "bold 24px Tahoma";
  ctx.fillStyle = "#ffffff";
  if (isWin) {
    ctx.fillText(`🎉 THẮNG: +${formatCurrency(winProfit)} VNĐ 🎉`, width / 2, statusY + 36);
  } else {
    ctx.fillText(`💀 THUA: -${formatCurrency(betAmount)} VNĐ`, width / 2, statusY + 36);
  }

  ctx.font = "bold 20px Tahoma";
  ctx.fillStyle = "#facc15";
  ctx.fillText(`💰 Số dư mới: ${formatCurrency(balance)} VNĐ`, width / 2, 435);

  const filePath = path.resolve(`./assets/temp/taixiu_${Date.now()}_${Math.random().toString(36).substring(7)}.png`);
  const out = fs.createWriteStream(filePath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);

  return new Promise((resolve, reject) => {
    out.on("finish", () => resolve(filePath));
    out.on("error", reject);
  });
}

export async function createBauCuaImage({ rolled, betAnimal, matches, isWin, betAmount, winProfit, balance, playerName }) {
  const width = 850;
  const height = 480;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#3b0764");
  bg.addColorStop(0.5, "#581c87");
  bg.addColorStop(1, "#1e1b4b");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width / 2, height / 2, 20, width / 2, height / 2, width * 0.55);
  glow.addColorStop(0, isWin ? "rgba(250, 204, 21, 0.2)" : "rgba(239, 68, 68, 0.15)");
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = isWin ? "rgba(250, 204, 21, 0.5)" : "rgba(239, 68, 68, 0.4)";
  ctx.lineWidth = 4;
  drawRoundedRect(ctx, 16, 16, width - 32, height - 32, 20);
  ctx.stroke();

  ctx.font = "bold 32px Tahoma";
  ctx.textAlign = "center";
  ctx.fillStyle = "#fef08a";
  ctx.fillText("🎋 BẦU CUA TÔM CÁ 🎋", width / 2, 60);

  ctx.font = "20px Tahoma";
  ctx.fillStyle = "#cbd5e1";
  ctx.fillText(`Người chơi: ${playerName}  |  Cược: ${betAnimal.name.toUpperCase()} (${formatCurrency(betAmount)} VNĐ)`, width / 2, 95);

  const plateSize = 130;
  const plateGap = 35;
  const totalPlateWidth = plateSize * 3 + plateGap * 2;
  const startX = (width - totalPlateWidth) / 2;
  const plateY = 125;

  rolled.forEach((item, idx) => {
    const px = startX + idx * (plateSize + plateGap);
    drawRoundedRect(ctx, px, plateY, plateSize, plateSize, 20);
    const itemGrad = ctx.createLinearGradient(px, plateY, px + plateSize, plateY + plateSize);
    const isMatchedThis = item.id === betAnimal.id;
    if (isMatchedThis) {
      itemGrad.addColorStop(0, "#ca8a04");
      itemGrad.addColorStop(1, "#854d0e");
    } else {
      itemGrad.addColorStop(0, "#1e293b");
      itemGrad.addColorStop(1, "#0f172a");
    }
    ctx.fillStyle = itemGrad;
    ctx.fill();

    ctx.strokeStyle = isMatchedThis ? "#facc15" : "#475569";
    ctx.lineWidth = isMatchedThis ? 4 : 2;
    drawRoundedRect(ctx, px, plateY, plateSize, plateSize, 20);
    ctx.stroke();

    ctx.font = "52px 'Segoe UI Emoji', Tahoma";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(item.icon, px + plateSize / 2, plateY + 68);

    ctx.font = "bold 20px Tahoma";
    ctx.fillStyle = isMatchedThis ? "#fef08a" : "#cbd5e1";
    ctx.fillText(item.name.toUpperCase(), px + plateSize / 2, plateY + 105);
  });

  const badgeY = 275;
  const badgeW = 380;
  const badgeH = 46;
  const badgeX = (width - badgeW) / 2;

  drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 12);
  ctx.fillStyle = isWin ? "#15803d" : "#991b1b";
  ctx.fill();

  ctx.font = "bold 22px Tahoma";
  ctx.fillStyle = "#ffffff";
  if (isWin) {
    ctx.fillText(`TRÚNG ${matches} CON ${betAnimal.name.toUpperCase()} (x${matches})`, width / 2, badgeY + 31);
  } else {
    ctx.fillText(`KHÔNG CÓ CON ${betAnimal.name.toUpperCase()} NÀO`, width / 2, badgeY + 31);
  }

  const statusY = 340;
  const statusW = 540;
  const statusH = 55;
  const statusX = (width - statusW) / 2;

  drawRoundedRect(ctx, statusX, statusY, statusW, statusH, 12);
  ctx.fillStyle = isWin ? "rgba(22, 101, 52, 0.9)" : "rgba(153, 27, 27, 0.9)";
  ctx.fill();
  ctx.strokeStyle = isWin ? "#4ade80" : "#f87171";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = "bold 24px Tahoma";
  ctx.fillStyle = "#ffffff";
  if (isWin) {
    ctx.fillText(`🎉 THẮNG: +${formatCurrency(winProfit)} VNĐ 🎉`, width / 2, statusY + 36);
  } else {
    ctx.fillText(`💀 THUA: -${formatCurrency(betAmount)} VNĐ`, width / 2, statusY + 36);
  }

  ctx.font = "bold 20px Tahoma";
  ctx.fillStyle = "#facc15";
  ctx.fillText(`💰 Số dư mới: ${formatCurrency(balance)} VNĐ`, width / 2, 435);

  const filePath = path.resolve(`./assets/temp/baucua_${Date.now()}_${Math.random().toString(36).substring(7)}.png`);
  const out = fs.createWriteStream(filePath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);

  return new Promise((resolve, reject) => {
    out.on("finish", () => resolve(filePath));
    out.on("error", reject);
  });
}


export async function createKBBImage({ userChoice, botChoice, result, betAmount, winProfit, balance, playerName }) {
  const width = 800;
  const height = 460;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#0f172a");
  bg.addColorStop(0.5, "#1e293b");
  bg.addColorStop(1, "#0a0f1d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = result === "win" ? "rgba(34, 197, 94, 0.4)" : result === "lose" ? "rgba(239, 68, 68, 0.4)" : "rgba(234, 179, 8, 0.4)";
  ctx.lineWidth = 4;
  drawRoundedRect(ctx, 16, 16, width - 32, height - 32, 20);
  ctx.stroke();

  ctx.font = "bold 32px Tahoma";
  ctx.textAlign = "center";
  ctx.fillStyle = "#38bdf8";
  ctx.fillText("⚔️ KÉO BÚA BAO SOLO ⚔️", width / 2, 60);

  const boxW = 200;
  const boxH = 170;
  const boxY = 100;
  const leftX = width * 0.22 - boxW / 2;
  const rightX = width * 0.78 - boxW / 2;

  drawRoundedRect(ctx, leftX, boxY, boxW, boxH, 16);
  ctx.fillStyle = "#1e293b";
  ctx.fill();
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = "bold 18px Tahoma";
  ctx.fillStyle = "#93c5fd";
  ctx.fillText(playerName, leftX + boxW / 2, boxY + 30);

  ctx.font = "60px 'Segoe UI Emoji', Tahoma";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(userChoice.icon, leftX + boxW / 2, boxY + 105);

  ctx.font = "bold 20px Tahoma";
  ctx.fillStyle = "#f8fafc";
  ctx.fillText(userChoice.name.toUpperCase(), leftX + boxW / 2, boxY + 148);

  ctx.font = "bold 38px Tahoma";
  ctx.fillStyle = "#f43f5e";
  ctx.fillText("VS", width / 2, boxY + 95);

  drawRoundedRect(ctx, rightX, boxY, boxW, boxH, 16);
  ctx.fillStyle = "#1e293b";
  ctx.fill();
  ctx.strokeStyle = "#f43f5e";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = "bold 18px Tahoma";
  ctx.fillStyle = "#fda4af";
  ctx.fillText("BOT ZALO", rightX + boxW / 2, boxY + 30);

  ctx.font = "60px 'Segoe UI Emoji', Tahoma";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(botChoice.icon, rightX + boxW / 2, boxY + 105);

  ctx.font = "bold 20px Tahoma";
  ctx.fillStyle = "#f8fafc";
  ctx.fillText(botChoice.name.toUpperCase(), rightX + boxW / 2, boxY + 148);

  const statusY = 300;
  const statusW = 500;
  const statusH = 55;
  const statusX = (width - statusW) / 2;

  drawRoundedRect(ctx, statusX, statusY, statusW, statusH, 12);
  if (result === "win") {
    ctx.fillStyle = "rgba(22, 101, 52, 0.9)";
    ctx.strokeStyle = "#4ade80";
  } else if (result === "lose") {
    ctx.fillStyle = "rgba(153, 27, 27, 0.9)";
    ctx.strokeStyle = "#f87171";
  } else {
    ctx.fillStyle = "rgba(161, 98, 7, 0.9)";
    ctx.strokeStyle = "#facc15";
  }
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = "bold 24px Tahoma";
  ctx.fillStyle = "#ffffff";
  if (result === "win") {
    ctx.fillText(`🎉 BẠN THẮNG: +${formatCurrency(winProfit)} VNĐ 🎉`, width / 2, statusY + 36);
  } else if (result === "lose") {
    ctx.fillText(`💀 BẠN THUA: -${formatCurrency(betAmount)} VNĐ`, width / 2, statusY + 36);
  } else {
    ctx.fillText(`🤝 HÒA NHAU: Hoàn ${formatCurrency(betAmount)} VNĐ`, width / 2, statusY + 36);
  }

  ctx.font = "bold 20px Tahoma";
  ctx.fillStyle = "#facc15";
  ctx.fillText(`💰 Số dư mới: ${formatCurrency(balance)} VNĐ`, width / 2, 405);

  const filePath = path.resolve(`./assets/temp/kbb_${Date.now()}_${Math.random().toString(36).substring(7)}.png`);
  const out = fs.createWriteStream(filePath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);

  return new Promise((resolve, reject) => {
    out.on("finish", () => resolve(filePath));
    out.on("error", reject);
  });
}

