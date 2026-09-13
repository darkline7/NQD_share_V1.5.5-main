import {
  getOrCreatePlayer,
  claimDailyReward,
  transferBalance,
  getLeaderboard,
  setPlayerBalance,
  updatePlayerBalance,
  getGamePrefix
} from "./player-data.js";
import { createUserCardGame } from "../../utils/canvas/info.js";
import { clearImagePath } from "../../utils/canvas/index.js";
import { formatCurrency, parseGameAmount, removeMention } from "../../utils/format-util.js";
import Big from "big.js";

async function getUserInfo(api, userId) {
  try {
    const res = await api.getUserInfo(userId);
    return res?.unchanged_profiles?.[userId] || res?.changed_profiles?.[userId] || null;
  } catch (error) {
    return null;
  }
}

export async function handleDailyCommand(api, message) {
  const senderId = message.data.uidFrom;
  const senderName = message.data.dName || "Người Chơi";
  const threadId = message.threadId;

  const result = claimDailyReward(senderId, senderName);

  if (!result.success) {
    const text =
      `⏳ Bạn đã nhận thưởng điểm danh hôm nay rồi!\n` +
      `⏰ Vui lòng quay lại sau 00:00 nhé (còn ${result.hoursRemaining} giờ ${result.minutesRemaining} phút).\n` +
      `💰 Số dư hiện tại: ${formatCurrency(result.player.balance)} VNĐ`;
    await api.sendMessage({ msg: text, quote: message }, threadId, message.type);
    return;
  }

  const bonusNotice = result.isLuckyDouble ? "\n🎉💥 NỔ HŨ X2 MAY MẮN! 💥🎉" : "";
  const text =
    `🎁 ĐIỂM DANH HÀNG NGÀY THÀNH CÔNG 🎁${bonusNotice}\n` +
    `👤 Người nhận: ${senderName}\n` +
    `💰 Phần thưởng: +${formatCurrency(result.reward)} VNĐ\n` +
    `💵 Số dư hiện tại: ${formatCurrency(result.newBalance)} VNĐ\n\n` +
    `👉 Dùng /tx hoặc /bc để nhân đôi số tiền này nhé!`;

  await api.sendMessage({ msg: text, quote: message }, threadId, message.type);
}

export async function handleWalletCommand(api, message, aliasCommand) {
  const senderId = message.data.uidFrom;
  const senderName = message.data.dName || "Người Chơi";
  const threadId = message.threadId;

  const targetUserId = message.data.mentions?.[0]?.uid || senderId;
  const isSelf = targetUserId === senderId;

  let userInfo = null;
  try {
    userInfo = await getUserInfo(api, targetUserId);
  } catch (e) {
    // Ignore userInfo fetch error
  }

  const targetName = isSelf ? senderName : (userInfo?.name || "Người Chơi");
  const player = getOrCreatePlayer(targetUserId, targetName);

  const playerInfo = {
    account: targetUserId,
    playerName: userInfo?.name || targetName,
    avatar: userInfo?.avatar || "",
    balance: player.balance || "0",
    totalWinnings: player.totalWinnings || "0",
    totalLosses: player.totalLosses || "0",
    netProfit: player.netProfit || "0",
    totalGames: player.totalGames || 0,
    totalWinGames: player.totalWinGames || 0,
    winRate: player.totalGames > 0 ? ((player.totalWinGames / player.totalGames) * 100).toFixed(2) : "0.00",
    registrationTime: player.registrationTime || "2026-01-01 00:00:00",
    lastDailyReward: player.lastDailyReward || "Chưa nhận",
    title: "THÔNG TIN TÀI KHOẢN GAME",
    isOnline: true,
    isActive: true,
    isActivePC: false,
    isActiveWeb: false,
  };

  let imagePath = null;
  try {
    imagePath = await createUserCardGame(playerInfo);
    await api.sendMessage(
      { msg: "", attachments: [imagePath], quote: message },
      threadId,
      message.type
    );
  } catch (error) {
    console.error("Lỗi khi tạo user card game:", error);
    const fallbackText =
      `💳 THÔNG TIN VÍ GAME 💳\n` +
      `👤 Chủ ví: ${targetName}\n` +
      `💰 Số dư: ${formatCurrency(player.balance)} VNĐ\n` +
      `🎮 Số trận đã chơi: ${player.totalGames} (${player.totalWinGames}W / ${(player.totalGames - player.totalWinGames)}L)\n` +
      `📊 Tỉ lệ thắng: ${player.winRate}%\n` +
      `🏆 Tổng thắng: ${formatCurrency(player.totalWinnings)} VNĐ\n` +
      `💸 Tổng thua: ${formatCurrency(player.totalLosses)} VNĐ\n` +
      `🎁 Nhận quà daily gần nhất: ${player.lastDailyReward || "Chưa nhận"}`;
    await api.sendMessage({ msg: fallbackText, quote: message }, threadId, message.type);
  } finally {
    if (imagePath) {
      await clearImagePath(imagePath);
    }
  }
}


