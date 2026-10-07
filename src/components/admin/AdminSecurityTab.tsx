import React, { useEffect, useState } from 'react';
import { Activity, Server, RefreshCw, ShieldCheck, Search, Download, AlertTriangle, Clock3 } from 'lucide-react';
import { dateTime, downloadAdminCsv } from './adminUiUtils';
interface Event { id: string; event: string; timestamp: string; actorId?: string; }
interface Props { token?: string | null; onOpenMigrationModal?: () => void; canExport?: boolean; }
export const AdminSecurityTab: React.FC<Props> = ({ token, onOpenMigrationModal, canExport }) => {
  const [events, setEvents] = useState<Event[]>([]); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const [latency, setLatency] = useState<number | null>(null); const [observedAt, setObservedAt] = useState<string | null>(null); const [query, setQuery] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try { const start = performance.now(); const response = await fetch('/api/admin/security/events', { headers: { Authorization: `Bearer ${token}` } }); const data = await response.json(); if (!response.ok) throw Error(data.error || 'Não foi possível consultar os eventos.'); setLatency(Math.round(performance.now() - start)); setEvents(data.events || []); setObservedAt(data.observedAt); }
    catch (error: any) { setError(error.message || 'Erro de conexão.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (token) void load(); }, [token]);
  const filtered = events.filter(item => (item.event + ' ' + item.actorId).toLowerCase().includes(query.toLowerCase()));
  return <div className="space-y-5"><div className="admin-page-heading"><div><span className="admin-eyebrow">MONITORAMENTO</span><h1>Atividade do sistema<span className="admin-heading-dot">.</span></h1><p>Eventos reais observados nesta instância do servidor.</p></div><button className="admin-btn" disabled={loading} onClick={load}><RefreshCw size={15} className={loading ? 'animate-spin' : ''} />Atualizar</button></div>
    <div className="admin-kpi-grid admin-kpi-grid-three">{[
      { label: 'Resposta da API', value: error ? 'Indisponível' : latency == null ? '—' : `${latency} ms`, icon: Server, sub: 'Tempo medido nesta consulta' },
      { label: 'Eventos disponíveis', value: events.length, icon: Activity, sub: 'Até 300 eventos desta instância' },
      { label: 'Última consulta', value: observedAt ? new Date(observedAt).toLocaleTimeString('pt-BR') : '—', icon: Clock3, sub: 'Horário da observação' }
    ].map(item => <div className="admin-kpi" key={item.label}><div className="admin-kpi-top"><span>{item.label}</span><item.icon size={18} /></div><strong>{item.value}</strong><div className="admin-kpi-sub">{item.sub}</div></div>)}</div>
    {error && <div className="admin-notice warning" role="alert">{error}</div>}
    <section className="admin-surface"><div className="admin-list-toolbar"><div className="admin-search-input"><Search size={16} /><input aria-label="Pesquisar eventos" placeholder="Buscar evento ou operador…" value={query} onChange={event => setQuery(event.target.value)} /></div>{canExport && <button className="admin-btn" disabled={!filtered.length} onClick={() => downloadAdminCsv('eventos-do-sistema.csv', ['Evento', 'Data', 'Operador'], filtered.map(item => [item.event, item.timestamp, item.actorId || 'Sistema']))}><Download size={15} />Exportar CSV</button>}</div><div className="admin-table-wrap"><table className="admin-data-table"><thead><tr><th>Evento</th><th>Origem</th><th>Data e hora</th></tr></thead><tbody>{filtered.map(item => <tr key={item.id}><td><span className="admin-event-label"><Activity size={14} />{item.event.replace(/_/g, ' ')}</span></td><td>{item.actorId || 'Sistema'}</td><td>{dateTime(item.timestamp)}</td></tr>)}</tbody></table></div>{!filtered.length && <div className="admin-empty"><ShieldCheck size={27} /><p>{loading ? 'Buscando eventos…' : 'Nenhum evento disponível neste filtro.'}</p></div>}<div className="admin-list-footer"><span>Os eventos em memória são reiniciados junto com esta instância.</span></div></section>
    <div className="admin-notice"><AlertTriangle size={17} /><span>Esta consulta não verifica o saldo do gateway nem certifica o banco de dados. Esses estados devem ser conferidos nas respectivas áreas.</span></div>{onOpenMigrationModal && <button className="admin-btn" onClick={onOpenMigrationModal}><Download size={15} />Abrir exportação de dados</button>}
  </div>;
};
