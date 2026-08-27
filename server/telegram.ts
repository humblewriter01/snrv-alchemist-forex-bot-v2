type TelegramApiPayload = {
  ok?: boolean;
  description?: string;
  result?: { username?: string; first_name?: string; url?: string; pending_update_count?: number; last_error_message?: string };
};

type TelegramMessageOptions = {
  chatId?: number | string;
  replyMarkup?: unknown;
};

function token() {
  return process.env.TELEGRAM_BOT_TOKEN;
}

function safeDescription(value: unknown) {
  return typeof value === "string"
    ? value.replace(/https?:\/\/\S+/gi, "[URL]").replace(/bot\d+:[A-Za-z0-9_-]+/g, "[token]").slice(0, 240)
    : "";
}

async function callTelegram(method: string, body: Record<string, unknown>) {
  const botToken = token();
  if (!botToken) throw new Error("Telegram bot token is not configured on the server.");
  let response: Response;
  try {
    response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new Error("Telegram is temporarily unreachable. Please try again.");
  }
  const payload = await response.json().catch(() => null) as TelegramApiPayload | null;
  if (!response.ok || !payload?.ok) {
    const reason = safeDescription(payload?.description);
    throw new Error(`Telegram ${method} failed${reason ? `: ${reason}` : ` with HTTP ${response.status}`}`);
  }
  return payload;
}

export async function sendTelegramMessage(message: string, options: TelegramMessageOptions = {}) {
  const chatId = options.chatId ?? process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token() || !chatId) return { delivered: false, reason: "Telegram server credentials are not configured." } as const;
  try {
    await callTelegram("sendMessage", {
      chat_id: chatId,
      text: message.slice(0, 3900),
      disable_web_page_preview: true,
      ...(options.replyMarkup ? { reply_markup: options.replyMarkup } : {}),
    });
    return { delivered: true, reason: null } as const;
  } catch (error) {
    return { delivered: false, reason: error instanceof Error ? error.message : "Telegram delivery failed." } as const;
  }
}

export async function sendTelegramSignal(message: string, options: TelegramMessageOptions = {}) {
  return sendTelegramMessage(message, options);
}

export async function answerTelegramCallback(callbackQueryId: string) {
  try {
    await callTelegram("answerCallbackQuery", { callback_query_id: callbackQueryId });
    return true;
  } catch {
    return false;
  }
}

export async function getTelegramHealth() {
  if (!token()) return { configured: false, bot: null, webhook: null } as const;
  try {
    const [me, webhook] = await Promise.all([callTelegram("getMe", {}), callTelegram("getWebhookInfo", {})]);
    return {
      configured: true,
      bot: me.result ? { username: me.result.username ?? null, firstName: me.result.first_name ?? null } : null,
      webhook: webhook.result ? { pendingUpdates: webhook.result.pending_update_count ?? 0, lastError: safeDescription(webhook.result.last_error_message) || null } : null,
    } as const;
  } catch {
    return { configured: true, bot: null, webhook: null } as const;
  }
}

export async function configureTelegramCommandWebhook(webhookUrl: string) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!token() || !secret) throw new Error("Telegram bot token or webhook secret is not configured on the server.");
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(secret)) throw new Error("Telegram webhook secret must contain only letters, numbers, underscores, or hyphens and be 1–256 characters long.");
  if (!webhookUrl.startsWith("https://")) throw new Error("Telegram requires a public HTTPS webhook URL.");

  await callTelegram("setWebhook", {
    url: webhookUrl,
    secret_token: secret,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: false,
  });
  await callTelegram("setMyCommands", {
    commands: [
      { command: "start", description: "Open the SNRV Alchemist menu" },
      { command: "help", description: "Show available signal commands" },
      { command: "status", description: "Show service and webhook status" },
      { command: "watchlist", description: "Show the configured market universe" },
      { command: "scan", description: "Analyze SYMBOL TIMEFRAME" },
      { command: "signal", description: "Show the latest stored signal" },
      { command: "history", description: "Show recent signal history" },
      { command: "performance", description: "Show signal statistics" },
      { command: "risk", description: "Explain analytical risk references" },
      { command: "settings", description: "Show safe analysis settings" },
      { command: "cancel", description: "Cancel a pending command" },
    ],
  });
  return { connected: true as const, webhookUrl };
}

export async function disconnectTelegramWebhook() {
  if (!token()) return { disconnected: false, reason: "Telegram bot token is not configured." } as const;
  try {
    await callTelegram("deleteWebhook", { drop_pending_updates: false });
    return { disconnected: true as const, reason: null };
  } catch (error) {
    return { disconnected: false, reason: error instanceof Error ? error.message : "Telegram disconnect failed." } as const;
  }
}
