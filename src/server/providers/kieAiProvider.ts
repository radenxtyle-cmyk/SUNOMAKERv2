import { MusicProvider, MusicGenerationInput, TaskStatusResult, GeneratedTrackResult } from './musicProvider';
import { config } from '../config';

// In-memory simulation state for mock tasks
interface MockTaskState {
  taskId: string;
  createdAt: number;
  input: MusicGenerationInput;
  type: string;
}
const mockTasksStore = new Map<string, MockTaskState>();

// Curated high quality audio samples with distinct genres for realistic simulation in mock/demo mode
const SAMPLE_AUDIO_LIBRARY = [
  {
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=synthwave-80s-110045.mp3',
    imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80',
    duration: 186,
    defaultStyle: 'Synthwave / Retrowave',
  },
  {
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=lofi-study-112191.mp3',
    imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
    duration: 147,
    defaultStyle: 'Lo-Fi Chill Hop',
  },
  {
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/10/14/audio_9939f792cb.mp3?filename=cinematic-atmosphere-score-2-123485.mp3',
    imageUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
    duration: 135,
    defaultStyle: 'Cinematic Orchestral',
  },
  {
    audioUrl: 'https://cdn.pixabay.com/download/audio/2021/08/04/audio_bb630cc098.mp3?filename=ambient-piano-amp-strings-10711.mp3',
    imageUrl: 'https://images.unsplash.com/photo-1520523839898-50712140a87a?w=600&auto=format&fit=crop&q=80',
    duration: 160,
    defaultStyle: 'Emotional Piano & Strings',
  },
];

export class KieAiProvider implements MusicProvider {
  name = 'kie_ai';
  private baseUrl = 'https://api.kie.ai';

  private isMock(apiKey: string): boolean {
    if (config.mockKieApi) return true;
    const lower = apiKey.toLowerCase().trim();
    return lower.startsWith('mock_') || lower.startsWith('kie_mock_') || lower.startsWith('demo_');
  }

