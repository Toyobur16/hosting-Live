import React, { useState, useEffect } from 'react';
import { Database, Download, RefreshCw, CheckCircle2, Clock, Users, Bot, HardDrive, ShieldCheck, AlertCircle, FileText, ExternalLink } from 'lucide-react';

interface DatabaseOverview {
  storageLocation: {
    accountsDb: string;
    registryDb: string;
    sessionsDb: string;
    botsStorage: string;
  };
  stats: {
    totalUsers: number;
    verifiedUsers: number;
    totalBots: number;
    runningBots: number;
    activeSessions: number;
  };
  accounts: Array<{
    id: string;
    name: string;
    email: string;
    isVerified: boolean;
    createdAt: string;
    botsCount: number;
  }>;
  bots: Array<{
    id: string;
    name: string;
    ownerId?: string;
    ownerName?: string;
    status: string;
    autoRestart: boolean;
    createdAt: string;
  }>;
}

interface DatabaseManagerProps {
  lang: 'bn' | 'en';
}

export const DatabaseManager: React.FC<DatabaseManagerProps> = ({ lang }) => {
  const [data, setData] = useState<DatabaseOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/database/overview');
      if (!res.ok) throw new Error('Failed to load database overview');
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#0d1527] to-[#121c33] border border-[#1f2c47] rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/10">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                {lang === 'bn' ? 'ডাটাবেজ ও ক্লাউড স্টোরেজ ম্যানেজমেন্ট' : 'Database & Cloud Storage Management'}
              </h2>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                {lang === 'bn'
                  ? 'আপনার অ্যাপ্লিকেশনের সমস্ত অ্যাকাউন্ট, সেশন এবং বট রেজিস্ট্রেশন সার্ভার-সাইড ক্লাউড ফাইলে পারসিস্ট্যান্টভাবে সংরক্ষিত হয়। রিফ্রেশ করলেও ডাটা নষ্ট হবে না।'
                  : 'All user accounts, sessions, and bot registries are durably saved server-side. Data remains safe and permanent across page refreshes and server reboots.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchOverview}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-[#1a243a] hover:bg-[#23314d] text-slate-200 border border-[#263756] transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{lang === 'bn' ? 'রিফ্রেশ' : 'Refresh'}</span>
            </button>
            <a
              href="/api/database/export?table=all"
              download="bothost_database_backup.json"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'সম্পূর্ণ ডাটাবেজ ব্যাকআপ (JSON)' : 'Export Backup (JSON)'}</span>
            </a>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-[#0f172a] border border-[#1f2c47] rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">
                {lang === 'bn' ? 'মোট নিবন্ধিত ইউজার' : 'Total Accounts'}
              </span>
              <Users className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-2xl font-bold text-white mt-2">{data.stats.totalUsers}</p>
            <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>{data.stats.verifiedUsers} {lang === 'bn' ? 'ভেরিফাইড অ্যাকাউন্ট' : 'Verified'}</span>
            </p>
          </div>

          <div className="bg-[#0f172a] border border-[#1f2c47] rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">
                {lang === 'bn' ? 'হোস্ট করা বট' : 'Hosted Bots'}
              </span>
              <Bot className="w-4 h-4 text-indigo-400" />
            </div>
            <p className="text-2xl font-bold text-white mt-2">{data.stats.totalBots}</p>
            <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>{data.stats.runningBots} {lang === 'bn' ? 'বর্তমানে রানিং' : 'Running Now'}</span>
            </p>
          </div>

          <div className="bg-[#0f172a] border border-[#1f2c47] rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">
                {lang === 'bn' ? 'অ্যাক্টিভ সেশন' : 'Active Sessions'}
              </span>
              <Clock className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-2xl font-bold text-white mt-2">{data.stats.activeSessions}</p>
            <p className="text-[11px] text-slate-400 mt-1">
              {lang === 'bn' ? '৯০ দিনের পারসিস্ট্যান্ট টোকেন' : '90-Day persistent auth'}
            </p>
          </div>

          <div className="bg-[#0f172a] border border-[#1f2c47] rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">
                {lang === 'bn' ? 'স্টোরেজ ড্রাইভ' : 'Storage Drive'}
              </span>
              <HardDrive className="w-4 h-4 text-cyan-400" />
            </div>
            <p className="text-sm font-semibold text-slate-200 mt-2 truncate">
              hosted_bots/
            </p>
            <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              <span>{lang === 'bn' ? 'সুরক্ষিত আইসোলেশন' : 'Safe Isolated'}</span>
            </p>
          </div>
        </div>
      )}

      {/* Database File Locations Card */}
      <div className="bg-[#0f172a] border border-[#1f2c47] rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
          <Database className="w-4 h-4 text-indigo-400" />
          <span>{lang === 'bn' ? 'ডাটাবেজ ফাইল লোকেশন ও ডাউনলোড লিঙ্ক' : 'Database Storage Files & Direct Links'}</span>
        </h3>
        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          {lang === 'bn'
            ? 'সার্ভারে আপনার ডাটাবেজ ফাইলগুলো নিচের পাথে সুরক্ষিত রয়েছে। আপনি যেকোনো সময় নিচের সরাসরি লিঙ্ক থেকে সম্পূর্ণ ডাটাবেজ ডাউনলোড বা ব্যাকআপ নিতে পারেন:'
            : 'Your persistent database records are stored at the following server-side paths. You can view or download them anytime:'}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-[#131b2e] border border-[#23314d] rounded-xl p-3.5 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold text-white">Accounts Database</span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">hosted_bots/accounts.json</p>
            </div>
            <a
              href="/api/database/export?table=accounts"
              download="accounts.json"
              className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <Download className="w-3 h-3" />
              <span>{lang === 'bn' ? 'ডাউনলোড' : 'Download'}</span>
            </a>
          </div>

          <div className="bg-[#131b2e] border border-[#23314d] rounded-xl p-3.5 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-white">Bots Registry Database</span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">hosted_bots/registry.json</p>
            </div>
            <a
              href="/api/database/export?table=bots"
              download="bots_registry.json"
              className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <Download className="w-3 h-3" />
              <span>{lang === 'bn' ? 'ডাউনলোড' : 'Download'}</span>
            </a>
          </div>
        </div>
      </div>

      {/* Users Database Table */}
      <div className="bg-[#0f172a] border border-[#1f2c47] rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-400" />
            <span>{lang === 'bn' ? 'নিবন্ধিত ইউজার ডাটাবেজ রেকর্ড' : 'Registered Users Database Table'}</span>
          </h3>
          <span className="text-xs text-slate-400">
            {data?.accounts.length || 0} {lang === 'bn' ? 'টি একাউন্ট পাওয়া গেছে' : 'records found'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#131b2e] text-slate-400 border-b border-[#1f2c47]">
              <tr>
                <th className="py-2.5 px-3 font-semibold">User ID</th>
                <th className="py-2.5 px-3 font-semibold">Name</th>
                <th className="py-2.5 px-3 font-semibold">Email</th>
                <th className="py-2.5 px-3 font-semibold">Status</th>
                <th className="py-2.5 px-3 font-semibold">Bots</th>
                <th className="py-2.5 px-3 font-semibold">Created Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a253b]">
              {data && data.accounts.length > 0 ? (
                data.accounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-[#131b2e]/50 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">{acc.id}</td>
                    <td className="py-2.5 px-3 font-medium text-white">{acc.name}</td>
                    <td className="py-2.5 px-3 text-slate-300">{acc.email}</td>
                    <td className="py-2.5 px-3">
                      {acc.isVerified ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          <span>{lang === 'bn' ? 'ভেরিফাইড' : 'Verified'}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Clock className="w-2.5 h-2.5" />
                          <span>{lang === 'bn' ? 'অপেক্ষারত' : 'Pending Verification'}</span>
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-indigo-400">{acc.botsCount}</td>
                    <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                      {new Date(acc.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500">
                    {lang === 'bn' ? 'কোনো অ্যাকাউন্ট পাওয়া যায়নি' : 'No user accounts found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
