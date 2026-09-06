import asyncio
import io
import re
import json
import html
import os
import httpx
import pyotp
import random
import string
from datetime import datetime, timedelta
from telegram import Update, ReplyKeyboardMarkup, KeyboardButton, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, ContextTypes, filters, CallbackQueryHandler

# ==================== CONFIG SECTION ====================
BOT_TOKEN = os.getenv("BOT_TOKEN", "8814477083:AAH_G8v9gg3YRyVUyYvVRZ65Y_ZIT2nffJM")
API_KEY = os.getenv("API_KEY", "mino_live_bfde1ae6289d122dfae7e3f6ff10a9c8")
BASE_URL = os.getenv("BASE_URL", "https://minosms.com").rstrip("/")
if "mino-sms-panel.xyz" in BASE_URL:
    BASE_URL = "https://minosms.com"

USER_DATA_FILE = "users.json"
PAID_SMS_FILE = "paid_sms.json"
STATS_FILE = "user_stats.json"
REFERRAL_DATA_FILE = "referral_data.json"
BANNED_USERS_FILE = "banned_users.json"
WITHDRAW_DATA_FILE = "withdraw_requests.json"
ACTIVITY_LOGS_FILE = "activity_logs.json"
DATA_RANGE_FILE = "datarange.json"
CUSTOM_SERVICES_FILE = "custom_services.json"

ADMINS = [6130692829]
OTP_GROUP_ID = -1003989722688

WELCOME_MESSAGE = """👋 <b>স্বাগতম Mino SMS Bot এ!</b>

⚡ <b>লাইভ সার্ভিসসমূহ:</b>
• ইনস্ট্যান্ট নাম্বার নেওয়া
• লাইভ ওটিপি রিসিভ
• রেফার ও আর্ন সিস্টেম
• ২৪/৭ লাইভ ক্লাউড সার্ভিস

নিচের বাটনগুলো ব্যবহার করে কাজ শুরু করুন:"""

OTP_RATE = 0.00
REFERRAL_PRICE = 0
MIN_WITHDRAW = 50
MAX_WITHDRAW = 10000
SUPPORT_LINK = "https://t.me/MinoXSupport0"

request_queue = asyncio.Queue()
active_numbers = {}
last_range = {}
CHECK_INTERVAL = 0.5

client_async = httpx.AsyncClient(
    http2=False,
    timeout=httpx.Timeout(connect=5.0, read=30.0, write=5.0, pool=15.0),
    headers={
        "X-API-Key": API_KEY,
        "api-key": API_KEY,
        "Authorization": f"Bearer {API_KEY}",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) MinoBot/1.0",
        "Accept": "application/json, text/plain, */*"
    }
)

def get_bangladesh_time():
    return datetime.utcnow() + timedelta(hours=6)

def normalize_number(number):
    if not number:
        return ""
    return re.sub(r'\D', '', str(number))

def mask_number(number):
    num_str = str(number)
    if len(num_str) <= 6:
        return num_str
    return num_str[:4] + "****" + num_str[-2:]

def format_balance(balance):
    try:
        return f"{float(balance):.2f}"
    except:
        return "0.00"

def is_admin(user_id):
    return user_id in ADMINS

def load_data(filename=USER_DATA_FILE):
    if not os.path.exists(filename):
        with open(filename, "w", encoding="utf-8") as f:
            json.dump({}, f)
        return {}
    try:
        with open(filename, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return {}

def save_data(data, filename=USER_DATA_FILE):
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4)

