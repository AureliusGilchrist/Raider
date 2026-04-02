import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { GlassPanel } from '../components/GlassPanel';
import { useAuthStore } from '../stores/authStore';
import { Shield, LogIn, UserPlus, Key, RefreshCw } from 'lucide-react';
import { twofa as twofaApi } from '../lib/api';

function useCaptcha() {
  const [a, setA] = useState(() => Math.floor(Math.random() * 15) + 5);
  const [b, setB] = useState(() => Math.floor(Math.random() * 15) + 5);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback((numA: number, numB: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = 'rgba(20, 15, 40, 0.85)';
    ctx.fillRect(0, 0, W, H);

    // Noise lines
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.random() * W, Math.random() * H);
      ctx.bezierCurveTo(
        Math.random() * W, Math.random() * H,
        Math.random() * W, Math.random() * H,
        Math.random() * W, Math.random() * H
      );
      ctx.strokeStyle = `hsla(${Math.random() * 360},60%,55%,0.35)`;
      ctx.lineWidth = 1 + Math.random();
      ctx.stroke();
    }

    // Noise dots
    for (let i = 0; i < 40; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * W, Math.random() * H, Math.random() * 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${0.1 + Math.random() * 0.2})`;
      ctx.fill();
    }

    // Draw distorted text
    const text = `${numA} + ${numB} = ?`;
    const chars = text.split('');
    const startX = (W - chars.length * 16) / 2;
    ctx.save();
    chars.forEach((ch, i) => {
      const x = startX + i * 16 + (Math.random() - 0.5) * 4;
      const y = H / 2 + (Math.random() - 0.5) * 8;
      const angle = (Math.random() - 0.5) * 0.35;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.font = `bold ${18 + Math.floor(Math.random() * 6)}px monospace`;
      ctx.fillStyle = `hsl(${200 + i * 22},90%,72%)`;
      ctx.shadowColor = 'rgba(100,150,255,0.6)';
      ctx.shadowBlur = 4;
      ctx.fillText(ch, 0, 0);
      ctx.restore();
    });
    ctx.restore();

    // Border
    ctx.strokeStyle = 'rgba(100,100,200,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, W, H);
  }, []);

  const refresh = useCallback(() => {
    const na = Math.floor(Math.random() * 15) + 5;
    const nb = Math.floor(Math.random() * 15) + 5;
    setA(na);
    setB(nb);
    setTimeout(() => draw(na, nb), 0);
  }, [draw]);

  useEffect(() => {
    draw(a, b);
  }, []);

  const validate = (input: string) => parseInt(input, 10) === a + b;

  return { canvasRef, refresh, validate };
}

export function AuthPage() {
  const navigate = useNavigate();
  const { login, register, loading, error, clearError, token } = useAuthStore();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keyIterations, setKeyIterations] = useState(128);
  const [needs2FA, setNeeds2FA] = useState(false);
  const [twoFAUserId, setTwoFAUserId] = useState('');
  const [twoFACode, setTwoFACode] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const [captchaError, setCaptchaError] = useState('');
  const { canvasRef, refresh, validate } = useCaptcha();

  // Redirect if already logged in
  React.useEffect(() => {
    if (token) navigate({ to: '/app/timeline' });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (needs2FA) {
      try {
        const res = await twofaApi.verifyLogin(twoFAUserId, twoFACode);
        localStorage.setItem('raider_token', res.token);
        window.location.reload();
      } catch (err: any) {
        useAuthStore.setState({ error: err.message || 'Invalid 2FA code' });
      }
      return;
    }
    if (mode === 'register') {
      if (!validate(captchaInput)) {
        setCaptchaError('Incorrect answer. Please try again.');
        refresh();
        setCaptchaInput('');
        return;
      }
      setCaptchaError('');
      await register(username, email, password, keyIterations);
    } else {
      const res = await login(email, password);
      if (res?.requires_2fa) {
        setNeeds2FA(true);
        setTwoFAUserId(res.user_id);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 initial-load">
      <GlassPanel className="w-full max-w-md p-8 animate-scale-in">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-4 animate-glow">
            <Shield size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-300 to-purple-300 bg-clip-text text-transparent">
            Raider
          </h1>
          <p className="text-gray-300 text-sm mt-1">Encrypted. Decentralized. Yours.</p>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => { setMode('login'); clearError(); }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all-custom ${
              mode === 'login' ? 'bg-white/20 text-white' : 'text-gray-300 hover:text-white'
            }`}
          >
            <LogIn size={14} className="inline mr-1.5" />
            Login
          </button>
          <button
            onClick={() => { setMode('register'); clearError(); }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all-custom ${
              mode === 'register' ? 'bg-white/20 text-white' : 'text-gray-300 hover:text-white'
            }`}
          >
            <UserPlus size={14} className="inline mr-1.5" />
            Register
          </button>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/30 rounded-lg px-4 py-2 mb-4 text-red-300 text-sm animate-fade-in">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === 'register' && (
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="animate-slide-up"
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {mode === 'register' && (
            <div className="animate-slide-up">
              <div className="flex items-center gap-2 mb-2">
                <Key size={14} className="text-purple-400" />
                <label className="text-sm text-gray-200">
                  Tuning fidelity
                </label>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Less', value: 128 },
                  { label: 'Medium', value: 2048 },
                  { label: 'More', value: 8192 },
                ].map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => setKeyIterations(option.value)}
                    className={`rounded-lg border px-3 py-2 text-sm transition-all-custom ${
                      keyIterations === option.value
                        ? 'border-indigo-400 bg-indigo-500/20 text-white'
                        : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === 'register' && (
            <div className="animate-slide-up">
              <label className="text-sm text-gray-200 mb-2 block">Security Verification</label>
              <div className="flex items-center gap-2 mb-2">
                <canvas
                  ref={canvasRef}
                  width={240}
                  height={56}
                  className="rounded-lg flex-1"
                  style={{ imageRendering: 'pixelated' }}
                />
                <button
                  type="button"
                  onClick={refresh}
                  className="btn btn-glass !p-2"
                  title="Refresh CAPTCHA"
                >
                  <RefreshCw size={14} />
                </button>
              </div>
              <input
                type="text"
                placeholder="Enter the sum shown above"
                value={captchaInput}
                onChange={e => { setCaptchaInput(e.target.value); setCaptchaError(''); }}
                required
                className="w-full"
                inputMode="numeric"
              />
              {captchaError && (
                <p className="text-xs text-red-400 mt-1">{captchaError}</p>
              )}
            </div>
          )}

          {needs2FA && (
            <div className="animate-slide-up">
              <label className="text-sm text-gray-200 mb-1 block">Enter 2FA Code</label>
              <input
                type="text"
                placeholder="6-digit code"
                value={twoFACode}
                onChange={(e) => setTwoFACode(e.target.value)}
                maxLength={6}
                required
                className="text-center text-lg tracking-widest"
              />
              <p className="text-xs text-gray-400 mt-1">Enter the code from your authenticator app</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full mt-2"
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </GlassPanel>
    </div>
  );
}
