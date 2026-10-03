export interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'USER';
  status: 'ACTIVE' | 'SUSPENDED';
  credits: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface KieConnectionState {
  connected: boolean;
  maskedKey: string | null;
  status?: string | null;
  lastTestedAt?: string | null;
  provider?: string;
  isMock?: boolean;
}

export interface Track {
  id: string;
  generationId: string;
  userId: string;
  title: string;
  audioUrl: string;
  imageUrl?: string;
  duration: number;
  prompt?: string;
  style?: string;
  lyrics?: string;
  model?: string;
  isFavorite: number | boolean;
  createdAt: string;
  generationStatus?: string;
  generationType?: string;
}

export interface Generation {
  id: string;
  userId: string;
  taskId: string;
  type: string;
  title: string;
  prompt?: string;
  lyrics?: string;
  style?: string;
  model: string;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  audioUrl?: string;
  imageUrl?: string;
  duration?: number;
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface LyricsDraft {
  id: string;
  userId: string;
  title: string;
  prompt?: string;
  lyrics: string;
  genre?: string;
  mood?: string;
  language?: string;
  createdAt: string;
}

export interface AdminStats {
  totalUsers: number;
  connectedKieUsers: number;
  disconnectedUsers: number;
  totalGenerations: number;
  successfulGenerations: number;
  failedGenerations: number;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'USER';
  status: 'ACTIVE' | 'SUSPENDED';
  credits: number;
  createdAt: string;
  updatedAt: string;
  kieConnection: {
    connected: boolean;
    status: string;
    maskedKey: string | null;
    lastTestedAt: string | null;
  };
  generationCount: number;
}

export interface AuditLogItem {
  id: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  action: string;
  details?: string;
  ipAddress?: string;
  createdAt: string;
}

export interface AdminPoolKeyItem {
  id: string;
  label: string;
  keyLastFour: string;
  maskedKey: string;
  status: 'ACTIVE' | 'EXHAUSTED' | 'INVALID' | 'DISABLED';
  balance: number;
  totalGenerations: number;
  priority: number;
  lastTestedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminPoolSummary {
  keys: AdminPoolKeyItem[];
  totalKeys: number;
  activeKeys: number;
  totalCreditsAccumulated: number;
  totalGenerations: number;
}

