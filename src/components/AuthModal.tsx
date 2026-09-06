import React, { useState } from 'react';
import { Bot, User, Lock, Mail, Eye, EyeOff, CheckCircle2, AlertCircle, X, ExternalLink, RefreshCw, KeyRound } from 'lucide-react';
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
  // Always default to 'login' mode first
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError(lang === 'bn' ? 'সঠিক ইমেইল অ্যাড্রেস প্রদান করুন' : 'Please enter a valid email address');
      return;
    }

    if (mode === 'register') {
      if (!name.trim()) {
        setError(lang === 'bn' ? 'আপনার নাম লিখুন' : 'Please enter your full name');
        return;
      }
      if (password.length < 6) {
        setError(lang === 'bn' ? 'পাসওয়ার্ড ন্যূনতম ৬ অক্ষরের হতে হবে' : 'Password must be at least 6 characters');
        return;
      }
      if (password !== confirmPassword) {
        setError(lang === 'bn' ? 'পাসওয়ার্ড ও কনফার্ম পাসওয়ার্ড মিলছে না! দয়া করে উভয় জায়গায় একই পাসওয়ার্ড দিন।' : 'Passwords do not match! Please enter identical passwords.');
        return;
      }
    }

    if (mode === 'login') {
      if (!password) {
        setError(lang === 'bn' ? 'পাসওয়ার্ড প্রদান করুন' : 'Please enter your password');
        return;
      }
    }

    if (mode === 'reset') {
      if (newPassword.length < 6) {
        setError(lang === 'bn' ? 'নতুন পাসওয়ার্ড ন্যূনতম ৬ অক্ষরের হতে হবে' : 'New password must be at least 6 characters');
        return;
      }
      if (newPassword !== confirmNewPassword) {
        setError(lang === 'bn' ? 'নতুন পাসওয়ার্ড ও কনফার্ম পাসওয়ার্ড মিলছে না!' : 'New passwords do not match!');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'register') {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), email: cleanEmail, password })
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || (lang === 'bn' ? 'রেজিস্ট্রেশন সম্পন্ন করা যায়নি' : 'Registration failed'));
        }

        // Switch to Login screen immediately with prefilled email
        setMode('login');
        setEmail(cleanEmail);
        setPassword('');
        setConfirmPassword('');
        setSuccessMessage(
          lang === 'bn'
            ? '✓ রেজিস্ট্রেশন সফল হয়েছে! এখন আপনার পাসওয়ার্ড দিয়ে সাইন ইন (লগইন) করুন।'
            : '✓ Registration successful! Please enter your password to sign in.'
        );
      } else if (mode === 'login') {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, password })
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || (lang === 'bn' ? 'লগইন ব্যর্থ হয়েছে, সঠিক তথ্য দিন' : 'Login failed'));
        }

        localStorage.setItem('bot_auth_token', data.token);
        onSuccess(data.user, data.token);
        if (onClose) onClose();
      } else if (mode === 'reset') {
        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, newPassword })
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || (lang === 'bn' ? 'পাসওয়ার্ড পরিবর্তন করা যায়নি' : 'Password reset failed'));
        }

        localStorage.setItem('bot_auth_token', data.token);
        onSuccess(data.user, data.token);
        if (onClose) onClose();
      }
    } catch (err: any) {
      setError(err.message || 'অনাকাঙ্ক্ষিত সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#050811]/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#111927] border border-[#1f2c42] shadow-2xl rounded-3xl max-w-[420px] w-full p-7 text-white relative overflow-hidden">
        {/* Subtle Top Ambient Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-60 h-24 bg-gradient-to-b from-fuchsia-500/15 via-pink-500/10 to-transparent blur-2xl pointer-events-none" />

        {canDismiss && onClose && (
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-xl hover:bg-slate-800 transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Header with Robot Icon */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-[#1e293b] border border-[#334155] flex items-center justify-center mx-auto mb-3 shadow-lg shadow-pink-500/10 text-pink-400">
            <Bot className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            {mode === 'login'
              ? (lang === 'bn' ? 'লগইন করুন' : 'Sign In')
              : mode === 'register'
              ? (lang === 'bn' ? 'রেজিস্ট্রেশন করুন' : 'Create Account')
              : (lang === 'bn' ? 'পাসওয়ার্ড রিসেট করুন' : 'Reset Password')}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {mode === 'login'
              ? (lang === 'bn' ? 'আপনার অ্যাকাউন্টে প্রবেশ করতে ইমেইল ও পাসওয়ার্ড দিন' : 'Welcome back to your bot cloud')
              : mode === 'register'
              ? (lang === 'bn' ? 'বিনামূল্যে অ্যাকাউন্ট তৈরি করে ২৪/৭ বট হোস্ট করুন' : 'Join and host unlimited bots')
              : (lang === 'bn' ? 'আপনার ইমেইল ও নতুন পাসওয়ার্ড প্রদান করুন' : 'Enter your registered email and new password')}
          </p>
        </div>

        {/* Success Message Banner */}
        {successMessage && (
          <div className="mb-4 p-3 bg-emerald-950/50 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Error Message Banner */}
        {error && (
          <div className="mb-4 p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <div className="flex-1">
              <span>{error}</span>
              {mode === 'login' && error.includes('পাসওয়ার্ড') && (
                <div className="mt-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('reset');
                      setError(null);
                    }}
                    className="text-pink-400 hover:text-pink-300 font-semibold underline text-[11px] cursor-pointer"
                  >
                    {lang === 'bn' ? '🔑 ভুলে গেছেন? নতুন পাসওয়ার্ড সেট করুন' : '🔑 Reset your password now'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Full Name field (Only in Register mode) */}
          {mode === 'register' && (
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={lang === 'bn' ? 'আপনার নাম (Full Name)' : 'Full Name'}
                className="w-full bg-[#0b1220] border border-[#1f2d48] focus:border-[#ec4899] rounded-xl text-white placeholder-slate-500 py-3 pl-10 pr-4 text-xs focus:outline-none transition-all"
              />
            </div>
          )}

          {/* Email Address field */}
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={lang === 'bn' ? 'ইমেইল অ্যাড্রেস (Email Address)' : 'Email Address'}
              className="w-full bg-[#0b1220] border border-[#1f2d48] focus:border-[#ec4899] rounded-xl text-white placeholder-slate-500 py-3 pl-10 pr-4 text-xs focus:outline-none transition-all"
            />
          </div>

          {/* Password field (in Login and Register modes) */}
          {mode !== 'reset' && (
            <div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    mode === 'register'
                      ? (lang === 'bn' ? 'পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)' : 'Password (min 6 chars)')
                      : (lang === 'bn' ? 'আপনার পাসওয়ার্ড লিখুন' : 'Enter Password')
                  }
                  className="w-full bg-[#0b1220] border border-[#1f2d48] focus:border-[#ec4899] rounded-xl text-white placeholder-slate-500 py-3 pl-10 pr-10 text-xs focus:outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-white transition-colors"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Forgot Password Link in Login mode */}
              {mode === 'login' && (
                <div className="flex justify-end mt-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('reset');
                      setError(null);
                      setSuccessMessage(null);
                    }}
                    className="text-[11px] text-pink-400 hover:text-pink-300 transition-colors cursor-pointer"
                  >
                    {lang === 'bn' ? 'পাসওয়ার্ড ভুলে গেছেন?' : 'Forgot Password?'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Confirm Password field (Only in Register mode) */}
          {mode === 'register' && (
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={lang === 'bn' ? 'কনফার্ম পাসওয়ার্ড (একই পাসওয়ার্ড লিখুন)' : 'Confirm Password'}
                className="w-full bg-[#0b1220] border border-[#1f2d48] focus:border-[#ec4899] rounded-xl text-white placeholder-slate-500 py-3 pl-10 pr-10 text-xs focus:outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-3 text-slate-400 hover:text-white transition-colors"
                title={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          )}

          {/* New Password & Confirm New Password in Reset mode */}
          {mode === 'reset' && (
            <>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={lang === 'bn' ? 'নতুন পাসওয়ার্ড (ন্যূনতম ৬ অক্ষর)' : 'Enter New Password'}
                  className="w-full bg-[#0b1220] border border-[#1f2d48] focus:border-[#ec4899] rounded-xl text-white placeholder-slate-500 py-3 pl-10 pr-10 text-xs focus:outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-white transition-colors"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder={lang === 'bn' ? 'কনফার্ম নতুন পাসওয়ার্ড' : 'Confirm New Password'}
                  className="w-full bg-[#0b1220] border border-[#1f2d48] focus:border-[#ec4899] rounded-xl text-white placeholder-slate-500 py-3 pl-10 pr-10 text-xs focus:outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-white transition-colors"
                  title={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </>
          )}

          {/* Gradient Action Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-[#d946ef] via-[#ec4899] to-[#f43f5e] hover:opacity-95 text-white font-bold text-xs rounded-xl shadow-lg shadow-pink-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-4"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : mode === 'login' ? (
              <>
                <span>{lang === 'bn' ? 'লগইন করুন' : 'Sign In'}</span>
                <span className="text-sm">🚀</span>
              </>
            ) : mode === 'register' ? (
              <>
                <span>{lang === 'bn' ? 'রেজিস্ট্রেশন করুন' : 'Register Now'}</span>
                <span className="text-sm">👤+</span>
              </>
            ) : (
              <>
                <span>{lang === 'bn' ? 'পাসওয়ার্ড আপডেট ও লগইন' : 'Update Password & Sign In'}</span>
                <span className="text-sm">✓</span>
              </>
            )}
          </button>
        </form>

        {/* Switch Between Login, Register, and Reset */}
        <div className="text-center mt-5">
          {mode === 'login' ? (
            <p className="text-xs text-slate-400">
              {lang === 'bn' ? 'অ্যাকাউন্ট নেই?' : "Don't have an account?"}{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(null);
                  setSuccessMessage(null);
                  setPassword('');
                  setConfirmPassword('');
                }}
                className="text-pink-400 hover:text-pink-300 font-semibold hover:underline cursor-pointer ml-1"
              >
                {lang === 'bn' ? 'রেজিস্ট্রেশন করুন (Create Account)' : 'Create Account Here'}
              </button>
            </p>
          ) : mode === 'register' ? (
            <p className="text-xs text-slate-400">
              {lang === 'bn' ? 'ইতিমধ্যে অ্যাকাউন্ট আছে?' : 'Already have an account?'}{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                  setSuccessMessage(null);
                }}
                className="text-pink-400 hover:text-pink-300 font-semibold hover:underline cursor-pointer ml-1"
              >
                {lang === 'bn' ? 'লগইন করুন (Sign In)' : 'Sign In Here'}
              </button>
            </p>
          ) : (
            <p className="text-xs text-slate-400">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                  setSuccessMessage(null);
                }}
                className="text-pink-400 hover:text-pink-300 font-semibold hover:underline cursor-pointer"
              >
                {lang === 'bn' ? '← লগইনে ফিরে যান (Back to Sign In)' : '← Back to Sign In'}
              </button>
            </p>
          )}
        </div>

        {/* Support link */}
        <div className="border-t border-[#1f2c42] mt-5 pt-4 text-center">
          <a
            href="https://t.me"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-slate-400 hover:text-slate-300 flex items-center justify-center gap-1 transition-colors"
          >
            <span>২৪/৭ টেলিগ্রাম সাপোর্ট (Support)</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
};
