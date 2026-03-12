/**
 * MAX Messenger Channel Types
 */

// ============================================
// Core Types
// ============================================

export interface MaxAccount {
  accountId: string;
  name?: string;
  enabled: boolean;
  token?: string;
  tokenFile?: string;
  useEnv?: boolean;
}

export interface ResolvedMaxAccount {
  accountId: string;
  name?: string;
  enabled: boolean;
  configured: boolean;
  token?: string;
  config: {
    dmPolicy?: string;
    allowFrom?: string[];
    defaultTo?: string;
  };
}

export interface MaxProbe {
  botInfo?: {
    user_id: number;
    name: string;
    username: string;
  };
  connected: boolean;
  lastChecked: number;
}

export interface MaxMessage {
  message_id: string;
  sender: {
    user_id: number;
    name: string;
    username?: string;
    is_bot: boolean;
  };
  body: {
    mid: string;
    text: string;
  };
  timestamp: number;
}

export interface MaxUpdate {
  update_type: string;
  marker: number;
  message?: MaxMessage;
  callback?: any;
}

// ============================================
// API Types
// ============================================

export interface MaxApiClientConfig {
  token: string;
  baseUrl?: string;
}

export interface MaxSendMessageParams {
  user_id?: number;
  chat_id?: number;
  text: string;
  format?: "markdown" | "html";
  attachments?: any[];
  notify?: boolean;
}

export interface MaxGetUpdatesParams {
  limit?: number;
  timeout?: number;
  marker?: number;
  types?: string[];
}

// ============================================
// Config Schema
// ============================================

// Schema is defined inline in the plugin
// This is just for documentation purposes
export interface MaxConfigSchema {
  token?: string;
  tokenFile?: string;
  name?: string;
  enabled?: boolean;
  dmPolicy?: "open" | "pairing" | "closed";
  allowFrom?: string[];
  defaultTo?: string;
}
