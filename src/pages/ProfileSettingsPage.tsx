import React, { useState } from 'react';
import { User, KeyRound, Lock, Trash2, CheckCircle2, AlertTriangle, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export const ProfileSettingsPage: React.FC<{ setCurrentTab: (tab: string) => void }> = ({ setCurrentTab }) => {
  const { user, kieConnection, deleteAccount } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [newPassword, setNewPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);
    try {
      await api.updateProfile(name, newPassword || undefined);
      setMessage('Profile updated successfully.');
      setNewPassword('');
    } catch {
      setMessage('Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await deleteAccount();
    } catch {
      alert('Failed to delete account');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-24">
      <div>
        <h2 className="text-xl font-extrabold text-white">Account Settings</h2>
        <p className="text-xs text-zinc-400 mt-0.5">Manage your producer profile and account security</p>
      </div>

      {/* Profile Form */}
      <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800/80 shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-white">Personal Information</h3>

        <form onSubmit={handleUpdate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">Producer / Artist Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">Email Address</label>
              <input
                type="email"
                disabled
                value={user?.email || ''}
                className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-500 cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1">
              Change Password (Leave blank to keep existing)
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          {message && (
            <p className="text-xs text-emerald-400">{message}</p>
          )}

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Studio Quota & Credits Summary */}
      <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800/80 shadow-xl flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-400" />
            <span>Studio Credit Balance</span>
          </h4>
          <p className="text-xs text-zinc-400 mt-1">
            Current Quota: <strong className="text-amber-300 font-extrabold">{user?.credits ?? 20} Credits</strong> (Standard generation: 10 credits / song)
          </p>
        </div>
        <button
          onClick={() => setCurrentTab('create')}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition cursor-pointer"
        >
          Create Music
        </button>
      </div>

      {/* Account Deletion Area */}
      <div className="p-6 rounded-2xl bg-red-950/20 border border-red-900/40 shadow-xl space-y-3">
        <h4 className="text-xs font-bold text-red-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <span>Delete Account</span>
        </h4>
        <p className="text-xs text-zinc-400 leading-relaxed">
          Deleting your account will remove your profile, studio history, and saved creations.
        </p>

        <button
          onClick={() => setShowDeleteModal(true)}
          className="px-4 py-2 rounded-xl bg-red-900/60 hover:bg-red-800 text-red-200 text-xs font-bold transition flex items-center gap-2 cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
          <span>Delete Account Permanently</span>
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-950 border border-red-900/60 rounded-2xl max-w-md w-full p-6 space-y-4">
            <h4 className="text-base font-bold text-white">Confirm Account Deletion</h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Are you sure? All your studio records and account data will be purged immediately.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold"
              >
                Yes, Delete Everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
