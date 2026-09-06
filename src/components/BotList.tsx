import React, { useState } from 'react';
import { Play, Square, RotateCw, Trash2, Download, Terminal, Radio, Check, Copy, Plus, FileCode, CheckCircle2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { HostedBot } from '../types';

interface BotListProps {
  bots: HostedBot[];
  selectedBotId: string | null;
  onSelectBot: (botId: string) => void;
  onStartBot: (botId: string) => void;
  onStopBot: (botId: string) => void;
  onRestartBot: (botId: string) => void;
  onDeleteBot: (botId: string) => void;
  onOpenNewBotModal: () => void;
  lang: 'bn' | 'en';
}

export const BotList: React.FC<BotListProps> = ({
  bots,
  selectedBotId,
  onSelectBot,
  onStartBot,
  onStopBot,
  onRestartBot,
  onDeleteBot,
  onOpenNewBotModal,
  lang
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [botToDelete, setBotToDelete] = useState<HostedBot | null>(null);

  const formatUptime = (seconds: number) => {
    if (!seconds) return '0s';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  const handleCopyPing = (e: React.MouseEvent, botId: string) => {
    e.stopPropagation();
    const url = `${window.location.origin}/api/keepalive/${botId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(botId);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="space-y-4">
      {/* Bot Deletion Modal */}
      {botToDelete && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mb-3">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-[#1e293b]">
              {lang === 'bn' ? 'বট ডিলিট নিশ্চিত করুন' : 'Confirm Bot Deletion'}
            </h4>
            <p className="text-xs text-[#64748b] mt-1.5 leading-relaxed">
              {lang === 'bn'
                ? `আপনি কি নিশ্চিত যে '${botToDelete.name}' বট এবং এর সমস্ত হোস্ট ফাইল স্থায়ীভাবে ডিলিট করতে চান?`
                : `Are you sure you want to permanently delete '${botToDelete.name}' and all its hosted files?`}
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setBotToDelete(null)}
                className="px-3.5 py-2 rounded-xl bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#1e293b] text-xs font-semibold border border-[#e2e8f0] cursor-pointer"
              >
                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                onClick={() => {
                  onDeleteBot(botToDelete.id);
                  setBotToDelete(null);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-rose-600/20 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'বট ডিলিট করুন' : 'Delete Bot'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 24/7 Live Banner & Action */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-[#e2e8f0] p-5 rounded-2xl shadow-xs">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h2 className="text-base font-bold text-[#1e293b]">
              {lang === 'bn' ? 'হোস্ট করা টেলিগ্রাম বটসমূহ' : 'Hosted Telegram Bots'}
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#0088cc]/10 text-[#0088cc] border border-[#0088cc]/20 font-semibold">
              {bots.length} {lang === 'bn' ? 'টি বট' : 'Bots'}
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              {lang === 'bn' ? '২৪/৭ অটো-রানিং (অফলাইনেও লাইভ)' : '24/7 Background Live (Works Offline)'}
            </span>
          </div>
          <p className="text-xs text-[#64748b] leading-relaxed">
            {lang === 'bn'
              ? 'আপনার বট ক্লাউড ব্যাকগ্রাউন্ডে সর্বক্ষণ সক্রিয় থাকে। আপনি ব্রাউজার কেটে দিলে বা অফলাইনে গেলেও বট বন্ধ হবে না। ক্র্যাশ হলে ওয়াচডগ স্বয়ংক্রিয়ভাবে রিস্টার্ট করে।'
              : 'All your bots run autonomously 24/7 in the cloud background. They remain live even when you go offline or close the browser.'}
          </p>
        </div>

        <button
          onClick={onOpenNewBotModal}
          className="px-4 py-2.5 rounded-xl bg-[#0088cc] hover:bg-[#0077b5] text-white text-xs font-semibold shadow-sm shadow-[#0088cc]/20 flex items-center gap-2 cursor-pointer transition-all hover:scale-[1.02]"
        >
          <Plus className="w-4 h-4" />
          <span>{lang === 'bn' ? '+ নতুন বট হোস্ট করুন' : '+ Deploy New Bot'}</span>
        </button>
      </div>

      {/* Bots Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {bots.map((bot) => {
          const isSelected = bot.id === selectedBotId;
          const isRunning = bot.status === 'running';
          const isStarting = bot.status === 'starting';

          return (
            <div
              key={bot.id}
              onClick={() => onSelectBot(bot.id)}
              className={`bg-white border rounded-2xl p-5 shadow-xs transition-all cursor-pointer flex flex-col justify-between relative ${
                isSelected
                  ? 'border-[#0088cc] ring-2 ring-[#0088cc]/20'
                  : 'border-[#e2e8f0] hover:border-[#cbd5e1]'
              }`}
            >
              <div>
                {/* Header: Name & Status */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-[#1e293b] truncate" title={bot.name}>
                        {bot.name}
                      </h3>
                      {isSelected && (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-[#0088cc] text-white shrink-0">
                          {lang === 'bn' ? 'সিলেক্টেড' : 'Selected'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-mono text-[#64748b] flex items-center gap-1">
                        <FileCode className="w-3.5 h-3.5 text-[#94a3b8]" />
                        {bot.entryFile}
                      </span>
                      {bot.botUsername && (
                        <span className="text-[11px] font-semibold text-[#0088cc] flex items-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3 text-[#0088cc]" />
                          @{bot.botUsername}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider shrink-0 ${
                      isRunning
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : isStarting
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isRunning ? 'bg-emerald-500 animate-pulse' : isStarting ? 'bg-amber-500' : 'bg-rose-500'
                      }`}
                    ></span>
                    {isRunning
                      ? (lang === 'bn' ? '২৪/৭ লাইভ' : '24/7 LIVE')
                      : isStarting
                      ? (lang === 'bn' ? 'স্টার্ট হচ্ছে' : 'STARTING')
                      : (lang === 'bn' ? 'বন্ধ' : 'STOPPED')}
                  </span>
                </div>

                {/* 24/7 Cloud details */}
                <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3 text-xs text-[#64748b] space-y-1.5 mb-4">
                  <div className="flex items-center justify-between">
                    <span>{lang === 'bn' ? 'আপটাইম (লাইভ সময়):' : 'Live Uptime:'}</span>
                    <span className="font-mono text-[#1e293b] font-semibold">
                      {isRunning ? formatUptime(bot.uptimeSeconds) : '0s'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{lang === 'bn' ? 'হোস্ট করা ফাইলসমূহ:' : 'Hosted Files:'}</span>
                    <span className="font-mono text-[#1e293b]">{bot.fileCount || 1} files</span>
                  </div>
                  {bot.ownerName && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span>{lang === 'bn' ? 'মালিকানা (Owner):' : 'Owner:'}</span>
                      <span className="font-medium text-[#0088cc]">👤 {bot.ownerName}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[#e2e8f0]">
                    <span className="text-emerald-700 font-medium flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      {lang === 'bn' ? 'অটো-রিস্টার্ট সুরক্ষা:' : 'Auto-Restart:'}
                    </span>
                    <span className="text-emerald-700 font-bold">
                      {lang === 'bn' ? 'সক্রিয় (২৪/৭)' : 'Active (24/7)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Start, Stop, Restart, Download, Ping, and prominent DELETE */}
              <div className="pt-3 border-t border-[#f1f5f9] flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1">
                  {isRunning ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onStopBot(bot.id);
                      }}
                      className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer"
                      title={lang === 'bn' ? 'বট বন্ধ করুন' : 'Stop Bot'}
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartBot(bot.id);
                      }}
                      className="p-2 rounded-xl bg-[#0088cc] hover:bg-[#0077b5] text-white shadow-xs transition-colors cursor-pointer"
                      title={lang === 'bn' ? 'বট চালু করুন (২৪/৭)' : 'Start Bot (24/7)'}
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </button>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRestartBot(bot.id);
                    }}
                    className="p-2 rounded-xl bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#64748b] border border-[#e2e8f0] transition-colors cursor-pointer"
                    title={lang === 'bn' ? 'রিস্টার্ট করুন' : 'Restart Bot'}
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>

                  <a
                    href={`/api/bots/${bot.id}/export/zip`}
                    onClick={(e) => e.stopPropagation()}
                    download
                    className="p-2 rounded-xl bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#64748b] border border-[#e2e8f0] transition-colors cursor-pointer"
                    title={lang === 'bn' ? 'জিপ ফাইল ডাউনলোড করুন' : 'Download Zip'}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>

                  <button
                    onClick={(e) => handleCopyPing(e, bot.id)}
                    className="p-2 rounded-xl bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#64748b] border border-[#e2e8f0] transition-colors cursor-pointer"
                    title={lang === 'bn' ? '২৪/৭ কিপ-অ্যালাইভ পিং লিঙ্ক কপি করুন' : 'Copy 24/7 KeepAlive URL'}
                  >
                    {copiedId === bot.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Radio className="w-3.5 h-3.5 text-[#0088cc]" />}
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectBot(bot.id);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#0088cc]/10 text-[#0088cc]'
                        : 'bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#64748b]'
                    }`}
                  >
                    {lang === 'bn' ? 'কনসোল' : 'Console'}
                  </button>

                  {/* PROMINENT DELETE BUTTON (Available for all bots) */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setBotToDelete(bot);
                    }}
                    className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors cursor-pointer"
                    title={lang === 'bn' ? `'${bot.name}' হোস্ট ও ফাইল ডিলিট করুন` : `Delete bot '${bot.name}'`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
