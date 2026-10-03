import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Lock,
  RefreshCw,
  Trash2,
  Info,
  Layers,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export const KieSettingsPage: React.FC = () => {
  const { kieConnection, connectKie, testKie, disconnectKie, refreshKieStatus } = useAuth();

  const [inputKey, setInputKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);
  const [usageInfo, setUsageInfo] = useState<string>('Usage information is managed by Kie.ai.');

  useEffect(() => {
    refreshKieStatus();
    api.getKieUsage().then((res) => {
      if (res.usageInfo) setUsageInfo(res.usageInfo);
    }).catch(() => {});
  }, []);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputKey.trim()) {
      setError('Please enter your personal Kie.ai API key.');
      return;
    }

    if (kieConnection.connected && !showReplaceConfirm) {
      setShowReplaceConfirm(true);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    setTestResult(null);

    try {
      const res = await connectKie(inputKey.trim());
      setInputKey('');
      setShowReplaceConfirm(false);
      setSuccessMessage('✓ Kie.ai connection successful. Your key has been encrypted with AES-256-GCM.');
    } catch (err: any) {
      setError(err.message || 'Unable to connect to Kie.ai. Please verify your API key credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await testKie();
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: '✕ Unable to connect to Kie.ai.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Kie.ai? Stored encryption keys will be securely deleted. Generated songs in your library will remain intact.')) {
      return;
    }

    try {
      await disconnectKie();
      setTestResult(null);
      setSuccessMessage('Kie.ai disconnected.');
    } catch (err: any) {
      setError('Failed to disconnect Kie.ai.');
    }
  };

  const handleMockKeyHelper = () => {
    setInputKey('kie_mock_suno_studio_live_9941');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-24">
      {/* Title & Description */}
      <div>
        <h2 className="text-2xl font-extrabold text-white">Kie.ai Connection</h2>
        <p className="text-xs text-zinc-400 mt-1">
          Connect your own Kie.ai API key to generate music using your Kie.ai account.
        </p>
      </div>

      {/* Primary BYOK Notice (Section 72) */}
      <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 shadow-xl space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-indigo-400" />
          <span>Bring Your Own Kie.ai API Key</span>
        </h3>
        <div className="text-xs text-zinc-400 space-y-2 leading-relaxed">
          <p>• Connect your own Kie.ai API key to use your Kie.ai account for music generation.</p>
          <p>• Your API key is encrypted and is never displayed in full after it is saved.</p>
          <p>• Your Kie.ai account is responsible for API usage and charges.</p>
          <p>• SUNOMAKER does not provide or sell Kie.ai API credits. No shared global key is ever used.</p>
        </div>
      </div>

      {/* Main Connection Panel */}
      <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800/90 shadow-xl space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div>
            <span className="text-xs font-semibold text-zinc-400">Connection Status</span>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`w-3 h-3 rounded-full ${
                  kieConnection.connected ? 'bg-emerald-400 shadow-md shadow-emerald-500/30' : 'bg-amber-400'
                }`}
              />
              <span className="text-sm font-bold text-white">
                {kieConnection.connected ? 'Connected' : 'Not Connected'}
              </span>
            </div>
          </div>

          {kieConnection.connected && kieConnection.lastTestedAt && (
            <div className="text-right">
              <span className="text-[11px] text-zinc-500 block">Last checked</span>
              <span className="text-xs font-mono text-zinc-300">
                {new Date(kieConnection.lastTestedAt).toLocaleString()}
              </span>
            </div>
          )}
        </div>

        {/* Masked Key Display or Connect Input */}
        {kieConnection.connected ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                Connected API Key (Masked)
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  disabled
                  value={kieConnection.maskedKey || '****************EFG'}
                  className="flex-1 p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-300 select-none cursor-not-allowed"
                />
                <span className="px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-semibold">
                  AES-256-GCM
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">
                The full key is encrypted on the server. Decryption occurs only in server memory when communicating with Kie.ai.
              </p>
            </div>

            {/* Test Feedback */}
            {testResult && (
              <div
                className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
                  testResult.success
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                    : 'bg-red-950/40 border-red-800/40 text-red-300'
                }`}
              >
                {testResult.success ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>✓ Kie.ai connection successful.</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>✕ Unable to connect to Kie.ai.</span>
                  </>
                )}
              </div>
            )}

            {/* Actions for connected state */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleTest}
                disabled={isTesting}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md transition flex items-center gap-2 disabled:opacity-50"
              >
                {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                <span>{isTesting ? 'Testing Kie.ai connection...' : 'Test Connection'}</span>
              </button>

              <button
                type="button"
                onClick={handleDisconnect}
                className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-red-950/50 text-red-300 hover:text-red-200 border border-zinc-800 hover:border-red-800/60 text-xs font-semibold transition flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>Disconnect</span>
              </button>
            </div>
          </div>
        ) : null}

        {/* Connect New / Replace Key Form */}
        <div className="pt-4 border-t border-zinc-800 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              {kieConnection.connected ? 'Replace Existing API Key' : 'Connect Your API Key'}
            </h4>
            <button
              type="button"
              onClick={handleMockKeyHelper}
              className="text-xs text-indigo-400 hover:text-indigo-300 underline"
            >
              Fill Mock Key for BYOK Testing
            </button>
          </div>

          {/* Replacement Confirmation Dialog (Section 59) */}
          {showReplaceConfirm && (
            <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/40 text-xs text-amber-200 space-y-2">
              <p className="font-bold">Replace your existing Kie.ai API key?</p>
              <p className="text-zinc-400 leading-relaxed">
                SUNOMAKER will validate the new key against Kie.ai before saving. Your existing working key will only be replaced if the new key passes verification, protecting you from typos.
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={isSubmitting}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition"
                >
                  {isSubmitting ? 'Validating...' : 'Confirm & Test New Key'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowReplaceConfirm(false)}
                  className="px-3.5 py-1.5 bg-zinc-800 text-zinc-300 rounded-lg text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleConnect} className="space-y-4">
            <div>
              <input
                type="password"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                placeholder="Enter Kie.ai API Key (e.g. kie_live_1234567890abcdef...)"
                className="w-full p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/40 text-red-300 text-xs">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs">
                {successMessage}
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <a
                href="https://kie.ai"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1"
              >
                <span>Need a Kie.ai API key? Visit kie.ai</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                type="submit"
                disabled={isSubmitting || !inputKey.trim()}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition flex items-center gap-2"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                <span>{isSubmitting ? 'Testing & Encrypting...' : kieConnection.connected ? 'Replace API Key' : 'Connect API Key'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Kie.ai Usage Information (Sections 29 & 30) */}
      <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-2">
        <h4 className="text-xs font-bold text-zinc-300 flex items-center gap-2">
          <Info className="w-4 h-4 text-indigo-400" />
          <span>Kie.ai Account Usage</span>
        </h4>
        <p className="text-xs text-zinc-400 leading-relaxed">{usageInfo}</p>
      </div>
    </div>
  );
};
