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
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 5;

  drawRoundedRect(ctx, x, y, size, size, 14);
  const dieGradient = ctx.createLinearGradient(x, y, x + size, y + size);
  dieGradient.addColorStop(0, "#ffffff");
  dieGradient.addColorStop(1, "#e2e8f0");
  ctx.fillStyle = dieGradient;
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, x, y, size, size, 14);
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

function truncateText(str, max = 13) {
  if (!str) return "Vô danh";
  return str.length > max ? str.substring(0, max - 1) + "…" : str;
}

function drawPlayerListCard(ctx, x, y, width, height, isWinner, list) {
  drawRoundedRect(ctx, x, y, width, height, 16);
  const cardGrad = ctx.createLinearGradient(x, y, x, y + height);
  if (isWinner) {
    cardGrad.addColorStop(0, "rgba(6, 78, 59, 0.4)");
    cardGrad.addColorStop(1, "rgba(2, 44, 34, 0.4)");
  } else {
    cardGrad.addColorStop(0, "rgba(127, 29, 29, 0.4)");
    cardGrad.addColorStop(1, "rgba(69, 10, 10, 0.4)");
  }
  ctx.fillStyle = cardGrad;
  ctx.fill();
  ctx.strokeStyle = isWinner ? "rgba(16, 185, 129, 0.6)" : "rgba(239, 68, 68, 0.6)";
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, x, y, width, height, 16);
  ctx.stroke();

  // Header
  drawRoundedRect(ctx, x, y, width, 42, 14);
  ctx.fillStyle = isWinner ? "#065f46" : "#991b1b";
  ctx.fill();
  ctx.font = "bold 17px Tahoma";
  ctx.textAlign = "center";
  ctx.fillStyle = isWinner ? "#a7f3d0" : "#fecaca";
  ctx.fillText(isWinner ? `🏆 NGƯỜI CHIẾN THẮNG (${list.length})` : `💀 NGƯỜI THUA CƯỢC (${list.length})`, x + width / 2, y + 27);

  if (list.length === 0) {
    ctx.font = "16px Tahoma";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(isWinner ? "Không ai thắng ván này!" : "Không ai thua ván này!", x + width / 2, y + 170);
    return;
  }

  const visible = list.slice(0, 6);
  visible.forEach((item, idx) => {
    const rowY = y + 52 + idx * 43;
    if (idx % 2 === 0) {
      drawRoundedRect(ctx, x + 8, rowY, width - 16, 38, 8);
      ctx.fillStyle = isWinner ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)";
      ctx.fill();
    }
    ctx.textAlign = "left";
    ctx.font = "bold 15px Tahoma";
    ctx.fillStyle = "#f8fafc";
    const label = item.label || item.choice || "";
    ctx.fillText(`👤 ${truncateText(item.name, 10)} [${label}]`, x + 18, rowY + 24);

    ctx.textAlign = "right";
    ctx.font = "bold 15px Tahoma";
    ctx.fillStyle = isWinner ? "#4ade80" : "#f87171";
    const amountText = isWinner ? `+${formatCurrency(item.profit)}` : `-${formatCurrency(item.amount)}`;
    ctx.fillText(amountText, x + width - 18, rowY + 24);
  });

  if (list.length > 6) {
    ctx.textAlign = "center";
    ctx.font = "italic 13px Tahoma";
    ctx.fillStyle = isWinner ? "#a7f3d0" : "#fecaca";
    ctx.fillText(`... và ${list.length - 6} người chơi khác`, x + width / 2, y + height - 12);
  }
}

