import React, { useState } from 'react';
import { Crown, Eye, EyeOff, Loader2 } from 'lucide-react';

interface GameLoginProps {
  onLoginSuccess: (userData: any, token: string) => void;
  onNavigateToRegister: () => void;
  onBackToHome: () => void;
}

export const GameLogin: React.FC<GameLoginProps> = ({
  onLoginSuccess,
  onNavigateToRegister,
  onBackToHome,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Preencha seu e-mail e senha.');
      return;
    }

    setLoading(true);

    const cleanInput = email.trim().toLowerCase();

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanInput,
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'E-mail ou senha incorretos.');
      }

      onLoginSuccess(data.user, data.token);
    } catch (err: any) {
      setError(err.message || 'Erro ao entrar no jogo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#070D22] text-white flex flex-col justify-between items-center p-4 relative overflow-hidden select-none bg-[linear-gradient(to_right,#15234A15_1px,transparent_1px),linear-gradient(to_bottom,#15234A15_1px,transparent_1px)] bg-[size:20px_20px]">
      
      {/* Glow Effects */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Logo */}
      <div className="pt-8 pb-3 flex flex-col items-center cursor-pointer" onClick={onBackToHome}>
        <img
          src="/blocklogo.png"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = '/logoblock.png';
          }}
          alt="BLOCK WIN"
          className="h-20 sm:h-24 w-auto object-contain drop-shadow-[0_4px_20px_rgba(0,240,255,0.4)]"
        />
      </div>

      {/* Main Form Card Container */}
      <div className="w-full max-w-sm mx-auto my-auto bg-[#0B1433] border border-[#172957] rounded-3xl p-6 sm:p-7 shadow-2xl relative z-10 space-y-5 backdrop-blur-md">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Entrar na conta</h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 font-normal">
            Acesse seu perfil de jogador e continue acumulando lucros.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/15 border border-rose-500/30 text-rose-300 rounded-xl text-xs font-medium text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Email Field */}
          <div>
            <input
              type="email"
              placeholder="Seu e-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-12 px-4 bg-[#080E24] border border-[#1B2D5C] rounded-xl text-sm font-medium text-white placeholder-slate-400 focus:outline-none focus:border-[#635BFF] transition-colors"
            />
          </div>

          {/* Password Field */}
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-12 pl-4 pr-11 bg-[#080E24] border border-[#1B2D5C] rounded-xl text-sm font-medium text-white placeholder-slate-400 focus:outline-none focus:border-[#635BFF] transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 mt-2 bg-gradient-to-r from-[#5B4EFF] via-[#7842FF] to-[#A033FF] hover:brightness-110 active:scale-98 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all uppercase tracking-wider disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>ENTRANDO...</span>
              </>
            ) : (
              <span>ENTRAR NO JOGO</span>
            )}
          </button>
        </form>

        {/* Link to Register */}
        <div className="text-center pt-2 text-xs text-slate-300">
          Ainda não tem conta?{' '}
          <button
            type="button"
            onClick={onNavigateToRegister}
            className="text-[#00E0FF] font-bold hover:underline cursor-pointer"
          >
            Criar conta grátis
          </button>
        </div>
      </div>

      {/* Decorative Tetris Blocks at Bottom */}
      <div className="w-full max-w-sm mx-auto flex items-end justify-center h-20 relative pointer-events-none opacity-80">
        <div className="flex gap-1.5 items-end transform translate-y-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-400 to-blue-600 shadow-lg shadow-cyan-500/30 border border-white/20" />
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-500 to-pink-500 shadow-lg shadow-purple-500/30 border border-white/20" />
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-400 to-orange-500 shadow-lg shadow-amber-500/30 border border-white/20" />
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-400 to-teal-600 shadow-lg shadow-emerald-500/30 border border-white/20" />
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-rose-500 to-red-600 shadow-lg shadow-rose-500/30 border border-white/20" />
        </div>
      </div>

    </div>
  );
};
