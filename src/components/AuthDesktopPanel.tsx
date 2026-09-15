import React from 'react';
import { BadgeDollarSign, Gamepad2, ShieldCheck, Users } from 'lucide-react';
import logoImg from './logo.webp';

export const AuthDesktopPanel: React.FC = () => (
  <aside className="auth-desktop-panel" aria-label="Recursos do Alliance Hub">
    <div className="auth-desktop-glow auth-desktop-glow-one" />
    <div className="auth-desktop-glow auth-desktop-glow-two" />
    <div className="auth-desktop-content">
      <img src={logoImg} alt="Alliance Hub" className="auth-desktop-logo" />
      <span className="auth-desktop-eyebrow"><i /> Operação conectada</span>
      <h2>Controle sua rede, seus jogos e seus ganhos.</h2>
      <p>Acompanhe cadastros, FTDs e comissões em uma experiência segura e organizada.</p>
      <div className="auth-desktop-features">
        <article><i><BadgeDollarSign /></i><span><b>Financeiro consolidado</b><small>Carteira e comissões atualizadas</small></span></article>
        <article><i><Users /></i><span><b>Rede de afiliados</b><small>Influenciadores e conversões</small></span></article>
        <article><i><Gamepad2 /></i><span><b>Métricas por jogo</b><small>Block Win, Zumbla e GEN DINO</small></span></article>
      </div>
      <div className="auth-desktop-security"><ShieldCheck /><span><b>Ambiente protegido</b><small>Sessão autenticada e dados sincronizados</small></span></div>
    </div>
  </aside>
);
