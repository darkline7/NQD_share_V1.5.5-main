# Zalo ChatBot - Huong Dan Su Dung Day Du

Tai lieu cap nhat: 2026-04-08

## 1. Tong quan
- Tong so lenh trong he thong: 119
- Lenh dang bat: 115
- Prefix mac dinh: .
- Bot co ho tro dashboard web, queue upload media, circuit breaker va AI fallback.

## 2. Cai dat nhanh
1. Cai Node.js v20 tro len.
2. Cai dependency: npm install
3. Cau hinh tai assets/config.json (cookie, imei, userAgent).
4. Chay bot: run.bat
5. Mo dashboard web: http://localhost:3300

## 3. Huong dan su dung lenh
### Lenh menu/tro giup
- .help hoac .menu: hien thi menu tong quan
- .cmd [so_trang]: xem danh sach lenh theo trang
- .cmd map: xem toan bo lenh thanh vien dang card anh
- .cmd map admin: xem toan bo lenh admin dang card anh
- .cmd find <tu_khoa>: tim lenh theo ten/mo ta/alias, xuat card anh
- .cmd admin: menu lenh quan tri

### AntiLink nang cao (Admin bot)
- .antilink on: bat chan toan bo link
- .antilink on zalo.me: chi chan domain zalo.me
- .antilink allow zalo.me,fb.com: whitelist nhieu domain cung luc
- .antilink allow add tiktok.com: them domain vao allow list
- .antilink allow remove fb.com: xoa domain khoi allow list
- .antilink allow show: xem allow list hien tai
- .antilink allow clear: xoa toan bo allow list
- .antilink test https://fb.com/abc: kiem tra link se bi chan hay duoc phep
- .antilink list: xem cau hinh AntiLink chi tiet cua nhom
- .antilink status: xem trang thai AntiLink nhanh
- .antilink off: tat AntiLink

### Ghi chu quan trong
- Cac lenh da tat cung va an khoi danh sach: .boy, .girl, .image
- Trang thai lenh trong bang ben duoi doc theo cot Trang thai.
- Neu lenh tat (Tat), bot se khong xu ly lenh do.
- AutoSend: reply vao tin nhan mau (text/anh/video/link) roi dung .autosend 1p de bot gui lai dinh ky.
- Cap nhat mau AutoSend: reply vao tin nhan moi va go lai .autosend 1p (hoac chu ky khac).

## 4. Danh sach lenh day du

### Thanh vien (66 lenh)

