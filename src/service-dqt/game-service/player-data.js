import fs from "fs";
import path from "path";
import Big from "big.js";
import { readCommandConfig } from "../../utils/io-json.js";

let cachedPrefix = "/";
export function getGamePrefix() {
  try {
    const config = readCommandConfig();
    if (config?.prefix) cachedPrefix = config.prefix;
  } catch (e) {}
  return cachedPrefix;
}


const playersFilePath = path.resolve("./assets/json-data/players.json");
const STARTING_BALANCE = "100000"; // 100,000 VNĐ cho người mới
const MIN_DAILY_REWARD = 20000;
const MAX_DAILY_REWARD = 60000;

let playersCache = null;

function getCurrentDateVN() {
  const now = new Date();
  const options = { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" };
  const formatter = new Intl.DateTimeFormat("en-CA", options); // YYYY-MM-DD
  return formatter.format(now);
}

function getCurrentTimeVN() {
  const now = new Date();
  const options = {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  };
  const parts = new Intl.DateTimeFormat("en-GB", options).formatToParts(now);
  const findPart = (type) => parts.find((p) => p.type === type)?.value || "00";
  return `${findPart("year")}-${findPart("month")}-${findPart("day")} ${findPart("hour")}:${findPart("minute")}:${findPart("second")}`;
}

export function loadPlayersData() {
  if (playersCache) return playersCache;

  try {
    if (fs.existsSync(playersFilePath)) {
      const raw = fs.readFileSync(playersFilePath, "utf-8");
      const parsed = JSON.parse(raw);
      playersCache = parsed.players || {};
    } else {
      playersCache = {};
      savePlayersData();
    }
  } catch (error) {
    console.error("Lỗi đọc players.json:", error);
    playersCache = {};
  }

  return playersCache;
}

export function savePlayersData() {
  try {
    const dir = path.dirname(playersFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(playersFilePath, JSON.stringify({ players: playersCache || {} }, null, 2), "utf-8");
  } catch (error) {
    console.error("Lỗi lưu players.json:", error);
  }
}

export function getOrCreatePlayer(userId, userName = "Người Chơi") {
  const players = loadPlayersData();
  const uid = String(userId);

  if (!players[uid]) {
    players[uid] = {
      idUserZalo: uid,
      account: uid,
      playerName: userName,
      balance: STARTING_BALANCE,
      registrationTime: getCurrentTimeVN(),
      totalWinnings: "0",
      totalLosses: "0",
      netProfit: "0",
      totalGames: 0,
      totalWinGames: 0,
      winRate: "0.00",
      lastDailyReward: null,
      lastDailyDate: null,
      isBanned: false
    };
    savePlayersData();
  } else if (userName && userName !== "Người Chơi" && players[uid].playerName !== userName) {
    players[uid].playerName = userName;
  }
  return players[uid];
}


export function getPlayerData(userId) {
  const players = loadPlayersData();
  return players[String(userId)] || null;
}

export function updatePlayerBalance(userId, deltaAmount) {
  const player = getOrCreatePlayer(userId);
  const current = new Big(player.balance || 0);
  const change = new Big(deltaAmount);
  const newBalance = current.plus(change);

  if (newBalance.lt(0)) {
    throw new Error("Số dư không đủ để thực hiện giao dịch");
  }

  player.balance = newBalance.round(0, Big.roundDown).toString();
  savePlayersData();
  return player.balance;
}

export function setPlayerBalance(userId, newAmount) {
  const player = getOrCreatePlayer(userId);
  player.balance = new Big(newAmount).round(0, Big.roundDown).toString();
  savePlayersData();
  return player.balance;
}

export function recordGameResult(userId, isWin, betAmount, winProfit) {
  const player = getOrCreatePlayer(userId);
  const betBig = new Big(betAmount);
  const winProfitBig = new Big(winProfit);

  player.totalGames = (player.totalGames || 0) + 1;

  if (isWin) {
    player.totalWinGames = (player.totalWinGames || 0) + 1;
    player.totalWinnings = new Big(player.totalWinnings || 0).plus(winProfitBig).toString();
    player.balance = new Big(player.balance || 0).plus(winProfitBig).toString();
  } else {
    player.totalLosses = new Big(player.totalLosses || 0).plus(betBig).toString();
    player.balance = new Big(player.balance || 0).minus(betBig).toString();
  }

  player.netProfit = new Big(player.totalWinnings || 0).minus(new Big(player.totalLosses || 0)).toString();
  player.winRate = ((player.totalWinGames / player.totalGames) * 100).toFixed(2);

  savePlayersData();
  return player;
}

export function checkDailyStatus(userId) {
  const player = getOrCreatePlayer(userId);
  const todayVN = getCurrentDateVN();

  if (player.lastDailyDate === todayVN) {
    const now = new Date();
    const vnTimeStr = now.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" });
    const vnDate = new Date(vnTimeStr);
    const tomorrow = new Date(vnDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const diffMs = tomorrow.getTime() - vnDate.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    return { canClaim: false, hoursRemaining: hours, minutesRemaining: minutes, player };
  }

  return { canClaim: true, player };
}

export function claimDailyReward(userId, userName) {
  const status = checkDailyStatus(userId);
  if (!status.canClaim) {
    return {
      success: false,
      hoursRemaining: status.hoursRemaining,
      minutesRemaining: status.minutesRemaining,
      player: status.player
    };
  }

  const player = getOrCreatePlayer(userId, userName);
  const todayVN = getCurrentDateVN();
  const timeNowVN = getCurrentTimeVN();

  let reward = Math.floor(Math.random() * (MAX_DAILY_REWARD - MIN_DAILY_REWARD + 1)) + MIN_DAILY_REWARD;
  reward = Math.floor(reward / 1000) * 1000;

  const isLuckyDouble = Math.random() < 0.15;
  if (isLuckyDouble) reward *= 2;

  player.balance = new Big(player.balance || 0).plus(reward).toString();
  player.lastDailyDate = todayVN;
  player.lastDailyReward = timeNowVN;

  savePlayersData();

  return {
    success: true,
    reward,
    isLuckyDouble,
    newBalance: player.balance,
    player
  };
}

export function transferBalance(fromUserId, toUserId, amount, fromName, toName) {
  const fromPlayer = getOrCreatePlayer(fromUserId, fromName);
  const toPlayer = getOrCreatePlayer(toUserId, toName);

  const amountBig = new Big(amount);
  const fromBalBig = new Big(fromPlayer.balance || 0);

  if (amountBig.lte(0)) {
    throw new Error("Số tiền chuyển phải lớn hơn 0");
  }

  if (fromBalBig.lt(amountBig)) {
    throw new Error("Số dư không đủ để chuyển khoản");
  }

  fromPlayer.balance = fromBalBig.minus(amountBig).toString();
  toPlayer.balance = new Big(toPlayer.balance || 0).plus(amountBig).toString();

  savePlayersData();

  return {
    fromBalance: fromPlayer.balance,
    toBalance: toPlayer.balance
  };
}

export function getLeaderboard(limit = 10) {
  const players = loadPlayersData();
  const list = Object.values(players);

  list.sort((a, b) => {
    const diff = new Big(b.balance || 0).minus(new Big(a.balance || 0));
    return diff.gt(0) ? 1 : diff.lt(0) ? -1 : 0;
  });

  return list.slice(0, limit);
}

