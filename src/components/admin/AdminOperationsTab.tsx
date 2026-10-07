import React, { useEffect, useMemo, useState } from 'react';
import { Search, ArrowUpRight, Clock3, AlertTriangle, CheckCheck, Download, StickyNote, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import { AdminWithdrawalItem, AdminTabId } from './adminTypes';
import { OperationNote } from './adminOperationsTypes';
import { money, dateTime, waitLabel, waitMinutes, downloadAdminCsv } from './adminUiUtils';
import { Modal } from '../Modal';
interface Props { token: string | null; withdrawals: AdminWithdrawalItem[]; loading: boolean; canExport: boolean; onNavigate: (tab: AdminTabId) => void; onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void; }
export const AdminOperationsTab: React.FC<Props> = ({ token, withdrawals, loading, canExport, onNavigate, onShowToast }) => {
  const [notes, setNotes] = useState<Record<string, OperationNote>>({});
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [noteError, setNoteError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('oldest');
  const [selected, setSelected] = useState<AdminWithdrawalItem | null>(null);
  const [note, setNote] = useState('');
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');
  const [reviewed, setReviewed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0);
  const [limit, setLimit] = useState(20);
  const loadNotes = async () => {
    setLoadingNotes(true); setNoteError('');
    try { const response = await fetch('/api/admin/operations/notes', { headers: { Authorization: `Bearer ${token}` } }); const data = await response.json(); if (!response.ok) throw Error(data.error || 'Falha ao carregar anotações.'); setNotes(Object.fromEntries((data.notes || []).map((item: OperationNote) => [item.id, item]))); }
    catch (error: any) { setNoteError(error.message || 'Falha de conexão.'); }
    finally { setLoadingNotes(false); }
  };
  useEffect(() => { if (token) void loadNotes(); }, [token]);
  const pending = withdrawals.filter(item => item.status === 'pending');
  const filtered = useMemo(() => pending.filter(item => {
    const metadata = notes[item.id]; const search = query.toLocaleLowerCase('pt-BR');
    if (![item.id, item.userName, item.userEmail, item.dotfyWithdrawalId, metadata?.note].filter(Boolean).join(' ').toLocaleLowerCase('pt-BR').includes(search)) return false;
    if (filter === 'review' && (item.dotfyWithdrawalId || item.gatewayProcessing)) return false;
    if (filter === 'gateway' && !item.dotfyWithdrawalId && !item.gatewayProcessing) return false;
    if (filter === 'urgent' && metadata?.priority !== 'urgent') return false;
    if (filter === 'notReviewed' && metadata?.reviewed) return false;
    return true;
  }).sort((a, b) => sort === 'amount' ? b.amount - a.amount : sort === 'priority' ? Number(notes[b.id]?.priority === 'urgent') - Number(notes[a.id]?.priority === 'urgent') || Date.parse(a.createdAt) - Date.parse(b.createdAt) : Date.parse(a.createdAt) - Date.parse(b.createdAt)), [withdrawals, notes, query, filter, sort]);
  const select = (item: AdminWithdrawalItem) => { const existing = notes[item.id]; setSelected(item); setNote(existing?.note || ''); setPriority(existing?.priority || 'normal'); setReviewed(!!existing?.reviewed); setRevision(existing?.revision || 0); };
  const save = async () => {
    if (!selected || saving) return;
    setSaving(true);
    try { const response = await fetch(`/api/admin/operations/notes/${encodeURIComponent(selected.id)}`, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ note, priority, reviewed, revision }) }); const data = await response.json(); if (!response.ok) throw Error(data.error || 'Falha ao salvar.'); setNotes(current => ({ ...current, [selected.id]: data.note })); setSelected(null); onShowToast('Anotação salva na operação.', 'success'); }
    catch (error: any) { onShowToast(error.message || 'Falha de conexão.', 'error'); }
    finally { setSaving(false); }
  };
  const exportList = () => downloadAdminCsv('central-de-pendencias.csv', ['Protocolo', 'Solicitante', 'Valor BRL', 'Líquido BRL', 'Data', 'Gateway', 'Prioridade', 'Revisado', 'Anotação'], filtered.map(item => [item.id, item.userName, item.amount, item.netAmount ?? item.amount, item.createdAt, item.dotfyWithdrawalId || (item.gatewayProcessing ? 'Reservado para conciliação' : 'Não enviado'), notes[item.id]?.priority || 'normal', notes[item.id]?.reviewed ? 'Sim' : 'Não', notes[item.id]?.note || '']));
  return <div className="admin-operations"><div className="admin-page-heading"><div><span className="admin-eyebrow">ROTINA OPERACIONAL</span><h1>Central de pendências<span className="admin-heading-dot">.</span></h1><p>Priorize os saques, registre a revisão e mantenha o contexto para a equipe.</p></div><button className="admin-btn" onClick={loadNotes} disabled={loadingNotes}><RefreshCw size={15} className={loadingNotes ? 'animate-spin' : ''} />Atualizar anotações</button></div>
    <div className="admin-kpi-grid admin-kpi-grid-three">{[
      { label: 'Em análise', value: pending.filter(item => !item.dotfyWithdrawalId && !item.gatewayProcessing).length, icon: Clock3, sub: 'Aguardando conferência' },
      { label: 'Em processamento', value: pending.filter(item => item.dotfyWithdrawalId || item.gatewayProcessing).length, icon: ArrowUpRight, sub: 'Banco ou conciliação' },
      { label: 'Prioridade alta', value: pending.filter(item => notes[item.id]?.priority === 'urgent').length, icon: AlertTriangle, sub: 'Marcadas pela equipe' }
    ].map(item => <div className="admin-kpi" key={item.label}><div className="admin-kpi-top"><span>{item.label}</span><item.icon size={19} /></div><strong>{item.value}</strong><div className="admin-kpi-sub">{item.sub}</div></div>)}</div>
    {noteError && <div className="admin-notice warning" role="alert">{noteError} As anotações não foram atualizadas.</div>}
    <section className="admin-surface"><div className="admin-list-toolbar"><div className="admin-search-input"><Search size={17} /><input aria-label="Pesquisar pendências" value={query} onChange={event => { setQuery(event.target.value); setLimit(20); }} placeholder="Buscar nome, protocolo ou anotação…" /></div><select aria-label="Filtrar pendências" className="admin-select" value={filter} onChange={event => { setFilter(event.target.value); setLimit(20); }}><option value="all">Todas as pendências</option><option value="review">Em análise</option><option value="gateway">Em processamento</option><option value="urgent">Prioridade alta</option><option value="notReviewed">Sem revisão da equipe</option></select><select aria-label="Ordenar pendências" className="admin-select" value={sort} onChange={event => setSort(event.target.value)}><option value="oldest">Mais antigas primeiro</option><option value="amount">Maior valor</option><option value="priority">Prioridade alta primeiro</option></select>{canExport && <button className="admin-icon-btn" title="Exportar lista filtrada" aria-label="Exportar lista filtrada" onClick={exportList} disabled={!filtered.length}><Download size={17} /></button>}</div>
      {loading ? <div className="admin-empty"><Loader2 size={24} className="animate-spin" /><p>Carregando operações…</p></div> : !filtered.length ? <div className="admin-empty"><CheckCheck size={32} /><strong>Nenhuma pendência neste filtro</strong><p>Altere a busca ou atualize os dados para conferir a fila.</p></div> : <div className="admin-operation-list">{filtered.slice(0, limit).map(item => <button className="admin-operation-row" key={item.id} onClick={() => select(item)}><span className={`admin-operation-icon ${notes[item.id]?.priority === 'urgent' ? 'urgent' : ''}`}><ArrowUpRight size={19} /></span><span className="admin-operation-person"><strong>{item.userName || 'Solicitante'}</strong><small>{item.id}</small>{notes[item.id]?.note && <span className="admin-operation-note"><StickyNote size={12} />{notes[item.id].note}</span>}</span><span className="admin-operation-status"><b className={`admin-status ${notes[item.id]?.priority === 'urgent' ? 'warning' : ''}`}>{item.dotfyWithdrawalId ? 'Aguardando banco' : item.gatewayProcessing ? 'Conciliação necessária' : 'Em análise'}</b>{notes[item.id]?.reviewed && <small><CheckCheck size={12} />Revisado pela equipe</small>}</span><span className="admin-operation-amount"><strong>{money(item.amount)}</strong><small className={waitMinutes(item.createdAt) > 1440 ? 'negative' : ''}>{waitLabel(item.createdAt)} na fila</small></span><ChevronRight size={16} /></button>)}</div>}
      <div className="admin-list-footer"><span>{Math.min(limit, filtered.length)} de {filtered.length} operações</span>{limit < filtered.length && <button className="admin-text-btn" onClick={() => setLimit(limit + 20)}>Carregar mais</button>}<button className="admin-text-btn" onClick={() => onNavigate('withdrawals')}>Abrir gestão de saques <ArrowUpRight size={14} /></button></div>
    </section>
    <Modal isOpen={!!selected} onClose={() => { if (!saving) setSelected(null); }} title="Revisão da operação">{selected && <div className="admin-note-modal"><div className="admin-detail-person"><strong>{selected.userName}</strong><span>{selected.userEmail}</span><code>{selected.id}</code></div><div className="admin-detail-grid"><div><span>Valor bruto</span><strong>{money(selected.amount)}</strong></div><div><span>Valor líquido</span><strong>{money(selected.netAmount ?? selected.amount)}</strong></div><div><span>Solicitado em</span><strong>{dateTime(selected.createdAt)}</strong></div><div><span>Tempo de espera</span><strong>{waitLabel(selected.createdAt)}</strong></div></div><div className="admin-field"><label htmlFor="operation-priority">Prioridade da revisão</label><select id="operation-priority" className="admin-select" value={priority} onChange={event => setPriority(event.target.value as typeof priority)}><option value="normal">Normal</option><option value="urgent">Alta</option></select></div><div className="admin-field"><label htmlFor="operation-note">Anotação para a equipe</label><textarea id="operation-note" rows={4} maxLength={1000} value={note} onChange={event => setNote(event.target.value)} placeholder="Registre o que foi conferido e o próximo passo…" /><small>{note.length}/1000 caracteres</small></div><label className="admin-checkbox"><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} />Marcar como revisado pela equipe</label><p className="admin-muted">A anotação não aprova, rejeita ou movimenta o saldo deste saque.</p>{notes[selected.id]?.updatedAt && <p className="admin-muted">Última revisão: {notes[selected.id].updatedByName} · {dateTime(notes[selected.id].updatedAt)}</p>}<button className="admin-btn admin-btn-primary w-full" onClick={save} disabled={saving || !!noteError || loadingNotes}>{saving && <Loader2 size={15} className="animate-spin" />}Salvar revisão</button></div>}</Modal>
  </div>;
};
