import React, { useState } from 'react';
import {
  Database,
  Download,
  FileCode,
  Server,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ShieldCheck,
  Users,
  CreditCard,
  Gamepad2,
  KeyRound,
  X,
  Loader2,
  ExternalLink
} from 'lucide-react';
import { IOSCard, IOSButton, IOSBadge } from './IOSComponents';

interface AdminVpsMigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string | null;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const AdminVpsMigrationModal: React.FC<AdminVpsMigrationModalProps> = ({
  isOpen,
  onClose,
  token,
  onShowToast
}) => {
  const [downloading, setDownloading] = useState(false);
  const [downloadingSql, setDownloadingSql] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [lastCounts, setLastCounts] = useState<Record<string, number> | null>(null);

  if (!isOpen) return null;

  // 1. Download full database JSON
  const handleExportDatabase = async () => {
    if (!token) {
      onShowToast('Sessão expirada. Faça login novamente.', 'error');
      return;
    }

    setDownloading(true);
    setDownloadSuccess(false);

    try {
      const res = await fetch('/api/admin/export-database', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.counts) {
        setLastCounts(data.counts);
      }

      // Create download blob
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      link.href = url;
      link.download = `backup_completo_paygateway_vps_integrator_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setDownloadSuccess(true);
      onShowToast('Exportação concluída! O arquivo JSON com todas as tabelas foi baixado.', 'success');
    } catch (err: any) {
      console.error('Download export error:', err);
      onShowToast(err?.message || 'Falha ao baixar backup do banco.', 'error');
    } finally {
      setDownloading(false);
    }
  };

  // 2. Download SQL Schema Script
  const handleExportSql = async () => {
    if (!token) return;
    setDownloadingSql(true);

    try {
      const res = await fetch('/api/admin/export-database', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) throw new Error('Falha ao obter dados.');
      const data = await res.json();

      const sqlContent = data.sqlSchema || '-- Nenhum schema retornado.';
      const blob = new Blob([sqlContent], { type: 'text/sql' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `schema_banco_paygateway_integrator_vps.sql`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      onShowToast('Script SQL das tabelas baixado com sucesso!', 'success');
    } catch (err: any) {
      onShowToast('Falha ao gerar script SQL.', 'error');
    } finally {
      setDownloadingSql(false);
    }
  };

  // 3. Copy Migration instructions to clipboard
  const handleCopyInstructions = () => {
    const instructions = `# ROTEIRO DE MIGRAÇÃO PARA VPS INTEGRATOR
# Sistema: PayGateway & Alliance Hub
# Data de Geração: ${new Date().toLocaleDateString('pt-BR')}

1. NA SUA VPS DA INTEGRATOR:
   - Instale Node.js 20 LTS:
     curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
     sudo apt-get install -y nodejs git build-essential

   - Instale o PM2 para manter o sistema sempre online:
     sudo npm install -g pm2

2. TRANSFERÊNCIA DE CÓDIGO E ARQUIVOS:
   - Envie a pasta do projeto para /var/www/paygateway na VPS
   - Coloque o arquivo de backup exportado (backup_completo_paygateway_vps_integrator_*.json) na pasta /var/www/paygateway/backup/

3. VARIÁVEIS DE AMBIENTE (.env):
   PORT=3000
   NODE_ENV=production
   DOTFY_API_KEY=vk_live_0iTBP0DSt_865LGgyvH5kPmJ0CbtO4CPsy0xJvqm8tE
   JWT_SECRET=sua_chave_secreta_super_segura

4. INICIAR O SISTEMA NA VPS:
   npm install
   npm run build
   pm2 start dist/server.cjs --name "paygateway"
   pm2 save
   pm2 startup

5. IMPORTAÇÃO DOS DADOS:
   Todas as chaves, saldos de jogadores, comissões de afiliados, RTP dos jogos e transações estão contidas no arquivo JSON exportado.`;

    navigator.clipboard.writeText(instructions);
    setCopiedScript(true);
    onShowToast('Instruções para VPS Integrator copiadas!', 'success');
    setTimeout(() => setCopiedScript(false), 3000);
  };

  const tablesList = [
    { name: 'users', label: 'Usuários & Senhas Hash', icon: Users, desc: 'Jogadores, saldos de carteira, permissões de admin e chaves PIX' },
    { name: 'affiliates', label: 'Afiliados & Sub-redes', icon: Users, desc: 'Saldos de comissão, % de revshare, CPA e configurações CPA Killer' },
    { name: 'referrals', label: 'Rede de Indicações', icon: Users, desc: 'Mapeamento completo de indicados por afiliados e influencers' },
    { name: 'transactions', label: 'Transações Financeiras', icon: CreditCard, desc: 'Histórico de depósitos, saques manuais e cashouts automáticos' },
    { name: 'charges', label: 'Cobranças PIX (Dotfy)', icon: CreditCard, desc: 'Histórico de PIX gerados, correlationIDs e comprovantes' },
    { name: 'affiliateCommissions', label: 'Extrato de Comissões', icon: CreditCard, desc: 'Comissões creditadas e desviadas por regras antifraude' },
    { name: 'games', label: 'Catálogo de Jogos', icon: Gamepad2, desc: 'GEN DINO Runner, Zumbla, Block Win, provedores e capas' },
    { name: 'gameConfigs', label: 'Calibragens de RTP & Retenção', icon: Gamepad2, desc: 'Taxas de vitória, house edge, limites de aposta e GGR acumulado' },
    { name: 'gameBets', label: 'Apostas em Andamento', icon: Gamepad2, desc: 'Histórico de apostas ativas, cashouts e multiplicadores' },
    { name: 'settings', label: 'Chaves do Gateway & Dotfy', icon: KeyRound, desc: 'Credenciais de API, tokens de webhook e configurações do sistema' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-white rounded-3xl shadow-2xl overflow-hidden border border-black/5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Migração para VPS Integrator
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Pronto para Exportação
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Exporte todas as coleções, chaves, configurações e histórico em um arquivo organizado.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Main Action Banner */}
          <div className="p-5 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Exportador de Banco Completo (1-Clique)
              </span>
              <p className="text-sm font-semibold text-emerald-950">
                Gera o arquivo com todos os dados estruturados para restaurar na VPS da Integrator.
              </p>
              <p className="text-xs text-emerald-700">
                Inclui 14 coleções: usuários, saldos, afiliados, transações PIX, configurações de jogos e chaves.
              </p>
            </div>

            <button
              onClick={handleExportDatabase}
              disabled={downloading}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition-all shadow-lg shadow-emerald-600/25 shrink-0 disabled:opacity-50"
            >
              {downloading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Gerando Pacote...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Baixar Banco Completo (.JSON)</span>
                </>
              )}
            </button>
          </div>

          {downloadSuccess && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-emerald-900 text-xs font-medium">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>
                <strong>Download efetuado com sucesso!</strong> Salve este arquivo com segurança para importar na VPS Integrator.
              </span>
            </div>
          )}

          {/* Secondary Action: SQL Schema & Copy Instructions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={handleExportSql}
              disabled={downloadingSql}
              className="p-4 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-left transition-colors flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <FileCode className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Script SQL das Tabelas</h4>
                  <p className="text-[11px] text-slate-500">Para PostgreSQL / MySQL na VPS</p>
                </div>
              </div>
              <Download className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
            </button>

            <button
              onClick={handleCopyInstructions}
              className="p-4 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-left transition-colors flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  {copiedScript ? <Check className="w-5 h-5 text-emerald-600" /> : <Copy className="w-5 h-5" />}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">
                    {copiedScript ? 'Copiado para a área de transferência!' : 'Copiar Roteiro da VPS'}
                  </h4>
                  <p className="text-[11px] text-slate-500">Comandos PM2, Node.js e .env</p>
                </div>
              </div>
              <span className="text-xs font-bold text-indigo-600">Copiar</span>
            </button>
          </div>

          {/* List of collections included in export */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Tabelas e Coleções Mapeadas no Pacote
              </h3>
              <span className="text-xs text-slate-400 font-medium">100% Compatível com VPS</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {tablesList.map((tbl) => {
                const IconComp = tbl.icon;
                const count = lastCounts ? lastCounts[tbl.name] : undefined;
                return (
                  <div
                    key={tbl.name}
                    className="p-3 rounded-xl bg-slate-50 border border-black/[0.04] flex items-start gap-3"
                  >
                    <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-600 flex items-center justify-center shrink-0 mt-0.5">
                      <IconComp className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-slate-900 truncate">{tbl.label}</span>
                        {count !== undefined && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-700 font-bold">
                            {count} {count === 1 ? 'registro' : 'registros'}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-1">{tbl.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Migration Checklist Guide */}
          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-2">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Instruções Rápidas para a VPS da Integrator:</span>
            </div>
            <ol className="text-xs text-amber-900/90 space-y-1.5 list-decimal list-inside pl-1">
              <li>
                <strong>Baixe o arquivo .JSON</strong> usando o botão verde acima.
              </li>
              <li>
                Na VPS da Integrator, clone ou envie os arquivos da aplicação e instale as dependências com <code className="px-1 py-0.5 rounded bg-amber-100 font-mono text-[11px]">npm install</code>.
              </li>
              <li>
                Configure o seu arquivo <code className="px-1 py-0.5 rounded bg-amber-100 font-mono text-[11px]">.env</code> com suas chaves da Dotfy e porta 3000.
              </li>
              <li>
                Inicie a aplicação na VPS usando o PM2: <code className="px-1 py-0.5 rounded bg-amber-100 font-mono text-[11px]">pm2 start dist/server.cjs --name "paygateway"</code>.
              </li>
            </ol>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Exportação protegida por autenticação Super Admin
          </span>
          <IOSButton variant="secondary" size="sm" onClick={onClose}>
            Fechar
          </IOSButton>
        </div>
      </div>
    </div>
  );
};
