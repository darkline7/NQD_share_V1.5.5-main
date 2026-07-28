# Zalo ChatBot NQD Share V1.5.5

Bot Zalo nay duoc chay tu `src/index.js`, con `bot.js` dong vai tro wrapper de giu process chay lai neu bot bi dung dot ngot.

## Tong quan

- Ket noi Zalo thong qua module `src/api-zalo/`.
- Xu ly tin nhan rieng, tin nhan nhom, undo va reaction.
- Co web dashboard o port `3300` de quan ly mot so tinh nang runtime.
- Co cac nhom chuc nang: anti-link, anti-spam, anti-undo, AI fallback, upload media, queue, circuit breaker va command config.

## Yeu cau moi truong

- Node.js 20 tro len.
- npm.
- Tai khoan Zalo va cac thong tin cau hinh hop le.

## Cai dat

```bash
npm install
```

## Cau hinh

Chinh cac file sau theo moi truong cua ban:

- `assets/config.json`: cookie, imei, userAgent.
- `assets/data/list_admin.json`: danh sach admin bot cap cao.
- `assets/data/group_settings.json`: cau hinh rieng theo tung nhom.
- `assets/json-data/command.json`: cau hinh bat/tat va tham so lenh.
- `assets/web-config/web-config.json`: cau hinh runtime cho dashboard.
- `assets/json-data/prophylactic.json`: trang thai bao ve upload attachment.

## Chay bot

Chay truc tiep runtime chinh:

```bash
npm start
```

Neu muon dung wrapper tu dong restart process:

```bash
npm run bot
```

## Web dashboard

Khi bot da khoi dong, dashboard static va API chay tai:

- `http://localhost:3300`

API hien co:

- `GET /api/runtime-controls`
- `POST /api/runtime-controls`
- `GET /api/ai-config`
- `POST /api/ai-config`
- `GET /api/ai-status`

## Cau truc chinh

- `src/index.js`: khoi dong Zalo client, lang nghe message/group_event/undo/reaction.
- `src/web-service/web-server.js`: web server, socket.io va cac API runtime.
- `src/commands/`: cac lenh chat va lenh quan tri.
- `src/automations/`: xu ly su kien va tu dong hoa.
- `src/service-dqt/`: cac dich vu phu tro, AI, crawl, info va scheduler.
- `src/utils/`: doc/ghi JSON, cache, queue, circuit breaker va cong cu tien ich.

## Ghi chu

- Danh sach lenh va alias duoc quan ly theo code trong `src/commands/` va file cau hinh command.
- Mot so lenh co the bat/tat theo tinh trang cau hinh hien tai, nen khong nen coi README nay la danh sach lenh co dinh.
- Neu thay doi `assets/config.json` hoac cac file cau hinh lien quan, hay khoi dong lai bot de ap dung.
