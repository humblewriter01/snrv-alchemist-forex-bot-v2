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
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(secret)) throw new Error("Telegram webhook secret must contain only letters, numbers, underscores, or hyphens and be 1–256 characters long.");
  if (!webhookUrl.startsWith("https://")) throw new Error("Telegram requires a public HTTPS webhook URL.");
  let response: Response;
  try {
    response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: webhookUrl, secret_token: secret, allowed_updates: ["message"], drop_pending_updates: false }),
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new Error("Telegram is temporarily unreachable. Please try connecting commands again.");
  }
  const payload = await response.json().catch(() => null) as { ok?: boolean; description?: string } | null;
  const description = payload?.description?.replace(/https?:\/\/\S+/g, "[URL]").replace(/bot\d+:[A-Za-z0-9_-]+/g, "[token]");
  if (!response.ok || !payload?.ok) throw new Error(`Telegram rejected the webhook${description ? `: ${description}` : ` (HTTP ${response.status})`}`);
  return { connected: true as const, webhookUrl };
}
