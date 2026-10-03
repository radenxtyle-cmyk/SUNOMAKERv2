import React, { useState } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Heart,
  Download,
  Music,
  Info,
  Maximize2,
} from 'lucide-react';
import { useAudioPlayer } from '../../context/AudioPlayerContext';

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export const AudioPlayer: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
    toggleFavorite,
    downloadTrack,
  } = useAudioPlayer();

  const [showDownloadWarning, setShowDownloadWarning] = useState(false);

  if (!currentTrack) return null;

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const isFav = Boolean(currentTrack.isFavorite);

  const handleDownload = () => {
    downloadTrack(currentTrack);
    setShowDownloadWarning(true);
    setTimeout(() => setShowDownloadWarning(false), 6000);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800/80 px-4 py-3 sm:px-6 shadow-2xl">
      {/* Download Alert Toast if triggered */}
      {showDownloadWarning && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-zinc-900 border border-amber-500/40 text-amber-200 text-xs px-4 py-2 rounded-lg shadow-xl flex items-center gap-2 animate-bounce">
          <Info className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Download started! Keep a local copy because provider-hosted files may expire.</span>
        </div>
      )}

      {/* Progress Bar (Scrubber) */}
      <div className="absolute -top-1 left-0 right-0 h-2 group cursor-pointer">
        <div className="w-full h-1 bg-zinc-800 group-hover:h-2 transition-all relative">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 relative"
            style={{ width: `${progressPercent}%` }}
          >
            <div className="opacity-0 group-hover:opacity-100 absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md -mr-1.5" />
          </div>
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={(e) => seek(Number(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>
      </div>

      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Track Info */}
        <div className="flex items-center space-x-3 min-w-0 w-1/4 sm:w-1/3">
          <div className="w-12 h-12 rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800 shrink-0 relative group">
            {currentTrack.imageUrl ? (
              <img
                src={currentTrack.imageUrl}
                alt={currentTrack.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-400">
                <Music className="w-6 h-6" />
              </div>
            )}
            {/* Animated Equalizer visualizer overlay while playing */}
            {isPlaying && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-0.5 px-2">
                <span className="w-1 bg-indigo-400 animate-pulse h-4" />
                <span className="w-1 bg-purple-400 animate-pulse h-6" style={{ animationDelay: '150ms' }} />
                <span className="w-1 bg-pink-400 animate-pulse h-3" style={{ animationDelay: '300ms' }} />
                <span className="w-1 bg-indigo-400 animate-pulse h-5" style={{ animationDelay: '200ms' }} />
              </div>
            )}
          </div>

          <div className="truncate">
            <h4 className="text-sm font-bold text-white truncate">{currentTrack.title}</h4>
            <p className="text-xs text-zinc-400 truncate">
              {currentTrack.style || 'AI Generated Music'}
            </p>
          </div>

          <button
            onClick={() => toggleFavorite(currentTrack.id)}
            className={`p-1.5 rounded-md transition shrink-0 hidden sm:block ${
              isFav ? 'text-rose-500 hover:text-rose-400' : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title={isFav ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Heart className={`w-4 h-4 ${isFav ? 'fill-rose-500' : ''}`} />
          </button>
        </div>

        {/* Center Controls & Time */}
        <div className="flex flex-col items-center justify-center flex-1 max-w-md">
          <div className="flex items-center space-x-4">
            <button
              onClick={togglePlay}
              className="w-10 h-10 rounded-full bg-white hover:bg-zinc-200 text-zinc-950 flex items-center justify-center shadow-lg transition active:scale-95"
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
            </button>
          </div>
          <div className="flex items-center space-x-2 text-[11px] font-mono text-zinc-400 mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>/</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Right Tools & Volume */}
        <div className="flex items-center justify-end space-x-3 w-1/4 sm:w-1/3">
          <button
            onClick={handleDownload}
            className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-900 transition flex items-center gap-1.5 text-xs"
            title="Download track"
          >
            <Download className="w-4 h-4" />
            <span className="hidden md:inline">Download</span>
          </button>

          <div className="hidden sm:flex items-center space-x-2">
            <button
              onClick={toggleMute}
              className="text-zinc-400 hover:text-white p-1"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-zinc-500" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-20 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
