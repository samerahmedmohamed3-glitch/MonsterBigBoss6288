import { Router, type IRouter } from "express";
import fs from "fs";
import path from "path";
import {
  GetBotStatusResponse,
  UpdateBotCookiesBody,
  GetBotCommandsResponse,
  ToggleBotCommandResponse,
} from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Bot directory is at workspace root /bot
const BOT_DIR = path.join(process.cwd(), "bot");
const STATE_FILE = path.join(BOT_DIR, "bot-state.json");
const APPSTATE_FILE = path.join(BOT_DIR, "appstate.json");
const COMMANDS_CONFIG_FILE = path.join(BOT_DIR, "commands-config.json");
const COMMANDS_DIR = path.join(BOT_DIR, "Commands");

// Command descriptions in Arabic
const COMMAND_DESCRIPTIONS: Record<string, string> = {
  قصف: "إرسال جرائد متكررة في المجموعة",
  كاتش: "حماية أسماء الأعضاء واسم المجموعة",
  رد: "ردود تلقائية على رسائل محددة",
  يوت: "تحميل وإرسال صوت من يوتيوب",
  بانكاي: "طرد أو إضافة أعضاء",
};

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJsonFile(filePath: string, data: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

// GET /bot/status
router.get("/bot/status", async (_req, res): Promise<void> => {
  const raw = readJsonFile(STATE_FILE, {
    loggedIn: false,
    userID: null,
    userName: null,
    uptime: 0,
    reconnectAttempts: 0,
    lastUpdated: null,
    status: "غير معروف",
  });

  const data = GetBotStatusResponse.parse(raw);
  res.json(data);
});

// POST /bot/cookies
router.post("/bot/cookies", async (req, res): Promise<void> => {
  const parsed = UpdateBotCookiesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صالحة: " + parsed.error.message });
    return;
  }

  const { cookies } = parsed.data;
  if (!Array.isArray(cookies) || cookies.length === 0) {
    res.status(400).json({ error: "يجب أن تكون الكوكيز مصفوفة غير فارغة" });
    return;
  }

  try {
    writeJsonFile(APPSTATE_FILE, cookies);
    logger.info("Bot appstate updated via control panel");
    res.json({ success: true, message: "تم تحديث الكوكيز. البوت سيعيد الاتصال تلقائياً." });
  } catch (err) {
    logger.error({ err }, "Failed to write appstate file");
    res.status(500).json({ error: "فشل في حفظ الكوكيز" });
  }
});

// GET /bot/commands
router.get("/bot/commands", async (_req, res): Promise<void> => {
  // Discover command files
  let fileNames: string[] = [];
  try {
    fileNames = fs.readdirSync(COMMANDS_DIR).filter((f) => f.endsWith(".js"));
  } catch {
    fileNames = [];
  }

  // Read config
  const config = readJsonFile<Record<string, { enabled: boolean }>>(
    COMMANDS_CONFIG_FILE,
    {}
  );

  // Build list from files
  const commands: Array<{ name: string; enabled: boolean; description: string }> = [];
  const seenNames = new Set<string>();

  for (const file of fileNames) {
    try {
      // Extract command name from file by reading it quickly
      const filePath = path.join(COMMANDS_DIR, file);
      const content = fs.readFileSync(filePath, "utf8");
      const nameMatch = content.match(/name:\s*['"`]([^'"`]+)['"`]/);
      const name = nameMatch ? nameMatch[1] : file.replace(".js", "");
      if (!seenNames.has(name)) {
        seenNames.add(name);
        const enabled = config[name]?.enabled !== false; // default enabled
        commands.push({
          name,
          enabled,
          description: COMMAND_DESCRIPTIONS[name] ?? "أمر بوت",
        });
      }
    } catch {
      // skip malformed files
    }
  }

  // Also add any in config not yet in files
  for (const [name, val] of Object.entries(config)) {
    if (!seenNames.has(name)) {
      seenNames.add(name);
      commands.push({
        name,
        enabled: val.enabled,
        description: COMMAND_DESCRIPTIONS[name] ?? "أمر بوت",
      });
    }
  }

  const data = GetBotCommandsResponse.parse(commands);
  res.json(data);
});

// POST /bot/commands/:name/toggle
router.post("/bot/commands/:name/toggle", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.name) ? req.params.name[0] : req.params.name;
  const name = decodeURIComponent(raw);

  // Verify command exists
  let found = false;
  try {
    const files = fs.readdirSync(COMMANDS_DIR).filter((f) => f.endsWith(".js"));
    for (const file of files) {
      const content = fs.readFileSync(path.join(COMMANDS_DIR, file), "utf8");
      const nameMatch = content.match(/name:\s*['"`]([^'"`]+)['"`]/);
      const cmdName = nameMatch ? nameMatch[1] : file.replace(".js", "");
      if (cmdName === name) {
        found = true;
        break;
      }
    }
  } catch {
    // ignore read errors
  }

  if (!found) {
    // Also accept names from config
    const config = readJsonFile<Record<string, { enabled: boolean }>>(COMMANDS_CONFIG_FILE, {});
    found = name in config;
  }

  if (!found) {
    res.status(404).json({ error: `الأمر "${name}" غير موجود` });
    return;
  }

  // Toggle in config
  const config = readJsonFile<Record<string, { enabled: boolean }>>(COMMANDS_CONFIG_FILE, {});
  const currentEnabled = config[name]?.enabled !== false;
  config[name] = { enabled: !currentEnabled };
  writeJsonFile(COMMANDS_CONFIG_FILE, config);

  logger.info({ command: name, enabled: !currentEnabled }, "Bot command toggled");

  const result = ToggleBotCommandResponse.parse({
    name,
    enabled: !currentEnabled,
    description: COMMAND_DESCRIPTIONS[name] ?? "أمر بوت",
  });
  res.json(result);
});

export default router;
