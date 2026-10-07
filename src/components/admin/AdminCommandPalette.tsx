import React, { useMemo, useRef, useEffect, useState } from 'react';
import { Search, ArrowUpRight, Users } from 'lucide-react';
import { Modal } from '../Modal';
import { AdminTabId, AdminUserItem } from './adminTypes';
import { adminNavigation } from './adminNavigation';
interface Props { open: boolean; onClose: () => void; users: AdminUserItem[]; canNavigate: (tab: AdminTabId) => boolean; onNavigate: (tab: AdminTabId) => void; onSelectUser: (user: AdminUserItem) => void; }
export const AdminCommandPalette: React.FC<Props> = ({ open, onClose, users, canNavigate, onNavigate, onSelectUser }) => {
  const [query, setQuery] = useState(''); const [active, setActive] = useState(0); const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) { setQuery(''); setActive(0); const timer = setTimeout(() => input.current?.focus(), 0); return () => clearTimeout(timer); } }, [open]);
  const results = useMemo(() => {
    const search = query.toLocaleLowerCase('pt-BR').trim();
    const screens = adminNavigation.filter(item => canNavigate(item.id) && item.label.toLocaleLowerCase('pt-BR').includes(search)).map(item => ({ id: item.id, title: item.label, desc: item.section, icon: item.icon, run: () => onNavigate(item.id) }));
    const people = search && canNavigate('users') ? users.filter(user => [user.name, user.email, user.phone, user.id].join(' ').toLocaleLowerCase('pt-BR').includes(search)).slice(0, 6).map(user => ({ id: user.id, title: user.name, desc: user.email, icon: Users, run: () => onSelectUser(user) })) : [];
    return [...screens, ...people].slice(0, 12);
  }, [query, users, canNavigate]);
  const choose = (index: number) => { results[index]?.run(); onClose(); };
  return <Modal isOpen={open} onClose={onClose} title="Busca rápida"><div className="admin-command-palette"><div className="admin-search-input"><Search size={18} /><input ref={input} role="combobox" aria-label="Buscar telas e usuários" aria-expanded="true" aria-controls="admin-command-results" aria-activedescendant={results[active] ? `command-${results[active].id}` : undefined} placeholder="Busque uma tela, nome ou e-mail…" value={query} onChange={event => { setQuery(event.target.value); setActive(0); }} onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); setActive(Math.min(results.length - 1, active + 1)); } if (event.key === 'ArrowUp') { event.preventDefault(); setActive(Math.max(0, active - 1)); } if (event.key === 'Enter') { event.preventDefault(); choose(active); } }} /></div><div id="admin-command-results" role="listbox" aria-label="Resultados da busca">{results.map((item, index) => <button key={item.id} type="button" role="option" aria-selected={active === index} id={`command-${item.id}`} className={`admin-command-option ${active === index ? 'active' : ''}`} onClick={() => choose(index)}><item.icon size={18} /><span><strong>{item.title}</strong><small>{item.desc}</small></span><ArrowUpRight size={14} /></button>)}{!results.length && <div className="admin-empty"><p>Nenhum resultado. Tente outro termo.</p></div>}</div><div className="admin-command-help"><span>↑ ↓ navegar</span><span>↵ abrir</span><span>Esc fechar</span></div></div></Modal>;
};
