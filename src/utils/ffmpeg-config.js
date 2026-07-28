import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";

let configured = false;
let cachedStatus = null;
let resolvedFfmpegPath = null;
let resolvedFfprobePath = null;

function findFirstExisting(paths) {
  for (const target of paths) {
    if (target && fs.existsSync(target)) {
      return target;
    }
  }
  return null;
}

function normalizeExistingPath(target) {
  if (!target) {
    return null;
  }

  const trimmed = String(target).replace(/^"|"$/g, "");
  if (fs.existsSync(trimmed)) {
    return trimmed;
  }

  return null;
}

function findBinaryInPath(binaryName) {
  const envPath = process.env.PATH || process.env.Path || "";
  const segments = envPath.split(path.delimiter).filter(Boolean);
  const candidates = [];

  for (const segment of segments) {
    candidates.push(path.join(segment, binaryName));
  }

  return findFirstExisting(candidates);
}

function getFfmpegCandidates() {
  const cwd = process.cwd();
  const programFiles = process.env.ProgramFiles || "C:\\Program Files";
  const programFilesX86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
  const localAppData = process.env.LOCALAPPDATA || "C:\\Users\\Admin\\AppData\\Local";
  const exe = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";

  return [
    process.env.FFMPEG_PATH,
    path.join("C:", "ffmpeg", "bin", exe),
    path.join("C:", "ffmpeg", exe),
    path.join(programFiles, "ffmpeg", "bin", exe),
    path.join(programFilesX86, "ffmpeg", "bin", exe),
    path.join(localAppData, "ffmpeg", "bin", exe),
    path.join(cwd, "tools", "ffmpeg", "bin", exe),
    path.join(cwd, "tools", "ffmpeg", exe),
  ];
}

function getFfprobeCandidates() {
  const cwd = process.cwd();
  const exe = process.platform === "win32" ? "ffprobe.exe" : "ffprobe";

  return [
    process.env.FFPROBE_PATH,
    path.join(cwd, "tools", "ffmpeg", "bin", exe),
    path.join(cwd, "tools", "ffmpeg", exe),
    ffprobeInstaller.path,
  ];
}

export function configureFfmpeg(ffmpeg) {
  if (configured) {
    return;
  }

  const ffmpegPath = findFirstExisting(getFfmpegCandidates()) || findBinaryInPath(process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
  const ffprobePath = findFirstExisting(getFfprobeCandidates()) || findBinaryInPath(process.platform === "win32" ? "ffprobe.exe" : "ffprobe");

  resolvedFfmpegPath = ffmpegPath || null;
  resolvedFfprobePath = ffprobePath || null;

  if (resolvedFfmpegPath) {
    ffmpeg.setFfmpegPath(resolvedFfmpegPath);
  }

  if (resolvedFfprobePath) {
    ffmpeg.setFfprobePath(resolvedFfprobePath);
  }

  configured = true;
}

export async function detectFfmpegStatus(ffmpeg) {
  configureFfmpeg(ffmpeg);

  if (cachedStatus) {
    return cachedStatus;
  }

  const binaryPath = normalizeExistingPath(resolvedFfmpegPath) || findFirstExisting(getFfmpegCandidates()) || findBinaryInPath(process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
  const probeBinaryPath = normalizeExistingPath(resolvedFfprobePath) || findFirstExisting(getFfprobeCandidates()) || findBinaryInPath(process.platform === "win32" ? "ffprobe.exe" : "ffprobe");

  const ffmpegCheck = binaryPath
    ? spawnSync(binaryPath, ["-version"], { windowsHide: true, encoding: "utf8" })
    : { status: 1, error: new Error("Missing ffmpeg binary") };

  const ffprobeCheck = probeBinaryPath
    ? spawnSync(probeBinaryPath, ["-version"], { windowsHide: true, encoding: "utf8" })
    : { status: 1, error: new Error("Missing ffprobe binary") };

  const hasFfmpeg = Boolean(binaryPath && ffmpegCheck.status === 0);

  cachedStatus = {
    hasFfmpeg,
    hasFfprobe: Boolean(probeBinaryPath && ffprobeCheck.status === 0),
    ffmpegPath: binaryPath || null,
    ffprobePath: probeBinaryPath || null,
  };
  return cachedStatus;
}
