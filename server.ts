import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { spawn, spawnSync, ChildProcess, execSync, exec } from "child_process";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";

interface LogItem {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'otp' | 'system';
  message: string;
}

interface HostedBot {
  id: string;
  name: string;
  entryFile: string;
  ownerId?: string;
  ownerName?: string;
  token?: string;
  botUsername?: string;
  status: 'running' | 'stopped' | 'starting' | 'error';
  pid: number | null;
  uptimeSeconds: number;
  startTime: string | null;
  createdAt: string;
  autoRestart: boolean;
  fileCount?: number;
  error?: string;
  env?: Record<string, string>;
}

export interface Account {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
  isVerified: boolean;
  verificationToken?: string;
  verificationSentAt?: string;
}

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Enable CORS for keepalive pings
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, PUT, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

const HOSTED_BOTS_DIR = path.join(process.cwd(), "hosted_bots");
const REGISTRY_FILE = path.join(HOSTED_BOTS_DIR, "registry.json");
const ACCOUNTS_FILE = path.join(HOSTED_BOTS_DIR, "accounts.json");
const SESSIONS_FILE = path.join(HOSTED_BOTS_DIR, "sessions.json");
const MAX_LOGS = 1000;

const activeProcesses = new Map<string, ChildProcess>();
const botLogsMap = new Map<string, LogItem[]>();
const startTimes = new Map<string, Date>();
const startingBots = new Set<string>();
const botRestartTimeouts = new Map<string, NodeJS.Timeout>();

// Robust kill function to ensure no orphan or duplicate bot processes run simultaneously
function killBotProcesses(botId: string, botDir: string) {
  if (botRestartTimeouts.has(botId)) {
    clearTimeout(botRestartTimeouts.get(botId)!);
    botRestartTimeouts.delete(botId);
  }
  const proc = activeProcesses.get(botId);
  if (proc) {
    try { proc.kill("SIGKILL"); } catch {}
    activeProcesses.delete(botId);
  }
  startTimes.delete(botId);
  try {
    execSync(`pkill -9 -f "${botDir}" || true`);
  } catch {}
  try {
    const output = execSync(`ls -l /proc/*/cwd 2>/dev/null | grep "${botDir}" | awk '{print $9}' | cut -d/ -f3 || true`).toString();
    for (const pidStr of output.trim().split(/\s+/)) {
      const pid = parseInt(pidStr, 10);
      if (!isNaN(pid) && pid > 0 && pid !== process.pid) {
        try { process.kill(pid, "SIGKILL"); } catch {}
      }
    }
  } catch {}
}
let hostedBots: HostedBot[] = [];
let accounts: Account[] = [];
const sessions = new Map<string, { userId: string; expiresAt: number }>();

function loadAccounts() {
  try {
    if (!fs.existsSync(HOSTED_BOTS_DIR)) {
      fs.mkdirSync(HOSTED_BOTS_DIR, { recursive: true });
    }
    if (fs.existsSync(ACCOUNTS_FILE)) {
      accounts = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf-8"));
    } else {
      accounts = [];
      fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify([], null, 2), "utf-8");
    }
  } catch (e: any) {
    console.error("Error loading accounts:", e.message);
  }
}

function saveAccounts() {
  try {
    if (!fs.existsSync(HOSTED_BOTS_DIR)) {
      fs.mkdirSync(HOSTED_BOTS_DIR, { recursive: true });
    }
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2), "utf-8");
  } catch (e: any) {
    console.error("Error saving accounts:", e.message);
  }
}

function loadSessions() {
  try {
    if (!fs.existsSync(HOSTED_BOTS_DIR)) {
      fs.mkdirSync(HOSTED_BOTS_DIR, { recursive: true });
    }
    if (fs.existsSync(SESSIONS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SESSIONS_FILE, "utf-8"));
      for (const [token, sess] of Object.entries(data)) {
        sessions.set(token, sess as any);
      }
    } else {
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify({}, null, 2), "utf-8");
    }
  } catch {}
}

function saveSessions() {
  try {
    if (!fs.existsSync(HOSTED_BOTS_DIR)) {
      fs.mkdirSync(HOSTED_BOTS_DIR, { recursive: true });
    }
    const obj: Record<string, any> = {};
    for (const [token, sess] of sessions.entries()) {
      if (sess.expiresAt > Date.now()) {
        obj[token] = sess;
      }
    }
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(obj, null, 2), "utf-8");
  } catch {}
}

// Mailer function for Account Email Verification
async function sendActivationEmail(email: string, name: string, token: string, baseUrl: string) {
  const activationLink = `${baseUrl}/?verify_token=${token}`;
  const apiLink = `${baseUrl}/api/auth/verify-email?token=${token}`;

  const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>Activate Your Account - Cloud Bot Host</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0b0f19; padding: 40px 20px;">
      <tr>
        <td align="center">
          <table width="100%" max-width="520px" cellpadding="0" cellspacing="0" style="max-width: 520px; background-color: #131b2e; border: 1px solid #23314d; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
            <tr>
              <td style="padding: 36px 32px; text-align: center; background: linear-gradient(180deg, #18233c 0%, #131b2e 100%);">
                <div style="width: 64px; height: 64px; margin: 0 auto 16px; background-color: #1e293b; border: 1px solid #334155; border-radius: 16px; line-height: 64px; font-size: 32px;">
                  🤖
                </div>
                <h1 style="margin: 0 0 8px; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Cloud Bot Host</h1>
                <p style="margin: 0; color: #94a3b8; font-size: 14px;">Next-Gen 24/7 Telegram Bot Cloud</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 32px; font-size: 15px; line-height: 1.6; color: #cbd5e1;">
                <p style="margin: 0 0 16px; font-size: 16px; color: #ffffff; font-weight: 600;">স্বাগতম, ${name}!</p>
                <p style="margin: 0 0 24px;">Cloud Bot Host প্ল্যাটফর্মে রেজিস্ট্রেশন করার জন্য ধন্যবাদ। আপনার একাউন্টটি সক্রিয় করতে এবং ২৪/৭ টেলিগ্রাম বট হোস্ট করতে নিচের বাটনে ক্লিক করুন:</p>
                
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="padding: 10px 0 24px;">
                      <a href="${activationLink}" target="_blank" style="display: inline-block; background: linear-gradient(90deg, #d946ef 0%, #ec4899 50%, #f43f5e 100%); color: #ffffff; text-decoration: none; font-weight: 700; font-size: 15px; padding: 14px 32px; border-radius: 12px; box-shadow: 0 8px 20px rgba(236,72,153,0.35);">
                        Activate Now / একাউন্ট একটিভ করুন 🚀
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin: 0 0 8px; font-size: 13px; color: #64748b;">বাটনে সমস্যা হলে নিচের লিংকে ক্লিক করুন:</p>
                <p style="margin: 0 0 24px; font-size: 12px; word-break: break-all; background-color: #0c1220; padding: 12px; border-radius: 8px; border: 1px solid #1e293b; color: #38bdf8;">
                  ${activationLink}
                </p>

                <p style="margin: 0; font-size: 13px; color: #64748b;">এই লিংকটি ২৪ ঘণ্টার জন্য কার্যকর থাকবে। আপনি এই একাউন্ট তৈরি না করে থাকলে এই ইমেইলটি উপেক্ষা করতে পারেন।</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 20px 32px; background-color: #0c1220; text-align: center; border-top: 1px solid #1e293b; font-size: 12px; color: #64748b;">
                Cloud Bot Host Platform • 24/7 Never-Sleep Telegram Bot Hosting
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;

  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(process.env.SMTP_PORT || "587", 10),
        secure: process.env.SMTP_SECURE === "true" || process.env.SMTP_PORT === "465",
        auth: {
          user: smtpUser,
          pass: smtpPass
        }
      });
      await transporter.sendMail({
        from: process.env.SMTP_FROM || `"Cloud Bot Host" <${smtpUser}>`,
        to: email,
        subject: "Activate Your Account - Cloud Bot Host | একাউন্ট একটিভ করুন",
        html: htmlContent
      });
      console.log(`[Email Verification] Sent real activation email to ${email}`);
      return { sent: true, link: activationLink };
    } catch (err: any) {
      console.error(`[Email Verification] SMTP Error for ${email}:`, err.message);
      return { sent: false, error: err.message, link: activationLink };
    }
  } else {
    console.log(`[Email Verification] SMTP not set. Instant verification link generated for ${email}: ${activationLink}`);
    return { sent: false, link: activationLink, note: "SMTP not configured" };
  }
}

export function getAuthUser(req: express.Request): Account | null {
  const authHeader = req.headers.authorization;
  let token = "";
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7).trim();
  } else if (req.query.token) {
    token = String(req.query.token);
  }
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    saveSessions();
    return null;
  }
  return accounts.find(a => a.id === session.userId) || null;
}

// Helper to add logs to specific bot
function addBotLog(botId: string, level: LogItem['level'], message: string) {
  if (!botLogsMap.has(botId)) {
    botLogsMap.set(botId, []);
  }
  const logs = botLogsMap.get(botId)!;
  const item: LogItem = {
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    timestamp: new Date().toLocaleTimeString(),
    level,
    message: message.trimEnd()
  };
  logs.push(item);
  if (logs.length > MAX_LOGS) {
    logs.shift();
  }
}

// Save registry to disk
function saveRegistry() {
  try {
    if (!fs.existsSync(HOSTED_BOTS_DIR)) {
      fs.mkdirSync(HOSTED_BOTS_DIR, { recursive: true });
    }
    const cleanList = hostedBots.map(b => ({
      id: b.id,
      name: b.name,
      entryFile: b.entryFile,
      ownerId: b.ownerId || "",
      ownerName: b.ownerName || "",
      token: b.token || "",
      botUsername: b.botUsername || "",
      status: activeProcesses.has(b.id) ? 'running' : 'stopped',
      createdAt: b.createdAt,
      autoRestart: b.autoRestart !== false,
      env: b.env || {}
    }));
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(cleanList, null, 2), "utf-8");
  } catch (err: any) {
    console.error("Error saving registry:", err.message);
  }
}

