/**
 * MAX Messenger Webhook Handler
 */

import type { MaxUpdate } from "./types.js";
import type { MaxMessageContext } from "./runtime.js";

export interface MaxWebhookConfig {
  account: any;
  runtime?: any;
}

export function createMaxWebhookHandler(config: MaxWebhookConfig) {
  const { account, runtime } = config;

  return async (req: any, res: any) => {
    console.log(`[MAX] Webhook received:`, req.body?.update_type);

    // Validate webhook secret when configured
    const secret = account.webhookSecret;
    if (secret) {
      const incoming = req.headers?.["x-max-bot-api-secret"];
      if (incoming !== secret) {
        console.warn(`[MAX] Webhook secret mismatch — request rejected`);
        res.status(401).json({ error: "Invalid secret" });
        return;
      }
    }

    try {
      const update = req.body as MaxUpdate;

      // Only handle message_created
      if (update.update_type !== "message_created" || !update.message) {
        console.log(`[MAX] Skipping update: not message_created`);
        res.status(200).send("OK");
        return;
      }

      const message = update.message;

      // Skip bot messages
      if (message.sender?.is_bot) {
        console.log(`[MAX] Skipping bot message`);
        res.status(200).send("OK");
        return;
      }

      const text = message.body?.text;
      if (!text) {
        console.log(`[MAX] Skipping message: no text`);
        res.status(200).send("OK");
        return;
      }

      const senderName = [message.sender?.first_name, message.sender?.last_name].filter(Boolean).join(" ") || "Unknown";
      console.log(`[MAX] Processing webhook message from ${senderName}: "${text}"`);

      // Create message context
      const ctx: MaxMessageContext = {
        messageId: message.body?.mid || "unknown",
        userId: message.sender?.user_id || 0,
        userName: senderName,
        text: text,
        timestamp: message.timestamp || Date.now(),
        accountId: account.accountId,
      };

      // Deliver to AI (simplified approach)
      console.log(`[MAX] Message received via webhook: ${text}`);
      console.log(`[MAX] Context:`, JSON.stringify(ctx, null, 2));

      // For now, just acknowledge receipt
      // TODO: Deliver to AI assistant
      res.status(200).json({ 
        status: "received",
        messageId: ctx.messageId 
      });

    } catch (error) {
      console.error(`[MAX] Webhook error:`, error);
      res.status(500).json({ error: "Internal server error" });
    }
  };
}
