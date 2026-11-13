import { fetchMovements, attachmentUrl } from './nocodb.js';
import { renderDescription } from './descripcion.js';
const $ = id => document.getElementById(id);
const money = value => new Intl.NumberFormat('es-ES', { style:'currency', currency:'EUR' }).format(value / 100);
const updatedDate = value => new Intl.DateTimeFormat('es-ES', { dateStyle:'medium', timeStyle:'short', timeZone:'Europe/Madrid' }).format(value);
const date = value => new Intl.DateTimeFormat('es-ES', { day:'numeric', month:'short', year:'numeric', timeZone:'UTC' }).format(new Date(`${value}T12:00:00Z`));
let current = null, loading = false, pendingRender = false, opener = null, previousOverflow = '';
const icon = '<svg viewBox="0 0 24 28" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M4 1h10l6 6v20H4zM14 1v7h6M8 14h8M8 18h8M8 22h6"/></svg>';
function render(data) {
  $('summary').hidden = false; $('balance').textContent = money(data.balance); $('income').textContent = money(data.income); $('expenses').textContent = money(data.expenses);
  const hasDistribution = data.income > 0 && data.balance >= 0;
  $('bar').hidden = !hasDistribution;
  if (hasDistribution) { $('spent-bar').style.width = `${100 * data.expenses / data.income}%`; $('available-bar').style.width = `${100 * data.balance / data.income}%`; }
  $('updated').textContent = data.lastModified !== null ? `Última actualización: ${updatedDate(data.lastModified)}` : '';
  $('list').replaceChildren(); $('empty').hidden = data.movements.length !== 0;
  for (const item of data.movements) {
    const li = document.createElement('li'); li.className = 'movement';
    const button = document.createElement('button'); button.type = 'button'; button.className = 'movement-button'; button.dataset.id = String(item.id);
    button.setAttribute('aria-label', `Ver detalles de ${item.concept}, ${date(item.date)}, ${item.amount < 0 ? 'menos' : 'más'} ${money(Math.abs(item.amount))}`);
    const time = document.createElement('time'); time.dateTime = item.date; time.textContent = date(item.date);
    const concept = document.createElement('span'); concept.className = 'concept'; concept.textContent = item.concept;
    const amount = document.createElement('span'); amount.className = `amount ${item.amount < 0 ? 'negative' : 'positive'}`; amount.textContent = `${item.amount < 0 ? '−' : '+'}${money(Math.abs(item.amount))}`;
    button.append(time, concept, amount);
    if (item.provider || item.details || item.attachments.length) { const documentIcon = document.createElement('span'); documentIcon.className = 'document'; documentIcon.innerHTML = icon; button.append(documentIcon); }
    button.addEventListener('click', () => showDetails(item, button)); li.append(button); $('list').append(li);
  }
}
const externalIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M13 5h6v6M19 5l-9 9M19 14v5H5V5h5"/></svg>';
function linkList(body, links) {
  if (!links.length) return;
  const ul = document.createElement('ul'); ul.className = 'detail-links';
  for (const link of links) {
    const li = document.createElement('li'); const a = document.createElement('a');
    a.href = link.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    const typeIcon = document.createElement('span'); typeIcon.className = 'detail-link-icon'; typeIcon.innerHTML = link.file ? icon : externalIcon;
    const text = document.createElement('span'); text.className = 'detail-link-text';
    const label = document.createElement('span'); label.className = 'detail-link-label'; label.textContent = link.label;
    const type = document.createElement('span'); type.className = 'detail-link-type'; type.textContent = link.type;
    text.append(label, type);
    const arrow = document.createElement('span'); arrow.className = 'detail-external-icon'; arrow.innerHTML = externalIcon;
    a.append(typeIcon, text, arrow); li.append(a); ul.append(li);
  }
  body.append(ul);
}
function fileLabel(file) {
  const title = String(file.title || file.name || '').trim();
  if (!title) return 'Abrir documento';
  const readable = title.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[_-]+/g, ' ').trim();
  return readable ? readable.charAt(0).toLocaleUpperCase('es') + readable.slice(1) : title;
}
function fileType(file) {
  const name = String(file.name || file.title || '');
  const ext = name.match(/\.([a-z0-9]{2,5})$/i)?.[1];
  const mime = String(file.mimetype || file.mimeType || file.type || '').toLowerCase();
  if (mime === 'application/pdf' || ext?.toLowerCase() === 'pdf') return 'PDF';
  if (ext) return ext.toUpperCase();
  if (mime.startsWith('image/')) return 'Imagen';
  return 'Documento';
}
function showDetails(item, button) {
  opener = button;
  $('dialog-title').textContent = item.concept;
  $('dialog-date').textContent = new Intl.DateTimeFormat('es-ES', { day:'numeric', month:'long', year:'numeric', timeZone:'UTC' }).format(new Date(`${item.date}T12:00:00Z`));
  const amount = $('dialog-amount'); amount.textContent = `${item.amount < 0 ? '−' : '+'}${money(Math.abs(item.amount))}`; amount.className = `dialog-amount ${item.amount < 0 ? 'negative' : 'positive'}`;
  const body = $('dialog-body'); body.replaceChildren();
  const description = item.details.trim();
  const files = item.attachments.map(file => ({ url: attachmentUrl(file), label: fileLabel(file), type: fileType(file), file: true })).filter(file => file.url);
  if (item.provider || description || files.length) {
    body.classList.add('has-content');
    if (item.provider) { const p = document.createElement('p'); p.className = 'detail-provider'; const label = document.createElement('span'); label.textContent = 'Proveedor'; const value = document.createElement('strong'); value.textContent = item.provider; p.append(label, value); body.append(p); }
    if (description) body.append(renderDescription(description));
    linkList(body, files);
  } else body.classList.remove('has-content');
  if (item.modifiedAt !== null) { const note = document.createElement('p'); note.className = 'detail-updated'; note.textContent = `Última actualización: ${updatedDate(item.modifiedAt)}`; body.append(note); }
  previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
  $('details').showModal();
}
$('close').addEventListener('click', () => $('details').close());
$('details').addEventListener('click', event => {
  if (event.target !== $('details')) return;
  const bounds = $('details').getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) $('details').close();
});
$('details').addEventListener('close', () => {
  document.body.style.overflow = previousOverflow;
  if (pendingRender) {
    const id = opener?.dataset.id; render(current); pendingRender = false;
    opener = [...$('list').querySelectorAll('.movement-button')].find(button => button.dataset.id === id) || null;
  }
  if (opener?.isConnected) opener.focus();
});

async function refresh() {
  if (loading) return; loading = true;
  try { const data = await fetchMovements(); current = data; if ($('details').open) pendingRender = true; else render(data); $('status').textContent = ''; }
  catch (error) { $('status').textContent = current ? 'No se ha podido actualizar la información. Los datos mostrados podrían estar desactualizados.' : 'No se pueden consultar las cuentas en este momento. Inténtalo de nuevo más tarde.'; }
  finally { loading = false; }
}
refresh(); setInterval(() => { if (!document.hidden) refresh(); }, 60000); document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
