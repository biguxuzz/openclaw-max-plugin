/**
 * Minimal Plugin SDK Types
 * 
 * These are minimal type definitions needed for the plugin.
 * The actual types are provided by OpenClaw Gateway at runtime.
 */

// ============================================
// Core Types
// ============================================

export interface ChannelPlugin<ResolvedAccount = any, Probe = any> {
  id: string;
  meta: ChannelMeta;
  capabilities?: ChannelCapabilities;
  reload?: { configPrefixes: string[] };
  config: ChannelConfigAdapter<ResolvedAccount>;
  pairing?: ChannelPairingAdapter;
  security?: ChannelSecurityAdapter<ResolvedAccount>;
  messaging?: ChannelMessagingAdapter;
  directory?: ChannelDirectoryAdapter;
  setup?: ChannelSetupAdapter;
  startRuntime?: (params: {
    account: ResolvedAccount;
    onMessage: (ctx: any) => Promise<void>;
    onError: (error: Error) => void;
  }) => Promise<{
    stop: () => void;
    sendMessage?: (userId: number, text: string) => Promise<void>;
  }>;
}

export interface ChannelMeta {
  id: string;
  label: string;
  selectionLabel: string;
  docsPath: string;
  blurb: string;
  order?: number;
  aliases?: string[];
  quickstartAllowFrom?: boolean;
}

export interface ChannelCapabilities {
  chatTypes: Array<"direct" | "group" | "channel" | "thread">;
  reactions?: boolean;
  threads?: boolean;
  media?: boolean;
  polls?: boolean;
  nativeCommands?: boolean;
  blockStreaming?: boolean;
}

export interface ChannelConfigAdapter<ResolvedAccount> {
  listAccountIds: (cfg: any) => string[];
  resolveAccount: (cfg: any, accountId?: string | null) => ResolvedAccount;
  defaultAccountId?: (cfg: any) => string;
  setAccountEnabled?: (params: {
    cfg: any;
    accountId: string;
    enabled: boolean;
  }) => any;
  deleteAccount?: (params: { cfg: any; accountId: string }) => any;
  isConfigured?: (account: ResolvedAccount, cfg: any) => boolean | Promise<boolean>;
  unconfiguredReason?: (account: ResolvedAccount, cfg: any) => string | undefined;
  describeAccount?: (account: ResolvedAccount, cfg: any) => any;
  resolveAllowFrom?: (params: {
    cfg: any;
    accountId?: string | null;
  }) => Array<string | number> | undefined;
  formatAllowFrom?: (params: {
    cfg: any;
    accountId?: string | null;
    allowFrom: Array<string | number>;
  }) => string[];
  resolveDefaultTo?: (params: {
    cfg: any;
    accountId?: string | null;
  }) => string | undefined;
}

export interface ChannelPairingAdapter {
  idLabel: string;
  normalizeAllowEntry: (entry: string) => string;
  notifyApproval: (params: { cfg: any; id: string }) => Promise<void>;
}

export interface ChannelSecurityAdapter<ResolvedAccount> {
  resolveDmPolicy: (params: {
    cfg: any;
    accountId?: string | null;
    account: ResolvedAccount;
  }) => {
    policy: string;
    allowFrom?: Array<string | number>;
    policyPath: string;
    allowFromPath: string;
    approveHint: string;
    normalizeEntry?: (raw: string) => string;
  };
}

export interface ChannelMessagingAdapter {
  normalizeTarget: (to: string) => string;
  targetResolver?: {
    looksLikeId: (id: string) => boolean;
    hint: string;
  };
  sendText?: (params: {
    cfg: any;
    to: string;
    text: string;
    accountId?: string | null;
    silent?: boolean;
  }) => Promise<{ channel: string; messageId?: any }>;
  sendMedia?: (params: {
    cfg: any;
    to: string;
    text?: string;
    mediaUrl?: string;
    mediaLocalRoots?: string[];
    accountId?: string | null;
    silent?: boolean;
  }) => Promise<{ channel: string; messageId?: any }>;
}

export interface ChannelDirectoryAdapter {
  self: (params: any) => Promise<any>;
  listPeers: (params: any) => Promise<any[]>;
  listGroups: (params: any) => Promise<any[]>;
}

export interface ChannelSetupAdapter {
  resolveAccountId?: (params: {
    cfg: any;
    accountId?: string;
    input?: any;
  }) => string;
  applyAccountConfig: (params: {
    cfg: any;
    accountId: string;
    input: any;
  }) => any;
  validateInput?: (params: {
    cfg: any;
    accountId: string;
    input: any;
  }) => string | null;
}

// ============================================
// Stub Implementations (for type checking)
// ============================================

export const OpenClawConfig: any = {};
export type TSchema = any;