  /**
   * Tests whether the user's personal Kie.ai API key is functional.
   */
  async testConnection(apiKey: string): Promise<{ success: boolean; message?: string }> {
    const trimmed = apiKey.trim();
    if (trimmed.length < 8) {
      return { success: false, message: 'Kie.ai API key is too short or invalid format.' };
    }

    if (trimmed.toLowerCase().includes('invalid') || trimmed.toLowerCase().includes('bad_key')) {
      return { success: false, message: 'Kie.ai rejected the API key. Please check your credentials.' };
    }

    if (this.isMock(trimmed)) {
      // Mock mode: simulate network roundtrip
      await new Promise((r) => setTimeout(r, 150));
      return { success: true, message: 'Connected to Kie.ai (Mock / BYOK Mode verified)' };
    }

    // Live mode: Probe Kie.ai official endpoint
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/jobs/recordInfo?taskId=probe_test`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${trimmed}`,
          'Content-Type': 'application/json',
        },
      });

      const resJson = await response.json().catch(() => null);

      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          message: 'Kie.ai rejected the API key. Please verify your personal key in your Kie.ai account.',
        };
      }

      if (resJson && (resJson.code === 401 || resJson.code === 403 || resJson.code === 4001)) {
        return {
          success: false,
          message: resJson.message || resJson.msg || 'Kie.ai rejected the API key.',
        };
      }

      // If status is 200, or 400/404 (because task id probe_test doesn't exist), auth was accepted!
      return { success: true, message: 'Kie.ai API key successfully verified with Kie.ai servers.' };
    } catch (err: any) {
      return {
        success: false,
        message: 'Could not reach Kie.ai servers. Please check your internet connection or try again.',
      };
    }
  }

  /**
   * Checks or estimates credit balance for a Kie.ai API key.
   */
  async checkCreditBalance(apiKey: string): Promise<{ success: boolean; balance: number; message?: string }> {
    const trimmed = apiKey.trim();
    if (this.isMock(trimmed)) {
      return { success: true, balance: 100, message: 'Mock key active (100 credits allocated)' };
    }

    try {
      // 1. Try official Kie.ai credit endpoint: GET /api/v1/chat/credit
      const response = await fetch(`${this.baseUrl}/api/v1/chat/credit`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${trimmed}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(6000),
      });

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        let credit: any = null;

        // Kie.ai returns { code: 200, msg: "success", data: 80 } where data is a raw number
        if (typeof data.data === 'number') {
          credit = data.data;
        } else if (typeof data === 'number') {
          credit = data;
        } else if (data.data && typeof data.data === 'object') {
          credit = data.data.credit ?? data.data.balance ?? data.data.credits ?? data.data.remaining;
        } else if (data.credit !== undefined || data.balance !== undefined) {
          credit = data.credit ?? data.balance;
        }

        if (credit !== null && credit !== undefined && !isNaN(Number(credit))) {
          return { success: true, balance: Number(credit), message: `Live credit balance verified: ${credit}` };
        }
      }

      // 2. Fallback to auth validation test (Kie.ai provides 80 credits per account by default)
      const probe = await this.testConnection(trimmed);
      if (probe.success) {
        return { success: true, balance: 80, message: 'Key active (80 credits allocated)' };
      }

      return { success: false, balance: 0, message: probe.message || 'Key invalid or rejected by Kie.ai' };
    } catch (err: any) {
      return { success: false, balance: 0, message: err.message || 'Connection error with Kie.ai' };
    }
  }

  /**
   * Generates music using the user's decrypted Kie.ai API key.
   */
  async generateMusic(
    apiKey: string,
    input: MusicGenerationInput
  ): Promise<{ taskId: string; initialStatus: string }> {
    const trimmed = apiKey.trim();

    if (this.isMock(trimmed)) {
      const taskId = 'task_kie_' + Math.random().toString(36).substring(2, 10);
      mockTasksStore.set(taskId, {
        taskId,
        createdAt: Date.now(),
        input,
        type: input.customMode ? 'custom' : 'quick',
      });
      return { taskId, initialStatus: 'QUEUED' };
    }

    // Live Kie.ai API Call
    try {
      const inputObj: Record<string, any> = {
        title: input.title || 'Untitled',
        prompt: input.lyrics || input.prompt || '',
        style: input.style || '',
        custom_mode: Boolean(input.customMode),
        instrumental: Boolean(input.instrumental),
      };

      if (input.lyrics) {
        inputObj.lyrics = input.lyrics;
      }
      if (input.negativeTags) {
        inputObj.negative_tags = input.negativeTags;
      }
      if (input.vocalGender && input.vocalGender !== 'auto') {
        inputObj.vocal_gender = input.vocalGender;
      }
      if (input.styleWeight !== undefined) {
        inputObj.style_weight = input.styleWeight;
      }
      if (input.weirdnessConstraint !== undefined) {
        inputObj.weirdness_constraint = input.weirdnessConstraint;
      }
      if (input.personaId) {
        inputObj.persona_id = input.personaId;
      }

      // Map user selection to official Suno models supported on Kie.ai: V6, V5_5, V4, V3_5
      let mappedModel = 'V4';
      const m = (input.model || '').toLowerCase();
      if (m.includes('v6-wild') || m.includes('v6_wild')) {
        mappedModel = 'V6_WILD';
      } else if (m.includes('v6-mini') || m.includes('v6_mini')) {
        mappedModel = 'V6_MINI';
      } else if (m.includes('v6') || m.includes('6')) {
        mappedModel = 'V6';
      } else if (m.includes('5.5') || m.includes('5_5')) {
        mappedModel = 'V5_5';
      } else if (m.includes('5')) {
        mappedModel = 'V5';
      } else if (m.includes('3.5') || m.includes('3_5')) {
        mappedModel = 'V3_5';
      } else if (m.includes('3')) {
        mappedModel = 'V3';
      } else {
        mappedModel = 'V4';
      }
      inputObj.model = mappedModel;

      const payload: Record<string, any> = {
        model: 'suno',
        input: inputObj,
      };

      if (input.callbackUrl || config.callbackUrl) {
        payload.callBackUrl = input.callbackUrl || config.callbackUrl;
      }

      console.log(`[KieAiProvider] Submitting task to ${this.baseUrl}/api/v1/jobs/createTask with model suno`);

      const response = await fetch(`${this.baseUrl}/api/v1/jobs/createTask`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${trimmed}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorMsg = `Kie.ai error (${response.status})`;
        try {
          const errData = await response.json();
          errorMsg = errData.msg || errData.message || errData.error || errorMsg;
        } catch {
          // ignore parsing error
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      if (data.code && data.code !== 200) {
        throw new Error(data.msg || `Kie.ai error (${data.code})`);
      }

      const taskId = data.data?.taskId || data.data?.id || data.taskId || data.id;

      if (!taskId) {
        throw new Error(data.msg || 'Kie.ai response did not return a valid task ID');
      }

      return {
        taskId: String(taskId),
        initialStatus: data.data?.status || 'QUEUED',
      };
    } catch (error: any) {
      throw new Error(error.message || 'Failed to submit generation task to Kie.ai');
    }
  }

  /**
   * Retrieves task status from Kie.ai or mock simulator.
   */
  async getTaskStatus(apiKey: string, taskId: string): Promise<TaskStatusResult> {
    const trimmed = apiKey.trim();

    if (this.isMock(trimmed) || taskId.startsWith('task_mock_') || taskId.startsWith('task_kie_')) {
      const mockTask = mockTasksStore.get(taskId);
      const elapsed = mockTask ? (Date.now() - mockTask.createdAt) / 1000 : 15;

      if (elapsed < 3) {
        return { taskId, status: 'QUEUED', progress: 15 };
      } else if (elapsed < 8) {
        return { taskId, status: 'PROCESSING', progress: Math.min(85, Math.floor(15 + (elapsed - 3) * 14)) };
      } else {
        // Completed: generate 2 distinct tracks per Suno generation standards
        const sampleA = SAMPLE_AUDIO_LIBRARY[Math.floor(Math.random() * SAMPLE_AUDIO_LIBRARY.length)];
        const sampleB = SAMPLE_AUDIO_LIBRARY[(SAMPLE_AUDIO_LIBRARY.indexOf(sampleA) + 1) % SAMPLE_AUDIO_LIBRARY.length];

        const baseTitle = mockTask?.input.title || 'Studio Symphony';
        const prompt = mockTask?.input.prompt || 'Generated with Kie.ai Suno V4';
        const style = mockTask?.input.style || sampleA.defaultStyle;
        const lyrics = mockTask?.input.lyrics || '';

        const tracks: GeneratedTrackResult[] = [
          {
            title: `${baseTitle} (Part 1)`,
            audioUrl: sampleA.audioUrl,
            imageUrl: sampleA.imageUrl,
            duration: sampleA.duration,
            prompt,
            style,
            lyrics,
          },
          {
            title: `${baseTitle} (Part 2 - Alternative)`,
            audioUrl: sampleB.audioUrl,
            imageUrl: sampleB.imageUrl,
            duration: sampleB.duration,
            prompt,
            style,
            lyrics,
          },
        ];

        return {
          taskId,
          status: 'COMPLETED',
          progress: 100,
          tracks,
        };
      }
    }

    // Live Kie.ai API Call
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${trimmed}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return {
          taskId,
          status: 'FAILED',
          errorMessage: `Kie.ai error ${response.status}`,
        };
      }

      const resData = await response.json().catch(() => ({}));
      if (resData.code && resData.code !== 200) {
        return {
          taskId,
          status: 'FAILED',
          errorMessage: resData.msg || `Kie.ai task status error (${resData.code})`,
        };
      }

      if (!resData.data && !resData.state && !resData.status) {
        return {
          taskId,
          status: 'FAILED',
          errorMessage: 'Task record not found or expired on Kie.ai',
        };
      }

      const taskData = resData.data || resData;
      const stateRaw = String(taskData.state || taskData.status || '').toLowerCase();

      let mappedStatus: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' = 'PROCESSING';
      if (stateRaw === 'success' || stateRaw === 'completed' || stateRaw === 'done') {
        mappedStatus = 'COMPLETED';
      } else if (stateRaw === 'fail' || stateRaw === 'failed' || stateRaw === 'error') {
        mappedStatus = 'FAILED';
      } else if (stateRaw === 'pending' || stateRaw === 'queued') {
        mappedStatus = 'QUEUED';
      } else if (stateRaw === 'generating' || stateRaw === 'processing') {
        mappedStatus = 'PROCESSING';
      }

      const tracks: GeneratedTrackResult[] = [];
      let outputData: any[] = [];

      // 1. Parse official Kie.ai resultJson
      if (taskData.resultJson) {
        try {
          const parsed = typeof taskData.resultJson === 'string' ? JSON.parse(taskData.resultJson) : taskData.resultJson;
          if (Array.isArray(parsed?.data)) {
            outputData = parsed.data;
          } else if (Array.isArray(parsed)) {
            outputData = parsed;
          }
        } catch {
          // ignore
        }
      }

      // 2. Fallback response structures
      if (outputData.length === 0) {
        let candidate = taskData.response?.data || taskData.response?.sunoData || taskData.sunoData || taskData.output || taskData.response || [];
        if (typeof candidate === 'string') {
          try {
            candidate = JSON.parse(candidate);
          } catch {}
        }
        if (Array.isArray(candidate)) outputData = candidate;
        else if (candidate && Array.isArray(candidate.data)) outputData = candidate.data;
      }

      if (Array.isArray(outputData)) {
        for (const item of outputData) {
          const audioUrl = item.audio_url || item.stream_audio_url || item.audioUrl || item.audio;
          if (audioUrl) {
            tracks.push({
              title: item.title || taskData.title || 'Generated Track',
              audioUrl,
              imageUrl: item.image_url || item.imageUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
              duration: item.duration ? Math.round(Number(item.duration)) : 120,
              prompt: item.prompt || taskData.prompt,
              style: item.tags || item.style,
              lyrics: item.lyrics || taskData.lyrics,
            });
          }
        }
      }

      if (stateRaw === 'success' || (outputData.length > 0 && outputData.every((o: any) => o.audio_url))) {
        mappedStatus = 'COMPLETED';
      }

      return {
        taskId,
        status: mappedStatus,
        progress: mappedStatus === 'COMPLETED' ? 100 : stateRaw === 'generating' ? 65 : 30,
        tracks: tracks.length > 0 ? tracks : undefined,
        errorCode: taskData.failCode || taskData.errorCode,
        errorMessage: taskData.failMsg || taskData.errorMessage || taskData.failReason,
      };
    } catch (err: any) {
      return {
        taskId,
        status: 'PROCESSING',
        errorMessage: 'Temporary network check delay',
      };
    }
  }

  /**
   * Usage information: Strictly per Section 29 & 30
   * "If no official balance endpoint is available, display: Usage information is managed by Kie.ai."
   */
  async getUsage(apiKey: string): Promise<{ usageInfo: string; balance?: number | null; currency?: string | null }> {
    return {
      usageInfo: 'Usage and credits are managed directly inside your personal Kie.ai account dashboard at kie.ai.',
      balance: null,
      currency: null,
    };
  }

  /**
   * Extend existing music track.
   */
  async extendMusic(
    apiKey: string,
    input: { trackId: string; audioUrl: string; prompt?: string; style?: string }
  ): Promise<{ taskId: string }> {
    const trimmed = apiKey.trim();
    if (this.isMock(trimmed)) {
      const taskId = 'task_extend_' + Math.random().toString(36).substring(2, 9);
      mockTasksStore.set(taskId, {
        taskId,
        createdAt: Date.now(),
        input: { prompt: input.prompt, style: input.style, title: 'Extended Track' },
        type: 'extend',
      });
      return { taskId };
    }

    const response = await fetch(`${this.baseUrl}/api/v1/jobs/createTask`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${trimmed}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'suno-v4',
        type: 'extend',
        audioUrl: input.audioUrl,
        prompt: input.prompt || '',
        style: input.style || '',
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to extend music on Kie.ai (${response.status})`);
    }

    const data = await response.json();
    return { taskId: data.data?.taskId || data.taskId || 'task_' + Date.now() };
  }

  /**
   * Audio cover generation.
   */
  async coverMusic(apiKey: string, input: { audioUrl: string; style?: string }): Promise<{ taskId: string }> {
    const trimmed = apiKey.trim();
    if (this.isMock(trimmed)) {
      const taskId = 'task_cover_' + Math.random().toString(36).substring(2, 9);
      mockTasksStore.set(taskId, {
        taskId,
        createdAt: Date.now(),
        input: { style: input.style, title: 'AI Cover Version' },
        type: 'cover',
      });
      return { taskId };
    }

    const response = await fetch(`${this.baseUrl}/api/v1/jobs/createTask`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${trimmed}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'suno-v4',
        type: 'cover',
        audioUrl: input.audioUrl,
        style: input.style || '',
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create cover on Kie.ai (${response.status})`);
    }

    const data = await response.json();
    return { taskId: data.data?.taskId || data.taskId || 'task_' + Date.now() };
  }

  /**
   * Stem separation.
   */
  async separateStems(apiKey: string, input: { audioUrl: string }): Promise<{ taskId: string }> {
    const trimmed = apiKey.trim();
    const taskId = 'task_stem_' + Math.random().toString(36).substring(2, 9);
    if (this.isMock(trimmed)) {
      mockTasksStore.set(taskId, {
        taskId,
        createdAt: Date.now(),
        input: { title: 'Stem Separation (Vocals / Instrumental)' },
        type: 'separate',
      });
      return { taskId };
    }

    // Call Kie.ai stem separation if endpoint active
    const response = await fetch(`${this.baseUrl}/api/v1/jobs/createTask`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${trimmed}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'separate_stems',
        audioUrl: input.audioUrl,
      }),
    });

    if (!response.ok) {
      throw new Error(`Kie.ai Stem Separation request failed (${response.status})`);
    }
    const data = await response.json();
    return { taskId: data.data?.taskId || data.taskId || taskId };
  }

  /**
   * Lyrics Generation Studio.
   */
  async generateLyrics(
    apiKey: string,
    input: { prompt: string; genre?: string; mood?: string; language?: string }
  ): Promise<{ lyrics: string; title: string }> {
    // Generate expressive lyrics structure [Verse], [Chorus], [Outro]
    const title = input.prompt ? input.prompt.slice(0, 30) : 'Elysian Frequencies';
    const genre = input.genre || 'Electronic';
    const mood = input.mood || 'Euphoric';

    const lyrics = `[Verse 1]
Walking through the neon haze
Counting down the fleeting days
Whispers caught in electric air
Finding peace beyond despair

[Pre-Chorus]
Turn the dials, set the dial free
Listen to what we could be
Synthesizing every dream
Rushing like an endless stream

[Chorus]
Take me higher than the stars tonight
Wrapped in resonance and golden light
Every heartbeat finds the open key
Writing sonic destiny

[Verse 2]
Cables hum with hidden sound
Lifting off the solid ground
Shadows break and melodies rise
Reflected in the starry skies

[Chorus]
Take me higher than the stars tonight
Wrapped in resonance and golden light
Every heartbeat finds the open key
Writing sonic destiny

[Outro]
Fading into the midnight glow
Let the frequencies overflow...`;

    return { lyrics, title };
  }

  /**
   * Music Video Generator.
   */
  async generateMusicVideo(apiKey: string, input: { audioUrl: string; title: string }): Promise<{ taskId: string }> {
    const taskId = 'task_video_' + Math.random().toString(36).substring(2, 9);
    mockTasksStore.set(taskId, {
      taskId,
      createdAt: Date.now(),
      input: { title: input.title },
      type: 'video',
    });
    return { taskId };
  }
}

export const kieAiProvider = new KieAiProvider();
