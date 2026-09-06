import React, { useState, useEffect } from 'react';
import { Layers, Terminal, FileCode, Globe, Users, Cloud, Radio, ShieldCheck, X, Shield, Lock, LogIn, UserCheck, AlertCircle, Database, CheckCircle2 } from 'lucide-react';
import { Header } from './components/Header';
import { BotList } from './components/BotList';
import { LiveConsole } from './components/LiveConsole';
import { ScriptEditor } from './components/ScriptEditor';
import { ServicesManager } from './components/ServicesManager';
import { UsersManager } from './components/UsersManager';
import { HostingGuide } from './components/HostingGuide';
import { DatabaseManager } from './components/DatabaseManager';
import { BroadcastModal } from './components/BroadcastModal';
import { NewBotModal } from './components/NewBotModal';
import { PipManagerModal } from './components/PipManagerModal';
import { AuthModal } from './components/AuthModal';
import { HostedBot, LogEntry, AuthUser } from './types';

export default function App() {
  const [bots, setBots] = useState<HostedBot[]>([]);
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'bots' | 'terminal' | 'script' | 'services' | 'users' | 'guide' | 'database'>('bots');
  const [lang, setLang] = useState<'bn' | 'en'>('bn');
  const [showNewBotModal, setShowNewBotModal] = useState(false);
  const [showPipModal, setShowPipModal] = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [tokenModalData, setTokenModalData] = useState<any>(null);
  const [activationToast, setActivationToast] = useState<string | null>(null);

  // Authentication State
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  // Helper for authorized API calls
  const authFetch = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('bot_auth_token');
    const headers = new Headers(options.headers || {});
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return fetch(url, { ...options, headers });
  };

  // Verify stored session on boot
  const checkAuth = async () => {
    const token = localStorage.getItem('bot_auth_token');
    if (!token) {
      setAuthChecked(true);
      setShowAuthModal(true);
      return;
    }

    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if ((data.authenticated || data.success) && data.user) {
        setCurrentUser(data.user);
        setShowAuthModal(false);
      } else {
        localStorage.removeItem('bot_auth_token');
        setCurrentUser(null);
        setShowAuthModal(true);
      }
    } catch {
      // If network fails temporarily, don't immediately wipe token
    } finally {
      setAuthChecked(true);
    }
  };

  // Fetch bots list belonging to the authenticated user
  const fetchBots = async () => {
    try {
      const res = await authFetch('/api/bots');
      const data = await res.json();
      if (data.bots && Array.isArray(data.bots)) {
        setBots(data.bots);
        if (!selectedBotId && data.bots.length > 0) {
          setSelectedBotId(data.bots[0].id);
        } else if (selectedBotId && !data.bots.some((b: HostedBot) => b.id === selectedBotId)) {
          setSelectedBotId(data.bots.length > 0 ? data.bots[0].id : null);
        }
      } else {
        setBots([]);
      }
    } catch {
      // Ignore
    }
  };

  // Fetch logs for the selected bot
  const fetchLogs = async (botId: string | null) => {
    if (!botId) return;
    try {
      const res = await authFetch(`/api/bots/${botId}/logs?limit=400`);
      const data = await res.json();
      if (data.logs) {
        setLogs(data.logs);
      }
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    checkAuth();

    // Check URL parameters for email verification
    const params = new URLSearchParams(window.location.search);
    const verifyToken = params.get('verify_token');
    const verifiedParam = params.get('verified');

    if (verifyToken) {
      fetch('/api/auth/verify-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: verifyToken })
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.user) {
            setCurrentUser((prev) => (prev ? { ...prev, isVerified: true } : data.user));
            setActivationToast(
              lang === 'bn'
                ? '🎉 অভিনন্দন! আপনার অ্যাকাউন্ট সফলভাবে ভেরিফাই ও অ্যাক্টিভ করা হয়েছে!'
                : '🎉 Congratulations! Your account has been verified & activated!'
            );
          }
          window.history.replaceState({}, document.title, window.location.pathname);
        })
        .catch(() => {});
    } else if (verifiedParam) {
      setActivationToast(
        lang === 'bn'
          ? '🎉 অভিনন্দন! আপনার অ্যাকাউন্ট সফলভাবে অ্যাক্টিভ করা হয়েছে!'
          : '🎉 Congratulations! Your account has been activated!'
      );
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchBots();
    } else {
      setBots([]);
      setSelectedBotId(null);
      setLogs([]);
    }
  }, [currentUser]);

  useEffect(() => {
    if (selectedBotId && currentUser) {
      fetchLogs(selectedBotId);
    }
    const interval = setInterval(() => {
      if (currentUser) {
        fetchBots();
        if (selectedBotId) {
          fetchLogs(selectedBotId);
        }
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [selectedBotId, currentUser]);

  const selectedBot = bots.find((b) => b.id === selectedBotId) || bots[0];

  const handleStartBot = async (botId: string) => {
    setLoading(true);
    try {
      await authFetch(`/api/bots/${botId}/start`, { method: 'POST' });
      await fetchBots();
      await fetchLogs(botId);
    } finally {
      setLoading(false);
    }
  };

  const handleStopBot = async (botId: string) => {
    setLoading(true);
    try {
      await authFetch(`/api/bots/${botId}/stop`, { method: 'POST' });
      await fetchBots();
      await fetchLogs(botId);
    } finally {
      setLoading(false);
    }
  };

  const handleRestartBot = async (botId: string) => {
    setLoading(true);
    try {
      await authFetch(`/api/bots/${botId}/restart`, { method: 'POST' });
      await fetchBots();
      await fetchLogs(botId);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBot = async (botId: string) => {
    setLoading(true);
    try {
      await authFetch(`/api/bots/${botId}`, { method: 'DELETE' });
      const nextBots = bots.filter((b) => b.id !== botId);
      setBots(nextBots);
      if (selectedBotId === botId) {
        setSelectedBotId(nextBots.length > 0 ? nextBots[0].id : null);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClearLogs = async () => {
    if (!selectedBotId) return;
    try {
      await authFetch(`/api/bots/${selectedBotId}/clear-logs`, { method: 'POST' });
      setLogs([]);
    } catch {
      // Ignore
    }
  };

  const handleTestToken = async () => {
    if (!selectedBot) return;
    setLoading(true);
    try {
      const res = await authFetch(`/api/bots/${selectedBot.id}/test-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      setTokenModalData(data);
    } catch (e: any) {
      setTokenModalData({ ok: false, description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleBotCreated = (newBot: HostedBot) => {
    setBots((prev) => [newBot, ...prev]);
    setSelectedBotId(newBot.id);
    setActiveTab('terminal');
  };

  const handleLogout = async () => {
    try {
      await authFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore
    }
    localStorage.removeItem('bot_auth_token');
    setCurrentUser(null);
    setBots([]);
    setSelectedBotId(null);
    setLogs([]);
    setShowAuthModal(true);
  };

  const handleAuthSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    setShowAuthModal(false);
    fetchBots();
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#1e293b] flex flex-col font-sans selection:bg-[#0088cc]/20">
      {/* Top Header Bar */}
      <Header
        bots={bots}
        selectedBotId={selectedBotId}
        onSelectBot={(id) => setSelectedBotId(id)}
        onOpenNewBotModal={() => {
          if (!currentUser) {
            setShowAuthModal(true);
            return;
          }
          setShowNewBotModal(true);
        }}
        onOpenPipModal={() => setShowPipModal(true)}
        onTestToken={handleTestToken}
        lang={lang}
        setLang={setLang}
        user={currentUser}
        onLogout={handleLogout}
        onOpenAuthModal={() => setShowAuthModal(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Activation Toast */}
        {activationToast && (
          <div className="bg-emerald-600 text-white px-5 py-3.5 rounded-2xl flex items-center justify-between shadow-lg shadow-emerald-600/20 text-xs font-semibold animate-in fade-in duration-200">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0" />
              <span>{activationToast}</span>
            </div>
            <button
              onClick={() => setActivationToast(null)}
              className="text-white/80 hover:text-white font-bold px-2 py-1 hover:bg-emerald-700 rounded-lg transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* User Isolation & Security Banner */}
        {currentUser ? (
          <div className="space-y-3">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xs font-bold text-emerald-900 flex items-center gap-2">
                    <span>{lang === 'bn' ? 'সুরক্ষিত প্রাইভেট ওয়ার্কস্পেস:' : 'Isolated Private Workspace:'}</span>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-200/60 text-emerald-800 font-semibold">
                      {currentUser.name} ({currentUser.email})
                    </span>
                  </h2>
                  <p className="text-[11px] text-emerald-700 mt-0.5">
                    {lang === 'bn'
                      ? 'আপনার তৈরি করা সমস্ত বট, কোড ও ফাইল সম্পূর্ণ আলাদা ও প্রাইভেট। অন্য কোনো ইউজার আপনার ডকুমেন্ট বা বট দেখতে পারবে না।'
                      : 'All your hosted bots, code, and files are completely isolated. No other registered user can see or access your documents.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-emerald-800 bg-white/80 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{lang === 'bn' ? 'ব্যক্তিগত একাউন্ট সক্রিয়' : 'Private Profile Active'}</span>
                </span>
              </div>
            </div>

            {/* Unverified Account Notice if applicable */}
            {currentUser.isVerified === false && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-amber-900">
                      {lang === 'bn' ? 'অ্যাকাউন্ট ভেরিফিকেশন অপেক্ষারত' : 'Account Email Verification Pending'}
                    </h3>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      {lang === 'bn'
                        ? 'আপনার ইমেইলে পাঠানো অ্যাক্টিভেশন লিঙ্কে ক্লিক করে অথবা নিচের বাটনে চাপ দিয়ে অ্যাকাউন্ট সক্রিয় করুন।'
                        : 'Please verify your email via the activation link or click the button to verify.'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <span>{lang === 'bn' ? '🚀 অ্যাকাউন্ট অ্যাক্টিভ করুন' : '🚀 Verify / Activate Now'}</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-amber-900">
                  {lang === 'bn'
                    ? 'হোস্টিং শুরু করতে অনুগ্রহ করে লগইন বা রেজিস্ট্রেশন করুন'
                    : 'Please Sign In or Register to Manage Your Bots'}
                </h2>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  {lang === 'bn'
                    ? 'প্রতিটি ইউজারের জন্য সম্পূর্ণ আলাদা ও নিরাপদ হোস্টিং পরিবেশ প্রদান করা হয়।'
                    : 'Each user gets an isolated and secure bot hosting environment.'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowAuthModal(true)}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'লগইন / একাউন্ট খুলুন' : 'Sign In / Register'}</span>
            </button>
          </div>
        )}

        {/* Navigation Tabs Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2 rounded-2xl border border-[#e2e8f0] shadow-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setActiveTab('bots')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'bots'
                  ? 'bg-[#0088cc] text-white shadow-xs'
                  : 'text-[#64748b] hover:text-[#0088cc] hover:bg-[#f8fafc]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'আমার হোস্টেড বটসমূহ' : 'My Hosted Bots'}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                activeTab === 'bots' ? 'bg-white/20 text-white' : 'bg-[#e2e8f0] text-[#64748b]'
              }`}>
                {bots.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('terminal')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'terminal'
                  ? 'bg-[#0088cc] text-white shadow-xs'
                  : 'text-[#64748b] hover:text-[#0088cc] hover:bg-[#f8fafc]'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'লাইভ টার্মিনাল ও লগ' : 'Terminal & Logs'}</span>
            </button>

            <button
              onClick={() => setActiveTab('script')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'script'
                  ? 'bg-[#0088cc] text-white shadow-xs'
                  : 'text-[#64748b] hover:text-[#0088cc] hover:bg-[#f8fafc]'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'কোড ও ফাইল ম্যানেজার' : 'Code & Files'}</span>
            </button>

            <button
              onClick={() => setActiveTab('database')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'database'
                  ? 'bg-[#0088cc] text-white shadow-xs'
                  : 'text-[#64748b] hover:text-[#0088cc] hover:bg-[#f8fafc]'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'ডাটাবেজ ও স্টোরেজ' : 'Database & Storage'}</span>
            </button>

            <button
              onClick={() => setActiveTab('services')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'services'
                  ? 'bg-[#0088cc] text-white shadow-xs'
                  : 'text-[#64748b] hover:text-[#0088cc] hover:bg-[#f8fafc]'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'সার্ভিস ও এসএমএস গেটওয়ে' : 'Services & Rates'}</span>
            </button>

            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'users'
                  ? 'bg-[#0088cc] text-white shadow-xs'
                  : 'text-[#64748b] hover:text-[#0088cc] hover:bg-[#f8fafc]'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'ইউজার ও ব্যালেন্স' : 'Users & Balances'}</span>
            </button>

            <button
              onClick={() => setActiveTab('guide')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'guide'
                  ? 'bg-[#0088cc] text-white shadow-xs'
                  : 'text-[#64748b] hover:text-[#0088cc] hover:bg-[#f8fafc]'
              }`}
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? '২৪/৭ লাইভ গাইড' : '24/7 Free Guide'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBroadcast(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#0088cc]/10 hover:bg-[#0088cc]/15 text-[#0088cc] border border-[#0088cc]/20 transition-all cursor-pointer"
            >
              <Radio className="w-3.5 h-3.5 text-[#0088cc]" />
              <span>{lang === 'bn' ? 'ব্রডকাস্ট নোটিশ' : 'Broadcast Notice'}</span>
            </button>
          </div>
        </div>

        {/* Tab Views */}
        {activeTab === 'bots' && (
          <BotList
            bots={bots}
            selectedBotId={selectedBotId}
            onSelectBot={(id) => {
              setSelectedBotId(id);
              setActiveTab('terminal');
            }}
            onStartBot={handleStartBot}
            onStopBot={handleStopBot}
            onRestartBot={handleRestartBot}
            onDeleteBot={handleDeleteBot}
            onOpenNewBotModal={() => {
              if (!currentUser) {
                setShowAuthModal(true);
                return;
              }
              setShowNewBotModal(true);
            }}
            lang={lang}
          />
        )}

        {activeTab === 'terminal' && (
          <LiveConsole
            logs={logs}
            onClear={handleClearLogs}
            lang={lang}
            botName={selectedBot?.name}
            botStatus={selectedBot?.status}
            onStart={() => selectedBot && handleStartBot(selectedBot.id)}
            onStop={() => selectedBot && handleStopBot(selectedBot.id)}
            onRestart={() => selectedBot && handleRestartBot(selectedBot.id)}
            loading={loading}
          />
        )}

        {activeTab === 'script' && (
          <ScriptEditor
            lang={lang}
            botId={selectedBot?.id}
            botName={selectedBot?.name}
            onFileSaved={() => {
              fetchBots();
              if (selectedBotId) fetchLogs(selectedBotId);
            }}
          />
        )}

        {activeTab === 'database' && (
          <DatabaseManager lang={lang} />
        )}

        {activeTab === 'services' && (
          <ServicesManager
            lang={lang}
            botId={selectedBot?.id}
            botName={selectedBot?.name}
          />
        )}

        {activeTab === 'users' && (
          <UsersManager lang={lang} />
        )}

        {activeTab === 'guide' && (
          <HostingGuide
            lang={lang}
            botId={selectedBot?.id}
            botName={selectedBot?.name}
          />
        )}
      </main>

      {/* Auth Modal (Login & Register) */}
      <AuthModal
        isOpen={showAuthModal}
        canDismiss={!!currentUser}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
        lang={lang}
      />

      {/* New Bot Modal */}
      {showNewBotModal && (
        <NewBotModal
          onClose={() => setShowNewBotModal(false)}
          onCreated={handleBotCreated}
          lang={lang}
        />
      )}

      {/* Pip Manager Modal */}
      {showPipModal && (
        <PipManagerModal
          onClose={() => setShowPipModal(false)}
          lang={lang}
        />
      )}

      {/* Broadcast Modal */}
      <BroadcastModal
        isOpen={showBroadcast}
        onClose={() => setShowBroadcast(false)}
        lang={lang}
      />

      {/* Token Verification Modal */}
      {tokenModalData && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#f1f5f9] mb-4">
              <h3 className="text-sm font-bold text-[#1e293b] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#0088cc]" />
                {lang === 'bn' ? 'টেলিগ্রাম বট টোকেন টেস্ট' : 'Telegram Bot API Test'}
              </h3>
              <button onClick={() => setTokenModalData(null)} className="text-[#94a3b8] hover:text-[#1e293b] p-1 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            {tokenModalData.ok ? (
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold flex items-center gap-2">
                  <span>✓ টোকেনটি সক্রিয় ও ভ্যালিড!</span>
                </div>
                <div className="space-y-1.5 bg-[#f8fafc] p-3.5 rounded-xl font-mono text-[11px] text-[#1e293b] border border-[#e2e8f0]">
                  <div>Bot Name: <span className="text-[#1e293b] font-bold">{tokenModalData.result?.first_name}</span></div>
                  <div>Username: <span className="text-[#0088cc] font-semibold">@{tokenModalData.result?.username}</span></div>
                  <div>ID: <span className="text-[#64748b]">{tokenModalData.result?.id}</span></div>
                  <div>Can Join Groups: <span className="text-emerald-600 font-semibold">{String(tokenModalData.result?.can_join_groups)}</span></div>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                <p className="font-bold">❌ সংযোগ ব্যর্থ:</p>
                <p className="mt-1 font-mono text-[11px] text-rose-700">{tokenModalData.description || tokenModalData.error || 'Invalid token'}</p>
              </div>
            )}
            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setTokenModalData(null)}
                className="px-4 py-2 bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#1e293b] text-xs font-semibold rounded-xl border border-[#e2e8f0] cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="px-8 py-3.5 bg-white border-t border-[#e2e8f0] text-[#94a3b8] text-xs flex flex-wrap items-center justify-between gap-2">
        <span>&copy; BotHost Live • Free Unlimited Telegram Bot & Python Script Cloud Host</span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>২৪/৭ ক্লাউড অটো-রানিং ইঞ্জিন: <span className="text-emerald-600 font-bold uppercase tracking-wider">সক্রিয় (Active)</span></span>
        </span>
      </footer>
    </div>
  );
}
