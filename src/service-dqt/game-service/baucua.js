import { getOrCreatePlayer, recordGameResult, getGamePrefix } from "./player-data.js";
import { createBauCuaImage } from "./game-canvas.js";
import { clearImagePath } from "../../utils/canvas/index.js";
import { formatCurrency, parseGameAmount, removeMention } from "../../utils/format-util.js";
import Big from "big.js";

const ANIMALS = [
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

  if (parts.length < 2) {
    const guideMsg =
      `🎋 HƯỚNG DẪN CHƠI BẦU CUA TÔM CÁ 🎋\n═════════════════════\n` +
      `📌 Cú pháp: ${prefix}${aliasCommand} [linh_vật] [số_tiền]\n` +
      `🐾 Danh sách linh vật cược:\n` +
      `  • 🍐 bau (Bầu)   • 🦀 cua (Cua)\n` +
      `  • 🦐 tom (Tôm)   • 🐟 ca (Cá)\n` +
      `  • 🐓 ga (Gà)     • 🦌 nai (Nai)\n` +
      `💡 Ví dụ: ${prefix}bc bau 50k | ${prefix}bc ca 100k | ${prefix}bc tom all\n` +
      `📜 Tỉ lệ trả thưởng: Trúng 1 con: x1, 2 con: x2, 3 con: x3!\n` +
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

    const rolledIcons = rolled.map((r) => `${r.icon} ${r.name}`).join(" - ");
    const summaryText =
      `🎋 KẾT QUẢ BẦU CUA TÔM CÁ 🎋\n` +
      `👤 Người chơi: ${senderName}\n` +
      `🎯 Cửa đặt: ${matchedAnimal.icon} ${matchedAnimal.name} - ${formatCurrency(betAmount.toString())} VNĐ\n` +
      `🎲 Lắc ra: ${rolledIcons}\n` +
      `${isWin ? `🎉 TRÚNG ${matches} CON (+${formatCurrency(winProfit.toString())} VNĐ)` : `💀 KHÔNG TRÚNG CON NÀO (-${formatCurrency(betAmount.toString())} VNĐ)`}\n` +
      `💰 Số dư hiện tại: ${formatCurrency(updatedPlayer.balance)} VNĐ`;

    await api.sendMessage(
      { msg: summaryText, attachments: [imagePath], quote: message },
      threadId,
      message.type
    );
  } catch (error) {
    console.error("Lỗi khi tạo ảnh Bầu Cua:", error);
    const rolledIcons = rolled.map((r) => `${r.icon} ${r.name}`).join(" - ");
    const textOnly =
      `🎋 KẾT QUẢ BẦU CUA 🎋\n` +
      `👤 Người chơi: ${senderName}\n` +
      `🎯 Cửa đặt: ${matchedAnimal.name} (${formatCurrency(betAmount.toString())} VNĐ)\n` +
      `🎲 Lắc ra: ${rolledIcons}\n` +
      `${isWin ? `🎉 TRÚNG ${matches} CON (+${formatCurrency(winProfit.toString())} VNĐ)` : `💀 THUA (-${formatCurrency(betAmount.toString())} VNĐ)`}\n` +
      `💰 Số dư mới: ${formatCurrency(updatedPlayer.balance)} VNĐ`;
    await api.sendMessage({ msg: textOnly, quote: message }, threadId, message.type);
  } finally {
    if (imagePath) {
      await clearImagePath(imagePath);
    }
  }
}
