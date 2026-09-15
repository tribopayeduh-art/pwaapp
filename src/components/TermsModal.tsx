import React from 'react';
import { AllianceTermsModal } from './AllianceTermsModal';

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

export const TermsModal: React.FC<TermsModalProps> = ({
  isOpen,
  onClose,
}) => {
  return (
    <AllianceTermsModal
      isOpen={isOpen}
      onAccept={onClose}
      onCancel={onClose}
    />
  );
};
