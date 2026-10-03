import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Play,
  Pause,
  Download,
  Heart,
  Trash2,
  Share2,
  Copy,
  Check,
  Disc,
  Clock,
  Sparkles,
  Layers,
  Video,
  Scissors,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { api } from '../services/api';
import { Track } from '../types';
import { useAudioPlayer } from '../context/AudioPlayerContext';

interface SongDetailPageProps {
  trackId: string;
  onBack: () => void;
  onExtend: (track: Track) => void;
  onSeparate: (track: Track) => void;
}

export const SongDetailPage: React.FC<SongDetailPageProps> = ({
  trackId,
  onBack,
  onExtend,
  onSeparate,
}) => {
  const { currentTrack, isPlaying, playTrack, togglePlay, toggleFavorite, downloadTrack } = useAudioPlayer();

  const [track, setTrack] = useState<Track | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedLyrics, setCopiedLyrics] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadTrack();
  }, [trackId]);

  const loadTrack = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getTrack(trackId);
      setTrack(data);
    } catch (err: any) {
      setError(err.message || 'Could not load song details or unauthorized access.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-zinc-500 gap-3">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="text-xs">Loading studio record...</span>
      </div>
    );
  }

  if (error || !track) {
    return (
      <div className="p-8 max-w-xl mx-auto rounded-2xl bg-zinc-900/60 border border-zinc-800 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
        <h3 className="text-base font-bold text-white">Track Unavailable</h3>
        <p className="text-xs text-zinc-400">{error || 'Song record could not be found.'}</p>
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold"
        >
          Return to Library
        </button>
      </div>
    );
  }

  const isCurrent = currentTrack?.id === track.id;
  const isFav = Boolean(track.isFavorite);

  const handleToggleFavorite = async () => {
    if (!track) return;
    setTrack((prev) => (prev ? { ...prev, isFavorite: !prev.isFavorite } : null));
    try {
      const res = await toggleFavorite(track.id);
      setTrack((prev) => (prev ? { ...prev, isFavorite: res ? 1 : 0 } : null));
    } catch {
      setTrack((prev) => (prev ? { ...prev, isFavorite: !prev.isFavorite } : null));
    }
  };

  const handleCopyLyrics = () => {
    if (!track.lyrics) return;
    navigator.clipboard.writeText(track.lyrics);
    setCopiedLyrics(true);
    setTimeout(() => setCopiedLyrics(false), 2000);
  };

  const handleConfirmDelete = async () => {
    if (!track) return;
    setIsDeleting(true);
    try {
      await api.deleteTrack(track.id);
      onBack();
    } catch (err) {
      console.error('Failed to delete track:', err);
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-24">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center space-x-2 text-xs text-zinc-400 hover:text-white transition"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Library</span>
      </button>

      {/* Hero Track Card */}
      <div className="p-8 rounded-2xl bg-gradient-to-r from-zinc-900/90 via-zinc-900/60 to-zinc-950 border border-zinc-800/80 shadow-2xl flex flex-col md:flex-row gap-8 items-center md:items-start">
        {/* Cover Art */}
        <div className="relative w-48 h-48 sm:w-56 sm:h-56 rounded-2xl overflow-hidden bg-zinc-800 border border-zinc-700/60 shadow-2xl shrink-0 group">
          {track.imageUrl ? (
            <img src={track.imageUrl} alt={track.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-600">
              <Disc className="w-16 h-16" />
            </div>
          )}

          <button
            onClick={() => (isCurrent ? togglePlay() : playTrack(track))}
            className="absolute inset-0 bg-black/40 flex items-center justify-center text-white"
          >
            <div className="w-16 h-16 rounded-full bg-white text-zinc-950 flex items-center justify-center shadow-xl group-hover:scale-105 transition">
              {isCurrent && isPlaying ? (
                <Pause className="w-8 h-8 fill-current" />
              ) : (
                <Play className="w-8 h-8 fill-current ml-1" />
              )}
            </div>
          </button>
        </div>

        {/* Track Metadata */}
        <div className="space-y-4 flex-1 text-center md:text-left">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold uppercase">
                {track.model || 'suno-v4'}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 text-[10px] font-mono">
                {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">{track.title}</h1>
            <p className="text-sm text-zinc-400">{track.style || 'AI Generated Music'}</p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-2">
            <button
              onClick={() => (isCurrent ? togglePlay() : playTrack(track))}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition flex items-center gap-2"
            >
              {isCurrent && isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
              <span>{isCurrent && isPlaying ? 'Pause Audio' : 'Play Track'}</span>
            </button>

            <button
              onClick={() => downloadTrack(track)}
              className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold transition flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Download MP3</span>
            </button>

            <button
              onClick={handleToggleFavorite}
              className={`p-2.5 rounded-xl border transition cursor-pointer ${
                isFav
                  ? 'bg-rose-950/40 border-rose-500/40 text-rose-400'
                  : 'bg-zinc-800/80 border-zinc-700/80 text-zinc-400 hover:text-white'
              }`}
              title={isFav ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Heart className={`w-4 h-4 ${isFav ? 'fill-rose-500 text-rose-500' : ''}`} />
            </button>

            <button
              onClick={() => setShowDeleteModal(true)}
              className="p-2.5 rounded-xl bg-zinc-800/80 hover:bg-red-950/60 border border-zinc-700/80 hover:border-red-800 text-zinc-400 hover:text-red-400 transition cursor-pointer"
              title="Delete track"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Studio Quick Actions */}
          <div className="pt-4 border-t border-zinc-800 flex flex-wrap gap-2 justify-center md:justify-start text-xs">
            <button
              onClick={() => onExtend(track)}
              className="px-3 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-indigo-300 border border-indigo-500/20 font-medium flex items-center gap-1.5"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Extend Track</span>
            </button>

            <button
              onClick={() => onSeparate(track)}
              className="px-3 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-purple-300 border border-purple-500/20 font-medium flex items-center gap-1.5"
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>Separate Stems</span>
            </button>
          </div>
        </div>
      </div>

      {/* Lyrics & Prompt Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Lyrics Panel */}
        <div className="md:col-span-7 p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Track Lyrics & Flow</span>
            </h3>
            {track.lyrics && (
              <button
                onClick={handleCopyLyrics}
                className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 transition"
              >
                {copiedLyrics ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLyrics ? 'Copied!' : 'Copy Lyrics'}</span>
              </button>
            )}
          </div>

          {track.lyrics ? (
            <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800/80 text-xs font-mono text-zinc-300 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
              {track.lyrics}
            </div>
          ) : (
            <div className="p-8 text-center text-zinc-500 text-xs italic bg-zinc-950/40 rounded-xl border border-zinc-800/40">
              This track is an instrumental production or generated without custom lyrics.
            </div>
          )}
        </div>

        {/* Technical Generation Metadata */}
        <div className="md:col-span-5 p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-4 shadow-xl text-xs">
          <h3 className="text-sm font-bold text-white">Technical Metadata</h3>

          <div className="space-y-3">
            <div>
              <span className="text-zinc-500 font-semibold block mb-0.5">Generation Prompt</span>
              <p className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300 leading-relaxed font-sans">
                {track.prompt || 'Synthesized based on custom style tags.'}
              </p>
            </div>

            <div>
              <span className="text-zinc-500 font-semibold block mb-0.5">Style Directives</span>
              <p className="p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300 font-mono">
                {track.style || 'None specified'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <span className="text-zinc-500 font-semibold block mb-0.5">Engine Model</span>
                <span className="font-mono text-zinc-300">{track.model || 'suno-v4'}</span>
              </div>
              <div>
                <span className="text-zinc-500 font-semibold block mb-0.5">Recorded On</span>
                <span className="text-zinc-300">{new Date(track.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-zinc-800/60 text-[11px] text-zinc-500 space-y-1">
              <p>• Generated via SunoMaker Studio AI Engine.</p>
              <p>• Audio stream preserved in studio database.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Delete Music Track</h4>
                <p className="text-xs text-zinc-400 mt-0.5">Permanently delete this track?</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800/80 text-xs">
              <p className="font-semibold text-white truncate">{track.title}</p>
              <p className="text-[11px] text-zinc-400 truncate mt-0.5">{track.style || 'AI Composition'}</p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>{isDeleting ? 'Deleting...' : 'Delete Track'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
