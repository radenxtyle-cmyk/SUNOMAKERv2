import { User, KieConnectionState, Track, Generation, LyricsDraft, AdminStats, AdminUser, AuditLogItem, AdminPoolSummary, AdminPoolKeyItem } from '../types';

const TOKEN_STORAGE_KEY = 'sunomaker_session_token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

async function fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorMsg = data.error || data.message || `Request failed (${res.status})`;
    const error = new Error(errorMsg) as any;
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data as T;
}

export const api = {
  // Auth
  async getMe(): Promise<{ user: User | null; token?: string; kieConnection?: KieConnectionState }> {
    const data = await fetchJson<{ user: User | null; token?: string; kieConnection?: KieConnectionState }>('/api/auth/me');
    if (data.token) {
      setStoredToken(data.token);
    }
    return data;
  },

  async register(name: string, email: string, password: string): Promise<{ user: User; token?: string; kieConnection: KieConnectionState }> {
    const data = await fetchJson<{ user: User; token?: string; kieConnection: KieConnectionState }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    if (data.token) {
      setStoredToken(data.token);
    }
    return data;
  },

  async login(email: string, password: string): Promise<{ user: User; token?: string; kieConnection: KieConnectionState }> {
    const data = await fetchJson<{ user: User; token?: string; kieConnection: KieConnectionState }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data.token) {
      setStoredToken(data.token);
    }
    return data;
  },

  async logout(): Promise<void> {
    setStoredToken(null);
    await fetchJson('/api/auth/logout', { method: 'POST' });
  },

  async switchDemoUser(role: 'ADMIN' | 'USER'): Promise<{ user: User; token?: string; kieConnection: KieConnectionState }> {
    const data = await fetchJson<{ user: User; token?: string; kieConnection: KieConnectionState }>('/api/auth/demo-switch', {
      method: 'POST',
      body: JSON.stringify({ role }),
    });
    if (data.token) {
      setStoredToken(data.token);
    }
    return data;
  },

  async updateProfile(name?: string, newPassword?: string): Promise<{ success: boolean; user: User }> {
    return fetchJson('/api/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify({ name, newPassword }),
    });
  },

  async deleteAccount(): Promise<{ success: boolean; message: string }> {
    return fetchJson('/api/auth/account', { method: 'DELETE' });
  },

  // Kie.ai BYOK Management
  async getKieStatus(): Promise<KieConnectionState> {
    return fetchJson('/api/kie/status');
  },

  async connectKieKey(apiKey: string): Promise<{ connected: boolean; maskedKey: string; message: string }> {
    return fetchJson('/api/kie/connect', {
      method: 'POST',
      body: JSON.stringify({ apiKey }),
    });
  },

  async testKieConnection(): Promise<{ connected: boolean; status: string; message: string }> {
    return fetchJson('/api/kie/test', { method: 'POST' });
  },

  async disconnectKie(): Promise<{ connected: boolean; message: string }> {
    return fetchJson('/api/kie/disconnect', { method: 'DELETE' });
  },

  async getKieUsage(): Promise<{ connected: boolean; usageInfo: string; balance?: number | null }> {
    return fetchJson('/api/kie/usage');
  },

  // Music Generation & Library
  async generateMusic(payload: {
    title?: string;
    prompt?: string;
    lyrics?: string;
    style?: string;
    negativeTags?: string;
    instrumental?: boolean;
    vocalGender?: string;
    model?: string;
    duration?: number;
    customMode?: boolean;
    styleWeight?: number;
    weirdnessConstraint?: number;
    audioWeight?: number;
  }): Promise<{ generationId: string; taskId: string; status: string; title: string }> {
    return fetchJson('/api/music/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getLibrary(params: { status?: string; favorite?: boolean; search?: string; sort?: string } = {}): Promise<{
    tracks: Track[];
    pendingGenerations: Generation[];
  }> {
    const query = new URLSearchParams();
    if (params.status && params.status !== 'all') query.set('status', params.status);
    if (params.favorite) query.set('favorite', 'true');
    if (params.search) query.set('search', params.search);
    if (params.sort) query.set('sort', params.sort);
    return fetchJson(`/api/music?${query.toString()}`);
  },

  async getTrack(id: string): Promise<Track> {
    return fetchJson(`/api/music/${id}`);
  },

  async getTaskStatus(taskId: string): Promise<{
    taskId: string;
    status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    progress?: number;
    generation?: Generation;
    tracks?: Track[];
    errorMessage?: string;
  }> {
    return fetchJson(`/api/music/status/${taskId}`);
  },

  async deleteTrack(id: string): Promise<{ success: boolean }> {
    return fetchJson(`/api/music/${id}`, { method: 'DELETE' });
  },

  async deleteGeneration(id: string): Promise<{ success: boolean }> {
    return fetchJson(`/api/music/generations/${id}`, { method: 'DELETE' });
  },

  async toggleFavorite(id: string): Promise<{ success: boolean; isFavorite: boolean }> {
    return fetchJson(`/api/music/${id}/favorite`, { method: 'POST' });
  },

  async extendMusic(trackId: string, prompt?: string, style?: string): Promise<{ success: boolean; taskId: string; generationId: string }> {
    return fetchJson('/api/music/extend', {
      method: 'POST',
      body: JSON.stringify({ trackId, prompt, style }),
    });
  },

  async coverMusic(audioUrl: string, style?: string): Promise<{ success: boolean; taskId: string; generationId: string }> {
    return fetchJson('/api/music/cover', {
      method: 'POST',
      body: JSON.stringify({ audioUrl, style }),
    });
  },

  async separateStems(audioUrl: string): Promise<{ success: boolean; taskId: string }> {
    return fetchJson('/api/music/separate', {
      method: 'POST',
      body: JSON.stringify({ audioUrl }),
    });
  },

  async createMusicVideo(trackId: string): Promise<{ success: boolean; taskId: string }> {
    return fetchJson('/api/music/video', {
      method: 'POST',
      body: JSON.stringify({ trackId }),
    });
  },

  // Lyrics Studio
  async generateLyrics(payload: { prompt?: string; theme?: string; genre?: string; mood?: string; language?: string }): Promise<{
    id: string;
    title: string;
    lyrics: string;
    genre?: string;
    mood?: string;
  }> {
    return fetchJson('/api/lyrics/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getLyricsList(): Promise<LyricsDraft[]> {
    return fetchJson('/api/lyrics');
  },

  async deleteLyrics(id: string): Promise<{ success: boolean }> {
    return fetchJson(`/api/lyrics/${id}`, { method: 'DELETE' });
  },

  // Admin APIs (No keys ever exposed)
  async getAdminStats(): Promise<AdminStats> {
    return fetchJson('/api/admin/stats');
  },

  async getAdminUsers(): Promise<AdminUser[]> {
    return fetchJson('/api/admin/users');
  },

  async updateAdminUser(userId: string, data: { status?: 'ACTIVE' | 'SUSPENDED'; role?: 'ADMIN' | 'USER' }): Promise<{ success: boolean }> {
    return fetchJson(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async deleteAdminUser(userId: string): Promise<{ success: boolean; message: string }> {
    return fetchJson(`/api/admin/users/${userId}`, {
      method: 'DELETE',
    });
  },

  async updateUserCredits(userId: string, payload: { amount: number; action?: 'add' | 'set' | 'deduct'; reason?: string }): Promise<{ success: boolean; credits: number; message: string }> {
    return fetchJson(`/api/admin/users/${userId}/credits`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async distributeCredits(payload: { amount: number; reason?: string }): Promise<{ success: boolean; message: string }> {
    return fetchJson('/api/admin/distribute-credits', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getAdminGenerations(): Promise<Generation[]> {
    return fetchJson('/api/admin/generations');
  },

  async getAdminAuditLogs(): Promise<AuditLogItem[]> {
    return fetchJson('/api/admin/audit-logs');
  },

  // Admin Key Pool & Credit Aggregator
  async getAdminKeyPool(sync = false): Promise<AdminPoolSummary> {
    return fetchJson(`/api/admin/key-pool${sync ? '?sync=true' : ''}`);
  },

  async addAdminPoolKey(payload: { label?: string; apiKey: string; priority?: number }): Promise<AdminPoolKeyItem> {
    return fetchJson('/api/admin/key-pool', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async addAdminPoolBulkKeys(bulkText: string): Promise<{ added: number; errors: string[] }> {
    return fetchJson('/api/admin/key-pool/bulk', {
      method: 'POST',
      body: JSON.stringify({ bulkText }),
    });
  },

  async testAdminPoolKey(id: string): Promise<AdminPoolKeyItem> {
    return fetchJson(`/api/admin/key-pool/${id}/test`, {
      method: 'POST',
    });
  },

  async syncAllAdminPoolKeys(): Promise<AdminPoolSummary> {
    return fetchJson('/api/admin/key-pool/sync-all', {
      method: 'POST',
    });
  },

  async updateAdminPoolKey(id: string, payload: { label?: string; status?: string; priority?: number }): Promise<{ success: boolean }> {
    return fetchJson(`/api/admin/key-pool/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async deleteAdminPoolKey(id: string): Promise<{ success: boolean }> {
    return fetchJson(`/api/admin/key-pool/${id}`, {
      method: 'DELETE',
    });
  },
};
