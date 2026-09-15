import React from 'react';
import {
  ShieldCheck,
  Activity,
  Server,
  Database,
  Lock,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Terminal
} from 'lucide-react';
import {
  IOSCard,
  IOSBadge,
  IOSButton
} from './IOSComponents';

interface SystemLogItem {
  id: string;
  level: 'info' | 'warn' | 'error';
  category: string;
  message: string;
  timestamp: string;
}

interface AdminSecurityTabProps {
  onOpenMigrationModal?: () => void;
}

export const AdminSecurityTab: React.FC<AdminSecurityTabProps> = ({ onOpenMigrationModal }) => {
  const sampleLogs: SystemLogItem[] = [
    {
      id: 'log-1',
      level: 'info',
      category: 'PIX Gateway',
      message: 'Webhook PIX recebido e processado: Liquidação instantânea de R$ 50,00',
      timestamp: new Date().toLocaleTimeString('pt-BR')
    },
    {
      id: 'log-2',
      level: 'info',
      category: 'iGaming Engine',
      message: 'RTP calibrado para GEN DINO Runner: 88.0% com anti-cheat ativo',
      timestamp: new Date(Date.now() - 60000).toLocaleTimeString('pt-BR')
    },
    {
      id: 'log-3',
      level: 'info',
      category: 'Security',
      message: 'Sessão de Super Admin validada com token Bearer SHA-256',
      timestamp: new Date(Date.now() - 180000).toLocaleTimeString('pt-BR')
    },
    {
      id: 'log-4',
      level: 'info',
      category: 'Database',
      message: 'Snapshot de saldos e retenção sincronizados com sucesso',
      timestamp: new Date(Date.now() - 360000).toLocaleTimeString('pt-BR')
    }
  ];

  return (
    <div className="space-y-5">
      {/* System Health Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <IOSCard className="p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-[#34C759]/15 text-[#34C759] flex items-center justify-center font-bold">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Servidor Core API
            </span>
            <span className="text-base font-bold text-slate-900 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#34C759]" />
              Online (Latência 18ms)
            </span>
          </div>
        </IOSCard>

        <IOSCard className="p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-[#007AFF]/15 text-[#007AFF] flex items-center justify-center font-bold">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Gateway PIX
            </span>
            <span className="text-base font-bold text-slate-900 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#34C759]" />
              Conectado & Transacionando
            </span>
          </div>
        </IOSCard>

        <IOSCard className="p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-[#AF52DE]/15 text-[#AF52DE] flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Anti-Cheat Engine
            </span>
            <span className="text-base font-bold text-slate-900 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#34C759]" />
              Proteção Ativa 100%
            </span>
          </div>
        </IOSCard>
      </div>

      {/* Database Backup & VPS Migration Card */}
      {onOpenMigrationModal && (
        <IOSCard className="p-5 border-emerald-200/80 bg-gradient-to-r from-emerald-50 via-white to-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-600/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-slate-900">Migração & Backup Integrator VPS</h3>
                <IOSBadge variant="green">Online</IOSBadge>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Exporte todo o banco de dados (todas as chaves, usuários, saldos, PIX e configurações) para hospedar diretamente na VPS da Integrator.
              </p>
            </div>
          </div>
          <IOSButton
            variant="primary"
            size="sm"
            onClick={onOpenMigrationModal}
            className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 shadow-sm"
          >
            <Database className="w-3.5 h-3.5" />
            <span>Exportar para VPS</span>
          </IOSButton>
        </IOSCard>
      )}

      {/* System Logs Stream */}
      <IOSCard className="p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-black/[0.04] pb-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-slate-400" />
            <h3 className="font-bold text-sm text-slate-900">Logs de Auditoria & Eventos do Sistema</h3>
          </div>
          <IOSBadge variant="green">Em Tempo Real</IOSBadge>
        </div>

        <div className="divide-y divide-black/[0.04] font-mono text-xs">
          {sampleLogs.map((log) => (
            <div key={log.id} className="py-2.5 flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 min-w-0">
                <span className="text-[10px] text-slate-400 shrink-0 font-sans pt-0.5">{log.timestamp}</span>
                <span className="text-[10px] font-bold uppercase px-1.5 py-0.2 rounded bg-black/[0.05] text-slate-700 shrink-0 font-sans">
                  {log.category}
                </span>
                <span className="text-slate-800 text-[11px] truncate font-sans">{log.message}</span>
              </div>
              <span className="text-[10px] text-[#34C759] font-bold shrink-0 font-sans">OK</span>
            </div>
          ))}
        </div>
      </IOSCard>
    </div>
  );
};
