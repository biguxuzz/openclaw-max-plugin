/**
 * MAX Messenger Provider Monitor
 * 
 * Monitors MAX runtime and reports status to Gateway.
 * Mirrors the Telegram provider structure.
 */

import type { ResolvedMaxAccount } from "./types.js";
import { MaxRuntimeImpl } from "./runtime.js";

export interface MaxProviderConfig {
  account: ResolvedMaxAccount;
  onMessage?: (message: any) => Promise<void>;
  onError?: (error: Error) => void;
  abortSignal?: AbortSignal;
}

export interface MaxProvider {
  stop: () => void;
  sendMessage: (userId: number, text: string) => Promise<void>;
  running: boolean;
  lastError?: Error;
}

/**
 * Monitor MAX provider - starts runtime and handles health checks
 */
export async function monitorMaxProvider(
  config: MaxProviderConfig
): Promise<MaxProvider> {
  const { account, runtime, abortSignal } = config;
  
  console.log(`[MAX] monitorMaxProvider() starting for account ${account.accountId}`);
  console.log(`[MAX] runtime.onMessage=${!!runtime?.onMessage}, runtime.onError=${!!runtime?.onError}`);
  
  // Create runtime
  const runtimeImpl = new MaxRuntimeImpl({
    account,
    runtime,  // Pass runtime object!
  });
  
  // Start runtime
  try {
    await runtimeImpl.start();
    console.log(`[MAX] monitorMaxProvider() runtime started successfully`);
  } catch (err) {
    console.error(`[MAX] monitorMaxProvider() failed to start:`, err);
    throw err;
  }
  
  // Handle abort signal
  if (abortSignal) {
    abortSignal.addEventListener('abort', () => {
      console.log(`[MAX] Abort signal received, stopping runtime`);
      runtimeImpl.stop();
    });
  }
  
  // Return provider object with DYNAMIC running property
  const provider: MaxProvider = {
    stop: () => {
      console.log(`[MAX] Provider stop() called`);
      runtimeImpl.stop();
    },
    
    sendMessage: async (userId: number, text: string) => {
      return runtimeImpl.sendMessage(userId, text);
    },
    
    // Dynamic running check - always reads from runtime
    get running() {
      const isRunning = (runtimeImpl as any).running;
      console.log(`[MAX] Provider.running getter called, returning: ${isRunning}`);
      return isRunning;
    },
  };
  
  return provider;
}
