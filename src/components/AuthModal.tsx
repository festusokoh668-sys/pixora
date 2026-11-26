import React, { useState, useEffect } from 'react';
import {
  X,
  User as UserIcon,
  Mail,
  Lock,
  ArrowRight,
  LogOut,
  FolderHeart,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
  sendPasswordReset,
  signOutUser,
  formatAuthError,
} from '../firebase/auth';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  initialMode?: 'signin' | 'signup' | 'forgot' | 'profile';
  promptMessage?: string;
  onSuccess?: () => void;
  onOpenCloudGallery?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  user,
  initialMode = 'signin',
  promptMessage,
  onSuccess,
  onOpenCloudGallery,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot' | 'profile'>(
    user ? 'profile' : initialMode
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMode(user ? 'profile' : initialMode);
      setError(null);
      setSuccessInfo(null);
    }
  }, [isOpen, user, initialMode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessInfo(null);
    setLoading(true);

    try {
      if (mode === 'signin') {
        if (!email.trim() || !password) {
          setError('Please provide both email and password.');
          setLoading(false);
          return;
        }
        await signInWithEmail(email, password);
        onSuccess?.();
        onClose();
      } else if (mode === 'signup') {
        if (!email.trim() || !password) {
          setError('Please provide both email and password.');
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters.');
          setLoading(false);
          return;
        }
        await signUpWithEmail(email, password, displayName);
        onSuccess?.();
        onClose();
      } else if (mode === 'forgot') {
        if (!email.trim()) {
          setError('Please enter your email address to receive a password reset link.');
          setLoading(false);
          return;
        }
        await sendPasswordReset(email);
        setSuccessInfo('Password reset instructions have been sent to your email.');
      }
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setSuccessInfo(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await signOutUser();
      setMode('signin');
      setSuccessInfo('You have been signed out.');
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[#FBFBFB] dark:bg-[#1E232D] border border-[#A0A0A0] dark:border-[#3E485C] shadow-2xl rounded-lg overflow-hidden text-[#1E1E1E] dark:text-[#E2E8F0] font-sans"
      >
        {/* Windows Paint Style Dialog Header */}
        <div className="bg-white dark:bg-[#161B22] px-4 py-3 border-b border-[#D8D8D8] dark:border-[#2D333B] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-[#1979CA] text-white flex items-center justify-center">
              <UserIcon className="w-3.5 h-3.5" />
            </div>
            <h2 id="auth-modal-title" className="text-[14px] font-semibold tracking-tight">
              {mode === 'profile'
                ? 'Pixora Account'
                : mode === 'signup'
                ? 'Create Pixora Account'
                : mode === 'forgot'
                ? 'Reset Password'
                : 'Sign In to Pixora'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#E5F1FB] dark:hover:bg-[#2D333B] text-[#555] dark:text-[#A0AEC0] cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Friendly Context Banner if prompted */}
        {promptMessage && mode !== 'profile' && (
          <div className="bg-[#EFF6FF] dark:bg-[#1E2A38] px-4 py-2.5 border-b border-[#BFDBFE] dark:border-[#2B3B4E] text-[12px] text-[#1D4ED8] dark:text-[#93C5FD] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 text-[#2563EB]" />
            <span>{promptMessage}</span>
          </div>
        )}

        <div className="p-5">
          {/* Status feedback */}
          {error && (
            <div
              data-testid="auth-error-banner"
              className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded text-[12px] text-red-700 dark:text-red-300 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successInfo && (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 rounded text-[12px] text-green-700 dark:text-green-300 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successInfo}</span>
            </div>
          )}

          {/* PROFILE VIEW */}
          {mode === 'profile' && user ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3.5 p-3.5 bg-white dark:bg-[#252C37] rounded-md border border-[#E2E8F0] dark:border-[#374151]">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-12 h-12 rounded-full object-cover border border-[#CBD5E1]"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-[#1979CA] text-white flex items-center justify-center text-lg font-bold">
                    {(user.displayName || user.email || 'P')[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-[14px] truncate">
                    {user.displayName || 'Pixora Artist'}
                  </div>
                  <div className="text-[12px] text-[#64748B] dark:text-[#94A3B8] truncate">
                    {user.email}
                  </div>
                  <div className="text-[10px] text-[#94A3B8] dark:text-[#64748B] font-mono mt-0.5">
                    UID: {user.uid.slice(0, 10)}...
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                {onOpenCloudGallery && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenCloudGallery();
                    }}
                    className="col-span-2 py-2 px-3 bg-[#1979CA] hover:bg-[#1464A8] text-white text-[12px] font-medium rounded flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors"
                  >
                    <FolderHeart className="w-4 h-4" />
                    <span>View My Cloud Artwork</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={loading}
                  className="col-span-2 py-2 px-3 border border-[#CBD5E1] dark:border-[#475569] hover:bg-[#F1F5F9] dark:hover:bg-[#2D3748] text-[12px] font-medium rounded flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  {loading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <LogOut className="w-3.5 h-3.5 text-red-500" />
                  )}
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          ) : (
            /* SIGN IN / SIGN UP / FORGOT FORMS */
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {mode === 'signup' && (
                <div>
                  <label className="block text-[11px] font-semibold text-[#475569] dark:text-[#94A3B8] mb-1">
                    Display Name
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 absolute left-2.5 top-2.5 text-[#94A3B8]" />
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. Leonardo"
                      className="w-full pl-9 pr-3 py-1.5 text-[12px] bg-white dark:bg-[#252C37] border border-[#CBD5E1] dark:border-[#475569] rounded focus:outline-hidden focus:border-[#1979CA] focus:ring-1 focus:ring-[#1979CA]"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-[#475569] dark:text-[#94A3B8] mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-2.5 top-2.5 text-[#94A3B8]" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="artist@example.com"
                    className="w-full pl-9 pr-3 py-1.5 text-[12px] bg-white dark:bg-[#252C37] border border-[#CBD5E1] dark:border-[#475569] rounded focus:outline-hidden focus:border-[#1979CA] focus:ring-1 focus:ring-[#1979CA]"
                  />
                </div>
              </div>

              {mode !== 'forgot' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-semibold text-[#475569] dark:text-[#94A3B8]">
                      Password
                    </label>
                    {mode === 'signin' && (
                      <button
                        type="button"
                        onClick={() => {
                          setMode('forgot');
                          setError(null);
                        }}
                        className="text-[11px] text-[#1979CA] hover:underline cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-2.5 top-2.5 text-[#94A3B8]" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-3 py-1.5 text-[12px] bg-white dark:bg-[#252C37] border border-[#CBD5E1] dark:border-[#475569] rounded focus:outline-hidden focus:border-[#1979CA] focus:ring-1 focus:ring-[#1979CA]"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                data-testid="auth-submit-btn"
                className="w-full py-2 px-3 bg-[#1979CA] hover:bg-[#1464A8] text-white text-[12px] font-medium rounded flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>
                      {mode === 'signup'
                        ? 'Create Pixora Account'
                        : mode === 'forgot'
                        ? 'Send Password Reset Link'
                        : 'Sign In'}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>

              {mode !== 'forgot' && (
                <>
                  <div className="relative flex py-1 items-center">
                    <div className="grow border-t border-[#E2E8F0] dark:border-[#374151]" />
                    <span className="shrink mx-3 text-[10px] text-[#94A3B8] uppercase">or</span>
                    <div className="grow border-t border-[#E2E8F0] dark:border-[#374151]" />
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    data-testid="auth-google-btn"
                    className="w-full py-2 px-3 bg-white dark:bg-[#252C37] hover:bg-[#F8FAFC] dark:hover:bg-[#2D3748] border border-[#CBD5E1] dark:border-[#475569] text-[12px] font-medium rounded flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors disabled:opacity-60"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Continue with Google</span>
                  </button>
                </>
              )}

              {/* Mode switch footers */}
              <div className="pt-2 text-center text-[12px] text-[#64748B] dark:text-[#94A3B8]">
                {mode === 'signin' ? (
                  <div>
                    Don't have an account?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('signup');
                        setError(null);
                      }}
                      className="text-[#1979CA] font-medium hover:underline cursor-pointer"
                    >
                      Create one for free
                    </button>
                  </div>
                ) : mode === 'signup' ? (
                  <div>
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('signin');
                        setError(null);
                      }}
                      className="text-[#1979CA] font-medium hover:underline cursor-pointer"
                    >
                      Sign In
                    </button>
                  </div>
                ) : (
                  <div>
                    Remembered your password?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('signin');
                        setError(null);
                      }}
                      className="text-[#1979CA] font-medium hover:underline cursor-pointer"
                    >
                      Back to Sign In
                    </button>
                  </div>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