export async function createMultiplayerTaiXiuImage({
  dice,
  total,
  resultType,
  winners = [],
  losers = [],
  totalBetsCount = 0,
  totalPoolAmount = "0",
  totalWinAmount = "0"
}) {
  const width = 920;
  const height = 680;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#080d1a");
  bg.addColorStop(0.5, "#0f172a");
  bg.addColorStop(1, "#030712");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const isBao = resultType === "BÃO";
  const glowColor = isBao ? "rgba(168, 85, 247, 0.25)" : resultType === "TÀI" ? "rgba(34, 197, 94, 0.25)" : "rgba(239, 68, 68, 0.25)";
  const radialGlow = ctx.createRadialGradient(width / 2, 180, 20, width / 2, 180, 400);
  radialGlow.addColorStop(0, glowColor);
  radialGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = radialGlow;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = isBao ? "#a855f7" : resultType === "TÀI" ? "#22c55e" : "#ef4444";
  ctx.lineWidth = 4;
  drawRoundedRect(ctx, 16, 16, width - 32, height - 32, 22);
  ctx.stroke();

  ctx.font = "bold 32px Tahoma";
  ctx.textAlign = "center";
  ctx.fillStyle = "#f8fafc";
  ctx.fillText("🎲 BÀN CƯỢC TÀI XỈU CỘNG ĐỒNG 🎲", width / 2, 60);

  ctx.font = "17px Tahoma";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText(`Tổng người tham gia: ${totalBetsCount}  •  Tổng cược sàn: ${formatCurrency(totalPoolAmount)} VNĐ`, width / 2, 92);

  const outCardX = 180;
  const outCardY = 115;
  const outCardW = 560;
  const outCardH = 135;
  drawRoundedRect(ctx, outCardX, outCardY, outCardW, outCardH, 16);
  const outGrad = ctx.createLinearGradient(outCardX, outCardY, outCardX, outCardY + outCardH);
  outGrad.addColorStop(0, "rgba(30, 41, 59, 0.95)");
  outGrad.addColorStop(1, "rgba(15, 23, 42, 0.95)");
  ctx.fillStyle = outGrad;
  ctx.fill();
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, outCardX, outCardY, outCardW, outCardH, 16);
  ctx.stroke();

  const dieSize = 64;
  const dieGap = 20;
  const diceStartX = outCardX + (outCardW - (dieSize * 3 + dieGap * 2)) / 2;
  const diceY = outCardY + 14;
  drawDie(ctx, diceStartX, diceY, dieSize, dice[0]);
  drawDie(ctx, diceStartX + dieSize + dieGap, diceY, dieSize, dice[1]);
  drawDie(ctx, diceStartX + (dieSize + dieGap) * 2, diceY, dieSize, dice[2]);

  const badgeW = 440;
  const badgeH = 34;
  const badgeX = (width - badgeW) / 2;
  const badgeY = outCardY + 86;
  drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 10);
  ctx.fillStyle = isBao ? "#7c3aed" : resultType === "TÀI" ? "#16a34a" : "#dc2626";
  ctx.fill();

  ctx.font = "bold 17px Tahoma";
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  if (isBao) {
    ctx.fillText(`👑 BÃO [${dice[0]}-${dice[1]}-${dice[2]}] (${total} ĐIỂM) - NHÀ CÁI THẮNG!`, width / 2, badgeY + 23);
  } else if (resultType === "TÀI") {
    ctx.fillText(`🟢 TÀI  •  TỔNG ${total} ĐIỂM (11 - 17)`, width / 2, badgeY + 23);
  } else {
    ctx.fillText(`🔴 XỈU  •  TỔNG ${total} ĐIỂM (4 - 10)`, width / 2, badgeY + 23);
  }

  const colY = 265;
  const colW = 405;
  const colH = 335;
  drawPlayerListCard(ctx, 40, colY, colW, colH, true, winners);
  drawPlayerListCard(ctx, 475, colY, colW, colH, false, losers);

  const footerY = 616;
  drawRoundedRect(ctx, 40, footerY, 840, 42, 12);
  ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
  ctx.fill();
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, 40, footerY, 840, 42, 12);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.font = "bold 16px Tahoma";
  ctx.fillStyle = "#fbbf24";
  ctx.fillText(`🎉 Tổng tiền trao thưởng: +${formatCurrency(totalWinAmount)} VNĐ  •  Chúc mừng tất cả anh em!`, width / 2, footerY + 26);

  const filePath = path.resolve(`./assets/temp/tx_multi_${Date.now()}_${Math.random().toString(36).substring(7)}.png`);
  const out = fs.createWriteStream(filePath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);

  return new Promise((resolve, reject) => {
    out.on("finish", () => resolve(filePath));
    out.on("error", reject);
  });
}

