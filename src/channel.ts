/**
 * MAX Messenger Channel Plugin
 */

import type { ChannelPlugin } from "./plugin-sdk.js";
import type { ResolvedMaxAccount, MaxProbe } from "./types.js";
import { MaxApiClient } from "./api.js";

// ============================================
// Meta
// ============================================

const meta = {
  id: "max" as const,
  label: "MAX Messenger",
  selectionLabel: "MAX",
  docsPath: "/channels/max-messenger",
  blurb: "MAX messenger integration for OpenClaw",
  order: 100,
  aliases: ["max", "maxbot", "max-messenger"],
  quickstartAllowFrom: true,
};

// ============================================
// Account Resolution
// ============================================

const DEFAULT_ACCOUNT_ID = "default";

function resolveMaxAccount(
  cfg: any,
  accountId?: string | null
): ResolvedMaxAccount {
  const id = accountId || DEFAULT_ACCOUNT_ID;
  const accounts = cfg.channels?.max?.accounts || {};
  const account = accounts[id] || cfg.channels?.max || {};

  return {
    accountId: id,
    name: account.name,
    enabled: account.enabled !== false,
    configured: Boolean(account.token || process.env.MAX_API_TOKEN),
    token: account.token || process.env.MAX_API_TOKEN,
    config: {
      dmPolicy: account.dmPolicy || "pairing",
      allowFrom: account.allowFrom || [],
      defaultTo: account.defaultTo,
    },
  };
}

function listMaxAccountIds(cfg: any): string[] {
  const accounts = cfg.channels?.max?.accounts || {};
  const ids = Object.keys(accounts);
  return ids.length > 0 ? ids : [DEFAULT_ACCOUNT_ID];
}

// ============================================
// MAX Client Helper
// ============================================

function getMaxClient(account: ResolvedMaxAccount): MaxApiClient | null {
  if (!account.token) {
    return null;
  }

  return new MaxApiClient({
    token: account.token,
  });
}

// ============================================
// Plugin Definition
// ============================================

