import { User, AdminUser } from '../types';

export interface RegisteredUserRecord extends User {
  password?: string;
  generationCount?: number;
}

const REGISTRY_STORAGE_KEY = 'sunomaker_registered_users_registry';

/**
 * Robust client-side persistent user registry.
 * Ensures user registrations are never lost even on logout, page refreshes,
 * or across role switches between Admin and Producer.
 */
export const userRegistry = {
  getRegisteredUsers(): RegisteredUserRecord[] {
    try {
      const raw = localStorage.getItem(REGISTRY_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('Failed to parse registered users registry:', e);
      return [];
    }
  },

  saveUser(user: User, password?: string): RegisteredUserRecord {
    const users = this.getRegisteredUsers();
    const existingIndex = users.findIndex(
      (u) => u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase()
    );

    const record: RegisteredUserRecord = {
      ...user,
      password: password || (existingIndex >= 0 ? users[existingIndex].password : undefined),
      generationCount: existingIndex >= 0 ? users[existingIndex].generationCount || 0 : 0,
      updatedAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      users[existingIndex] = { ...users[existingIndex], ...record };
    } else {
      users.unshift(record);
    }

    try {
      localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(users));
    } catch (e) {
      console.error('Failed to save to user registry:', e);
    }

    return record;
  },

  findByEmail(email: string): RegisteredUserRecord | null {
    const clean = email.trim().toLowerCase();
    const users = this.getRegisteredUsers();
    return users.find((u) => u.email.toLowerCase() === clean) || null;
  },

  findById(id: string): RegisteredUserRecord | null {
    const users = this.getRegisteredUsers();
    return users.find((u) => u.id === id) || null;
  },

  updateCredits(userId: string, amount: number, action: 'add' | 'set' | 'deduct'): RegisteredUserRecord | null {
    const users = this.getRegisteredUsers();
    const index = users.findIndex((u) => u.id === userId);
    if (index === -1) return null;

    const current = users[index].credits ?? 0;
    let nextCredits = current;

    if (action === 'set') {
      nextCredits = Math.max(0, amount);
    } else if (action === 'deduct') {
      nextCredits = Math.max(0, current - amount);
    } else {
      nextCredits = Math.max(0, current + amount);
    }

    users[index].credits = nextCredits;
    users[index].updatedAt = new Date().toISOString();

    try {
      localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(users));
    } catch {}

    return users[index];
  },

  updateStatus(userId: string, status: 'ACTIVE' | 'SUSPENDED'): RegisteredUserRecord | null {
    const users = this.getRegisteredUsers();
    const index = users.findIndex((u) => u.id === userId);
    if (index === -1) return null;

    users[index].status = status;
    users[index].updatedAt = new Date().toISOString();

    try {
      localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(users));
    } catch {}

    return users[index];
  },

  deleteUser(userId: string): boolean {
    const users = this.getRegisteredUsers();
    const filtered = users.filter((u) => u.id !== userId);
    try {
      localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(filtered));
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Merge server users with locally registered users so Admin always sees everyone
   */
  mergeWithServerUsers(serverUsers: AdminUser[]): AdminUser[] {
    const local = this.getRegisteredUsers();
    const map = new Map<string, AdminUser>();

    // 1. Put server users first
    for (const su of serverUsers) {
      map.set(su.email.toLowerCase(), su);
    }

    // 2. Put / update with local registered users
    for (const lu of local) {
      const emailKey = lu.email.toLowerCase();
      const existing = map.get(emailKey);
      if (existing) {
        // If local user has updated credits from admin, keep whichever is fresher
        map.set(emailKey, {
          ...existing,
          name: lu.name || existing.name,
          credits: lu.credits !== undefined ? lu.credits : existing.credits,
          status: lu.status || existing.status,
        });
      } else {
        map.set(emailKey, {
          id: lu.id,
          name: lu.name,
          email: lu.email,
          role: lu.role,
          status: lu.status,
          credits: lu.credits ?? 0,
          createdAt: lu.createdAt || new Date().toISOString(),
          updatedAt: lu.updatedAt || new Date().toISOString(),
          kieConnection: {
            connected: false,
            status: 'NOT_CONNECTED',
            maskedKey: null,
            lastTestedAt: null,
          },
          generationCount: lu.generationCount || 0,
        });
      }
    }

    return Array.from(map.values());
  },
};
