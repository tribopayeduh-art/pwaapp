import React from 'react';
import { GameUser } from '../types';
import { IGamingPlayerView } from '../../components/IGamingPlayerView';

interface GameDashboardProps {
  user: GameUser;
  onNavigate: (tab: string) => void;
  onShowToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
  onOpenDeposit?: () => void;
  onOpenWithdraw?: () => void;
  onStartGame?: (betAmount: number) => void;
}

export const GameDashboard: React.FC<GameDashboardProps> = ({
  user,
  onNavigate,
  onShowToast,
  onOpenDeposit,
  onOpenWithdraw,
  onStartGame,
}) => {
  return (
    <IGamingPlayerView
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        pixKey: user.pixKey || '',
        balance: user.balance ?? 0,
        referralCode: user.referralCode || 'BP123',
        createdAt: new Date().toISOString(),
      }}
      onDeposit={() => {
        if (onOpenDeposit) {
          onOpenDeposit();
        } else {
          onShowToast('Abre a tela de depósito PIX.', 'info');
        }
      }}
      onWithdraw={() => {
        if (onOpenWithdraw) {
          onOpenWithdraw();
        } else {
          onShowToast('Abre a tela de saque PIX.', 'info');
        }
      }}
      onPlayGame={(betAmount) => {
        if (onStartGame) {
          onStartGame(betAmount);
        } else {
          onShowToast(`Partida iniciada com a aposta de R$ ${betAmount.toFixed(2)}!`, 'success');
          onNavigate('play');
        }
      }}
      onOpenReferral={() => {
        onNavigate('missions');
      }}
      onOpenProfile={() => {
        onNavigate('profile');
      }}
      onShowToast={onShowToast}
    />
  );
};