export const maxPlugin: ChannelPlugin<ResolvedMaxAccount, MaxProbe> = {
  id: "max",

  meta,

  capabilities: {
    chatTypes: ["direct"],
    reactions: false,
    threads: false,
    media: true,
    polls: false,
    nativeCommands: false,
    blockStreaming: false,
  },

  reload: {
    configPrefixes: ["channels.max"],
  },

  config: {
    listAccountIds: listMaxAccountIds,

    resolveAccount: resolveMaxAccount,

    defaultAccountId: () => DEFAULT_ACCOUNT_ID,

    setAccountEnabled: ({ cfg, accountId, enabled }) => {
      const next = { ...cfg };
      if (!next.channels) next.channels = {};
      if (!next.channels.max) next.channels.max = {};
      if (!next.channels.max.accounts) next.channels.max.accounts = {};

      if (!next.channels.max.accounts[accountId]) {
        next.channels.max.accounts[accountId] = {};
      }

      next.channels.max.accounts[accountId].enabled = enabled;
      return next;
    },

    deleteAccount: ({ cfg, accountId }) => {
      const next = { ...cfg };
      if (next.channels?.max?.accounts?.[accountId]) {
        delete next.channels.max.accounts[accountId];
      }
      return next;
    },

    isConfigured: (account) => {
      return account.configured;
    },

    unconfiguredReason: (account) => {
      if (!account.configured) {
        return "MAX token not configured";
      }
      return undefined;
    },

    describeAccount: (account) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: account.configured,
    }),
  },

  pairing: {
    idLabel: "maxUserId",
    normalizeAllowEntry: (entry) => entry.replace(/^(max|maxbot):/i, ""),
    notifyApproval: async ({ cfg, id }) => {
      const account = resolveMaxAccount(cfg);
      const client = getMaxClient(account);

      if (!client) {
        throw new Error("MAX client not available");
      }

      await client.sendMessage({
        user_id: Number(id),
        text: "✅ You have been approved to use this bot!",
      });
    },
  },

  security: {
    resolveDmPolicy: ({ account }) => ({
      policy: account.config.dmPolicy || "pairing",
      allowFrom: account.config.allowFrom || [],
      policyPath: `channels.max.accounts.${account.accountId}.dmPolicy`,
      allowFromPath: `channels.max.accounts.${account.accountId}`,
      approveHint: "Run: openclaw channels max allow <user_id>",
    }),
  },

  messaging: {
    normalizeTarget: (to: string) => to,
    targetResolver: {
      looksLikeId: (id: string) => /^\d+$/.test(id),
      hint: "<user_id>",
    },
  },

  directory: {
    self: async () => null,
    listPeers: async () => [],
    listGroups: async () => [],
  },

  setup: {
    resolveAccountId: ({ accountId }) => accountId || DEFAULT_ACCOUNT_ID,

    applyAccountConfig: ({ cfg, accountId, input }) => {
      const next = { ...cfg };
      if (!next.channels) next.channels = {};
      if (!next.channels.max) next.channels.max = {};
      if (!next.channels.max.accounts) next.channels.max.accounts = {};

      if (!next.channels.max.accounts[accountId]) {
        next.channels.max.accounts[accountId] = {};
      }

      const account = next.channels.max.accounts[accountId];

      if (input.name) account.name = input.name;
      if (input.token) account.token = input.token;
      if (input.tokenFile) account.tokenFile = input.tokenFile;

      return next;
    },

    validateInput: ({ input }) => {
      if (!input.token && !input.tokenFile && !input.useEnv) {
        return "MAX requires token or --token-file (or --use-env)";
      }
      return null;
    },
  },

  outbound: {
    deliveryMode: "direct" as const,
    chunker: null,
    textChunkLimit: 4096,

    sendText: async ({ cfg, to, text, accountId }: {
      cfg: any;
      to: string;
      text: string;
      accountId?: string | null;
    }) => {
      const account = resolveMaxAccount(cfg, accountId);
      const client = getMaxClient(account);
      if (!client) throw new Error("MAX client not available — token not configured");
      const userId = Number(to.replace(/^max:/i, ""));
      if (isNaN(userId)) throw new Error(`Invalid MAX user_id: ${to}`);
      const result = await client.sendMessage({ user_id: userId, text });
      return { channel: "max", messageId: result?.mid ?? Date.now() };
    },

    sendMedia: async ({ cfg, to, text, accountId }: {
      cfg: any;
      to: string;
      text?: string | null;
      mediaUrl?: string | null;
      accountId?: string | null;
    }) => {
      const account = resolveMaxAccount(cfg, accountId);
      const client = getMaxClient(account);
      if (!client) throw new Error("MAX client not available — token not configured");
      const userId = Number(to.replace(/^max:/i, ""));
      if (isNaN(userId)) throw new Error(`Invalid MAX user_id: ${to}`);
      const result = await client.sendMessage({ user_id: userId, text: text ?? "" });
      return { channel: "max", messageId: result?.mid ?? Date.now() };
    },
  },

  /**
   * Gateway runtime integration
   */
  gateway: {
    startAccount: async (ctx: any) => {
      const { account, abortSignal } = ctx;

      console.log(`[MAX] [${account.accountId}] starting`);

      const { MaxRuntimeImpl } = await import("./runtime.js");

      const ctxAny = ctx as any;

      const runtimeImpl = new MaxRuntimeImpl({
        account,
        cfg: ctx.cfg,
        channelRuntime: ctxAny.channelRuntime,
        onError: (err: Error) => {
          console.error(`[MAX] [${account.accountId}] runtime error:`, err);
        },
      });

      abortSignal?.addEventListener("abort", () => {
        console.log(`[MAX] [${account.accountId}] stopping (abort signal)`);
        runtimeImpl.stop();
      });

      await runtimeImpl.start();

      // Block until poll loop exits (via abortSignal or fatal error).
      // This is required: the gateway treats a resolved startAccount as "stopped".
      await runtimeImpl.done;
    },

    logoutAccount: async ({ accountId, cfg }: any) => {
      return cfg;
    },
  },
};

export default maxPlugin;
