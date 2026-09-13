import { getGamePrefix } from "./player-data.js";

export async function handleGameMenuCommand(api, message) {
  const prefix = getGamePrefix();
  const threadId = message.threadId;

  const menu =
    `🎮 HỆ THỐNG GAME & KINH TẾ BOT 🎮\n` +
    `═════════════════════════\n\n` +
    `💰 1. HỆ THỐNG VÍ & TÀI CHÍNH:\n` +
    `• ${prefix}diemdanh (hoặc ${prefix}daily): Điểm danh nhận 20k - 60k xu (có tỉ lệ nổ hũ x2!)\n` +
    `• ${prefix}vi (hoặc ${prefix}balance, ${prefix}tien): Xem thẻ game cá nhân & số dư\n` +
    `• ${prefix}vi @tag: Xem thẻ game của người được tag\n` +
    `• ${prefix}bank @tag [số_tiền]: Chuyển xu cho người khác\n` +
    `• ${prefix}top: Bảng xếp hạng Top 10 đại gia\n\n` +
    `🎲 2. CÁC TRÒ CHƠI GIẢI TRÍ:\n` +
    `• ${prefix}tx [tai/xiu] [tiền]: Chơi Tài Xỉu (Vẽ xúc xắc 3D)\n` +
    `   Ví dụ: ${prefix}tx tai 50k | ${prefix}tx xiu all\n` +
    `• ${prefix}bc [linh_vật] [tiền]: Chơi Bầu Cua Tôm Cá\n` +
    `   (Linh vật: bau, cua, tom, ca, ga, nai)\n` +
    `   Ví dụ: ${prefix}bc bau 50k | ${prefix}bc ca 100k\n` +
    `• ${prefix}kbb [keo/bua/bao] [tiền]: Solo Kéo Búa Bao\n` +
    `   Ví dụ: ${prefix}kbb keo 20k | ${prefix}kbb bua 50%\n\n` +
    `💡 Mẹo cược: Hỗ trợ viết tắt như 10k, 50k, 1m, 50%, allin/all.\n` +
    `═════════════════════════\n` +
    `Chúc bạn chơi game vui vẻ và may mắn! 🍀`;

  await api.sendMessage({ msg: menu, quote: message }, threadId, message.type);
}
