import React from 'react';
import { Menu, KeyRound, Sparkles, CheckCircle2, AlertCircle, Coins, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface TopbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  openConnectModal: () => void;
  setIsMobileMenuOpen?: (open: boolean) => void;
}

const TAB_TITLES: Record<string, { title: string; subtitle: string }> = {
  dashboard: { title: 'Studio Dashboard', subtitle: 'Overview of your music workspace & quota credits' },
  create: { title: 'Create Music', subtitle: 'Generate studio-grade songs powered by Suno AI Engine' },
  library: { title: 'My Music Library', subtitle: 'Tracks generated exclusively for your account' },
  lyrics: { title: 'Lyrics Studio', subtitle: 'Write and structure verse, chorus, and vocal flows' },
  tools: { title: 'Music Tools', subtitle: 'Extend, transform, separate stems, and generate videos' },
  favorites: { title: 'Favorite Tracks', subtitle: 'Your starred music creations' },
  'kie-settings': { title: 'Engine API Settings', subtitle: 'Manage Studio AI Engine Key (Optional)' },
  settings: { title: 'Account Settings', subtitle: 'Manage your profile and studio preferences' },
  admin: { title: 'Admin Studio Control', subtitle: 'Multi-Key Pool aggregator, user credit distributor & security logs' },
};

export const Topbar: React.FC<TopbarProps> = ({
  currentTab,
  setCurrentTab,
  openConnectModal,
  setIsMobileMenuOpen,
}) => {
  const { user, kieConnection } = useAuth();
  const current = TAB_TITLES[currentTab] || { title: 'SUNOMAKER', subtitle: 'AI Music Production Studio' };

  const userCredits = user?.credits ?? 20;
  const isAdmin = user?.role === 'ADMIN';

  return (
    <header className="h-16 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center space-x-4">
        {setIsMobileMenuOpen && (
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="md:hidden p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div>
          <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            {current.title}
          </h1>
          <p className="text-xs text-zinc-400 hidden sm:block">{current.subtitle}</p>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        {/* User Studio Credits Counter */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-900/90 border border-amber-500/30 text-xs shadow-inner">
          <Coins className="w-4 h-4 text-amber-400" />
          <div className="flex items-baseline gap-1">
            <span className="font-extrabold text-amber-300 text-sm">{userCredits}</span>
            <span className="text-[11px] text-zinc-400 font-medium">Credits</span>
          </div>
          {isAdmin && (
            <span className="ml-1 px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 text-[9px] font-bold uppercase">
              ADMIN
            </span>
          )}
        </div>

        {/* BYOK / Pool Status Pill */}
        {isAdmin ? (
          <button
            onClick={() => setCurrentTab('admin')}
            className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-medium border bg-indigo-500/10 text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/20 transition cursor-pointer"
            title="Open Admin Key Pool & Credit Manager"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[11px] font-bold">Admin Key Pool Active</span>
          </button>
        ) : (
          <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-zinc-900 border border-zinc-800 text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-[11px]">Studio Server Active</span>
          </div>
        )}

        {/* Create Music Button */}
        {currentTab !== 'create' && (
          <button
            onClick={() => setCurrentTab('create')}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Create</span>
          </button>
        )}
      </div>
    </header>
  );
};

