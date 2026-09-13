import { getOrCreatePlayer, recordGameResult, getGamePrefix } from "./player-data.js";
import { createTaiXiuImage } from "./game-canvas.js";
import { clearImagePath } from "../../utils/canvas/index.js";
import { formatCurrency, parseGameAmount, removeMention } from "../../utils/format-util.js";
import Big from "big.js";

export async function handleTaiXiuCommand(api, message, aliasCommand) {
  const prefix = getGamePrefix();
  const senderId = message.data.uidFrom;
  const senderName = message.data.dName || "Người Chơi";
  const threadId = message.threadId;

  const player = getOrCreatePlayer(senderId, senderName);

  let rawContent = removeMention(message).trim();
  rawContent = rawContent.replace(new RegExp(`^${prefix}${aliasCommand}`, "i"), "").trim();
  const parts = rawContent.split(/\s+/).filter(Boolean);

  if (parts.length < 2) {
    const guideMsg =
      `🎲 HƯỚNG DẪN CHƠI TÀI XỈU 🎲\n═════════════════════\n` +
      `📌 Cú pháp: ${prefix}${aliasCommand} [tai/xiu] [số_tiền]\n` +
      `💡 Ví dụ:\n` +
      `  • ${prefix}tx tai 50k\n` +
      `  • ${prefix}tx xiu 100k\n` +
      `  • ${prefix}tx tai all (cược tất cả)\n` +
      `  • ${prefix}tx xiu 50% (cược 50% số dư)\n` +
      `📜 Luật chơi:\n` +
      `  - Xỉu: Tổng 3 hột từ 4 đến 10\n` +
      `  - Tài: Tổng 3 hột từ 11 đến 17\n` +
      `  - Bão: 3 hột giống nhau (1-1-1, 2-2-2...) 👉 Nhà cái thắng!\n` +
      `💰 Số dư hiện tại của bạn: ${formatCurrency(player.balance)} VNĐ`;
    await api.sendMessage({ msg: guideMsg, quote: message }, threadId, message.type);
    return;
  }

  const rawChoice = parts[0].toLowerCase();
  let choice = null;
  if (rawChoice === "tai" || rawChoice === "t") {
    choice = "TÀI";
  } else if (rawChoice === "xiu" || rawChoice === "x") {
    choice = "XỈU";
  } else {
    await api.sendMessage(
      { msg: "⚠️ Cửa cược không hợp lệ! Vui lòng chọn 'tai' (Tài) hoặc 'xiu' (Xỉu).", quote: message },
      threadId,
      message.type
    );
    return;
  }

  const amountStr = parts[1];
  let betAmount = null;

  try {
    betAmount = parseGameAmount(amountStr, player.balance);
    if (betAmount === "allin" || betAmount === "all") {
      betAmount = new Big(player.balance);
    }
  } catch (err) {
    await api.sendMessage({ msg: `⚠️ ${err.message}`, quote: message }, threadId, message.type);
    return;
  }

  if (!betAmount || betAmount.lte(0)) {
    await api.sendMessage({ msg: "⚠️ Số tiền cược phải lớn hơn 0 VNĐ!", quote: message }, threadId, message.type);
    return;
  }

  if (betAmount.lt(1000)) {
    await api.sendMessage({ msg: "⚠️ Mức cược tối thiểu là 1.000 VNĐ!", quote: message }, threadId, message.type);
    return;
  }

  if (new Big(player.balance).lt(betAmount)) {
    await api.sendMessage(
      {
        msg: `⚠️ Số dư của bạn không đủ để cược!\n💰 Số dư hiện có: ${formatCurrency(player.balance)} VNĐ.\n💡 Dùng lệnh ${prefix}diemdanh để nhận thêm xu mỗi ngày!`,
        quote: message
      },
      threadId,
      message.type
    );
    return;
  }

  // Lắc 3 viên xúc xắc (1 - 6)
  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  const d3 = Math.floor(Math.random() * 6) + 1;
  const dice = [d1, d2, d3];
  const total = d1 + d2 + d3;

  let resultType = "";
  if (d1 === d2 && d2 === d3) {
    resultType = "BÃO";
  } else if (total >= 11) {
    resultType = "TÀI";
  } else {
    resultType = "XỈU";
  }

  const isWin = resultType !== "BÃO" && choice === resultType;
  const winProfit = isWin ? betAmount : new Big(0);

  const updatedPlayer = recordGameResult(
    senderId,
    isWin,
    betAmount.toString(),
    winProfit.toString()
  );

  let imagePath = null;
  try {
    imagePath = await createTaiXiuImage({
      dice,
      total,
      resultType,
      isWin,
      betAmount: betAmount.toString(),
      winProfit: winProfit.toString(),
      balance: updatedPlayer.balance,
      playerName: senderName,
      choice
    });

    const summaryText =
      `🎲 KẾT QUẢ TÀI XỈU 🎲\n` +
      `👤 Người chơi: ${senderName}\n` +
      `🎯 Cửa đặt: ${choice} - ${formatCurrency(betAmount.toString())} VNĐ\n` +
      `🎲 Xúc xắc: [ ${d1} ] - [ ${d2} ] - [ ${d3} ] ➔ ${total} điểm (${resultType})\n` +
      `${isWin ? `🎉 THẮNG LỚN: +${formatCurrency(winProfit.toString())} VNĐ` : `💀 THUA CƯỢC: -${formatCurrency(betAmount.toString())} VNĐ`}\n` +
      `💰 Số dư hiện tại: ${formatCurrency(updatedPlayer.balance)} VNĐ`;

    await api.sendMessage(
      { msg: summaryText, attachments: [imagePath], quote: message },
      threadId,
      message.type
    );
  } catch (error) {
    console.error("Lỗi khi tạo ảnh Tài Xỉu:", error);
    const textOnly =
      `🎲 KẾT QUẢ TÀI XỈU 🎲\n` +
      `👤 Người chơi: ${senderName}\n` +
      `🎯 Cửa đặt: ${choice} (${formatCurrency(betAmount.toString())} VNĐ)\n` +
      `🎲 Xúc xắc: [ ${d1} ] [ ${d2} ] [ ${d3} ] ➔ Tổng ${total} (${resultType})\n` +
      `${isWin ? `🎉 THẮNG: +${formatCurrency(winProfit.toString())} VNĐ` : `💀 THUA: -${formatCurrency(betAmount.toString())} VNĐ`}\n` +
      `💰 Số dư mới: ${formatCurrency(updatedPlayer.balance)} VNĐ`;
    await api.sendMessage({ msg: textOnly, quote: message }, threadId, message.type);
  } finally {
    if (imagePath) {
      await clearImagePath(imagePath);
    }
  }
}
