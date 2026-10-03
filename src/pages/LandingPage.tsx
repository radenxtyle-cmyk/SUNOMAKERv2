import React, { useState } from 'react';
import {
  Radio,
  KeyRound,
  Shield,
  Sparkles,
  Music2,
  Lock,
  ArrowRight,
  CheckCircle2,
  Play,
  Layers,
  FileText,
  Sliders,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LandingPage: React.FC = () => {
  const { login, register, switchDemo } = useAuth();

  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleDemoSwitch = async (role: 'ADMIN' | 'USER') => {
    setError(null);
    setLoading(true);
    try {
      await switchDemo(role);
    } catch (err: any) {
      setError(err.message || 'Failed to enter demo studio');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegisterMode) {
        await register(name, email, password);
      } else {
        await login(email, password);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white selection:bg-indigo-500 selection:text-white">
      {/* Navbar */}
      <header className="border-b border-zinc-900/80 bg-zinc-950/70 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Radio className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-wider">SUNOMAKER</span>
              <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">PRO STUDIO</span>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-6 pt-16 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Pro Producer Suite Copy */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Professional AI Audio Production Suite</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-[1.1]">
              Create Studio Tracks. <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
                Powered by Suno V4 AI.
              </span>
            </h1>

            <p className="text-lg text-zinc-400 max-w-xl leading-relaxed">
              From quick concepts to fully arranged master tracks. Compose complete songs with expressive vocals, custom lyrics, and high-resolution stem separation directly in your browser.
            </p>

            {/* Core Value Props */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                <div className="flex items-center space-x-2 text-indigo-400 font-bold text-sm mb-1">
                  <Shield className="w-4 h-4" />
                  <span>Cloud Studio Infrastructure</span>
                </div>
                <p className="text-xs text-zinc-400 leading-normal">
                  High-speed cloud rendering pipeline delivering instantaneous track generation and seamless lossless audio playback.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                <div className="flex items-center space-x-2 text-purple-400 font-bold text-sm mb-1">
                  <Sliders className="w-4 h-4" />
                  <span>Suno V4 & Custom Studio</span>
                </div>
                <p className="text-xs text-zinc-400 leading-normal">
                  Quick Mode, Custom Mode, vocal gender direction, AI lyrics generator, stem separation, and audio covers.
                </p>
              </div>
            </div>

            {/* Commercial Ready / License */}
            <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex items-start gap-2.5 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Commercial Ready:</strong> Download lossless audio files ready for streaming platforms, content creation, and studio mastering.
              </span>
            </div>
          </div>

          {/* Right Column: Sign In / Register Card */}
          <div className="lg:col-span-5">
            <div className="p-8 rounded-2xl bg-zinc-900/90 border border-zinc-800/90 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white">
                    {isRegisterMode ? 'Create Studio Account' : 'Welcome to SUNOMAKER'}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {isRegisterMode ? 'Create your producer profile & start composing' : 'Enter your credentials to enter the studio'}
                  </p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Lock className="w-4 h-4" />
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-800/40 text-red-300 text-xs">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {isRegisterMode && (
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">Producer / Artist Name</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Jordan Vane"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="producer@sunomaker.studio"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
                >
                  {loading ? 'Entering Studio...' : isRegisterMode ? 'Register Account' : 'Sign In'}
                </button>
              </form>

              <div className="mt-5 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsRegisterMode(!isRegisterMode);
                    setError(null);
                  }}
                  className="text-xs text-zinc-400 hover:text-zinc-200 transition"
                >
                  {isRegisterMode ? 'Already have an account? Sign In' : "Don't have an account? Register here"}
                </button>
              </div>

              {/* Instant Demo Sandbox Access */}
              <div className="mt-6 pt-5 border-t border-zinc-800/80">
                <p className="text-[11px] text-center text-zinc-400 mb-3">Or explore immediately with pre-configured accounts:</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleDemoSwitch('USER')}
                    className="p-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-850 hover:border-zinc-700 border border-zinc-800 text-xs font-semibold text-zinc-200 flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    <Music2 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Alex Producer</span>
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleDemoSwitch('ADMIN')}
                    className="p-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-850 hover:border-zinc-700 border border-zinc-800 text-xs font-semibold text-zinc-200 flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    <Shield className="w-3.5 h-3.5 text-purple-400" />
                    <span>Studio Admin</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