export async function createMultiplayerBauCuaImage({
  rolled = [],
  winners = [],
  losers = [],
  totalBetsCount = 0,
  totalPoolAmount = "0",
  totalWinAmount = "0"
}) {
  const width = 920;
  const height = 680;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#2a0845");
  bg.addColorStop(0.5, "#431407");
  bg.addColorStop(1, "#180224");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const radialGlow = ctx.createRadialGradient(width / 2, 180, 20, width / 2, 180, 400);
  radialGlow.addColorStop(0, "rgba(250, 204, 21, 0.2)");
  radialGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = radialGlow;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "#facc15";
  ctx.lineWidth = 4;
  drawRoundedRect(ctx, 16, 16, width - 32, height - 32, 22);
  ctx.stroke();

  ctx.font = "bold 32px Tahoma";
  ctx.textAlign = "center";
  ctx.fillStyle = "#fef08a";
  ctx.fillText("🎋 BÀN CƯỢC BẦU CUA CỘNG ĐỒNG 🎋", width / 2, 60);

  ctx.font = "17px Tahoma";
  ctx.fillStyle = "#cbd5e1";
  ctx.fillText(`Tổng người tham gia: ${totalBetsCount}  •  Tổng cược sàn: ${formatCurrency(totalPoolAmount)} VNĐ`, width / 2, 92);

  const outCardX = 180;
  const outCardY = 112;
  const outCardW = 560;
  const outCardH = 140;
  drawRoundedRect(ctx, outCardX, outCardY, outCardW, outCardH, 16);
  const outGrad = ctx.createLinearGradient(outCardX, outCardY, outCardX, outCardY + outCardH);
  outGrad.addColorStop(0, "rgba(88, 28, 135, 0.8)");
  outGrad.addColorStop(1, "rgba(59, 7, 100, 0.8)");
  ctx.fillStyle = outGrad;
  ctx.fill();
  ctx.strokeStyle = "rgba(250, 204, 21, 0.6)";
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, outCardX, outCardY, outCardW, outCardH, 16);
  ctx.stroke();

  const cardW = 92;
  const cardH = 92;
  const cardGap = 26;
  const cardsStartX = outCardX + (outCardW - (cardW * 3 + cardGap * 2)) / 2;
  const cardY = outCardY + 12;

  rolled.forEach((item, idx) => {
    const cx = cardsStartX + idx * (cardW + cardGap);
    drawRoundedRect(ctx, cx, cardY, cardW, cardH, 14);
    const itemGrad = ctx.createLinearGradient(cx, cardY, cx + cardW, cardY + cardH);
    itemGrad.addColorStop(0, "#ca8a04");
    itemGrad.addColorStop(1, "#713f12");
    ctx.fillStyle = itemGrad;
    ctx.fill();
    ctx.strokeStyle = "#fef08a";
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, cx, cardY, cardW, cardH, 14);
    ctx.stroke();

    ctx.font = "40px 'Segoe UI Emoji', Tahoma";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText(item.icon, cx + cardW / 2, cardY + 50);

    ctx.font = "bold 16px Tahoma";
    ctx.fillStyle = "#fef08a";
    ctx.fillText(item.name.toUpperCase(), cx + cardW / 2, cardY + 78);
  });

  const rolledNames = rolled.map((r) => `${r.icon} ${r.name}`).join("  •  ");
  ctx.font = "bold 16px Tahoma";
  ctx.textAlign = "center";
  ctx.fillStyle = "#fef08a";
  ctx.fillText(`Kết quả:  ${rolledNames}`, width / 2, outCardY + 126);

  const colY = 265;
  const colW = 405;
  const colH = 335;
  drawPlayerListCard(ctx, 40, colY, colW, colH, true, winners);
  drawPlayerListCard(ctx, 475, colY, colW, colH, false, losers);

  const footerY = 616;
  drawRoundedRect(ctx, 40, footerY, 840, 42, 12);
  ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
  ctx.fill();
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, 40, footerY, 840, 42, 12);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.font = "bold 16px Tahoma";
  ctx.fillStyle = "#fbbf24";
  ctx.fillText(`🎉 Tổng tiền trao thưởng: +${formatCurrency(totalWinAmount)} VNĐ  •  Chúc mừng tất cả anh em!`, width / 2, footerY + 26);

  const filePath = path.resolve(`./assets/temp/bc_multi_${Date.now()}_${Math.random().toString(36).substring(7)}.png`);
  const out = fs.createWriteStream(filePath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);

  return new Promise((resolve, reject) => {
    out.on("finish", () => resolve(filePath));
    out.on("error", reject);
  });
}

