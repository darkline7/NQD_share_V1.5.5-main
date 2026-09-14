import Big from "big.js";
import {
  getOrCreatePlayer,
  updatePlayerBalance,
  recordMultiplayerGameResult,
  refundPlayerBalance,
  getGamePrefix
} from "./player-data.js";
import {
  createMultiplayerTaiXiuImage,
  createMultiplayerBauCuaImage
} from "./multiplayer-canvas.js";
import { clearImagePath } from "../../utils/canvas/index.js";
import { formatCurrency, parseGameAmount } from "../../utils/format-util.js";
import { ANIMALS } from "./baucua.js";

const DEFAULT_SESSION_DURATION = 60; // 60 giây
const activeSessions = new Map(); // key: threadId (string) -> session object

export function getActiveSession(threadId) {
  return activeSessions.get(String(threadId)) || null;
}

export function isSessionActive(threadId) {
  const session = activeSessions.get(String(threadId));
  return !!(session && !session.isLocked);
}

export async function openGameSession(api, threadId, gameType, opener, initialBet = null, messageObj = null) {
  const tId = String(threadId);
  const prefix = getGamePrefix();

  if (activeSessions.has(tId)) {
    const existing = activeSessions.get(tId);
    const timeLeft = Math.max(0, Math.ceil((existing.endsAt - Date.now()) / 1000));
    const gameName = existing.gameType === "taixiu" ? "Tài Xỉu" : "Bầu Cua";
    const msg = `⚠️ Nhóm hiện đang có bàn cược **${gameName}** đang mở!\n⏳ Còn lại **${timeLeft} giây** để chốt sổ.\n💡 Dùng \`${prefix}${existing.gameType === "taixiu" ? "tx" : "bc"} status\` để xem chi tiết.`;
    await api.sendMessage({ msg, quote: messageObj }, threadId, messageObj?.type);
    return false;
  }

  const session = {
    id: `sess_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    threadId: tId,
    gameType, // "taixiu" hoặc "baucua"
    opener: { uid: opener.uid, name: opener.name },
    openedAt: Date.now(),
    duration: DEFAULT_SESSION_DURATION,
    endsAt: Date.now() + DEFAULT_SESSION_DURATION * 1000,
    isLocked: false,
    bets: [], // [ { uid, name, choice (TX), animal (BC), amount: Big } ]
    warnTimer: null,
    endTimer: null
  };

  activeSessions.set(tId, session);

  // Gửi thông báo mở bàn
  if (gameType === "taixiu") {
    const openMsg =
      `🎲═════════════════════════🎲\n` +
      `   🔥 BÀN CƯỢC TÀI XỈU CỘNG ĐỒNG 🔥\n` +
      `🎲═════════════════════════🎲\n` +
      `👑 Người mở bàn: ${opener.name}\n` +
      `⏳ Thời gian cược: ${DEFAULT_SESSION_DURATION} giây\n\n` +
      `👉 CÁCH VÀO CƯỢC:\n` +
      `  • Gõ trực tiếp: tai [tiền] hoặc xiu [tiền]\n` +
      `  • Hoặc dùng: ${prefix}tx tai [tiền] | ${prefix}tx xiu [tiền]\n` +
      `  • Ví dụ: tai 50k, xiu 100k, tai all, xiu 50%\n\n` +
      `📊 Cả nhóm cùng đặt cược, lắc 1 lần chốt thưởng toàn sàn!\n` +
      `⏰ Đang đếm ngược 60 giây...`;
    await api.sendMessage({ msg: openMsg }, threadId, messageObj?.type);
  } else {
    const openMsg =
      `🎋═════════════════════════🎋\n` +
      `   🔥 BÀN CƯỢC BẦU CUA CỘNG ĐỒNG 🔥\n` +
      `🎋═════════════════════════🎋\n` +
      `👑 Người mở bàn: ${opener.name}\n` +
      `⏳ Thời gian cược: ${DEFAULT_SESSION_DURATION} giây\n\n` +
      `👉 CÁCH VÀO CƯỢC:\n` +
      `  • Gõ trực tiếp: [linh_vật] [tiền]\n` +
      `  • Hoặc dùng: ${prefix}bc [linh_vật] [tiền]\n` +
      `  • Linh vật: 🍐 bau | 🦀 cua | 🦐 tom | 🐟 ca | 🐓 ga | 🦌 nai\n` +
      `  • Ví dụ: cua 50k, tom 100k, ca all (đặt nhiều con thoải mái!)\n\n` +
      `⏰ Đang đếm ngược 60 giây...`;
    await api.sendMessage({ msg: openMsg }, threadId, messageObj?.type);
  }

  // Timer cảnh báo khi còn 15s
  session.warnTimer = setTimeout(async () => {
    if (!activeSessions.has(tId) || session.isLocked) return;
    const gameName = session.gameType === "taixiu" ? "TÀI XỈU" : "BẦU CUA";
    const totalCount = session.bets.length;
    await api.sendMessage(
      {
        msg: `⏳ **[BÀN CƯỢC ${gameName}] CÒN 15 GIÂY ĐỂ ĐẶT CƯỢC!**\n📊 Hiện có **${totalCount} lượt cược**. Nhanh tay chốt sổ trước khi đóng bàn!`
      },
      threadId,
      messageObj?.type
    );
  }, (DEFAULT_SESSION_DURATION - 15) * 1000);
  if (session.warnTimer.unref) session.warnTimer.unref();

  // Timer đóng bàn và tính thưởng
  session.endTimer = setTimeout(async () => {
    await resolveGameSession(api, tId, messageObj);
  }, DEFAULT_SESSION_DURATION * 1000);
  if (session.endTimer.unref) session.endTimer.unref();

  // Nếu có initialBet đi kèm lúc mở bàn thì cược luôn
  if (initialBet && messageObj) {
    await placeSessionBet(api, messageObj, gameType, initialBet.choice, initialBet.amountStr);
  }

  return true;
}

export async function placeSessionBet(api, message, gameType, choiceOrAnimal, amountStr) {
  const tId = String(message.threadId);
  const session = activeSessions.get(tId);

  if (!session || session.gameType !== gameType) {
    return { handled: false, reason: "NO_MATCHING_SESSION" };
  }

  if (session.isLocked) {
    await api.sendMessage(
      { msg: "⚠️ Bàn cược đã khóa sổ! Đang chuẩn bị lắc kết quả, vui lòng đợi phiên sau.", quote: message },
      message.threadId,
      message.type
    );
    return { handled: true, success: false };
  }

  const senderId = message.data.uidFrom;
  const senderName = message.data.dName || "Người Chơi";
  const player = getOrCreatePlayer(senderId, senderName);

  let betAmount = null;
  try {
    betAmount = parseGameAmount(amountStr, player.balance);
    if (betAmount === "allin" || betAmount === "all") {
      betAmount = new Big(player.balance);
    }
  } catch (err) {
    await api.sendMessage({ msg: `⚠️ ${err.message}`, quote: message }, message.threadId, message.type);
    return { handled: true, success: false };
  }

  if (!betAmount || betAmount.lte(0)) {
    await api.sendMessage({ msg: "⚠️ Số tiền cược phải lớn hơn 0 VNĐ!", quote: message }, message.threadId, message.type);
    return { handled: true, success: false };
  }

  if (betAmount.lt(1000)) {
    await api.sendMessage({ msg: "⚠️ Mức cược tối thiểu là 1.000 VNĐ!", quote: message }, message.threadId, message.type);
    return { handled: true, success: false };
  }

  if (new Big(player.balance).lt(betAmount)) {
    await api.sendMessage(
      {
        msg: `⚠️ Số dư của bạn không đủ để cược!\n💰 Số dư hiện có: ${formatCurrency(player.balance)} VNĐ.`,
        quote: message
      },
      message.threadId,
      message.type
    );
    return { handled: true, success: false };
  }

  const secondsLeft = Math.max(0, Math.ceil((session.endsAt - Date.now()) / 1000));

  if (gameType === "taixiu") {
    const rawChoice = String(choiceOrAnimal).toLowerCase();
    let choice = null;
    if (rawChoice === "tai" || rawChoice === "t") choice = "TÀI";
    else if (rawChoice === "xiu" || rawChoice === "x") choice = "XỈU";
    else {
      await api.sendMessage(
        { msg: "⚠️ Cửa cược không hợp lệ! Vui lòng chọn 'tai' hoặc 'xiu'.", quote: message },
        message.threadId,
        message.type
      );
      return { handled: true, success: false };
    }

    // Không cho cược 2 đầu
    const oppositeBet = session.bets.find((b) => b.uid === senderId && b.choice !== choice);
    if (oppositeBet) {
      await api.sendMessage(
        {
          msg: `⚠️ Bạn đã cược cửa **${oppositeBet.choice}** rồi! Không thể cược thêm cửa **${choice}** trong cùng một ván để tránh ôm 2 đầu.`,
          quote: message
        },
        message.threadId,
        message.type
      );
      return { handled: true, success: false };
    }

    // Trừ tiền ngay lập tức
    updatePlayerBalance(senderId, -betAmount.toString());

    // Cập nhật hoặc thêm cược
    const existingSameBet = session.bets.find((b) => b.uid === senderId && b.choice === choice);
    if (existingSameBet) {
      existingSameBet.amount = existingSameBet.amount.plus(betAmount);
    } else {
      session.bets.push({ uid: senderId, name: senderName, choice, amount: betAmount });
    }

    // Thống kê bàn
    let totalTai = new Big(0);
    let countTai = 0;
    let totalXiu = new Big(0);
    let countXiu = 0;

    session.bets.forEach((b) => {
      if (b.choice === "TÀI") {
        totalTai = totalTai.plus(b.amount);
        countTai++;
      } else {
        totalXiu = totalXiu.plus(b.amount);
        countXiu++;
      }
    });

    const confirmMsg =
      `✅ **${senderName}** đã cược **${formatCurrency(betAmount.toString())} VNĐ** vào cửa **[${choice}]**!\n` +
      `📊 Tổng bàn:\n` +
      `  • 🟢 TÀI: ${formatCurrency(totalTai.toString())} VNĐ (${countTai} cược)\n` +
      `  • 🔴 XỈU: ${formatCurrency(totalXiu.toString())} VNĐ (${countXiu} cược)\n` +
      `⏳ Còn lại: ${secondsLeft} giây`;

    await api.sendMessage({ msg: confirmMsg, quote: message }, message.threadId, message.type);
    return { handled: true, success: true };
  } else if (gameType === "baucua") {
    const rawAnimal = String(choiceOrAnimal).toLowerCase();
    const matched = ANIMALS.find((a) => a.aliases.includes(rawAnimal) || a.id === rawAnimal);
    if (!matched) {
      await api.sendMessage(
        { msg: "⚠️ Linh vật không hợp lệ! Vui lòng chọn: bau, cua, tom, ca, ga, nai.", quote: message },
        message.threadId,
        message.type
      );
      return { handled: true, success: false };
    }

    // Trừ tiền ngay lập tức
    updatePlayerBalance(senderId, -betAmount.toString());

    // Cập nhật hoặc thêm cược
    const existingSameAnimal = session.bets.find((b) => b.uid === senderId && b.animal.id === matched.id);
    if (existingSameAnimal) {
      existingSameAnimal.amount = existingSameAnimal.amount.plus(betAmount);
    } else {
      session.bets.push({ uid: senderId, name: senderName, animal: matched, amount: betAmount });
    }

    let totalPool = new Big(0);
    session.bets.forEach((b) => {
      totalPool = totalPool.plus(b.amount);
    });

    const confirmMsg =
      `✅ **${senderName}** đã cược **${formatCurrency(betAmount.toString())} VNĐ** vào **[${matched.icon} ${matched.name}]**!\n` +
      `📊 Toàn bàn: ${session.bets.length} lượt cược  •  Tổng cược: ${formatCurrency(totalPool.toString())} VNĐ\n` +
      `⏳ Còn lại: ${secondsLeft} giây`;

    await api.sendMessage({ msg: confirmMsg, quote: message }, message.threadId, message.type);
    return { handled: true, success: true };
  }

  return { handled: false };
}

async function resolveTaiXiuSession(api, threadId, session, messageObj) {
  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  const d3 = Math.floor(Math.random() * 6) + 1;
  const dice = [d1, d2, d3];
  const total = d1 + d2 + d3;
  const isBao = d1 === d2 && d2 === d3;
  const resultType = isBao ? "BÃO" : total >= 11 ? "TÀI" : "XỈU";

  const winners = [];
  const losers = [];
  let totalPool = new Big(0);
  let totalWin = new Big(0);

  session.bets.forEach((bet) => {
    totalPool = totalPool.plus(bet.amount);
    const isWin = !isBao && bet.choice === resultType;

    if (isWin) {
      const profit = bet.amount;
      recordMultiplayerGameResult(bet.uid, true, bet.amount.toString(), profit.toString());
      winners.push({
        uid: bet.uid,
        name: bet.name,
        choice: bet.choice,
        label: bet.choice,
        amount: bet.amount.toString(),
        profit: profit.toString()
      });
      totalWin = totalWin.plus(profit);
    } else {
      recordMultiplayerGameResult(bet.uid, false, bet.amount.toString(), "0");
      losers.push({
        uid: bet.uid,
        name: bet.name,
        choice: bet.choice,
        label: bet.choice,
        amount: bet.amount.toString()
      });
    }
  });

  let txSummaryText =
    `🎲═════════════════════════🎲\n` +
    `   🔥 KẾT QUẢ TÀI XỈU CỘNG ĐỒNG 🔥\n` +
    `🎲═════════════════════════🎲\n` +
    `🎲 Xúc xắc: [ ${d1} ] - [ ${d2} ] - [ ${d3} ] ➔ ${total} điểm (${resultType})\n\n`;

  if (winners.length > 0) {
    txSummaryText += `🏆 THẮNG CƯỢC (${winners.length} người):\n`;
    winners.slice(0, 5).forEach((w) => {
      txSummaryText += `  • ${w.name}: +${formatCurrency(w.profit)} VNĐ [${w.choice}]\n`;
    });
    if (winners.length > 5) txSummaryText += `  • ... và ${winners.length - 5} người khác\n`;
  } else {
    txSummaryText += `💀 Không có người chơi nào thắng phiên này!\n`;
  }

  if (losers.length > 0) {
    txSummaryText += `\n💀 THUA CƯỢC (${losers.length} người):\n`;
    losers.slice(0, 5).forEach((l) => {
      txSummaryText += `  • ${l.name}: -${formatCurrency(l.amount)} VNĐ [${l.choice}]\n`;
    });
    if (losers.length > 5) txSummaryText += `  • ... và ${losers.length - 5} người khác\n`;
  }

  txSummaryText += `\n💰 Tổng trả thưởng toàn sàn: +${formatCurrency(totalWin.toString())} VNĐ`;

  let imagePath = null;
  try {
    imagePath = await createMultiplayerTaiXiuImage({
      dice,
      total,
      resultType,
      winners,
      losers,
      totalBetsCount: session.bets.length,
      totalPoolAmount: totalPool.toString(),
      totalWinAmount: totalWin.toString()
    });
  } catch (canvasErr) {
    console.error('Lỗi khi vẽ ảnh kết quả Tài Xỉu bàn:', canvasErr);
  }

  try {
    await api.sendMessage(
      { msg: txSummaryText, attachments: imagePath ? [imagePath] : [] },
      threadId,
      messageObj?.type
    );
  } catch (sendErr) {
    console.error('Lỗi khi gửi kết quả TX bàn, fallback text:', sendErr.message);
    try {
      await api.sendMessage({ msg: txSummaryText }, threadId, messageObj?.type);
    } catch (_) {}
  } finally {
    if (imagePath) clearImagePath(imagePath).catch(() => {});
  }
}


async function resolveBauCuaSession(api, threadId, session, messageObj) {
  const roll1 = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const roll2 = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const roll3 = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const rolled = [roll1, roll2, roll3];

  const winners = [];
  const losers = [];
  let totalPool = new Big(0);
  let totalWin = new Big(0);

  session.bets.forEach((bet) => {
    totalPool = totalPool.plus(bet.amount);
    const matches = rolled.filter((r) => r.id === bet.animal.id).length;
    const isWin = matches > 0;

    if (isWin) {
      const profit = bet.amount.mul(matches);
      recordMultiplayerGameResult(bet.uid, true, bet.amount.toString(), profit.toString());
      winners.push({
        uid: bet.uid,
        name: bet.name,
        animalName: bet.animal.name,
        animalIcon: bet.animal.icon,
        label: `${bet.animal.icon} x${matches}`,
        amount: bet.amount.toString(),
        matches,
        profit: profit.toString()
      });
      totalWin = totalWin.plus(profit);
    } else {
      recordMultiplayerGameResult(bet.uid, false, bet.amount.toString(), "0");
      losers.push({
        uid: bet.uid,
        name: bet.name,
        animalName: bet.animal.name,
        animalIcon: bet.animal.icon,
        label: bet.animal.icon,
        amount: bet.amount.toString()
      });
    }
  });

  const rolledNames = rolled.map((r) => `${r.icon} ${r.name}`).join(' - ');
  let bcSummaryText =
    `🎋═════════════════════════🎋\n` +
    `   🔥 KẾT QUẢ BẦU CUA CỘNG ĐỒNG 🔥\n` +
    `🎋═════════════════════════🎋\n` +
    `🎲 Đĩa mở ra: [ ${rolledNames} ]\n\n`;

  if (winners.length > 0) {
    bcSummaryText += `🏆 THẮNG CƯỢC (${winners.length} người):\n`;
    winners.slice(0, 5).forEach((w) => {
      bcSummaryText += `  • ${w.name}: +${formatCurrency(w.profit)} VNĐ [${w.animalIcon} x${w.matches}]\n`;
    });
    if (winners.length > 5) bcSummaryText += `  • ... và ${winners.length - 5} người khác\n`;
  } else {
    bcSummaryText += `💀 Không có ai đoán trúng ván này!\n`;
  }

  if (losers.length > 0) {
    bcSummaryText += `\n💀 THUA CƯỢC (${losers.length} người):\n`;
    losers.slice(0, 5).forEach((l) => {
      bcSummaryText += `  • ${l.name}: -${formatCurrency(l.amount)} VNĐ [${l.animalIcon}]\n`;
    });
    if (losers.length > 5) bcSummaryText += `  • ... và ${losers.length - 5} người khác\n`;
  }

  bcSummaryText += `\n💰 Tổng trả thưởng toàn sàn: +${formatCurrency(totalWin.toString())} VNĐ`;

  let imagePath = null;
  try {
    imagePath = await createMultiplayerBauCuaImage({
      rolled,
      winners,
      losers,
      totalBetsCount: session.bets.length,
      totalPoolAmount: totalPool.toString(),
      totalWinAmount: totalWin.toString()
    });
  } catch (canvasErr) {
    console.error('Lỗi khi vẽ ảnh kết quả Bầu Cua bàn:', canvasErr);
  }

  try {
    await api.sendMessage(
      { msg: bcSummaryText, attachments: imagePath ? [imagePath] : [] },
      threadId,
      messageObj?.type
    );
  } catch (sendErr) {
    console.error('Lỗi khi gửi kết quả BC bàn, fallback text:', sendErr.message);
    try {
      await api.sendMessage({ msg: bcSummaryText }, threadId, messageObj?.type);
    } catch (_) {}
  } finally {
    if (imagePath) clearImagePath(imagePath).catch(() => {});
  }
}


export async function resolveGameSession(api, threadId, messageObj = null) {
  const tId = String(threadId);
  const session = activeSessions.get(tId);
  if (!session) return;

  session.isLocked = true;
  if (session.warnTimer) clearTimeout(session.warnTimer);
  if (session.endTimer) clearTimeout(session.endTimer);

  if (!session.bets || session.bets.length === 0) {
    activeSessions.delete(tId);
    const gameName = session.gameType === "taixiu" ? "Tài Xỉu" : "Bầu Cua";
    await api.sendMessage(
      {
        msg: `🔔 **HẾT GIỜ CƯỢC!**\nPhiên cược **${gameName}** đã kết thúc nhưng không có ai tham gia cược. Bàn cược đã tự động đóng!`
      },
      threadId,
      messageObj?.type
    );
    return;
  }

  try {
    if (session.gameType === "taixiu") {
      await resolveTaiXiuSession(api, threadId, session, messageObj);
    } else if (session.gameType === "baucua") {
      await resolveBauCuaSession(api, threadId, session, messageObj);
    }
  } catch (err) {
    console.error("Lỗi khi kết thúc bàn cược:", err);
  } finally {
    activeSessions.delete(tId);
  }
}

export async function cancelGameSession(api, threadId, reason = "Hủy bởi quản trị viên", messageObj = null) {
  const tId = String(threadId);
  const session = activeSessions.get(tId);
  if (!session) return false;

  session.isLocked = true;
  if (session.warnTimer) clearTimeout(session.warnTimer);
  if (session.endTimer) clearTimeout(session.endTimer);

  // Hoàn tiền 100% cho tất cả người cược
  session.bets.forEach((b) => {
    refundPlayerBalance(b.uid, b.amount.toString());
  });

  activeSessions.delete(tId);

  const gameName = session.gameType === "taixiu" ? "Tài Xỉu" : "Bầu Cua";
  const refundMsg =
    `⚠️ **BÀN CƯỢC ${gameName.toUpperCase()} ĐÃ ĐƯỢC HỦY!**\n` +
    `📌 Lý do: ${reason}\n` +
    `💰 Toàn bộ tiền cược của **${session.bets.length} lượt cược** đã được hoàn trả 100% vào số dư ví của các người chơi!`;

  await api.sendMessage({ msg: refundMsg, quote: messageObj }, threadId, messageObj?.type);
  return true;
}

export function getSessionStatusText(threadId) {
  const tId = String(threadId);
  const session = activeSessions.get(tId);
  if (!session) return null;

  const secondsLeft = Math.max(0, Math.ceil((session.endsAt - Date.now()) / 1000));
  const gameName = session.gameType === "taixiu" ? "Tài Xỉu" : "Bầu Cua";

  let totalPool = new Big(0);
  session.bets.forEach((b) => {
    totalPool = totalPool.plus(b.amount);
  });

  if (session.gameType === "taixiu") {
    let totalTai = new Big(0);
    let countTai = 0;
    let totalXiu = new Big(0);
    let countXiu = 0;

    session.bets.forEach((b) => {
      if (b.choice === "TÀI") {
        totalTai = totalTai.plus(b.amount);
        countTai++;
      } else {
        totalXiu = totalXiu.plus(b.amount);
        countXiu++;
      }
    });

    return (
      `🎲 **TRẠNG THÁI BÀN CƯỢC TÀI XỈU** 🎲\n` +
      `👑 Mở bởi: ${session.opener.name}\n` +
      `⏳ Còn lại: **${secondsLeft} giây**\n` +
      `📊 Cửa TÀI: ${formatCurrency(totalTai.toString())} VNĐ (${countTai} cược)\n` +
      `📊 Cửa XỈU: ${formatCurrency(totalXiu.toString())} VNĐ (${countXiu} cược)\n` +
      `💰 Tổng cược sàn: ${formatCurrency(totalPool.toString())} VNĐ`
    );
  } else {
    return (
      `🎋 **TRẠNG THÁI BÀN CƯỢC BẦU CUA** 🎋\n` +
      `👑 Mở bởi: ${session.opener.name}\n` +
      `⏳ Còn lại: **${secondsLeft} giây**\n` +
      `👥 Tổng số lượt cược: ${session.bets.length}\n` +
      `💰 Tổng cược sàn: ${formatCurrency(totalPool.toString())} VNĐ`
    );
  }
}


export async function handleQuickBetChat(api, message) {
  const threadId = message.threadId;
  if (!threadId) return false;

  if (isSessionActive(threadId)) {
    const session = getActiveSession(threadId);
    if (!session) return false;

    const rawText = typeof message.data?.content === "string" ? message.data.content.trim() : "";
    if (!rawText) return false;

    if (session.gameType === "taixiu") {
      const match = rawText.match(/^(tai|xiu|t|x)\s+([0-9a-zA-Z%]+)$/i);
      if (match) {
        const res = await placeSessionBet(api, message, "taixiu", match[1], match[2]);
        return !!res.handled;
      }
    } else if (session.gameType === "baucua") {
      const match = rawText.match(/^(bau|cua|tom|ca|ga|nai|bầu|tôm|cá|gà)\s+([0-9a-zA-Z%]+)$/i);
      if (match) {
        const res = await placeSessionBet(api, message, "baucua", match[1], match[2]);
        return !!res.handled;
      }
    }
  }

  return false;
}


