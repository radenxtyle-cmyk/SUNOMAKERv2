import React from 'react';
import {
  Music,
  PlusCircle,
  Disc,
  FileText,
  Wrench,
  Heart,
  Settings,
  KeyRound,
  ShieldAlert,
  LogOut,
  Radio,
  ExternalLink,
  ChevronRight,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  openConnectModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, setCurrentTab, openConnectModal }) => {
  const { user, logout, switchDemo } = useAuth();

  const userCredits = user?.credits ?? 20;
  const isAdmin = user?.role === 'ADMIN';

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Disc },
    { id: 'create', label: 'Create Music', icon: PlusCircle, badge: 'Studio' },
    { id: 'library', label: 'My Music', icon: Music },
    { id: 'lyrics', label: 'Lyrics Studio', icon: FileText },
    { id: 'tools', label: 'Music Tools', icon: Wrench },
    { id: 'favorites', label: 'Favorites', icon: Heart },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  if (isAdmin) {
    navItems.push({ id: 'admin', label: 'Admin Studio', icon: ShieldAlert });
  }

  return (
    <aside className="w-64 bg-zinc-950 border-r border-zinc-900/80 flex flex-col h-screen select-none shrink-0 z-30">
      {/* Brand Header */}
      <div className="p-5 border-b border-zinc-900/90 flex items-center justify-between">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setCurrentTab('dashboard')}>
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Radio className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-extrabold text-base tracking-wider text-white">SUNOMAKER</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">V2</span>
            </div>
            <p className="text-[11px] text-zinc-400 font-medium">AI Music Production Studio</p>
          </div>
        </div>
      </div>

      {/* Studio Credits Quota Card */}
      <div className="p-3.5 mx-3 my-3 rounded-2xl bg-gradient-to-b from-zinc-900/90 to-zinc-950 border border-zinc-800/80 shadow-md">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-zinc-400 font-medium flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Studio Quota
          </span>
          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
            Active
          </span>
        </div>

        <div className="mt-2 flex items-center justify-between bg-zinc-950/90 p-2.5 rounded-xl border border-zinc-800/60">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-zinc-400">Available Balance</p>
              <p className="text-sm font-extrabold text-amber-300">{userCredits} Credits</p>
            </div>
          </div>
        </div>

        {isAdmin ? (
          <button
            onClick={() => setCurrentTab('admin')}
            className="mt-2.5 w-full py-1.5 px-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer"
          >
            <span>Admin Control Panel</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        ) : (
          <div className="mt-2 text-center text-[10px] text-zinc-500">
            Powered by Suno V4 High-Definition Engine
          </div>
        )}
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto py-2 custom-scrollbar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition ${
                isActive
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/60'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-zinc-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Quick Demo Switcher & Account Footer */}
      <div className="p-3 border-t border-zinc-900/80 bg-zinc-950/60 space-y-2">
        <div className="flex items-center justify-between text-[11px] text-zinc-400 px-1">
          <span>Quick Switch Role</span>
          <div className="flex gap-1.5">
            <button
              onClick={() => switchDemo('USER')}
              className={`px-1.5 py-0.5 rounded text-[10px] ${
                user?.role === 'USER' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Switch to Music Producer (User)"
            >
              Producer
            </button>
            <button
              onClick={() => switchDemo('ADMIN')}
              className={`px-1.5 py-0.5 rounded text-[10px] ${
                user?.role === 'ADMIN' ? 'bg-indigo-900/60 text-indigo-300 font-bold' : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Switch to Studio Admin"
            >
              Admin
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/60 border border-zinc-800/60">
          <div className="flex items-center space-x-2.5 truncate">
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="truncate">
              <p className="text-xs font-semibold text-zinc-200 truncate">{user?.name}</p>
              <p className="text-[10px] text-zinc-400 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="p-1.5 text-zinc-400 hover:text-red-400 rounded-md transition"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
