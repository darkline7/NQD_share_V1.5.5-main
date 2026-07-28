import { createCanvas } from "canvas";
import fs from "fs";
import path from "path";

// Tạo Hình Lệnh !Help
export async function createInstructionsImage(helpContent, isAdminBox, width = 800) {
  const outerPadding = 26;
  const sectionPadding = 22;
  const rowHeight = 44;
  const sectionGap = 22;
  const titleBlockHeight = 92;

  const memberCommands = Object.values(helpContent.allMembers || {});
  const hiddenCommands = Object.values(helpContent.hidden || {});
  const adminCommands = isAdminBox ? Object.values(helpContent.admin || {}) : [];

  const mainSectionHeight = sectionPadding * 2 + 36 + memberCommands.length * rowHeight;
  const hiddenSectionHeight = hiddenCommands.length > 0
    ? sectionPadding * 2 + 36 + hiddenCommands.length * rowHeight
    : 0;
  const adminSectionHeight = adminCommands.length > 0
    ? sectionPadding * 2 + 36 + adminCommands.length * rowHeight
    : 0;

  const height = Math.max(
    460,
    outerPadding * 2 +
      titleBlockHeight +
      mainSectionHeight +
      (hiddenSectionHeight ? sectionGap + hiddenSectionHeight : 0) +
      (adminSectionHeight ? sectionGap + adminSectionHeight : 0)
  );

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const drawRoundedRect = (x, y, w, h, r) => {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  };

  const bgGradient = ctx.createLinearGradient(0, 0, width, height);
  bgGradient.addColorStop(0, "#0f172a");
  bgGradient.addColorStop(0.45, "#1d4ed8");
  bgGradient.addColorStop(1, "#0b1120");
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, width, height);

  const glowA = ctx.createRadialGradient(width * 0.18, height * 0.16, 10, width * 0.18, height * 0.16, width * 0.55);
  glowA.addColorStop(0, "rgba(56, 189, 248, 0.35)");
  glowA.addColorStop(1, "rgba(56, 189, 248, 0)");
  ctx.fillStyle = glowA;
  ctx.fillRect(0, 0, width, height);

  const glowB = ctx.createRadialGradient(width * 0.85, height * 0.78, 10, width * 0.85, height * 0.78, width * 0.45);
  glowB.addColorStop(0, "rgba(251, 191, 36, 0.25)");
  glowB.addColorStop(1, "rgba(251, 191, 36, 0)");
  ctx.fillStyle = glowB;
  ctx.fillRect(0, 0, width, height);

  drawRoundedRect(outerPadding, outerPadding, width - outerPadding * 2, titleBlockHeight, 22);
  const titleCard = ctx.createLinearGradient(0, outerPadding, width, outerPadding + titleBlockHeight);
  titleCard.addColorStop(0, "rgba(15, 23, 42, 0.88)");
  titleCard.addColorStop(1, "rgba(30, 58, 138, 0.7)");
  ctx.fillStyle = titleCard;
  ctx.fill();

  ctx.font = "bold 32px Tahoma";
  ctx.fillStyle = "#e2e8f0";
  ctx.textAlign = "left";
  ctx.fillText(helpContent.title, outerPadding + 24, outerPadding + 48);

  ctx.font = "20px Tahoma";
  ctx.fillStyle = "#cbd5e1";
  ctx.fillText("Danh sach lenh da duoc toi uu hien thi", outerPadding + 24, outerPadding + 78);

  const drawSection = (title, rows, startY, isAdminSection = false) => {
    const sectionHeight = sectionPadding * 2 + 36 + rows.length * rowHeight;

    drawRoundedRect(outerPadding, startY, width - outerPadding * 2, sectionHeight, 20);
    const sectionBg = ctx.createLinearGradient(outerPadding, startY, width - outerPadding, startY + sectionHeight);
    sectionBg.addColorStop(0, "rgba(15, 23, 42, 0.72)");
    sectionBg.addColorStop(1, "rgba(15, 23, 42, 0.55)");
    ctx.fillStyle = sectionBg;
    ctx.fill();

    ctx.strokeStyle = isAdminSection ? "rgba(250, 204, 21, 0.45)" : "rgba(56, 189, 248, 0.45)";
    ctx.lineWidth = 1.4;
    drawRoundedRect(outerPadding, startY, width - outerPadding * 2, sectionHeight, 20);
    ctx.stroke();

    ctx.font = "bold 24px Tahoma";
    ctx.fillStyle = isAdminSection ? "#fde68a" : "#bae6fd";
    ctx.fillText(title, outerPadding + sectionPadding, startY + sectionPadding + 20);

    const fitText = (text, maxWidth) => {
      if (ctx.measureText(text).width <= maxWidth) return text;
      let fitted = text;
      while (fitted.length > 1 && ctx.measureText(`${fitted}...`).width > maxWidth) {
        fitted = fitted.slice(0, -1);
      }
      return `${fitted}...`;
    };

    let y = startY + sectionPadding + 46;
    for (const row of rows) {
      const lineY = y + rowHeight - 10;
      ctx.strokeStyle = "rgba(148, 163, 184, 0.2)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(outerPadding + sectionPadding, lineY);
      ctx.lineTo(width - outerPadding - sectionPadding, lineY);
      ctx.stroke();

      const commandLabel = `${row.icon || ""} ${row.command}`.trim();
      ctx.font = "bold 20px Tahoma";
      ctx.fillStyle = "#f8fafc";
      ctx.fillText(fitText(commandLabel, 285), outerPadding + sectionPadding, y + 20);

      ctx.font = "18px Tahoma";
      ctx.fillStyle = "#cbd5e1";
      ctx.fillText(
        fitText(`- ${row.description || ""}`, width - outerPadding * 2 - sectionPadding * 2 - 300),
        outerPadding + sectionPadding + 300,
        y + 20
      );
      y += rowHeight;
    }

    return sectionHeight;
  };

  let sectionY = outerPadding + titleBlockHeight + sectionGap;
  const mainHeight = drawSection("LENH CHO THANH VIEN", memberCommands, sectionY, false);
  sectionY += mainHeight + sectionGap;

  if (hiddenCommands.length > 0) {
    const hiddenHeight = drawSection(helpContent.titleHidden || "LENH DA AN / DA TAT", hiddenCommands, sectionY, true);
    sectionY += hiddenHeight + sectionGap;
  }

  if (adminCommands.length > 0) {
    drawSection(helpContent.titleAdmin || "LENH QUAN TRI", adminCommands, sectionY, true);
  }

  const filePath = path.resolve(`./assets/temp/help_${Date.now()}.png`);
  const out = fs.createWriteStream(filePath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);
  return new Promise((resolve, reject) => {
    out.on("finish", () => resolve(filePath));
    out.on("error", reject);
  });
}
