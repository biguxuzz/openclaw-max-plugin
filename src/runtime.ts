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
    if (this.running) return;

    if (!this.account.token) {
      throw new Error("MAX account token not configured");
    }

    this.client = await getMaxClient(this.account.token);
    this._running = true;

    // Long polling only works when there are NO active webhook subscriptions.
    // If webhooks exist, MAX sends events there and ignores polling requests.
    try {
      const { subscriptions } = await this.client.getSubscriptions();
      if (subscriptions && subscriptions.length > 0) {
        console.log(`[MAX] Removing ${subscriptions.length} webhook subscription(s) to enable long polling`);
        for (const sub of subscriptions) {
          await this.client.deleteSubscription(sub.url);
        }
      }
    } catch (error) {
      console.error("[MAX] Failed to check/remove webhook subscriptions:", error);
    }

    try {
      const response = await this.client.getUpdates({ limit: 1, timeout: 1 });
      this.marker = response.marker ?? 0;
      console.log(`[MAX] Poll starting from marker: ${this.marker}`);
    } catch (error) {
      console.error("[MAX] Failed to get initial marker:", error);
      this.marker = 0;
    }

    this.pollLoop()
      .then(() => this._doneResolve?.())
      .catch((err) => {
        console.error("[MAX] Poll loop fatal error:", err);
        this._running = false;
        this.onError?.(err);
        this._doneReject?.(err);
      });
  }

  stop(): void {
    this._running = false;
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
    while (this.running) {
      try {
        const response = await this.client.getUpdates({
          limit: 100,
          timeout: 30,
          marker: this.marker,
        });

        const updates: MaxUpdate[] = response.updates || [];
        for (const update of updates) {
          await this.handleUpdate(update);
        }

        if (response.marker != null) {
          this.marker = response.marker;
        }
      } catch (error) {
        console.error("[MAX] Poll error:", error);
        this.onError?.(error as Error);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  private async handleUpdate(update: MaxUpdate): Promise<void> {
    try {
      if (update.update_type !== "message_created" || !update.message) return;

      const message = update.message;
      if (message.sender?.is_bot) return;

      const text = message.body?.text;
      if (!text) return;

      const firstName = message.sender?.first_name || "";
      const lastName = message.sender?.last_name || "";
      const displayName = [firstName, lastName].filter(Boolean).join(" ") || "Unknown";
      const userId = message.sender?.user_id || 0;

      console.log(`[MAX] message from ${displayName} (${userId}): "${text}"`);

      const inboundCtx = {
        channel: "max",
        accountId: this.account.accountId,
        peer: { kind: "direct", id: userId.toString() },
        sender: { id: userId.toString(), name: displayName },
        text,
        timestamp: message.timestamp || Date.now(),
        messageId: message.body?.mid || "unknown",
      };

      if (this.onMessage) {
        await this.onMessage(inboundCtx);
        return;
      }

      const pluginRuntime = getMaxRuntime() as any;
      const channelRouting = pluginRuntime?.channel?.routing;

      const {
        resolveInboundRouteEnvelopeBuilderWithRuntime,
        buildInboundReplyDispatchBase,
        dispatchInboundReplyWithBase,
        recordInboundSessionAndDispatchReply,
      } = await import("openclaw/plugin-sdk") as any;

      const dispatcher = {
        deliver: async (payload: any) => {
          if (payload?.text) await this.sendMessage(userId, payload.text);
        },
        markComplete: () => {},
        waitForIdle: async () => {},
        flush: async () => {},
        abort: () => {},
        reset: () => {},
      };

      // Step 1: resolve the agent route for this message
      let route: any;
      if (typeof channelRouting?.resolveAgentRoute === "function") {
        try {
          route = await channelRouting.resolveAgentRoute({ ctx: inboundCtx, cfg: this.cfg });
          console.log(`[MAX] resolveAgentRoute result: ${JSON.stringify(route)}`);
        } catch (err) {
          console.error(`[MAX] resolveAgentRoute failed:`, err);
        }
      }

      // Step 2: try resolveInboundRouteEnvelopeBuilderWithRuntime
      if (typeof resolveInboundRouteEnvelopeBuilderWithRuntime === "function") {
        try {
          const envelopeBuilder = await resolveInboundRouteEnvelopeBuilderWithRuntime({
            ctx: inboundCtx,
            cfg: this.cfg,
            runtime: pluginRuntime,
            route,
          });
          console.log(`[MAX] envelopeBuilder keys: ${Object.keys(envelopeBuilder ?? {}).join(", ")}`);
          if (typeof envelopeBuilder?.dispatch === "function") {
            await envelopeBuilder.dispatch({ dispatcher });
            return;
          }
          if (typeof dispatchInboundReplyWithBase === "function") {
            await dispatchInboundReplyWithBase({ base: envelopeBuilder, dispatcher });
            return;
          }
        } catch (err) {
          console.error(`[MAX] resolveInboundRouteEnvelopeBuilderWithRuntime failed:`, err);
        }
      }

      // Step 3: try buildInboundReplyDispatchBase with route
      if (typeof buildInboundReplyDispatchBase === "function" && typeof dispatchInboundReplyWithBase === "function") {
        try {
          const base = await buildInboundReplyDispatchBase({ ctx: inboundCtx, cfg: this.cfg, runtime: pluginRuntime, route });
          await dispatchInboundReplyWithBase({ base, dispatcher });
          return;
        } catch (err) {
          console.error(`[MAX] buildInboundReplyDispatchBase failed:`, err);
        }
      }

      // Step 4: try recordInboundSessionAndDispatchReply with route
      if (typeof recordInboundSessionAndDispatchReply === "function") {
        try {
          await recordInboundSessionAndDispatchReply({ ctx: inboundCtx, cfg: this.cfg, runtime: pluginRuntime, dispatcher, route });
          return;
        } catch (err) {
          console.error(`[MAX] recordInboundSessionAndDispatchReply failed:`, err);
        }
      }

      console.warn(`[MAX] No dispatch mechanism available — message lost: "${text}"`);
    } catch (error) {
      console.error(`[MAX] handleUpdate error:`, error);
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
