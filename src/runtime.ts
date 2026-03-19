import { createPluginRuntimeStore } from "./plugin-sdk.js";
import type { PluginRuntime } from "./plugin-sdk.js";

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
// Streaming Deliver
// ============================================

const STREAM_EDIT_INTERVAL_MS = 800;
const TYPING_REFRESH_INTERVAL_MS = 4000;

/**
 * Creates two callbacks for streaming AI responses to a MAX chat:
 *   onPartialToken(text) — called with cumulative text for each streamed chunk
 *   deliver(payload)     — called once with the final text
 *
 * Mechanics:
 * - First chunk → sends a new message with text + " …" cursor
 * - Subsequent chunks → edits that message, throttled to ≤1 edit/800ms
 * - MAX auto-clears typing on edit → we re-send typing_on after each edit
 * - Final deliver → edits to clean final text (no cursor), stops typing
 *
 * @param client   - MaxApiClient instance
 * @param userId   - recipient user_id for sendMessage
 * @param chatId   - chat_id for sendAction (typing indicator)
 */
function createStreamingDeliver(
  client: any,
  userId: number,
  chatId: number,
): {
  onPartialToken: (text: string) => Promise<void>;
  deliver: (payload: { text?: string; body?: string }) => Promise<void>;
} {
  let messageId: string | null = null;
  let accumulated = "";
  let lastEditAt = 0;
  let pendingEdit: ReturnType<typeof setTimeout> | null = null;
  let creationPromise: Promise<void> | null = null;

  // Typing indicator — fires immediately and every TYPING_REFRESH_INTERVAL_MS
  const typingInterval = setInterval(() => {
    client.sendAction(chatId, "typing_on").catch(() => {});
  }, TYPING_REFRESH_INTERVAL_MS);
  client.sendAction(chatId, "typing_on").catch(() => {});

  function stopTyping() {
    clearInterval(typingInterval);
  }

  async function throttledEdit(text: string) {
    if (!messageId) return;
    const elapsed = Date.now() - lastEditAt;
    if (pendingEdit) { clearTimeout(pendingEdit); pendingEdit = null; }

    if (elapsed >= STREAM_EDIT_INTERVAL_MS) {
      await client.editMessage(messageId, text);
      lastEditAt = Date.now();
      // MAX clears typing indicator on each edit — restore it
      client.sendAction(chatId, "typing_on").catch(() => {});
    } else {
      pendingEdit = setTimeout(async () => {
        pendingEdit = null;
        if (messageId) {
          await client.editMessage(messageId, text).catch(() => {});
          lastEditAt = Date.now();
          client.sendAction(chatId, "typing_on").catch(() => {});
        }
      }, STREAM_EDIT_INTERVAL_MS - elapsed);
    }
  }

  async function onPartialToken(text: string): Promise<void> {
    if (!text) return;
    accumulated = text; // cumulative — SET, not +=

    if (!messageId) {
      if (!creationPromise) {
        creationPromise = (async () => {
          const result = await client.sendMessage({ user_id: userId, text: accumulated + " …" });
          // MAX sendMessage returns { message_id } or { body: { mid } }
          messageId = result?.message_id ?? result?.body?.mid ?? String(Date.now());
          lastEditAt = Date.now();
        })();
      }
      await creationPromise;
      return;
    }

    await throttledEdit(accumulated + " …");
  }

  async function deliver(payload: { text?: string; body?: string }): Promise<void> {
    stopTyping();
    if (pendingEdit) { clearTimeout(pendingEdit); pendingEdit = null; }

    const finalText = payload?.text ?? payload?.body ?? accumulated;
    if (!finalText) return;

    if (messageId) {
      await client.editMessage(messageId, finalText);
    } else {
      await client.sendMessage({ user_id: userId, text: finalText });
    }
  }

  return { onPartialToken, deliver };
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

  /** Download a MAX attachment URL and save it to disk via channelRuntime.media */
  private async downloadAttachment(
    url: string,
    contentType: string,
    channelRuntime: any
  ): Promise<{ path: string; contentType: string } | null> {
    try {
      const resp = await fetch(url, { headers: { Authorization: this.account.token ?? "" } });
      if (!resp.ok) return null;
      const arrayBuffer = await resp.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const ct = resp.headers.get("content-type") ?? contentType;

      if (typeof channelRuntime?.media?.saveMediaBuffer === "function") {
        const saved = await channelRuntime.media.saveMediaBuffer(buffer, ct, "inbound", 50 * 1024 * 1024);
        return { path: saved.path, contentType: saved.contentType ?? ct };
      }
      return null;
    } catch {
      return null;
    }
  }

  /** Returns true if this user is permitted to interact with the bot. */
  private isUserAllowed(userId: number): boolean {
    const dmPolicy = this.account.dmPolicy ?? "pairing";
    const allowFrom = this.account.allowFrom ?? [];

    if (dmPolicy === "disabled" || dmPolicy === "closed") return false;
    if (dmPolicy === "open") return true;

    // "pairing" and "allowlist" — only explicitly listed user IDs
    const id = userId.toString();
    return allowFrom.some(entry => entry.toString().replace(/^max:/i, "") === id);
  }

  private async handleUpdate(update: MaxUpdate): Promise<void> {
    try {
      if (update.update_type !== "message_created" || !update.message) return;

      const message = update.message;
      if (message.sender?.is_bot) return;

      const firstName = message.sender?.first_name || "";
      const lastName = message.sender?.last_name || "";
      const displayName = [firstName, lastName].filter(Boolean).join(" ") || "Unknown";
      const userId = message.sender?.user_id || 0;

      // Security: enforce dmPolicy / allowFrom before any processing
      if (!this.isUserAllowed(userId)) {
        console.warn(`[MAX] [security] message from ${displayName} (${userId}) blocked — not in allowFrom (policy: ${this.account.dmPolicy ?? "pairing"})`);
        return;
      }

      const chatId = message.recipient?.chat_id ?? userId;
      const text = message.body?.text ?? "";
      const attachments = message.body?.attachments ?? [];

      // Skip if no text and no media attachments
      const hasMedia = attachments.some(a =>
        a.type === "image" || a.type === "video" || a.type === "audio" || a.type === "file"
      );
      if (!text && !hasMedia) return;

      const attachmentSummary = hasMedia
        ? ` + ${attachments.filter(a => ["image","video","audio","file"].includes(a.type)).length} attachment(s)`
        : "";
      console.log(`[MAX] message from ${displayName} (${userId}): "${text}"${attachmentSummary}`);

      const inboundCtx = {
        channel: "max",
        accountId: this.account.accountId,
        peer: { kind: "direct", id: userId.toString() },
        sender: { id: userId.toString(), name: displayName },
        text: text || "[attachment]",
        timestamp: message.timestamp || Date.now(),
        messageId: message.body?.mid || "unknown",
      };

      if (this.onMessage) {
        await this.onMessage(inboundCtx);
        return;
      }

      // channelRuntime is PluginRuntime["channel"] — provided via ctx.channelRuntime in startAccount
      const channelRuntime = this.channelRuntime ?? (getMaxRuntime() as any)?.channel;

      // Download media attachments and save locally
      const savedMedia: Array<{ path: string; contentType: string }> = [];
      if (hasMedia) {
        for (const att of attachments) {
          const payloadUrl = (att as any).payload?.url;
          if (!payloadUrl) continue;

          let defaultCt = "application/octet-stream";
          if (att.type === "image")  defaultCt = "image/jpeg";
          else if (att.type === "video") defaultCt = "video/mp4";
          else if (att.type === "audio") defaultCt = "audio/mpeg";
          else if (att.type === "file")  defaultCt = "application/octet-stream";

          const saved = await this.downloadAttachment(payloadUrl, defaultCt, channelRuntime);
          if (saved) savedMedia.push(saved);
          else console.warn(`[MAX] Failed to save attachment (${att.type}) from ${payloadUrl}`);
        }
      }

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

      const bodyText = text || (savedMedia.length > 0 ? "[media]" : "[message]");

      // Build FinalizedMsgContext — use finalizeInboundContext from channelRuntime.reply if available
      const rawCtxFields: Record<string, any> = {
        Body: bodyText,
        BodyForAgent: bodyText,
        RawBody: bodyText,
        CommandBody: bodyText,
        BodyForCommands: bodyText,
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
        // Media attachments
        ...(savedMedia.length > 0 && {
          MediaPath: savedMedia[0].path,
          MediaType: savedMedia[0].contentType,
          MediaPaths: savedMedia.map(m => m.path),
          MediaTypes: savedMedia.map(m => m.contentType),
        }),
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
        const { onPartialToken, deliver } = createStreamingDeliver(this.client, userId, chatId);

        try {
          await channelRuntime.reply.dispatchReplyWithBufferedBlockDispatcher({
            ctx: ctxPayload,
            cfg: this.cfg,
            replyOptions: {
              onPartialReply: async (payload: { text?: string }) => {
                if (payload?.text) await onPartialToken(payload.text);
              },
            },
            dispatcherOptions: {
              deliver,
              onError: (err: Error, info: any) => {
                console.error(`[MAX] reply dispatch error (${info?.kind ?? "unknown"}):`, err);
              },
            },
          });
        } catch (err) {
          console.error(`[MAX] dispatchReply error:`, err);
        }
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
