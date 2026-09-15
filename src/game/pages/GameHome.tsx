import React from 'react';
import { GameUser } from '../types';
import { IGamingPlayerView } from '../../components/IGamingPlayerView';

interface GameHomeProps {
  user: GameUser | null;
  onNavigate: (tab: string) => void;
  onShowToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
  onOpenDeposit?: () => void;
  onOpenWithdraw?: () => void;
  onStartGame?: (betAmount: number) => void;
}

export const GameHome: React.FC<GameHomeProps> = ({
  user,
  onNavigate,
  onShowToast,
  onOpenDeposit,
  onOpenWithdraw,
  onStartGame,
}) => {
  return (
    <IGamingPlayerView
      user={
        user
          ? {
              id: user.id,
              name: user.name,
              email: user.email,
              phone: user.phone || '',
              pixKey: user.pixKey || '',
              balance: user.balance ?? 0,
              referralCode: user.referralCode || 'BP123',
              createdAt: new Date().toISOString(),
            }
          : null
      }
      onDeposit={() => {
        if (user) {
          if (onOpenDeposit) onOpenDeposit();
          else onShowToast('Abre o modal de depósito PIX.', 'info');
        } else {
          onShowToast('Faça login ou crie sua conta para depositar!', 'info');
          onNavigate('login');
        }
      }}
      onWithdraw={() => {
        if (user) {
          if (onOpenWithdraw) onOpenWithdraw();
          else onShowToast('Abre o modal de saque PIX.', 'info');
        } else {
          onShowToast('Faça login ou crie sua conta para sacar!', 'info');
          onNavigate('login');
        }
      }}
      onPlayGame={(betAmount) => {
        if (user) {
          if (onStartGame) {
            onStartGame(betAmount);
          } else {
            onShowToast(`Aposta de R$ ${betAmount.toFixed(2)} iniciada!`, 'success');
            onNavigate('play');
          }
        } else {
          onShowToast('Crie sua conta ou faça login para jogar e ganhar!', 'info');
          onNavigate('register');
        }
      }}
      onOpenReferral={() => {
        if (user) {
          onNavigate('missions');
        } else {
          onNavigate('register');
        }
      }}
      onOpenProfile={() => {
        if (user) {
          onNavigate('profile');
        } else {
          onNavigate('login');
        }
      }}
      onShowToast={onShowToast}
    />
  );
};
