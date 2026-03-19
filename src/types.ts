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
  webhookUrl?: string;
  webhookSecret?: string;
  webhookPath?: string;
  config: {
    dmPolicy?: string;
    allowFrom?: string[];
    defaultTo?: string;
  };
}

export interface MaxProbe {
  botInfo?: {
    user_id: number;
    first_name: string;
    username: string;
  };
  connected: boolean;
  lastChecked: number;
}

// Attachment types received in incoming messages
export type MaxMediaPayload = { url: string; token: string };

export type MaxAttachment =
  | { type: "image";  payload: MaxMediaPayload & { photo_id: number } }
  | { type: "video";  payload: MaxMediaPayload; filename?: string; width?: number; height?: number; duration?: number }
  | { type: "audio";  payload: MaxMediaPayload; filename?: string }
  | { type: "file";   payload: MaxMediaPayload; filename: string; size: number }
  | { type: "sticker"; payload: { url: string; code: string }; width: number; height: number }
  | { type: "share";  payload: Partial<MaxMediaPayload>; title?: string; description?: string; image_url?: string }
  | { type: "location"; latitude: number; longitude: number }
  | { type: "contact"; payload: { vcf_info?: string } }
  | { type: "inline_keyboard"; payload: { buttons: any[][] } };

export interface MaxMessage {
  sender?: {
    user_id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    is_bot: boolean;
  };
  recipient: {
    chat_id?: number;
    user_id?: number;
    chat_type?: string;
  };
  body: {
    mid: string;
    text?: string | null;
    attachments?: MaxAttachment[] | null;
  };
  timestamp: number;
}

export interface MaxUpdate {
  update_type: string;
  timestamp: number;
  message?: MaxMessage;
  user_locale?: string;
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
  dmPolicy?: "open" | "pairing" | "closed" | "allowlist" | "disabled";
  allowFrom?: string[];
  defaultTo?: string;
  webhookUrl?: string;
  webhookSecret?: string;
  webhookPath?: string;
}
