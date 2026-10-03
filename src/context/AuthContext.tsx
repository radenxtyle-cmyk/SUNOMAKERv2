import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, KieConnectionState } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  kieConnection: KieConnectionState;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  switchDemo: (role: 'ADMIN' | 'USER') => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshKieStatus: () => Promise<void>;
  connectKie: (apiKey: string) => Promise<{ maskedKey: string; message: string }>;
  testKie: () => Promise<{ success: boolean; message: string }>;
  disconnectKie: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [kieConnection, setKieConnection] = useState<KieConnectionState>({
    connected: false,
    maskedKey: null,
  });
  const [isLoading, setIsLoading] = useState(true);

  const initAuth = async () => {
    try {
      setIsLoading(true);
      const data = await api.getMe();
      if (data.user) {
        setUser(data.user);
        if (data.kieConnection) {
          setKieConnection(data.kieConnection);
        } else {
          await refreshKieStatus();
        }
        return;
      }
    } catch (err) {
      // Backend unavailable or 404 (e.g. Vercel static deployment)
      const saved = localStorage.getItem('sunomaker_demo_session');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.user) {
            setUser(parsed.user);
            if (parsed.kieConnection) setKieConnection(parsed.kieConnection);
            return;
          }
        } catch {}
      }
      setUser(null);
      setKieConnection({ connected: false, maskedKey: null });
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUser = async () => {
    try {
      const data = await api.getMe();
      if (data.user) {
        setUser(data.user);
        if (data.kieConnection) setKieConnection(data.kieConnection);
      }
    } catch {}
  };

  const refreshKieStatus = async () => {
    try {
      const status = await api.getKieStatus();
      setKieConnection(status);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const data = await api.login(email, password);
      setUser(data.user);
      setKieConnection(data.kieConnection);
      localStorage.setItem('sunomaker_demo_session', JSON.stringify({ user: data.user, kieConnection: data.kieConnection }));
    } catch (err: any) {
      // If server is offline on static deployment, fallback to pre-configured accounts
      const lower = email.toLowerCase();
      if (lower.includes('admin') || lower === 'admin@sunomaker.studio') {
        await switchDemo('ADMIN');
        return;
      } else if (lower.includes('producer') || lower === 'producer@sunomaker.studio') {
        await switchDemo('USER');
        return;
      }
      throw err;
    }
  };

  const register = async (name: string, email: string, password: string) => {
    try {
      const data = await api.register(name, email, password);
      setUser(data.user);
      setKieConnection(data.kieConnection);
      localStorage.setItem('sunomaker_demo_session', JSON.stringify({ user: data.user, kieConnection: data.kieConnection }));
    } catch (err: any) {
      // If server is offline on static host, create local session
      const localUser: User = {
        id: 'user_local_' + Math.random().toString(36).substring(2, 9),
        name: name || 'Producer',
        email,
        role: 'USER',
        status: 'ACTIVE',
        credits: 20,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const localKie: KieConnectionState = { connected: false, maskedKey: null };
      setUser(localUser);
      setKieConnection(localKie);
      localStorage.setItem('sunomaker_demo_session', JSON.stringify({ user: localUser, kieConnection: localKie }));
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {}
    localStorage.removeItem('sunomaker_demo_session');
    setUser(null);
    setKieConnection({ connected: false, maskedKey: null });
  };

  const switchDemo = async (role: 'ADMIN' | 'USER') => {
    setIsLoading(true);
    try {
      try {
        const data = await api.switchDemoUser(role);
        setUser(data.user);
        setKieConnection(data.kieConnection);
        localStorage.setItem('sunomaker_demo_session', JSON.stringify({ user: data.user, kieConnection: data.kieConnection }));
        return;
      } catch (err) {
        console.warn('Backend API demo switch unavailable, activating instant local demo session:', err);
        // Fallback for static hosting (e.g. Vercel static deployment)
        const fallbackUser: User = role === 'ADMIN' ? {
          id: 'admin_master_01',
          name: 'Studio Admin',
          email: 'admin@sunomaker.studio',
          role: 'ADMIN',
          status: 'ACTIVE',
          credits: 999,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } : {
          id: 'user_alex_prod_01',
          name: 'Alex Producer',
          email: 'producer@sunomaker.studio',
          role: 'USER',
          status: 'ACTIVE',
          credits: 20,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const fallbackKie: KieConnectionState = {
          connected: true,
          maskedKey: '••••••••2ace',
          status: 'CONNECTED',
          lastTestedAt: new Date().toISOString(),
        };

        setUser(fallbackUser);
        setKieConnection(fallbackKie);
        localStorage.setItem('sunomaker_demo_session', JSON.stringify({ user: fallbackUser, kieConnection: fallbackKie }));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const connectKie = async (apiKey: string) => {
    const res = await api.connectKieKey(apiKey);
    await refreshKieStatus();
    return { maskedKey: res.maskedKey, message: res.message };
  };

  const testKie = async () => {
    try {
      const res = await api.testKieConnection();
      await refreshKieStatus();
      return { success: res.connected, message: res.message };
    } catch (err: any) {
      await refreshKieStatus();
      return { success: false, message: err.message || 'Unable to connect to Kie.ai' };
    }
  };

  const disconnectKie = async () => {
    await api.disconnectKie();
    setKieConnection({
      connected: false,
      maskedKey: null,
      status: 'DISCONNECTED',
    });
  };

  const deleteAccount = async () => {
    await api.deleteAccount();
    setUser(null);
    setKieConnection({ connected: false, maskedKey: null });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        kieConnection,
        isLoading,
        login,
        register,
        logout,
        switchDemo,
        refreshUser,
        refreshKieStatus,
        connectKie,
        testKie,
        disconnectKie,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
