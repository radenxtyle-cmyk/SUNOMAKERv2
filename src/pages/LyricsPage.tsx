import React, { useState, useEffect } from 'react';
import {
  FileText,
  Sparkles,
  Copy,
  Check,
  ArrowRight,
  Trash2,
  Loader2,
  Wand2,
} from 'lucide-react';
import { api } from '../services/api';
import { LyricsDraft } from '../types';

interface LyricsPageProps {
  onSendToCreate: (lyrics: string, title?: string) => void;
}

export const LyricsPage: React.FC<LyricsPageProps> = ({ onSendToCreate }) => {
  const [theme, setTheme] = useState('Late night drive in a cybernetic metropolis');
  const [genre, setGenre] = useState('Synthwave');
  const [mood, setMood] = useState('Melancholic');
  const [language, setLanguage] = useState('English');
  const [currentLyrics, setCurrentLyrics] = useState('');
  const [currentTitle, setCurrentTitle] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [drafts, setDrafts] = useState<LyricsDraft[]>([]);

  useEffect(() => {
    loadDrafts();
  }, []);

  const loadDrafts = async () => {
    try {
      const list = await api.getLyricsList();
      setDrafts(list || []);
      if (list && list.length > 0 && !currentLyrics) {
        setCurrentLyrics(list[0].lyrics);
        setCurrentTitle(list[0].title);
      }
    } catch (err) {
      console.error('Failed to load drafts:', err);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await api.generateLyrics({
        theme,
        genre,
        mood,
        language,
      });
      setCurrentLyrics(res.lyrics);
      setCurrentTitle(res.title);
      await loadDrafts();
    } catch (err) {
      alert('Failed to generate lyrics');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!currentLyrics) return;
    navigator.clipboard.writeText(currentLyrics);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeleteDraft = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.deleteLyrics(id);
      setDrafts((prev) => prev.filter((d) => d.id !== id));
      if (currentLyrics && drafts.find((d) => d.id === id)?.lyrics === currentLyrics) {
        setCurrentLyrics('');
        setCurrentTitle('');
      }
    } catch {
      alert('Failed to delete draft');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      <div>
        <h2 className="text-xl font-extrabold text-white">Lyrics Studio</h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          Write, generate, and structure verses and choruses with musical cadence
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Generator Controls */}
        <div className="lg:col-span-5 space-y-4 p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 shadow-xl">
          <div className="flex items-center space-x-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
            <Wand2 className="w-4 h-4" />
            <span>Lyrics Generator</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">Song Theme & Story</label>
            <textarea
              rows={3}
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="e.g. A solitary voyager discovering an ancient alien beacon in deep space..."
              className="w-full p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">Musical Genre</label>
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="Synthwave">Synthwave</option>
                <option value="Pop">Pop</option>
                <option value="Rock">Alternative Rock</option>
                <option value="R&B">R&B / Soul</option>
                <option value="Country">Acoustic Country</option>
                <option value="Metal">Heavy Metal</option>
                <option value="Lo-Fi">Lo-Fi Hip-Hop</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">Emotional Mood</label>
              <select
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="Melancholic">Melancholic</option>
                <option value="Euphoric">Euphoric</option>
                <option value="Romantic">Romantic</option>
                <option value="Energetic">Energetic</option>
                <option value="Dark">Dark & Haunting</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1">Language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="English">English</option>
              <option value="Spanish">Spanish</option>
              <option value="French">French</option>
              <option value="Japanese">Japanese</option>
              <option value="German">German</option>
            </select>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>{isGenerating ? 'Composing Lyrics...' : 'Generate Studio Lyrics'}</span>
          </button>

          {/* Saved Drafts List */}
          {drafts.length > 0 && (
            <div className="pt-4 border-t border-zinc-800 space-y-2">
              <h4 className="text-xs font-bold text-zinc-400">Saved Lyrics Drafts ({drafts.length})</h4>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {drafts.map((d) => (
                  <div
                    key={d.id}
                    onClick={() => {
                      setCurrentLyrics(d.lyrics);
                      setCurrentTitle(d.title);
                    }}
                    className={`p-2.5 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition ${
                      currentLyrics === d.lyrics
                        ? 'bg-indigo-950/40 border-indigo-500/50 text-indigo-200'
                        : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <div className="truncate mr-2">
                      <p className="font-semibold truncate">{d.title}</p>
                      <p className="text-[10px] text-zinc-500">{d.genre} • {d.mood}</p>
                    </div>
                    <button
                      onClick={(e) => handleDeleteDraft(d.id, e)}
                      className="text-zinc-500 hover:text-red-400 p-1 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Lyrics Editor & Canvas */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <input
                  type="text"
                  value={currentTitle}
                  onChange={(e) => setCurrentTitle(e.target.value)}
                  placeholder="Song Title..."
                  className="bg-transparent text-base font-extrabold text-white placeholder:text-zinc-600 focus:outline-none"
                />
                <span className="text-[11px] text-zinc-500 block">Edit or fine-tune before sending to production</span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCopy}
                  disabled={!currentLyrics}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition flex items-center gap-1.5 disabled:opacity-40"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>

                <button
                  onClick={() => onSendToCreate(currentLyrics, currentTitle)}
                  disabled={!currentLyrics}
                  className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-indigo-600/20 disabled:opacity-40"
                >
                  <span>Send to Create Music</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <textarea
              rows={16}
              value={currentLyrics}
              onChange={(e) => setCurrentLyrics(e.target.value)}
              placeholder="Generate lyrics with the studio tool or write your verses here...&#10;&#10;[Verse 1]&#10;...&#10;&#10;[Chorus]&#10;..."
              className="w-full p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 resize-none leading-relaxed"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
