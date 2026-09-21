import React from 'react';
import { User } from '../types';
import { SubwayPayPlayerView } from './SubwayPayPlayerView';

interface Props {
  user: User;
  onBack: () => void;
  onDeposit: () => void;
  onBalanceChange: (balance: number) => void;
  onShowToast: (message: string, type?: 'info' | 'success' | 'error') => void;
}

export const ZumblaPlayerView: React.FC<Props> = (props) => {
  return <SubwayPayPlayerView {...props} />;
};

