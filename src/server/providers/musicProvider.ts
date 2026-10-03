export interface MusicGenerationInput {
  title?: string;
  prompt?: string;
  lyrics?: string;
  style?: string;
  negativeTags?: string;
  instrumental?: boolean;
  vocalGender?: 'm' | 'f' | 'auto';
  model?: string;
  duration?: number;
  customMode?: boolean;
  styleWeight?: number;
  weirdnessConstraint?: number;
  audioWeight?: number;
  personaId?: string;
  callbackUrl?: string;
}

export interface GeneratedTrackResult {
  id?: string;
  title: string;
  audioUrl: string;
  imageUrl?: string;
  duration?: number;
  prompt?: string;
  style?: string;
  lyrics?: string;
}

export interface TaskStatusResult {
  taskId: string;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  progress?: number;
  tracks?: GeneratedTrackResult[];
  errorCode?: string;
  errorMessage?: string;
  rawResponse?: any;
}

export interface MusicProvider {
  name: string;
  testConnection(decryptedApiKey: string): Promise<{ success: boolean; message?: string }>;
  generateMusic(decryptedApiKey: string, input: MusicGenerationInput): Promise<{ taskId: string; initialStatus: string }>;
  getTaskStatus(decryptedApiKey: string, taskId: string): Promise<TaskStatusResult>;
  getUsage?(decryptedApiKey: string): Promise<{ usageInfo: string; balance?: number | null; currency?: string | null }>;
  extendMusic?(decryptedApiKey: string, input: { trackId: string; audioUrl: string; prompt?: string; style?: string }): Promise<{ taskId: string }>;
  coverMusic?(decryptedApiKey: string, input: { audioUrl: string; style?: string }): Promise<{ taskId: string }>;
  separateStems?(decryptedApiKey: string, input: { audioUrl: string }): Promise<{ taskId: string }>;
  generateLyrics?(decryptedApiKey: string, input: { prompt: string; genre?: string; mood?: string; language?: string }): Promise<{ lyrics: string; title: string }>;
  generateMusicVideo?(decryptedApiKey: string, input: { audioUrl: string; title: string }): Promise<{ taskId: string }>;
}
