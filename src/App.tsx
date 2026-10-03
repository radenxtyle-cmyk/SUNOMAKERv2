import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AudioPlayerProvider } from './context/AudioPlayerContext';
import { Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { AudioPlayer } from './components/player/AudioPlayer';
import { ConnectKieModal } from './components/modals/ConnectKieModal';
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { CreateMusicPage } from './pages/CreateMusicPage';
import { LibraryPage } from './pages/LibraryPage';
import { SongDetailPage } from './pages/SongDetailPage';
import { LyricsPage } from './pages/LyricsPage';
import { MusicToolsPage } from './pages/MusicToolsPage';
import { KieSettingsPage } from './pages/KieSettingsPage';
import { ProfileSettingsPage } from './pages/ProfileSettingsPage';
import { AdminPage } from './pages/AdminPage';
import { Loader2, X } from 'lucide-react';
import { Track } from './types';

const MainApp: React.FC = () => {
  const { user, isLoading } = useAuth();

  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [initialLyricsForCreate, setInitialLyricsForCreate] = useState<string>('');
  const [initialPromptForCreate, setInitialPromptForCreate] = useState<string>('');
  const [toolSelectedTrack, setToolSelectedTrack] = useState<Track | null>(null);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-500 gap-3">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
        <p className="text-xs font-semibold tracking-wider uppercase text-zinc-400">Loading SUNOMAKER Studio...</p>
      </div>
    );
  }

  if (!user) {
    return <LandingPage />;
  }

  const handleSelectTrack = (trackId: string) => {
    setSelectedTrackId(trackId);
    setCurrentTab('song-detail');
  };

  const handleSendLyricsToCreate = (lyrics: string, title?: string) => {
    setInitialLyricsForCreate(lyrics);
    setInitialPromptForCreate(title || '');
    setCurrentTab('create');
  };

  const handleExtendFromSong = (track: Track) => {
    setToolSelectedTrack(track);
    setCurrentTab('tools');
  };

  const handleSeparateFromSong = (track: Track) => {
    setToolSelectedTrack(track);
    setCurrentTab('tools');
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-white overflow-hidden selection:bg-indigo-500 selection:text-white">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex">
        <Sidebar
          currentTab={currentTab}
          setCurrentTab={(tab) => {
            setCurrentTab(tab);
            setSelectedTrackId(null);
          }}
          openConnectModal={() => setIsConnectModalOpen(true)}
        />
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative z-10 w-72 flex flex-col bg-zinc-950 h-full">
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <Sidebar
              currentTab={currentTab}
              setCurrentTab={(tab) => {
                setCurrentTab(tab);
                setSelectedTrackId(null);
                setIsMobileMenuOpen(false);
              }}
              openConnectModal={() => {
                setIsConnectModalOpen(true);
                setIsMobileMenuOpen(false);
              }}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar
          currentTab={currentTab}
          setCurrentTab={(tab) => {
            setCurrentTab(tab);
            setSelectedTrackId(null);
          }}
          openConnectModal={() => setIsConnectModalOpen(true)}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
        />

        <main className="flex-1 overflow-y-auto px-6 py-6 pb-32 custom-scrollbar">
          {currentTab === 'dashboard' && (
            <DashboardPage
              setCurrentTab={(tab) => {
                setCurrentTab(tab);
                setSelectedTrackId(null);
              }}
              openConnectModal={() => setIsConnectModalOpen(true)}
              onSelectTrack={handleSelectTrack}
            />
          )}

          {currentTab === 'create' && (
            <CreateMusicPage
              openConnectModal={() => setIsConnectModalOpen(true)}
              onSelectTrack={handleSelectTrack}
              setCurrentTab={setCurrentTab}
              initialLyrics={initialLyricsForCreate}
              initialPrompt={initialPromptForCreate}
            />
          )}

          {currentTab === 'library' && (
            <LibraryPage
              onSelectTrack={handleSelectTrack}
              setCurrentTab={setCurrentTab}
              filterFavoriteOnly={false}
            />
          )}

          {currentTab === 'favorites' && (
            <LibraryPage
              onSelectTrack={handleSelectTrack}
              setCurrentTab={setCurrentTab}
              filterFavoriteOnly={true}
            />
          )}

          {currentTab === 'song-detail' && selectedTrackId && (
            <SongDetailPage
              trackId={selectedTrackId}
              onBack={() => setCurrentTab('library')}
              onExtend={handleExtendFromSong}
              onSeparate={handleSeparateFromSong}
            />
          )}

          {currentTab === 'lyrics' && (
            <LyricsPage onSendToCreate={handleSendLyricsToCreate} />
          )}

          {currentTab === 'tools' && (
            <MusicToolsPage
              initialSelectedTrack={toolSelectedTrack}
              openConnectModal={() => setIsConnectModalOpen(true)}
              setCurrentTab={setCurrentTab}
            />
          )}

          {currentTab === 'kie-settings' && <KieSettingsPage />}

          {currentTab === 'settings' && (
            <ProfileSettingsPage setCurrentTab={setCurrentTab} />
          )}

          {currentTab === 'admin' && user?.role === 'ADMIN' && <AdminPage />}
        </main>
      </div>

      {/* Global Persistent Bottom Audio Player */}
      <AudioPlayer />

      {/* Connect Kie.ai BYOK Modal */}
      <ConnectKieModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
      />
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <AudioPlayerProvider>
        <MainApp />
      </AudioPlayerProvider>
    </AuthProvider>
  );
}

export default App;
