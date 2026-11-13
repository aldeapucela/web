// Construye nodos DOM, nunca HTML, a partir del Markdown utilizado en NocoDB.
function safeLink(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

function inline(parent, source, depth = 0) {
  if (depth > 8) { parent.append(document.createTextNode(source)); return; }
  // Links, emphasis and inline code are deliberately restricted to a small safe subset.
  const tokens = /(!?\[([^\]\n]+)\]\(([^\s)]+)\)|\*\*([^*\n]+)\*\*|__([^_\n]+)__|\*([^*\n]+)\*|_([^_\n]+)_|~~([^~\n]+)~~|`([^`\n]+)`|https?:\/\/[^\s<>]+)/g;
  let position = 0;
  for (const match of source.matchAll(tokens)) {
    parent.append(document.createTextNode(source.slice(position, match.index)));
    const [full, , linkText, destination, strongStar, strongUnder, emphasisStar, emphasisUnder, strike, code] = match;
    if (destination) {
      const url = full.startsWith('!') ? null : safeLink(destination);
      if (url) {
        const link = document.createElement('a'); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
        inline(link, linkText, depth + 1); parent.append(link);
      } else parent.append(document.createTextNode(full));
    } else if (strongStar || strongUnder || emphasisStar || emphasisUnder || strike || code) {
      const node = document.createElement(strongStar || strongUnder ? 'strong' : emphasisStar || emphasisUnder ? 'em' : strike ? 'del' : 'code');
      inline(node, strongStar || strongUnder || emphasisStar || emphasisUnder || strike || code, depth + 1); parent.append(node);
    } else {
      const value = full.replace(/[.,;:!?]+$/, '');
      const url = safeLink(value);
      if (url) { const link = document.createElement('a'); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = value; parent.append(link); parent.append(document.createTextNode(full.slice(value.length))); }
      else parent.append(document.createTextNode(full));
    }
    position = match.index + full.length;
  }
  parent.append(document.createTextNode(source.slice(position)));
}

export function renderDescription(source) {
  const container = document.createElement('div'); container.className = 'detail-description';
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  let paragraph = null, list = null, listType = null;
  for (const line of lines) {
    if (!line.trim()) { paragraph = null; list = null; listType = null; continue; }
    const item = line.match(/^\s*(?:([-+*])\s+|(\d+)\.\s+)(.*)$/);
    if (item) {
      const type = item[2] ? 'ol' : 'ul';
      if (!list || listType !== type) { list = document.createElement(type); listType = type; container.append(list); }
      const li = document.createElement('li'); inline(li, item[3]); list.append(li); paragraph = null;
    } else {
      list = null; listType = null;
      if (!paragraph) { paragraph = document.createElement('p'); container.append(paragraph); }
      else paragraph.append(document.createElement('br'));
      inline(paragraph, line);
    }
  }
  return container;
}
