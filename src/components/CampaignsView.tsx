import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Check,
  Copy,
  Save,
  MessageSquare,
  Send,
  RefreshCw,
  QrCode,
  Smartphone,
  Zap,
  ShieldCheck,
  Play,
  CheckCircle2,
  Clock,
  Users,
  Flame,
  Activity,
  CheckCheck,
  DollarSign,
  SmartphoneNfc,
  Search,
  Sparkles,
  SendHorizontal
} from 'lucide-react';
import { CampaignSettings, WhatsAppSessionStatus, WhatsAppLog } from '../types';
import { WhatsAppLogo } from './campaigns/BrandLogos';

interface CampaignsViewProps {
  onBack: () => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const DEFAULT_SETTINGS: CampaignSettings = {
  whatsappEnabled: true,
  instanceName: 'Alliance WhatsApp Hub',
  autoRecoverPix: true,
  pixRecoveryDelayMinutes: 5,
  pixRecoveryTemplate: '⚡ {primeiro_nome}, seu PIX de {valor_pix} ainda está aguardando pagamento! Finalize agora para liberar seu bônus de 200%:\n\n{codigo_pix}',
  autoRecoverPixPhase2: true,
  pixRecoveryPhase2DelayMinutes: 20,
  pixRecoveryPhase2Template: '⏳ {primeiro_nome}, seu PIX promocional de {valor_pix} expira em 10 minutos! Finalize agora para garantir +50 rodadas bônus exclusivas:\n\n{codigo_pix}',
  autoWelcome: true,
  welcomeTemplate: '🎉 Olá {primeiro_nome}, bem-vindo à ALLIANCE HUB! Seu cadastro foi realizado com sucesso. Aproveite o bônus e jogue agora:\n\n{link_jogo}',
  autoDepositConfirmed: true,
  depositConfirmedTemplate: '✅ {primeiro_nome}, seu depósito de {valor_pix} foi aprovado com sucesso! Seu saldo total é {saldo}. Boa sorte nas rodadas:\n\n{link_jogo}',
  autoWithdrawNotify: true,
  withdrawNotifyTemplate: '💸 Parabéns {primeiro_nome}! Seu saque PIX de {valor_pix} foi processado e transferido para sua conta com sucesso.',
  autoInactiveReengagement: true,
  inactiveDays: 3,
  inactiveReengagementTemplate: '🔥 Sentimos sua falta {primeiro_nome}! Liberamos um cashback surpresa de 50% no seu próximo depósito. Venha jogar:\n\n{link_jogo}',
  autoAffiliateCommission: true,
  affiliateCommissionTemplate: '💰 Parabéns {primeiro_nome}! Você acabou de receber uma nova comissão de afiliado de {valor_pix}! Seu saldo total de comissões é {saldo}.',
  antiBanDelaySec: 8,
};

export const CampaignsView: React.FC<CampaignsViewProps> = ({ onBack, onShowToast }) => {
  const [settings, setSettings] = useState<CampaignSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  // WhatsApp State
  const [waStatus, setWaStatus] = useState<WhatsAppSessionStatus>({
    connected: false,
    status: 'disconnected',
    qrCodeData: null,
    pairingCode: null,
    phone: null,
    instanceName: 'Alliance WhatsApp Hub',
    lastActivity: new Date().toISOString(),
  });
  const [waLoading, setWaLoading] = useState<boolean>(false);
  const [pairingMode, setPairingMode] = useState<'qr' | 'code' | 'simulate'>('qr');
  const [pairingPhone, setPairingPhone] = useState<string>('55');
  const [testPhone, setTestPhone] = useState<string>('');
  const [testMessage, setTestMessage] = useState<string>('{Olá|Oi|E aí} {primeiro_nome}! Esta é uma mensagem de teste oficial da Alliance Hub via Baileys.');
  const [waLogs, setWaLogs] = useState<WhatsAppLog[]>([]);
  const [copiedPairingCode, setCopiedPairingCode] = useState<boolean>(false);
  const [logFilter, setLogFilter] = useState<string>('all');
  const [logSearch, setLogSearch] = useState<string>('');

  // Broadcast state
  const [broadcastName, setBroadcastName] = useState<string>('Campanha VIP Fim de Semana');
  const [broadcastAudience, setBroadcastAudience] = useState<'all' | 'pix_pending' | 'active_players' | 'affiliates' | 'no_deposit'>('all');
  const [broadcastTemplate, setBroadcastTemplate] = useState<string>('{Olá|Oi|E aí} {primeiro_nome}! Temos um bônus exclusivo de 100% no PIX hoje. Acesse agora: {link_jogo}');
  const [broadcasting, setBroadcasting] = useState<boolean>(false);

  useEffect(() => {
    loadSettings();
    loadWhatsAppStatus();
    loadWhatsAppLogs();

    // Periodic status poll for real-time QR / connection sync
    const interval = setInterval(() => {
      loadWhatsAppStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/campaigns/settings');
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar configurações:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      const res = await fetch('/api/campaigns/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        onShowToast('Configurações salvas com sucesso!', 'success');
      } else {
        onShowToast('Erro ao salvar configurações.', 'error');
      }
    } catch (e) {
      onShowToast('Falha na comunicação com o servidor.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const loadWhatsAppStatus = async () => {
    try {
      const res = await fetch('/api/campaigns/whatsapp/status');
      if (res.ok) {
        const data = await res.json();
        if (data.status) setWaStatus(data.status);
      }
    } catch (e) {
      // silent
    }
  };

  const loadWhatsAppLogs = async () => {
    try {
      const res = await fetch('/api/campaigns/whatsapp/logs');
      if (res.ok) {
        const data = await res.json();
        if (data.logs) setWaLogs(data.logs);
      }
    } catch (e) {
      // silent
    }
  };

  const handleGenerateWhatsAppQr = async () => {
    try {
      setWaLoading(true);
      const res = await fetch('/api/campaigns/whatsapp/qr', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.state) {
          setWaStatus(data.state);
          onShowToast('QR Code Baileys gerado com sucesso! Escaneie pelo WhatsApp.', 'info');
        }
      } else {
        const err = await res.json();
        onShowToast(err.error || 'Erro ao gerar QR Code.', 'error');
      }
    } catch (e: any) {
      onShowToast('Erro ao gerar QR Code do Baileys: ' + e?.message, 'error');
    } finally {
      setWaLoading(false);
    }
  };

  const handleRequestPairingCode = async () => {
    const cleanPhone = pairingPhone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      onShowToast('Informe o número com DDI e DDD (ex: 5511999998888)', 'error');
      return;
    }

    try {
      setWaLoading(true);
      const res = await fetch('/api/campaigns/whatsapp/pairing-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.state) setWaStatus(data.state);
        onShowToast(`Código de Pareamento gerado: ${data.code}! Digite no seu WhatsApp.`, 'success');
      } else {
        const err = await res.json();
        onShowToast(err.error || 'Erro ao solicitar código de pareamento.', 'error');
      }
    } catch (e: any) {
      onShowToast('Erro na solicitação: ' + e?.message, 'error');
    } finally {
      setWaLoading(false);
    }
  };

  const handleSimulatePair = async () => {
    try {
      setWaLoading(true);
      const res = await fetch('/api/campaigns/whatsapp/confirm-pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '+55 (11) 98923-4412' }),
      });
      if (res.ok) {
        const data = await res.json();
        setWaStatus(data.state);
        onShowToast('Sessão WhatsApp Baileys conectada com sucesso!', 'success');
        loadWhatsAppLogs();
      }
    } catch (e) {
      onShowToast('Erro ao parear WhatsApp.', 'error');
    } finally {
      setWaLoading(false);
    }
  };

  const handleDisconnectWhatsApp = async () => {
    try {
      setWaLoading(true);
      const res = await fetch('/api/campaigns/whatsapp/disconnect', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setWaStatus(data.state);
        onShowToast('Instância WhatsApp desconectada.', 'info');
      }
    } catch (e) {
      onShowToast('Erro ao desconectar WhatsApp.', 'error');
    } finally {
      setWaLoading(false);
    }
  };

  const handleCopyPairingCode = () => {
    if (!waStatus.pairingCode) return;
    navigator.clipboard.writeText(waStatus.pairingCode);
    setCopiedPairingCode(true);
    onShowToast('Código de pareamento copiado!', 'success');
    setTimeout(() => setCopiedPairingCode(false), 2000);
  };

  const handleSendTestMessage = async () => {
    if (!testPhone) {
      onShowToast('Informe o número de WhatsApp (com DDD).', 'error');
      return;
    }

    try {
      setWaLoading(true);
      const res = await fetch('/api/campaigns/whatsapp/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone, message: testMessage }),
      });

      if (res.ok) {
        onShowToast('Mensagem de teste enviada com sucesso!', 'success');
        loadWhatsAppLogs();
      } else {
        const err = await res.json();
        onShowToast(err.error || 'Erro ao enviar mensagem de teste.', 'error');
      }
    } catch (e) {
      onShowToast('Erro de conexão ao enviar mensagem.', 'error');
    } finally {
      setWaLoading(false);
    }
  };

  const handleTriggerBroadcast = async () => {
    try {
      setBroadcasting(true);
      const res = await fetch('/api/campaigns/whatsapp/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: broadcastName,
          targetAudience: broadcastAudience,
          template: broadcastTemplate,
          antiBanDelay: settings.antiBanDelaySec,
        }),
      });

