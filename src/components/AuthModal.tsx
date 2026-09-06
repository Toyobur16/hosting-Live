import React, { useState } from 'react';
import { User, Lock, Mail, Shield, AlertCircle, X, LogIn, UserPlus, CheckCircle2 } from 'lucide-react';
import { AuthUser } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onSuccess: (user: AuthUser, token: string) => void;
  canDismiss?: boolean;
  lang?: 'bn' | 'en';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  canDismiss = false,
  lang = 'bn'
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'register') {
      if (!name.trim()) {
        setError(lang === 'bn' ? 'অনুগ্রহ করে আপনার নাম লিখুন' : 'Please enter your full name');
        return;
      }
      if (password !== confirmPassword) {
        setError(lang === 'bn' ? 'পাসওয়ার্ড এবং কনফার্ম পাসওয়ার্ড মিলছে না' : 'Passwords do not match');
        return;
      }
      if (password.length < 6) {
        setError(lang === 'bn' ? 'পাসওয়ার্ড ন্যূনতম ৬ অক্ষরের হতে হবে' : 'Password must be at least 6 characters');
        return;
      }
    }

    setLoading(true);
    try {
      const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const body = mode === 'register' ? { name: name.trim(), email: email.trim(), password } : { email: email.trim(), password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || (lang === 'bn' ? 'ব্যর্থ হয়েছে, পুনরায় চেষ্টা করুন' : 'Authentication failed'));
      }

      localStorage.setItem('bot_auth_token', data.token);
      onSuccess(data.user, data.token);
      if (onClose) onClose();
    } catch (err: any) {
      setError(err.message || 'Error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoAccount = (demoName: string, demoEmail: string) => {
    setName(demoName);
    setEmail(demoEmail);
    setPassword('123456');
    setConfirmPassword('123456');
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0088cc] to-[#006699] p-6 text-white relative">
          {canDismiss && onClose && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">
                {mode === 'login'
                  ? lang === 'bn'
                    ? 'ইউজার লগইন'
                    : 'User Sign In'
                  : lang === 'bn'
                  ? 'নতুন একাউন্ট রেজিস্টার'
                  : 'Create Account'}
              </h2>
              <p className="text-xs text-white/80">
                {lang === 'bn'
                  ? 'ব্যক্তিগত ও সুরক্ষিত টেলিগ্রাম বট হোস্টিং'
                  : 'Private & Isolated Telegram Bot Hosting'}
              </p>
            </div>
          </div>

          {/* Privacy badge */}
          <div className="mt-3 bg-white/10 border border-white/20 rounded-lg p-2.5 text-[11px] leading-relaxed text-white/95 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
            <span>
              {lang === 'bn'
                ? 'সুরক্ষিত ডাটা আইসোলেশন: আপনি লগইন করলে শুধুমাত্র আপনার নিজের বট, কোড ও ফাইল দেখতে পাবেন। অন্য ইউজার আপনার ডকুমেন্ট বা বট কখনোই দেখতে পারবে না।'
                : 'Complete Data Isolation: Only you can view or manage your hosted bots and files. Other users will never see your documents or bots.'}
            </span>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-[#e2e8f0] bg-[#f8fafc]">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`flex-1 py-3 text-xs font-semibold text-center flex items-center justify-center gap-1.5 transition-colors ${
              mode === 'login'
                ? 'text-[#0088cc] border-b-2 border-[#0088cc] bg-white'
                : 'text-[#64748b] hover:text-[#1e293b]'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>{lang === 'bn' ? 'লগইন (Login)' : 'Sign In'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`flex-1 py-3 text-xs font-semibold text-center flex items-center justify-center gap-1.5 transition-colors ${
              mode === 'register'
                ? 'text-[#0088cc] border-b-2 border-[#0088cc] bg-white'
                : 'text-[#64748b] hover:text-[#1e293b]'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{lang === 'bn' ? 'রেজিস্ট্রেশন (Register)' : 'Create Account'}</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-[#1e293b] mb-1.5">
                {lang === 'bn' ? 'আপনার পূর্ণ নাম' : 'Full Name'}
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[#94a3b8] absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={lang === 'bn' ? 'যেমন: রহিম আহমেদ' : 'e.g. John Doe'}
                  className="w-full pl-9 pr-3 py-2.5 text-xs bg-[#f8fafc] border border-[#e2e8f0] rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0088cc] text-[#1e293b]"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#1e293b] mb-1.5">
              {lang === 'bn' ? 'ইমেইল অ্যাড্রেস' : 'Email Address'}
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#94a3b8] absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full pl-9 pr-3 py-2.5 text-xs bg-[#f8fafc] border border-[#e2e8f0] rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0088cc] text-[#1e293b]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1e293b] mb-1.5">
              {lang === 'bn' ? 'পাসওয়ার্ড' : 'Password'}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#94a3b8] absolute left-3 top-3" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2.5 text-xs bg-[#f8fafc] border border-[#e2e8f0] rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0088cc] text-[#1e293b]"
              />
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-[#1e293b] mb-1.5">
                {lang === 'bn' ? 'কনফার্ম পাসওয়ার্ড' : 'Confirm Password'}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#94a3b8] absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2.5 text-xs bg-[#f8fafc] border border-[#e2e8f0] rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0088cc] text-[#1e293b]"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-[#0088cc] hover:bg-[#0077b5] text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <span className="inline-block animate-spin">⏳</span>
            ) : mode === 'login' ? (
              <>
                <LogIn className="w-4 h-4" />
                <span>{lang === 'bn' ? 'লগইন করুন' : 'Sign In Now'}</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>{lang === 'bn' ? 'একাউন্ট তৈরি করুন' : 'Register Account'}</span>
              </>
            )}
          </button>

          {/* Quick Demo Test Buttons */}
          <div className="pt-2 border-t border-[#f1f5f9]">
            <p className="text-[11px] text-[#64748b] text-center mb-2 font-medium">
              {lang === 'bn' ? 'অথবা দ্রুত টেস্ট করার জন্য যেকোনো একটি বেছে নিন:' : 'Or choose a test profile to test multi-user isolation:'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => fillDemoAccount('User 1 (Admin)', 'user1@example.com')}
                className="py-1.5 px-2 bg-[#f8fafc] hover:bg-[#f1f5f9] border border-[#e2e8f0] rounded-lg text-[11px] font-semibold text-[#1e293b] text-center transition-colors cursor-pointer"
              >
                👤 User 1 (Primary)
              </button>
              <button
                type="button"
                onClick={() => fillDemoAccount('User 2 (Isolated)', 'user2@example.com')}
                className="py-1.5 px-2 bg-[#f8fafc] hover:bg-[#f1f5f9] border border-[#e2e8f0] rounded-lg text-[11px] font-semibold text-[#1e293b] text-center transition-colors cursor-pointer"
              >
                👤 User 2 (Secondary)
              </button>
            </div>
            <p className="text-[10px] text-slate-400 text-center mt-1.5">
              {lang === 'bn'
                ? 'টিপস: ইউজার ১ ও ইউজার ২ আলাদা আলাদা বট দেখতে পাবে।'
                : 'Tip: Each user only sees their own bots.'}
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};