| Lenh | Alias | Cu phap | Mo ta | Cooldown(s) | Trang thai |
|---|---|---|---|---:|---|
| .anime | - | .anime | Gửi ảnh anime ngẫu nhiên từ bộ sưu tập | 3 | Bat |
| .bank | - | .bank <@người_nhận> <số_tiền> | Chuyển tiền cho người chơi khác trên tài khoản bot | 3 | Bat |
| .baucua | .bc | .baucua <bầu/cua/tôm/cá/gà/nai> <số_tiền> | Chơi trò chơi Bầu Cua | 5 | Bat |
| .boy | - | .boy \|\| .boy map \|\| .boy [đối số trong boy map] | Gửi ảnh trai đẹp ngẫu nhiên từ bộ sưu tập | 3 | Tat |
| .capcut | .cpct | .capcut <từ khóa>(&&số lượng kết quả) | Tìm và gửi 1 video CapCut dựa vào từ khóa | 10 | Bat |
| .card | - | .card \|\| .card [@người_tag] | Tạo danh thiếp Zalo của bạn hoặc người được tag | 5 | Bat |
| .chanle | .cl | .chanle <chẵn/lẻ> <số_tiền> | Chơi chẵn lẻ | 5 | Bat |
| .command | .cmd | .command [số trang] \|\| .command admin [số trang] \|\| .command (map/map admin/find <cmd>)... | Hiển thị toàn bộ danh sách lệnh bot và chi tiết các lệnh cụ thể | 5 | Bat |
| .cosplay | .cos | .cosplay | Gửi ảnh cosplay anime/game ngẫu nhiên từ bộ sưu tập | 3 | Bat |
| .createqr | .cqr, .qr, .qrcode | .createqr <nội dung cần tạo QR> | Tạo mã QR | 5 | Bat |
| .daily | - | .daily | Nhận phần thưởng hàng ngày. Reset vào 0h mỗi ngày | 3 | Bat |
| .dangky | .dk | .dangky <tên_tài_khoản> <mật_khẩu> | Đăng ký tài khoản game mới trên hệ thống bot | 3 | Bat |
| .detail | .uptime | .detail | Xem thông tin chi tiết về bot (phiên bản, tính năng, v.v) | 1 | Bat |
| .dich | - | .dich <nội dung cần dịch>&&(ngôn ngữ cần dịch) | Dịch văn bản | 1 | Bat |
| .doanso | .ds | .doanso <số lớn nhất bạn muốn> | Chơi trò đoán số | 5 | Bat |
| .doantu | - | .doantu | Chơi trò đoán từ | 5 | Bat |
| .download | .dl, .down, .đaoloát | .download <link> | Tải video link đa nền tảng | 60 | Bat |
| .game | - | .game | Hiển thị danh sách và hướng dẫn các trò chơi có sẵn | 5 | Bat |
| .gemini | .gem, .ei | .gemini <nội dung câu hỏi> | Đặt câu hỏi cho Gemini - Trợ lý AI thông minh | 1 | Bat |
| .getlink | .gl | .getlink (quote tin nhắn cần lấy link) | Lấy link trong tin nhắn được reply | 1 | Bat |
| .getvoice | .gvc, .gvoice, .xuankien | .getvoice (link hoặc quote tin nhắn cần tách âm thanh) | Lấy voice từ video | 10 | Bat |
| .gif | - | .gif | Gửi ảnh động GIF ngẫu nhiên | 5 | Bat |
| .girl | - | .girl \|\| .girl map \|\| .girl [đối số trong girl map] | Gửi ảnh gái xinh ngẫu nhiên từ bộ sưu tập | 3 | Tat |
| .google | .gg, .search | .google <từ khóa> | Tìm kiếm và gửi kết quả tìm kiếm từ Google | 5 | Bat |
| .gpt | - | .gpt <nội dung câu hỏi> | Đặt câu hỏi cho ChatGPT - Trợ lý AI hơi hơi thông minh | 1 | Tat |
| .group | .gr | .group | Xem thông tin chi tiết về nhóm/cộng đồng hiện tại | 1 | Bat |
| .help | .menu | .help | Hiển thị danh sách và hướng dẫn sử dụng các lệnh cơ bản | 5 | Bat |
| .image | .img | .image <từ khóa> | Tìm kiếm và gửi ảnh ngẫu nhiên từ kho ảnh lớn nhất thế giới | 5 | Tat |
| .info | .i4 | .info \|\| .info [@người_tag] | Xem thông tin chi tiết tài khoản Zalo của bạn hoặc người được tag | 5 | Bat |
| .keobuabao | .kbb | .keobuabao <búa/bao/kéo> <số_tiền> | Chơi kéo búa bao | 3 | Bat |
| .login | - | .login <tên_tài_khoản> <mật_khẩu> | Đăng nhập vào tài khoản game trên hệ thống bot | 3 | Bat |
| .logout | - | .logout | Đăng xuất khỏi tài khoản game hiện tại trên hệ thống bot | 3 | Bat |
| .mybag | - | .mybag | Xem túi đồ của bạn | 5 | Bat |
| .mycard | - | .mycard | Xem thông tin chi tiết tài khoản game của bạn trên hệ thống bot | 5 | Bat |
| .nap | - | .nap <số_tiền> | Nạp tiền vào tài khoản bot từ tài khoản đăng ký | 3 | Bat |
| .nhaccuatui | .nct, .ms2 | .nhaccuatui <từ khóa>(&&số lượng kết quả) | Tìm và tải 1 bài hát (nhạc) từ NhacCuaTui theo yêu cầu | 30 | Bat |
| .noitu | - | .noitu <số từ> | Chơi trò nối từ | 5 | Bat |
| .nongtrai | .ntr | .nongtrai | Chơi trò chơi Nông Trại | 3 | Bat |
| .phatnguoi | .phng | .phatnguoi <biển số xe> [loại xe] | Tra cứu thông tin phạt nguội từ cục CSGT | 30 | Bat |
| .pinterest | .pin | .pinterest <từ khóa> | Tìm kiếm và gửi ảnh ngẫu nhiên theo từ khóa từ Pinterest | 5 | Bat |
| .poststatus | .ps, .status, .stt | .poststatus | Tạo ảnh bài đăng trạng thái | 5 | Bat |
| .qrbank | .qrb | .qrbank <tên ngân hàng> <số tài khoản> <số tiền> <nội dung chuyển khoản> | Tạo QR code thông tin chuyển khoản | 3 | Bat |
| .rank | - | .rank | Xem bảng xếp hạng top 10 người chơi có nhiều tiền nhất | 5 | Bat |
| .rut | - | .rut <số_tiền> | Rút tiền từ tài khoản bot về tài khoản game | 3 | Bat |
| .scanqr | .sqr | .scanqr <link hoặc reply tin nhắn chứa nội dung hoặc link qr cần quét> | Quét mã QR | 5 | Bat |
| .simsimi | .sim | .simsimi <nội dung> | Trò chuyện với Bot AI (Simsimi) | 30 | Bat |
| .soundcloud | .scl, .ms, .music | .soundcloud <từ khóa>(&&số lượng kết quả) | Tìm và tải 1 bài hát (nhạc) từ SoundCloud theo yêu cầu | 30 | Bat |
| .speedtest | .spdt | .speedtest | Kiểm tra tốc độ mạng của bạn | 60 | Bat |
| .sticker | .stk | .sticker <cần reply tin nhắn> | Chuyển đổi hình ảnh thành sticker Zalo | 10 | Bat |
| .stickercustom | .stkc | .stickercustom <tên tệp sticker đã lưu trữ> | Gửi sticker custom từ thư mục lưu trữ của Bot | 10 | Bat |
| .taixiu | .tx | .taixiu <tài/xỉu> <số_tiền> | Chơi tài xỉu | 3 | Bat |
| .tarrot | - | .tarrot | Kể 1 câu truyện cười | 5 | Bat |
| .thoitiet | - | .thoitiet | Xem thời tiết | 1 | Bat |
| .tiktok | .tt | .tiktok <từ khóa> | Send 1 video TikTok cụ thể dựa vào từ khóa | 10 | Bat |
| .topchat | - | .topchat | Xem bảng xếp hạng tương tác của các thành viên trong nhóm | 1 | Bat |
| .truyencuoi | - | .truyencuoi | Kể 1 câu truyện cười | 5 | Bat |
| .vdanime | - | .vdanime | Gửi video short về anime bất kỳ | 10 | Bat |
| .vdchill | - | .vdchill | Gửi video ngắn về tâm trạng | 10 | Bat |
| .vdcos | - | .vdcos | Gửi video short về cosplay bất kỳ | 10 | Bat |
| .vdgirl | .vdgai | .vdgirl | Gửi video ngắn về gái xinh bất kỳ | 10 | Bat |
| .vdsexy | - | .vdsexy | Gửi video ngắn về gái sexy bất kỳ | 10 | Bat |
| .vietlott655 | .vl655, .vietlot | .vietlott655 <số_tiền> <số lô \|\| random> | Chơi Minigame Vietlott 6/55 | 3 | Bat |
| .voice | - | .voice <nội dung cần chuyển> | Chuyển văn bản thành giọng nói | 5 | Bat |
| .youtube | .yt, .ytb, .dutup | .youtube <từ khóa>(&&số lượng kết quả) | Tìm và gửi 1 video Youtube dựa vào từ khóa | 30 | Bat |
| .zingchart | .topzingmp3, .zmp3c | .zingchart | Xem danh sách bài hát (nhạc) hot nhất trên ZingMP3 thời điểm hiện tại | 30 | Bat |
| .zingmp3 | .zmp3, .ms3 | .zingmp3 <từ khóa>(&&số lượng kết quả) | Tìm và tải 1 bài hát (nhạc) từ ZingMP3 theo yêu cầu | 30 | Bat |

