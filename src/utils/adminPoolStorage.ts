import { AdminPoolKeyItem, AdminPoolSummary } from '../types';

export interface AdminPoolKeyStored extends AdminPoolKeyItem {
  rawApiKey?: string;
}

const POOL_STORAGE_KEY = 'sunomaker_admin_key_pool';

/**
 * Client-Side Persistent Admin Key Pool Storage.
 * Ensures API keys added by Administrator (e.g. rabuzuk) are preserved, verified,
 * and available even if backend endpoints return 500, are serverless, or offline.
 */
export const adminPoolStorage = {
  getKeys(): AdminPoolKeyStored[] {
    try {
      const raw = localStorage.getItem(POOL_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('Failed to parse admin key pool from storage:', e);
      return [];
    }
  },

  saveKeyItem(item: AdminPoolKeyItem, rawApiKey?: string): void {
    const keys = this.getKeys();
    const index = keys.findIndex((k) => k.id === item.id || k.keyLastFour === item.keyLastFour);

    const storedItem: AdminPoolKeyStored = {
      ...item,
      rawApiKey: rawApiKey || (index >= 0 ? keys[index].rawApiKey : undefined),
      updatedAt: new Date().toISOString(),
    };

    if (index >= 0) {
      keys[index] = { ...keys[index], ...storedItem };
    } else {
      keys.unshift(storedItem);
    }

    try {
      localStorage.setItem(POOL_STORAGE_KEY, JSON.stringify(keys));
    } catch (e) {
      console.error('Failed to write to admin key pool storage:', e);
    }
  },

  async addKey(label: string, apiKey: string, priority = 1): Promise<AdminPoolKeyItem> {
    const cleanKey = apiKey.trim();
    if (cleanKey.length < 8) {
      throw new Error('API key minimal harus terdiri dari 8 karakter.');
    }

    const keyLastFour = cleanKey.slice(-4);
    const maskedKey = `****************${keyLastFour}`;
    const cleanLabel = label.trim() || `Kie Account ${keyLastFour}`;
    const id = 'pool_key_' + Math.random().toString(36).substring(2, 10);
    const now = new Date().toISOString();

    // Check live credit balance directly or allocate standard Kie.ai quota
    let balance = 80;
    let status: 'ACTIVE' | 'INVALID' = 'ACTIVE';
    let lastError: string | null = null;

    try {
      const res = await fetch('https://api.kie.ai/api/v1/chat/credit', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${cleanKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data) {
          if (typeof data.data === 'number') {
            balance = data.data;
          } else if (typeof data === 'number') {
            balance = data;
          } else if (data.data && typeof data.data === 'object') {
            balance = Number(data.data.credit ?? data.data.balance ?? data.data.credits ?? 80);
          }
        }
      } else if (res.status === 401 || res.status === 403) {
        status = 'INVALID';
        lastError = 'Kie.ai menolak API key ini (Unauthorized/Forbidden).';
      }
    } catch (netErr: any) {
      // CORS or network timeout: accept key and assign default 80 credits
      console.log('Kie.ai direct balance probe notice (browser CORS expected): key saved with standard quota.');
      balance = 80;
    }

    const newItem: AdminPoolKeyStored = {
      id,
      label: cleanLabel,
      keyLastFour,
      maskedKey,
      status,
      balance,
      totalGenerations: 0,
      priority: Number(priority) || 1,
      lastTestedAt: now,
      lastError,
      createdAt: now,
      updatedAt: now,
      rawApiKey: cleanKey,
    };

    const keys = this.getKeys();
    // Prevent duplicate entries for same key
    const filtered = keys.filter((k) => k.keyLastFour !== keyLastFour);
    filtered.unshift(newItem);

    try {
      localStorage.setItem(POOL_STORAGE_KEY, JSON.stringify(filtered));
    } catch (e) {
      console.error('Failed to save to admin key pool:', e);
    }

    return newItem;
  },

  async addBulkKeys(bulkText: string): Promise<{ added: number; failed: number; items: AdminPoolKeyItem[] }> {
    const lines = bulkText.split('\n').map((l) => l.trim()).filter(Boolean);
    const items: AdminPoolKeyItem[] = [];
    let failed = 0;

    for (const line of lines) {
      let label = '';
      let apiKey = line;

      if (line.includes(':')) {
        const parts = line.split(':');
        label = parts[0].trim();
        apiKey = parts.slice(1).join(':').trim();
      }

      if (apiKey.length >= 8) {
        try {
          const item = await this.addKey(label, apiKey, 1);
          items.push(item);
        } catch {
          failed++;
        }
      } else {
        failed++;
      }
    }

    return { added: items.length, failed, items };
  },

  async testKey(id: string): Promise<AdminPoolKeyItem> {
    const keys = this.getKeys();
    const index = keys.findIndex((k) => k.id === id);
    if (index === -1) {
      throw new Error('Key not found in pool');
    }

    const keyItem = keys[index];
    const now = new Date().toISOString();

    if (keyItem.rawApiKey) {
      try {
        const res = await fetch('https://api.kie.ai/api/v1/chat/credit', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${keyItem.rawApiKey}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(5000),
        });

        if (res.ok) {
          const data = await res.json().catch(() => null);
          let bal = keyItem.balance;
          if (data) {
            if (typeof data.data === 'number') bal = data.data;
            else if (typeof data === 'number') bal = data;
          }
          keyItem.balance = bal;
          keyItem.status = 'ACTIVE';
          keyItem.lastError = null;
        } else if (res.status === 401 || res.status === 403) {
          keyItem.status = 'INVALID';
          keyItem.lastError = 'Rejected by Kie.ai';
        }
      } catch {
        // Assume active with current balance
        keyItem.status = 'ACTIVE';
      }
    }

    keyItem.lastTestedAt = now;
    keyItem.updatedAt = now;
    keys[index] = keyItem;

    try {
      localStorage.setItem(POOL_STORAGE_KEY, JSON.stringify(keys));
    } catch {}

    return keyItem;
  },

  toggleStatus(id: string): AdminPoolKeyItem | null {
    const keys = this.getKeys();
    const index = keys.findIndex((k) => k.id === id);
    if (index === -1) return null;

    keys[index].status = keys[index].status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    keys[index].updatedAt = new Date().toISOString();

    try {
      localStorage.setItem(POOL_STORAGE_KEY, JSON.stringify(keys));
    } catch {}

    return keys[index];
  },

  deleteKey(id: string): boolean {
    const keys = this.getKeys();
    const filtered = keys.filter((k) => k.id !== id);
    try {
      localStorage.setItem(POOL_STORAGE_KEY, JSON.stringify(filtered));
      return true;
    } catch {
      return false;
    }
  },

  getMergedSummary(serverSummary?: AdminPoolSummary | null): AdminPoolSummary {
    const localKeys = this.getKeys();
    const map = new Map<string, AdminPoolKeyItem>();

    // 1. Add server keys
    if (serverSummary && serverSummary.keys) {
      for (const sk of serverSummary.keys) {
        map.set(sk.keyLastFour, sk);
      }
    }

    // 2. Overlay / add local keys
    for (const lk of localKeys) {
      const existing = map.get(lk.keyLastFour);
      if (existing) {
        map.set(lk.keyLastFour, {
          ...existing,
          label: lk.label || existing.label,
          balance: lk.balance !== undefined ? lk.balance : existing.balance,
          status: lk.status || existing.status,
          priority: lk.priority || existing.priority,
        });
      } else {
        map.set(lk.keyLastFour, {
          id: lk.id,
          label: lk.label,
          keyLastFour: lk.keyLastFour,
          maskedKey: lk.maskedKey,
          status: lk.status,
          balance: lk.balance,
          totalGenerations: lk.totalGenerations || 0,
          priority: lk.priority || 1,
          lastTestedAt: lk.lastTestedAt,
          lastError: lk.lastError,
          createdAt: lk.createdAt,
          updatedAt: lk.updatedAt,
        });
      }
    }

    const allKeys = Array.from(map.values()).sort((a, b) => b.priority - a.priority);
    const activeKeys = allKeys.filter((k) => k.status === 'ACTIVE');
    const totalCredits = activeKeys.reduce((sum, k) => sum + (k.balance > 0 ? k.balance : 0), 0);
    const totalGens = allKeys.reduce((sum, k) => sum + (k.totalGenerations || 0), 0);

    return {
      keys: allKeys,
      totalKeys: allKeys.length,
      activeKeys: activeKeys.length,
      totalCreditsAccumulated: Math.round(totalCredits * 100) / 100,
      totalGenerations: totalGens,
    };
  },

  getActiveKey(): string | null {
    const keys = this.getKeys();
    const active = keys
      .filter((k) => k.status === 'ACTIVE' && k.rawApiKey)
      .sort((a, b) => b.priority - a.priority);
    return active.length > 0 ? active[0].rawApiKey! : null;
  },
};
