import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Sliders,
  Music,
  Mic,
  KeyRound,
  Play,
  Pause,
  Download,
  Heart,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Disc3,
  ExternalLink,
  Wand2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { api } from '../services/api';
import { Track } from '../types';

interface CreateMusicPageProps {
  openConnectModal: () => void;
  onSelectTrack: (trackId: string) => void;
  setCurrentTab: (tab: string) => void;
  initialLyrics?: string;
  initialPrompt?: string;
}

export const CreateMusicPage: React.FC<CreateMusicPageProps> = ({
  openConnectModal,
  onSelectTrack,
  setCurrentTab,
  initialLyrics = '',
  initialPrompt = '',
}) => {
  const { user, refreshUser, kieConnection } = useAuth();
  const { playTrack, currentTrack, isPlaying, togglePlay, toggleFavorite, downloadTrack } = useAudioPlayer();

  const userCredits = user?.credits ?? 20;
  const isAdmin = user?.role === 'ADMIN';

  const [mode, setMode] = useState<'quick' | 'custom'>('quick');

  // Quick Mode Form State
  const [quickIdea, setQuickIdea] = useState(initialPrompt || '');
  const [quickStyle, setQuickStyle] = useState('Cinematic');
  const [quickMood, setQuickMood] = useState('Emotional');
  const [quickLanguage, setQuickLanguage] = useState('English');
  const [quickInstrumental, setQuickInstrumental] = useState(false);

  // Custom Mode Form State
  const [customTitle, setCustomTitle] = useState('');
  const [customPrompt, setCustomPrompt] = useState(initialPrompt || '');
  const [customLyrics, setCustomLyrics] = useState(initialLyrics || '');
  const [customStyle, setCustomStyle] = useState('Synthwave, Retrowave, 124 BPM, Analog Synths');
  const [negativeTags, setNegativeTags] = useState('harsh, noisy, low bitrate, distorted');
  const [customInstrumental, setCustomInstrumental] = useState(false);
  const [vocalGender, setVocalGender] = useState<'m' | 'f' | 'auto'>('auto');
  const [model, setModel] = useState('suno-v4');
  const [duration, setDuration] = useState(120);

  // Advanced toggles
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [styleWeight, setStyleWeight] = useState(0.7);
  const [weirdnessConstraint, setWeirdnessConstraint] = useState(0.4);
  const [audioWeight, setAudioWeight] = useState(0.8);
  const [personaId, setPersonaId] = useState('');

  // Generation status state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStage, setGenerationStage] = useState<string>('');
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [generatedTracks, setGeneratedTracks] = useState<Track[]>([]);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const pollingTimerRef = useRef<any>(null);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    };
  }, []);

  const handleStartGeneration = async () => {
    // 1. Check user credit balance
    if (userCredits < 10 && !isAdmin) {
      setGenerationError(
        `Kredit studio Anda tidak mencukupi (Sisa: ${userCredits} kredit, Butuh: 10 kredit). Silakan hubungi Administrator untuk penambahan kredit studio.`
      );
      return;
    }

    setGenerationError(null);
    setGeneratedTracks([]);
    setIsGenerating(true);
    setGenerationStage('Preparing request & allocating studio credits...');

    try {
      const payload: any = {
        model,
        duration,
      };

      if (mode === 'quick') {
        payload.customMode = false;
        payload.title = quickIdea ? quickIdea.slice(0, 32) : 'Studio Symphony';
        payload.prompt = `${quickIdea}. Mood: ${quickMood}, Style: ${quickStyle}, Language: ${quickLanguage}`;
        payload.style = `${quickStyle}, ${quickMood}`;
        payload.instrumental = quickInstrumental;
      } else {
        payload.customMode = true;
        payload.title = customTitle.trim() || 'Custom Studio Track';
        payload.prompt = customPrompt.trim();
        payload.lyrics = customLyrics.trim();
        payload.style = customStyle.trim();
        payload.negativeTags = negativeTags.trim();
        payload.instrumental = customInstrumental;
        payload.vocalGender = vocalGender;
        payload.styleWeight = styleWeight;
        payload.weirdnessConstraint = weirdnessConstraint;
        payload.audioWeight = audioWeight;
        if (personaId.trim()) payload.personaId = personaId.trim();
      }

      setGenerationStage('Dispatching to Suno AI cluster via Studio Engine...');
      const res = await api.generateMusic(payload);

      // Refresh credits balance in header
      refreshUser();

      setActiveTaskId(res.taskId);
      setGenerationStage('Music generation in progress on Suno AI cluster...');

      // Start polling status
      pollTaskStatus(res.taskId);
    } catch (err: any) {
      setIsGenerating(false);
      setGenerationError(err.message || 'Music generation failed. Please check your studio status.');
    }
  };

  const pollTaskStatus = (taskId: string) => {
    let attempts = 0;
    const maxAttempts = 120; // Up to 6 minutes for Suno V4 high quality rendering

    pollingTimerRef.current = setInterval(async () => {
      attempts++;
      try {
        const statusRes = await api.getTaskStatus(taskId);

        if (statusRes.status === 'PROCESSING' || statusRes.status === 'QUEUED') {
          const calcProgress = Math.min(95, Math.floor(10 + (attempts / maxAttempts) * 85));
          const modelLabel = model.toUpperCase().replace('-', ' ');
          setGenerationStage(`Synthesizing ${modelLabel} Audio (${calcProgress}%)...`);
        } else if (statusRes.status === 'COMPLETED') {
          clearInterval(pollingTimerRef.current);
          setGenerationStage('Finalizing tracks and rendering audio streams...');
          setTimeout(() => {
            setIsGenerating(false);
            if (statusRes.tracks && statusRes.tracks.length > 0) {
              setGeneratedTracks(statusRes.tracks);
              // Auto-cue first track
              playTrack(statusRes.tracks[0]);
            }
          }, 800);
        } else if (statusRes.status === 'FAILED') {
          clearInterval(pollingTimerRef.current);
          setIsGenerating(false);
          setGenerationError(statusRes.errorMessage || 'Suno V4 generation task encountered an error on provider.');
        }

        if (attempts >= maxAttempts) {
          clearInterval(pollingTimerRef.current);
          setIsGenerating(false);
          setGenerationError('Pembuatan lagu memerlukan waktu lebih lama di server AI. Lagu akan otomatis muncul di menu My Music setelah selesai.');
        }
      } catch (err: any) {
        console.warn('Poll status error:', err.message);
      }
    }, 3000);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      {/* Mode Switcher Tabs */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div className="flex space-x-2 bg-zinc-900/80 p-1 rounded-xl border border-zinc-800">
          <button
            onClick={() => setMode('quick')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              mode === 'quick'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>QUICK MODE</span>
          </button>
          <button
            onClick={() => setMode('custom')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              mode === 'custom'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>CUSTOM MODE</span>
          </button>
        </div>

        <div className="flex items-center space-x-3 text-xs text-zinc-400">
          <span>Target Model:</span>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-indigo-500 font-semibold"
          >
            <option value="suno-v6">Suno V6 (Flagship 2026 - Ultra HD)</option>
            <option value="suno-v6-wild">Suno V6 Wild (Creative)</option>
            <option value="suno-v6-mini">Suno V6 Mini (Fast)</option>
            <option value="suno-v5.5">Suno V5.5 (Pro Vocal)</option>
            <option value="suno-v4">Suno V4 (Stable Fidelity)</option>
            <option value="suno-v3.5">Suno V3.5 (Classic)</option>
          </select>
        </div>
      </div>

      {/* Generation Form Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 space-y-5">
          {mode === 'quick' ? (
            /* QUICK MODE FORM */
            <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-4 shadow-xl">
              <div>
                <label className="block text-xs font-bold text-zinc-200 mb-1.5">
                  Music Idea / Song Concept
                </label>
                <textarea
                  rows={3}
                  value={quickIdea}
                  onChange={(e) => setQuickIdea(e.target.value)}
                  placeholder="e.g. Emotional cinematic piano song about losing someone under a raining neon sky..."
                  className="w-full p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 resize-none leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Genre / Style</label>
                  <select
                    value={quickStyle}
                    onChange={(e) => setQuickStyle(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Cinematic">Cinematic Soundtrack</option>
                    <option value="Synthwave">80s Synthwave / Retrowave</option>
                    <option value="Lo-Fi Chill">Lo-Fi Hip Hop / Chill</option>
                    <option value="Pop">Modern Pop Anthem</option>
                    <option value="Rock">Alternative Rock</option>
                    <option value="EDM">Electronic / Club Dance</option>
                    <option value="Ambient">Ambient & Meditative</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Mood</label>
                  <select
                    value={quickMood}
                    onChange={(e) => setQuickMood(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Emotional">Emotional & Melancholic</option>
                    <option value="Euphoric">Euphoric & Uplifting</option>
                    <option value="Energetic">High Energy & Driving</option>
                    <option value="Chill">Relaxed & Dreamy</option>
                    <option value="Dark">Dark & Mysterious</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Language</label>
                  <select
                    value={quickLanguage}
                    onChange={(e) => setQuickLanguage(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="English">English</option>
                    <option value="Spanish">Spanish</option>
                    <option value="French">French</option>
                    <option value="Japanese">Japanese</option>
                    <option value="German">German</option>
                  </select>
                </div>
              </div>

              {/* Instrumental Switch */}
              <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60">
                <div>
                  <span className="text-xs font-semibold text-zinc-200">Instrumental Only</span>
                  <p className="text-[11px] text-zinc-500">Generate without vocals</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={quickInstrumental}
                    onChange={(e) => setQuickInstrumental(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
            </div>
          ) : (
            /* CUSTOM MODE FORM */
            <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-4 shadow-xl">
              <div>
                <label className="block text-xs font-bold text-zinc-200 mb-1">Song Title</label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="e.g. Midnight Reverie in F Minor"
                  className="w-full p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-zinc-200">Custom Lyrics</label>
                  <button
                    type="button"
                    onClick={() => setCurrentTab('lyrics')}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
                  >
                    <Wand2 className="w-3 h-3" />
                    <span>Open Lyrics Studio</span>
                  </button>
                </div>
                <textarea
                  rows={5}
                  value={customLyrics}
                  onChange={(e) => setCustomLyrics(e.target.value)}
                  placeholder="[Verse 1]&#10;Words drifting in the neon glow...&#10;&#10;[Chorus]&#10;Take me to the sky tonight..."
                  className="w-full p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 resize-none leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-200 mb-1">Style & Instrumental Tags</label>
                <input
                  type="text"
                  value={customStyle}
                  onChange={(e) => setCustomStyle(e.target.value)}
                  placeholder="e.g. synthwave, 80s analog leads, deep bass, 120bpm, melancholic"
                  className="w-full p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Negative Tags (Exclude)</label>
                <input
                  type="text"
                  value={negativeTags}
                  onChange={(e) => setNegativeTags(e.target.value)}
                  placeholder="e.g. noisy, low bitrate, distorted, harsh vocals"
                  className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-zinc-400">AI Engine Model</label>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-bold uppercase">
                      {model.startsWith('suno-v6') ? 'Terbaru 2026' : model === 'suno-v5.5' ? 'Pro Vocal' : 'Stable HD'}
                    </span>
                  </div>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
                  >
                    <option value="suno-v6">Suno V6 (Flagship 2026 - Ultra HD & Lisensi Resmi)</option>
                    <option value="suno-v6-wild">Suno V6 Wild (Eksperimental & Aransemen Bebas)</option>
                    <option value="suno-v6-mini">Suno V6 Mini (Generasi Cepat / Low Latency)</option>
                    <option value="suno-v5.5">Suno V5.5 (Vocal Realism & Custom Voice Engine)</option>
                    <option value="suno-v4">Suno V4 (Suno Official - Vokal Jernih & Audio HD)</option>
                    <option value="suno-v3.5">Suno V3.5 (Suno V3.5 - Model Klasik)</option>
                  </select>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    {model.startsWith('suno-v6')
                      ? 'Model generasi tercanggih dengan struktur aransemen studio teranyar.'
                      : model === 'suno-v5.5'
                      ? 'Diverifikasi dengan peningkatan artikulasi vokal dan dukungan persona.'
                      : 'Komposisi stabil & dinamis hingga 4 menit.'}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Vocal Direction</label>
                  <select
                    value={vocalGender}
                    onChange={(e) => setVocalGender(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="auto">Auto / Duet</option>
                    <option value="m">Male Vocalist (Pria)</option>
                    <option value="f">Female Vocalist (Wanita)</option>
                  </select>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Karakter vokal penyanyi AI yang melantunkan lirik lagu.
                  </p>
                </div>
              </div>

              {/* Advanced Parameters Accordion */}
              <div className="pt-2 border-t border-zinc-800/60">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-xs text-zinc-400 hover:text-white flex items-center gap-1.5 transition font-medium"
                >
                  {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  <span>Advanced Parameters (Style Weight, Constraints, Persona)</span>
                </button>

                {showAdvanced && (
                  <div className="mt-3 p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-3">
                    <div>
                      <div className="flex justify-between text-xs text-zinc-400 mb-1">
                        <span>Style Weight: {styleWeight}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={styleWeight}
                        onChange={(e) => setStyleWeight(parseFloat(e.target.value))}
                        className="w-full accent-indigo-500"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs text-zinc-400 mb-1">
                        <span>Weirdness / Novelty Constraint: {weirdnessConstraint}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={weirdnessConstraint}
                        onChange={(e) => setWeirdnessConstraint(parseFloat(e.target.value))}
                        className="w-full accent-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">Artist / Voice Persona ID (Optional)</label>
                      <input
                        type="text"
                        value={personaId}
                        onChange={(e) => setPersonaId(e.target.value)}
                        placeholder="e.g. persona_894123"
                        className="w-full p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={handleStartGeneration}
            disabled={isGenerating}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-extrabold text-sm shadow-xl shadow-indigo-600/25 transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{generationStage}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>Generate Track with Suno V4</span>
                <span className="ml-1 px-2 py-0.5 rounded-lg bg-black/30 border border-white/20 text-amber-300 text-xs font-bold">
                  10 Credits
                </span>
              </>
            )}
          </button>

          {generationError && (
            <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/40 text-red-300 text-xs flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1.5">
                <p className="font-bold text-red-200">
                  {generationError.toLowerCase().includes('credit') || generationError.toLowerCase().includes('balance') || generationError.toLowerCase().includes('insufficient')
                    ? 'Saldo Provider Pool Tidak Mencukupi (Provider Insufficient Credits)'
                    : 'Gagal Memproses Pembuatan Lagu'}
                </p>
                <p className="text-zinc-300 leading-relaxed">{generationError}</p>

                {(generationError.toLowerCase().includes('credit') || generationError.toLowerCase().includes('balance') || generationError.toLowerCase().includes('insufficient')) && (
                  <p className="text-[11px] text-zinc-400 pt-1">
                    Catatan: Saldo kuota di server provider API Key Pool sedang kosong. Silakan lakukan Top Up saldo pada akun API Key resmi atau tambahkan key aktif di panel Admin Studio.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Studio Monitor & Generated Tracks */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800/90 shadow-xl space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center justify-between">
              <span>Studio Monitor</span>
              <span className="text-[11px] text-amber-300 font-extrabold flex items-center gap-1">
                🪙 {userCredits} Credits
              </span>
            </h4>

            {isGenerating ? (
              <div className="p-6 rounded-xl bg-zinc-950 border border-indigo-500/30 text-center space-y-3 animate-pulse">
                <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
                <h5 className="text-xs font-bold text-white">Synthesizing AI Studio Audio</h5>
                <p className="text-[11px] text-zinc-400 font-mono leading-tight">{generationStage}</p>
                {activeTaskId && (
                  <p className="text-[10px] text-zinc-500 font-mono">Task ID: {activeTaskId}</p>
                )}
              </div>
            ) : generatedTracks.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Generation Completed! (2 Tracks)</span>
                </div>

                {generatedTracks.map((track, idx) => {
                  const isCurrent = currentTrack?.id === track.id;
                  const isFav = Boolean(track.isFavorite);

                  return (
                    <div
                      key={track.id || idx}
                      className={`p-3.5 rounded-xl bg-zinc-950 border transition ${
                        isCurrent ? 'border-indigo-500' : 'border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-zinc-800 shrink-0">
                          {track.imageUrl && (
                            <img src={track.imageUrl} alt={track.title} className="w-full h-full object-cover" />
                          )}
                          <button
                            onClick={() => (isCurrent ? togglePlay() : playTrack(track))}
                            className="absolute inset-0 bg-black/40 flex items-center justify-center text-white"
                          >
                            {isCurrent && isPlaying ? (
                              <Pause className="w-4 h-4 fill-current" />
                            ) : (
                              <Play className="w-4 h-4 fill-current ml-0.5" />
                            )}
                          </button>
                        </div>

                        <div className="min-w-0 flex-1">
                          <h5 className="text-xs font-bold text-white truncate">{track.title}</h5>
                          <p className="text-[10px] text-zinc-400 truncate">{track.style}</p>
                          <span className="text-[9px] text-indigo-400 font-mono">
                            {track.duration}s • Track {idx + 1}
                          </span>
                        </div>

                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => toggleFavorite(track.id)}
                            className={`p-1.5 rounded-md ${isFav ? 'text-rose-500' : 'text-zinc-500 hover:text-white'}`}
                          >
                            <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-rose-500' : ''}`} />
                          </button>
                          <button
                            onClick={() => downloadTrack(track)}
                            className="p-1.5 rounded-md text-zinc-400 hover:text-white"
                            title="Download local copy"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-2 pt-2 border-t border-zinc-900 flex justify-end">
                        <button
                          onClick={() => onSelectTrack(track.id)}
                          className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold"
                        >
                          View Full Details →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 rounded-xl bg-zinc-950 border border-zinc-800/80 text-center space-y-2">
                <Music className="w-8 h-8 text-zinc-600 mx-auto" />
                <p className="text-xs font-medium text-zinc-400">Ready to compose</p>
                <p className="text-[11px] text-zinc-500">
                  Configure your musical idea and click generate to compose studio tracks.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
