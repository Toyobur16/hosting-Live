import React, { useState } from 'react';
import { Bot, User, Lock, Mail, Eye, EyeOff, ShieldCheck, CheckCircle2, AlertCircle, X, ExternalLink, ArrowRight, RefreshCw } from 'lucide-react';
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
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Cloudflare Turnstile state
  const [turnstileVerified, setTurnstileVerified] = useState(true);

  // Email Verification Screen State
  const [verificationPending, setVerificationPending] = useState(false);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [verificationLink, setVerificationLink] = useState<string | null>(null);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [registeredName, setRegisteredName] = useState('');
  const [emailDelivered, setEmailDelivered] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activationSuccess, setActivationSuccess] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError(lang === 'bn' ? 'সঠিক ইমেইল অ্যাড্রেস প্রদান করুন' : 'Please enter a valid email address');
      return;
    }

    if (password.length < 6) {
      setError(lang === 'bn' ? 'পাসওয়ার্ড ন্যূনতম ৬ অক্ষরের হতে হবে' : 'Password must be at least 6 characters');
      return;
    }

    if (mode === 'register' && !name.trim()) {
      setError(lang === 'bn' ? 'আপনার নাম লিখুন' : 'Please enter your full name');
      return;
    }

    setLoading(true);
    try {
      const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const body = mode === 'register'
        ? { name: name.trim(), email: cleanEmail, password }
        : { email: cleanEmail, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || (lang === 'bn' ? 'ব্যর্থ হয়েছে, পুনরায় চেষ্টা করুন' : 'Authentication failed'));
      }

      // Save persistent token
      localStorage.setItem('bot_auth_token', data.token);

      if (mode === 'register') {
        // Show the Email Verification screen as requested
        setRegisteredEmail(cleanEmail);
        setRegisteredName(name.trim());
        setVerificationToken(data.verificationToken || null);
        setVerificationLink(data.verificationLink || null);
        setEmailDelivered(Boolean(data.emailSent));
        setVerificationPending(true);
      } else {
        // Logged in
        onSuccess(data.user, data.token);
        if (onClose) onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Immediate in-app verification handler
  const handleActivateAccount = async () => {
    if (!verificationToken) {
      setError(lang === 'bn' ? 'ভেরিফিকেশন টোকেন পাওয়া যায়নি' : 'Verification token not found');
      return;
    }
    setActivating(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/verify-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: verificationToken })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Verification failed');
      }

      setActivationSuccess(true);
      setTimeout(() => {
        const token = localStorage.getItem('bot_auth_token') || '';
        onSuccess(data.user, token);
        if (onClose) onClose();
      }, 1200);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActivating(false);
    }
  };

  // Resend verification email
  const handleResendEmail = async () => {
    setResending(true);
    setResendMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: registeredEmail })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to resend');
      }
      setResendMessage(lang === 'bn' ? 'ভেরিফিকেশন লিঙ্ক আবার পাঠানো হয়েছে!' : 'Verification email resent!');
      if (data.verificationToken) {
        setVerificationToken(data.verificationToken);
      }
      if (data.verificationLink) {
        setVerificationLink(data.verificationLink);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setResending(false);
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

        {/* ================= EMAIL VERIFICATION SCREEN ================= */}
        {verificationPending ? (
          <div className="text-center py-2 space-y-4">
            {/* Glowing Mail Icon */}
            <div className="w-16 h-16 rounded-2xl bg-[#1e293b] border border-[#334155] flex items-center justify-center mx-auto shadow-lg shadow-pink-500/10 text-pink-400">
              <Mail className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-white">
                {lang === 'bn' ? 'অ্যাকাউন্ট অ্যাক্টিভ করুন' : 'Verify Your Account'}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {lang === 'bn'
                  ? 'আমরা আপনার ইমেইলে একটি ভেরিফিকেশন লিঙ্ক পাঠিয়েছি:'
                  : 'We sent a verification link to your email:'}
              </p>
              <div className="mt-2 inline-block px-3 py-1 bg-[#1a253b] border border-[#2b3c5e] rounded-xl text-xs font-semibold text-pink-300">
                {registeredEmail}
              </div>
            </div>

            {error && (
              <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs flex items-start gap-2 text-left">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {resendMessage && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-emerald-300 text-xs flex items-center gap-2 text-left">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{resendMessage}</span>
              </div>
            )}

            {activationSuccess ? (
              <div className="p-4 bg-emerald-950/50 border border-emerald-500/40 rounded-2xl text-emerald-300 text-xs space-y-1">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <p className="font-bold text-sm">
                  {lang === 'bn' ? 'অভিনন্দন! একাউন্ট অ্যাক্টিভ হয়েছে' : 'Account Verified!'}
                </p>
                <p className="text-[11px] text-emerald-400/80">
                  {lang === 'bn' ? 'ড্যাশবোর্ডে রিডাইরেক্ট করা হচ্ছে...' : 'Redirecting to your dashboard...'}
                </p>
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                {/* Immediate Activate Now Button */}
                <button
                  type="button"
                  onClick={handleActivateAccount}
                  disabled={activating}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-[#d946ef] via-[#ec4899] to-[#f43f5e] hover:opacity-95 text-white font-bold text-xs rounded-xl shadow-lg shadow-pink-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {activating ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>{lang === 'bn' ? '🚀 একাউন্ট অ্যাক্টিভ করুন (Activate Now)' : '🚀 Activate Account Now'}</span>
                    </>
                  )}
                </button>

                {verificationLink && (
                  <div className="bg-[#0b1220] border border-[#1f2c42] rounded-xl p-2.5 text-left text-[11px] space-y-1">
                    <p className="text-slate-400 font-semibold">
                      {lang === 'bn' ? 'সরাসরি অ্যাক্টিভেশন লিঙ্ক:' : 'Direct Activation Link:'}
                    </p>
                    <a
                      href={verificationLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-400 hover:underline break-all block text-[10px] font-mono"
                    >
                      {verificationLink}
                    </a>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs pt-1">
                  <button
                    type="button"
                    onClick={handleResendEmail}
                    disabled={resending}
                    className="text-slate-400 hover:text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
                    <span>{lang === 'bn' ? 'পুনরায় ইমেইল পাঠান' : 'Resend Email'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setVerificationPending(false);
                      setMode('login');
                    }}
                    className="text-pink-400 hover:underline cursor-pointer font-medium"
                  >
                    {lang === 'bn' ? 'লগইন করুন' : 'Back to Sign In'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ================= MAIN REGISTER / LOGIN FORM ================= */
          <div>
            {/* Top Robot Icon with glow */}
            <div className="w-14 h-14 rounded-2xl bg-[#1a253b]/80 border border-[#2b3c5e] text-sky-400 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-sky-500/10">
              <Bot className="w-7 h-7" />
            </div>

            {/* Title & Subtitle */}
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-white tracking-tight">
                {mode === 'register' ? 'Create Account' : 'Sign In'}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {mode === 'register'
                  ? 'Join thousands of bot creators'
                  : 'Welcome back to your bot cloud'}
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span>{error}</span>
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
                    placeholder="Full Name"
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
                  placeholder="Email Address"
                  className="w-full bg-[#0b1220] border border-[#1f2d48] focus:border-[#ec4899] rounded-xl text-white placeholder-slate-500 py-3 pl-10 pr-4 text-xs focus:outline-none transition-all"
                />
              </div>

              {/* Password field */}
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password (min 6 chars)"
                  className="w-full bg-[#0b1220] border border-[#1f2d48] focus:border-[#ec4899] rounded-xl text-white placeholder-slate-500 py-3 pl-10 pr-10 text-xs focus:outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Terms Checkbox in Register Mode */}
              {mode === 'register' && (
                <label className="flex items-start gap-2 pt-1 cursor-pointer select-none text-[11px] text-slate-400">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    className="mt-0.5 rounded border-slate-700 bg-[#0b1220] text-pink-500 focus:ring-pink-500"
                  />
                  <span>
                    By creating an account, you agree to our{' '}
                    <span className="text-slate-300 hover:underline">Terms</span> and{' '}
                    <span className="text-slate-300 hover:underline">Privacy Policy</span>
                  </span>
                </label>
              )}

              {/* Cloudflare Turnstile Box (matches screenshot) */}
              <div className="bg-[#090e1a] border border-[#1e2a42] rounded-xl px-4 py-2.5 flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-semibold text-slate-300">
                    Success!
                  </span>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-[11px] font-bold text-amber-500 uppercase tracking-wide">
                    <span>☁️</span>
                    <span>CLOUDFLARE</span>
                  </div>
                  <p className="text-[9px] text-slate-500">Privacy • Terms</p>
                </div>
              </div>

              {/* Gradient Submit Button */}
              <button
                type="submit"
                disabled={loading || (mode === 'register' && !agreeTerms)}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-[#d946ef] via-[#ec4899] to-[#f43f5e] hover:opacity-95 text-white font-bold text-xs rounded-xl shadow-lg shadow-pink-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-4"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : mode === 'register' ? (
                  <>
                    <span>Create Account</span>
                    <span className="text-sm">👤+</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <span className="text-sm">🚀</span>
                  </>
                )}
              </button>
            </form>

            {/* Switch Mode Link */}
            <div className="text-center mt-5">
              {mode === 'register' ? (
                <p className="text-xs text-slate-400">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError(null);
                    }}
                    className="text-pink-400 hover:text-pink-300 font-semibold hover:underline cursor-pointer ml-1"
                  >
                    Sign In Here
                  </button>
                </p>
              ) : (
                <p className="text-xs text-slate-400">
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      setError(null);
                    }}
                    className="text-pink-400 hover:text-pink-300 font-semibold hover:underline cursor-pointer ml-1"
                  >
                    Create Account Here
                  </button>
                </p>
              )}
            </div>

            {/* Need Help link */}
            <div className="border-t border-[#1f2c42] mt-5 pt-4 text-center">
              <a
                href="https://t.me"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-slate-400 hover:text-slate-300 flex items-center justify-center gap-1 transition-colors"
              >
                <span>Need Help? Contact Support</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
