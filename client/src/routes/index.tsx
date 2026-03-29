import React, { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { GlassPanel } from '../components/GlassPanel';
import { useAuthStore } from '../stores/authStore';
import { Shield, LogIn, UserPlus, Key } from 'lucide-react';

export function AuthPage() {
  const navigate = useNavigate();
  const { login, register, loading, error, clearError, token } = useAuthStore();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keyIterations, setKeyIterations] = useState(128);

  // Redirect if already logged in
  React.useEffect(() => {
    if (token) navigate({ to: '/app/timeline' });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'login') {
      await login(email, password);
    } else {
      await register(username, email, password, keyIterations);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
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
                  Key Iterations: <span className="text-purple-300 font-bold">{keyIterations}</span>
                </label>
              </div>
              <input
                type="range"
                min={128}
                max={8192}
                step={128}
                value={keyIterations}
                onChange={(e) => setKeyIterations(Number(e.target.value))}
                className="w-full accent-indigo-500"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>128 (faster)</span>
                <span>8192 (more secure)</span>
              </div>
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
