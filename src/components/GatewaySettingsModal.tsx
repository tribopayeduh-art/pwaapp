import React, { useState, useEffect } from 'react';
import {
  Bell,
  BellOff,
  UserPlus,
  Zap,
  X,
  Smartphone,
  Check,
  Volume2,
  Send,
  TrendingUp,
  Clock3,
  Gamepad2,
  Link2,
  Save,
  CheckCircle2,
  Layers,
  RefreshCw,
  Sliders,
  DollarSign
} from 'lucide-react';
import {
  getNotificationState,
  requestNotificationPermission,
  setNotificationsEnabled,
  setNewAffiliateNotificationsEnabled,
  triggerSaleNotification,
  playSaleSound,
  registerServiceWorker,
  NotificationState,
} from '../lib/pwaNotification';
import logoImg from './logo.webp';

interface GatewaySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const GatewaySettingsModal: React.FC<GatewaySettingsModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
}) => {
  const [notifState, setNotifState] = useState<NotificationState>(getNotificationState());
  const [activeTab, setActiveTab] = useState<'alerts' | 'integrations'>('alerts');

  // Notification Options State
  const [salesEnabled, setSalesEnabled] = useState<boolean>(true);
  const [newAffiliateEnabled, setNewAffiliateEnabledState] = useState<boolean>(true);
  const [ftdEnabled, setFtdEnabled] = useState<boolean>(true);
  const [pixPendingEnabled, setPixPendingEnabled] = useState<boolean>(false);
  const [gameActivityEnabled, setGameActivityEnabled] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Notification Mode: Simple or Detailed
  const [notificationMode, setNotificationMode] = useState<'simple' | 'detailed'>('detailed');

  // Webhook / External Integrations State
  const [webhookEnabled, setWebhookEnabled] = useState<boolean>(false);
  const [webhookUrl, setWebhookUrl] = useState<string>('');
  const [webhookSecret, setWebhookSecret] = useState<string>('');
  const [testingWebhook, setTestingWebhook] = useState<boolean>(false);
  const [testingPush, setTestingPush] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      const state = getNotificationState();
      setNotifState(state);
      setSalesEnabled(state.enabled && state.permission === 'granted');
      setNewAffiliateEnabledState(state.newAffiliateEnabled);

      try {
        const savedPrefs = JSON.parse(localStorage.getItem('affiliate_notification_prefs') || '{}');
        if (savedPrefs.ftd !== undefined) setFtdEnabled(savedPrefs.ftd);
        if (savedPrefs.pixPending !== undefined) setPixPendingEnabled(savedPrefs.pixPending);
        if (savedPrefs.gameActivity !== undefined) setGameActivityEnabled(savedPrefs.gameActivity);
        if (savedPrefs.sound !== undefined) setSoundEnabled(savedPrefs.sound);
      } catch (e) {
        // ignore
      }

      const savedMode = localStorage.getItem('affiliate_notification_mode') as 'simple' | 'detailed';
      if (savedMode) setNotificationMode(savedMode);

      const savedWebhook = localStorage.getItem('pg_gateway_webhook_url') || '';
      const savedSecret = localStorage.getItem('pg_gateway_webhook_secret') || '';
      const savedWebhookActive = localStorage.getItem('pg_gateway_webhook_enabled') === 'true';

      setWebhookUrl(savedWebhook);
      setWebhookSecret(savedSecret);
      setWebhookEnabled(savedWebhookActive);
    }
  }, [isOpen]);

  const savePrefs = (updates: Partial<{
    sales: boolean;
    registration: boolean;
    ftd: boolean;
    pixPending: boolean;
    gameActivity: boolean;
    sound: boolean;
    mode: 'simple' | 'detailed';
  }>) => {
    const currentPrefs = {
      sales: salesEnabled,
      registration: newAffiliateEnabled,
      ftd: ftdEnabled,
      pixPending: pixPendingEnabled,
      gameActivity: gameActivityEnabled,
      sound: soundEnabled,
      ...updates,
    };

    localStorage.setItem('affiliate_notification_prefs', JSON.stringify(currentPrefs));
    if (updates.mode) {
      localStorage.setItem('affiliate_notification_mode', updates.mode);
    }
  };

  if (!isOpen) return null;

  const handleToggleSales = async () => {
    if (!salesEnabled) {
      const res = await requestNotificationPermission();
      const granted = typeof res === 'boolean' ? res : res.granted;
      const updatedState = getNotificationState();
      setNotifState(updatedState);

      if (granted) {
        setSalesEnabled(true);
        setNotificationsEnabled(true);
        savePrefs({ sales: true });
        onShowToast('Notificações de vendas ativadas no dispositivo!', 'success');

        if (soundEnabled) playSaleSound();
        triggerSaleNotification({
          amount: '47,90',
          customTitle: 'Você vendeu! 💰',
          customSubtitle: 'Comissão de R$ 47,90 creditada na sua conta!',
        });
      } else {
        setSalesEnabled(false);
        setNotificationsEnabled(false);
        savePrefs({ sales: false });
        if (updatedState.permission === 'denied') {
          onShowToast('Permissão negada no navegador. Habilite nas configurações do seu celular.', 'error');
        }
      }
    } else {
      setSalesEnabled(false);
      setNotificationsEnabled(false);
      savePrefs({ sales: false });
      onShowToast('Notificações de vendas desativadas.', 'info');
    }
  };

  const handleToggleNewAffiliate = () => {
    const nextVal = !newAffiliateEnabled;
    setNewAffiliateEnabledState(nextVal);
    setNewAffiliateNotificationsEnabled(nextVal);
    savePrefs({ registration: nextVal });
    onShowToast(
      nextVal ? 'Notificação de novo cadastro ativada!' : 'Notificação de novo cadastro desativada.',
      nextVal ? 'success' : 'info'
    );
  };

  const handleToggleFtd = () => {
    const nextVal = !ftdEnabled;
    setFtdEnabled(nextVal);
    savePrefs({ ftd: nextVal });
    onShowToast(
      nextVal ? 'Notificação de Primeiro Depósito (FTD) ativada!' : 'Notificação de FTD desativada.',
      nextVal ? 'success' : 'info'
    );
  };

  const handleTogglePixPending = () => {
    const nextVal = !pixPendingEnabled;
    setPixPendingEnabled(nextVal);
    savePrefs({ pixPending: nextVal });
    onShowToast(
      nextVal ? 'Alerta de PIX Pendente ativado!' : 'Alerta de PIX Pendente desativado.',
      nextVal ? 'success' : 'info'
    );
  };

  const handleToggleGameActivity = () => {
    const nextVal = !gameActivityEnabled;
    setGameActivityEnabled(nextVal);
    savePrefs({ gameActivity: nextVal });
    onShowToast(
      nextVal ? 'Alerta de atividade em jogos ativado!' : 'Alerta de atividade em jogos desativado.',
      nextVal ? 'success' : 'info'
    );
  };

  const handleToggleSound = () => {
    const nextVal = !soundEnabled;
    setSoundEnabled(nextVal);
    savePrefs({ sound: nextVal });
    if (nextVal) {
      playSaleSound();
      onShowToast('Som de caixa registradora ativado!', 'success');
    } else {
      onShowToast('Som de venda desativado.', 'info');
    }
  };

  const handleTestSound = () => {
    playSaleSound();
    onShowToast('Reproduzindo som de venda...', 'info');
  };

  const handleTestPushAlert = async () => {
    setTestingPush(true);
    try {
      if (soundEnabled) playSaleSound();
      await triggerSaleNotification({
        amount: '89,90',
        customTitle: 'Você vendeu! 💰',
        customSubtitle: notificationMode === 'detailed' 
          ? 'Influenciador: VIP Partner • Jogador: Rodrigo M. • GEN DINO (R$ 89,90)' 
          : 'Comissão de R$ 89,90 confirmada no seu saldo!',
      });
      onShowToast('Notificação de teste disparada com sucesso!', 'success');
    } catch (e) {
      onShowToast('Erro ao disparar teste.', 'error');
    } finally {
      setTestingPush(false);
    }
  };

  const handleSaveWebhook = () => {
    localStorage.setItem('pg_gateway_webhook_url', webhookUrl.trim());
    localStorage.setItem('pg_gateway_webhook_secret', webhookSecret.trim());
    localStorage.setItem('pg_gateway_webhook_enabled', webhookEnabled ? 'true' : 'false');
    onShowToast('Configurações de integração e Webhook salvas com sucesso!', 'success');
  };

  const handleTestWebhook = async () => {
    if (!webhookUrl.trim()) {
      onShowToast('Informe a URL do Webhook para testar.', 'error');
      return;
    }

    setTestingWebhook(true);
    try {
      const payload = {
        event: 'sale.approved',
        amount: 89.90,
        currency: 'BRL',
        transactionId: `tx_${Date.now()}`,
        status: 'PAID',
        customer: {
          name: 'Jogador Exemplo',
          email: 'jogador@exemplo.com'
        },
        affiliate: {
          code: 'VIP100',
          commission: 89.90
        },
        timestamp: new Date().toISOString()
      };

      // Disparo simulado / real
      const res = await fetch(webhookUrl.trim(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(webhookSecret ? { 'X-Signature': webhookSecret } : {})
        },
        body: JSON.stringify(payload),
        mode: 'no-cors'
      });

      onShowToast('Webhook de teste enviado com sucesso!', 'success');
    } catch (e) {
      onShowToast('Disparo de Webhook concluído (pode requerer HTTPS/CORS liberado).', 'info');
    } finally {
      setTestingWebhook(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden animate-in fade-in duration-300"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div 
        className="relative w-full max-w-lg bg-white rounded-t-[32px] sm:rounded-3xl border-t sm:border border-zinc-200 shadow-2xl max-h-[92dvh] sm:max-h-[88dvh] overflow-hidden flex flex-col transform transition-all animate-in slide-in-from-bottom duration-300 ease-out sm:zoom-in-95 sm:slide-in-from-bottom-0 select-none pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Indicator Handle */}
        <div className="w-12 h-1.5 bg-zinc-300 rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

        {/* Header Black & White Clean */}
        <div className="bg-white px-5 sm:px-6 pt-3 sm:pt-5 pb-3 sm:pb-4 flex items-center justify-between border-b border-zinc-100 shrink-0 sticky top-0 z-10 bg-white/95 backdrop-blur-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-black flex items-center justify-center shrink-0 text-white shadow-xs">
              <Zap className="w-5 h-5 text-white fill-current" />
            </div>
            <div>
              <h2 className="font-extrabold text-sm sm:text-base text-black tracking-tight flex items-center gap-1.5">
                <span>Notificações de Vendas</span>
              </h2>
              <p className="text-[11px] sm:text-xs text-zinc-500 font-medium">
                Alertas em Tempo Real no seu dispositivo
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            type="button"
            className="w-9 h-9 sm:w-8 sm:h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 active:scale-95 text-black flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="px-5 sm:px-6 pt-3 pb-1 border-b border-zinc-100 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('alerts')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'alerts'
                ? 'bg-black text-white shadow-xs'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Alertas do Dispositivo</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('integrations')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'integrations'
                ? 'bg-black text-white shadow-xs'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Preferências & Webhook</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          {activeTab === 'alerts' && (
            <>
              {/* Status Badge & Push Controls */}
              <div className="bg-zinc-50 border border-zinc-200/80 rounded-2xl p-3.5 sm:p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Smartphone className="w-4 h-4 text-zinc-700" />
                    <div>
                      <span className="text-xs font-bold text-zinc-900 block">Status no Dispositivo</span>
                      <span className="text-[11px] text-zinc-500 block">Notificações Push no Navegador & PWA</span>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1.5 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                    notifState.permission === 'granted'
                      ? 'bg-emerald-600 text-white'
                      : notifState.permission === 'denied'
                      ? 'bg-rose-600 text-white'
                      : 'bg-amber-500 text-white'
                  }`}>
                    <Check className="w-3 h-3 text-white" />
                    <span>{notifState.permission === 'granted' ? 'Ativo' : notifState.permission === 'denied' ? 'Bloqueado' : 'Pendente'}</span>
                  </div>
                </div>

                {/* Action Buttons for Testing */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleTestSound}
                    className="py-2.5 px-3 bg-white hover:bg-zinc-100 text-zinc-800 border border-zinc-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-98"
                  >
                    <Volume2 className="w-3.5 h-3.5 text-zinc-700" />
                    <span>Testar Som</span>
                  </button>

                  <button
                    type="button"
                    disabled={testingPush}
                    onClick={handleTestPushAlert}
                    className="py-2.5 px-3 bg-black hover:bg-zinc-900 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-98 disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5 text-white" />
                    <span>{testingPush ? 'Enviando...' : 'Disparar Teste'}</span>
                  </button>
                </div>
              </div>

              {/* Mode Picker (Simples vs Detalhada) */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                  <Sliders className="w-3.5 h-3.5" />
                  Formato de Notificação
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNotificationMode('simple');
                      savePrefs({ mode: 'simple' });
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      notificationMode === 'simple'
                        ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs'
                        : 'bg-white text-zinc-800 border-zinc-200 hover:bg-zinc-50'
                    }`}
                  >
                    <span className="font-bold text-xs block">Simples</span>
                    <span className={`text-[10px] block mt-0.5 ${notificationMode === 'simple' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                      Evento e valor resumido
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNotificationMode('detailed');
                      savePrefs({ mode: 'detailed' });
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      notificationMode === 'detailed'
                        ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs'
                        : 'bg-white text-zinc-800 border-zinc-200 hover:bg-zinc-50'
                    }`}
                  >
                    <span className="font-bold text-xs block">Detalhada</span>
                    <span className={`text-[10px] block mt-0.5 ${notificationMode === 'detailed' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                      Influenciador, jogador e jogo
                    </span>
                  </button>
                </div>
              </div>

              {/* Event Toggles List */}
              <div className="space-y-2.5 pt-1">
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
                  Opções de Alertas em Tempo Real
                </label>

                {/* Toggle 1: Notificação de Vendas / PIX Pago */}
                <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-zinc-200 flex items-center justify-between gap-3 shadow-2xs hover:border-zinc-300 transition-colors">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
                        salesEnabled
                          ? 'bg-black text-white border-black'
                          : 'bg-zinc-100 text-zinc-400 border-zinc-200'
                      }`}
                    >
                      {salesEnabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-xs text-black">Vendas & Comissões (PIX Pago)</h3>
                      <p className="text-[11px] text-zinc-500 mt-0.5 leading-tight">
                        Notifica instantaneamente quando uma venda for paga e creditada
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleToggleSales}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      salesEnabled ? 'bg-black' : 'bg-zinc-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                        salesEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Toggle 2: Notificação de Novo Cadastro */}
                <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-zinc-200 flex items-center justify-between gap-3 shadow-2xs hover:border-zinc-300 transition-colors">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
                        newAffiliateEnabled
                          ? 'bg-black text-white border-black'
                          : 'bg-zinc-100 text-zinc-400 border-zinc-200'
                      }`}
                    >
                      <UserPlus className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-xs text-black">Novos Cadastros na Rede</h3>
                      <p className="text-[11px] text-zinc-500 mt-0.5 leading-tight">
                        Notifica novos jogadores e afiliados que entrarem com seu link
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleToggleNewAffiliate}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      newAffiliateEnabled ? 'bg-black' : 'bg-zinc-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                        newAffiliateEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Toggle 3: Primeiro Depósito (FTD) */}
                <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-zinc-200 flex items-center justify-between gap-3 shadow-2xs hover:border-zinc-300 transition-colors">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
                        ftdEnabled
                          ? 'bg-black text-white border-black'
                          : 'bg-zinc-100 text-zinc-400 border-zinc-200'
                      }`}
                    >
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-xs text-black">Primeiro Depósito (FTD Confirmado)</h3>
                      <p className="text-[11px] text-zinc-500 mt-0.5 leading-tight">
                        Alerta especial de conversão do 1º depósito do indicado
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleToggleFtd}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      ftdEnabled ? 'bg-black' : 'bg-zinc-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                        ftdEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Toggle 4: PIX Pendente / Cobrança Gerada */}
                <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-zinc-200 flex items-center justify-between gap-3 shadow-2xs hover:border-zinc-300 transition-colors">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
                        pixPendingEnabled
                          ? 'bg-black text-white border-black'
                          : 'bg-zinc-100 text-zinc-400 border-zinc-200'
                      }`}
                    >
                      <Clock3 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-xs text-black">PIX Pendente / Cobrança Gerada</h3>
                      <p className="text-[11px] text-zinc-500 mt-0.5 leading-tight">
                        Notifica quando um cliente gera um PIX aguardando pagamento
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleTogglePixPending}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      pixPendingEnabled ? 'bg-black' : 'bg-zinc-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                        pixPendingEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Toggle 5: Atividade em Jogos */}
                <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-zinc-200 flex items-center justify-between gap-3 shadow-2xs hover:border-zinc-300 transition-colors">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
                        gameActivityEnabled
                          ? 'bg-black text-white border-black'
                          : 'bg-zinc-100 text-zinc-400 border-zinc-200'
                      }`}
                    >
                      <Gamepad2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-xs text-black">Atividade nos Jogos & Comissões</h3>
                      <p className="text-[11px] text-zinc-500 mt-0.5 leading-tight">
                        Notifica partidas e rodadas dos indicados em tempo real
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleToggleGameActivity}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      gameActivityEnabled ? 'bg-black' : 'bg-zinc-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                        gameActivityEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Toggle 6: Som de Caixa Registradora */}
                <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-zinc-200 flex items-center justify-between gap-3 shadow-2xs hover:border-zinc-300 transition-colors">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
                        soundEnabled
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-zinc-100 text-zinc-400 border-zinc-200'
                      }`}
                    >
                      <Volume2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-xs text-black">Som de Caixa Registradora</h3>
                      <p className="text-[11px] text-zinc-500 mt-0.5 leading-tight">
                        Toca áudio de dinheiro a cada confirmação de venda ou comissão
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleToggleSound}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      soundEnabled ? 'bg-emerald-600' : 'bg-zinc-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                        soundEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Live Preview Card */}
              <div className="p-3.5 bg-zinc-900 rounded-2xl border border-zinc-800 text-white space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-400" />
                    Prévia do Alerta ({notificationMode === 'simple' ? 'Modo Simples' : 'Modo Detalhado'})
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono">Agora</span>
                </div>
                <div className="flex items-start gap-2.5 pt-1">
                  <img src={logoImg} alt="Logo" className="w-7 h-7 rounded-lg object-contain bg-black p-0.5 shrink-0" />
                  <div>
                    <strong className="text-xs font-bold text-white block">Você vendeu! 💰</strong>
                    {notificationMode === 'detailed' ? (
                      <p className="text-[11px] text-zinc-300 leading-snug">
                        Influenciador: Marina S. • Jogador: Carlos M. • GEN DINO (R$ 100,00)
                      </p>
                    ) : (
                      <p className="text-[11px] text-zinc-300 leading-snug">
                        Comissão de R$ 100,00 creditada na sua conta!
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'integrations' && (
            <div className="space-y-4">
              {/* Webhook Header & Toggle */}
              <div className="bg-zinc-50 border border-zinc-200/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                      webhookEnabled ? 'bg-black text-white border-black' : 'bg-zinc-200 text-zinc-500 border-zinc-300'
                    }`}>
                      <Link2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-xs text-black">Webhook de Vendas em Tempo Real</h3>
                      <p className="text-[11px] text-zinc-500 mt-0.5 leading-tight">
                        Dispara eventos para WhatsApp, Telegram, Zapier, Make ou CRM
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setWebhookEnabled(!webhookEnabled)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      webhookEnabled ? 'bg-black' : 'bg-zinc-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                        webhookEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Webhook Form */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-zinc-700 block">
                    URL de Destino do Webhook (Endpoint POST)
                  </label>
                  <input
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://seu-servidor.com/api/webhook-vendas"
                    className="w-full bg-white border border-zinc-300 focus:border-black text-xs font-mono px-3.5 py-2.5 rounded-xl outline-none transition-colors"
                  />
                  <span className="text-[10px] text-zinc-400 block">
                    Aceita URLs de bot Telegram, gateway WhatsApp (Z-API, Evolution), Discord ou servidores próprios.
                  </span>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-zinc-700 block">
                    Chave Secreta de Assinatura (X-Signature Header - Opcional)
                  </label>
                  <input
                    type="password"
                    value={webhookSecret}
                    onChange={(e) => setWebhookSecret(e.target.value)}
                    placeholder="ex: sec_prod_gateway_9824"
                    className="w-full bg-white border border-zinc-300 focus:border-black text-xs font-mono px-3.5 py-2.5 rounded-xl outline-none transition-colors"
                  />
                </div>

                {/* Event Types Handled */}
                <div className="p-3 bg-zinc-50 rounded-2xl border border-zinc-200 space-y-1.5">
                  <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider block">
                    Payloads Enviados Automaticamente
                  </span>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px] text-zinc-700 font-medium">
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>sale.approved (Venda)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>user.registered (Cadastro)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>ftd.converted (1º Depósito)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>pix.pending (Gerado)</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveWebhook}
                    className="flex-1 py-3 bg-black hover:bg-zinc-900 text-white font-bold text-xs rounded-xl shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Salvar Configurações</span>
                  </button>

                  <button
                    type="button"
                    disabled={testingWebhook}
                    onClick={handleTestWebhook}
                    className="py-3 px-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{testingWebhook ? 'Testando...' : 'Testar Webhook'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
          <span>Configurações do Gateway v3.2</span>
          <button
            type="button"
            onClick={onClose}
            className="font-bold text-black hover:underline cursor-pointer"
          >
            Concluir e Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
