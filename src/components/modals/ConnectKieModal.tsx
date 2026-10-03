import React, { useState } from 'react';
import { X, KeyRound, ShieldCheck, AlertCircle, CheckCircle2, Loader2, ExternalLink } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface ConnectKieModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ConnectKieModal: React.FC<ConnectKieModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { kieConnection, connectKie, testKie, disconnectKie } = useAuth();

  const [inputKey, setInputKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputKey.trim()) {
      setError('Silakan masukkan API key Engine Anda.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setTestResult(null);

    try {
      await connectKie(inputKey.trim());
      setInputKey('');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Gagal menghubungkan API key. Silakan periksa kembali key Anda.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTestExisting = async () => {
    setIsTesting(true);
    setTestResult(null);
    setError(null);
    try {
      const res = await testKie();
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Unable to connect to Engine server.' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleDisconnect = async () => {
    if (confirm('Disconnect your API key? Your generated music will remain preserved in your library.')) {
      await disconnectKie();
      setTestResult(null);
    }
  };

  const handleFillMockKey = () => {
    setInputKey('kie_mock_studio_byok_key_8892');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-900 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Connect Studio Engine API Key</h3>
            <p className="text-xs text-zinc-400">Connect your custom API key for music generation</p>
          </div>
        </div>

        {/* Core Clarification Banner */}
        <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800/80 mb-5 text-xs space-y-2">
          <div className="flex items-start gap-2 text-zinc-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong>Zero Plaintext Storage:</strong> Your key is encrypted with AES-256-GCM. It is never displayed in full after being saved.
            </span>
          </div>
          <div className="flex items-start gap-2 text-zinc-400">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              SUNOMAKER handles all generation requests securely through encrypted studio credentials.
            </span>
          </div>
        </div>

        {/* Existing Connection Status Card */}
        {kieConnection.connected && (
          <div className="mb-5 p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold text-emerald-300">Studio Engine Connected</span>
              </div>
              <span className="text-xs font-mono text-zinc-300 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                {kieConnection.maskedKey}
              </span>
            </div>

            <div className="flex items-center gap-2 pt-1 border-t border-emerald-500/20">
              <button
                type="button"
                onClick={handleTestExisting}
                disabled={isTesting}
                className="flex-1 py-1.5 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-medium border border-zinc-700/60 transition flex items-center justify-center gap-1.5"
              >
                {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>{isTesting ? 'Testing connection...' : 'Test Connection'}</span>
              </button>

              <button
                type="button"
                onClick={handleDisconnect}
                className="py-1.5 px-3 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-300 text-xs font-medium border border-red-800/40 transition"
              >
                Disconnect
              </button>
            </div>

            {testResult && (
              <div
                className={`text-xs p-2 rounded-lg ${
                  testResult.success
                    ? 'bg-emerald-900/30 text-emerald-300 border border-emerald-800/40'
                    : 'bg-red-900/30 text-red-300 border border-red-800/40'
                }`}
              >
                {testResult.success ? `✓ ${testResult.message}` : `✕ ${testResult.message}`}
              </div>
            )}
          </div>
        )}

        {/* Key Form */}
        <form onSubmit={handleConnect} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-zinc-300">
                {kieConnection.connected ? 'Replace with New Engine API Key' : 'Personal Engine API Key'}
              </label>
              <button
                type="button"
                onClick={handleFillMockKey}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 underline"
              >
                Fill Mock Key
              </button>
            </div>
            <input
              type="password"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="e.g. sk_live_1234567890abcdef..."
              className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-white text-xs font-mono placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/50 text-red-300 text-xs">
              {error}
            </div>
          )}

          <div className="pt-2 flex items-center justify-end">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !inputKey.trim()}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition flex items-center gap-1.5"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>{isSubmitting ? 'Verifying & Encrypting...' : kieConnection.connected ? 'Update Key' : 'Connect API Key'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
