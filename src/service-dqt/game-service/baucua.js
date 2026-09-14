import { getOrCreatePlayer, recordGameResult, getGamePrefix } from "./player-data.js";
import { createBauCuaImage } from "./game-canvas.js";
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

export const ANIMALS = [
  { id: "bau", name: "Bầu", icon: "🍐", aliases: ["bau", "bầu"] },
  { id: "cua", name: "Cua", icon: "🦀", aliases: ["cua"] },
  { id: "tom", name: "Tôm", icon: "🦐", aliases: ["tom", "tôm"] },
  { id: "ca", name: "Cá", icon: "🐟", aliases: ["ca", "cá"] },
  { id: "ga", name: "Gà", icon: "🐓", aliases: ["ga", "gà"] },
  { id: "nai", name: "Nai", icon: "🦌", aliases: ["nai"] }
];

export async function handleBauCuaCommand(api, message, aliasCommand) {
  const prefix = getGamePrefix();
  const senderId = message.data.uidFrom;
  const senderName = message.data.dName || "Người Chơi";
  const threadId = message.threadId;

  const player = getOrCreatePlayer(senderId, senderName);

  let rawContent = removeMention(message).trim();
  rawContent = rawContent.replace(new RegExp(`^${prefix}${aliasCommand}`, "i"), "").trim();
  const parts = rawContent.split(/\s+/).filter(Boolean);
  const subCmd = parts[0]?.toLowerCase();

  // Xem trạng thái bàn
  if (subCmd === "status" || subCmd === "st" || subCmd === "tt") {
    const statusText = getSessionStatusText(threadId);
    if (!statusText) {
      await api.sendMessage(
        { msg: `ℹ️ Hiện tại không có bàn cược Bầu Cua nào đang mở trong nhóm.\n💡 Dùng \`${prefix}bc open\` hoặc \`${prefix}bcb\` để mở bàn mới 60s!`, quote: message },
        threadId,
        message.type
      );
    } else {
      await api.sendMessage({ msg: statusText, quote: message }, threadId, message.type);
    }
    return;
  }

  // Hủy bàn
  if (subCmd === "cancel" || subCmd === "huy") {
    const canceled = await cancelGameSession(api, threadId, `Hủy bởi ${senderName}`, message);
    if (!canceled) {
      await api.sendMessage({ msg: "ℹ️ Hiện không có bàn cược nào đang mở để hủy.", quote: message }, threadId, message.type);
    }
    return;
  }

  // Mở bàn: /bc open hoặc /bcb
  const isBcbAlias = aliasCommand === "bcb" || aliasCommand === "baucuaban";
  if (subCmd === "open" || subCmd === "ban" || subCmd === "phien" || (isBcbAlias && !isSessionActive(threadId))) {
    let initialBet = null;
    const betArgStart = subCmd === "open" || subCmd === "ban" || subCmd === "phien" ? 1 : 0;
    if (parts[betArgStart] && parts[betArgStart + 1]) {
      initialBet = { choice: parts[betArgStart], amountStr: parts[betArgStart + 1] };
    }
    await openGameSession(api, threadId, "baucua", { uid: senderId, name: senderName }, initialBet, message);
    return;
  }

  // Nếu trong nhóm đang có bàn cược mở, chuyển cược vào bàn cộng đồng
  if (isSessionActive(threadId)) {
    const session = getActiveSession(threadId);
    if (session && session.gameType === "baucua") {
      if (parts.length >= 2) {
        await placeSessionBet(api, message, "baucua", parts[0], parts[1]);
        return;
      } else {
        const statusText = getSessionStatusText(threadId);
        await api.sendMessage(
          {
            msg: `⚠️ Bàn cược Bầu Cua đang mở!\n${statusText}\n👉 Đặt cược: \`${prefix}bc [linh_vật] [tiền]\` hoặc gõ nhanh \`cua 50k\`, \`bau 100k\``,
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
      `🎋 HƯỚNG DẪN CHƠI BẦU CUA TÔM CÁ 🎋\n═════════════════════\n` +
      `📌 Chế độ Solo (ăn thua ngay lập tức):\n` +
      `  • ${prefix}bc [linh_vật] [số_tiền]\n` +
      `  • Ví dụ: ${prefix}bc bau 50k | ${prefix}bc ca 100k | ${prefix}bc tom all\n\n` +
      `🔥 Chế độ Bàn Cược Nhóm (60s cả nhóm cùng cược):\n` +
      `  • ${prefix}bc open (hoặc ${prefix}bcb): Mở bàn cược 60 giây\n` +
      `  • Khi bàn mở, gõ nhanh: cua 50k, bau 100k, tom all\n` +
      `  • ${prefix}bc status: Xem trạng thái cược bàn\n` +
      `  • ${prefix}bc cancel: Hủy bàn hoàn tiền 100%\n\n` +
      `🐾 Linh vật: 🍐 bau (Bầu) | 🦀 cua (Cua) | 🦐 tom (Tôm) | 🐟 ca (Cá) | 🐓 ga (Gà) | 🦌 nai (Nai)\n` +
      `📜 Trả thưởng: Trúng 1 con: x1, 2 con: x2, 3 con: x3!\n` +
      `💰 Số dư hiện tại của bạn: ${formatCurrency(player.balance)} VNĐ`;
    await api.sendMessage({ msg: guideMsg, quote: message }, threadId, message.type);
    return;
  }


  const inputAnimal = parts[0].toLowerCase();
  const matchedAnimal = ANIMALS.find((a) => a.aliases.includes(inputAnimal) || a.id === inputAnimal);

  if (!matchedAnimal) {
    await api.sendMessage(
      { msg: "⚠️ Linh vật không hợp lệ! Chọn: bau, cua, tom, ca, ga, nai.", quote: message },
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
        msg: `⚠️ Số dư của bạn không đủ! Hiện tại bạn có: ${formatCurrency(player.balance)} VNĐ.`,
        quote: message
      },
      threadId,
      message.type
    );
    return;
  }

  // Lắc 3 con ngẫu nhiên
  const roll1 = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const roll2 = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const roll3 = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const rolled = [roll1, roll2, roll3];

  const matches = rolled.filter((r) => r.id === matchedAnimal.id).length;
  const isWin = matches > 0;
  const winProfit = isWin ? betAmount.mul(matches) : new Big(0);

  const updatedPlayer = recordGameResult(
    senderId,
    isWin,
    betAmount.toString(),
    winProfit.toString()
  );

  const rolledIcons = rolled.map((r) => `${r.icon} ${r.name}`).join(' - ');
  const summaryText =
    `🎋 KẾT QUẢ BẦU CUA TÔM CÁ 🎋\n` +
    `👤 Người chơi: ${senderName}\n` +
    `🎯 Cửa đặt: ${matchedAnimal.icon} ${matchedAnimal.name} - ${formatCurrency(betAmount.toString())} VNĐ\n` +
    `🎲 Lắc ra: ${rolledIcons}\n` +
    `${isWin ? `🎉 TRÚNG ${matches} CON (+${formatCurrency(winProfit.toString())} VNĐ)` : `💀 KHÔNG TRÚNG CON NÀO (-${formatCurrency(betAmount.toString())} VNĐ)`}\n` +
    `💰 Số dư hiện tại: ${formatCurrency(updatedPlayer.balance)} VNĐ`;

  let imagePath = null;
  try {
    imagePath = await createBauCuaImage({
      rolled,
      betAnimal: matchedAnimal,
      matches,
      isWin,
      betAmount: betAmount.toString(),
      winProfit: winProfit.toString(),
      balance: updatedPlayer.balance,
      playerName: senderName
    });
  } catch (canvasErr) {
    console.error('Lỗi khi tạo ảnh Bầu Cua:', canvasErr);
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
    console.error('Lỗi khi gửi kết quả Bầu Cua, fallback text:', sendErr.message);
    try {
      await api.sendMessage({ msg: summaryText, quote: message }, threadId, message.type);
    } catch (_) {}
  } finally {
    if (imagePath) clearImagePath(imagePath).catch(() => {});
  }
}
