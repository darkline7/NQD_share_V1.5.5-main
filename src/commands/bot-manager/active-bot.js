import { MessageType } from "../../api-zalo/index.js";
import {
  sendMessageResultRequest,
} from "../../service-dqt/chat-zalo/chat-style/chat-style.js";
import { readManagerFile, writeManagerFile } from "../../utils/io-json.js";
import schedule from 'node-schedule';

// Khởi tạo managerData từ file
export const managerData = {
  data: readManagerFile(),
  hasChanges: false,
};

export async function notifyResetGroup(api) {
  const groupRequiredReset = managerData.data.groupRequiredReset;
  if (groupRequiredReset !== "-1") {
    let group;
    try {
      group = await api.getGroupInfo(groupRequiredReset);
    } catch (error) {
      group = null;
    }

    await sendMessageResultRequest(api,
      group ? MessageType.GroupMessage : MessageType.DirectMessage,
      groupRequiredReset,
      "Khởi động lại hoàn tất!\nBot đã hoạt động trở lại!", true, 30000);
    managerData.data.groupRequiredReset = "-1";
    managerData.hasChanges = true;
  }
}

const saveManagerData = () => {
  writeManagerFile(managerData.data);
  managerData.hasChanges = false;
}

// Kiểm tra và lưu thay đổi mỗi 5 giây sử dụng node-schedule
schedule.scheduleJob('*/5 * * * * *', () => {
  if (managerData.hasChanges) {
    saveManagerData();
  }
});
