import path from "path";
import { spawn } from "child_process";

import { getGlobalPrefix } from "../service.js";
import { removeMention } from "../../utils/format-util.js";
import { sendMessageCompleteRequest, sendMessageWarningRequest } from "../chat-zalo/chat-style/chat-style.js";

const PYTHON_COMMANDS = ["python", "py"];
const CHECK_TIMEOUT_MS = 120000;

function extractTarget(content, prefix, aliasCommand) {
  const trimmed = content.trim();

  if (trimmed.toLowerCase().startsWith("/check")) {
    return trimmed.replace(/^\/check\s*/i, "").trim();
  }

  return trimmed.replace(`${prefix}${aliasCommand}`, "").trim();
}

function isValidTarget(target) {
  const value = target.replace(/\s+/g, "");
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const isPhone = /^\+?[0-9]{6,15}$/.test(value);
  return isEmail || isPhone;
}

function runPythonCommand(pythonCmd, scriptPath, target) {
  return new Promise((resolve, reject) => {
    const child = spawn(pythonCmd, [scriptPath, target], {
      cwd: process.cwd(),
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timeoutId = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, CHECK_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timeoutId);

      if (timedOut) {
        reject(new Error("Check command timed out"));
        return;
      }

      const lines = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      const lastLine = lines[lines.length - 1] || "";

      let parsed = null;
      if (lastLine) {
        try {
          parsed = JSON.parse(lastLine);
        } catch (error) {
          parsed = null;
        }
      }

      if (!parsed) {
        const stderrShort = stderr.trim().slice(0, 300);
        reject(new Error(`Cannot parse result from checker. ${stderrShort}`.trim()));
        return;
      }

      resolve({
        exitCode: code,
        data: parsed,
        stderr,
      });
    });
  });
}

async function runMetaAICheck(target) {
  const scriptPath = path.join(process.cwd(), "meta_ai_check_cli.py");
  let lastError = null;

  for (const pythonCmd of PYTHON_COMMANDS) {
    try {
      return await runPythonCommand(pythonCmd, scriptPath, target);
    } catch (error) {
      lastError = error;
      const message = String(error?.message || "").toLowerCase();
      if (!message.includes("enoent")) {
        continue;
      }
    }
  }

  throw lastError || new Error("Cannot run python command");
}

export async function handleMetaAICheckCommand(api, message, aliasCommand) {
  const content = removeMention(message);
  const prefix = getGlobalPrefix();
  const target = extractTarget(content, prefix, aliasCommand);

  if (!target) {
    await sendMessageWarningRequest(
      api,
      message,
      { caption: `Vui long nhap email/sdt can kiem tra.\nVi du: /check phamthanhbinh839@gmail.com` },
      30000
    );
    return;
  }

  if (!isValidTarget(target)) {
    await sendMessageWarningRequest(
      api,
      message,
      { caption: "Dinh dang khong hop le. Chi chap nhan email hoac so dien thoai." },
      30000
    );
    return;
  }

  await sendMessageCompleteRequest(
    api,
    message,
    { caption: `Dang kiem tra Meta AI cho: ${target}\nVui long doi toi da 2 phut...` },
    45000
  );

  try {
    const result = await runMetaAICheck(target);
    const metaAiFound = Boolean(result?.data?.meta_ai);

    if (metaAiFound) {
      await sendMessageCompleteRequest(
        api,
        message,
        { caption: `SUCCESS: Da phat hien nut Meta AI/Get support cho ${target}.` },
        120000
      );
      return;
    }

    await sendMessageWarningRequest(
      api,
      message,
      { caption: `Khong thay nut Meta AI/Get support cho ${target} o lan kiem tra nay.` },
      120000
    );
  } catch (error) {
    await sendMessageWarningRequest(
      api,
      message,
      { caption: `Loi khi chay /check: ${String(error?.message || error).slice(0, 350)}` },
      120000
    );
  }
}
