import React, { useState, useEffect } from 'react';
import { ArrowLeft, Terminal, Bot, LogIn, CheckCircle2, Shield, X } from 'lucide-react';
import { Header } from './components/Header';
import { BotList } from './components/BotList';
import { LiveConsole } from './components/LiveConsole';
import { NewBotModal } from './components/NewBotModal';
import { SettingsModal } from './components/SettingsModal';
import { AuthModal } from './components/AuthModal';
import { HostedBot, LogEntry, AuthUser } from './types';

export default function App() {
  const [bots, setBots] = useState<HostedBot[]>([]);
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'bots' | 'terminal'>('bots');
  const [lang, setLang] = useState<'bn' | 'en'>('bn');
  const [showNewBotModal, setShowNewBotModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<string>('overview');
  const [tokenModalData, setTokenModalData] = useState<any>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Authentication State
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

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
      // Offline or network lag, retain token
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

  // Polling for bot statuses and active logs
  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(() => {
      fetchBots();
      if (activeTab === 'terminal' && selectedBotId) {
        fetchLogs(selectedBotId);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [currentUser, activeTab, selectedBotId]);

  // Handler to start a bot
  const handleStartBot = async (botId: string) => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/bots/${botId}/start`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        fetchBots();
        fetchLogs(botId);
      }
    } catch {
      // Network retry
    } finally {
      setLoading(false);
    }
  };

  // Handler to stop a bot
  const handleStopBot = async (botId: string) => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/bots/${botId}/stop`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        fetchBots();
        fetchLogs(botId);
      }
    } catch {
      // Network retry
    } finally {
      setLoading(false);
    }
  };

  // Handler to restart a bot
  const handleRestartBot = async (botId: string) => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/bots/${botId}/restart`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        fetchBots();
        fetchLogs(botId);
      }
    } catch {
      // Network retry
    } finally {
      setLoading(false);
    }
  };

  // Handler to delete a bot permanently
  const handleDeleteBot = async (botId: string) => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/bots/${botId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        if (selectedBotId === botId) {
          const remaining = bots.filter((b) => b.id !== botId);
          setSelectedBotId(remaining.length > 0 ? remaining[0].id : null);
          setLogs([]);
        }
        fetchBots();
      }
    } catch {
      // Network retry
    } finally {
      setLoading(false);
    }
  };

  // Clear terminal logs
  const handleClearLogs = async () => {
    if (!selectedBotId) return;
    try {
      await authFetch(`/api/bots/${selectedBotId}/logs`, { method: 'DELETE' });
      setLogs([]);
    } catch {
      // Ignore
    }
  };

  // Bot token tester
  const handleTestToken = async () => {
    const token = prompt(
      lang === 'bn'
        ? 'টেলিগ্রাম বটের টোকেন লিখুন (উদাঃ 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11):'
        : 'Enter Telegram Bot Token to verify:'
    );
    if (!token || !token.trim()) return;

    try {
      const res = await fetch(`https://api.telegram.org/bot${token.trim()}/getMe`);
      const data = await res.json();
      setTokenModalData(data);
    } catch {
      setTokenModalData({
        ok: false,
        description: lang === 'bn' ? 'টেলিগ্রাম সার্ভারে সংযোগ স্থাপন করা সম্ভব হয়নি।' : 'Could not connect to Telegram server.'
      });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('bot_auth_token');
    setCurrentUser(null);
    setShowAuthModal(true);
  };

  const selectedBot = bots.find((b) => b.id === selectedBotId);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#1e293b] flex flex-col selection:bg-[#0088cc] selection:text-white">
      {/* Header */}
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
        onOpenSettingsModal={(tab = 'overview') => {
          setSettingsInitialTab(tab);
          setShowSettingsModal(true);
        }}
        lang={lang}
        setLang={setLang}
        user={currentUser}
        onLogout={handleLogout}
        onOpenAuthModal={() => setShowAuthModal(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs flex items-center justify-between shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{toastMessage}</span>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="text-emerald-700 hover:text-emerald-950 p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Not Logged In Banner */}
        {!currentUser && (
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

        {/* Terminal Navigation Bar if inside Terminal */}
        {activeTab === 'terminal' && (
          <div className="flex items-center justify-between bg-white border border-[#e2e8f0] p-3 rounded-2xl shadow-xs">
            <button
              onClick={() => setActiveTab('bots')}
              className="px-4 py-2 rounded-xl bg-[#0088cc] hover:bg-[#0077b5] text-white text-xs font-bold flex items-center gap-2 shadow-xs cursor-pointer transition-all hover:scale-[1.01]"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{lang === 'bn' ? '← হোস্টেড বট তালিকায় ফিরুন' : '← Back to Hosted Bots'}</span>
            </button>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#64748b]">
                {lang === 'bn' ? 'নির্বাচিত বট:' : 'Active Bot:'}
              </span>
              <span className="text-xs font-bold text-[#1e293b] px-2.5 py-1 rounded-lg bg-[#f1f5f9]">
                {selectedBot?.name || 'Bot'}
              </span>
            </div>
          </div>
        )}

        {/* Primary View: Hosted Bots Only */}
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
            onOpenFileEditor={(botId) => {
              setSelectedBotId(botId);
              setSettingsInitialTab('files');
              setShowSettingsModal(true);
            }}
            lang={lang}
          />
        )}

        {/* Secondary Terminal View */}
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
      </main>

      {/* Auth Modal (Login & Register - No Captcha, No Email Verification) */}
      <AuthModal
        isOpen={showAuthModal}
        canDismiss={!!currentUser}
        onClose={() => {
          if (currentUser) setShowAuthModal(false);
        }}
        onSuccess={(user) => {
          setCurrentUser(user);
          setShowAuthModal(false);
          setToastMessage(
            lang === 'bn'
              ? `স্বাগতম, ${user.name}! আপনি সফলভাবে লগইন করেছেন।`
              : `Welcome, ${user.name}! You are logged in.`
          );
        }}
        lang={lang}
      />

      {/* New Bot Deploy Modal */}
      {showNewBotModal && (
        <NewBotModal
          isOpen={showNewBotModal}
          onClose={() => setShowNewBotModal(false)}
          onBotCreated={() => {
            fetchBots();
            setShowNewBotModal(false);
          }}
          lang={lang}
        />
      )}

      {/* Comprehensive High-Quality Settings Modal */}
      {showSettingsModal && (
        <SettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          lang={lang}
          currentUser={currentUser}
          bots={bots}
          selectedBotId={selectedBotId}
          onSelectBot={(id) => setSelectedBotId(id)}
          onBotsUpdated={() => fetchBots()}
          onTestToken={handleTestToken}
          initialTab={settingsInitialTab}
        />
      )}

      {/* Token Verification Result Modal */}
      {tokenModalData && (
        <div className="fixed inset-0 bg-[#050811]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#f1f5f9] mb-4">
              <h3 className="text-sm font-bold text-[#1e293b]">
                {lang === 'bn' ? 'টেলিগ্রাম বট টোকেন ফলাফল' : 'Telegram Bot Token Result'}
              </h3>
              <button
                onClick={() => setTokenModalData(null)}
                className="text-[#94a3b8] hover:text-[#1e293b] p-1 cursor-pointer"
              >
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
                <p className="font-bold">সতর্কবার্তা:</p>
                <p className="mt-1 font-mono text-[11px] text-rose-700">
                  {tokenModalData.description || (lang === 'bn' ? 'টোকেনটি সঠিক নয় বা সক্রিয় করা যায়নি' : 'Invalid bot token')}
                </p>
              </div>
            )}
            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setTokenModalData(null)}
                className="px-4 py-2 bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#1e293b] text-xs font-semibold rounded-xl border border-[#e2e8f0] cursor-pointer transition-colors"
              >
                {lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clean Footer */}
      <footer className="px-8 py-4 bg-white border-t border-[#e2e8f0] text-[#94a3b8] text-xs flex flex-wrap items-center justify-between gap-2 mt-auto">
        <span>&copy; Bot-Host • Free Unlimited Telegram Bot Cloud Hosting</span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>২৪/৭ ক্লাউড অটো-রানিং ইঞ্জিন: <span className="text-emerald-600 font-bold uppercase tracking-wider">সক্রিয় (Active)</span></span>
        </span>
      </footer>
    </div>
  );
}
