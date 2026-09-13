# TỔNG HỢP TOÀN BỘ CÁC LỆNH DỰ ÁN ZALO CHATBOT NQD V1.5.5

Tài liệu này tổng hợp đầy đủ và chi tiết tất cả các lệnh trong hệ thống dự án:
1. **Phần I: Lệnh Vận Hành & Quản Trị Hệ Thống (System, Node.js, PM2, Docker, Web Dashboard)**
2. **Phần II: Danh Sách Toàn Bộ Lệnh Chat Bot Zalo (User, Admin Box, Admin Bot, Super Admin)**
3. **Phần III: Cẩm Nang Lệnh Git Toàn Tập (Quản lý mã nguồn & Tải code lên Git)**

---

## MỤC LỤC

- [PHẦN I: LỆNH VẬN HÀNH & HỆ THỐNG](#phần-i-lệnh-vận-hành--hệ-thống)
  - [1. Yêu Cầu Môi Trường](#1-yêu-cầu-môi-trường)
  - [2. Cài Đặt Dependencies](#2-cài-đặt-dependencies)
  - [3. Lệnh Khởi Chạy Bot](#3-lệnh-khởi-chạy-bot)
  - [4. Quản Lý Tiến Trình Bằng PM2 (Production)](#4-quản-lý-tiến-trình-bằng-pm2-production)
  - [5. Quản Trị Cơ Sở Dữ Liệu (MySQL)](#5-quản-trị-cơ-sở-dữ-liệu-mysql)
  - [6. Web Dashboard & API Endpoints](#6-web-dashboard--api-endpoints)
  - [7. Kiểm Tra Mạng & Quản Lý Cổng (Port / Process)](#7-kiểm-tra-mạng--quản-lý-cổng-port--process)
  - [8. Cài Đặt & Triển Khai Trên VPS (Ubuntu / Debian / Linux)](#8-cài-đặt--triển-khai-trên-vps-ubuntu--debian--linux)
- [PHẦN II: DANH SÁCH LỆNH CHAT BOT ZALO](#phần-ii-danh-sách-lệnh-chat-bot-zalo)
  - [1. Bảng Phân Quyền Trong Bot](#1-bảng-phân-quyền-trong-bot)
  - [2. Lệnh Dành Cho Mọi Thành Viên (`all` - Level 1)](#2-lệnh-dành-cho-mọi-thành-viên-all---level-1)
  - [3. Lệnh Quản Trị Viên Nhóm (`adminBox` - Level 2)](#3-lệnh-quản-trị-viên-nhóm-adminbox---level-2)
  - [4. Lệnh Quản Trị Viên Bot (`adminBot` - Level 3)](#4-lệnh-quản-trị-viên-bot-adminbot---level-3)
  - [5. Lệnh Quản Trị Viên Cấp Cao (`adminLevelHigh` - Level 4)](#5-lệnh-quản-trị-viên-cấp-cao-adminlevelhigh---level-4)
  - [6. Các Lệnh Đã Tắt Cố Định (Hard-disabled)](#6-các-lệnh-đã-tắt-cố-định-hard-disabled)
- [PHẦN III: TOÀN BỘ LỆNH GIT TOÀN TẬP](#phần-iii-toàn-bộ-lệnh-git-toàn-tập)
  - [1. Cấu Hình Git Ban Đầu](#1-cấu-hình-git-ban-đầu)
  - [2. Kiểm Tra Trạng Thái & Lịch Sử](#2-kiểm-tra-trạng-thái--lịch-sử)
  - [3. Thêm & Commit Code](#3-thêm--commit-code)
  - [4. Quản Lý Remote & Đẩy/Kéo Code (Push / Pull)](#4-quản-lý-remote--đẩykéo-code-push--pull)
  - [5. Quản Lý Nhánh (Branch)](#5-quản-lý-nhánh-branch)
  - [6. Hoàn Tác & Lưu Trữ Tạm (Stash & Reset)](#6-hoàn-tác--lưu-trữ-tạm-stash--reset)

---

# PHẦN I: LỆNH VẬN HÀNH & HỆ THỐNG

### 1. Yêu Cầu Môi Trường
- **Node.js**: Phiên bản 20.x trở lên (khuyến nghị Node.js LTS).
- **npm**: Đi kèm với Node.js.
- **Git**: Đã cài đặt trên máy chủ/máy tính cá nhân.
- **Visual C++ Build Tools & Python** (nếu chạy Windows và cần compile thư viện native như `canvas`).

Kiểm tra phiên bản:
```bash
node -v
npm -v
git --version
```

---

### 2. Cài Đặt Dependencies

Cài đặt toàn bộ thư viện cần thiết trong `package.json`:
```bash
npm install
```

Cài đặt chuẩn theo `package-lock.json` (thường dùng cho máy chủ CI/CD):
```bash
npm ci
```

---

### 3. Lệnh Khởi Chạy Bot

#### Cách 1: Chạy trực tiếp qua runtime chính
Khởi chạy file `src/index.js`:
```bash
npm start
# hoặc
node src/index.js
```

#### Cách 2: Chạy qua wrapper tự động khởi động lại khi crash (Khuyến nghị)
Sử dụng `bot.js` giám sát tiến trình, nếu bot bị văng/lỗi sẽ tự động chạy lại:
```bash
npm run bot
# hoặc
node bot.js
```

#### Cách 3: Chạy nhanh trên Windows bằng file batch
Mở cmd/PowerShell hoặc click đúp vào file `run.bat`:
```cmd
run.bat
```
*(Script này tự động kiểm tra thư mục `node_modules`, nếu chưa có sẽ chạy `npm install`, sau đó gọi `npm run bot`)*.

---

### 4. Quản Lý Tiến Trình Bằng PM2 (Production)

PM2 giúp bot chạy nền (background) 24/7, tự khởi động lại khi sập hoặc khi reboot VPS/Server.

```bash
# Cài đặt PM2 toàn cục
npm install -g pm2

# Khởi chạy bot bằng PM2
pm2 start bot.js --name zlbotdqt

# Xem danh sách các tiến trình đang chạy
pm2 list
pm2 status

# Xem log trực tiếp thời gian thực
pm2 logs zlbotdqt

# Xem 100 dòng log gần nhất
pm2 logs zlbotdqt --lines 100

# Khởi động lại bot
pm2 restart zlbotdqt

# Tạm dừng bot
pm2 stop zlbotdqt

# Xóa bot khỏi danh sách PM2
pm2 delete zlbotdqt

# Thiết lập tự khởi động cùng hệ thống khi reboot VPS
pm2 startup
pm2 save
```

---

### 5. Quản Trị Cơ Sở Dữ Liệu (MySQL)

Dự án có sẵn file cấu trúc SQL `bhh-zl-bot.sql`. Khi kết nối CSDL MySQL:

```bash
# Đăng nhập vào MySQL
mysql -u root -p

# Tạo CSDL mới (nếu chưa có)
CREATE DATABASE zlbotdqt CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# Import file SQL vào CSDL
mysql -u root -p zlbotdqt < bhh-zl-bot.sql

# Xuất backup CSDL
mysqldump -u root -p zlbotdqt > backup_zlbotdqt.sql
```

---

### 6. Web Dashboard & API Endpoints

Khi bot chạy, một máy chủ web nội bộ Express + Socket.io được kích hoạt:
- **Địa chỉ truy cập**: `http://localhost:3300`
- **Tệp tĩnh giao diện**: nằm trong thư mục `public/`

Các API quản trị runtime:
- `GET  /api/runtime-controls` : Lấy thông tin trạng thái hàng đợi media (`mediaQueue`) và cơ chế chống quá tải (`circuitBreaker`).
- `POST /api/runtime-controls` : Cập nhật thiết lập runtime controls.
- `GET  /api/ai-config`        : Lấy thông tin cấu hình Cloudflare/Groq AI (model, prompt, token status...).
- `POST /api/ai-config`        : Cập nhật cấu hình AI runtime.
- `GET  /api/ai-status`        : Kiểm tra trạng thái AI đang sẵn sàng hay không.

---

### 7. Kiểm Tra Mạng & Quản Lý Cổng (Port / Process)

Khi gặp lỗi cổng 3300 bị chiếm dụng (EADDRINUSE):

#### Trên Windows (PowerShell / CMD):
```powershell
# Tìm tiến trình đang chiếm cổng 3300
netstat -ano | findstr :3300

# Tắt tiến trình theo PID (thay <PID> bằng mã tiến trình tìm được)
taskkill /PID <PID> /F
```

#### Trên Linux / macOS:
```bash
# Kiểm tra cổng 3300
lsof -i :3300
# hoặc
netstat -tulnp | grep 3300

# Tắt tiến trình
kill -9 <PID>
```


---

### 8. Cài Đặt & Triển Khai Trên VPS (Ubuntu / Debian / Linux)

Hướng dẫn đầy đủ từng bước từ khi thuê VPS mới tinh đến khi bot chạy ngầm 24/7.

#### Bước 1: Cập nhật VPS & Cài thư viện hệ thống cần thiết
Bot sử dụng thư viện đồ họa `canvas`, `sharp`, `ffmpeg` nên cần cài các gói C/C++ native:
```bash
# Cập nhật danh sách gói
sudo apt update && sudo apt upgrade -y

# Cài đặt git, curl, build-essential và các thư viện đồ họa cho Canvas
sudo apt install -y curl wget git build-essential python3 libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev ffmpeg
```

#### Bước 2: Cài đặt Node.js 20.x LTS & PM2
```bash
# Cài đặt NodeSource repository cho Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Kiểm tra phiên bản
node -v   # Phải >= v20.x
npm -v

# Cài đặt PM2 để quản lý tiến trình chạy nền 24/7
sudo npm install -g pm2
```

#### Bước 3: Tạo Swap RAM (Rất quan trọng cho VPS 1GB - 2GB RAM)
VPS cấu hình 1GB - 2GB RAM rất dễ bị tràn RAM khi cài thư viện `canvas` hoặc khi xử lý ảnh/video:
```bash
# Tạo swap file 2GB
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Giữ swap tự kích hoạt sau khi reboot VPS
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Kiểm tra bộ nhớ
free -h
```

#### Bước 4: Tải mã nguồn dự án về VPS
```bash
# Clone repo về VPS
git clone https://github.com/darkline7/NQD_share_V1.5.5-main.git

# Di chuyển vào thư mục dự án
cd NQD_share_V1.5.5-main

# Cài đặt dependencies
npm install
```

#### Bước 5: Cấu hình tài khoản Zalo (Cookie & IMEI)
```bash
# Tạo file cấu hình từ file mẫu
cp assets/config.example.json assets/config.json

# Mở file cấu hình bằng nano
nano assets/config.json
```
- Dán thông tin `cookie`, `imei`, `userAgent` của tài khoản bot vào.
- Nhấn `Ctrl + O` rồi `Enter` để lưu.
- Nhấn `Ctrl + X` để thoát nano.

Nếu muốn phân quyền Super Admin cho tài khoản của bạn:
```bash
cp assets/data/list_admin.example.json assets/data/list_admin.json
nano assets/data/list_admin.json
# Thêm UID Zalo của bạn vào: ["ID_ZALO_CUA_BAN"]
```

#### Bước 6: Khởi chạy bot nền bằng PM2
```bash
# Khởi chạy bot qua wrapper bot.js
pm2 start bot.js --name zlbot

# Thiết lập tự chạy lại khi khởi động lại VPS
pm2 startup
pm2 save

# Xem log hoạt động thời gian thực của bot
pm2 logs zlbot
```

#### Bước 7: Mở tường lửa (UFW) cho Web Dashboard (Cổng 3300)
Nếu muốn truy cập Web Dashboard từ xa qua `http://IP_VPS:3300`:
```bash
# Mở cổng 3300 TCP
sudo ufw allow 3300/tcp

# Kiểm tra trạng thái tường lửa
sudo ufw status
```

#### Bước 8: Các lệnh bảo trì thường dùng trên VPS
```bash
# Xem trạng thái bot
pm2 status

# Khởi động lại bot (khi sửa config hoặc update code)
pm2 restart zlbot

# Dừng bot
pm2 stop zlbot

# Cập nhật code mới nhất từ GitHub
git pull origin main
npm install
pm2 restart zlbot
```

---

# PHẦN II: DANH SÁCH LỆNH CHAT BOT ZALO

> **Ghi chú**: 
> - Tiền tố (prefix) mặc định là `/`. Có thể đổi bằng lệnh `prefix`.
> - Ký hiệu `{p}` trong cú pháp đại diện cho tiền tố hiện tại (Ví dụ: `{p}help` tương đương `/help`).

### 1. Bảng Phân Quyền Trong Bot

| Quyền hạn | Mã trong Code | Cấp độ (Level) | Đối tượng áp dụng |
| :--- | :--- | :---: | :--- |
| **all** | `all` | 1 | Tất cả thành viên trong nhóm & người dùng nhắn tin riêng |
| **adminBox** | `adminBox` | 2 | Trưởng nhóm, Phó nhóm (Quản trị viên nhóm Zalo) |
| **adminBot** | `adminBot` | 3 | Quản trị viên Bot trong nhóm (do Admin cấp cao chỉ định) |
| **adminLevelHigh** | `adminLevelHigh` | 4 | Quản trị viên cấp cao của Bot (Chủ sở hữu, cấu hình trong `list_admin.json`) |

---

### 2. Lệnh Dành Cho Mọi Thành Viên (`all` - Level 1)

| Tên lệnh | Bí danh (Alias) | Cú pháp | Thời gian chờ (CD) | Mô tả chi tiết |
| :--- | :--- | :--- | :---: | :--- |
| **help** | Không | `{p}help` | 5s | Hiển thị bảng danh sách lệnh thành viên dưới dạng ảnh Canvas. |
| **ai** | Không | `{p}ai [câu hỏi]` | 10s | Hỏi đáp thông minh với trí tuệ nhân tạo Groq / Cloudflare AI. |
| **info** | `i4` | `{p}info`<br>`{p}info @tag` | 5s | Xem thông tin chi tiết tài khoản Zalo bản thân hoặc người được tag (UID, tên, ngày tham gia...). |
| **card** | Không | `{p}card`<br>`{p}card @tag` | 5s | Tạo và gửi danh thiếp Zalo liên hệ cho bản thân hoặc người được tag. |
| **group** | `gr` | `{p}group` | 1s | Xem thông tin chi tiết về nhóm/cộng đồng hiện tại (ID, số thành viên, link nhóm...). |
| **detail** | `uptime` | `{p}detail` | 1s | Xem thông tin chi tiết về trạng thái bot: phiên bản, thời gian hoạt động (uptime), RAM, CPU... |
| **speedtest** | `spdt` | `{p}speedtest` | 60s | Đo tốc độ mạng Internet (Ping, Download, Upload) của máy chủ bot. |
| **sticker** | `stk` | `{p}sticker` | 10s | Chuyển đổi một hình ảnh thành dạng sticker Zalo (cần reply tin nhắn ảnh). |
| **soundcloud** | `scl`, `ms`, `music` | `{p}soundcloud <từ khóa>`<br>`{p}soundcloud <từ khóa>&&<số lượng>` | 30s | Tìm kiếm và tải bài hát từ SoundCloud gửi vào nhóm theo yêu cầu. |
| **voice** | Không | `{p}voice <nội dung>` | 5s | Chuyển đổi đoạn văn bản thành file âm thanh giọng nói tiếng Việt gửi vào nhóm. |
| **game** | `minigame`, `trochoi` | `{p}game` | 3s | Xem danh sách và hướng dẫn đầy đủ các mini game & hệ thống ví kinh tế. |
| **diemdanh** | `daily`, `dd` | `{p}diemdanh` hoặc `{p}daily` | 5s | Điểm danh nhận quà ngẫu nhiên từ 20.000 đến 60.000 VNĐ/ngày (15% nổ hũ x2). |
| **vi** | `balance`, `cash`, `tien`, `wallet` | `{p}vi`<br>`{p}vi @tag` | 5s | Tạo ảnh Canvas thẻ tài khoản game hiển thị avatar, số dư, tổng thắng/thua, tỉ lệ win. |
| **bank** | `chuyentien`, `pay` | `{p}bank @tag [số_tiền]` | 5s | Chuyển xu cho người chơi khác (hỗ trợ viết tắt `10k`, `500k`, `1m`, `50%`, `all`). |
| **top** | `bxh`, `topgame` | `{p}top` | 5s | Xem bảng xếp hạng Top 10 người chơi sở hữu nhiều xu nhất server. |
| **taixiu** | `tx`, `txb`, `taixiuban` | `{p}tx [tai\|xiu] [tiền]`<br>`{p}tx open` / `{p}txb`<br>`{p}tx status`<br>`{p}tx cancel` | 3s | **Tài Xỉu Solo & Bàn Cược Nhóm 60s (Multiplayer)**:<br>• Solo: `{p}tx [tai\|xiu] [tiền]` ăn thua ngay.<br>• Bàn nhóm: `{p}tx open` hoặc `{p}txb` mở phiên 60s cho cả nhóm cùng cược. Trong 60s, mọi người có thể gõ nhanh `tai 50k`, `xiu 100k` (không cần prefix). Vẽ ảnh Canvas bảng kết quả vinh danh người thắng / người thua! |
| **baucua** | `bc`, `bcb`, `baucuaban` | `{p}bc [linh_vật] [tiền]`<br>`{p}bc open` / `{p}bcb`<br>`{p}bc status`<br>`{p}bc cancel` | 3s | **Bầu Cua Solo & Bàn Cược Nhóm 60s (Multiplayer)**:<br>• Solo: `{p}bc [linh_vật] [tiền]` nhân thưởng lên đến x3.<br>• Bàn nhóm: `{p}bc open` hoặc `{p}bcb` mở bàn 60s. Mọi người có thể cược nhiều con cùng lúc (`cua 50k`, `tom 100k`, `ca all`...). Vẽ ảnh Canvas đĩa 3D kèm danh sách thắng thua toàn sàn! |
| **keobuabao** | `kbb` | `{p}kbb [keo\|bua\|bao] [tiền]` | 3s | Thách đấu Kéo Búa Bao với Bot, hoàn tiền khi hòa, nhân đôi khi thắng. |


---

### 3. Lệnh Quản Trị Viên Nhóm (`adminBox` - Level 2)

| Tên lệnh | Bí danh (Alias) | Cú pháp | Thời gian chờ (CD) | Mô tả chi tiết |
| :--- | :--- | :--- | :---: | :--- |
| **manager** | Không | `{p}manager` | 5s | Xem toàn bộ danh sách lệnh quản trị viên được phép dùng trong nhóm. |
| **listmute** | Không | `{p}listmute` | 1s | Xem danh sách các thành viên hiện đang bị cấm chat (mute) trong nhóm. |
| **settinggroup** | `stg` | `{p}settinggroup <loại> <on\|off\|0\|1>` | 0s | Sửa đổi các cài đặt của nhóm (như khóa link, kiểm duyệt...). |
| **changelink** | Không | `{p}changelink` | 0s | Tạo lại link tham gia nhóm ngẫu nhiên mới (vô hiệu hóa link cũ). |

---

### 4. Lệnh Quản Trị Viên Bot (`adminBot` - Level 3)

| Tên lệnh | Bí danh (Alias) | Cú pháp | Thời gian chờ (CD) | Mô tả chi tiết |
| :--- | :--- | :--- | :---: | :--- |
| **kick** | Không | `{p}kick @tag` | 1s | Kick/mời thành viên ra khỏi nhóm (yêu cầu Bot giữ quyền Phó hoặc Trưởng nhóm). |
| **block** | Không | `{p}block @tag` | 1s | Chặn thành viên khỏi nhóm Zalo vĩnh viễn. |
| **mute** | Không | `{p}mute @tag` | 1s | Cấm thành viên gửi tin nhắn (yêu cầu Bot giữ quyền Phó cộng đồng trở lên). |
| **unmute** | Không | `{p}unmute @tag` | 1s | Mở khóa cấm chat cho thành viên được tag. |
| **prefix** | Không | `prefix <prefix_mới>`<br>`{p}prefix <prefix_mới>` | 1s | Xem hoặc thay đổi ký tự tiền tố gọi lệnh của bot trong nhóm. |
| **sendtask** | Không | `{p}sendtask [on\|off]` | 1s | Bật/tắt tính năng gửi thông báo nội dung tự động sau mỗi 1 giờ vào nhóm. |
| **autosend** | `as` | `{p}autosend <chu kỳ> (reply tin nhắn)`<br>`{p}autosend on\|off\|status` | 1s | Tự động phát lại tin nhắn đã reply định kỳ (text, ảnh, video, link. Ví dụ: `{p}autosend 30p`). |
| **welcome** | Không | `{p}welcome [on\|off]` | 1s | Bật hoặc tắt tin nhắn hình ảnh chào mừng thành viên mới tham gia nhóm. |
| **bye** | Không | `{p}bye [on\|off]` | 1s | Bật hoặc tắt tin nhắn thông báo khi có thành viên rời khỏi nhóm. |
| **antibadword**| `atbw`, `loctu`, `loctukhoa`, `loctk` | `{p}antibadword [on\|off\|list]`<br>`{p}antibadword add <từ_cấm>`<br>`{p}antibadword remove <từ_cấm>` | 1s | Bật/tắt lọc từ ngữ thô tục, thêm hoặc xóa từ cấm vào từ điển nhóm. |
| **antilink** | `xoalink`, `loclink` | `{p}antilink on [domain]`<br>`{p}antilink allow <d1,d2>`<br>`{p}antilink allow add\|remove <domain>`<br>`{p}antilink allow show\|clear`<br>`{p}antilink vip <domain>`<br>`{p}antilink test <link>`<br>`{p}antilink list\|off\|status` | 1s | Chống gửi link spam. Hỗ trợ chặn tất cả hoặc chặn domain, whitelist domain cho phép. |
| **antispam** | `xoaspam` | `{p}antispam [on\|off]` | 1s | Tự động phát hiện và cảnh báo/xóa tin nhắn spam liên tục. |
| **antinude** | `chongnude` | `{p}antinude [on\|off]` | 1s | Quét hình ảnh bằng AI (NSFW/Nude) và tự động thu hồi/xóa ảnh nhạy cảm. |
| **antiundo** | `chongundo` | `{p}antiundo [on\|off]` | 1s | Chống thu hồi tin nhắn: khi có ai thu hồi tin nhắn, bot sẽ gửi lại nội dung đó. |
| **onlytext** | Không | `{p}onlytext [on\|off]` | 1s | Nhóm chỉ gửi tin nhắn văn bản (tự xóa ảnh, video, sticker, file...). |
| **learn** | `learnnow`, `unlearn` | `{p}learn [câu hỏi] => [câu trả lời]`<br>`{p}learnnow_[câu hỏi]_[câu trả lời]`<br>`{p}unlearn [câu hỏi]` | 1s | Dạy bot trả lời tự động khi thành viên trò chuyện hoặc xóa câu trả lời đã học. |
| **reply** | Không | `{p}reply [on\|off]` | 1s | Bật/tắt chế độ bot tự động trả lời tin nhắn bằng dữ liệu đã học/AI. |
| **approve** | Không | `{p}approve [on\|off]` | 1s | Bật/tắt tính năng tự động phê duyệt khi có yêu cầu xin tham gia nhóm. |
| **undo** | Không | `{p}undo` (reply tin nhắn của bot) | 1s | Ra lệnh cho bot thu hồi tin nhắn do bot vừa gửi đi. |
| **todo** | Không | `{p}todo_[Nội dung]_[Số lần] @tag`<br>`{p}todo_stop` | 1s | Gửi nội dung nhắc việc lặp lại nhiều lần cho thành viên được tag hoặc dừng todo. |
| **listadmin** | Không | `{p}listadmin` | 1s | Xem danh sách ban quản trị bot cấp cao và quản trị viên bot của nhóm hiện tại. |
| **whitelist** | `wl` | `{p}whitelist [add\|remove\|list] @tag` | 1s | Quản lý danh sách thành viên tin cậy được miễn kiểm tra bởi Anti (link, spam, badword...). |
| **listblockbot**| `lsbot` | `{p}listblockbot` | 1s | Xem danh sách những người dùng đang bị cấm sử dụng các lệnh của bot. |
| **givemoney** | `setmoney` | `{p}givemoney @tag [số_tiền]` | 1s | Cấp tiền ảo/xu game cho người chơi được tag (Dành cho Admin Bot tổ chức sự kiện). |


---

### 5. Lệnh Quản Trị Viên Cấp Cao (`adminLevelHigh` - Level 4)

> **Lưu ý**: Chỉ những tài khoản Zalo có UID nằm trong file cấu hình `assets/data/list_admin.json` mới có quyền thực hiện các lệnh này.

| Tên lệnh | Bí danh (Alias) | Cú pháp | Thời gian chờ (CD) | Mô tả chi tiết |
| :--- | :--- | :--- | :---: | :--- |
| **add** | Không | `{p}add @tag` | 1s | Bổ nhiệm người dùng được tag làm Quản Trị Viên Bot của nhóm hiện tại. |
| **remove** | Không | `{p}remove @tag` | 1s | Gỡ quyền Quản Trị Viên Bot của người dùng được tag trong nhóm hiện tại. |
| **keygold** | `keyvang` | `{p}keygold @tag` | 1s | Cấp Key Vàng cho thành viên được tag. |
| **keysilver**| `keybac` | `{p}keysilver @tag` | 1s | Cấp Key Bạc cho thành viên được tag. |
| **unkey** | `xoakey` | `{p}unkey @tag` | 1s | Thu hồi Key quyền hạn của người được tag. |
| **join** | `thamgianhom` | `{p}join <link_nhóm>` | 1s | Ra lệnh cho bot tự động tham gia vào nhóm hoặc cộng đồng thông qua link mời. |
| **leave** | `uotnhom` | `{p}leave` | 1s | Ra lệnh cho bot tự động rời khỏi nhóm hiện tại. |
| **listgroups**| `lgr` | `{p}listgroups` | 1s | Lấy và hiển thị toàn bộ danh sách các nhóm mà tài khoản bot đang tham gia. |
| **scangroups**| `scgr` | `{p}scangroups <hành động> <từ khóa>` | 1s | Quét thành viên theo từ khóa. Hành động: `find`, `findmatch`, `tìm`, `findtag`, `findmatchtag`. |
| **deletemessage** | `delmsg` | `{p}deletemessage <số lượng> [all\|@tag]`<br>*(hoặc reply tin nhắn)* | 1s | Xóa hàng loạt tin nhắn gần đây trong nhóm hoặc xóa tin nhắn của người được tag. |
| **blockbot** | `blbot` | `{p}blockbot @tag` | 1s | Cấm một người dùng tương tác với bot trên toàn hệ thống. |
| **unblockbot**| `unblbot` | `{p}unblockbot @tag` | 1s | Mở khóa cấm tương tác bot cho người dùng được tag. |
| **setcmd** | Không | `{p}setcmd on\|off <tên_lệnh>`<br>`{p}setcmd p <tên_lệnh> <level 1-4>`<br>`{p}setcmd cd <tên_lệnh> <số_giây>` | 1s | Bật/tắt lệnh, thay đổi level quyền hạn (1-4) hoặc chỉnh thời gian chờ (cooldown). |
| **alias** | Không | `{p}alias add <lệnh_gốc> <lệnh_alias>`<br>`{p}alias remove <lệnh_gốc> <lệnh_alias>` | 5s | Thêm hoặc xóa tên viết tắt / bí danh gọi nhanh cho một lệnh bất kỳ. |

---

### 6. Các Lệnh Đã Tắt Cố Định (Hard-disabled)

Trong mã nguồn `src/commands/command.js`, các lệnh sau đã bị khóa vĩnh viễn:
- **`tagall`**: Đã tắt.
- **`sendp`**: Đã tắt.

---

# PHẦN III: TOÀN BỘ LỆNH GIT TOÀN TẬP

Cẩm nang tổng hợp các lệnh Git từ cơ bản đến nâng cao để quản lý và tải mã nguồn dự án lên GitHub / GitLab.

### 1. Cấu Hình Git Ban Đầu

Thiết lập thông tin tác giả commit trên máy tính:
```bash
# Đặt tên hiển thị
git config --global user.name "Tên Của Bạn"

# Đặt email liên kết với tài khoản Git
git config --global user.email "email_cua_ban@example.com"

# Kiểm tra lại cấu hình
git config --list
```

---

### 2. Kiểm Tra Trạng Thái & Lịch Sử

```bash
# Kiểm tra trạng thái thay đổi của các file trong dự án
git status

# Xem sự khác biệt chi tiết giữa code hiện tại và commit trước đó
git diff

# Xem tóm tắt những file đã thay đổi
git diff --stat

# Xem lịch sử các commit gần nhất (rút gọn trên 1 dòng)
git log --oneline -n 10

# Xem lịch sử commit dạng cây đồ thị trực quan
git log --graph --oneline --decorate --all
```

---

### 3. Thêm & Commit Code

```bash
# Thêm toàn bộ các file thay đổi vào khu vực chờ commit (Staging Area)
git add .

# Thêm từng file cụ thể
git add COMMANDS.md README.md

# Lưu lại các thay đổi kèm thông điệp mô tả ngắn gọn
git commit -m "docs: tổng hợp toàn bộ các lệnh dự án vào COMMANDS.md"

# Sửa lại tin nhắn của commit gần nhất (nếu chưa push)
git commit --amend -m "docs: cập nhật lại ghi chú commit"
```

---

### 4. Quản Lý Remote & Đẩy/Kéo Code (Push / Pull)

```bash
# Xem danh sách các remote kho chứa từ xa
git remote -v

# Thêm remote mới (nếu chưa có)
git remote add origin https://github.com/darkline7/NQD_share_V1.5.5-main.git

# Đổi URL của remote origin
git remote set-url origin https://github.com/darkline7/NQD_share_V1.5.5-main.git

# Lấy thông tin mới nhất từ kho chứa từ xa về mà chưa gộp
git fetch origin

# Kéo code mới nhất từ nhánh main trên remote về máy
git pull origin main

# Đẩy code từ nhánh hiện tại lên nhánh main trên remote
git push origin main

# Đẩy code lần đầu và thiết lập upstream theo dõi nhánh
git push -u origin main

# Ép buộc đẩy code (cẩn trọng khi sử dụng)
git push origin main --force
```

---

### 5. Quản Lý Nhánh (Branch)

```bash
# Xem danh sách tất cả các nhánh (local và remote)
git branch -a

# Tạo nhánh mới
git branch ten-nhanh-moi

# Chuyển sang nhánh khác
git checkout ten-nhanh-moi
# hoặc
git switch ten-nhanh-moi

# Tạo nhánh mới và chuyển sang ngay lập tức
git checkout -b feature/tinh-nang-moi

# Gộp nhánh tính năng vào nhánh chính (khi đang ở nhánh main)
git merge feature/tinh-nang-moi

# Xóa một nhánh local đã gộp
git branch -d ten-nhanh-moi
```

---

### 6. Hoàn Tác & Lưu Trữ Tạm (Stash & Reset)

```bash
# Hủy bỏ thay đổi của một file chưa commit (trở về bản commit gần nhất)
git restore <ten_file>

# Bỏ một file ra khỏi Staging Area (ngược lại với git add)
git restore --staged <ten_file>

# Lưu tạm các thay đổi đang làm dở sang vùng nhớ tạm
git stash

# Xem danh sách các bản lưu tạm
git stash list

# Phục hồi lại bản lưu tạm gần nhất và xóa khỏi stash
git stash pop

# Hủy bỏ toàn bộ thay đổi chưa commit đưa về commit gần nhất
git reset --hard HEAD

# Quay lại commit trước đó và giữ nguyên code thay đổi
git reset --soft HEAD~1
```

---

*Tài liệu được tổng hợp và đồng bộ cho dự án Zalo ChatBot NQD Share V1.5.5.*

