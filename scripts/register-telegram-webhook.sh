#!/usr/bin/env bash
# Register your Telegram bot webhook with the live deployment (Part 4 · Step 3 /
# Part 7 · Step 4). Run after deploying to Vercel.
#
#   APP_URL=https://your-app.vercel.app \
#   TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... \
#   ./scripts/register-telegram-webhook.sh
set -euo pipefail

: "${APP_URL:?set APP_URL to your deployed base url}"
: "${TELEGRAM_BOT_TOKEN:?set TELEGRAM_BOT_TOKEN}"
: "${TELEGRAM_WEBHOOK_SECRET:?set TELEGRAM_WEBHOOK_SECRET}"

curl -fsS \
  -F "url=${APP_URL%/}/api/telegram/webhook" \
  -F "secret_token=${TELEGRAM_WEBHOOK_SECRET}" \
  -F "allowed_updates=[\"message\",\"callback_query\"]" \
  "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook"

echo
echo "Webhook set. Verify with:"
echo "  curl https://api.telegram.org/bot\$TELEGRAM_BOT_TOKEN/getWebhookInfo"
