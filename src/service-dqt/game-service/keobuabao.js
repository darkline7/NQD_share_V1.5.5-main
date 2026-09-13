import { getOrCreatePlayer, recordGameResult, getGamePrefix } from "./player-data.js";
import { createKBBImage } from "./game-canvas.js";
import { clearImagePath } from "../../utils/canvas/index.js";
import { formatCurrency, parseGameAmount, removeMention } from "../../utils/format-util.js";
import Big from "big.js";

const CHOICES = {
  keo: { id: "keo", name: "Kéo", icon: "✌️", beats: "bao" },
  bua: { id: "bua", name: "Búa", icon: "✊", beats: "keo" },
  bao: { id: "bao", name: "Bao", icon: "✋", beats: "bua" }
};

export async function handleKBBCommand(api, message, aliasCommand) {
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
      `⚔️ HƯỚNG DẪN KÉO BÚA BAO ⚔️\n═════════════════════\n` +
      `📌 Cú pháp: ${prefix}${aliasCommand} [keo/bua/bao] [số_tiền]\n` +
      `💡 Ví dụ: ${prefix}kbb keo 20k | ${prefix}kbb bua 50k | ${prefix}kbb bao all\n` +
      `📜 Quy tắc: Kéo ✌️ cắt Bao ✋, Bao ✋ bọc Búa ✊, Búa ✊ đập Kéo ✌️.\n` +
      `💰 Số dư hiện tại của bạn: ${formatCurrency(player.balance)} VNĐ`;
    await api.sendMessage({ msg: guideMsg, quote: message }, threadId, message.type);
    return;
  }

  const rawUserChoice = parts[0].toLowerCase();
  let userChoice = null;
  if (rawUserChoice === "keo" || rawUserChoice === "k") userChoice = CHOICES.keo;
  else if (rawUserChoice === "bua" || rawUserChoice === "b") userChoice = CHOICES.bua;
  else if (rawUserChoice === "bao") userChoice = CHOICES.bao;

  if (!userChoice) {
    await api.sendMessage(
      { msg: "⚠️ Lựa chọn không hợp lệ! Vui lòng chọn 'keo', 'bua' hoặc 'bao'.", quote: message },
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
      { msg: `⚠️ Số dư của bạn không đủ! Hiện tại bạn có: ${formatCurrency(player.balance)} VNĐ.`, quote: message },
      threadId,
      message.type
    );
    return;
  }

  // Bot random kéo, búa, bao
  const keys = Object.keys(CHOICES);
  const botChoice = CHOICES[keys[Math.floor(Math.random() * keys.length)]];

  let result = "draw";
  let winProfit = new Big(0);

  if (userChoice.id === botChoice.id) {
    result = "draw";
  } else if (userChoice.beats === botChoice.id) {
    result = "win";
    winProfit = betAmount;
  } else {
    result = "lose";
  }

  let updatedPlayer = player;
  if (result === "win") {
    updatedPlayer = recordGameResult(senderId, true, betAmount.toString(), winProfit.toString());
  } else if (result === "lose") {
    updatedPlayer = recordGameResult(senderId, false, betAmount.toString(), "0");
  }

  let imagePath = null;
  try {
    imagePath = await createKBBImage({
      userChoice,
      botChoice,
      result,
      betAmount: betAmount.toString(),
      winProfit: winProfit.toString(),
      balance: updatedPlayer.balance,
      playerName: senderName
    });

    let statusText = "";
    if (result === "win") statusText = `🎉 BẠN THẮNG: +${formatCurrency(winProfit.toString())} VNĐ`;
    else if (result === "lose") statusText = `💀 BẠN THUA: -${formatCurrency(betAmount.toString())} VNĐ`;
    else statusText = `🤝 HÒA NHAU (Hoàn lại ${formatCurrency(betAmount.toString())} VNĐ)`;

    const summaryText =
      `⚔️ KÉO BÚA BAO ⚔️\n` +
      `👤 ${senderName} ra: ${userChoice.icon} ${userChoice.name}\n` +
      `🤖 Bot ra: ${botChoice.icon} ${botChoice.name}\n` +
      `${statusText}\n` +
      `💰 Số dư hiện tại: ${formatCurrency(updatedPlayer.balance)} VNĐ`;

    await api.sendMessage(
      { msg: summaryText, attachments: [imagePath], quote: message },
      threadId,
      message.type
    );
  } catch (error) {
    console.error("Lỗi khi tạo ảnh KBB:", error);
    let statusText = "";
    if (result === "win") statusText = `🎉 BẠN THẮNG: +${formatCurrency(winProfit.toString())} VNĐ`;
    else if (result === "lose") statusText = `💀 BẠN THUA: -${formatCurrency(betAmount.toString())} VNĐ`;
    else statusText = `🤝 HÒA NHAU (Hoàn tiền)`;

    const textOnly =
      `⚔️ KÉO BÚA BAO ⚔️\n` +
      `👤 ${senderName}: ${userChoice.icon} ${userChoice.name}\n` +
      `🤖 Bot: ${botChoice.icon} ${botChoice.name}\n` +
      `${statusText}\n` +
      `💰 Số dư: ${formatCurrency(updatedPlayer.balance)} VNĐ`;
    await api.sendMessage({ msg: textOnly, quote: message }, threadId, message.type);
  } finally {
    if (imagePath) {
      await clearImagePath(imagePath);
    }
  }
}