def load_custom_services():
    if not os.path.exists(CUSTOM_SERVICES_FILE):
        return []
    try:
        with open(CUSTOM_SERVICES_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return []

def main_keyboard(user_id):
    keyboard = [
        [KeyboardButton(text="📱 GET NUMBER")],
        [
            KeyboardButton(text="🎁 REFER AND EARN"),
            KeyboardButton(text="👤 PROFILE")
        ],
        [KeyboardButton(text="🏆 LEADERBOARD")],
        [KeyboardButton(text="💬 SUPPORT")]
    ]
    if is_admin(user_id):
        keyboard.append([KeyboardButton(text="⚙️ ADMIN PANEL ⚙️")])
    return ReplyKeyboardMarkup(keyboard, resize_keyboard=True)

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    uid = update.effective_user.id
    users = load_data(USER_DATA_FILE)
    if str(uid) not in users:
        users[str(uid)] = {
            "user_id": str(uid),
            "username": update.effective_user.username or "",
            "full_name": update.effective_user.full_name or "",
            "balance": 0.0,
            "created_at": datetime.utcnow().isoformat()
        }
        save_data(users, USER_DATA_FILE)
    await update.message.reply_text(WELCOME_MESSAGE, parse_mode="HTML", reply_markup=main_keyboard(uid))

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message or not update.message.text:
        return
    uid = update.effective_user.id
    raw = update.message.text.strip().upper()
    if "GET NUMBER" in raw:
        services = load_custom_services()
        buttons = []
        for i, s in enumerate(services):
            buttons.append([InlineKeyboardButton(f"🌐 {s.get('sid', 'Service')}", callback_data=f"svc_{i}")])
        await update.message.reply_text(
            "📱 <b>GET NUMBER</b>\n\nএকটি সার্ভিস নির্বাচন করুন:",
            parse_mode="HTML",
            reply_markup=InlineKeyboardMarkup(buttons)
        )
    elif "PROFILE" in raw:
        users = load_data(USER_DATA_FILE)
        u = users.get(str(uid), {"balance": 0.0})
        await update.message.reply_text(
            f"👤 <b>PROFILE</b>\n🆔 ID: <code>{uid}</code>\n💰 Balance: <code>{u.get('balance', 0):.2f} BDT</code>",
            parse_mode="HTML"
        )
    elif "SUPPORT" in raw:
        await update.message.reply_text(
            f"💬 <b>সাপোর্ট ও যোগাযোগ:</b>\n{SUPPORT_LINK}",
            parse_mode="HTML"
        )
    else:
        await update.message.reply_text("দয়া করে নিচের মেনু বাটন ব্যবহার করুন:", reply_markup=main_keyboard(uid))

async def button_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    data = query.data
    if data.startswith("svc_"):
        idx = int(data.split("_")[1])
        services = load_custom_services()
        if idx < len(services):
            svc = services[idx]
            ranges = svc.get("ranges", [])
            btns = []
            for r in ranges:
                btns.append([InlineKeyboardButton(f"{r.get('country', '')} - {r.get('range', '')}", callback_data="num_req")])
            await query.message.edit_text(f"Selected: <b>{svc.get('sid')}</b>", parse_mode="HTML", reply_markup=InlineKeyboardMarkup(btns))
    elif data == "num_req":
        await query.message.edit_text("⏳ Requesting number from SMS Panel...", parse_mode="HTML")

async def monitor_loop(app):
    print("🚀 SMS Monitor loop started...")
    while True:
        try:
            await asyncio.sleep(5)
        except asyncio.CancelledError:
            break
        except Exception:
            await asyncio.sleep(5)

async def post_init(application):
    asyncio.create_task(monitor_loop(application))

def main():
    print(f"🤖 Initializing Telegram Bot with token: {BOT_TOKEN[:10]}...")
    try:
        app = ApplicationBuilder().token(BOT_TOKEN).post_init(post_init).build()
        app.add_handler(CommandHandler("start", start_command))
        app.add_handler(CallbackQueryHandler(button_callback))
        app.add_handler(MessageHandler(filters.TEXT & (~filters.COMMAND), handle_message))
        print("✅ Telegram Bot polling loop started successfully!")
        app.run_polling(allowed_updates=Update.ALL_TYPES, drop_pending_updates=True)
    except Exception as e:
        print(f"❌ Failed to start bot: {e}")

if __name__ == "__main__":
    main()
