import React, { useState, useEffect } from 'react';
import { Crown, Eye, EyeOff, Loader2 } from 'lucide-react';

interface GameRegisterProps {
  initialRefCode?: string;
  onRegisterSuccess: (userData: any, token: string) => void;
  onNavigateToLogin: () => void;
  onBackToHome: () => void;
}

export const GameRegister: React.FC<GameRegisterProps> = ({
  initialRefCode = '',
  onRegisterSuccess,
  onNavigateToLogin,
  onBackToHome,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [refCode, setRefCode] = useState(() => {
    if (initialRefCode) return initialRefCode;
    try {
      return (
        localStorage.getItem('bp_game_ref_code') ||
        sessionStorage.getItem('bp_game_ref_code') ||
        localStorage.getItem('alliance_ref_code') ||
        sessionStorage.getItem('alliance_ref_code') ||
        ''
      );
    } catch (e) {
      return '';
    }
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref') || params.get('refCode') || params.get('r');
    if (ref) {
      const clean = ref.toUpperCase().trim();
      setRefCode(clean);
      try {
        localStorage.setItem('bp_game_ref_code', clean);
        sessionStorage.setItem('bp_game_ref_code', clean);
      } catch (e) {}
    } else if (!refCode) {
      try {
        const storedRef =
          localStorage.getItem('bp_game_ref_code') ||
          sessionStorage.getItem('bp_game_ref_code') ||
          localStorage.getItem('alliance_ref_code') ||
          sessionStorage.getItem('alliance_ref_code');
        if (storedRef) {
          setRefCode(storedRef);
        }
      } catch (e) {}
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Por favor, informe seu nome.');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setError('Por favor, informe um e-mail válido.');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve conter no mínimo 6 caracteres.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || undefined,
          password,
          refCode: refCode || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao criar conta.');
      }

      onRegisterSuccess(data.user, data.token);
    } catch (err: any) {
      setError(err.message || 'Falha ao realizar cadastro.');
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
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-2xl font-bold text-white tracking-tight">Criar conta</h2>
            <span className="text-[10px] font-mono font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded-full">
              blockwinner.site
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 font-normal">
            Leva menos de 1 minuto. Jogue e saque via PIX.
          </p>
        </div>

        {/* Affiliate Link Active Badge */}
        {refCode && (
          <div className="p-3 bg-gradient-to-r from-amber-500/20 via-cyan-500/20 to-emerald-500/20 border border-cyan-400/50 rounded-2xl text-xs text-white space-y-1 shadow-lg shadow-cyan-500/10">
            <div className="flex items-center justify-between font-mono font-extrabold text-[#FFE600]">
              <span>✨ BÔNUS DE INDICAÇÃO ATIVO</span>
              <span className="bg-amber-400 text-black text-[9px] px-1.5 py-0.5 rounded font-black">50% BÔNUS</span>
            </div>
            <p className="text-[11px] text-slate-200 font-mono">
              Código de Afiliado: <strong className="text-cyan-300 uppercase tracking-wide">{refCode}</strong>
            </p>
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-500/15 border border-rose-500/30 text-rose-300 rounded-xl text-xs font-medium text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Name Field */}
          <div>
            <input
              type="text"
              placeholder="Seu nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-12 px-4 bg-[#080E24] border border-[#1B2D5C] rounded-xl text-sm font-medium text-white placeholder-slate-400 focus:outline-none focus:border-[#635BFF] transition-colors"
            />
          </div>

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

          {/* Phone Field */}
          <div>
            <input
              type="tel"
              placeholder="Telefone com DDD (ex: 11 99999-0000)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full h-12 px-4 bg-[#080E24] border border-[#1B2D5C] rounded-xl text-sm font-medium text-white placeholder-slate-400 focus:outline-none focus:border-[#635BFF] transition-colors"
            />
          </div>

          {/* Password Field */}
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Senha (mín. 6 caracteres)"
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
                <span>CRIANDO...</span>
              </>
            ) : (
              <span>CRIAR CONTA GRÁTIS</span>
            )}
          </button>
        </form>

        {/* Link to Login */}
        <div className="text-center pt-2 text-xs text-slate-300">
          Já tem conta?{' '}
          <button
            type="button"
            onClick={onNavigateToLogin}
            className="text-[#00E0FF] font-bold hover:underline cursor-pointer"
          >
            Entrar
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
