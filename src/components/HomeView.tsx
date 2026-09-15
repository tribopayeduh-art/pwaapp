import React from 'react';
import { User, Transaction, AffiliateInfo } from '../types';
import { BalanceCard } from './BalanceCard';
import { EmptyState } from './EmptyState';
import { ArrowRight, QrCode, UserPlus, CheckCircle2, Clock3, BadgeDollarSign } from 'lucide-react';

interface HomeViewProps {
  user: User;
  transactions: Transaction[];
  affiliateInfo?: AffiliateInfo | null;
  onDeposit: () => void;
  onWithdraw: () => void;
  onNavigateToFinance: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  user,
  transactions,
  affiliateInfo,
  onDeposit,
  onWithdraw,
  onNavigateToFinance,
}) => {
  const recentActivities = [
    ...transactions.filter(tx => tx.type === 'deposit').map(tx => ({
      id: `pix_${tx.id}`,
      type: 'pix' as const,
      title: tx.status === 'approved' ? 'PIX pago' : tx.status === 'pending' ? 'PIX gerado' : 'PIX não concluído',
      subtitle: tx.status === 'approved' ? 'Pagamento confirmado' : tx.status === 'pending' ? 'Aguardando pagamento' : 'Cobrança encerrada',
      amount: tx.amount,
      status: tx.status,
      createdAt: tx.createdAt,
    })),
    ...(affiliateInfo?.indications || []).map(indication => ({
      id: `registration_${indication.id}`,
      type: 'registration' as const,
      title: 'Novo cadastro',
      subtitle: indication.referredName || indication.referredEmail || 'Novo indicado',
      amount: null,
      status: 'registered',
      createdAt: indication.createdAt,
    })),
    ...(affiliateInfo?.commissions || []).map(commission => ({
      id: `commission_${commission.id}`,
      type: 'commission' as const,
      title: 'Comissão recebida',
      subtitle: `${commission.buyerName}${commission.gameName ? ` • ${commission.gameName}` : ''}`,
      amount: commission.amount,
      status: 'approved',
      createdAt: commission.createdAt,
    })),
  ].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 6);

  const formatDate = (value: string) => {
    const date = new Date(value);
    const today = date.toDateString() === new Date().toDateString();
    const time = date.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
    return today ? `Hoje, ${time}` : `${date.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' })}, ${time}`;
  };

  return (
    <div className="home-view space-y-6 pb-24 px-4 pt-4">
      {/* Top Welcome Greeting */}
      <div>
        <h1 className="text-xl font-bold text-[#111111] tracking-tight">
          Olá, {user.name ? user.name.split(' ')[0] : 'Usuário'}
        </h1>
        <p className="text-xs text-[#737373] font-normal mt-0.5">
          Bem-vindo ao seu painel financeiro.
        </p>
      </div>

      {/* Main Single Balance Card */}
      <BalanceCard balance={user.balance + Number(affiliateInfo?.affiliateBalance || 0)} walletBalance={user.balance} affiliateBalance={Number(affiliateInfo?.affiliateBalance || 0)} onDeposit={onDeposit} onWithdraw={onWithdraw} />

      {/* Recent Activity Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-xs uppercase tracking-wider text-[#737373]">
            Atividade recente
          </h2>

          {recentActivities.length > 0 && (
            <button
              onClick={onNavigateToFinance}
              className="text-xs font-semibold text-[#111111] hover:underline flex items-center gap-1 cursor-pointer"
            >
              Ver todas
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {recentActivities.length === 0 ? (
          <EmptyState message="Nenhum PIX ou cadastro recente." />
        ) : (
          <div className="home-activity-list space-y-2">
            {recentActivities.map((activity) => (
              <article key={activity.id} className={`home-activity-card ${activity.type}`}>
                <div className="home-activity-icon">{activity.type === 'pix' ? <QrCode/> : activity.type === 'commission' ? <BadgeDollarSign/> : <UserPlus/>}</div>
                <div className="home-activity-copy"><strong>{activity.title}</strong><span>{activity.subtitle}</span><small>{formatDate(activity.createdAt)}</small></div>
                <div className="home-activity-meta">
                  {activity.amount !== null && <strong>R$ {activity.amount.toLocaleString('pt-BR', { minimumFractionDigits:2 })}</strong>}
                  <span className={activity.status === 'approved' || activity.status === 'registered' ? 'success' : 'pending'}>{activity.status === 'approved' ? <CheckCircle2/> : activity.status === 'registered' ? <UserPlus/> : <Clock3/>}{activity.status === 'approved' ? 'Pago' : activity.status === 'registered' ? 'Cadastrado' : 'Pendente'}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
