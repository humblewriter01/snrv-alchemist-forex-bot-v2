export async function sendTelegramSignal(message: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) return { delivered: false, reason: "Telegram server credentials are not configured." } as const;
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return { delivered: false, reason: `Telegram delivery failed with HTTP ${response.status}.` } as const;
    return { delivered: true, reason: null } as const;
  } catch {
    return { delivered: false, reason: "Telegram is temporarily unreachable." } as const;
  }
}

export async function configureTelegramCommandWebhook(webhookUrl: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!token || !secret) throw new Error("Telegram bot token or webhook secret is not configured on the server.");
  const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: webhookUrl, secret_token: secret, allowed_updates: ["message"], drop_pending_updates: false }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Telegram webhook configuration failed with HTTP ${response.status}.`);
  const payload = await response.json() as { ok?: boolean; description?: string };
  if (!payload.ok) throw new Error(payload.description ?? "Telegram rejected the webhook configuration.");
  return { connected: true as const, webhookUrl };
}