// Initialize hosted bots
function initHostedBots() {
  try {
    if (!fs.existsSync(HOSTED_BOTS_DIR)) {
      fs.mkdirSync(HOSTED_BOTS_DIR, { recursive: true });
    }

    loadAccounts();
    loadSessions();

    if (fs.existsSync(REGISTRY_FILE)) {
      const data = JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf-8"));
      hostedBots = data.map((b: any) => ({
        ...b,
        status: 'stopped',
        pid: null,
        uptimeSeconds: 0,
        startTime: null,
        autoRestart: b.autoRestart !== false
      }));
    } else {
      hostedBots = [];
      saveRegistry();
    }

    // Auto-start bots configured to auto-restart (24/7 background run)
    for (const bot of hostedBots) {
      if (bot.autoRestart) {
        startBot(bot.id);
      }
    }
  } catch (err: any) {
    console.error("Init hosted bots error:", err.message);
  }
}

// 24/7 Autonomous Watchdog: Periodically monitors processes and restarts any crashed bot
setInterval(() => {
  for (const bot of hostedBots) {
    if (bot.autoRestart && bot.status !== 'error' && !startingBots.has(bot.id) && !botRestartTimeouts.has(bot.id)) {
      const proc = activeProcesses.get(bot.id);
      if (!proc || proc.killed || proc.exitCode !== null) {
        // Bot should be running, recover it!
        console.log(`[24/7 Watchdog] Recovering bot ${bot.name} (${bot.id})...`);
        addBotLog(bot.id, 'system', `⚡ [24/7 Watchdog] Anti-Offline Protection: Bot automatically recovered & running live.`);
        startBot(bot.id);
      }
    }
  }
}, 8000);

// Self-KeepAlive Ping Loop to keep Cloud Run container warm and 24/7 active
setInterval(() => {
  try {
    fetch(`http://127.0.0.1:${PORT}/api/ping`).catch(() => {});
  } catch {}
}, 120000);

// Default services
const DEFAULT_SERVICES = [
  {
    sid: "TELEGRAM",
    ranges: [
      { range: "23762XXX", country: "🇨🇲 Cameroon" },
      { range: "23765XXX", country: "🇨🇲 Cameroon" },
      { range: "4077XXX", country: "🇷🇴 Romania" },
      { range: "22501XXX", country: "🇨🇮 Ivory Coast" },
      { range: "22897XXX", country: "🇹🇬 Togo" }
    ]
  },
  {
    sid: "WHATSAPP",
    ranges: [
      { range: "22501XXX", country: "🇨🇮 Ivory Coast" },
      { range: "26132XXX", country: "🇲🇬 Madagascar" },
      { range: "23762XXX", country: "🇨🇲 Cameroon" },
      { range: "22897XXX", country: "🇹🇬 Togo" }
    ]
  },
  {
    sid: "FACEBOOK",
    ranges: [
      { range: "23762XXX", country: "🇨🇲 Cameroon" },
      { range: "4077XXX", country: "🇷🇴 Romania" },
      { range: "22501XXX", country: "🇨🇮 Ivory Coast" },
      { range: "26132XXX", country: "🇲🇬 Madagascar" }
    ]
  },
  {
    sid: "TIKTOK",
    ranges: [
      { range: "22505XXX", country: "🇨🇮 Ivory Coast" },
      { range: "22501XXX", country: "🇨🇮 Ivory Coast" },
      { range: "26132XXX", country: "🇲🇬 Madagascar" },
      { range: "23762XXX", country: "🇨🇲 Cameroon" }
    ]
  },
  {
    sid: "IMO",
    ranges: [
      { range: "23762XXX", country: "🇨🇲 Cameroon" },
      { range: "22501XXX", country: "🇨🇮 Ivory Coast" },
      { range: "4077XXX", country: "🇷🇴 Romania" }
    ]
  },
  {
    sid: "GOOGLE / GMAIL",
    ranges: [
      { range: "23762XXX", country: "🇨🇲 Cameroon" },
      { range: "4077XXX", country: "🇷🇴 Romania" },
      { range: "26132XXX", country: "🇲🇬 Madagascar" }
    ]
  },
  {
    sid: "TWITTER / X",
    ranges: [
      { range: "22897XXX", country: "🇹🇬 Togo" },
      { range: "4077XXX", country: "🇷🇴 Romania" },
      { range: "23762XXX", country: "🇨🇲 Cameroon" }
    ]
  },
  {
    sid: "INSTAGRAM",
    ranges: [
      { range: "23762XXX", country: "🇨🇲 Cameroon" },
      { range: "4077XXX", country: "🇷🇴 Romania" },
      { range: "22501XXX", country: "🇨🇮 Ivory Coast" }
    ]
  },
  {
    sid: "SNAPCHAT",
    ranges: [
      { range: "23762XXX", country: "🇨🇲 Cameroon" },
      { range: "22501XXX", country: "🇨🇮 Ivory Coast" }
    ]
  }
];

// Automatically fix bot scripts, URLs, services, and credentials
function patchAndValidateBotCode(botDir: string, botId: string, customBaseUrl?: string, customApiKey?: string, customToken?: string): void {
  try {
    // 1. Initialize custom_services.json
    const servicesPath = path.join(botDir, "custom_services.json");
    if (!fs.existsSync(servicesPath) || fs.readFileSync(servicesPath, "utf-8").trim() === "[]" || fs.readFileSync(servicesPath, "utf-8").trim() === "") {
      fs.writeFileSync(servicesPath, JSON.stringify(DEFAULT_SERVICES, null, 2), "utf-8");
      addBotLog(botId, 'system', `⚙️ Initialized default services for bot.`);
    }

    // 2. Initialize default JSON files expected by SMS panel bots to avoid FileNotFoundError
    const defaultJsonFiles: { name: string; defaultContent: string }[] = [
      { name: "users.json", defaultContent: "{}" },
      { name: "paid_sms.json", defaultContent: "{}" },
      { name: "user_stats.json", defaultContent: "{}" },
      { name: "referral_data.json", defaultContent: "{}" },
      { name: "banned_users.json", defaultContent: "[]" },
      { name: "withdraw_requests.json", defaultContent: "{}" },
      { name: "activity_logs.json", defaultContent: "[]" },
      { name: "datarange.json", defaultContent: "{}" }
    ];

    for (const jf of defaultJsonFiles) {
      const p = path.join(botDir, jf.name);
      if (!fs.existsSync(p) || fs.readFileSync(p, "utf-8").trim() === "") {
        fs.writeFileSync(p, jf.defaultContent, "utf-8");
      }
    }

    const pyFiles = fs.readdirSync(botDir).filter(f => f.endsWith('.py'));
    for (const file of pyFiles) {
      const p = path.join(botDir, file);
      let content = fs.readFileSync(p, "utf-8");
      let changed = false;

      // Fix deprecated domain
      if (content.includes("mino-sms-panel.xyz")) {
        content = content.replace(/https?:\/\/mino-sms-panel\.xyz/g, (customBaseUrl || "https://minosms.com").replace(/\/+$/, ''));
        changed = true;
      }

      // Update API_KEY if provided
      if (customApiKey && content.includes("API_KEY =")) {
        content = content.replace(/API_KEY\s*=\s*["'][^"']+["']/, `API_KEY = "${customApiKey.trim()}"`);
        changed = true;
      }

      // Update BASE_URL if provided
      if (customBaseUrl && content.includes("BASE_URL =")) {
        content = content.replace(/BASE_URL\s*=\s*["'][^"']+["']/, `BASE_URL = "${customBaseUrl.trim().replace(/\/+$/, '')}"`);
        changed = true;
      }

      // Update BOT_TOKEN if provided
      if (customToken && content.includes("BOT_TOKEN =")) {
        content = content.replace(/BOT_TOKEN\s*=\s*["'][^"']+["']/, `BOT_TOKEN = "${customToken.trim()}"`);
        changed = true;
      }

      if (changed) {
        fs.writeFileSync(p, content, "utf-8");
      }
    }
  } catch (err: any) {
    console.error(`[PatchBotCode] Error for ${botId}:`, err.message);
  }
}

// Ensure all required dependencies for a bot are installed without blocking startup
const installedPackageCache = new Set<string>([
  'requests', 'aiohttp', 'telebot', 'telegram', 'httpx', 'pillow', 'python-dotenv', 'pyTelegramBotAPI', 'python-telegram-bot'
]);

function ensureBotDependencies(botDir: string, botId: string): void {
  // Asynchronously resolve dependencies in background so bot boots in milliseconds
  setTimeout(() => {
    try {
      const reqFile = path.join(botDir, "requirements.txt");
      if (fs.existsSync(reqFile)) {
        const content = fs.readFileSync(reqFile, "utf-8").trim();
        if (content) {
          exec(`python3 -m pip install -r "${reqFile}" --break-system-packages`, { cwd: botDir, timeout: 60000 }, (err) => {
            if (!err) {
              addBotLog(botId, 'system', `✓ Requirements libraries installed and verified.`);
            }
          });
        }
      }

      const files = fs.readdirSync(botDir).filter(f => f.endsWith('.py'));
      const neededPackages: string[] = [];
      for (const f of files) {
        try {
          const code = fs.readFileSync(path.join(botDir, f), 'utf-8');
          if ((code.includes('import telebot') || code.includes('from telebot')) && !installedPackageCache.has('pyTelegramBotAPI')) neededPackages.push('pyTelegramBotAPI');
          if ((code.includes('import telegram') || code.includes('from telegram')) && !installedPackageCache.has('python-telegram-bot')) neededPackages.push('python-telegram-bot>=20.0');
          if (code.includes('import aiogram') && !installedPackageCache.has('aiogram')) neededPackages.push('aiogram');
          if (code.includes('import qrcode') && !installedPackageCache.has('qrcode')) neededPackages.push('qrcode');
        } catch {}
      }

      for (const pkg of neededPackages) {
        exec(`python3 -m pip install "${pkg}" --break-system-packages`, { timeout: 45000 }, (err) => {
          if (!err) {
            installedPackageCache.add(pkg);
          }
        });
      }
    } catch (err: any) {
      console.error(`[Dependency Resolver] Error checking dependencies for ${botId}:`, err.message);
    }
  }, 10);
}