### Admin nhom (6 lenh)

| Lenh | Alias | Cu phap | Mo ta | Cooldown(s) | Trang thai |
|---|---|---|---|---:|---|
| .block | .chan | .block <@người_tag> | Chặn thành viên | 1 | Bat |
| .changelink | - | .changelink | Đổi link nhóm ngẫu nhiên | 0 | Bat |
| .kick | .sut, .da | .kick <@người_tag> | Kick thành viên | 1 | Bat |
| .listmute | - | .listmute | Xem danh sách mute | 1 | Bat |
| .manager | - | .manager | Xem danh sách lệnh admin | 5 | Bat |
| .settinggroup | .stg | .settinggroup <loại cài đặt> <giá trị on\|off\|0\|1> | Sửa đổi cài đặt nhóm | 0 | Bat |

### Admin bot (29 lenh)

| Lenh | Alias | Cu phap | Mo ta | Cooldown(s) | Trang thai |
|---|---|---|---|---:|---|
| .antibadword | .atbw, .loctu, .loctukhoa, .loctk | .antibadword [on\|off\|list] \|\| .antibadword <add\|remove> <từ_cấm> \|\| .antibadword <show> <@người_tag> | Lọc từ thô tục | 1 | Bat |
| .antilink | .xoalink, .loclink | .antilink on [domain] \|\| .antilink allow <d1,d2> \|\| .antilink allow add <d1,d2> \|\| .antilink allow remove <d1,d2> \|\| .antilink allow show \|\| .antilink allow clear \|\| .antilink vip <domain> \|\| .antilink test <link> \|\| .antilink list \|\| .antilink off \|\| .antilink status | Quản lý chặn liên kết theo domain, whitelist và kiểm tra chính sách link | 1 | Bat |
| .antinude | .chongnude | .antinude [on\|off] | Chặn hình ảnh có nội dung nhạy cảm | 1 | Bat |
| .antispam | .xoaspam | .antispam [on\|off] | Chống spam tin nhắn | 1 | Bat |
| .antiundo | .chongundo | .antiundo [on\|off] | Chống thu hồi tin nhắn | 1 | Bat |
| .approve | .duyetmem | .approve [on\|off] | Bật/tắt tự động phê duyệt thành viên mới | 1 | Bat |
| .ban | - | .ban <@người_tag> | Khóa tài khoản người chơi | 1 | Bat |
| .bot | - | .bot [on\|off] | bật tương tác với bot trong nhóm hiện tại | 1 | Bat |
| .bye | - | .bye [on\|off] | Tạm biệt thành viên rời nhóm | 1 | Bat |
| .gameactive | - | .gameactive [on\|off] | bật xử lý tương tác trò chơi trong nhóm hiện tại | 1 | Bat |
| .learn | - | .learn [on\|off] | Bật theo dõi và học câu trả lời mới cho bot | 1 | Bat |
| .learnnow | - | .learnnow <câu hỏi>_<câu trả lời> | Học câu trả lời mới cho bot ngay lập tức | 1 | Bat |
| .listadmin | - | .listadmin | Xem danh sách admin bot nhóm | 1 | Bat |
| .listblockbot | .lsbot | .listblockbot | Xem danh sách người dùng đã bị chặn tương tác với bot | 1 | Bat |
| .mute | - | .mute <@người_tag> | Mute thành viên (Yêu cầu bot quyền hạn phó cộng đồng trở lên) | 1 | Bat |
| .onlytext | .vanban | .onlytext [on\|off] | Chỉ nhắn tin văn bản | 1 | Bat |
| .prefix | - | prefix <prefix_mới> | Xem hoặc thay đổi prefix của bot | 1 | Bat |
| .reply | - | .reply [on\|off] | Bật/tắt tự động trả lời tin nhắn | 1 | Bat |
| .sendp | - | .sendp <nội dung>_<số lần>_<@người_tag> | Send message private cho người khác | 1 | Bat |
| .sendtask | - | .sendtask [on\|off] | Tắt bật chức năng gửi nội dung tự động sau mỗi giờ vào nhóm | 1 | Bat |
| .autosend | .as | .autosend <1p\|30s\|2h> (reply tin mẫu) \|\| .autosend on <1p\|30s\|2h> \|\| .autosend off \|\| .autosend status | Tự động gửi lại nội dung đã reply theo chu kỳ (hỗ trợ text + ảnh/video/link) | 1 | Bat |
| .tagall | - | .tagall <nội_dung> | Tag tất cả thành viên trong nhóm với nội dung | 1 | Bat |
| .todo | - | .todo <nội_dung_việc>_[số lần]_<@người_tag> | Giao việc cho người khác | 1 | Bat |
| .unban | - | .unban <@người_tag> | Mở khóa tài khoản người chơi | 1 | Bat |
| .undo | - | .undo (Tag vào tin nhắn cần undo) | Undo tin nhắn bot | 1 | Bat |
| .unlearn | - | .unlearn <câu trả lời> | Hủy bỏ câu trả lời mà bot đã học | 1 | Bat |
| .unmute | - | .unmute <@người_tag> | Unmute thành viên | 1 | Bat |
| .welcome | - | .welcome [on\|off] | Chào mừng thành viên mới | 1 | Bat |
| .whitelist | .wl | .whitelist | Xem, thêm hoặc xóa người dùng được bot liệt vào danh sách trắng | 1 | Bat |

