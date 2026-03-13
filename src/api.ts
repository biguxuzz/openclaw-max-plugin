/**
 * MAX Messenger API Client
 */

// Use global fetch in Node 22+
const fetch = globalThis.fetch;
import type {
  MaxApiClientConfig,
  MaxSendMessageParams,
  MaxGetUpdatesParams,
  MaxUpdate,
} from "./types.js";

const DEFAULT_BASE_URL = "https://platform-api.max.ru";

export class MaxApiClient {
  private token: string;
  private baseUrl: string;

  constructor(config: MaxApiClientConfig) {
    this.token = config.token;
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  }

  /**
   * Make API request
   */
  private async request<T>(
    method: string,
    endpoint: string,
    params?: Record<string, any>,
    data?: any
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${endpoint}`);

    if (params) {
      Object.keys(params).forEach((key) => {
        if (params[key] !== undefined) {
          url.searchParams.append(key, String(params[key]));
        }
      });
    }

    const response = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: this.token,
        "Content-Type": "application/json",
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`MAX API error ${response.status}: ${text}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Get bot info
   */
  async getMe(): Promise<any> {
    return this.request("GET", "/me");
  }

  /**
   * Get current webhook subscriptions
   */
  async getSubscriptions(): Promise<{ subscriptions: Array<{ url: string; time: number }> }> {
    return this.request("GET", "/subscriptions");
  }

  /**
   * Delete a webhook subscription by URL.
   * When all webhooks are removed, long polling becomes available.
   */
  async deleteSubscription(url: string): Promise<{ success: boolean; message?: string }> {
    return this.request("DELETE", "/subscriptions", { url });
  }

  /**
   * Send message
   */
  async sendMessage(params: MaxSendMessageParams): Promise<any> {
    const query: any = {};
    if (params.user_id) query.user_id = params.user_id;
    if (params.chat_id) query.chat_id = params.chat_id;

    const body: any = { text: params.text };
    if (params.format) body.format = params.format;
    if (params.attachments) body.attachments = params.attachments;
    if (params.notify !== undefined) body.notify = params.notify;

    return this.request("POST", "/messages", query, body);
  }

  /**
   * Send bot action (typing_on, sending_photo, mark_seen, etc.)
   * POST /chats/{chatId}/actions
   */
  async sendAction(chatId: number, action: "typing_on" | "sending_photo" | "sending_video" | "sending_audio" | "sending_file" | "mark_seen"): Promise<{ success: boolean }> {
    return this.request("POST", `/chats/${chatId}/actions`, undefined, { action });
  }

  /**
   * Get updates (Long Polling)
   */
  async getUpdates(params: MaxGetUpdatesParams = {}): Promise<{
    updates: MaxUpdate[];
    marker: number;
  }> {
    const query: any = {
      limit: params.limit || 100,
      timeout: params.timeout || 30,
    };

    if (params.marker !== undefined && params.marker !== null) query.marker = params.marker;
    if (params.types && params.types.length > 0) query.types = params.types.join(",");

    return this.request("GET", "/updates", query);
  }

  /**
   * Upload file
   */
  async uploadFile(filePath: string, type: string = "image"): Promise<any> {
    const fs = await import("fs");
    const FormData = (await import("form-data")).default;

    const form = new FormData();
    form.append("file", fs.createReadStream(filePath));
    form.append("type", type);

    const response = await fetch(`${this.baseUrl}/uploads`, {
      method: "POST",
      headers: {
        Authorization: this.token,
        ...form.getHeaders(),
      },
      body: form,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Upload failed ${response.status}: ${text}`);
    }

    return response.json();
  }
}