      if (res.ok) {
        onShowToast('Disparo em massa iniciado com sucesso! Acompanhe nos logs.', 'success');
        loadWhatsAppLogs();
      } else {
        onShowToast('Erro ao disparar campanha.', 'error');
      }
    } catch (e) {
      onShowToast('Erro ao iniciar disparo.', 'error');
    } finally {
      setBroadcasting(false);
    }
  };

  const insertVariable = (variableKey: string, field: 'pix1' | 'pix2' | 'welcome' | 'deposit' | 'withdraw' | 'reengage' | 'affiliate' | 'broadcast' | 'test') => {
    const varTag = `{${variableKey}}`;
    if (field === 'pix1') setSettings(s => ({ ...s, pixRecoveryTemplate: s.pixRecoveryTemplate + ' ' + varTag }));
    else if (field === 'pix2') setSettings(s => ({ ...s, pixRecoveryPhase2Template: s.pixRecoveryPhase2Template + ' ' + varTag }));
    else if (field === 'welcome') setSettings(s => ({ ...s, welcomeTemplate: s.welcomeTemplate + ' ' + varTag }));
    else if (field === 'deposit') setSettings(s => ({ ...s, depositConfirmedTemplate: s.depositConfirmedTemplate + ' ' + varTag }));
    else if (field === 'withdraw') setSettings(s => ({ ...s, withdrawNotifyTemplate: s.withdrawNotifyTemplate + ' ' + varTag }));
    else if (field === 'reengage') setSettings(s => ({ ...s, inactiveReengagementTemplate: s.inactiveReengagementTemplate + ' ' + varTag }));
    else if (field === 'affiliate') setSettings(s => ({ ...s, affiliateCommissionTemplate: s.affiliateCommissionTemplate + ' ' + varTag }));
    else if (field === 'broadcast') setBroadcastTemplate(t => t + ' ' + varTag);
    else if (field === 'test') setTestMessage(t => t + ' ' + varTag);
  };

  const getLogTypeBadge = (type: string) => {
    switch (type) {
      case 'recovery':
        return <span className="px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-bold">Recuperação PIX</span>;
      case 'welcome':
        return <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">Boas-Vindas</span>;
      case 'deposit':
        return <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-bold">Depósito Aprovado</span>;
      case 'withdraw':
        return <span className="px-2.5 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 text-[11px] font-bold">Saque Enviado</span>;
      case 'reengagement':
        return <span className="px-2.5 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold">Reativação</span>;
      case 'affiliate':
        return <span className="px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-bold">Comissão Afiliado</span>;
      case 'broadcast':
        return <span className="px-2.5 py-0.5 rounded-md bg-gray-100 text-gray-800 border border-gray-300 text-[11px] font-bold">Disparo em Massa</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-md bg-gray-50 text-gray-600 border border-gray-200 text-[11px] font-bold">Teste Baileys</span>;
    }
  };

  const filteredLogs = waLogs.filter(log => {
    const matchFilter = logFilter === 'all' || log.type === logFilter;
    const matchSearch = !logSearch || log.phone.includes(logSearch) || log.recipientName.toLowerCase().includes(logSearch.toLowerCase()) || log.messagePreview.toLowerCase().includes(logSearch.toLowerCase());
    return matchFilter && matchSearch;
  });

  return (
    <div className="min-h-screen w-full bg-[#F4F5F7] text-[#111111] pb-20 font-sans antialiased">
      {/* Full-Width Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#E5E7EB] shadow-xs">
        <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <button
              onClick={onBack}
              className="w-10 h-10 rounded-xl bg-[#F4F5F7] hover:bg-[#E5E7EB] text-[#111111] flex items-center justify-center transition-colors cursor-pointer shrink-0"
              title="Voltar"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-[#111111] truncate">
                  Central de Automações WhatsApp Baileys
                </h1>
                <span className="bg-[#111111] text-white text-[10px] font-black px-2.5 py-0.5 rounded-md tracking-wider shrink-0">
                  ENTERPRISE
                </span>
                <div className="hidden md:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                  <span className={`w-2 h-2 rounded-full ${waStatus.connected ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
                  <span>{waStatus.connected ? 'Baileys Socket Ativo' : 'Baileys Pronto'}</span>
                </div>
              </div>
              <p className="text-xs text-[#6B7280] truncate">
                Instância Multi-Device, recuperação inteligente de PIX em 2 fases, boas-vindas e disparos em massa
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto w-full sm:w-auto">
            <button
              onClick={loadWhatsAppStatus}
              className="h-10 px-3.5 rounded-xl bg-[#F4F5F7] hover:bg-[#E5E7EB] text-[#374151] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Sincronizar Status"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${waLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>

            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="flex-1 sm:flex-initial h-10 px-5 bg-[#111111] hover:bg-[#1F2937] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm hover:shadow active:scale-95 disabled:opacity-50"
            >
              {saving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4 text-emerald-400" />
              )}
              <span>Salvar Alterações</span>
            </button>
          </div>
        </div>
      </header>

      {/* Full-Width Main Content */}
      <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Top KPI Metrics Deck */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-4 border border-[#E5E7EB] shadow-xs flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shrink-0">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-[#6B7280] font-semibold block">Socket Baileys</span>
              <span className="text-base font-black text-[#111111]">
                {waStatus.connected ? 'Online & Pareado' : 'Aguardando Conexão'}
              </span>
              <span className="text-[11px] text-emerald-600 font-bold block">
                {waStatus.phone || 'Sem número ativo'}
              </span>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-[#E5E7EB] shadow-xs flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200 shrink-0">
              <SendHorizontal className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-[#6B7280] font-semibold block">Disparos no Histórico</span>
              <span className="text-base font-black text-[#111111]">
                {waLogs.length} Mensagens
              </span>
              <span className="text-[11px] text-blue-600 font-bold block">
                Taxa de Entrega: 99.4%
              </span>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-[#E5E7EB] shadow-xs flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200 shrink-0">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-[#6B7280] font-semibold block">Automações Ativas</span>
              <span className="text-base font-black text-[#111111]">
                7 Funis Prontos
              </span>
              <span className="text-[11px] text-amber-600 font-bold block">
                Recuperação PIX & Boas-Vindas
              </span>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-[#E5E7EB] shadow-xs flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-200 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-[#6B7280] font-semibold block">Proteção Anti-Ban</span>
              <span className="text-base font-black text-[#111111]">
                Delay: {settings.antiBanDelaySec}s + Spintax
              </span>
              <span className="text-[11px] text-purple-600 font-bold block">
                Rotação de Variações Ativa
              </span>
            </div>
          </div>
        </div>

        {/* Master Grid: Left Column (Connection Terminal) & Right Column (Automations Deck) */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* LEFT COLUMN: WhatsApp Baileys Station (Col span 5) */}
          <div className="xl:col-span-5 space-y-6">
            {/* Baileys Connection Center */}
            <div className="bg-white rounded-3xl border border-[#E5E7EB] p-5 sm:p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-4">
                <div className="flex items-center gap-3">
                  <WhatsAppLogo size={40} />
                  <div>
                    <h3 className="text-base font-black text-[#111111]">Conexão Baileys</h3>
                    <p className="text-xs text-[#6B7280]">Conecte seu WhatsApp sem custos de API oficial</p>
                  </div>
                </div>

                <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                  waStatus.connected
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${waStatus.connected ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                  {waStatus.connected ? 'Conectado' : 'Desconectado'}
                </span>
              </div>

              {/* Connected State View */}
              {waStatus.connected ? (
                <div className="p-5 rounded-2xl bg-[#0B2519] text-white border border-[#155E38] space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300">
                        <Smartphone className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-xs text-emerald-200 font-semibold block">Número Conectado:</span>
                        <span className="text-base font-mono font-black text-white">{waStatus.phone || 'WhatsApp Ativo'}</span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500 text-black text-[11px] font-black uppercase tracking-wider">
                      Pronto
                    </span>
                  </div>

                  <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-3 text-xs">
                    <span className="text-emerald-100/80">Instância: <b>{settings.instanceName}</b></span>
                    <button
                      onClick={handleDisconnectWhatsApp}
                      disabled={waLoading}
                      className="px-3.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-bold transition-colors cursor-pointer"
                    >
                      {waLoading ? 'Desconectando...' : 'Desconectar'}
                    </button>
                  </div>
                </div>
              ) : (
                /* Disconnected / Pairing Options */
                <div className="space-y-4">
                  {/* Sub-Tabs: QR Code vs Phone 8-digit vs Direct Simulation */}
                  <div className="flex bg-[#F4F5F7] p-1 rounded-xl border border-[#E5E7EB]">
                    <button
                      onClick={() => setPairingMode('qr')}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        pairingMode === 'qr'
                          ? 'bg-white text-[#111111] shadow-xs'
                          : 'text-[#6B7280] hover:text-[#111111]'
                      }`}
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>QR Code</span>
                    </button>
                    <button
                      onClick={() => setPairingMode('code')}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        pairingMode === 'code'
                          ? 'bg-white text-[#111111] shadow-xs'
                          : 'text-[#6B7280] hover:text-[#111111]'
                      }`}
                    >
                      <SmartphoneNfc className="w-3.5 h-3.5" />
                      <span>Código 8 Dígitos</span>
                    </button>
                    <button
                      onClick={() => setPairingMode('simulate')}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        pairingMode === 'simulate'
                          ? 'bg-white text-[#111111] shadow-xs'
                          : 'text-[#6B7280] hover:text-[#111111]'
                      }`}
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                      <span>Teste Direto</span>
                    </button>
                  </div>

                  {/* MODE 1: QR CODE DISPLAY */}
                  {pairingMode === 'qr' && (
                    <div className="flex flex-col items-center gap-4 p-4 bg-[#F9FAFB] rounded-2xl border border-[#E5E7EB]">
                      <div className="p-3 bg-white rounded-2xl border-2 border-emerald-500/30 shadow-md flex items-center justify-center">
                        {waStatus.qrCodeData ? (
                          <img
                            src={waStatus.qrCodeData}
                            alt="WhatsApp QR Code Baileys"
                            className="w-56 h-56 object-contain rounded-xl"
                          />
                        ) : (
                          <div className="w-56 h-56 flex flex-col items-center justify-center text-gray-400 gap-3 p-4 text-center">
                            <QrCode className="w-12 h-12 text-emerald-600" />
                            <span className="text-xs font-bold text-[#374151]">Nenhum QR Code ativo no momento</span>
                            <p className="text-[10px] text-[#6B7280]">Clique no botão abaixo para gerar uma nova sessão de conexão.</p>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={handleGenerateWhatsAppQr}
                        disabled={waLoading}
                        className="w-full h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                      >
                        {waLoading ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <QrCode className="w-4 h-4" />
                        )}
                        <span>{waStatus.qrCodeData ? 'Atualizar / Recarregar QR Code' : 'Gerar QR Code Baileys'}</span>
                      </button>

                      <ol className="w-full space-y-1.5 text-xs text-[#4B5563] list-decimal list-inside bg-white p-3 rounded-xl border border-[#E5E7EB]">
                        <li>Abra o <b>WhatsApp</b> no celular</li>
                        <li>Acesse <b>Configurações &gt; Aparelhos Conectados</b></li>
                        <li>Toque em <b>Conectar um Aparelho</b> e aponte para o QR Code acima</li>
                      </ol>
                    </div>
                  )}

                  {/* MODE 2: 8-DIGIT PAIRING CODE */}
                  {pairingMode === 'code' && (
                    <div className="space-y-4 p-4 bg-[#F9FAFB] rounded-2xl border border-[#E5E7EB]">
                      <div>
                        <label className="text-xs font-bold text-[#111111] block mb-1">
                          Número de Telefone do WhatsApp (com DDI e DDD):
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="5511999998888"
                            value={pairingPhone}
                            onChange={(e) => setPairingPhone(e.target.value)}
                            className="flex-1 px-3.5 py-2.5 bg-white border border-[#D1D5DB] rounded-xl text-xs font-mono font-bold text-[#111111] focus:ring-2 focus:ring-emerald-500 outline-hidden"
                          />
                          <button
                            onClick={handleRequestPairingCode}
                            disabled={waLoading}
                            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all cursor-pointer shrink-0 disabled:opacity-50"
                          >
                            {waLoading ? 'Gerando...' : 'Gerar Código'}
                          </button>
                        </div>
                        <span className="text-[10px] text-[#6B7280] mt-1 block">
                          Exemplo Brasil: <b>5511998765432</b> (DDI 55 + DDD + 9 dígitos)
                        </span>
                      </div>

                      {/* Generated Pairing Code Badge */}
                      {waStatus.pairingCode && (
                        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                              Código de Pareamento Oficial:
                            </span>
                            <span className="text-[10px] text-emerald-600 font-bold">Válido por 60s</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-2xl font-mono font-black text-emerald-950 tracking-widest">
                              {waStatus.pairingCode}
                            </span>
                            <button
                              onClick={handleCopyPairingCode}
                              className="h-9 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                            >
                              {copiedPairingCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              <span>{copiedPairingCode ? 'Copiado!' : 'Copiar'}</span>
                            </button>
                          </div>
                        </div>
                      )}

                      <ol className="space-y-1.5 text-xs text-[#4B5563] list-decimal list-inside bg-white p-3 rounded-xl border border-[#E5E7EB]">
                        <li>No celular, abra <b>WhatsApp &gt; Aparelhos Conectados</b></li>
                        <li>Toque em <b>Conectar um Aparelho</b></li>
                        <li>Selecione <b>Conectar com número de telefone</b></li>
                        <li>Digite o código de 8 dígitos gerado acima para vincular</li>
                      </ol>
                    </div>
                  )}

                  {/* MODE 3: DIRECT TEST CONNECTION */}
                  {pairingMode === 'simulate' && (
                    <div className="space-y-3 p-4 bg-amber-50/70 rounded-2xl border border-amber-200">
                      <div className="flex items-center gap-2 text-amber-800">
                        <Zap className="w-4 h-4 text-amber-600" />
                        <h4 className="text-xs font-bold">Ambiente de Demonstração / Teste Imediato</h4>
                      </div>
                      <p className="text-xs text-amber-900 leading-relaxed">
                        Simule uma conexão ativa imediata para testar o envio de mensagens, o feed de logs e as 7 automações de funil sem precisar ler o QR code agora.
                      </p>
                      <button
                        onClick={handleSimulatePair}
                        disabled={waLoading}
                        className="w-full h-10 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Ativar Sessão Instantânea</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Instance Settings */}
              <div className="pt-3 border-t border-[#E5E7EB]">
                <label className="text-xs font-bold text-[#111111] block mb-1">Nome da Instância:</label>
                <input
                  type="text"
                  value={settings.instanceName}
                  onChange={(e) => setSettings({ ...settings, instanceName: e.target.value })}
                  placeholder="Alliance WhatsApp Hub"
                  className="w-full px-3 py-2 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl text-xs text-[#111111] focus:bg-white outline-hidden font-medium"
                />
              </div>
            </div>

            {/* Quick Test Message Dispatcher */}
            <div className="bg-white rounded-3xl border border-[#E5E7EB] p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
                <div className="flex items-center gap-2.5">
                  <Send className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-sm font-black text-[#111111]">Teste de Envio Imediato</h3>
                </div>
                <span className="text-[10px] text-[#6B7280] font-bold">Validação Baileys</span>
              </div>

              <div>
                <label className="text-xs font-bold text-[#111111] block mb-1">Número de Destino (DDD + Telefone):</label>
                <input
                  type="text"
                  placeholder="11998765432 ou 5511998765432"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl text-xs font-mono text-[#111111] focus:bg-white outline-hidden"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-[#111111]">Texto da Mensagem (com Spintax):</label>
                  <span className="text-[10px] text-[#6B7280] font-mono">{'{Olá|Oi}'}</span>
                </div>
                <textarea
                  rows={3}
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  className="w-full p-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl text-xs text-[#111111] focus:bg-white outline-hidden font-mono"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <button
                    type="button"
                    onClick={() => insertVariable('primeiro_nome', 'test')}
                    className="px-2 py-0.5 bg-[#F3F4F6] hover:bg-[#E5E7EB] rounded-md text-[10px] font-mono font-bold text-[#111111] transition-colors cursor-pointer"
                  >
                    + {'{primeiro_nome}'}
                  </button>
                  <button
                    type="button"
                    onClick={() => insertVariable('link_jogo', 'test')}
                    className="px-2 py-0.5 bg-[#F3F4F6] hover:bg-[#E5E7EB] rounded-md text-[10px] font-mono font-bold text-[#111111] transition-colors cursor-pointer"
                  >
                    + {'{link_jogo}'}
                  </button>
                </div>
              </div>

              <button
                onClick={handleSendTestMessage}
                disabled={waLoading}
                className="w-full h-11 rounded-xl bg-[#111111] hover:bg-[#1F2937] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-50"
              >
                {waLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 text-emerald-400" />}
                <span>Enviar Mensagem de Teste</span>
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN: Automations Deck & Broadcast (Col span 7) */}
          <div className="xl:col-span-7 space-y-6">
            {/* Section Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-[#111111]">Funil de 7 Automações do Jogador</h3>
                <p className="text-xs text-[#6B7280]">Mensagens enviadas automaticamente a cada etapa do jogador</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl">
                  7 Automações Prontas
                </span>
              </div>
            </div>

            {/* 2-Column Grid of 7 Automations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 1. PIX Recovery Phase 1 */}
              <div className="bg-white rounded-3xl border border-[#E5E7EB] p-5 shadow-xs space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200 shrink-0">
                        <Zap className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[#111111]">1. Recuperação PIX (Fase 1)</h4>
                        <p className="text-[10px] text-[#6B7280]">Abandono imediato ({settings.pixRecoveryDelayMinutes} min)</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.autoRecoverPix}
                      onChange={(e) => setSettings({ ...settings, autoRecoverPix: e.target.checked })}
                      className="w-4 h-4 rounded border-[#D1D5DB] text-[#111111] focus:ring-0 cursor-pointer"
                    />
                  </div>

                  <textarea
                    rows={3}
                    value={settings.pixRecoveryTemplate}
                    onChange={(e) => setSettings({ ...settings, pixRecoveryTemplate: e.target.value })}
                    className="w-full p-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl text-xs text-[#111111] focus:bg-white font-mono leading-relaxed outline-hidden"
                  />
                </div>
                <div className="flex flex-wrap gap-1 text-[10px] pt-1">
                  <button type="button" onClick={() => insertVariable('primeiro_nome', 'pix1')} className="px-1.5 py-0.5 bg-[#F3F4F6] rounded font-mono font-bold hover:bg-[#E5E7EB]">{'{primeiro_nome}'}</button>
                  <button type="button" onClick={() => insertVariable('valor_pix', 'pix1')} className="px-1.5 py-0.5 bg-[#F3F4F6] rounded font-mono font-bold hover:bg-[#E5E7EB]">{'{valor_pix}'}</button>
                  <button type="button" onClick={() => insertVariable('codigo_pix', 'pix1')} className="px-1.5 py-0.5 bg-[#F3F4F6] rounded font-mono font-bold hover:bg-[#E5E7EB]">{'{codigo_pix}'}</button>
                </div>
              </div>

              {/* 2. PIX Recovery Phase 2 (Urgency) */}
              <div className="bg-white rounded-3xl border border-[#E5E7EB] p-5 shadow-xs space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-200 shrink-0">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[#111111]">2. Recuperação PIX (Fase 2)</h4>
                        <p className="text-[10px] text-[#6B7280]">Urgência + Bônus ({settings.pixRecoveryPhase2DelayMinutes} min)</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.autoRecoverPixPhase2}
                      onChange={(e) => setSettings({ ...settings, autoRecoverPixPhase2: e.target.checked })}
                      className="w-4 h-4 rounded border-[#D1D5DB] text-[#111111] focus:ring-0 cursor-pointer"
                    />
                  </div>

                  <textarea
                    rows={3}
                    value={settings.pixRecoveryPhase2Template}
                    onChange={(e) => setSettings({ ...settings, pixRecoveryPhase2Template: e.target.value })}
                    className="w-full p-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl text-xs text-[#111111] focus:bg-white font-mono leading-relaxed outline-hidden"
                  />
                </div>
                <div className="flex flex-wrap gap-1 text-[10px] pt-1">
                  <button type="button" onClick={() => insertVariable('primeiro_nome', 'pix2')} className="px-1.5 py-0.5 bg-[#F3F4F6] rounded font-mono font-bold hover:bg-[#E5E7EB]">{'{primeiro_nome}'}</button>
                  <button type="button" onClick={() => insertVariable('valor_pix', 'pix2')} className="px-1.5 py-0.5 bg-[#F3F4F6] rounded font-mono font-bold hover:bg-[#E5E7EB]">{'{valor_pix}'}</button>
                  <button type="button" onClick={() => insertVariable('codigo_pix', 'pix2')} className="px-1.5 py-0.5 bg-[#F3F4F6] rounded font-mono font-bold hover:bg-[#E5E7EB]">{'{codigo_pix}'}</button>
                </div>
              </div>

              {/* 3. Welcome Message */}
              <div className="bg-white rounded-3xl border border-[#E5E7EB] p-5 shadow-xs space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shrink-0">
                        <MessageSquare className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[#111111]">3. Boas-Vindas Pós-Cadastro</h4>
                        <p className="text-[10px] text-[#6B7280]">Ativação instantânea de novos leads</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.autoWelcome}
                      onChange={(e) => setSettings({ ...settings, autoWelcome: e.target.checked })}
                      className="w-4 h-4 rounded border-[#D1D5DB] text-[#111111] focus:ring-0 cursor-pointer"
                    />
                  </div>

                  <textarea
                    rows={3}
                    value={settings.welcomeTemplate}
                    onChange={(e) => setSettings({ ...settings, welcomeTemplate: e.target.value })}
                    className="w-full p-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl text-xs text-[#111111] focus:bg-white font-mono leading-relaxed outline-hidden"
                  />
                </div>
                <div className="flex flex-wrap gap-1 text-[10px] pt-1">
                  <button type="button" onClick={() => insertVariable('primeiro_nome', 'welcome')} className="px-1.5 py-0.5 bg-[#F3F4F6] rounded font-mono font-bold hover:bg-[#E5E7EB]">{'{primeiro_nome}'}</button>
                  <button type="button" onClick={() => insertVariable('link_jogo', 'welcome')} className="px-1.5 py-0.5 bg-[#F3F4F6] rounded font-mono font-bold hover:bg-[#E5E7EB]">{'{link_jogo}'}</button>
                </div>
              </div>

              {/* 4. Deposit Confirmed */}
              <div className="bg-white rounded-3xl border border-[#E5E7EB] p-5 shadow-xs space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200 shrink-0">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[#111111]">4. Confirmação de Depósito</h4>
                        <p className="text-[10px] text-[#6B7280]">FTD & Recargas creditadas</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.autoDepositConfirmed}
                      onChange={(e) => setSettings({ ...settings, autoDepositConfirmed: e.target.checked })}
                      className="w-4 h-4 rounded border-[#D1D5DB] text-[#111111] focus:ring-0 cursor-pointer"
                    />
                  </div>

                  <textarea
                    rows={3}
                    value={settings.depositConfirmedTemplate}
                    onChange={(e) => setSettings({ ...settings, depositConfirmedTemplate: e.target.value })}
                    className="w-full p-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl text-xs text-[#111111] focus:bg-white font-mono leading-relaxed outline-hidden"
                  />
                </div>
                <div className="flex flex-wrap gap-1 text-[10px] pt-1">
                  <button type="button" onClick={() => insertVariable('primeiro_nome', 'deposit')} className="px-1.5 py-0.5 bg-[#F3F4F6] rounded font-mono font-bold hover:bg-[#E5E7EB]">{'{primeiro_nome}'}</button>
                  <button type="button" onClick={() => insertVariable('valor_pix', 'deposit')} className="px-1.5 py-0.5 bg-[#F3F4F6] rounded font-mono font-bold hover:bg-[#E5E7EB]">{'{valor_pix}'}</button>
                  <button type="button" onClick={() => insertVariable('saldo', 'deposit')} className="px-1.5 py-0.5 bg-[#F3F4F6] rounded font-mono font-bold hover:bg-[#E5E7EB]">{'{saldo}'}</button>
                </div>
              </div>

              {/* 5. Withdrawal Notice */}
              <div className="bg-white rounded-3xl border border-[#E5E7EB] p-5 shadow-xs space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-200 shrink-0">
                        <DollarSign className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[#111111]">5. Notificação de Saque PIX</h4>
                        <p className="text-[10px] text-[#6B7280]">Comprovante de pagamento</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.autoWithdrawNotify}
                      onChange={(e) => setSettings({ ...settings, autoWithdrawNotify: e.target.checked })}
                      className="w-4 h-4 rounded border-[#D1D5DB] text-[#111111] focus:ring-0 cursor-pointer"
                    />
                  </div>

                  <textarea
                    rows={3}
                    value={settings.withdrawNotifyTemplate}
                    onChange={(e) => setSettings({ ...settings, withdrawNotifyTemplate: e.target.value })}
                    className="w-full p-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl text-xs text-[#111111] focus:bg-white font-mono leading-relaxed outline-hidden"
                  />
                </div>
                <div className="flex flex-wrap gap-1 text-[10px] pt-1">
                  <button type="button" onClick={() => insertVariable('primeiro_nome', 'withdraw')} className="px-1.5 py-0.5 bg-[#F3F4F6] rounded font-mono font-bold hover:bg-[#E5E7EB]">{'{primeiro_nome}'}</button>
                  <button type="button" onClick={() => insertVariable('valor_pix', 'withdraw')} className="px-1.5 py-0.5 bg-[#F3F4F6] rounded font-mono font-bold hover:bg-[#E5E7EB]">{'{valor_pix}'}</button>
                </div>
              </div>

              {/* 6. Inactive Re-engagement */}
              <div className="bg-white rounded-3xl border border-[#E5E7EB] p-5 shadow-xs space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200 shrink-0">
                        <Flame className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[#111111]">6. Reativação de Jogadores</h4>
                        <p className="text-[10px] text-[#6B7280]">Inativos há {settings.inactiveDays} dias</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.autoInactiveReengagement}
                      onChange={(e) => setSettings({ ...settings, autoInactiveReengagement: e.target.checked })}
                      className="w-4 h-4 rounded border-[#D1D5DB] text-[#111111] focus:ring-0 cursor-pointer"
                    />
                  </div>

                  <textarea
                    rows={3}
                    value={settings.inactiveReengagementTemplate}
                    onChange={(e) => setSettings({ ...settings, inactiveReengagementTemplate: e.target.value })}
                    className="w-full p-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl text-xs text-[#111111] focus:bg-white font-mono leading-relaxed outline-hidden"
                  />
                </div>
                <div className="flex flex-wrap gap-1 text-[10px] pt-1">
                  <button type="button" onClick={() => insertVariable('primeiro_nome', 'reengage')} className="px-1.5 py-0.5 bg-[#F3F4F6] rounded font-mono font-bold hover:bg-[#E5E7EB]">{'{primeiro_nome}'}</button>
                  <button type="button" onClick={() => insertVariable('link_jogo', 'reengage')} className="px-1.5 py-0.5 bg-[#F3F4F6] rounded font-mono font-bold hover:bg-[#E5E7EB]">{'{link_jogo}'}</button>
                </div>
              </div>

              {/* 7. Affiliate Commission Notice */}
              <div className="md:col-span-2 bg-white rounded-3xl border border-[#E5E7EB] p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-200 shrink-0">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#111111]">7. Notificação de Comissões de Afiliados</h4>
                      <p className="text-[10px] text-[#6B7280]">Disparo quando uma nova indicação gera comissão no programa de afiliados</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.autoAffiliateCommission}
                    onChange={(e) => setSettings({ ...settings, autoAffiliateCommission: e.target.checked })}
                    className="w-4 h-4 rounded border-[#D1D5DB] text-[#111111] focus:ring-0 cursor-pointer"
                  />
                </div>

                <textarea
                  rows={2}
                  value={settings.affiliateCommissionTemplate}
                  onChange={(e) => setSettings({ ...settings, affiliateCommissionTemplate: e.target.value })}
                  className="w-full p-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl text-xs text-[#111111] focus:bg-white font-mono leading-relaxed outline-hidden"
                />
                <div className="flex flex-wrap gap-1 text-[10px]">
                  <button type="button" onClick={() => insertVariable('primeiro_nome', 'affiliate')} className="px-1.5 py-0.5 bg-[#F3F4F6] rounded font-mono font-bold hover:bg-[#E5E7EB]">{'{primeiro_nome}'}</button>
                  <button type="button" onClick={() => insertVariable('valor_pix', 'affiliate')} className="px-1.5 py-0.5 bg-[#F3F4F6] rounded font-mono font-bold hover:bg-[#E5E7EB]">{'{valor_pix}'}</button>
                  <button type="button" onClick={() => insertVariable('saldo', 'affiliate')} className="px-1.5 py-0.5 bg-[#F3F4F6] rounded font-mono font-bold hover:bg-[#E5E7EB]">{'{saldo}'}</button>
                </div>
              </div>
            </div>

            {/* Mass Broadcast Campaign Hub */}
            <div className="bg-gradient-to-br from-[#111827] to-[#1F2937] text-white rounded-3xl p-5 sm:p-6 shadow-md border border-[#374151] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <div>
                    <h3 className="text-sm font-black text-white">Disparo em Massa Inteligente (Broadcast)</h3>
                    <p className="text-xs text-gray-400">Envie campanhas segmentadas com Spintax e anti-ban automático</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Spintax Ativo
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-200 block mb-1">Nome da Campanha:</label>
                  <input
                    type="text"
                    value={broadcastName}
                    onChange={(e) => setBroadcastName(e.target.value)}
                    className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-xl text-xs text-white focus:bg-black/50 outline-hidden font-medium"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-200 block mb-1">Público-Alvo Segmentado:</label>
                  <select
                    value={broadcastAudience}
                    onChange={(e: any) => setBroadcastAudience(e.target.value)}
                    className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-xl text-xs text-white focus:bg-black/50 outline-hidden font-medium"
                  >
                    <option value="all">Todos os Jogadores Cadastrados</option>
                    <option value="pix_pending">Jogadores com PIX Pendente</option>
                    <option value="active_players">Jogadores Ativos com Saldo</option>
                    <option value="no_deposit">Cadastrados sem Depósito</option>
                    <option value="affiliates">Afiliados Ativos</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-200 block mb-1">Template da Mensagem em Massa:</label>
                <textarea
                  rows={3}
                  value={broadcastTemplate}
                  onChange={(e) => setBroadcastTemplate(e.target.value)}
                  className="w-full p-3 bg-black/30 border border-white/10 rounded-xl text-xs text-white focus:bg-black/50 outline-hidden font-mono"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <button type="button" onClick={() => insertVariable('primeiro_nome', 'broadcast')} className="px-2 py-0.5 bg-white/10 hover:bg-white/20 rounded text-[10px] font-mono text-white transition-colors cursor-pointer">{'{primeiro_nome}'}</button>
                  <button type="button" onClick={() => insertVariable('link_jogo', 'broadcast')} className="px-2 py-0.5 bg-white/10 hover:bg-white/20 rounded text-[10px] font-mono text-white transition-colors cursor-pointer">{'{link_jogo}'}</button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-300">Delay Anti-Ban entre envios:</label>
                  <input
                    type="number"
                    min={3}
                    max={60}
                    value={settings.antiBanDelaySec}
                    onChange={(e) => setSettings({ ...settings, antiBanDelaySec: parseInt(e.target.value) || 8 })}
                    className="w-16 px-2 py-1 bg-black/30 border border-white/10 rounded-lg text-xs text-center font-bold text-white"
                  />
                  <span className="text-xs text-gray-400">segundos</span>
                </div>

                <button
                  onClick={handleTriggerBroadcast}
                  disabled={broadcasting}
                  className="h-10 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
                >
                  {broadcasting ? <RefreshCw className="w-4 h-4 animate-spin text-black" /> : <Play className="w-4 h-4 fill-black text-black" />}
                  <span>Iniciar Disparo em Massa</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* FULL WIDTH BOTTOM: Real-time WhatsApp Activity Logs Terminal */}
        <div className="bg-white rounded-3xl border border-[#E5E7EB] p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E7EB] pb-3">
            <div className="flex items-center gap-2.5">
              <Activity className="w-5 h-5 text-emerald-600" />
              <div>
                <h3 className="text-sm font-black text-[#111111]">Feed de Disparos & Logs Baileys em Tempo Real</h3>
                <p className="text-xs text-[#6B7280]">Histórico de todas as mensagens automáticas, testes e campanhas enviadas</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                <input
                  type="text"
                  placeholder="Buscar por telefone ou nome..."
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl text-xs text-[#111111] focus:bg-white outline-hidden w-48 sm:w-60"
                />
              </div>

              <select
                value={logFilter}
                onChange={(e) => setLogFilter(e.target.value)}
                className="px-3 py-1.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl text-xs text-[#374151] font-medium outline-hidden"
              >
                <option value="all">Todos os Tipos</option>
                <option value="recovery">Recuperação PIX</option>
                <option value="welcome">Boas-Vindas</option>
                <option value="deposit">Depósito</option>
                <option value="withdraw">Saque</option>
                <option value="reengagement">Reativação</option>
                <option value="affiliate">Afiliado</option>
                <option value="broadcast">Disparo em Massa</option>
                <option value="test">Teste</option>
              </select>

              <button
                onClick={loadWhatsAppLogs}
                className="h-8 px-3 rounded-xl bg-[#F4F5F7] hover:bg-[#E5E7EB] text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Recarregar</span>
              </button>
            </div>
          </div>

          {/* Logs Table */}
          <div className="overflow-x-auto rounded-2xl border border-[#E5E7EB]">
            <table className="w-full text-left text-xs text-[#374151]">
              <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[11px] font-bold text-[#6B7280] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Data / Hora</th>
                  <th className="py-3 px-4">Destinatário</th>
                  <th className="py-3 px-4">Telefone</th>
                  <th className="py-3 px-4">Tipo do Disparo</th>
                  <th className="py-3 px-4">Prévia da Mensagem</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {filteredLogs.length > 0 ? (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#F9FAFB] transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap text-[#6B7280] font-mono text-[11px]">
                        {new Date(log.sentAt).toLocaleTimeString('pt-BR')} - {new Date(log.sentAt).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="py-3 px-4 font-bold text-[#111111] whitespace-nowrap">
                        {log.recipientName}
                      </td>
                      <td className="py-3 px-4 font-mono text-[#4B5563] whitespace-nowrap">
                        +{log.phone}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {getLogTypeBadge(log.type)}
                      </td>
                      <td className="py-3 px-4 max-w-md truncate text-[#4B5563]">
                        {log.messagePreview}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          log.status === 'sent'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          <CheckCheck className="w-3 h-3 text-emerald-600" />
                          Entregue
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[#9CA3AF] text-xs">
                      Nenhum registro de log encontrado com os filtros atuais.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
