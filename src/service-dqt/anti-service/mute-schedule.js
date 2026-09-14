import schedule from "node-schedule";
import { MessageType } from "zlbotdqt";
import { sendMessageStateQuote, sendMessageWarning } from "../chat-zalo/chat-style/chat-style.js";
import { readGroupSettings, writeGroupSettings } from "../../utils/io-json.js";
import { removeMention } from "../../utils/format-util.js";

function parseHour(str) {
  if (!str) return null;
  const h = parseInt(str.split(":")[0], 10);
  if (isNaN(h) || h < 0 || h > 23) return null;
  return h;
}

function getCurrentHourVN() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" })).getHours();
}

function isInMuteWindow(startHour, endHour) {
  const h = getCurrentHourVN();
  if (startHour <= endHour) return h >= startHour && h < endHour;
  return h >= startHour || h < endHour;
}

/**
 * Lệnh: @mutegiochinh [start] [end]
 * VD: @mutegiochinh 22 6  → mute 22h–6h
 * VD: @mutegiochinh off   → tắt
 * VD: @mutegiochinh       → xem trạng thái
 */
export async function handleMuteScheduleCommand(api, message, groupSettings) {
  const threadId = message.threadId;
  const parts    = removeMention(message).trim().split(/\s+/);
  const arg1 = parts[1];
  const arg2 = parts[2];

  if (!groupSettings[threadId]) groupSettings[threadId] = {};
  if (!groupSettings[threadId].muteSchedule) {
    groupSettings[threadId].muteSchedule = { enabled: false, startHour: 22, endHour: 6 };
  }
  const ms = groupSettings[threadId].muteSchedule;

  if (arg1 === "off") {
    ms.enabled = false;
    writeGroupSettings(groupSettings);
    await sendMessageStateQuote(api, message, "Đã tắt lịch mute tự động theo giờ!", false, 300000);
    return true;
  }

  if (arg1 === "on") {
    ms.enabled = true;
    writeGroupSettings(groupSettings);
    await sendMessageStateQuote(api, message, `Đã bật lịch mute!\n⏰ Khung giờ: ${ms.startHour}h → ${ms.endHour}h`, true, 300000);
    return true;
  }

  if (!arg1) {
    const info = ms.enabled
      ? `🟢 Đang bật\n⏰ Mute: ${ms.startHour}h → ${ms.endHour}h mỗi ngày`
      : "🔴 Đang tắt";
    await api.sendMessage({ msg: `📅 Lịch mute tự động:\n${info}`, quote: message, ttl: 60000 }, threadId, message.type);
    return true;
  }

  const startHour = parseHour(arg1);
  const endHour   = parseHour(arg2);

  if (startHour === null || endHour === null) {
    await sendMessageWarning(api, message, "Cú pháp: @mutegiochinh [giờ_bắt_đầu] [giờ_kết_thúc]\nVí dụ: @mutegiochinh 22 6");
    return false;
  }
  if (startHour === endHour) {
    await sendMessageWarning(api, message, "Giờ bắt đầu và kết thúc không được trùng nhau!");
    return false;
  }

  ms.startHour = startHour;
  ms.endHour   = endHour;
  ms.enabled   = true;
  writeGroupSettings(groupSettings);

  const spanText = startHour > endHour
    ? `${startHour}h đến ${endHour}h sáng hôm sau`
    : `${startHour}h đến ${endHour}h`;
  await sendMessageStateQuote(api, message, `✅ Đã cài lịch mute!\n⏰ Mute từ ${spanText} mỗi ngày`, true, 300000);
  return true;
}

/**
 * Khởi động scheduler kiểm tra lịch mute mỗi phút
 */
export function startMuteScheduleCheck(api) {
  const jobName = "muteScheduleCheck";
  const existing = schedule.scheduledJobs[jobName];
  if (existing) existing.cancel();

  schedule.scheduleJob(jobName, "* * * * *", async () => {
    try {
      const groupSettings = readGroupSettings();
      let hasChanges = false;

      for (const [threadId, settings] of Object.entries(groupSettings)) {
        const ms = settings.muteSchedule;
        if (!ms?.enabled) continue;
        if (!settings.muteList) settings.muteList = {};

        const inWindow = isInMuteWindow(ms.startHour, ms.endHour);
        const allMuted = !!settings.muteList[-1];

        if (inWindow && !allMuted) {
          // Vào giờ → mute all (timeMute = -1 = vĩnh viễn, unmute khi hết giờ)
          settings.muteList[-1] = { name: "Tất cả thành viên", timeMute: -1 };
          hasChanges = true;
          try {
            await api.sendMessage(
              { msg: `🔇 Nhóm vào giờ nghỉ (${ms.startHour}h–${ms.endHour}h). Chat mở lại sau ${ms.endHour}h. Chúc ngủ ngon! 🌙`, ttl: 30000 },
              threadId, MessageType.GroupMessage
            );
          } catch (_) {}

        } else if (!inWindow && allMuted && settings.muteList[-1]?.timeMute === -1) {
          // Hết giờ → unmute (chỉ unmute do lịch, nhận biết qua timeMute === -1)
          delete settings.muteList[-1];
          hasChanges = true;
          try {
            await api.sendMessage(
              { msg: `🔔 Hết giờ nghỉ! Mọi người có thể chat bình thường. ☀️`, ttl: 30000 },
              threadId, MessageType.GroupMessage
            );
          } catch (_) {}
        }
      }

      if (hasChanges) writeGroupSettings(groupSettings);
    } catch (err) {
      console.error("[MuteSchedule] Lỗi kiểm tra lịch mute:", err);
    }
  });

  console.log("✅ Đã khởi động scheduler mute theo giờ");
}

