import React, { useState, useMemo, useEffect } from 'react';
import { ArrowUpRight, CheckCircle2, XCircle, Copy, Search, Download, Clock3, AlertTriangle, ChevronRight, Loader2, ReceiptText, ShieldCheck } from 'lucide-react';
import { AdminWithdrawalItem } from './adminTypes';
import { money, dateTime, waitLabel, downloadAdminCsv } from './adminUiUtils';
import { Modal } from '../Modal';
import { Pagination } from '../Pagination';
interface Props {
  withdrawals: AdminWithdrawalItem[]; loading: boolean; filter: 'all' | 'pending' | 'approved' | 'rejected';
  onFilterChange: (filter: 'all' | 'pending' | 'approved' | 'rejected') => void;
  processingId: string | null; onApproveWithdrawal: (id: string) => Promise<void>;
  onRejectWithdrawal: (id: string, reason?: string) => Promise<void>;
  onCopyText: (text: string, label?: string) => void; copiedText: string | null;
  searchQuery?: string; onSearchChange?: (query: string) => void; canManage?: boolean; canExport?: boolean;
}
function withdrawalState(item: AdminWithdrawalItem) {
  if (item.status === 'approved') return { label: 'Confirmado', className: 'success' };
  if (item.status === 'rejected') return { label: 'Recusado', className: 'danger' };
  if (item.dotfyWithdrawalId) return { label: 'Aguardando banco', className: '' };
  if (item.gatewayProcessing) return { label: 'Em conciliação', className: 'warning' };
  return { label: 'Em análise', className: 'warning' };
}
export const AdminWithdrawalsTab: React.FC<Props> = ({ withdrawals, loading, filter, onFilterChange, processingId, onApproveWithdrawal, onRejectWithdrawal, onCopyText, copiedText, searchQuery = '', onSearchChange, canManage = true, canExport = false }) => {
  const [sort, setSort] = useState('oldest'); const [period, setPeriod] = useState('all'); const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AdminWithdrawalItem | null>(null); const [action, setAction] = useState<'view' | 'approve' | 'reject'>('view'); const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState('');
  const pending = withdrawals.filter(item => item.status === 'pending');
  const approved = withdrawals.filter(item => item.status === 'approved');
  const rejected = withdrawals.filter(item => item.status === 'rejected');
  const total = (list: AdminWithdrawalItem[]) => list.reduce((sum, item) => sum + item.amount, 0);
  const filtered = useMemo(() => withdrawals.filter(item => {
    if (filter !== 'all' && item.status !== filter) return false;
    if (period !== 'all' && Date.parse(item.createdAt) < Date.now() - Number(period) * 86400000) return false;
    return [item.id, item.userName, item.userEmail, item.userPhone, item.dotfyWithdrawalId].join(' ').toLowerCase().includes(searchQuery.toLowerCase());
  }).sort((a, b) => sort === 'amount' ? b.amount - a.amount : sort === 'newest' ? Date.parse(b.createdAt) - Date.parse(a.createdAt) : Date.parse(a.createdAt) - Date.parse(b.createdAt)), [withdrawals, filter, period, sort, searchQuery]);
  useEffect(() => setPage(1), [filter, period, sort, searchQuery]);
  useEffect(() => {
    if (!selected) return;
    const fresh = withdrawals.find(item => item.id === selected.id);
    if (fresh && fresh !== selected) {
      setSelected(fresh);
      if (fresh.status !== 'pending' || fresh.gatewayProcessing || fresh.dotfyWithdrawalId) setAction('view');
    }
  }, [withdrawals, selected]);
  const pageSize = 20; const effectivePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize))); const rows = filtered.slice((effectivePage - 1) * pageSize, effectivePage * pageSize);
  const open = (item: AdminWithdrawalItem) => { setSelected(item); setAction('view'); setReason(''); setActionError(''); };
  const eligible = (item: AdminWithdrawalItem) => item.status === 'pending' && !item.gatewayProcessing && !item.dotfyWithdrawalId;
  const confirm = async () => {
    if (!selected || processingId) return;
    setActionError('');
    try { if (action === 'approve') await onApproveWithdrawal(selected.id); else if (action === 'reject') await onRejectWithdrawal(selected.id, reason.trim()); setSelected(null); }
    catch (error: any) { setActionError(error.message || 'Não foi possível concluir. Atualize os dados antes de tentar novamente.'); }
  };
  const exportList = () => downloadAdminCsv('saques-filtrados.csv', ['Protocolo', 'Solicitante', 'E-mail', 'Bruto BRL', 'Taxa BRL', 'Líquido BRL', 'Situação', 'Data', 'ID Gateway'], filtered.map(item => [item.id, item.userName, item.userEmail, item.amount, item.fee ?? 0, item.netAmount ?? item.amount, withdrawalState(item).label, item.createdAt, item.dotfyWithdrawalId || '']));
  return <div className="admin-withdrawals"><div className="admin-page-heading"><div><span className="admin-eyebrow">FINANCEIRO</span><h1>Gestão de saques<span className="admin-heading-dot">.</span></h1><p>Confira o solicitante, os valores e o andamento bancário antes de agir.</p></div>{canExport && <button className="admin-btn" onClick={exportList} disabled={!filtered.length}><Download size={15} />Exportar lista</button>}</div>
    <div className="admin-kpi-grid admin-kpi-grid-three">{[
      { label: 'Aguardando conclusão', value: total(pending), sub: `${pending.length} solicitações em análise ou processamento`, icon: Clock3 },
      { label: 'Confirmados no histórico', value: total(approved), sub: `${approved.length} saques registrados como confirmados`, icon: CheckCircle2 },
      { label: 'Total solicitado', value: total(withdrawals), sub: `${withdrawals.length} solicitações na base carregada`, icon: ReceiptText }
    ].map(item => <div className="admin-kpi" key={item.label}><div className="admin-kpi-top"><span>{item.label}</span><item.icon size={19} /></div><strong>{money(item.value)}</strong><div className="admin-kpi-sub">{item.sub}</div></div>)}</div>
    <section className="admin-surface"><div className="admin-withdrawal-filters"><div className="admin-filter-tabs">{[{ id: 'pending', label: 'Pendentes', count: pending.length }, { id: 'approved', label: 'Confirmados', count: approved.length }, { id: 'rejected', label: 'Recusados', count: rejected.length }, { id: 'all', label: 'Todos', count: withdrawals.length }].map(item => <button key={item.id} className={filter === item.id ? 'active' : ''} aria-pressed={filter === item.id} onClick={() => onFilterChange(item.id as typeof filter)}>{item.label}<b>{item.count}</b></button>)}</div></div>
      <div className="admin-list-toolbar"><div className="admin-search-input"><Search size={16} /><input aria-label="Pesquisar saques" placeholder="Buscar nome, e-mail ou protocolo…" value={searchQuery} onChange={event => onSearchChange?.(event.target.value)} /></div><select className="admin-select" aria-label="Período dos saques" value={period} onChange={event => setPeriod(event.target.value)}><option value="all">Todo o histórico</option><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option></select><select className="admin-select" aria-label="Ordenar saques" value={sort} onChange={event => setSort(event.target.value)}><option value="oldest">Mais antigos</option><option value="newest">Mais recentes</option><option value="amount">Maior valor</option></select></div>
      {loading && !withdrawals.length ? <div className="admin-empty"><Loader2 className="animate-spin" size={26} /><p>Carregando saques…</p></div> : !rows.length ? <div className="admin-empty"><Search size={30} /><strong>Nenhum saque encontrado</strong><p>Experimente outro filtro ou termo de busca.</p></div> : <><div className="admin-table-wrap admin-desktop-table"><table className="admin-data-table"><thead><tr><th>Solicitante</th><th>Bruto / líquido</th><th>Solicitado em</th><th>Andamento</th><th>Protocolo</th><th aria-label="Ações" /></tr></thead><tbody>{rows.map(item => <tr key={item.id}><td><div className="admin-table-person"><span>{(item.userName || 'U').slice(0, 1)}</span><div><strong>{item.userName || 'Usuário'}</strong><small>{item.userEmail}</small></div></div></td><td><div className="admin-table-value"><strong>{money(item.amount)}</strong><small>{money(item.netAmount ?? item.amount)} líquido</small></div></td><td><div className="admin-table-value"><span>{dateTime(item.createdAt)}</span><small>{item.status === 'pending' ? `${waitLabel(item.createdAt)} de espera` : 'Histórico'}</small></div></td><td><span className={`admin-status ${withdrawalState(item).className}`}>{withdrawalState(item).label}</span></td><td><button className="admin-protocol" onClick={() => onCopyText(item.id, 'Protocolo')} title={item.id}><span>{item.id.length > 16 ? item.id.slice(0, 8) + '…' + item.id.slice(-5) : item.id}</span>{copiedText === item.id ? <CheckCircle2 size={12} /> : <Copy size={12} />}</button></td><td><button className="admin-btn admin-btn-sm" onClick={() => open(item)}>Detalhes<ChevronRight size={13} /></button></td></tr>)}</tbody></table></div><div className="admin-withdrawal-cards">{rows.map(item => <button key={item.id} className="admin-withdrawal-card" onClick={() => open(item)}><div><strong>{item.userName || 'Usuário'}</strong><b>{money(item.amount)}</b></div><span>{item.userEmail}</span><div><span className={`admin-status ${withdrawalState(item).className}`}>{withdrawalState(item).label}</span><small>{dateTime(item.createdAt)} <ChevronRight size={13} /></small></div></button>)}</div></>}
      <div className="admin-list-footer"><Pagination currentPage={effectivePage} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} itemLabel="saques" /></div>
    </section>
    <Modal isOpen={!!selected} onClose={() => { if (!processingId) setSelected(null); }} title={action === 'approve' ? 'Conferir envio ao banco' : action === 'reject' ? 'Recusar e estornar saque' : 'Detalhes do saque'}>{selected && <div className="admin-withdrawal-detail"><div className="admin-detail-person"><strong>{selected.userName}</strong><span>{selected.userEmail}</span><span className={`admin-status ${withdrawalState(selected).className}`}>{withdrawalState(selected).label}</span></div><div className="admin-detail-grid"><div><span>Valor solicitado</span><strong>{money(selected.amount)}</strong></div><div><span>Valor a enviar</span><strong>{money(selected.netAmount ?? selected.amount)}</strong></div><div><span>Taxa registrada</span><strong>{money(selected.fee ?? 0)}</strong></div><div><span>Solicitado em</span><strong>{dateTime(selected.createdAt)}</strong></div></div><div className="admin-detail-reference"><span>Protocolo</span><button onClick={() => onCopyText(selected.id, 'Protocolo')}><code>{selected.id}</code><Copy size={14} /></button>{selected.dotfyWithdrawalId && <><span>ID no gateway</span><code>{selected.dotfyWithdrawalId}</code></>}<span>Chave PIX registrada</span><code>{typeof selected.pixKey === 'string' ? selected.pixKey : selected.pixKey?.key || selected.pixKeyId || 'Não informada'}</code></div>
      {(selected.dotfyWithdrawalId || selected.gatewayProcessing) && <div className="admin-notice warning"><AlertTriangle size={18} /><span>Este saque já foi enviado ou reservado. Confira a confirmação no gateway; enviar novamente pode duplicar a transferência.</span></div>}
      {selected.rejectReason && <div className="admin-small-note"><XCircle size={16} /><p>Motivo da recusa: {selected.rejectReason}</p></div>}
      {action === 'approve' && <div className="admin-notice"><ShieldCheck size={18} /><span>O envio utiliza o valor líquido registrado. A confirmação do pagamento depende do retorno bancário.</span></div>}
      {action === 'reject' && <div className="admin-field"><label htmlFor="withdrawal-reject-reason">Motivo da recusa</label><textarea id="withdrawal-reject-reason" maxLength={500} rows={3} value={reason} onChange={event => setReason(event.target.value)} placeholder="Descreva o motivo para o solicitante…" /><small>O valor reservado será estornado se o servidor confirmar a recusa.</small></div>}
      {actionError && <div className="admin-notice warning" role="alert">{actionError}</div>}
      {eligible(selected) && canManage && (action === 'view' ? <div className="admin-detail-actions"><button className="admin-btn admin-btn-danger" onClick={() => setAction('reject')}><XCircle size={15} />Recusar</button><button className="admin-btn admin-btn-primary" onClick={() => setAction('approve')}><ArrowUpRight size={15} />Conferir envio</button></div> : <div className="admin-detail-actions"><button className="admin-btn" disabled={!!processingId} onClick={() => setAction('view')}>Voltar</button><button className={`admin-btn ${action === 'reject' ? 'admin-btn-danger' : 'admin-btn-primary'}`} disabled={!!processingId || (action === 'reject' && reason.trim().length < 3)} onClick={confirm}>{processingId && <Loader2 size={15} className="animate-spin" />}{action === 'reject' ? 'Confirmar recusa' : 'Confirmar envio ao banco'}</button></div>)}
    </div>}</Modal>
  </div>;
};
