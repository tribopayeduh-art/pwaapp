import React, { useState, useEffect } from 'react';
import { User as UserIcon, Mail, Phone, Lock, ArrowLeft, Loader2, Check, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import logoImg from './logo.webp';
import { AllianceTermsModal } from './AllianceTermsModal';
import { AuthDesktopPanel } from './AuthDesktopPanel';

interface RegisterViewProps {
  onRegister: (data: {
    name: string;
    email: string;
    phone: string;
    password: string;
    refCode?: string;
  }) => Promise<void>;
  onNavigateToLogin: () => void;
  onOpenTerms: () => void;
  loading: boolean;
  error?: string | null;
  initialRefCode?: string;
}

export const RegisterView: React.FC<RegisterViewProps> = ({
  onRegister,
  onNavigateToLogin,
  onOpenTerms,
  loading,
  error,
  initialRefCode,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreed, setAgreed] = useState(true);
  const [refCode, setRefCode] = useState(() => {
    if (initialRefCode) return initialRefCode;
    try {
      const stored = localStorage.getItem('alliance_ref_code') || sessionStorage.getItem('alliance_ref_code') || sessionStorage.getItem('bp_game_ref_code');
      return stored || '';
    } catch (e) {
      return '';
    }
  });
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showTermsModal, setShowTermsModal] = useState(false);

  useEffect(() => {
    if (initialRefCode) {
      setRefCode(initialRefCode);
    } else {
      try {
        const stored = localStorage.getItem('alliance_ref_code') || sessionStorage.getItem('alliance_ref_code') || sessionStorage.getItem('bp_game_ref_code');
        if (stored) setRefCode(stored);
      } catch (e) {}
    }
  }, [initialRefCode]);

  // Helper phone mask for Brazilian format (XX) XXXXX-XXXX
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 11);
    let formatted = raw;
    if (raw.length > 2) {
      formatted = `(${raw.slice(0, 2)}) ${raw.slice(2)}`;
    }
    if (raw.length > 7) {
      formatted = `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7)}`;
    } else if (raw.length > 6) {
      formatted = `(${raw.slice(0, 2)}) ${raw.slice(2, 6)}-${raw.slice(6)}`;
    }
    setPhone(formatted);
  };

  const handleNextStep = () => {
    setValidationError(null);

    if (step === 1) {
      if (!name.trim()) {
        setValidationError('Por favor, informe seu nome completo.');
        return;
      }
      if (name.trim().split(' ').length < 2) {
        setValidationError('Por favor, digite seu nome e sobrenome.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email.trim() || !emailRegex.test(email.trim())) {
        setValidationError('Por favor, informe um endereço de e-mail válido.');
        return;
      }
      setStep(3);
    } else if (step === 3) {
      if (password.length < 6) {
        setValidationError('A senha deve conter no mínimo 6 caracteres.');
        return;
      }
      if (password !== confirmPassword) {
        setValidationError('As senhas digitadas não coincidem.');
        return;
      }
      setStep(4);
    }
  };

  const handlePrevStep = () => {
    setValidationError(null);
    if (step > 1) {
      setStep((prev) => (prev - 1) as 1 | 2 | 3 | 4);
    } else {
      onNavigateToLogin();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const phoneDigits = phone.replace(/\D/g, '');
    if (!phoneDigits || phoneDigits.length < 10 || phoneDigits.length > 11) {
      setValidationError('Por favor, informe um número de telefone válido com DDD (ex: 11 99999-9999).');
      return;
    }
    if (!agreed) {
      setValidationError('Você precisa aceitar os termos de uso e política de privacidade.');
      return;
    }

    // Open disclosure terms modal for user acceptance
    setShowTermsModal(true);
  };

  const handleConfirmRegisterAndTerms = () => {
    setShowTermsModal(false);
    onRegister({
      name,
      email,
      phone,
      password,
      refCode: refCode || undefined,
    });
  };

  const stepTitles = [
    { num: 1, label: 'Nome', desc: 'Como devemos chamar você?' },
    { num: 2, label: 'E-mail', desc: 'Qual é o seu melhor e-mail?' },
    { num: 3, label: 'Senha', desc: 'Crie uma senha de acesso' },
    { num: 4, label: 'Telefone', desc: 'Informe um telefone/WhatsApp válido' },
  ];

  return (
    <div className="auth-responsive-page">
      <AuthDesktopPanel />
      <main className="auth-form-pane">
      <div className="auth-form-card pt-4 space-y-5 bg-white p-5 sm:p-6 rounded-[24px] border border-[#E5E5E5] my-auto shadow-xs transition-all">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handlePrevStep}
            className="w-9 h-9 rounded-full bg-[#F5F5F5] border border-[#E5E5E5] flex items-center justify-center text-[#111111] hover:bg-[#ECECEC] transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <img src={logoImg} alt="Logo" className="h-7 max-w-[130px] object-contain mx-auto" />
          <div className="w-9 shrink-0 text-right">
            <span className="text-[11px] font-bold text-[#737373]">{step}/4</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-[#F5F5F5] h-1.5 rounded-full overflow-hidden border border-[#E5E5E5]">
          <div
            className="bg-[#111111] h-full transition-all duration-300 ease-out"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>

        {/* Step Header */}
        <div>
          <div className="inline-block px-2.5 py-0.5 rounded-full bg-[#F5F5F5] text-[10px] font-bold text-[#111111] uppercase tracking-wider mb-1.5 border border-[#E5E5E5]">
            Etapa {step} de 4 • {stepTitles[step - 1].label}
          </div>
          <h1 className="text-xl font-extrabold text-[#111111] tracking-tight">
            {stepTitles[step - 1].desc}
          </h1>
        </div>

        {/* Affiliate indicator badge */}
        {refCode && (
          <div className="p-2.5 bg-[#F5F5F5] border border-[#E5E5E5] rounded-xl flex items-center justify-between text-xs text-[#111111]">
            <span className="font-medium text-[11px] text-[#737373]">Indicação:</span>
            <span className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-[#E5E5E5] text-[#111111] text-xs">
              {refCode}
            </span>
          </div>
        )}

        {/* Errors */}
        {(error || validationError) && (
          <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{error || validationError}</span>
          </div>
        )}

        {/* STEP 1: Name */}
        {step === 1 && (
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#111111] block">Nome completo</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-[#737373] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Ex: João da Silva"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleNextStep())}
                  className="w-full h-12 pl-10 pr-4 bg-[#F5F5F5] border border-[#E5E5E5] rounded-xl text-sm font-medium text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white transition-all placeholder:text-[#737373]"
                />
              </div>
              <p className="text-[11px] text-[#737373]">Insira seu nome completo conforme documento.</p>
            </div>

            <button
              type="button"
              onClick={handleNextStep}
              className="w-full h-12 bg-[#111111] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-black transition-all cursor-pointer shadow-xs active:scale-[0.99] mt-2"
            >
              Continuar <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 2: Email */}
        {step === 2 && (
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#111111] block">Endereço de E-mail</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#737373] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  autoFocus
                  placeholder="seu.email@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleNextStep())}
                  className="w-full h-12 pl-10 pr-4 bg-[#F5F5F5] border border-[#E5E5E5] rounded-xl text-sm font-medium text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white transition-all placeholder:text-[#737373]"
                />
              </div>
              <p className="text-[11px] text-[#737373]">Utilizado para login e comprovantes de saques/depósitos.</p>
            </div>

            <button
              type="button"
              onClick={handleNextStep}
              className="w-full h-12 bg-[#111111] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-black transition-all cursor-pointer shadow-xs active:scale-[0.99] mt-2"
            >
              Continuar <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 3: Password */}
        {step === 3 && (
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#111111] block">Senha de acesso</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#737373] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  autoFocus
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 pl-10 pr-4 bg-[#F5F5F5] border border-[#E5E5E5] rounded-xl text-sm font-medium text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white transition-all placeholder:text-[#737373]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#111111] block">Confirmar senha</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#737373] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  placeholder="Repita a senha criada"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleNextStep())}
                  className="w-full h-12 pl-10 pr-4 bg-[#F5F5F5] border border-[#E5E5E5] rounded-xl text-sm font-medium text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white transition-all placeholder:text-[#737373]"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleNextStep}
              className="w-full h-12 bg-[#111111] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-black transition-all cursor-pointer shadow-xs active:scale-[0.99] mt-3"
            >
              Continuar <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 4: Phone & Terms */}
        {step === 4 && (
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#111111] block">Número de Telefone / WhatsApp</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-[#737373] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  autoFocus
                  placeholder="(11) 99999-9999"
                  value={phone}
                  onChange={handlePhoneChange}
                  className="w-full h-12 pl-10 pr-4 bg-[#F5F5F5] border border-[#E5E5E5] rounded-xl text-sm font-medium text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white transition-all placeholder:text-[#737373]"
                />
              </div>
              <p className="text-[11px] text-[#737373]">Digite seu número com DDD de forma válida.</p>
            </div>

            {/* Terms checkbox */}
            <div className="flex items-start gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setAgreed(!agreed)}
                className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors cursor-pointer mt-0.5 ${
                  agreed ? 'bg-[#111111] border-[#111111] text-white' : 'border-[#E5E5E5] bg-[#F5F5F5]'
                }`}
              >
                {agreed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </button>
              <span className="text-xs text-[#737373] leading-tight">
                Li e concordo com os{' '}
                <button
                  type="button"
                  onClick={() => setShowTermsModal(true)}
                  className="text-[#111111] font-semibold underline cursor-pointer"
                >
                  Termos de uso
                </button>{' '}
                e Política de Privacidade.
              </span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-[#111111] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-black transition-all cursor-pointer shadow-xs active:scale-[0.99] disabled:opacity-50 mt-2"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  Concluir e Criar Conta
                </>
              )}
            </button>
          </form>
        )}

        {/* Link to Login */}
        <div className="pt-3 text-center border-t border-[#E5E5E5]">
          <p className="text-xs text-[#737373]">
            Já possui uma conta?{' '}
            <button
              type="button"
              onClick={onNavigateToLogin}
              className="font-bold text-[#111111] hover:underline cursor-pointer ml-1"
            >
              Entrar
            </button>
          </p>
        </div>
      </div>
      <p className="auth-mobile-security">Ambiente seguro • Dados protegidos</p>
      </main>

      <AllianceTermsModal
        isOpen={showTermsModal}
        onAccept={handleConfirmRegisterAndTerms}
        onCancel={() => setShowTermsModal(false)}
        loading={loading}
      />
    </div>
  );
};
