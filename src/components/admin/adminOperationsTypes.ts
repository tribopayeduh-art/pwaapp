export interface OperationNote {
  id: string;
  note: string;
  priority: 'normal' | 'urgent';
  reviewed: boolean;
  updatedAt: string;
  updatedBy: string;
  updatedByName: string;
  revision: number;
}
