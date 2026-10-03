import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  KeyRound,
  Music,
  CheckCircle2,
  AlertCircle,
  Play,
  Pause,
  Heart,
  Clock,
  ArrowRight,
  TrendingUp,
  Disc3,
  Layers,
  Wrench,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { api } from '../services/api';
import { Track, Generation } from '../types';

interface DashboardProps {
  setCurrentTab: (tab: string) => void;
  openConnectModal: () => void;
  onSelectTrack: (trackId: string) => void;
}

export const DashboardPage: React.FC<DashboardProps> = ({
  setCurrentTab,
  openConnectModal,
  onSelectTrack,
}) => {
  const { user } = useAuth();
  const { currentTrack, isPlaying, playTrack, togglePlay, toggleFavorite } = useAudioPlayer();

  const [tracks, setTracks] = useState<Track[]>([]);
  const [pendingGens, setPendingGens] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);

  const userCredits = user?.credits ?? 20;

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const data = await api.getLibrary({ sort: 'newest' });
      setTracks(data.tracks || []);
      setPendingGens(data.pendingGenerations || []);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const completedCount = tracks.length;
  const favoritesCount = tracks.filter((t) => t.isFavorite).length;

  const handleToggleFavorite = async (trackId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, isFavorite: !t.isFavorite } : t))
    );
    try {
      const isFav = await toggleFavorite(trackId);
      setTracks((prev) =>
        prev.map((t) => (t.id === trackId ? { ...t, isFavorite: isFav ? 1 : 0 } : t))
      );
    } catch {
      setTracks((prev) =>
        prev.map((t) => (t.id === trackId ? { ...t, isFavorite: !t.isFavorite } : t))
      );
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Hero Studio Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-950/50 via-purple-950/30 to-zinc-950 border border-indigo-500/20 p-8 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Suno V4 Powered • Studio AI Music</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            Welcome back, {user?.name || 'Producer'}
          </h2>
          <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed">
            Create full-length studio tracks, cinematic themes, synthwave anthems, emotional ballads, or custom lyrics with high fidelity audio.
          </p>

          <div className="pt-2 flex flex-wrap gap-3">
            <button
              onClick={() => setCurrentTab('create')}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/20 transition flex items-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Create Music</span>
            </button>
            <button
              onClick={() => setCurrentTab('lyrics')}
              className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-semibold text-xs border border-zinc-700/60 transition flex items-center gap-2 cursor-pointer"
            >
              <Disc3 className="w-4 h-4 text-purple-400" />
              <span>Lyrics Studio</span>
            </button>
            <button
              onClick={() => setCurrentTab('library')}
              className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-semibold text-xs border border-zinc-700/60 transition flex items-center gap-2 cursor-pointer"
            >
              <Music className="w-4 h-4 text-indigo-400" />
              <span>My Library</span>
            </button>
          </div>
        </div>
      </div>

      {/* Studio Overview Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Studio Credits Card */}
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-amber-500/20 space-y-1">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Studio Credits</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-extrabold text-amber-300 flex items-center gap-2">
            <span>{userCredits}</span>
            <span className="text-xs text-zinc-400 font-normal">Credits</span>
          </div>
          <p className="text-[11px] text-zinc-400">Available for generation</p>
        </div>

        {/* Tracks Created */}
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-1">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Completed Tracks</span>
            <Music className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white">{completedCount}</div>
          <p className="text-[11px] text-zinc-400">Available in your library</p>
        </div>

        {/* Favorites */}
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-1">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Favorites</span>
            <Heart className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-white">{favoritesCount}</div>
          <p className="text-[11px] text-zinc-400">Starred creations</p>
        </div>

        {/* Active Tasks */}
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-1">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Active Generations</span>
            <Clock className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white">{pendingGens.length}</div>
          <p className="text-[11px] text-zinc-400">Processing in studio</p>
        </div>
      </div>

      {/* Recent Generations & Quick Player */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">Recent Studio Songs</h3>
            <p className="text-xs text-zinc-400">Your latest AI compositions</p>
          </div>
          <button
            onClick={() => setCurrentTab('library')}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {loading ? (
          <div className="py-12 flex items-center justify-center text-zinc-500">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span className="text-xs">Loading studio tracks...</span>
          </div>
        ) : tracks.length === 0 ? (
          <div className="p-8 rounded-2xl bg-zinc-900/40 border border-zinc-800 text-center space-y-3">
            <Music className="w-8 h-8 text-zinc-600 mx-auto" />
            <h4 className="text-sm font-semibold text-zinc-300">No tracks generated yet</h4>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              Start by clicking Create Music to generate your first song with SunoMaker AI!
            </p>
            <button
              onClick={() => setCurrentTab('create')}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
            >
              Open Studio
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tracks.slice(0, 6).map((track) => {
              const isCurrent = currentTrack?.id === track.id;
              const isFav = Boolean(track.isFavorite);

              return (
                <div
                  key={track.id}
                  className={`p-4 rounded-xl bg-zinc-900/70 border transition group flex flex-col justify-between ${
                    isCurrent ? 'border-indigo-500/60 shadow-lg shadow-indigo-500/10' : 'border-zinc-800/80 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-start space-x-3.5">
                    <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-zinc-800 shrink-0">
                      {track.imageUrl ? (
                        <img
                          src={track.imageUrl}
                          alt={track.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-500">
                          <Music className="w-6 h-6" />
                        </div>
                      )}
                      <button
                        onClick={() => (isCurrent ? togglePlay() : playTrack(track))}
                        className="absolute inset-0 bg-black/40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition"
                      >
                        {isCurrent && isPlaying ? (
                          <Pause className="w-5 h-5 fill-current" />
                        ) : (
                          <Play className="w-5 h-5 fill-current ml-0.5" />
                        )}
                      </button>
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4
                        onClick={() => onSelectTrack(track.id)}
                        className="text-xs font-bold text-white truncate hover:text-indigo-400 cursor-pointer"
                      >
                        {track.title}
                      </h4>
                      <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                        {track.style || 'Suno V4 Composition'}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-zinc-400 font-mono">
                        <span>{Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}</span>
                        <span>•</span>
                        <span className="text-indigo-400">{track.model || 'suno-v4'}</span>
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleToggleFavorite(track.id, e)}
                      className={`p-1.5 rounded-md transition cursor-pointer ${
                        isFav ? 'text-rose-500 hover:text-rose-400' : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                      title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-rose-500 text-rose-500' : ''}`} />
                    </button>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-zinc-800/60 flex items-center justify-between text-[11px]">
                    <span className="text-zinc-400">
                      {new Date(track.createdAt).toLocaleDateString()}
                    </span>
                    <button
                      onClick={() => onSelectTrack(track.id)}
                      className="text-indigo-400 hover:text-indigo-300 font-medium"
                    >
                      Open Details →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
