import { getOrCreatePlayer, recordGameResult, getGamePrefix } from "./player-data.js";
import { createTaiXiuImage } from "./game-canvas.js";
import {
  openGameSession,
  placeSessionBet,
  isSessionActive,
  getActiveSession,
  getSessionStatusText,
  cancelGameSession
} from "./game-session.js";
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
  const subCmd = parts[0]?.toLowerCase();

  // Xem trạng thái bàn cược
  if (subCmd === "status" || subCmd === "st" || subCmd === "tt") {
    const statusText = getSessionStatusText(threadId);
    if (!statusText) {
      await api.sendMessage(
        { msg: `ℹ️ Hiện tại không có bàn cược nào đang mở trong nhóm.\n💡 Dùng \`${prefix}tx open\` hoặc \`${prefix}txb\` để mở bàn mới 60s!`, quote: message },
        threadId,
        message.type
      );
    } else {
      await api.sendMessage({ msg: statusText, quote: message }, threadId, message.type);
    }
    return;
  }

  // Hủy bàn cược đang mở
  if (subCmd === "cancel" || subCmd === "huy") {
    const canceled = await cancelGameSession(api, threadId, `Hủy bởi ${senderName}`, message);
    if (!canceled) {
      await api.sendMessage({ msg: "ℹ️ Hiện không có bàn cược nào đang mở để hủy.", quote: message }, threadId, message.type);
    }
    return;
  }

  // Mở bàn cược mới: /tx open hoặc dùng lệnh /txb
  const isTxbAlias = aliasCommand === "txb" || aliasCommand === "taixiuban";
  if (subCmd === "open" || subCmd === "ban" || subCmd === "phien" || (isTxbAlias && !isSessionActive(threadId))) {
    let initialBet = null;
    const betArgStart = subCmd === "open" || subCmd === "ban" || subCmd === "phien" ? 1 : 0;
    if (parts[betArgStart] && parts[betArgStart + 1]) {
      initialBet = { choice: parts[betArgStart], amountStr: parts[betArgStart + 1] };
    }
    await openGameSession(api, threadId, "taixiu", { uid: senderId, name: senderName }, initialBet, message);
    return;
  }

  // Nếu trong nhóm đang có bàn cược mở, chuyển cược vào bàn cộng đồng
  if (isSessionActive(threadId)) {
    const session = getActiveSession(threadId);
    if (session && session.gameType === "taixiu") {
      if (parts.length >= 2) {
        await placeSessionBet(api, message, "taixiu", parts[0], parts[1]);
        return;
      } else {
        const statusText = getSessionStatusText(threadId);
        await api.sendMessage(
          {
            msg: `⚠️ Bàn cược Tài Xỉu đang mở!\n${statusText}\n👉 Đặt cược: \`${prefix}tx [tai/xiu] [tiền]\` hoặc gõ nhanh \`tai 50k\`, \`xiu 100k\``,
            quote: message
          },
          threadId,
          message.type
        );
        return;
      }
    }
  }

  if (parts.length < 2) {
    const guideMsg =
      `🎲 HƯỚNG DẪN CHƠI TÀI XỈU 🎲\n═════════════════════\n` +
      `📌 Chế độ Solo (ăn thua ngay lập tức):\n` +
      `  • ${prefix}tx [tai/xiu] [số_tiền]\n` +
      `  • Ví dụ: ${prefix}tx tai 50k | ${prefix}tx xiu 100k | ${prefix}tx tai all\n\n` +
      `🔥 Chế độ Bàn Cược Nhóm (60s cả nhóm cùng cược):\n` +
      `  • ${prefix}tx open (hoặc ${prefix}txb): Mở bàn cược 60 giây\n` +
      `  • Khi bàn mở, gõ nhanh không cần prefix: tai 50k, xiu 100k\n` +
      `  • ${prefix}tx status: Xem trạng thái cược bàn\n` +
      `  • ${prefix}tx cancel: Hủy bàn hoàn tiền 100%\n\n` +
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

  const summaryText =
    `🎲 KẾT QUẢ TÀI XỈU 🎲\n` +
    `👤 Người chơi: ${senderName}\n` +
    `🎯 Cửa đặt: ${choice} - ${formatCurrency(betAmount.toString())} VNĐ\n` +
    `🎲 Xúc xắc: [ ${d1} ] - [ ${d2} ] - [ ${d3} ] ➔ ${total} điểm (${resultType})\n` +
    `${isWin ? `🎉 THẮNG LỚN: +${formatCurrency(winProfit.toString())} VNĐ` : `💀 THUA CƯỢC: -${formatCurrency(betAmount.toString())} VNĐ`}\n` +
    `💰 Số dư hiện tại: ${formatCurrency(updatedPlayer.balance)} VNĐ`;

  let imagePath = null;
  try {
    imagePath = await createTaiXiuImage({
      dice, total, resultType, isWin,
      betAmount: betAmount.toString(),
      winProfit: winProfit.toString(),
      balance: updatedPlayer.balance,
      playerName: senderName,
      choice
    });
  } catch (canvasErr) {
    console.error('Lỗi khi tạo ảnh Tài Xỉu:', canvasErr);
  }

  try {
    if (imagePath) {
      await api.sendMessage(
        { msg: summaryText, attachments: [imagePath], quote: message },
        threadId,
        message.type
      );
    } else {
      await api.sendMessage({ msg: summaryText, quote: message }, threadId, message.type);
    }
  } catch (sendErr) {
    console.error('Lỗi khi gửi kết quả Tài Xỉu, fallback text:', sendErr.message);
    try {
      await api.sendMessage({ msg: summaryText, quote: message }, threadId, message.type);
    } catch (_) {}
  } finally {
    if (imagePath) clearImagePath(imagePath).catch(() => {});
  }
}