export async function handleBankCommand(api, message, aliasCommand) {
  const prefix = getGamePrefix();
  const senderId = message.data.uidFrom;
  const senderName = message.data.dName || "Người Chơi";
  const threadId = message.threadId;

  const targetUserId = message.data.mentions?.[0]?.uid;
  if (!targetUserId) {
    const helpMsg =
      `⚠️ Cú pháp chuyển tiền chưa đúng!\n` +
      `📌 Cách dùng: ${prefix}bank @người_nhận [số_tiền]\n` +
      `💡 Ví dụ: ${prefix}bank @Bình 50k\n` +
      `Hỗ trợ số tiền: 10k, 1m, 50%, all...`;
    await api.sendMessage({ msg: helpMsg, quote: message }, threadId, message.type);
    return;
  }

  if (targetUserId === senderId) {
    await api.sendMessage({ msg: "⚠️ Bạn không thể chuyển tiền cho chính mình!", quote: message }, threadId, message.type);
    return;
  }

  const senderPlayer = getOrCreatePlayer(senderId, senderName);
  let content = removeMention(message);
  content = content.replace(new RegExp(`^${prefix}${aliasCommand}`, "i"), "").trim();

  // Tìm phần số tiền trong chuỗi
  const parts = content.split(/\s+/).filter(Boolean);
  const amountStr = parts[parts.length - 1];

  let amount = null;
  try {
    amount = parseGameAmount(amountStr, senderPlayer.balance);
    if (amount === "allin" || amount === "all") {
      amount = new Big(senderPlayer.balance);
    }
  } catch (err) {
    await api.sendMessage({ msg: `⚠️ ${err.message}`, quote: message }, threadId, message.type);
    return;
  }

  if (!amount || amount.lte(0)) {
    await api.sendMessage({ msg: "⚠️ Số tiền chuyển phải lớn hơn 0 VNĐ!", quote: message }, threadId, message.type);
    return;
  }

  if (amount.lt(1000)) {
    await api.sendMessage({ msg: "⚠️ Số tiền chuyển tối thiểu là 1.000 VNĐ!", quote: message }, threadId, message.type);
    return;
  }

  if (new Big(senderPlayer.balance).lt(amount)) {
    await api.sendMessage(
      { msg: `⚠️ Số dư của bạn không đủ! Hiện tại bạn có: ${formatCurrency(senderPlayer.balance)} VNĐ.`, quote: message },
      threadId,
      message.type
    );
    return;
  }

  let targetUserInfo = null;
  try {
    targetUserInfo = await getUserInfo(api, targetUserId);
  } catch (e) {
    // Ignore error
  }
  const targetName = targetUserInfo?.name || "Người Nhận";

  try {
    const transferRes = transferBalance(senderId, targetUserId, amount.toString(), senderName, targetName);
    const successMsg =
      `💸 GIAO DỊCH CHUYỂN TIỀN THÀNH CÔNG 💸\n` +
      `📤 Người gửi: ${senderName}\n` +
      `📥 Người nhận: ${targetName}\n` +
      `💵 Số tiền: ${formatCurrency(amount.toString())} VNĐ\n` +
      `💰 Số dư còn lại: ${formatCurrency(transferRes.fromBalance)} VNĐ`;
    await api.sendMessage({ msg: successMsg, quote: message }, threadId, message.type);
  } catch (error) {
    await api.sendMessage({ msg: `❌ Lỗi giao dịch: ${error.message}`, quote: message }, threadId, message.type);
  }
}

export async function handleTopCommand(api, message) {
  const threadId = message.threadId;
  const topList = getLeaderboard(10);

  if (topList.length === 0) {
    await api.sendMessage({ msg: "Hiện tại chưa có người chơi nào trong bảng xếp hạng!", quote: message }, threadId, message.type);
    return;
  }

  const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
  let text = "🏆 BẢNG XẾP HẠNG ĐẠI GIA GAME 🏆\n═════════════════════\n";

  topList.forEach((p, idx) => {
    const medal = medals[idx] || `${idx + 1}.`;
    text += `${medal} ${p.playerName}\n   💰 ${formatCurrency(p.balance)} VNĐ | 🎮 ${p.totalGames} trận (${p.winRate}%)\n`;
  });

  text += "═════════════════════\n💡 Chăm chỉ /diemdanh và chơi /tx, /bc để vào Top nhé!";
  await api.sendMessage({ msg: text, quote: message }, threadId, message.type);
}

export async function handleAdminMoneyCommand(api, message, isAdmin) {
  if (!isAdmin) {
    await api.sendMessage({ msg: "🚫 Bạn không có quyền sử dụng lệnh này!", quote: message }, threadId, message.type);
    return;
  }

  const threadId = message.threadId;
  const targetUserId = message.data.mentions?.[0]?.uid;
  if (!targetUserId) {
    await api.sendMessage({ msg: "⚠️ Cần tag người nhận: /givemoney @tag [số_tiền]", quote: message }, threadId, message.type);
    return;
  }

  const content = removeMention(message);
  const parts = content.split(/\s+/).filter(Boolean);
  const amountStr = parts[parts.length - 1];

  let amount = null;
  try {
    amount = parseGameAmount(amountStr, 1000000);
  } catch (e) {
    // Ignore
  }

  if (!amount || amount.lte(0)) {
    await api.sendMessage({ msg: "⚠️ Số tiền không hợp lệ!", quote: message }, threadId, message.type);
    return;
  }

  let targetUserInfo = null;
  try {
    targetUserInfo = await getUserInfo(api, targetUserId);
  } catch (e) {}

  const targetName = targetUserInfo?.name || "Người Chơi";
  const newBal = updatePlayerBalance(targetUserId, amount.toString());

  await api.sendMessage(
    {
      msg: `👑 ADMIN CẤP TIỀN THÀNH CÔNG!\n👤 Người nhận: ${targetName}\n💰 Cấp thêm: +${formatCurrency(amount.toString())} VNĐ\n💵 Số dư mới: ${formatCurrency(newBal)} VNĐ`,
      quote: message
    },
    threadId,
    message.type
  );
}

