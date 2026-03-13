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
  channelRuntime?: any;
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
  private channelRuntime?: any;
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
    this.channelRuntime = config.channelRuntime;
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

      // channelRuntime is PluginRuntime["channel"] — provided via ctx.channelRuntime in startAccount
      const channelRuntime = this.channelRuntime ?? (getMaxRuntime() as any)?.channel;

      // Resolve agent route (sessionKey, agentId, accountId, etc.)
      let route: any;
      if (typeof channelRuntime?.routing?.resolveAgentRoute === "function") {
        route = await channelRuntime.routing.resolveAgentRoute({ ctx: inboundCtx, cfg: this.cfg });
      }

      // resolveStorePath is available directly on channelRuntime.session
      const storePath: string = typeof channelRuntime?.session?.resolveStorePath === "function"
        ? (channelRuntime.session.resolveStorePath((this.cfg as any)?.session?.store, { agentId: route?.agentId ?? "main" }) ?? "")
        : "";

      const maxTo = `max:${userId}`;

      // Build FinalizedMsgContext — use finalizeInboundContext from channelRuntime.reply if available
      const rawCtxFields = {
        Body: text,
        BodyForAgent: text,
        RawBody: text,
        CommandBody: text,
        BodyForCommands: text,
        From: maxTo,
        To: maxTo,
        SessionKey: route?.sessionKey,
        AccountId: route?.accountId ?? this.account.accountId,
        ChatType: "direct",
        ConversationLabel: displayName,
        SenderName: displayName,
        SenderId: userId.toString(),
        Provider: "max",
        Surface: "max",
        MessageSid: message.body?.mid || undefined,
        Timestamp: message.timestamp || Date.now(),
        CommandAuthorized: false as const,
        // Force reply routing back via MAX instead of session lastChannel
        OriginatingChannel: "max",
        OriginatingTo: maxTo,
        ExplicitDeliverRoute: true,
      };

      const ctxPayload = typeof channelRuntime?.reply?.finalizeInboundContext === "function"
        ? channelRuntime.reply.finalizeInboundContext(rawCtxFields)
        : rawCtxFields;

      // Record inbound session — updates lastChannel to "max" so AI tools route correctly
      if (storePath && typeof channelRuntime?.session?.recordInboundSession === "function" && route) {
        await channelRuntime.session.recordInboundSession({
          storePath,
          sessionKey: ctxPayload.SessionKey ?? route.sessionKey,
          ctx: ctxPayload,
          updateLastRoute: {
            sessionKey: route.mainSessionKey ?? route.sessionKey,
            channel: "max",
            to: maxTo,
            accountId: this.account.accountId,
          },
          onRecordError: (err: unknown) => {
            console.error("[MAX] recordInboundSession error:", err);
          },
        });
      }

      if (typeof channelRuntime?.reply?.dispatchReplyWithBufferedBlockDispatcher === "function") {
        const { createTypingCallbacks } = await import("openclaw/plugin-sdk") as any;

        const deliver = async (payload: any) => {
          const replyText = payload?.text ?? payload?.body ?? "";
          if (replyText) await this.sendMessage(userId, replyText);
        };

        const onError = (err: Error, info: any) => {
          console.error(`[MAX] reply dispatch error (${info?.kind ?? "unknown"}):`, err);
        };

        // Typing indicator: send "typing_on" while AI is processing
        let dispatcherOptions: any = { deliver, onError };

        if (typeof createTypingCallbacks === "function") {
          const typingCallbacks = createTypingCallbacks({
            start: async () => {
              try {
                await this.client.sendAction(userId, "typing_on");
              } catch {
                // non-fatal
              }
            },
            onStartError: () => {},
          });

          const { createReplyDispatcherWithTyping } = channelRuntime.reply;
          if (typeof createReplyDispatcherWithTyping === "function") {
            const humanDelay = typeof channelRuntime.reply.resolveHumanDelayConfig === "function"
              ? channelRuntime.reply.resolveHumanDelayConfig(this.cfg, route?.agentId ?? "main")
              : undefined;

            const { dispatcher, replyOptions, markDispatchIdle } = createReplyDispatcherWithTyping({
              humanDelay,
              typingCallbacks,
              deliver,
              onError,
            });

            await channelRuntime.reply.dispatchReplyWithBufferedBlockDispatcher({
              ctx: ctxPayload,
              cfg: this.cfg,
              dispatcherOptions: dispatcher,
              replyOptions,
            });
            markDispatchIdle();
            return;
          }
        }

        // Fallback without typing
        await channelRuntime.reply.dispatchReplyWithBufferedBlockDispatcher({
          ctx: ctxPayload,
          cfg: this.cfg,
          dispatcherOptions,
        });
        return;
      }

      console.warn(`[MAX] channelRuntime.reply not available — message lost: "${text}"`);
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
