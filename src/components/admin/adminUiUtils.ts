export const money = (value?: number | null) => value == null || !Number.isFinite(value) ? '—' : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const dateTime = (value?: string) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
export function downloadAdminCsv(name: string, headers: string[], rows: (string | number | null | undefined)[][]): void {
  const cell = (value: string | number | null | undefined) => {
    let text = String(value ?? '');
    if (typeof value === 'string' && /^[\s]*[=+@-]/.test(text)) text = "'" + text;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const content = '\uFEFF' + [headers, ...rows].map(row => row.map(cell).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const waitMinutes = (value: string) => Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 60000)) || 0;
export const waitLabel = (value: string) => { const minutes = waitMinutes(value); return minutes < 60 ? `${minutes} min` : minutes < 1440 ? `${Math.floor(minutes / 60)} h` : `${Math.floor(minutes / 1440)} d`; };
