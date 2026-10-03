import React, { useState, useEffect } from 'react';
import {
  Layers,
  Wrench,
  Scissors,
  Video,
  Music,
  Sparkles,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../services/api';
import { Track } from '../types';
import { useAuth } from '../context/AuthContext';

interface MusicToolsPageProps {
  initialSelectedTrack?: Track | null;
  openConnectModal: () => void;
  setCurrentTab: (tab: string) => void;
}

export const MusicToolsPage: React.FC<MusicToolsPageProps> = ({
  initialSelectedTrack,
  openConnectModal,
  setCurrentTab,
}) => {
  const { user, kieConnection } = useAuth();

  const [activeTool, setActiveTool] = useState<'extend' | 'cover' | 'separate' | 'video'>('extend');
  const [libraryTracks, setLibraryTracks] = useState<Track[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string>(initialSelectedTrack?.id || '');

  // Tool Specific Inputs
  const [extendPrompt, setExtendPrompt] = useState('Epic orchestral finale with rising choir');
  const [extendStyle, setExtendStyle] = useState('');
  const [coverAudioUrl, setCoverAudioUrl] = useState('');
  const [coverStyle, setCoverStyle] = useState('Acoustic folk ballad with fingerpicked guitar');
  const [separateAudioUrl, setSeparateAudioUrl] = useState('');
  const [videoTrackId, setVideoTrackId] = useState('');

  // Status & Progress
  const [isLoading, setIsLoading] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    api.getLibrary().then((res) => {
      setLibraryTracks(res.tracks || []);
      if (!selectedTrackId && res.tracks?.length > 0) {
        setSelectedTrackId(res.tracks[0].id);
        setCoverAudioUrl(res.tracks[0].audioUrl);
        setSeparateAudioUrl(res.tracks[0].audioUrl);
        setVideoTrackId(res.tracks[0].id);
      }
    });
  }, []);

  const handleRunTool = async () => {
    if (!kieConnection.connected) {
      if (user?.role === 'ADMIN') {
        openConnectModal();
      } else {
        setErrorMessage('Studio Key Pool belum aktif. Silakan hubungi Administrator.');
      }
      return;
    }

    setIsLoading(true);
    setResultMessage(null);
    setErrorMessage(null);

    try {
      if (activeTool === 'extend') {
        if (!selectedTrackId) throw new Error('Please select an existing track to extend.');
        const res = await api.extendMusic(selectedTrackId, extendPrompt, extendStyle);
        setResultMessage(`Extend task dispatched to Studio Engine (Task: ${res.taskId}). Check My Music library for status.`);
      } else if (activeTool === 'cover') {
        if (!coverAudioUrl.trim()) throw new Error('Please provide an audio URL to transform.');
        const res = await api.coverMusic(coverAudioUrl.trim(), coverStyle);
        setResultMessage(`AI Cover task submitted to Studio Engine (Task: ${res.taskId}).`);
      } else if (activeTool === 'separate') {
        if (!separateAudioUrl.trim()) throw new Error('Please provide an audio URL to separate.');
        const res = await api.separateStems(separateAudioUrl.trim());
        setResultMessage(`Stem separation submitted (Task: ${res.taskId}). Vocal & backing stems queued.`);
      } else if (activeTool === 'video') {
        if (!videoTrackId) throw new Error('Please select a track for music video rendering.');
        const res = await api.createMusicVideo(videoTrackId);
        setResultMessage(`Music video rendering queued on Studio Engine (Task: ${res.taskId}).`);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Tool execution failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <div>
        <h2 className="text-xl font-extrabold text-white">Music Production Tools</h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          Advanced audio transformations powered by SunoMaker Studio Engine
        </p>
      </div>

      {/* Tool Selector Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { id: 'extend', label: 'Extend Music', icon: Layers, desc: 'Continue track seamlessly' },
          { id: 'cover', label: 'AI Cover', icon: Sparkles, desc: 'Transform style & genre' },
          { id: 'separate', label: 'Stem Separation', icon: Scissors, desc: 'Isolate vocal & backings' },
          { id: 'video', label: 'Music Video', icon: Video, desc: 'Generate audio visualizer' },
        ].map((tool) => {
          const Icon = tool.icon;
          const isActive = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              onClick={() => {
                setActiveTool(tool.id as any);
                setResultMessage(null);
                setErrorMessage(null);
              }}
              className={`p-4 rounded-xl border text-left transition ${
                isActive
                  ? 'bg-indigo-950/40 border-indigo-500/60 shadow-lg shadow-indigo-500/10'
                  : 'bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700'
              }`}
            >
              <Icon className={`w-5 h-5 mb-2 ${isActive ? 'text-indigo-400' : 'text-zinc-400'}`} />
              <h4 className="text-xs font-bold text-white">{tool.label}</h4>
              <p className="text-[11px] text-zinc-400 mt-0.5">{tool.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Legal & Ownership notice */}
      <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-start gap-2.5 text-xs text-zinc-400">
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <span>
          <strong>Authorization Policy:</strong> Only upload or transform audio content you own or are legally authorized to process. Audio transformations use your studio credits.
        </span>
      </div>

      {/* Active Tool Configuration Card */}
      <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800/80 space-y-4 shadow-xl">
        {/* EXTEND MUSIC */}
        {activeTool === 'extend' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>Extend Track Continuation</span>
            </h3>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Select Source Track from Library</label>
              <select
                value={selectedTrackId}
                onChange={(e) => setSelectedTrackId(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                {libraryTracks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} ({t.style}) - {t.duration}s
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Continuation Prompt</label>
              <input
                type="text"
                value={extendPrompt}
                onChange={(e) => setExtendPrompt(e.target.value)}
                placeholder="e.g. Build into a guitar solo with double-time drums..."
                className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Optional Style Override</label>
              <input
                type="text"
                value={extendStyle}
                onChange={(e) => setExtendStyle(e.target.value)}
                placeholder="Leave blank to preserve original style"
                className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white"
              />
            </div>
          </div>
        )}

        {/* AI COVER */}
        {activeTool === 'cover' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>AI Audio Cover Transformation</span>
            </h3>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Source Audio Stream URL</label>
              <input
                type="text"
                value={coverAudioUrl}
                onChange={(e) => setCoverAudioUrl(e.target.value)}
                placeholder="https://... (MP3 / WAV URL)"
                className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Target Genre & Style</label>
              <input
                type="text"
                value={coverStyle}
                onChange={(e) => setCoverStyle(e.target.value)}
                placeholder="e.g. Acoustic Indie Folk, 95 BPM, Warm Vocals"
                className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white"
              />
            </div>
          </div>
        )}

        {/* STEM SEPARATION */}
        {activeTool === 'separate' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Scissors className="w-4 h-4 text-pink-400" />
              <span>Stem Separation (Vocals / Instrumental)</span>
            </h3>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Audio Track URL to Separate</label>
              <input
                type="text"
                value={separateAudioUrl}
                onChange={(e) => setSeparateAudioUrl(e.target.value)}
                placeholder="https://... (MP3 / WAV audio URL)"
                className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white"
              />
            </div>

            <p className="text-xs text-zinc-400">
              The neural separation model will isolate clean acapella vocal stems and backing instrumental accompaniment tracks.
            </p>
          </div>
        )}

        {/* MUSIC VIDEO */}
        {activeTool === 'video' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Video className="w-4 h-4 text-cyan-400" />
              <span>Music Video & Visualizer Generation</span>
            </h3>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Select Track</label>
              <select
                value={videoTrackId}
                onChange={(e) => setVideoTrackId(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white"
              >
                {libraryTracks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>

            <p className="text-xs text-zinc-400">
              Creates a synced visualizer video render from your track audio and album artwork via SunoMaker Studio Visualizer.
            </p>
          </div>
        )}

        {/* Result message */}
        {resultMessage && (
          <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{resultMessage}</span>
          </div>
        )}

        {/* Error message */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/40 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="pt-2 flex items-center justify-between">
          <span className="text-[11px] text-zinc-400">Requests use your SunoMaker Studio credits</span>
          <button
            onClick={handleRunTool}
            disabled={isLoading}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg transition flex items-center gap-2 disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>{isLoading ? 'Processing Request...' : 'Launch Studio Tool'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
