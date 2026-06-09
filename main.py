import os
from dotenv import load_dotenv
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes

load_dotenv()

TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN")

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("🤖 SNRV Alchemist Forex Bot is Live!\n\nSend TradingView charts or use /analyze PAIR")

async def analyze(update: Update, context: ContextTypes.DEFAULT_TYPE):
    pair = context.args[0].upper() if context.args else "EURUSD"
    await update.message.reply_text(f"🔍 SNRV Analysis for {pair} (High RR setups only)...")

async def handle_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("📊 Analyzing chart for SNRV zones, Void, Null areas & high probability setups...")

def main():
    app = Application.builder().token(TELEGRAM_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("analyze", analyze))
    app.add_handler(MessageHandler(filters.PHOTO, handle_photo))
    print("Bot started...")
    app.run_polling()

if __name__ == "__main__":
    main()