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
  runtime?: any;
  cfg?: any;
  onMessage?: (ctx: any) => Promise<void>;
  onError?: (err: Error) => void;
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
  private runtime?: any;
  private cfg?: any;
  private onMessage?: (ctx: any) => Promise<void>;
  private onError?: (err: Error) => void;
  private marker?: number;
  private _running: boolean = false;

  private _doneResolve?: () => void;
  private _doneReject?: (err: Error) => void;

  /** Resolves when the poll loop exits cleanly, rejects on fatal error. */
  public readonly done: Promise<void>;

  public get running(): boolean {
    return this._running;
  }

  constructor(config: MaxRuntimeConfig) {
    this.account = config.account;
    this.runtime = config.runtime;
    this.cfg = config.cfg;
    this.onMessage = config.onMessage;
    this.onError = config.onError;
    this.done = new Promise<void>((resolve, reject) => {
      this._doneResolve = resolve;
      this._doneReject = reject;
    });
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

    // Long polling only works when there are NO active webhook subscriptions.
    // If webhooks exist, MAX sends events there and ignores polling requests.
    try {
      console.log(`[MAX] Checking webhook subscriptions...`);
      const { subscriptions } = await this.client.getSubscriptions();
      if (subscriptions && subscriptions.length > 0) {
        console.log(`[MAX] Found ${subscriptions.length} webhook subscription(s) — deleting to enable long polling:`);
        for (const sub of subscriptions) {
          console.log(`[MAX]   DELETE webhook: ${sub.url}`);
          const result = await this.client.deleteSubscription(sub.url);
          console.log(`[MAX]   Result: ${JSON.stringify(result)}`);
        }
      } else {
        console.log(`[MAX] No webhook subscriptions found, long polling is available`);
      }
    } catch (error) {
      console.error("[MAX] Failed to check/remove webhook subscriptions:", error);
    }

    try {
      console.log(`[MAX] Getting initial marker...`);
      const response = await this.client.getUpdates({ limit: 1, timeout: 1 });
      this.marker = response.marker ?? 0;
      console.log(`[MAX] Starting from marker: ${this.marker}`);
    } catch (error) {
      console.error("[MAX] Failed to get initial marker:", error);
      this.marker = 0;
    }

    console.log(`[MAX] Starting poll loop...`);
    this.pollLoop()
      .then(() => {
        this._doneResolve?.();
      })
      .catch((err) => {
        console.error("[MAX] Poll loop error:", err);
        this._running = false;
        this.onError?.(err);
        this._doneReject?.(err);
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
        const pollParams = { limit: 100, timeout: 30, marker: this.marker };
        console.log(`[MAX] Polling for updates... params=${JSON.stringify(pollParams)}`);
        const response = await this.client.getUpdates(pollParams);

        const responseKeys = Object.keys(response);
        const updates = response.updates || [];
        console.log(`[MAX] Response keys: [${responseKeys.join(", ")}], updates: ${updates.length}, marker: ${response.marker}`);

        if (updates.length > 0) {
          console.log(`[MAX] Raw updates:`, JSON.stringify(updates, null, 2));
          for (const update of updates) {
            await this.handleUpdate(update);
          }
        }

        if (response.marker != null) {
          this.marker = response.marker;
          console.log(`[MAX] Updated marker to: ${this.marker}`);
        }
      } catch (error) {
        console.error("[MAX] Poll error:", error);
        this.onError?.(error as Error);
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

      const firstName = message.sender?.first_name || "";
      const lastName = message.sender?.last_name || "";
      const displayName = [firstName, lastName].filter(Boolean).join(" ") || "Unknown";

      console.log(`[MAX] Processing message from ${displayName}: "${text}"`);

      const ctx: MaxMessageContext = {
        messageId: message.body?.mid || "unknown",
        userId: message.sender?.user_id || 0,
        userName: displayName,
        text: text,
        timestamp: message.timestamp || Date.now(),
        accountId: this.account.accountId,
      };

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

      const dispatcher = {
        deliver: async (payload: any) => {
          console.log(`[MAX] AI reply:`, payload?.text);
          if (payload?.text) {
            await this.sendMessage(ctx.userId, payload.text);
          }
        },
      };

      if (this.onMessage) {
        try {
          await this.onMessage(inboundCtx);
          console.log(`[MAX] onMessage dispatched successfully`);
        } catch (err) {
          console.error(`[MAX] onMessage dispatch failed:`, err);
        }
      } else {
        // Discover available dispatch mechanisms
        try {
          const sdk = await import("openclaw/plugin-sdk");
          console.log(`[MAX] openclaw/plugin-sdk exports: ${Object.keys(sdk).join(", ")}`);
        } catch (err) {
          console.error(`[MAX] Cannot import openclaw/plugin-sdk:`, err);
        }

        try {
          const pluginRuntime = getMaxRuntime();
          console.log(`[MAX] getMaxRuntime() keys: ${Object.keys(pluginRuntime as any).join(", ")}`);
        } catch (err) {
          console.error(`[MAX] getMaxRuntime() failed:`, err);
        }

        console.warn(`[MAX] No delivery mechanism found — message lost: ${ctx.text}`);
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
