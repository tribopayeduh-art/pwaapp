import React, { useState } from 'react';
import { Mail, Lock, ArrowRight, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import logoImg from './logo.webp';
import { AuthDesktopPanel } from './AuthDesktopPanel';

interface LoginViewProps {
  onLogin: (email: string, pass: string) => Promise<void>;
  onNavigateToRegister: () => void;
  onForgotPassword: () => void;
  loading: boolean;
  error?: string | null;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLogin,
  onNavigateToRegister,
  onForgotPassword,
  loading,
  error,
}) => {
  const [email, setEmail] = useState(() => localStorage.getItem('pg_saved_email') || '');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    if (rememberMe) {
      localStorage.setItem('pg_saved_email', email);
    } else {
      localStorage.removeItem('pg_saved_email');
    }
    localStorage.removeItem('pg_saved_password');

    onLogin(email, password);
  };

  return (
    <div className="auth-responsive-page">
      <AuthDesktopPanel />
      <main className="auth-form-pane">
      <div className="auth-form-card pt-6 space-y-6 bg-white p-6 rounded-[24px] border border-[#E5E5E5] my-auto shadow-xs">
        {/* Logo & Welcome */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-1">
            <img src={logoImg} alt="Logo" className="h-12 max-w-[200px] object-contain mx-auto" />
          </div>
          <p className="text-xs text-[#737373] font-normal">
            Acesse sua conta para gerenciar seu saldo e transações.
          </p>
        </div>

        {/* Error alert */}
        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#111111] block">E-mail</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#737373] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                placeholder="seu.email@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-12 pl-10 pr-4 bg-[#F5F5F5] border border-[#E5E5E5] rounded-xl text-sm font-medium text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white transition-all placeholder:text-[#737373]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#111111] block">Senha</label>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#737373] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-12 pl-10 pr-11 bg-[#F5F5F5] border border-[#E5E5E5] rounded-xl text-sm font-medium text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white transition-all placeholder:text-[#737373]"
              />
              <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute right-2.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-200" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>{showPassword ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}</button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[#111111] select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-[#E5E5E5] text-[#111111] focus:ring-0 accent-[#111111] cursor-pointer"
              />
              <span>Lembrar meu e-mail</span>
            </label>

            <button
              type="button"
              onClick={onForgotPassword}
              className="text-xs font-medium text-[#737373] hover:text-[#111111] transition-colors cursor-pointer"
            >
              Esqueci minha senha
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-[#111111] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-black transition-colors cursor-pointer shadow-xs active:scale-[0.99] disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Entrar
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </>
            )}
          </button>
        </form>

        {/* Link to Register */}
        <div className="pt-4 text-center border-t border-[#E5E5E5]">
          <p className="text-xs text-[#737373]">
            Não possui uma conta?{' '}
            <button
              type="button"
              onClick={onNavigateToRegister}
              className="font-bold text-[#111111] hover:underline cursor-pointer ml-1"
            >
              Criar conta
            </button>
          </p>
        </div>
      </div>
      <p className="auth-mobile-security">Ambiente seguro • Dados protegidos</p>
      </main>
    </div>
  );
};