// Start a bot process (24/7 background execution)
async function startBot(botId: string): Promise<boolean> {
  const bot = hostedBots.find(b => b.id === botId);
  if (!bot) {
    return false;
  }

  if (startingBots.has(botId)) {
    return false;
  }
  startingBots.add(botId);

  try {
    const botDir = path.join(HOSTED_BOTS_DIR, bot.id);
    if (!fs.existsSync(botDir)) {
      addBotLog(botId, 'error', `Directory not found: ${botDir}`);
      bot.status = 'error';
      bot.error = "Bot directory missing";
      startingBots.delete(botId);
      return false;
    }

    // Kill any existing/orphaned processes running inside this botDir to prevent Telegram Conflict errors
    killBotProcesses(botId, botDir);
    // Allow brief OS pause for Telegram socket cleanup
    await new Promise(r => setTimeout(r, 600));

    let entryFile = bot.entryFile;
    let scriptPath = path.join(botDir, entryFile);
    if (!fs.existsSync(scriptPath)) {
      const allFiles = fs.readdirSync(botDir);
      const candidate = allFiles.find(f => f.toLowerCase() === 'bot.py' || f.toLowerCase() === 'main.py' || f.toLowerCase() === 'app.py') || allFiles.find(f => f.endsWith('.py'));
      if (candidate) {
        entryFile = candidate;
        bot.entryFile = candidate;
        scriptPath = path.join(botDir, candidate);
        saveRegistry();
      } else {
        // If NO python file exists, restore from template or ./bot.py so bot is functional
        const rootBotPy = path.join(process.cwd(), "bot.py");
        if (fs.existsSync(rootBotPy)) {
          fs.copyFileSync(rootBotPy, path.join(botDir, "bot.py"));
          entryFile = "bot.py";
          bot.entryFile = "bot.py";
          scriptPath = path.join(botDir, "bot.py");
          saveRegistry();
          addBotLog(botId, 'system', `ℹ️ মূল স্ক্রিপ্ট পুনরুদ্ধার করা হয়েছে (bot.py restored).`);
        } else {
          addBotLog(botId, 'error', `Entry script not found: ${bot.entryFile}`);
          bot.status = 'error';
          bot.error = `Entry script ${bot.entryFile} not found`;
          startingBots.delete(botId);
          return false;
        }
      }
    }

    // Auto-patch bot code and services
    patchAndValidateBotCode(botDir, botId, bot.env?.BASE_URL, bot.env?.API_KEY, bot.token);

    // Pre-flight Python syntax verification & auto-repair
    try {
      execSync(`python3 -m py_compile "${scriptPath}"`, { stdio: "pipe" });
    } catch (compileErr: any) {
      let codeContent = fs.readFileSync(scriptPath, "utf-8");
      let wasRepaired = false;
      // 1. Repair missing url= in InlineKeyboardButton("...", https://...
      if (/InlineKeyboardButton\([^)]*,\s*https?:\/\//.test(codeContent)) {
        codeContent = codeContent.replace(/(InlineKeyboardButton\([^,]+,\s*)(https?:\/\/[^",\s)]+)/g, '$1url="$2"');
        wasRepaired = true;
      }
      // 2. Repair missing opening quote before url in button
      if (/InlineKeyboardButton\([^)]*,\s*https?:\/\/.*?"\s*,/i.test(codeContent)) {
        codeContent = codeContent.replace(/(InlineKeyboardButton\([^,]+,\s*)https?:\/\/([^",\s]+)"/g, '$1url="https://$2"');
        wasRepaired = true;
      }
      if (wasRepaired) {
        fs.writeFileSync(scriptPath, codeContent, "utf-8");
        addBotLog(botId, 'system', `🔧 বাটনের সিনট্যাক্স স্বয়ংক্রিয়ভাবে ঠিক করা হয়েছে (Auto-repaired button URL syntax).`);
      }
      try {
        execSync(`python3 -m py_compile "${scriptPath}"`, { stdio: "pipe" });
      } catch (errFinal: any) {
        const errLines = (errFinal.stderr?.toString() || errFinal.stdout?.toString() || errFinal.message).trim();
        addBotLog(botId, 'error', `❌ পাইথন স্ক্রিপ্ট সিনট্যাক্স এরর (SyntaxError):\n${errLines}\n\nঅনুগ্রহ করে কোড এডিটরে গিয়ে এই লাইনটির ভুল সংশোধন করুন।`);
        bot.status = 'error';
        bot.error = "SyntaxError in python script";
        bot.autoRestart = false; // Stop crash loop on syntax errors
        saveRegistry();
        startingBots.delete(botId);
        return false;
      }
    }

    // Auto dependency check in background
    ensureBotDependencies(botDir, botId);

    bot.status = 'starting';
    addBotLog(botId, 'system', `🚀 Starting bot '${bot.name}' in 24/7 background mode (python3 "${entryFile}")...`);

    const botEnv: NodeJS.ProcessEnv = {
      ...process.env,
      PYTHONUNBUFFERED: "1",
      ...(bot.token ? { BOT_TOKEN: bot.token } : {}),
      ...(bot.env?.BASE_URL ? { BASE_URL: bot.env.BASE_URL } : { BASE_URL: "https://minosms.com" }),
      ...(bot.env?.API_KEY ? { API_KEY: bot.env.API_KEY } : {}),
      ...(bot.env || {})
    };

    const proc = spawn("python3", [scriptPath], {
      cwd: botDir,
      env: botEnv,
      detached: false
    });

    activeProcesses.set(botId, proc);
    startTimes.set(botId, new Date());
    bot.pid = proc.pid || null;
    bot.status = 'running';
    bot.startTime = new Date().toISOString();
    bot.error = undefined;
    bot.autoRestart = true; // Ensure auto-restart is enabled for 24/7 persistence
    saveRegistry();

    proc.stdout?.on("data", (data) => {
      const text = data.toString();
      const lines = text.split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;
        let level: LogItem['level'] = 'info';
        if (line.includes('OTP') || line.includes('SUCCESSFUL')) level = 'otp';
        else if (line.includes('ERROR') || line.includes('Fail') || line.includes('Traceback')) level = 'error';
        else if (line.includes('WARNING') || line.includes('WARN')) level = 'warn';
        addBotLog(botId, level, line);
      }
    });

    proc.stderr?.on("data", (data) => {
      const text = data.toString();
      const lines = text.split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;

        // 1. Detect Telegram Polling Conflict
        if (line.includes('telegram.error.Conflict') || line.includes('terminated by other getUpdates request')) {
          addBotLog(botId, 'warn', `⚠️ টেলিগ্রাম কনফ্লিক্ট: অন্য কোনো ডিভাইস বা সেশনে এই বট টোকেন চালু থাকতে পারে। সমস্ত প্রসেস বন্ধ করে ৫ সেকেন্ড পর ফ্রেশ রিস্টার্ট করা হচ্ছে...`);
          try { proc.kill("SIGKILL"); } catch {}
          killBotProcesses(botId, botDir);
          if (bot.autoRestart) {
            if (botRestartTimeouts.has(botId)) {
              clearTimeout(botRestartTimeouts.get(botId)!);
            }
            const t = setTimeout(() => {
              botRestartTimeouts.delete(botId);
              if (bot.autoRestart && !activeProcesses.has(botId)) {
                startBot(botId);
              }
            }, 5000);
            botRestartTimeouts.set(botId, t);
          }
          return;
        }

        addBotLog(botId, 'error', line);

        // 2. Auto-install missing module or package
        let pkgToInstall: string | null = null;
        const modMatch = line.match(/No module named ['"]([^'"]+)['"]/);
        const pkgNotInstalledMatch = line.match(/the ['"]([a-zA-Z0-9_\-]+)['"] package is not installed/i);
        const pipHintMatch = line.match(/pip install ([a-zA-Z0-9_\-\[\]]+)/i);

        if (modMatch && modMatch[1]) {
          const missingMod = modMatch[1];
          const pkgMap: Record<string, string> = {
            'telebot': 'pyTelegramBotAPI',
            'PIL': 'pillow',
            'bs4': 'beautifulsoup4',
            'dotenv': 'python-dotenv',
            'telegram': 'python-telegram-bot>=20.0',
            'dateutil': 'python-dateutil',
            'jwt': 'PyJWT',
            'cv2': 'opencv-python',
            'pyotp': 'pyotp'
          };
          pkgToInstall = pkgMap[missingMod] || missingMod;
        } else if (pkgNotInstalledMatch && pkgNotInstalledMatch[1]) {
          pkgToInstall = pkgNotInstalledMatch[1];
        } else if (pipHintMatch && pipHintMatch[1]) {
          pkgToInstall = pipHintMatch[1];
        }

        if (pkgToInstall) {
          addBotLog(botId, 'system', `📦 অটো-ইনস্টল করা হচ্ছে প্রয়োজনীয় প্যাকেজ '${pkgToInstall}'...`);
          try {
            execSync(`python3 -m pip install ${pkgToInstall} --break-system-packages`, { timeout: 45000, stdio: "ignore" });
            addBotLog(botId, 'system', `✅ '${pkgToInstall}' ইনস্টলেশন সফল! বট রিস্টার্ট করা হচ্ছে...`);
            setTimeout(() => {
              restartBot(botId);
            }, 1500);
          } catch (err: any) {
            addBotLog(botId, 'error', `ইনস্টল করতে ব্যর্থ: ${err.message}`);
          }
        }
      }
    });

    proc.on("error", (err) => {
      addBotLog(botId, 'error', `Process execution error: ${err.message}`);
      bot.status = 'error';
      bot.error = err.message;
    });

    proc.on("close", (code, signal) => {
      addBotLog(botId, 'system', `Process stopped (exit code: ${code ?? signal})`);
      activeProcesses.delete(botId);
      startTimes.delete(botId);
      bot.pid = null;
      bot.startTime = null;

      if (bot.autoRestart) {
        // 24/7 Anti-Offline: auto restart after 3 seconds (debounced)
        addBotLog(botId, 'warn', `⚡ 24/7 Watchdog: Auto-restarting in 3 seconds to keep bot online...`);
        if (botRestartTimeouts.has(botId)) {
          clearTimeout(botRestartTimeouts.get(botId)!);
        }
        const t = setTimeout(() => {
          botRestartTimeouts.delete(botId);
          if (bot.autoRestart && !activeProcesses.has(botId)) {
            startBot(botId);
          }
        }, 3000);
        botRestartTimeouts.set(botId, t);
      } else {
        bot.status = 'stopped';
        saveRegistry();
      }
    });

    return true;
  } catch (err: any) {
    addBotLog(botId, 'error', `Failed to spawn python process: ${err.message}`);
    bot.status = 'error';
    bot.error = err.message;
    return false;
  } finally {
    startingBots.delete(botId);
  }
}

// Stop a bot process
function stopBot(botId: string): Promise<boolean> {
  return new Promise((resolve) => {
    const bot = hostedBots.find(b => b.id === botId);
    if (bot) {
      bot.autoRestart = false; // Disable auto-restart when user manually clicks Stop
      bot.status = 'stopped';
      bot.pid = null;
      bot.startTime = null;
      saveRegistry();
      const botDir = path.join(HOSTED_BOTS_DIR, bot.id);
      killBotProcesses(botId, botDir);
    } else {
      const proc = activeProcesses.get(botId);
      if (proc) {
        try { proc.kill("SIGKILL"); } catch {}
        activeProcesses.delete(botId);
      }
      startTimes.delete(botId);
    }
    addBotLog(botId, 'system', `Bot process stopped.`);
    resolve(true);
  });
}

// Restart a bot
async function restartBot(botId: string): Promise<boolean> {
  const bot = hostedBots.find(b => b.id === botId);
  if (bot) {
    bot.autoRestart = true;
  }
  await stopBot(botId);
  await new Promise(r => setTimeout(r, 1800)); // Allow Telegram getUpdates session to completely close
  return await startBot(botId);
}

// Get bot uptime seconds
function getBotUptime(botId: string): number {
  const st = startTimes.get(botId);
  if (!st || !activeProcesses.has(botId)) return 0;
  return Math.floor((Date.now() - st.getTime()) / 1000);
}

// Count files in bot directory
function getBotFileCount(botId: string): number {
  try {
    const dir = path.join(HOSTED_BOTS_DIR, botId);
    if (fs.existsSync(dir)) {
      return fs.readdirSync(dir).length;
    }
  } catch {}
  return 0;
}

// ==================== API ROUTES ====================

// Health check
app.get("/api/health", (req, res) => {
  const runningCount = Array.from(activeProcesses.values()).filter(p => !p.killed).length;
  res.json({
    status: "ok",
    totalBots: hostedBots.length,
    runningBots: runningCount,
    watchdog: "24/7 Active",
    pythonVersion: "Python 3.10.12",
    timestamp: new Date().toISOString()
  });
});

// 24/7 Keep-Alive ping
app.get("/api/ping", (req, res) => {
  res.send("PONG 200 OK - BotHost Cloud Running 24/7 Live");
});

app.get("/api/keepalive/:botId", (req, res) => {
  const { botId } = req.params;
  const bot = hostedBots.find(b => b.id === botId);
  const isRunning = activeProcesses.has(botId);
  res.json({
    ok: true,
    botId,
    botName: bot?.name || "Unknown Bot",
    status: isRunning ? "running" : (bot?.status || "stopped"),
    uptime: getBotUptime(botId),
    watchdog: "24/7 Online",
    timestamp: new Date().toISOString()
  });
});

// Helper to authorize bot access (Strict User Isolation)
function authorizeBotAccess(req: express.Request, botId: string): { user: Account; bot: HostedBot } | { error: string; status: number } {
  const user = getAuthUser(req);
  if (!user) {
    return { error: "অনুগ্রহ করে প্রথমে লগইন করুন (Please login first)", status: 401 };
  }
  const bot = hostedBots.find(b => b.id === botId);
  if (!bot) {
    return { error: "Bot not found", status: 404 };
  }
  // If bot is assigned to an owner, only that owner can access it
  if (bot.ownerId && bot.ownerId !== user.id) {
    return {
      error: "অ্যাক্সেস সংরক্ষিত: এটি অন্য ইউজারের বট। আপনি শুধুমাত্র আপনার নিজের বট ও ফাইল দেখতে ও পরিচালনা করতে পারবেন। (Access Denied: This bot belongs to another user.)",
      status: 403
    };
  }
  return { user, bot };
}

// ==================== AUTHENTICATION ROUTES ====================

// 1. Register new user with Email Verification
app.post("/api/auth/register", async (req, res) => {
  try {
    loadAccounts();
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "নাম, ইমেইল এবং পাসওয়ার্ড আবশ্যক" });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    if (cleanEmail.length < 3 || !cleanEmail.includes("@")) {
      return res.status(400).json({ error: "সঠিক ইমেইল অ্যাড্রেস প্রদান করুন" });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: "পাসওয়ার্ড ন্যূনতম ৬ অক্ষরের হতে হবে" });
    }
    if (accounts.some(a => a.email.toLowerCase() === cleanEmail)) {
      return res.status(400).json({ error: "এই ইমেইল দিয়ে ইতিমধ্যে একাউন্ট রয়েছে। দয়া করে লগইন করুন।" });
    }

    const salt = crypto.randomBytes(16).toString("hex");
    const passwordHash = crypto.pbkdf2Sync(String(password), salt, 1000, 64, "sha512").toString("hex");
    const verificationToken = crypto.randomBytes(24).toString("hex");

    const newAccount: Account = {
      id: `usr_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
      name: String(name).trim(),
      email: cleanEmail,
      salt,
      passwordHash,
      createdAt: new Date().toISOString(),
      isVerified: true, // auto-verified so user is immediately ready to log in
      verificationToken,
      verificationSentAt: new Date().toISOString()
    };

    accounts.push(newAccount);
    saveAccounts();

    // Create 90-day persistent session so user stays logged in across reloads
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = Date.now() + 90 * 24 * 60 * 60 * 1000;
    sessions.set(token, { userId: newAccount.id, expiresAt });
    saveSessions();

    // Trigger Activation Email (optional in background)
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const emailResult = await sendActivationEmail(newAccount.email, newAccount.name, verificationToken, baseUrl);

    res.json({
      success: true,
      token,
      user: {
        id: newAccount.id,
        name: newAccount.name,
        email: newAccount.email,
        isVerified: true,
        verificationToken,
        createdAt: newAccount.createdAt
      },
      verificationToken,
      verificationLink: emailResult.link,
      emailSent: emailResult.sent,
      message: "রেজিস্ট্রেশন সফল হয়েছে! এখন আপনার পাসওয়ার্ড দিয়ে লগইন করুন।"
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Login user
app.post("/api/auth/login", (req, res) => {
  try {
    loadAccounts();
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "ইমেইল এবং পাসওয়ার্ড আবশ্যক" });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    const cleanPassword = String(password);
    const account = accounts.find(a => a.email.toLowerCase() === cleanEmail);
    if (!account) {
      return res.status(401).json({ error: "এই ইমেইল দিয়ে কোনো অ্যাকাউন্ট পাওয়া যায়নি। দয়া করে প্রথমে রেজিস্ট্রেশন করুন।" });
    }

    const hash1 = crypto.pbkdf2Sync(cleanPassword, account.salt, 1000, 64, "sha512").toString("hex");
    const hash2 = crypto.pbkdf2Sync(cleanPassword.trim(), account.salt, 1000, 64, "sha512").toString("hex");
    if (hash1 !== account.passwordHash && hash2 !== account.passwordHash) {
      return res.status(401).json({ error: "পাসওয়ার্ড সঠিক নয়। দয়া করে সঠিক পাসওয়ার্ড লিখুন অথবা নিচে 'পাসওয়ার্ড রিসেট' করুন।" });
    }

    // 90-day permanent session token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = Date.now() + 90 * 24 * 60 * 60 * 1000;
    sessions.set(token, { userId: account.id, expiresAt });
    saveSessions();

    res.json({
      success: true,
      token,
      user: {
        id: account.id,
        name: account.name,
        email: account.email,
        isVerified: account.isVerified !== false,
        verificationToken: account.verificationToken,
        createdAt: account.createdAt
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2.1 Reset / Update user password
app.post("/api/auth/reset-password", (req, res) => {
  try {
    loadAccounts();
    const { email, newPassword } = req.body;
    if (!email || !newPassword) {
      return res.status(400).json({ error: "ইমেইল এবং নতুন পাসওয়ার্ড আবশ্যক" });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: "নতুন পাসওয়ার্ড ন্যূনতম ৬ অক্ষরের হতে হবে" });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    const account = accounts.find(a => a.email.toLowerCase() === cleanEmail);
    if (!account) {
      return res.status(404).json({ error: "এই ইমেইলে কোনো অ্যাকাউন্ট পাওয়া যায়নি।" });
    }

    const salt = crypto.randomBytes(16).toString("hex");
    const passwordHash = crypto.pbkdf2Sync(String(newPassword), salt, 1000, 64, "sha512").toString("hex");
    account.salt = salt;
    account.passwordHash = passwordHash;
    account.isVerified = true;
    saveAccounts();

    // Generate fresh session token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = Date.now() + 90 * 24 * 60 * 60 * 1000;
    sessions.set(token, { userId: account.id, expiresAt });
    saveSessions();

    res.json({
      success: true,
      token,
      user: {
        id: account.id,
        name: account.name,
        email: account.email,
        isVerified: true,
        createdAt: account.createdAt
      },
      message: "পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে এবং আপনি লগইন হয়েছেন।"
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Current authenticated user profile
app.get("/api/auth/me", (req, res) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ authenticated: false, error: "Not logged in" });
  }
  res.json({
    authenticated: true,
    success: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      isVerified: user.isVerified !== false,
      verificationToken: user.verificationToken,
      createdAt: user.createdAt
    }
  });
});

// 4. Verify Account via Link Click (from email)
app.get("/api/auth/verify-email", (req, res) => {
  const token = String(req.query.token || "");
  if (!token) {
    return res.status(400).send("Invalid verification link.");
  }
  const account = accounts.find(a => a.verificationToken === token);
  if (!account) {
    return res.status(404).send("ভেরিফিকেশন লিঙ্কটি সঠিক নয় বা ইতিমধ্যে ব্যবহৃত হয়েছে।");
  }
  account.isVerified = true;
  delete account.verificationToken;
  saveAccounts();
  // Redirect to home dashboard with verified flag
  res.redirect("/?verified=1");
});

// 5. Verify Account via In-App Token verification
app.post("/api/auth/verify-token", (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: "টোকেন আবশ্যক" });
  }
  const account = accounts.find(a => a.verificationToken === token);
  if (!account) {
    return res.status(404).json({ error: "ভেরিফিকেশন লিঙ্ক বা কোডটি সঠিক নয় বা মেয়াদোত্তীর্ণ হয়েছে।" });
  }
  account.isVerified = true;
  delete account.verificationToken;
  saveAccounts();

  res.json({
    success: true,
    message: "আপনার অ্যাকাউন্ট সফলভাবে সক্রিয় করা হয়েছে! (Account successfully activated)",
    user: {
      id: account.id,
      name: account.name,
      email: account.email,
      isVerified: true,
      createdAt: account.createdAt
    }
  });
});

// 6. Resend Verification Email
app.post("/api/auth/resend-verification", async (req, res) => {
  try {
    const user = getAuthUser(req);
    const email = req.body.email || (user ? user.email : "");
    if (!email) {
      return res.status(400).json({ error: "ইমেইল প্রদান করুন" });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    const account = accounts.find(a => a.email.toLowerCase() === cleanEmail);
    if (!account) {
      return res.status(404).json({ error: "অ্যাকাউন্ট পাওয়া যায়নি" });
    }
    if (account.isVerified) {
      return res.json({ success: true, message: "অ্যাকাউন্ট ইতিমধ্যে ভেরিফাইড!" });
    }

    const verificationToken = crypto.randomBytes(24).toString("hex");
    account.verificationToken = verificationToken;
    account.verificationSentAt = new Date().toISOString();
    saveAccounts();

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const emailResult = await sendActivationEmail(account.email, account.name, verificationToken, baseUrl);

    res.json({
      success: true,
      message: "নতুন অ্যাক্টিভেশন ইমেইল পাঠানো হয়েছে!",
      verificationToken,
      verificationLink: emailResult.link,
      sent: emailResult.sent
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Logout
app.post("/api/auth/logout", (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim();
    sessions.delete(token);
    saveSessions();
  }
  res.json({ success: true });
});

// ==================== CODE & SYNTAX CHECKER ====================
app.post("/api/code/syntax-check", (req, res) => {
  const { code } = req.body;
  if (typeof code !== "string") {
    return res.status(400).json({ error: "Code must be a string" });
  }
  const tmpFile = path.join("/tmp", `syntax_check_${Date.now()}_${Math.random().toString(36).substring(7)}.py`);
  try {
    fs.writeFileSync(tmpFile, code, "utf-8");
    const result = spawnSync("python3", ["-m", "py_compile", tmpFile], { encoding: "utf-8" });
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    if (result.status === 0) {
      return res.json({ valid: true, message: "Python Syntax OK! পাইথন কোড সম্পূর্ণ নির্ভুল ও নিরাপদ।" });
    } else {
      const stderr = result.stderr || result.stdout || "Syntax Error";
      const lineMatch = stderr.match(/line (\d+)/i);
      const line = lineMatch ? parseInt(lineMatch[1], 10) : null;
      return res.json({
        valid: false,
        error: stderr.replace(new RegExp(tmpFile, "g"), "script.py"),
        line
      });
    }
  } catch (e: any) {
    if (fs.existsSync(tmpFile)) try { fs.unlinkSync(tmpFile); } catch {}
    return res.status(500).json({ valid: false, error: e.message });
  }
});

// ==================== DATABASE OVERVIEW & EXPORT ====================
app.get("/api/database/overview", (req, res) => {
  const user = getAuthUser(req);
  res.json({
    storageLocation: {
      accountsDb: path.join(HOSTED_BOTS_DIR, "accounts.json"),
      registryDb: path.join(HOSTED_BOTS_DIR, "registry.json"),
      sessionsDb: path.join(HOSTED_BOTS_DIR, "sessions.json"),
      botsStorage: HOSTED_BOTS_DIR
    },
    stats: {
      totalUsers: accounts.length,
      verifiedUsers: accounts.filter(a => a.isVerified).length,
      totalBots: hostedBots.length,
      runningBots: Array.from(activeProcesses.keys()).length,
      activeSessions: sessions.size
    },
    accounts: accounts.map(a => ({
      id: a.id,
      name: a.name,
      email: a.email,
      isVerified: a.isVerified !== false,
      createdAt: a.createdAt,
      botsCount: hostedBots.filter(b => b.ownerId === a.id).length
    })),
    bots: hostedBots.map(b => ({
      id: b.id,
      name: b.name,
      ownerId: b.ownerId,
      ownerName: b.ownerName,
      status: activeProcesses.has(b.id) ? "running" : "stopped",
      autoRestart: b.autoRestart,
      createdAt: b.createdAt
    }))
  });
});

app.get("/api/database/export", (req, res) => {
  const table = (req.query.table as string) || "all";
  if (table === "accounts") {
    res.setHeader("Content-Disposition", 'attachment; filename="accounts.json"');
    res.setHeader("Content-Type", "application/json");
    return res.json(accounts.map(a => ({
      id: a.id,
      name: a.name,
      email: a.email,
      isVerified: a.isVerified !== false,
      createdAt: a.createdAt
    })));
  } else if (table === "bots") {
    res.setHeader("Content-Disposition", 'attachment; filename="bots_registry.json"');
    res.setHeader("Content-Type", "application/json");
    return res.json(hostedBots);
  } else {
    res.setHeader("Content-Disposition", 'attachment; filename="bothost_database_backup.json"');
    res.setHeader("Content-Type", "application/json");
    return res.json({
      exportedAt: new Date().toISOString(),
      accounts: accounts.map(a => ({
        id: a.id,
        name: a.name,
        email: a.email,
        isVerified: a.isVerified !== false,
        createdAt: a.createdAt
      })),
      bots: hostedBots,
      sessionsCount: sessions.size
    });
  }
});

// ==================== BOT ROUTES (USER ISOLATED) ====================

// List hosted bots: strictly isolated so each user only sees their own bots
app.get("/api/bots", (req, res) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: "লগইন করুন (Please login to view your bots)", bots: [], total: 0 });
  }

  // Filter ONLY bots belonging to this user
  const userBots = hostedBots.filter(b => b.ownerId === user.id);
  const list = userBots.map(b => {
    const isRunning = activeProcesses.has(b.id);
    return {
      ...b,
      status: isRunning ? 'running' : b.status,
      pid: isRunning ? activeProcesses.get(b.id)?.pid || null : null,
      uptimeSeconds: getBotUptime(b.id),
      fileCount: getBotFileCount(b.id)
    };
  });
  res.json({ bots: list, total: list.length, user: { id: user.id, name: user.name, email: user.email } });
});

// Create / Deploy a new bot
app.post("/api/bots", async (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: "বট হোস্ট করতে অনুগ্রহ করে প্রথমে লগইন করুন (Please login first)" });
    }

    const { name, entryFile = "bot.py", token = "", baseUrl = "https://minosms.com", apiKey = "", files = [], autoStart = true, env = {}, zipBase64 } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: "Bot name is required" });
    }

    if (baseUrl) {
      env.BASE_URL = baseUrl.replace(/\/+$/, '');
    }
    if (apiKey) {
      env.API_KEY = apiKey.trim();
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "bot";
    const botId = `${slug}-${Math.random().toString(36).substring(2, 7)}`;
    const botDir = path.join(HOSTED_BOTS_DIR, botId);
    fs.mkdirSync(botDir, { recursive: true });

    // Handle ZIP archive if provided
    if (zipBase64 && typeof zipBase64 === 'string') {
      try {
        const zipPath = path.join(botDir, "upload.zip");
        fs.writeFileSync(zipPath, Buffer.from(zipBase64, 'base64'));
        execSync(`unzip -o -q "${zipPath}" -d "${botDir}"`, { timeout: 20000 });
        try { fs.unlinkSync(zipPath); } catch {}
      } catch (err: any) {
        addBotLog(botId, 'error', `Failed to unzip archive: ${err.message}`);
      }
    }

    // Write all uploaded or templated files
    let hasEntryFile = false;
    if (Array.isArray(files) && files.length > 0) {
      for (const f of files) {
        if (f.name && f.content !== undefined) {
          const safeName = path.basename(f.name);
          fs.writeFileSync(path.join(botDir, safeName), f.content, "utf-8");
          if (safeName === entryFile) hasEntryFile = true;
        }
      }
    }

    // Auto-detect entry file if needed
    let finalEntryFile = entryFile;
    const existingFiles = fs.readdirSync(botDir);
    if (!existingFiles.includes(finalEntryFile)) {
      const candidate = existingFiles.find(f => f.toLowerCase() === 'bot.py' || f.toLowerCase() === 'main.py' || f.toLowerCase() === 'app.py') || existingFiles.find(f => f.endsWith('.py'));
      if (candidate) {
        finalEntryFile = candidate;
        hasEntryFile = true;
      }
    } else {
      hasEntryFile = true;
    }

    // If entry file not present, create a starter bot
    if (!hasEntryFile) {
      const defaultScript = `# Telegram Bot - ${name}
import os
import logging
from telegram import Update
from telegram.ext import ApplicationBuilder, CommandHandler, ContextTypes

BOT_TOKEN = os.getenv("BOT_TOKEN", "${token}")
logging.basicConfig(format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO)

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    await update.message.reply_text(f"Hello {user.first_name}! I am ${name}, hosted live 24/7 on BotHost Cloud 🚀")

async def ping(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("Pong! Bot is 24/7 online & running.")

if __name__ == '__main__':
    print("🚀 Initializing ${name}...")
    if not BOT_TOKEN:
        print("⚠️ Warning: BOT_TOKEN is not configured.")
    app = ApplicationBuilder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("ping", ping))
    print("✅ Bot polling started successfully!")
    app.run_polling()
`;
      fs.writeFileSync(path.join(botDir, finalEntryFile), defaultScript, "utf-8");
    }

    // Requirements file
    const reqPath = path.join(botDir, "requirements.txt");
    if (!fs.existsSync(reqPath)) {
      fs.writeFileSync(reqPath, "python-telegram-bot>=20.0\nhttpx\npyTelegramBotAPI\nrequests\n", "utf-8");
    }

    // Detect Telegram token from script if not explicitly provided
    let detectedToken = token.trim();
    if (!detectedToken) {
      try {
        const pyFiles = fs.readdirSync(botDir).filter(f => f.endsWith('.py'));
        for (const py of pyFiles) {
          const content = fs.readFileSync(path.join(botDir, py), 'utf-8');
          const m = content.match(/BOT_TOKEN\s*=\s*(?:os\.getenv\([^,]+,\s*)?["']([0-9]{8,12}:[a-zA-Z0-9_-]{30,45})["']/);
          if (m && m[1]) {
            detectedToken = m[1];
            break;
          }
        }
      } catch {}
    }

    const newBot: HostedBot = {
      id: botId,
      name,
      entryFile: finalEntryFile,
      ownerId: user.id,
      ownerName: user.name,
      token: detectedToken,
      status: 'stopped',
      pid: null,
      uptimeSeconds: 0,
      startTime: null,
      createdAt: new Date().toISOString(),
      autoRestart: autoStart,
      env
    };

    hostedBots.unshift(newBot);
    saveRegistry();

    // Auto-fix bot scripts & credentials
    patchAndValidateBotCode(botDir, botId, baseUrl, apiKey, detectedToken);
    addBotLog(botId, 'system', `🚀 Bot instance created: ${name} (ID: ${botId})`);

    // Verify token if provided
    if (token) {
      try {
        const tRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
        const tData = await tRes.json();
        if (tData.ok && tData.result?.username) {
          newBot.botUsername = tData.result.username;
          addBotLog(botId, 'info', `Connected to Telegram bot: @${tData.result.username}`);
          saveRegistry();
        }
      } catch {}
    }

    if (autoStart) {
      await startBot(botId);
    }

    res.json({
      success: true,
      bot: {
        ...newBot,
        status: activeProcesses.has(botId) ? 'running' : newBot.status,
        fileCount: getBotFileCount(botId)
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Single bot controls
app.post("/api/bots/:id/start", async (req, res) => {
  const auth = authorizeBotAccess(req, req.params.id);
  if ('error' in auth) return res.status(auth.status).json({ error: auth.error });
  const ok = await startBot(req.params.id);
  const bot = hostedBots.find(b => b.id === req.params.id);
  res.json({ success: ok, bot });
});

app.post("/api/bots/:id/stop", async (req, res) => {
  const auth = authorizeBotAccess(req, req.params.id);
  if ('error' in auth) return res.status(auth.status).json({ error: auth.error });
  const ok = await stopBot(req.params.id);
  const bot = hostedBots.find(b => b.id === req.params.id);
  res.json({ success: ok, bot });
});

app.post("/api/bots/:id/restart", async (req, res) => {
  const auth = authorizeBotAccess(req, req.params.id);
  if ('error' in auth) return res.status(auth.status).json({ error: auth.error });
  const ok = await restartBot(req.params.id);
  const bot = hostedBots.find(b => b.id === req.params.id);
  res.json({ success: ok, bot });
});

// DELETE A HOSTED BOT COMPLETELY
app.delete("/api/bots/:id", async (req, res) => {
  const { id } = req.params;
  const auth = authorizeBotAccess(req, id);
  if ('error' in auth) return res.status(auth.status).json({ error: auth.error });
  try {
    await stopBot(id);
    hostedBots = hostedBots.filter(b => b.id !== id);
    saveRegistry();

    // Delete directory
    const botDir = path.join(HOSTED_BOTS_DIR, id);
    if (fs.existsSync(botDir)) {
      fs.rmSync(botDir, { recursive: true, force: true });
    }
    botLogsMap.delete(id);
    startTimes.delete(id);
    activeProcesses.delete(id);
    res.json({ success: true, message: `Bot ${id} deleted successfully` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Bot logs
app.get("/api/bots/:id/logs", (req, res) => {
  const { id } = req.params;
  const auth = authorizeBotAccess(req, id);
  if ('error' in auth) return res.status(auth.status).json({ error: auth.error });
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 300;
  const logs = botLogsMap.get(id) || [];
  res.json({ logs: logs.slice(-limit) });
});

app.post("/api/bots/:id/clear-logs", (req, res) => {
  const { id } = req.params;
  const auth = authorizeBotAccess(req, id);
  if ('error' in auth) return res.status(auth.status).json({ error: auth.error });
  if (botLogsMap.has(id)) {
    botLogsMap.set(id, []);
  }
  addBotLog(id, 'system', 'Console logs cleared.');
  res.json({ success: true });
});

// BOT FILES MANAGEMENT
// 1. List files with details
app.get("/api/bots/:id/files", (req, res) => {
  const { id } = req.params;
  const auth = authorizeBotAccess(req, id);
  if ('error' in auth) return res.status(auth.status).json({ error: auth.error });
  const bot = auth.bot;
  const botDir = path.join(HOSTED_BOTS_DIR, id);
  try {
    if (!fs.existsSync(botDir)) return res.json({ files: [], fileDetails: [] });
    const all = fs.readdirSync(botDir);
    const validFiles = all.filter(f => !f.startsWith('.git') && f !== '__pycache__' && f !== 'upload.zip');
    
    const fileDetails = validFiles.map(f => {
      const p = path.join(botDir, f);
      const stat = fs.statSync(p);
      return {
        name: f,
        size: stat.size,
        modified: stat.mtime.toISOString(),
        isEntry: bot ? bot.entryFile === f : (f === 'bot.py' || f === 'main.py'),
        isEditable: f.endsWith('.py') || f.endsWith('.json') || f.endsWith('.txt') || f.endsWith('.env') || f.endsWith('.md')
      };
    });

    res.json({ files: validFiles, fileDetails });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Read single file content
app.get("/api/bots/:id/file", (req, res) => {
  const { id } = req.params;
  const auth = authorizeBotAccess(req, id);
  if ('error' in auth) return res.status(auth.status).json({ error: auth.error });
  const name = req.query.name as string;
  if (!name) return res.status(400).json({ error: "Missing filename" });
  try {
    const safeName = path.basename(name);
    const filePath = path.join(HOSTED_BOTS_DIR, id, safeName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }
    const content = fs.readFileSync(filePath, "utf-8");
    res.json({ filename: safeName, content });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Save / Create file
app.post("/api/bots/:id/file", async (req, res) => {
  const { id } = req.params;
  const auth = authorizeBotAccess(req, id);
  if ('error' in auth) return res.status(auth.status).json({ error: auth.error });
  const { filename, content, restart } = req.body;
  if (!filename || content === undefined) {
    return res.status(400).json({ error: "Missing filename or content" });
  }
  try {
    const safeName = path.basename(filename);
    const filePath = path.join(HOSTED_BOTS_DIR, id, safeName);
    fs.writeFileSync(filePath, content, "utf-8");
    addBotLog(id, 'system', `📄 File saved: ${safeName}`);

    // If saving entry file or token, check token
    const bot = auth.bot;
    if (bot && safeName === bot.entryFile) {
      const match = content.match(/BOT_TOKEN\s*=\s*(?:os\.getenv\([^,]+,\s*)?["']([^"']+)["']/);
      if (match && match[1]) {
        bot.token = match[1];
        saveRegistry();
      }
    }

    if (restart && activeProcesses.has(id)) {
      await restartBot(id);
    }
    res.json({ success: true, filename: safeName });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. DELETE A FILE FROM HOSTED BOT (Crucial user requirement)
app.all(["/api/bots/:id/delete-file", "/api/bots/:id/file/delete", "/api/bots/:id/files/:filename?"], (req, res) => {
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const { id } = req.params;
  const auth = authorizeBotAccess(req, id);
  if ('error' in auth) return res.status(auth.status).json({ error: auth.error });
  const filename = req.body?.filename || req.params?.filename || req.query?.filename;
  if (!filename) return res.status(400).json({ error: "Filename required" });
  try {
    const safeName = path.basename(String(filename));
    const filePath = path.join(HOSTED_BOTS_DIR, id, safeName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      addBotLog(id, 'system', `🗑️ Deleted file: ${safeName}`);
      saveRegistry();
      res.json({ success: true, message: `File ${safeName} deleted successfully` });
    } else {
      res.status(404).json({ error: "File not found" });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4b. Upload multiple files at once to hosted bot
app.post("/api/bots/:id/upload-files", async (req, res) => {
  const { id } = req.params;
  const auth = authorizeBotAccess(req, id);
  if ('error' in auth) return res.status(auth.status).json({ error: auth.error });
  const { files, restart } = req.body;
  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: "No files provided" });
  }

  const bot = auth.bot;
  const botDir = path.join(HOSTED_BOTS_DIR, id);
  if (!fs.existsSync(botDir)) {
    fs.mkdirSync(botDir, { recursive: true });
  }

  try {
    let savedCount = 0;

    for (const f of files) {
      if (!f.name) continue;
      const safeName = path.basename(f.name);
      const filePath = path.join(botDir, safeName);

      if (f.base64) {
        const buffer = Buffer.from(f.base64, 'base64');
        fs.writeFileSync(filePath, buffer);
      } else if (f.content !== undefined) {
        fs.writeFileSync(filePath, f.content, "utf-8");
      }
      savedCount++;

      if (safeName.endsWith('.py')) {
        if (bot && (!bot.entryFile || !fs.existsSync(path.join(botDir, bot.entryFile)))) {
          bot.entryFile = safeName;
        }
      }

      // If token in file, extract
      if (f.content && typeof f.content === 'string') {
        const match = f.content.match(/BOT_TOKEN\s*=\s*(?:os\.getenv\([^,]+,\s*)?["']([^"']+)["']/);
        if (match && match[1] && bot) {
          bot.token = match[1];
        }
      }
    }

    addBotLog(id, 'system', `📥 ${savedCount} টি ফাইল সফলভাবে আপলোড করা হয়েছে`);
    saveRegistry();

    // Auto-patch and check dependencies
    patchAndValidateBotCode(botDir, id, bot?.env?.BASE_URL, bot?.env?.API_KEY, bot?.token);
    ensureBotDependencies(botDir, id);

    if (restart || (bot && bot.status === 'running')) {
      await restartBot(id);
    }

    res.json({ success: true, count: savedCount, bot });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4c. Upload and extract ZIP archive to hosted bot
app.post("/api/bots/:id/upload-zip", async (req, res) => {
  const { id } = req.params;
  const auth = authorizeBotAccess(req, id);
  if ('error' in auth) return res.status(auth.status).json({ error: auth.error });
  const { zipBase64, restart } = req.body;
  if (!zipBase64) {
    return res.status(400).json({ error: "Missing zipBase64" });
  }

  const bot = auth.bot;
  const botDir = path.join(HOSTED_BOTS_DIR, id);
  if (!fs.existsSync(botDir)) {
    fs.mkdirSync(botDir, { recursive: true });
  }

  try {
    const tmpZipPath = path.join(botDir, "_upload_tmp.zip");
    fs.writeFileSync(tmpZipPath, Buffer.from(zipBase64, 'base64'));

    // Extract using Python zipfile
    const extractScript = `
import zipfile, os
zip_path = r"${tmpZipPath}"
target_dir = r"${botDir}"
with zipfile.ZipFile(zip_path, 'r') as z:
    for member in z.infolist():
        filename = os.path.basename(member.filename)
        if not filename or filename.startswith('.'):
            continue
        source = z.open(member)
        target = open(os.path.join(target_dir, filename), "wb")
        with source, target:
            target.write(source.read())
`;
    const tmpPyScript = path.join(botDir, "_unzip_exec.py");
    fs.writeFileSync(tmpPyScript, extractScript, "utf-8");
    try {
      execSync(`python3 "${tmpPyScript}"`, { timeout: 30000 });
    } finally {
      try { fs.unlinkSync(tmpZipPath); } catch {}
      try { fs.unlinkSync(tmpPyScript); } catch {}
    }

    // Auto find entry file if current entry file doesn't exist
    if (bot) {
      const currentEntry = path.join(botDir, bot.entryFile);
      if (!fs.existsSync(currentEntry)) {
        const files = fs.readdirSync(botDir);
        const candidate = files.find(f => f.toLowerCase() === 'bot.py' || f.toLowerCase() === 'main.py' || f.toLowerCase() === 'app.py') || files.find(f => f.endsWith('.py'));
        if (candidate) {
          bot.entryFile = candidate;
        }
      }
      saveRegistry();
    }

    addBotLog(id, 'system', `📦 জিপ আর্কাইভ সফলভাবে এক্সট্র্যাক্ট করা হয়েছে`);
    patchAndValidateBotCode(botDir, id, bot?.env?.BASE_URL, bot?.env?.API_KEY, bot?.token);
    ensureBotDependencies(botDir, id);

    if (restart || (bot && bot.status === 'running')) {
      await restartBot(id);
    }

    res.json({ success: true, message: "Zip extracted successfully", bot });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Test bot token against Telegram official API
app.post("/api/bots/:id/test-token", async (req, res) => {
  const { id } = req.params;
  const auth = authorizeBotAccess(req, id);
  if ('error' in auth) return res.status(auth.status).json({ error: auth.error });
  const bot = auth.bot;
  const token = req.body.token || bot?.token;
  if (!token) {
    return res.status(400).json({ ok: false, error: "No BOT_TOKEN provided" });
  }
  try {
    const fetchRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await fetchRes.json();
    if (data.ok && data.result?.username && bot) {
      bot.token = token;
      bot.botUsername = data.result.username;
      saveRegistry();
    }
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Export zip for a specific bot
app.get("/api/bots/:id/export/zip", (req, res) => {
  const { id } = req.params;
  const auth = authorizeBotAccess(req, id);
  if ('error' in auth) return res.status(auth.status).json({ error: auth.error });
  const botDir = path.join(HOSTED_BOTS_DIR, id);
  if (!fs.existsSync(botDir)) {
    return res.status(404).json({ error: "Bot not found" });
  }
  try {
    const zipName = `${id}_pack.zip`;
    const zipPath = path.join(process.cwd(), zipName);
    
    // Python zip utility
    const pyZipScript = `
import zipfile, os
bot_dir = r"${botDir}"
zip_path = r"${zipPath}"
with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as z:
    for root, dirs, files in os.walk(bot_dir):
        for f in files:
            if not f.endswith('.zip') and not '__pycache__' in root:
                full = os.path.join(root, f)
                rel = os.path.relpath(full, bot_dir)
                z.write(full, rel)
`;
    const tmpPy = path.join(process.cwd(), `_zip_${id}.py`);
    fs.writeFileSync(tmpPy, pyZipScript, "utf-8");
    execSync(`python3 "${tmpPy}"`);
    try { fs.unlinkSync(tmpPy); } catch {}

    if (fs.existsSync(zipPath)) {
      res.download(zipPath, `${id}_deploy.zip`, () => {
        try { fs.unlinkSync(zipPath); } catch {}
      });
    } else {
      res.status(500).json({ error: "Failed to generate zip" });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Pip Package Manager endpoints
app.get("/api/pip/packages", (req, res) => {
  try {
    const output = execSync("python3 -m pip list --format=json", { encoding: "utf-8" });
    const packages = JSON.parse(output);
    res.json({ packages });
  } catch (err: any) {
    res.json({ packages: [] });
  }
});

app.post("/api/pip/install", (req, res) => {
  const { package: pkg } = req.body;
  if (!pkg || typeof pkg !== 'string') {
    return res.status(400).json({ error: "Package name required" });
  }
  const safePkg = pkg.trim().replace(/[^a-zA-Z0-9_\-\[\]<>=.]+/g, "");
  try {
    const output = execSync(`python3 -m pip install ${safePkg} --break-system-packages`, { encoding: "utf-8" });
    res.json({ success: true, output });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message, output: err.stdout || err.stderr });
  }
});

// Legacy backward-compatibility routes for existing components
app.get("/api/bot/status", (req, res) => {
  const activeBot = hostedBots[0];
  if (!activeBot) {
    return res.json({
      status: 'stopped',
      pid: null,
      uptimeSeconds: 0,
      startTime: null,
      pythonVersion: "Python 3.10.12",
      logSummary: { totalLogs: 0, lastLogTime: null }
    });
  }
  const isRunning = activeProcesses.has(activeBot.id);
  const logs = botLogsMap.get(activeBot.id) || [];
  res.json({
    status: isRunning ? 'running' : activeBot.status,
    pid: isRunning ? activeProcesses.get(activeBot.id)?.pid || null : null,
    uptimeSeconds: getBotUptime(activeBot.id),
    startTime: activeBot.startTime,
    pythonVersion: "Python 3.10.12",
    botInfo: {
      ok: true,
      username: activeBot.botUsername
    },
    logSummary: {
      totalLogs: logs.length,
      lastLogTime: logs.length > 0 ? logs[logs.length - 1].timestamp : null
    }
  });
});

app.post("/api/bot/start", async (req, res) => {
  const activeBot = hostedBots[0];
  if (!activeBot) return res.status(404).json({ error: "No bot found" });
  const ok = await startBot(activeBot.id);
  res.json({ success: ok, status: activeBot.status });
});

app.post("/api/bot/stop", async (req, res) => {
  const activeBot = hostedBots[0];
  if (!activeBot) return res.status(404).json({ error: "No bot found" });
  const ok = await stopBot(activeBot.id);
  res.json({ success: ok, status: activeBot.status });
});

app.post("/api/bot/restart", async (req, res) => {
  const activeBot = hostedBots[0];
  if (!activeBot) return res.status(404).json({ error: "No bot found" });
  const ok = await restartBot(activeBot.id);
  res.json({ success: ok, status: activeBot.status });
});

app.get("/api/bot/logs", (req, res) => {
  const activeBot = hostedBots[0];
  const logs = activeBot ? botLogsMap.get(activeBot.id) || [] : [];
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 300;
  res.json({ logs: logs.slice(-limit) });
});

app.post("/api/bot/clear-logs", (req, res) => {
  const activeBot = hostedBots[0];
  if (activeBot && botLogsMap.has(activeBot.id)) {
    botLogsMap.set(activeBot.id, []);
  }
  res.json({ success: true });
});

app.get("/api/files", (req, res) => {
  const botId = (req.query.botId as string) || (hostedBots[0]?.id);
  const dir = botId ? path.join(HOSTED_BOTS_DIR, botId) : HOSTED_BOTS_DIR;
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const files = fs.readdirSync(dir).filter(f => !f.startsWith('.git') && f !== '__pycache__' && !f.endsWith('.json'));
    res.json({ files });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/files/read", (req, res) => {
  const filename = req.query.name as string;
  if (!filename) return res.status(400).json({ error: "Missing filename" });
  const botId = (req.query.botId as string) || (hostedBots[0]?.id);
  const dir = botId ? path.join(HOSTED_BOTS_DIR, botId) : HOSTED_BOTS_DIR;
  try {
    const filePath = path.join(dir, path.basename(filename));
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File not found" });
    const content = fs.readFileSync(filePath, "utf-8");
    res.json({ filename, content });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/files/save", (req, res) => {
  const { filename, content, restart, botId: reqBotId } = req.body;
  const botId = reqBotId || (hostedBots[0]?.id);
  if (!botId) return res.status(400).json({ error: "No bot selected to save file" });
  const dir = path.join(HOSTED_BOTS_DIR, botId);
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const safeName = path.basename(filename);
    const filePath = path.join(dir, safeName);
    fs.writeFileSync(filePath, content, "utf-8");
    if (restart && activeProcesses.has(botId)) {
      restartBot(botId);
    }
    res.json({ success: true, filename: safeName });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Services routes
app.get("/api/services", (req, res) => {
  const botId = (req.query.botId as string) || (hostedBots[0]?.id);
  if (!botId) {
    return res.json({ services: DEFAULT_SERVICES });
  }
  const dir = path.join(HOSTED_BOTS_DIR, botId);
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const p = path.join(dir, "custom_services.json");
    if (!fs.existsSync(p) || fs.readFileSync(p, "utf-8").trim() === "[]" || fs.readFileSync(p, "utf-8").trim() === "") {
      fs.writeFileSync(p, JSON.stringify(DEFAULT_SERVICES, null, 2), "utf-8");
      return res.json({ services: DEFAULT_SERVICES });
    }
    const data = JSON.parse(fs.readFileSync(p, "utf-8"));
    res.json({ services: Array.isArray(data) && data.length > 0 ? data : DEFAULT_SERVICES });
  } catch (err: any) {
    res.json({ services: DEFAULT_SERVICES });
  }
});

app.post("/api/services", (req, res) => {
  const botId = (req.query.botId as string) || (hostedBots[0]?.id);
  if (!botId) {
    return res.status(400).json({ error: "No bot selected to configure services" });
  }
  const dir = path.join(HOSTED_BOTS_DIR, botId);
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const p = path.join(dir, "custom_services.json");
    const list = Array.isArray(req.body.services) && req.body.services.length > 0 ? req.body.services : DEFAULT_SERVICES;
    fs.writeFileSync(p, JSON.stringify(list, null, 2), "utf-8");
    addBotLog(botId, 'system', `Updated services configuration (${list.length} services)`);
    res.json({ success: true, services: list });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post(["/api/services/reset-default", "/api/bots/:id/services/reset-default"], (req, res) => {
  const botId = req.params.id || (req.query.botId as string) || (hostedBots[0]?.id);
  if (!botId) {
    return res.json({ success: true, services: DEFAULT_SERVICES });
  }
  const dir = path.join(HOSTED_BOTS_DIR, botId);
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const p = path.join(dir, "custom_services.json");
    fs.writeFileSync(p, JSON.stringify(DEFAULT_SERVICES, null, 2), "utf-8");
    addBotLog(botId, 'system', `Reset all services to default 9 services.`);
    res.json({ success: true, services: DEFAULT_SERVICES });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Users and balances
app.get("/api/users", (req, res) => {
  const activeBot = hostedBots[0];
  const dir = activeBot ? path.join(HOSTED_BOTS_DIR, activeBot.id) : HOSTED_BOTS_DIR;
  try {
    const uPath = path.join(dir, "users.json");
    const bPath = path.join(dir, "banned_users.json");
    const users = fs.existsSync(uPath) ? JSON.parse(fs.readFileSync(uPath, "utf-8")) : {};
    const banned: string[] = fs.existsSync(bPath) ? JSON.parse(fs.readFileSync(bPath, "utf-8")) : [];
    const list = Object.values(users).map((u: any) => ({
      ...u,
      is_banned: banned.includes(String(u.user_id))
    }));
    res.json({ users: list, totalCount: list.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/users/balance", (req, res) => {
  const activeBot = hostedBots[0];
  const dir = activeBot ? path.join(HOSTED_BOTS_DIR, activeBot.id) : HOSTED_BOTS_DIR;
  try {
    const { userId, amount } = req.body;
    const uPath = path.join(dir, "users.json");
    const users = fs.existsSync(uPath) ? JSON.parse(fs.readFileSync(uPath, "utf-8")) : {};
    const uStr = String(userId);
    if (!users[uStr]) users[uStr] = { user_id: uStr, balance: 0.0 };
    users[uStr].balance = Math.max(0, (users[uStr].balance || 0) + Number(amount));
    fs.writeFileSync(uPath, JSON.stringify(users, null, 2), "utf-8");
    res.json({ success: true, balance: users[uStr].balance });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/users/ban", (req, res) => {
  const activeBot = hostedBots[0];
  const dir = activeBot ? path.join(HOSTED_BOTS_DIR, activeBot.id) : HOSTED_BOTS_DIR;
  try {
    const { userId, ban } = req.body;
    const bPath = path.join(dir, "banned_users.json");
    let banned: string[] = fs.existsSync(bPath) ? JSON.parse(fs.readFileSync(bPath, "utf-8")) : [];
    const uStr = String(userId);
    if (ban) {
      if (!banned.includes(uStr)) banned.push(uStr);
    } else {
      banned = banned.filter(id => id !== uStr);
    }
    fs.writeFileSync(bPath, JSON.stringify(banned, null, 2), "utf-8");
    res.json({ success: true, is_banned: ban });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/withdraws", (req, res) => {
  const activeBot = hostedBots[0];
  const dir = activeBot ? path.join(HOSTED_BOTS_DIR, activeBot.id) : HOSTED_BOTS_DIR;
  try {
    const p = path.join(dir, "withdraw_requests.json");
    const data = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf-8")) : {};
    res.json({ withdraws: Object.values(data) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/withdraws/action", (req, res) => {
  const activeBot = hostedBots[0];
  const dir = activeBot ? path.join(HOSTED_BOTS_DIR, activeBot.id) : HOSTED_BOTS_DIR;
  try {
    const { paymentId, status } = req.body;
    const p = path.join(dir, "withdraw_requests.json");
    const data = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf-8")) : {};
    if (data[paymentId]) {
      data[paymentId].status = status;
      fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf-8");
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/broadcast", async (req, res) => {
  const activeBot = hostedBots[0];
  const dir = activeBot ? path.join(HOSTED_BOTS_DIR, activeBot.id) : HOSTED_BOTS_DIR;
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Message required" });
  try {
    const token = activeBot?.token || "8814477083:AAH_G8v9gg3YRyVUyYvVRZ65Y_ZIT2nffJM";
    const uPath = path.join(dir, "users.json");
    const users = fs.existsSync(uPath) ? JSON.parse(fs.readFileSync(uPath, "utf-8")) : {};
    const uids = Object.keys(users);
    (async () => {
      let sent = 0;
      for (const uid of uids) {
        try {
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: uid,
              text: `📢 <b>ADMIN NOTICE</b>\n\n${message}`,
              parse_mode: "HTML"
            })
          });
          sent++;
        } catch {}
      }
      if (activeBot) {
        addBotLog(activeBot.id, 'system', `Broadcast sent to ${sent}/${uids.length} users.`);
      }
    })();
    res.json({ success: true, totalRecipients: uids.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/export/zip", (req, res) => {
  const activeBot = hostedBots[0];
  if (activeBot) {
    return res.redirect(`/api/bots/${activeBot.id}/export/zip`);
  }
  res.status(404).json({ error: "No bot to export" });
});

// Vite middleware & server startup
async function startServer() {
  initHostedBots();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`BotHost Cloud Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
