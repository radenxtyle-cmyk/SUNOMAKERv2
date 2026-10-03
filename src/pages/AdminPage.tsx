import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Users,
  Music,
  CheckCircle2,
  XCircle,
  KeyRound,
  Lock,
  Activity,
  UserX,
  UserCheck,
  Loader2,
  FileText,
  Search,
  Plus,
  RefreshCw,
  Trash2,
  Coins,
  Layers,
  Sparkles,
  AlertTriangle,
  Server,
  Zap,
} from 'lucide-react';
import { api } from '../services/api';
import { AdminStats, AdminUser, Generation, AuditLogItem, AdminPoolSummary, AdminPoolKeyItem } from '../types';

export const AdminPage: React.FC = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [keyPool, setKeyPool] = useState<AdminPoolSummary | null>(null);

  const [activeTab, setActiveTab] = useState<'pool' | 'users' | 'generations' | 'logs'>('pool');
  const [loading, setLoading] = useState(true);
  const [searchUser, setSearchUser] = useState('');

  // Key Pool Modals & Action States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [isSyncingPool, setIsSyncingPool] = useState(false);
  const [testingKeyId, setTestingKeyId] = useState<string | null>(null);

  // User Credit Distributor States
  const [creditModalUser, setCreditModalUser] = useState<AdminUser | null>(null);
  const [creditAmount, setCreditAmount] = useState<number>(20);
  const [creditAction, setCreditAction] = useState<'add' | 'set' | 'deduct'>('add');
  const [creditReason, setCreditReason] = useState<string>('Admin Studio Bonus');
  const [showDistributeModal, setShowDistributeModal] = useState(false);
  const [distributeAmount, setDistributeAmount] = useState<number>(20);
  const [distributeReason, setDistributeReason] = useState<string>('Studio Promotion / Welcome Quota');

  // User Deletion In-App Modal State
  const [userToDelete, setUserToDelete] = useState<AdminUser | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Form states
  const [singleLabel, setSingleLabel] = useState('');
  const [singleKey, setSingleKey] = useState('');
  const [singlePriority, setSinglePriority] = useState(1);
  const [bulkText, setBulkText] = useState('');
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [bulkResult, setBulkResult] = useState<{ added: number; errors: string[] } | null>(null);

  useEffect(() => {
    loadAdminData();

    // Auto-sync real live balance from Kie.ai in background every 45s
    const timer = setInterval(() => {
      api.syncAllAdminPoolKeys().then((res) => {
        setKeyPool(res);
      }).catch(() => {});
    }, 45000);

    return () => clearInterval(timer);
  }, []);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [statsData, usersData, gensData, logsData, poolData] = await Promise.all([
        api.getAdminStats().catch(() => null),
        api.getAdminUsers().catch(() => []),
        api.getAdminGenerations().catch(() => []),
        api.getAdminAuditLogs().catch(() => []),
        api.getAdminKeyPool().catch(() => null),
      ]);
      setStats(statsData);
      setUsers(usersData || []);
      setGenerations(gensData || []);
      setAuditLogs(logsData || []);
      setKeyPool(poolData);

      // Trigger automatic live balance verification against Kie.ai on initial load
      if (poolData && poolData.keys && poolData.keys.length > 0) {
        api.syncAllAdminPoolKeys().then((live) => {
          setKeyPool(live);
        }).catch(() => {});
      }
    } catch (err) {
      console.error('Failed to load admin telemetry:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncPool = async () => {
    setIsSyncingPool(true);
    try {
      const res = await api.syncAllAdminPoolKeys();
      setKeyPool(res);
    } catch (err: any) {
      alert(err.message || 'Failed to sync key pool');
    } finally {
      setIsSyncingPool(false);
    }
  };

  const handleTestKey = async (id: string) => {
    setTestingKeyId(id);
    try {
      const updated = await api.testAdminPoolKey(id);
      setKeyPool((prev) => {
        if (!prev) return null;
        const newKeys = prev.keys.map((k) => (k.id === id ? updated : k));
        const totalCredits = newKeys
          .filter((k) => k.status === 'ACTIVE')
          .reduce((sum, k) => sum + (k.balance > 0 ? k.balance : 0), 0);
        return {
          ...prev,
          keys: newKeys,
          activeKeys: newKeys.filter((k) => k.status === 'ACTIVE').length,
          totalCreditsAccumulated: Math.round(totalCredits * 100) / 100,
        };
      });
    } catch (err: any) {
      alert(err.message || 'Key test failed');
    } finally {
      setTestingKeyId(null);
    }
  };

  const handleToggleKeyStatus = async (keyItem: AdminPoolKeyItem) => {
    const nextStatus = keyItem.status === 'DISABLED' ? 'ACTIVE' : 'DISABLED';
    try {
      await api.updateAdminPoolKey(keyItem.id, { status: nextStatus });
      setKeyPool((prev) => {
        if (!prev) return null;
        const newKeys = prev.keys.map((k) => (k.id === keyItem.id ? { ...k, status: nextStatus as any } : k));
        return {
          ...prev,
          keys: newKeys,
          activeKeys: newKeys.filter((k) => k.status === 'ACTIVE').length,
        };
      });
    } catch {
      alert('Failed to update status');
    }
  };

  const handleDeleteKey = async (id: string, label: string) => {
    if (!confirm(`Remove "${label}" from Admin Key Pool?`)) return;
    try {
      await api.deleteAdminPoolKey(id);
      setKeyPool((prev) => {
        if (!prev) return null;
        const newKeys = prev.keys.filter((k) => k.id !== id);
        return {
          ...prev,
          keys: newKeys,
          totalKeys: newKeys.length,
          activeKeys: newKeys.filter((k) => k.status === 'ACTIVE').length,
        };
      });
    } catch {
      alert('Failed to delete key');
    }
  };

  const handleAddSingleKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleKey.trim()) {
      setFormError('Please enter a valid Kie.ai API key');
      return;
    }

    setModalSubmitting(true);
    setFormError(null);
    try {
      const added = await api.addAdminPoolKey({
        label: singleLabel.trim(),
        apiKey: singleKey.trim(),
        priority: singlePriority,
      });

      setShowAddModal(false);
      setSingleKey('');
      setSingleLabel('');
      setSinglePriority(1);

      // Refresh pool summary
      const updatedSummary = await api.getAdminKeyPool();
      setKeyPool(updatedSummary);
    } catch (err: any) {
      setFormError(err.message || 'Failed to add key to pool');
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleAddBulkKeys = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkText.trim()) {
      setFormError('Please enter at least one key');
      return;
    }

    setModalSubmitting(true);
    setFormError(null);
    setBulkResult(null);

    try {
      const res = await api.addAdminPoolBulkKeys(bulkText);
      setBulkResult(res);
      if (res.added > 0) {
        setBulkText('');
        const updatedSummary = await api.getAdminKeyPool();
        setKeyPool(updatedSummary);
      }
    } catch (err: any) {
      setFormError(err.message || 'Bulk import failed');
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleQuickAddCredits = async (user: AdminUser, amount: number) => {
    try {
      const res = await api.updateUserCredits(user.id, { amount, action: 'add', reason: `Quick +${amount} credits` });
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, credits: res.credits } : u))
      );
    } catch (err: any) {
      alert(err.message || 'Failed to add credits');
    }
  };

  const handleUpdateCreditsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creditModalUser) return;
    setModalSubmitting(true);
    setFormError(null);
    try {
      const res = await api.updateUserCredits(creditModalUser.id, {
        amount: Number(creditAmount),
        action: creditAction,
        reason: creditReason,
      });
      setUsers((prev) =>
        prev.map((u) => (u.id === creditModalUser.id ? { ...u, credits: res.credits } : u))
      );
      setCreditModalUser(null);
    } catch (err: any) {
      setFormError(err.message || 'Failed to update credits');
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleBulkDistributeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalSubmitting(true);
    setFormError(null);
    try {
      await api.distributeCredits({
        amount: Number(distributeAmount),
        reason: distributeReason,
      });
      setShowDistributeModal(false);
      // Reload users data
      const updatedUsers = await api.getAdminUsers();
      setUsers(updatedUsers);
    } catch (err: any) {
      setFormError(err.message || 'Bulk distribution failed');
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleToggleUserStatus = async (user: AdminUser) => {
    const nextStatus = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await api.updateAdminUser(user.id, { status: nextStatus });
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, status: nextStatus } : u))
      );
    } catch (err: any) {
      console.error('Failed to update user status:', err);
    }
  };

  const handleOpenDeleteModal = (user: AdminUser) => {
    setDeleteError(null);
    setUserToDelete(user);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeletingUser(true);
    setDeleteError(null);

    try {
      await api.deleteAdminUser(userToDelete.id);
      setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));
      if (stats) {
        setStats({ ...stats, totalUsers: Math.max(0, stats.totalUsers - 1) });
      }
      setUserToDelete(null);
    } catch (err: any) {
      setDeleteError(err.message || 'Gagal menghapus user');
    } finally {
      setIsDeletingUser(false);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchUser.toLowerCase()) ||
      u.email.toLowerCase().includes(searchUser.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24">
      {/* Admin Header with Privacy Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-extrabold text-white">Admin Studio Control</h2>
            <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-bold uppercase">
              Administrator Only
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Multi-Key Pool aggregator, studio quota management, and user controls.
          </p>
        </div>

        <div className="px-3.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center space-x-2 text-xs text-zinc-400">
          <Lock className="w-3.5 h-3.5 text-emerald-400" />
          <span>AES-256 Vault: All keys encrypted & protected from regular users</span>
        </div>
      </div>

      {/* KPI Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
            <span className="text-[11px] text-zinc-400 font-medium">Total Users</span>
            <div className="text-2xl font-bold text-white mt-1">{stats.totalUsers}</div>
          </div>
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
            <span className="text-[11px] text-zinc-400 font-medium">Connected BYOK</span>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{stats.connectedKieUsers}</div>
          </div>
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
            <span className="text-[11px] text-zinc-400 font-medium">Admin Pool Keys</span>
            <div className="text-2xl font-bold text-indigo-400 mt-1">{keyPool?.totalKeys || 0}</div>
          </div>
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
            <span className="text-[11px] text-zinc-400 font-medium">Accumulated Credits</span>
            <div className="text-2xl font-bold text-amber-400 mt-1">{keyPool?.totalCreditsAccumulated || 0}</div>
          </div>
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
            <span className="text-[11px] text-zinc-400 font-medium">Generations</span>
            <div className="text-2xl font-bold text-white mt-1">{stats.totalGenerations}</div>
          </div>
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
            <span className="text-[11px] text-zinc-400 font-medium">Success Rate</span>
            <div className="text-2xl font-bold text-emerald-400 mt-1">
              {stats.totalGenerations > 0
                ? `${Math.round((stats.successfulGenerations / stats.totalGenerations) * 100)}%`
                : '100%'}
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-zinc-800 overflow-x-auto">
        <button
          onClick={() => setActiveTab('pool')}
          className={`px-4 py-2.5 text-xs font-bold transition border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'pool'
              ? 'border-indigo-500 text-indigo-300'
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          <Coins className="w-3.5 h-3.5 text-amber-400" />
          <span>Multi-Key Pool & Credits ({keyPool?.totalKeys || 0})</span>
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2.5 text-xs font-bold transition border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'users'
              ? 'border-indigo-500 text-indigo-300'
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          <Users className="w-3.5 h-3.5 text-indigo-400" />
          <span>Studio Users ({users.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('generations')}
          className={`px-4 py-2.5 text-xs font-bold transition border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'generations'
              ? 'border-indigo-500 text-indigo-300'
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          <Music className="w-3.5 h-3.5 text-purple-400" />
          <span>Recent Generations ({generations.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2.5 text-xs font-bold transition border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'logs'
              ? 'border-indigo-500 text-indigo-300'
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          <FileText className="w-3.5 h-3.5 text-emerald-400" />
          <span>Security Audit Logs</span>
        </button>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center text-zinc-500">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : (
        <>
          {/* ==================================================== */}
          {/* MULTI-KEY POOL & CREDIT ACCUMULATOR (ADMIN EXCLUSIVE) */}
          {/* ==================================================== */}
          {activeTab === 'pool' && (
            <div className="space-y-6">
              {/* Aggregated Credit Pool Banner */}
              <div className="relative overflow-hidden p-6 rounded-2xl bg-gradient-to-br from-indigo-950/60 via-purple-950/30 to-zinc-950 border border-indigo-500/30 shadow-2xl">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                  <Coins className="w-48 h-48 text-indigo-400" />
                </div>

                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="space-y-2 max-w-xl">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-extrabold tracking-wider uppercase flex items-center gap-1.5">
                        <Zap className="w-3 h-3 text-amber-400" />
                        Virtual Credit Pool
                      </span>
                      <span className="text-xs text-zinc-400">• Smart Auto-Failover Active</span>
                    </div>

                    <h3 className="text-2xl font-black text-white tracking-tight">
                      Total Accumulated Pool Credits
                    </h3>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      Gabungkan banyak API Key Kie.ai dari berbagai akun Anda. Sistem akan mengakumulasikan total saldo kredit secara terpusat dan memutar (*auto-rotate*) key otomatis saat membuat lagu tanpa jeda.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    {/* Big Counter */}
                    <div className="px-6 py-4 rounded-xl bg-zinc-900/90 border border-indigo-500/40 shadow-inner text-center sm:text-right">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                        Available Pool Credits
                      </span>
                      <div className="text-3xl font-black text-amber-400 flex items-center justify-center sm:justify-end gap-1.5 mt-0.5">
                        <Coins className="w-6 h-6 text-amber-400" />
                        <span>{keyPool?.totalCreditsAccumulated || 0}</span>
                      </div>
                      <span className="text-[10px] text-emerald-400 font-semibold">
                        {keyPool?.activeKeys || 0} Healthy / {keyPool?.totalKeys || 0} Total Keys
                      </span>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-col gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => setShowAddModal(true)}
                        className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add API Key</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowBulkModal(true)}
                        className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-200 flex items-center justify-center gap-2 transition cursor-pointer"
                      >
                        <Layers className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Bulk Import Keys</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Pool Status Indicators Footer */}
                <div className="mt-6 pt-4 border-t border-indigo-500/20 flex flex-wrap items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-4 text-zinc-400">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      Load Balancer: <strong>Priority & Least-Used</strong>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Server className="w-3.5 h-3.5 text-purple-400" />
                      Total Pool Jobs: <strong>{keyPool?.totalGenerations || 0}</strong>
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleSyncPool}
                    disabled={isSyncingPool}
                    className="px-3 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-[11px] font-semibold text-indigo-300 flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isSyncingPool ? 'animate-spin' : ''}`} />
                    <span>{isSyncingPool ? 'Syncing Balances...' : 'Sync All Balances'}</span>
                  </button>
                </div>
              </div>

              {/* Pool Keys Table & Live Status */}
              <div className="space-y-3">
                {/* Low Balance Warning Banner */}
                {keyPool?.keys.some((k) => k.status === 'EXHAUSTED' || k.balance < 10) && (
                  <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 flex items-start gap-3 text-xs shadow-lg">
                    <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h5 className="font-bold text-red-200 flex items-center gap-2">
                        <span>Peringatan Saldo Akun Kie.ai Habis / Kritis</span>
                        <span className="px-1.5 py-0.2 rounded bg-red-500/20 text-red-300 text-[10px] font-extrabold uppercase">
                          Perlu Perhatian
                        </span>
                      </h5>
                      <p className="text-zinc-300 leading-relaxed">
                        Akun berikut memiliki sisa saldo di bawah 10 kredit:{' '}
                        <strong className="text-amber-300">
                          {keyPool.keys
                            .filter((k) => k.status === 'EXHAUSTED' || k.balance < 10)
                            .map((k) => `${k.label} (${k.balance} Credits)`)
                            .join(', ')}
                        </strong>.
                        Satu lagu Suno V4 membutuhkan 10 kredit. Sistem studio otomatis melewati akun ini dan hanya memakai akun dengan saldo cukup. Silakan top up akun terkait atau tambahkan key baru.
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-indigo-400" />
                    <span>Configured Pool Keys ({keyPool?.keys.length || 0})</span>
                  </h4>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1.5 text-zinc-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Auto Live-Sync Aktif</span>
                    </span>
                    <span className="text-zinc-500">
                      Keys are AES-256 encrypted. Only last 4 digits displayed.
                    </span>
                  </div>
                </div>

                {(!keyPool?.keys || keyPool.keys.length === 0) ? (
                  <div className="py-16 text-center space-y-3 bg-zinc-900/30 border border-zinc-800/80 rounded-2xl">
                    <KeyRound className="w-10 h-10 text-zinc-600 mx-auto" />
                    <h3 className="text-sm font-bold text-zinc-300">No API Keys in Pool Yet</h3>
                    <p className="text-xs text-zinc-500 max-w-md mx-auto">
                      Masukkan satu atau banyak API Key dari berbagai akun Kie.ai Anda untuk mulai mengumpulkan saldo kredit terpusat.
                    </p>
                    <div className="pt-2 flex justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => setShowAddModal(true)}
                        className="px-4 py-2 rounded-xl bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-500 transition cursor-pointer"
                      >
                        + Add First Key
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowBulkModal(true)}
                        className="px-4 py-2 rounded-xl bg-zinc-800 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 transition cursor-pointer"
                      >
                        Bulk Import Keys
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/60 shadow-xl">
                    <table className="w-full text-left text-xs text-zinc-300">
                      <thead className="bg-zinc-950/80 text-[11px] uppercase tracking-wider text-zinc-400 border-b border-zinc-800">
                        <tr>
                          <th className="p-3.5">Key Label & Account</th>
                          <th className="p-3.5">Masked Key</th>
                          <th className="p-3.5">Credits Balance (Live)</th>
                          <th className="p-3.5">Status</th>
                          <th className="p-3.5">Priority</th>
                          <th className="p-3.5">Generations</th>
                          <th className="p-3.5">Last Checked</th>
                          <th className="p-3.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60">
                        {keyPool.keys.map((k) => {
                          const isExhaustedOrLow = k.status === 'EXHAUSTED' || k.balance < 10;
                          return (
                            <tr
                              key={k.id}
                              className={`transition ${
                                isExhaustedOrLow ? 'bg-red-950/20 hover:bg-red-950/30' : 'hover:bg-zinc-900/80'
                              }`}
                            >
                              <td className="p-3.5">
                                <div className="flex items-center gap-2">
                                  <p className="font-bold text-white">{k.label}</p>
                                  {isExhaustedOrLow && (
                                    <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30 text-[9px] font-extrabold uppercase">
                                      Perlu Top Up
                                    </span>
                                  )}
                                </div>
                                {k.lastError && (
                                  <p className="text-[10px] text-rose-400 flex items-center gap-1 mt-0.5">
                                    <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                                    <span className="truncate max-w-xs">{k.lastError}</span>
                                  </p>
                                )}
                              </td>
                              <td className="p-3.5 font-mono text-[11px] text-zinc-400">{k.maskedKey}</td>
                              <td className="p-3.5">
                                <div className="space-y-0.5">
                                  <span
                                    className={`font-bold flex items-center gap-1 text-sm ${
                                      k.balance <= 0
                                        ? 'text-red-400'
                                        : k.balance < 10
                                        ? 'text-amber-400'
                                        : 'text-emerald-400'
                                    }`}
                                  >
                                    <Coins className="w-3.5 h-3.5" />
                                    <span>{k.balance} Credits</span>
                                  </span>
                                  <p className="text-[10px] text-zinc-400">
                                    {k.balance >= 10 ? (
                                      <span className="text-emerald-400/90 font-medium">✓ Siap Generate</span>
                                    ) : (
                                      <span className="text-red-400 font-semibold">⚠️ Kurang untuk Suno V4</span>
                                    )}
                                  </p>
                                </div>
                              </td>
                              <td className="p-3.5">
                                <span
                                  className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase inline-flex items-center gap-1.5 ${
                                    k.status === 'ACTIVE' && k.balance >= 10
                                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                      : k.status === 'EXHAUSTED' || k.balance < 10
                                      ? 'bg-red-500/20 text-red-300 border border-red-500/40 shadow-sm shadow-red-500/10'
                                      : k.status === 'DISABLED'
                                      ? 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                                      : 'bg-red-500/10 text-red-400 border border-red-500/30'
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      k.status === 'ACTIVE' && k.balance >= 10
                                        ? 'bg-emerald-400 animate-pulse'
                                        : 'bg-red-400'
                                    }`}
                                  />
                                  <span>
                                    {k.status === 'ACTIVE' && k.balance < 10
                                      ? 'LOW CREDITS'
                                      : k.status === 'EXHAUSTED'
                                      ? 'HABIS'
                                      : k.status}
                                  </span>
                                </span>
                              </td>
                              <td className="p-3.5 font-mono text-[11px] text-zinc-300">
                                <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-bold">
                                  P{k.priority}
                                </span>
                              </td>
                              <td className="p-3.5 font-bold text-white">{k.totalGenerations}</td>
                              <td className="p-3.5 text-zinc-400 text-[11px]">
                                {k.lastTestedAt ? (
                                  <span title={new Date(k.lastTestedAt).toLocaleString()}>
                                    {new Date(k.lastTestedAt).toLocaleTimeString()}
                                  </span>
                                ) : (
                                  'Never'
                                )}
                              </td>
                              <td className="p-3.5 text-right space-x-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleTestKey(k.id)}
                                  disabled={testingKeyId === k.id}
                                  className="px-2.5 py-1 rounded-lg bg-indigo-950/60 text-indigo-300 hover:bg-indigo-900 border border-indigo-500/30 transition text-[11px] font-bold cursor-pointer disabled:opacity-50"
                                  title="Cek saldo live ke Kie.ai sekarang"
                                >
                                  {testingKeyId === k.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin inline" />
                                  ) : (
                                    'Sync Live'
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleKeyStatus(k)}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                                    k.status === 'DISABLED'
                                      ? 'bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60 border border-emerald-500/30'
                                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                                  }`}
                                >
                                  {k.status === 'DISABLED' ? 'Enable' : 'Disable'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteKey(k.id, k.label)}
                                  className="p-1 rounded-lg hover:bg-red-950/50 text-zinc-500 hover:text-red-400 transition cursor-pointer"
                                  title="Delete key from pool"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* USERS TABLE */}
          {/* ==================================================== */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative w-72">
                  <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchUser}
                    onChange={(e) => setSearchUser(e.target.value)}
                    placeholder="Search users..."
                    className="w-full pl-9 pr-3.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setShowDistributeModal(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition cursor-pointer"
                >
                  <Coins className="w-3.5 h-3.5 text-amber-200" />
                  <span>Distribute Credits to All Users</span>
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/60 shadow-xl">
                <table className="w-full text-left text-xs text-zinc-300">
                  <thead className="bg-zinc-950/80 text-[11px] uppercase tracking-wider text-zinc-400 border-b border-zinc-800">
                    <tr>
                      <th className="p-3.5">User</th>
                      <th className="p-3.5">Role</th>
                      <th className="p-3.5">Account Status</th>
                      <th className="p-3.5">User Credits</th>
                      <th className="p-3.5">Generations</th>
                      <th className="p-3.5 text-right">Quick Top Up / Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-zinc-900/80 transition">
                        <td className="p-3.5">
                          <p className="font-bold text-white">{u.name}</p>
                          <p className="text-[10px] text-zinc-500">{u.email}</p>
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              u.role === 'ADMIN'
                                ? 'bg-purple-500/20 text-purple-300'
                                : 'bg-zinc-800 text-zinc-400'
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              u.status === 'ACTIVE'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-red-500/10 text-red-400'
                            }`}
                          >
                            {u.status}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <div className="flex items-center gap-1.5">
                            <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 font-extrabold flex items-center gap-1">
                              <Coins className="w-3.5 h-3.5 text-amber-400" />
                              {u.credits ?? 20} Credits
                            </span>
                          </div>
                        </td>
                        <td className="p-3.5 font-bold text-white">{u.generationCount}</td>
                        <td className="p-3.5 text-right space-x-1.5">
                          {/* Quick Top Up Buttons */}
                          <button
                            type="button"
                            onClick={() => handleQuickAddCredits(u, 10)}
                            className="px-2 py-1 rounded-lg bg-indigo-950/40 hover:bg-indigo-900/60 text-indigo-300 border border-indigo-500/30 text-[11px] font-bold transition cursor-pointer"
                            title="Add +10 Credits instantly"
                          >
                            +10
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickAddCredits(u, 50)}
                            className="px-2 py-1 rounded-lg bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border border-amber-500/30 text-[11px] font-bold transition cursor-pointer"
                            title="Add +50 Credits instantly"
                          >
                            +50
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCreditModalUser(u);
                              setCreditAmount(20);
                              setCreditAction('add');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-semibold transition cursor-pointer"
                            title="Open detailed credit editor"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleToggleUserStatus(u)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                              u.status === 'ACTIVE'
                                ? 'bg-amber-950/40 text-amber-300 hover:bg-amber-900/60'
                                : 'bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60'
                            }`}
                          >
                            {u.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                          </button>
                          {u.role !== 'ADMIN' && (
                            <button
                              type="button"
                              onClick={() => handleOpenDeleteModal(u)}
                              className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 hover:text-red-200 border border-red-500/30 transition cursor-pointer"
                              title={`Hapus permanen akun ${u.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* GENERATIONS TABLE */}
          {/* ==================================================== */}
          {activeTab === 'generations' && (
            <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/60 shadow-xl">
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="bg-zinc-950/80 text-[11px] uppercase tracking-wider text-zinc-400 border-b border-zinc-800">
                  <tr>
                    <th className="p-3.5">Title</th>
                    <th className="p-3.5">User</th>
                    <th className="p-3.5">Task ID</th>
                    <th className="p-3.5">Model</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Created At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {generations.map((g) => (
                    <tr key={g.id} className="hover:bg-zinc-900/80">
                      <td className="p-3.5 font-semibold text-white">{g.title}</td>
                      <td className="p-3.5 text-zinc-400">{(g as any).userName || g.userId}</td>
                      <td className="p-3.5 font-mono text-[11px] text-zinc-500">{g.taskId}</td>
                      <td className="p-3.5 font-mono text-[11px] text-indigo-400">{g.model}</td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            g.status === 'COMPLETED'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : g.status === 'FAILED'
                              ? 'bg-red-500/10 text-red-400'
                              : 'bg-indigo-500/10 text-indigo-400'
                          }`}
                        >
                          {g.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-zinc-500">{new Date(g.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ==================================================== */}
          {/* AUDIT LOGS TABLE */}
          {/* ==================================================== */}
          {activeTab === 'logs' && (
            <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/60 shadow-xl">
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="bg-zinc-950/80 text-[11px] uppercase tracking-wider text-zinc-400 border-b border-zinc-800">
                  <tr>
                    <th className="p-3.5">Timestamp</th>
                    <th className="p-3.5">User</th>
                    <th className="p-3.5">Action Event</th>
                    <th className="p-3.5">Details (No Keys)</th>
                    <th className="p-3.5">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-zinc-900/80">
                      <td className="p-3.5 text-zinc-400 font-mono text-[11px]">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="p-3.5 font-medium text-white">{log.userName || log.userId || 'System'}</td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 font-mono text-[10px]">
                          {log.action}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-[11px] text-zinc-400 max-w-xs truncate">
                        {log.details || '—'}
                      </td>
                      <td className="p-3.5 text-zinc-500 font-mono text-[11px]">{log.ipAddress || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ==================================================== */}
      {/* MODAL: ADD SINGLE KEY */}
      {/* ==================================================== */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md p-6 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-indigo-400" />
                <span>Add Key to Admin Pool</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddSingleKey} className="space-y-3.5">
              {formError && (
                <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-red-300">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Account Label / Name
                </label>
                <input
                  type="text"
                  value={singleLabel}
                  onChange={(e) => setSingleLabel(e.target.value)}
                  placeholder="e.g. Kie Account #1 (Pro)"
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Kie.ai API Key *
                </label>
                <input
                  type="password"
                  value={singleKey}
                  onChange={(e) => setSingleKey(e.target.value)}
                  placeholder="Paste Kie.ai API key..."
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                  required
                />
                <p className="text-[10px] text-zinc-500 mt-1">
                  Key will be encrypted with AES-256 and tested for balance automatically.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Priority (1 = Standard, 5 = Highest Priority)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={singlePriority}
                  onChange={(e) => setSinglePriority(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {modalSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>{modalSubmitting ? 'Verifying...' : 'Save to Pool'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: BULK IMPORT KEYS */}
      {/* ==================================================== */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg p-6 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                <span>Bulk Import Kie.ai Keys</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddBulkKeys} className="space-y-3.5">
              {formError && (
                <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-red-300">
                  {formError}
                </div>
              )}

              {bulkResult && (
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-300 space-y-1">
                  <p className="font-bold">✓ Successfully imported {bulkResult.added} key(s)!</p>
                  {bulkResult.errors.length > 0 && (
                    <ul className="text-[11px] text-amber-300 list-disc pl-4">
                      {bulkResult.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Paste Multiple API Keys (One per line)
                </label>
                <textarea
                  rows={6}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={`Format examples:\nAccount A: kie_api_key_1\nAccount B: kie_api_key_2\nkie_api_key_3`}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                  required
                />
                <p className="text-[10px] text-zinc-500 mt-1">
                  Sistem akan mengenkripsi setiap key secara individual dan menghitung total akumulasi saldo kredit.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 transition cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {modalSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}
                  <span>{modalSubmitting ? 'Importing...' : 'Import All Keys'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: EDIT SINGLE USER CREDITS */}
      {/* ==================================================== */}
      {creditModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md p-6 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-400" />
                <span>Manage Credits: {creditModalUser.name}</span>
              </h3>
              <button
                type="button"
                onClick={() => setCreditModalUser(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateCreditsSubmit} className="space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-red-300">
                  {formError}
                </div>
              )}

              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                <span className="text-xs text-zinc-400">Current Balance</span>
                <span className="text-sm font-extrabold text-amber-400 flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5" />
                  {creditModalUser.credits ?? 20} Credits
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Action Mode
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setCreditAction('add')}
                    className={`py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                      creditAction === 'add'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-zinc-950 text-zinc-400 border border-zinc-800 hover:text-white'
                    }`}
                  >
                    + Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreditAction('set')}
                    className={`py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                      creditAction === 'set'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-zinc-950 text-zinc-400 border border-zinc-800 hover:text-white'
                    }`}
                  >
                    = Set Exact
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreditAction('deduct')}
                    className={`py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                      creditAction === 'deduct'
                        ? 'bg-rose-600 text-white shadow-md'
                        : 'bg-zinc-950 text-zinc-400 border border-zinc-800 hover:text-white'
                    }`}
                  >
                    - Deduct
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Amount (Credits)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm font-bold text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Note / Reason
                </label>
                <input
                  type="text"
                  value={creditReason}
                  onChange={(e) => setCreditReason(e.target.value)}
                  placeholder="e.g. Monthly allocation / Promo top-up"
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreditModalUser(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {modalSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Coins className="w-3.5 h-3.5" />}
                  <span>{modalSubmitting ? 'Saving...' : 'Apply Credits'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: BULK DISTRIBUTE CREDITS TO ALL USERS */}
      {/* ==================================================== */}
      {showDistributeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md p-6 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-400" />
                <span>Distribute Credits to All Users</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowDistributeModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleBulkDistributeSubmit} className="space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-red-300">
                  {formError}
                </div>
              )}

              <p className="text-xs text-zinc-400 leading-relaxed">
                Tindakan ini akan menambahkan kredit secara serentak ke seluruh akun pengguna studio yang berstatus aktif.
              </p>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Credit Bonus Amount per User
                </label>
                <input
                  type="number"
                  min="1"
                  max="5000"
                  value={distributeAmount}
                  onChange={(e) => setDistributeAmount(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm font-bold text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Reason / Event Tag
                </label>
                <input
                  type="text"
                  value={distributeReason}
                  onChange={(e) => setDistributeReason(e.target.value)}
                  placeholder="e.g. Studio Grand Opening Bonus"
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDistributeModal(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-xs font-bold text-white transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {modalSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Coins className="w-3.5 h-3.5" />}
                  <span>{modalSubmitting ? 'Distributing...' : `Send +${distributeAmount} Credits to All`}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: CONFIRM PERMANENT USER DELETION */}
      {/* ==================================================== */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md p-6 rounded-2xl bg-zinc-900 border border-red-900/50 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-red-400 flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-500" />
                <span>Hapus Pengguna Permanen</span>
              </h3>
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            {deleteError && (
              <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-xs text-red-300">
                {deleteError}
              </div>
            )}

            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
              <div className="text-xs text-zinc-400">Pengguna yang akan dihapus:</div>
              <div className="text-sm font-bold text-white">{userToDelete.name}</div>
              <div className="text-xs font-mono text-zinc-400">{userToDelete.email}</div>
              <div className="text-[11px] text-amber-400 pt-1">
                🪙 Saldo Kredit: {userToDelete.credits ?? 20} Credits • Generations: {userToDelete.generationCount}
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              ⚠️ Tindakan ini <strong className="text-red-400 font-bold">tidak dapat dibatalkan</strong>. Semua riwayat pembuatan lagu, audio, dan metadata milik pengguna ini akan langsung dihapus dari database.
            </p>

            <div className="pt-2 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                disabled={isDeletingUser}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDeleteUser}
                disabled={isDeletingUser}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-xs font-extrabold text-white transition flex items-center gap-2 shadow-lg shadow-red-600/30 cursor-pointer disabled:opacity-50"
              >
                {isDeletingUser ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Ya, Hapus Permanen</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