### Admin cap cao (18 lenh)

| Lenh | Alias | Cu phap | Mo ta | Cooldown(s) | Trang thai |
|---|---|---|---|---:|---|
| .add | - | .add <@người_tag> | Thêm người tag vào admin bot nhóm | 1 | Bat |
| .alias | - | .alias <add\|remove> <lệnh_gốc> <lệnh_alias> | Quản lý alias cho các lệnh | 5 | Bat |
| .blockbot | .blbot | .blockbot <@người_tag> | Chặn người dùng tương tác với bot | 1 | Bat |
| .buff | - | .buff <số_tiền>_<@người_tag> | Tặng tiền cho người chơi | 3 | Bat |
| .deletemessage | .delmsg | .deletemessage <số_tin_nhắn> (@mention cụ thể nếu có) | Xóa tin nhắn nhóm theo số lượng tin nhắn | 1 | Bat |
| .deleteresource | .delrsrc | .deleteresource [thư mục]\|[tên file] | Xóa file từ thư mục resource | 5 | Bat |
| .downloadresource | .dlrsrc | .downloadresource [thư mục]\|[tên file]\|[link (nếu Không reply)] | Tải file vào thư mục resource | 5 | Bat |
| .join | .thamgianhom | .join [link] | Tham gia nhóm thông qua link | 1 | Bat |
| .keygold | .keyvang | .keygold [@người_tag] | Nhường key vàng cho người được đề cập | 1 | Bat |
| .keysilver | .keybac | . [@người_tag] | Phong key bạc cho người được đề cập | 1 | Bat |
| .leave | .uotnhom | .leave | Ra lệnh bot rời khỏi nhóm hiện tại | 1 | Bat |
| .listgroups | .lgr | .listgroups | Xem danh sách nhóm | 1 | Bat |
| .remove | - | .remove <@người_tag> | Xóa người tag vào admin bot nhóm | 1 | Bat |
| .scangroups | .scgr | .scangroups <hành_động> <cụm_từ_tìm_kiếm> | Quét thành viên nhóm và thực hiện hành động theo yêu cầu | 1 | Bat |
| .scold | .reo, .var, .chui | .scold <@người_tag> | Dùng để chửi người khác | 1 | Bat |
| .setcmd | - | .setcmd [on/off/p/cd] [tên_lệnh] [đối số] | Quản lý cài đặt lệnh bot (bật/tắt, phân quyền, thời gian chờ) | 1 | Bat |
| .unblockbot | .unblbot | .unblockbot <@người_tag> | Bỏ chặn người dùng tương tác với bot | 1 | Bat |
| .unkey | .xoakey | .unkey [@người_tag] | Xóa key của người được đề cập | 1 | Bat |

## 5. AI va fallback
- Bot uu tien Cloudflare AI neu da cau hinh.
- Neu loi, bot tu fallback qua Gemini/legacy tuy ngu canh.
- Dashboard co form cau hinh Cloudflare AI va trang thai provider.

## 6. Runtime controls tren web
- GET /api/runtime-controls
- POST /api/runtime-controls
- GET /api/ai-config
- POST /api/ai-config
- GET /api/ai-status

## 7. FFmpeg
- Bot tu tim ffmpeg/ffprobe theo env, tools local, va PATH.
- Neu thieu ffmpeg, sticker anh tinh van co the tao duoc; video/gif can ffmpeg day du.

## 8. Quan ly admin
- Them UID admin bot vao assets/data/list_admin.json
- Sau khi sua cau hinh, khoi dong lai bot de ap dung.
