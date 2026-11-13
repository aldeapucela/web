const API = 'https://proyectos.aldeapucela.org/api/v1/db/public/shared-view/ea3717ac-0e4f-4af0-a317-dec0346b9a2b/rows';
const ORIGIN = 'https://proyectos.aldeapucela.org';

// Parse decimal amounts without performing arithmetic on floating-point euros.
export function cents(value) {
  const match = String(value ?? '').trim().match(/^([+-]?)(\d+)(?:[.,](\d{1,2}))?$/);
  if (!match) throw new Error('Importe no válido');
  const result = Number(match[2]) * 100 + Number((match[3] || '').padEnd(2, '0'));
  if (!Number.isSafeInteger(result)) throw new Error('Importe fuera de rango');
  return match[1] === '-' ? -result : result;
}

// NocoDB returns timestamps such as "2026-11-13 13:14:46+00:00".
function timestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const parsed = Date.parse(value.replace(' ', 'T'));
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalize(row) {
  const type = String(row.Tipo || '').trim().toLocaleLowerCase('es');
  if (!['ingreso', 'gasto'].includes(type)) throw new Error('Tipo de movimiento desconocido');
  const amount = cents(row.Importe);
  if (amount < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(row.Fecha || '') || !row.Concepto) throw new Error('Movimiento incompleto');
  return { id: row.Id, concept: String(row.Concepto), category: String(row.Categoria || '').trim(), date: row.Fecha, provider: String(row.Proovedor || '').trim(), createdAt: timestamp(row['Created time']), modifiedAt: timestamp(row['Last modified time']), amount: type === 'gasto' ? -amount : amount, details: String(row.Detalles || ''), attachments: Array.isArray(row.Justificante) ? row.Justificante : [] };
}

export async function fetchMovements() {
  const rows = []; let offset = 0; const limit = 100; const seen = new Set();
  for (;;) {
    const url = new URL(API); url.searchParams.set('limit', limit); url.searchParams.set('offset', offset);
    const response = await fetch(url, { cache: 'no-store', credentials: 'omit' });
    if (!response.ok) throw new Error('No se ha podido consultar NocoDB');
    const data = await response.json();
    if (!Array.isArray(data.list) || typeof data.pageInfo?.isLastPage !== 'boolean') throw new Error('Respuesta inesperada');
    for (const row of data.list) {
      if (row.Id == null || seen.has(row.Id)) throw new Error('Paginación inconsistente');
      seen.add(row.Id); rows.push(row);
    }
    if (data.pageInfo.isLastPage) break;
    if (!data.list.length) throw new Error('Paginación incompleta');
    offset += data.list.length;
  }
  const movements = rows.map(normalize).sort ( (a, b) => b.date.localeCompare(a.date) || Number(b.id) - Number(a.id));
  const income = movements.reduce((sum, row) => sum + Math.max(0, row.amount), 0);
  const expenses = movements.reduce((sum, row) => sum + Math.max(0, -row.amount), 0);
  if (![income, expenses, income - expenses].every(Number.isSafeInteger)) throw new Error('Total fuera de rango');
  const lastModified = movements.length && movements.every(row => row.modifiedAt !== null) ? movements.reduce((latest, row) => Math.max(latest, row.modifiedAt), 0) : null;
  return { movements, income, expenses, balance: income - expenses, lastModified };
}

// Prefer the current signed URL supplied by NocoDB; do not persist it between fetches.
export function attachmentUrl(attachment) {
  const raw = attachment?.signedUrl || attachment?.signedPath || attachment?.url;
  if (typeof raw !== 'string') return null;
  try { const url = new URL(raw, ORIGIN); return url.protocol === 'https:' ? url.href : null; } catch { return null; }
}
