import { createPluginRuntimeStore } from "openclaw/plugin-sdk/compat";
import type { PluginRuntime } from "openclaw/plugin-sdk";

/**
 * MAX Messenger Runtime - Message Handler and Long Polling
 */

import type { ResolvedMaxAccount, MaxUpdate } from "./types.js";

// ============================================
// Types
// ============================================

export interface MaxRuntimeConfig {
  account: ResolvedMaxAccount;
  runtime?: any;  // Gateway runtime with onMessage, onError
}

export interface MaxMessageContext {
  messageId: string;
  userId: number;
  userName: string;
  text: string;
  timestamp: number;
  accountId: string;
}

// ============================================
// Runtime API (using plugin runtime store like Telegram)
// ============================================

const { setRuntime: setMaxRuntime, getRuntime: getMaxRuntime } =
  createPluginRuntimeStore<PluginRuntime>("MAX runtime not initialized");
export { getMaxRuntime, setMaxRuntime };

// ============================================
// MAX Client (imported dynamically)
// ============================================

async function getMaxClient(token: string) {
  const { MaxApiClient } = await import("./api.js");
  return new MaxApiClient({ token });
}

// ============================================
// Runtime Implementation
// ============================================

class MaxRuntimeImpl {
  private client: any;
  private account: ResolvedMaxAccount;
  private runtime?: any;  // Gateway runtime with onMessage, onError
  private marker?: number;
  private _running: boolean = false;

  // Expose running state for health checks
  public get running(): boolean {
    return this._running;
  }

  constructor(config: MaxRuntimeConfig) {
    this.account = config.account;
    this.runtime = config.runtime;
  }

  async start(): Promise<void> {
    console.log(`[MAX] start() called for account ${this.account.accountId}`);
    
    if (this.running) {
      console.log(`[MAX] Already running, skipping start()`);
      return;
    }

    if (!this.account.token) {
      const error = "MAX account token not configured";
      console.error(`[MAX] ${error}`);
      throw new Error(error);
    }

    console.log(`[MAX] Creating MAX client...`);
    try {
      this.client = await getMaxClient(this.account.token);
      console.log(`[MAX] MAX client created successfully`);
    } catch (err) {
      console.error(`[MAX] Failed to create MAX client:`, err);
      throw err;
    }
    
    this._running = true;

    console.log(`[MAX] Starting runtime for account ${this.account.accountId}`);

    // Get initial marker - start from 0 to get all recent messages
    try {
      console.log(`[MAX] Getting initial marker...`);
      const response = await this.client.getUpdates({ limit: 1, timeout: 1 });
      // Don't use response.marker, start fresh
      this.marker = 0;
      console.log(`[MAX] Starting from marker: 0`);
    } catch (error) {
      console.error("[MAX] Failed to get initial marker:", error);
      this.marker = 0;
    }

    // Start polling (fire-and-forget is OK for polling loop)
    console.log(`[MAX] Starting poll loop...`);
    this.pollLoop().catch((err) => {
      console.error("[MAX] Poll loop error:", err);
      this._running = false;
      if (this.onError) {
        this.onError(err);
      }
    });
    
    console.log(`[MAX] Starting poll loop...`);

    // Start polling in background
    this.pollLoop().catch((err) => {
      console.error("[MAX] Poll loop error:", err);
      this._running = false;
      if (this.runtime?.onError) {
        this.runtime.onError(err);
      }
    });

    console.log(`[MAX] start() completed successfully`);
  }

  stop(): void {
    this._running = false;
    console.log(`[MAX] Stopped runtime`);
  }

  async sendMessage(userId: number, text: string): Promise<void> {
    if (!this.client) {
      throw new Error("MAX client not initialized");
    }

    await this.client.sendMessage({
      user_id: userId,
      text: text,
    });
  }

  private async pollLoop(): Promise<void> {
    console.log(`[MAX] pollLoop() started`);
    while (this.running) {
      try {
        console.log(`[MAX] Polling for updates... (marker: ${this.marker})`);
        const response = await this.client.getUpdates({
          limit: 100,
          timeout: 30,
          marker: this.marker,
        });

        const updates = response.updates || [];
        console.log(`[MAX] Received ${updates.length} updates`);

        if (updates.length > 0) {
          console.log(`[MAX] Processing ${updates.length} updates...`);
          for (const update of updates) {
            console.log(`[MAX] Update marker: ${update.marker}, response marker: ${response.marker}`);
            await this.handleUpdate(update);
          }
        }

        // Always update marker from response
        if (response.marker) {
          this.marker = response.marker;
          console.log(`[MAX] Updated marker to: ${this.marker}`);
        }
      } catch (error) {
        console.error("[MAX] Poll error:", error);
        if (this.onError) {
          this.onError(error as Error);
        }
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    console.log(`[MAX] pollLoop() exited (running=${this.running})`);
  }

  private async handleUpdate(update: MaxUpdate): Promise<void> {
    console.log(`[MAX] handleUpdate() called: ${JSON.stringify(update.update_type)}`);
    
    try {
      if (update.update_type !== "message_created" || !update.message) {
        console.log(`[MAX] Skipping update: not message_created or no message`);
        return;
      }

      const message = update.message;

      // Skip bot messages
      if (message.sender?.is_bot) {
        console.log(`[MAX] Skipping bot message`);
        return;
      }

      const text = message.body?.text;
      if (!text) {
        console.log(`[MAX] Skipping message: no text`);
        return;
      }

      console.log(`[MAX] Processing message from ${message.sender?.name}: "${text}"`);

      const ctx: MaxMessageContext = {
        messageId: message.body?.mid || "unknown",
        userId: message.sender?.user_id || 0,
        userName: message.sender?.name || "Unknown",
        text: text,
        timestamp: message.timestamp || Date.now(),
        accountId: this.account.accountId,
      };

      console.log(`[MAX] Trying dispatchReplyFromConfig approach...`);

      // Try dispatchReplyFromConfig instead
      const inboundCtx = {
        channel: "max",
        accountId: this.account.accountId,
        peer: {
          kind: "direct",
          id: ctx.userId.toString(),
        },
        sender: {
          id: ctx.userId.toString(),
          name: ctx.userName,
        },
        text: ctx.text,
        timestamp: ctx.timestamp,
        messageId: ctx.messageId,
      };

      console.log(`[MAX] inboundCtx:`, JSON.stringify(inboundCtx, null, 2));

      // Simple dispatcher
      const dispatcher = {
        deliver: async (payload) => {
          console.log(`[MAX] AI Reply:`, payload.text);
          if (payload.text) {
            await this.sendMessage(ctx.userId, payload.text);
          }
        },
      };

      // Try to call dispatchReplyFromConfig directly
      try {
        const { dispatchReplyFromConfig } = await import("openclaw/plugin-sdk");
        await dispatchReplyFromConfig({
          ctx: inboundCtx,
          cfg: {},
          dispatcher,
        });
        console.log(`[MAX] dispatchReplyFromConfig completed`);
      } catch (err) {
        console.error(`[MAX] dispatchReplyFromConfig failed:`, err);
        // Fallback: just log that we received the message
        console.log(`[MAX] Message received but cannot dispatch to AI: ${ctx.text}`);
      }
    } catch (error) {
      console.error(`[MAX] handleUpdate() error:`, error);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================
// Exports
// ============================================

export { MaxRuntimeImpl };
