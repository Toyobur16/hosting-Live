import React, { useState } from 'react';
import { 
  X, Settings, FileCode, Package, Database, Globe, Users, 
  Radio, ShieldCheck, Cloud, User, KeyRound, CheckCircle2, 
  ExternalLink, ChevronRight, HardDrive, ArrowLeft
} from 'lucide-react';
import { ScriptEditor } from './ScriptEditor';
import { DatabaseManager } from './DatabaseManager';
import { ServicesManager } from './ServicesManager';
import { UsersManager } from './UsersManager';
import { HostingGuide } from './HostingGuide';
import { PipManagerModal } from './PipManagerModal';
import { BroadcastModal } from './BroadcastModal';
import { HostedBot, AuthUser } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'bn' | 'en';
  currentUser: AuthUser | null;
  bots: HostedBot[];
  selectedBotId: string | null;
  onSelectBot: (id: string) => void;
  onBotsUpdated: () => void;
  onTestToken: () => void;
  initialTab?: string;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  lang,
  currentUser,
  bots,
  selectedBotId,
  onSelectBot,
  onBotsUpdated,
  onTestToken,
  initialTab = 'overview'
}) => {
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [showPip, setShowPip] = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);

  if (!isOpen) return null;

  const selectedBot = bots.find((b) => b.id === selectedBotId) || (bots.length > 0 ? bots[0] : null);

  const SETTING_ITEMS = [
    {
      id: 'files',
      icon: FileCode,
      titleBn: 'ফাইল আপলোড ও কোড এডিটর',
      titleEn: 'File Upload & Script Editor',
      descBn: 'বটের কোড এডিট করুন, নতুন ফাইল আপলোড ও জিপ এক্সপোর্ট করুন',
      descEn: 'Edit bot code, upload files and inspect syntax',
      color: 'text-indigo-600 bg-indigo-50 border-indigo-200'
    },
    {
      id: 'database',
      icon: Database,
      titleBn: 'ডাটাবেজ ও ক্লাউড স্টোরেজ',
      titleEn: 'Database & Cloud Storage',
      descBn: 'ডাটাবেজ ব্যাকআপ ডাউনলোড করুন এবং ফাইল লোকেশন দেখুন',
      descEn: 'Download full JSON database backup and inspect storage',
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200'
    },
    {
      id: 'pip',
      icon: Package,
      titleBn: 'পাইথন প্যাকেজ ম্যানেজার (Pip)',
      titleEn: 'Python Pip Packages',
      descBn: 'telebot, aiogram, requests সহ যেকোনো লাইব্রেরি ইনস্টল করুন',
      descEn: 'Install telebot, aiogram, requests and python packages',
      color: 'text-sky-600 bg-sky-50 border-sky-200',
      isAction: true,
      action: () => setShowPip(true)
    },
    {
      id: 'services',
      icon: Globe,
      titleBn: 'সার্ভিস ও এসএমএস গেটওয়ে',
      titleEn: 'Services & SMS Gateway',
      descBn: 'টেলিগ্রাম এসএমএস এবং অটোমেশন সার্ভিস রেট কনফিগার করুন',
      descEn: 'Configure Telegram SMS services and rates',
      color: 'text-amber-600 bg-amber-50 border-amber-200'
    },
    {
      id: 'users',
      icon: Users,
      titleBn: 'ইউজার ও ব্যালেন্স ম্যানেজমেন্ট',
      titleEn: 'Users & Balances',
      descBn: 'নিবন্ধিত ইউজার তালিকা ও হোস্টিং কোটা নিয়ন্ত্রণ করুন',
      descEn: 'Manage registered users, balances and quotas',
      color: 'text-purple-600 bg-purple-50 border-purple-200'
    },
    {
      id: 'token_test',
      icon: ShieldCheck,
      titleBn: 'টেলিগ্রাম বট টোকেন টেস্ট',
      titleEn: 'Verify Bot Token',
      descBn: 'অফিসিয়াল টেলিগ্রাম API দিয়ে বটের টোকেন বৈধতা পরীক্ষা করুন',
      descEn: 'Verify bot token with official Telegram API',
      color: 'text-blue-600 bg-blue-50 border-blue-200',
      isAction: true,
      action: () => {
        onClose();
        onTestToken();
      }
    },
    {
      id: 'broadcast',
      icon: Radio,
      titleBn: 'অ্যাডমিন ব্রডকাস্ট নোটিশ',
      titleEn: 'Admin Broadcast Notice',
      descBn: 'সাইটের সকল সক্রিয় ইউজারকে নোটিশ বার্তা পাঠান',
      descEn: 'Send announcement to all registered users',
      color: 'text-rose-600 bg-rose-50 border-rose-200',
      isAction: true,
      action: () => setShowBroadcast(true)
    },
    {
      id: 'guide',
      icon: Cloud,
      titleBn: '২৪/৭ হোস্টিং গাইড ও সাহায্য',
      titleEn: '24/7 Hosting Guide',
      descBn: 'টেলিগ্রাম বট তৈরি, টোকেন সংগ্রহ ও হোস্টিং করার পূর্ণাঙ্গ গাইড',
      descEn: 'Step by step guide to build and host telegram bots',
      color: 'text-teal-600 bg-teal-50 border-teal-200'
    }
  ];

  return (
    <>
      <div className="fixed inset-0 bg-[#050811]/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 z-50 animate-in fade-in duration-200">
        <div className="bg-white border border-[#e2e8f0] rounded-3xl max-w-5xl w-full h-[88vh] max-h-[850px] shadow-2xl flex flex-col overflow-hidden">
          {/* Modal Header */}
          <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8fafc]">
            <div className="flex items-center gap-3">
              {activeTab !== 'overview' && (
                <button
                  onClick={() => setActiveTab('overview')}
                  className="p-1.5 rounded-xl hover:bg-[#e2e8f0] text-[#64748b] hover:text-[#1e293b] transition-colors cursor-pointer"
                  title="Back to Settings Menu"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <div className="w-10 h-10 rounded-2xl bg-[#0088cc]/10 border border-[#0088cc]/20 flex items-center justify-center text-[#0088cc]">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1e293b]">
                  {activeTab === 'overview'
                    ? (lang === 'bn' ? 'কন্ট্রোল সেন্টার ও সেটিংস' : 'Control Center & Settings')
                    : SETTING_ITEMS.find((i) => i.id === activeTab)?.titleBn || 'Settings'}
                </h3>
                <p className="text-xs text-[#64748b]">
                  {activeTab === 'overview'
                    ? (lang === 'bn' ? 'হোস্টিং প্ল্যাটফর্মের সমস্ত ম্যানেজমেন্ট টুলস ও কনফিগারেশন' : 'Advanced management tools, files and configuration')
                    : SETTING_ITEMS.find((i) => i.id === activeTab)?.descBn || ''}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {activeTab !== 'overview' && (
                <button
                  onClick={() => setActiveTab('overview')}
                  className="px-3 py-1.5 rounded-xl bg-white border border-[#e2e8f0] text-xs font-semibold text-[#64748b] hover:text-[#1e293b] hover:bg-[#f1f5f9] transition-all cursor-pointer hidden sm:flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{lang === 'bn' ? 'মেন্যুতে ফিরুন' : 'Back to Menu'}</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-[#94a3b8] hover:text-[#1e293b] hover:bg-[#e2e8f0] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Content Body */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-7">
            {activeTab === 'overview' ? (
              <div className="space-y-6">
                {/* User Profile Banner */}
                {currentUser && (
                  <div className="p-4 bg-gradient-to-r from-slate-50 to-blue-50/50 border border-[#e2e8f0] rounded-2xl flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-[#0088cc] text-white flex items-center justify-center font-bold text-base shadow-sm">
                        {currentUser.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-[#1e293b]">{currentUser.name}</h4>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                            {lang === 'bn' ? 'সক্রিয় অ্যাকাউন্ট' : 'Active Account'}
                          </span>
                        </div>
                        <p className="text-xs text-[#64748b] font-mono mt-0.5">{currentUser.email}</p>
                      </div>
                    </div>

                    <div className="text-xs text-[#64748b] flex items-center gap-2">
                      <HardDrive className="w-4 h-4 text-[#0088cc]" />
                      <span>{bots.length} {lang === 'bn' ? 'টি বট হোস্টেড' : 'Bots Hosted'}</span>
                    </div>
                  </div>
                )}

                {/* Bot Selector if editing files */}
                {bots.length > 1 && (
                  <div className="flex items-center justify-between p-3 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl text-xs">
                    <span className="font-semibold text-[#1e293b]">
                      {lang === 'bn' ? 'ডিফল্ট নির্বাচিত বট:' : 'Default Selected Bot:'}
                    </span>
                    <select
                      value={selectedBotId || ''}
                      onChange={(e) => onSelectBot(e.target.value)}
                      className="bg-white border border-[#cbd5e1] rounded-lg px-3 py-1 font-medium text-[#1e293b] cursor-pointer"
                    >
                      {bots.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.status === 'running' ? 'LIVE' : 'OFF'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Settings Grid Items */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {SETTING_ITEMS.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          if (item.isAction && item.action) {
                            item.action();
                          } else {
                            setActiveTab(item.id);
                          }
                        }}
                        className="bg-white border border-[#e2e8f0] hover:border-[#0088cc]/60 hover:shadow-md rounded-2xl p-5 transition-all cursor-pointer flex items-start justify-between gap-3 group"
                      >
                        <div className="flex items-start gap-3.5">
                          <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${item.color} group-hover:scale-105 transition-transform`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-[#1e293b] group-hover:text-[#0088cc] transition-colors">
                              {lang === 'bn' ? item.titleBn : item.titleEn}
                            </h4>
                            <p className="text-xs text-[#64748b] mt-1 leading-relaxed">
                              {lang === 'bn' ? item.descBn : item.descEn}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-[#94a3b8] group-hover:text-[#0088cc] group-hover:translate-x-0.5 transition-all shrink-0 mt-3" />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : activeTab === 'files' ? (
              <ScriptEditor
                lang={lang}
                botId={selectedBot?.id}
                botName={selectedBot?.name}
                onFileSaved={() => {
                  onBotsUpdated();
                }}
              />
            ) : activeTab === 'database' ? (
              <DatabaseManager lang={lang} />
            ) : activeTab === 'services' ? (
              <ServicesManager
                lang={lang}
                botId={selectedBot?.id}
                botName={selectedBot?.name}
              />
            ) : activeTab === 'users' ? (
              <UsersManager lang={lang} />
            ) : activeTab === 'guide' ? (
              <HostingGuide
                lang={lang}
                botId={selectedBot?.id}
                botName={selectedBot?.name}
              />
            ) : null}
          </div>
        </div>
      </div>

      {/* Sub-modals inside settings if opened */}
      {showPip && (
        <PipManagerModal onClose={() => setShowPip(false)} lang={lang} />
      )}
      {showBroadcast && (
        <BroadcastModal isOpen={showBroadcast} onClose={() => setShowBroadcast(false)} lang={lang} />
      )}
    </>
  );
};
