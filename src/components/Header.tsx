import React from 'react';
import { Terminal, ShieldCheck, Globe, Plus, Package, LogOut, User, Lock, UserCheck } from 'lucide-react';
import { HostedBot, AuthUser } from '../types';

interface HeaderProps {
  bots: HostedBot[];
  selectedBotId: string | null;
  onSelectBot: (botId: string) => void;
  onOpenNewBotModal: () => void;
  onOpenPipModal: () => void;
  onTestToken: () => void;
  lang: 'bn' | 'en';
  setLang: (lang: 'bn' | 'en') => void;
  user: AuthUser | null;
  onLogout: () => void;
  onOpenAuthModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  bots,
  selectedBotId,
  onSelectBot,
  onOpenNewBotModal,
  onOpenPipModal,
  onTestToken,
  lang,
  setLang,
  user,
  onLogout,
  onOpenAuthModal
}) => {
  const runningCount = bots.filter((b) => b.status === 'running').length;

  return (
    <header className="bg-white border-b border-[#e2e8f0] text-[#1e293b] sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Branding */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#0088cc] flex items-center justify-center text-white font-bold text-lg shadow-sm">
            <Terminal className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-[#1e293b] flex items-center gap-1.5">
                BotHost Live
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#0088cc]/10 text-[#0088cc] border border-[#0088cc]/20 font-semibold">
                  Cloud Platform
                </span>
                <span className="hidden sm:inline-flex text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                  ২৪/৭ লাইভ
                </span>
              </h1>
            </div>
            <p className="text-xs text-[#64748b]">
              {lang === 'bn'
                ? 'সুরক্ষিত পারসোনাল টেলিগ্রাম বট হোস্টিং (অন্য ইউজার আপনার বট দেখতে পারবে না)'
                : 'Isolated & Secure Telegram Bot Cloud Hosting (Private per user)'}
            </p>
          </div>
        </div>

        {/* Bot selector & Live status */}
        <div className="flex items-center gap-2 bg-[#f8fafc] px-3 py-1.5 rounded-xl border border-[#e2e8f0]">
          <span className="relative flex h-2 w-2">
            {runningCount > 0 && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            )}
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                runningCount > 0 ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
            ></span>
          </span>
          <span className="text-xs font-semibold text-[#1e293b]">
            {runningCount}/{bots.length} {lang === 'bn' ? 'টি বট অনলাইন' : 'Bots Online'}
          </span>
          {bots.length > 1 && (
            <>
              <div className="h-3.5 w-px bg-[#e2e8f0] mx-1"></div>
              <select
                value={selectedBotId || ''}
                onChange={(e) => onSelectBot(e.target.value)}
                className="bg-white border border-[#e2e8f0] rounded-lg px-2 py-0.5 text-xs font-medium text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#0088cc] cursor-pointer"
              >
                {bots.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.status === 'running' ? 'LIVE' : 'OFF'})
                  </option>
                ))}
              </select>
            </>
          )}
        </div>

        {/* Action Controls & User info */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* New Bot Button */}
          <button
            id="header-deploy-bot-btn"
            onClick={onOpenNewBotModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-[#0088cc] hover:bg-[#0077b5] text-white transition-all shadow-sm shadow-[#0088cc]/20 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{lang === 'bn' ? '+ নতুন বট হোস্ট' : '+ Deploy Bot'}</span>
          </button>

          {/* Pip manager button */}
          <button
            id="header-pip-btn"
            onClick={onOpenPipModal}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#1e293b] border border-[#e2e8f0] transition-all cursor-pointer"
            title="Manage Python Packages"
          >
            <Package className="w-3.5 h-3.5 text-[#0088cc]" />
            <span className="hidden sm:inline">pip</span>
          </button>

          {/* Test Token button */}
          <button
            id="header-test-token-btn"
            onClick={onTestToken}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#1e293b] border border-[#e2e8f0] transition-all cursor-pointer"
            title="Verify Bot Token with Telegram API"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#0088cc]" />
            <span className="hidden md:inline">{lang === 'bn' ? 'টোকেন টেস্ট' : 'Test Token'}</span>
          </button>

          {/* Language Switch */}
          <button
            onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')}
            className="flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-xl bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#1e293b] border border-[#e2e8f0] transition-all cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 text-[#94a3b8]" />
            <span>{lang === 'bn' ? 'ENG' : 'বাংলা'}</span>
          </button>

          {/* User Account / Profile button */}
          {user ? (
            <div className="flex items-center gap-1.5 pl-2 ml-1 border-l border-[#e2e8f0]">
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-[#e2e8f0] text-xs">
                <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center font-bold text-[11px]">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="text-left hidden lg:block leading-tight">
                  <p className="font-bold text-[#1e293b] text-xs truncate max-w-[120px]">{user.name}</p>
                  <p className="text-[10px] text-emerald-600 flex items-center gap-1">
                    <UserCheck className="w-2.5 h-2.5" />
                    <span>আইসোলেটেড একাউন্ট</span>
                  </p>
                </div>
              </div>
              <button
                id="header-logout-btn"
                onClick={onLogout}
                className="p-2 rounded-xl bg-[#f8fafc] hover:bg-rose-50 text-[#64748b] hover:text-rose-600 border border-[#e2e8f0] hover:border-rose-200 transition-colors cursor-pointer"
                title={lang === 'bn' ? 'লগআউট করুন' : 'Log Out'}
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              id="header-login-btn"
              onClick={onOpenAuthModal}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-xs cursor-pointer ml-1"
            >
              <User className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'লগইন / রেজিস্টার' : 'Sign In'}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
