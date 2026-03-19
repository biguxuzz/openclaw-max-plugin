/**
 * MAX account config resolution.
 * Supports both flat config (channels.max.token) and
 * accounts-based config (channels.max.accounts.default.token).
 */

import type { ResolvedMaxAccount } from "./types.js";

export const DEFAULT_ACCOUNT_ID = "default";
export const DEFAULT_WEBHOOK_PATH = "/max/webhook";

/**
 * Resolve a MAX account from OpenClaw config.
 *
 * Merge strategy (later overrides earlier):
 *   root max config → per-account config (channels.max.accounts.<id>)
 *
 * This means:
 *   - Flat: channels.max.token works for the default account
 *   - Accounts: channels.max.accounts.default.token works
 *   - Mix: root provides defaults, per-account overrides them
 */
export function resolveAccount(cfg: any, accountId?: string | null): ResolvedMaxAccount {
  const id = accountId ?? DEFAULT_ACCOUNT_ID;
  const maxCfg = cfg?.channels?.max ?? {};
  const perAccount = maxCfg.accounts?.[id] ?? {};
  const merged = { ...maxCfg, ...perAccount };

  const token = (
    merged.token ??
    process.env.MAX_BOT_TOKEN ??
    process.env.MAX_API_TOKEN ??
    ""
  ).trim();

  return {
    accountId: id,
    name: merged.name,
    enabled: merged.enabled !== false,
    configured: Boolean(token),
    token,
    dmPolicy: merged.dmPolicy ?? "pairing",
    allowFrom: normalizeAllowFrom(merged.allowFrom),
    webhookUrl: merged.webhookUrl,
    webhookSecret: merged.webhookSecret,
    webhookPath: merged.webhookPath ?? DEFAULT_WEBHOOK_PATH,
  };
}

/**
 * List all configured account IDs.
 * Always includes "default" if a root-level token exists or no accounts are defined.
 */
export function listAccountIds(cfg: any): string[] {
  const maxCfg = cfg?.channels?.max;
  if (!maxCfg) return [DEFAULT_ACCOUNT_ID];

  const ids = Object.keys(maxCfg.accounts ?? {});
  const hasRootToken = Boolean(
    maxCfg.token ?? process.env.MAX_BOT_TOKEN ?? process.env.MAX_API_TOKEN,
  );

  if (hasRootToken || ids.length === 0) {
    return [DEFAULT_ACCOUNT_ID, ...ids.filter((id) => id !== DEFAULT_ACCOUNT_ID)];
  }
  return ids;
}

function normalizeAllowFrom(raw?: string[]): string[] {
  if (!raw) return [];
  return raw
    .map((s) => String(s).trim())
    .filter(Boolean)
    .map((s) => s.replace(/^max:(?:user:)?/i, ""));
}
