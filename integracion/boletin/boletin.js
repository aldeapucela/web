// JS principal para el boletín de integración
// Incluye: carga de temas, botón compartir

document.addEventListener('DOMContentLoaded', function() {
  // --- Botón compartir (Web Share API + fallback) ---
  const shareBtn = document.getElementById('share-btn');
  if (shareBtn) {
    const shareText = 'Suscríbete para estar al día de todas las novedades y actividades de la Plataforma por la Integración de Valladolid';
    const shareData = {
      title: document.title,
      text: shareText,
      url: window.location.href
    };
    shareBtn.addEventListener('click', function() {
      if (navigator.share) {
        navigator.share(shareData).catch(()=>{});
      } else {
        // Fallback: copiar al portapapeles y alert
        const textoCompleto = shareText + '\n' + window.location.href;
        if (navigator.clipboard) {
          navigator.clipboard.writeText(textoCompleto).then(function() {
            alert('Enlace copiado al portapapeles');
          }, function() {
            alert('No se pudo copiar el enlace');
          });
        } else {
          // Fallback antiguo para navegadores viejos
          const tempInput = document.createElement('input');
          tempInput.value = textoCompleto;
          document.body.appendChild(tempInput);
          tempInput.select();
          tempInput.setSelectionRange(0, 99999);
          document.execCommand('copy');
          document.body.removeChild(tempInput);
          alert('Enlace copiado al portapapeles');
        }
      }
    });
  }

  // --- Cargar últimos boletines publicados ---
  fetch('https://tasks.nukeador.com/webhook/boletin-integracion')
    .then(response => response.json())
    .then(data => {
      const temas = data.topic_list.topics;
      const lista = document.getElementById('temas');
      if (!lista) return;
      lista.innerHTML = '';
      temas.forEach(t => {
        const item = document.createElement('div');
        item.className = 'boletin-item';
        item.style.padding = '12px 0';
        item.style.borderBottom = '1px solid #E5EDF6';
        const link = document.createElement('a');
        link.href = `https://foro.aldeapucela.org/t/${t.slug}/${t.id}`;
        link.textContent = t.title;
        link.style.color = '#2BB2FC';
        link.style.textDecoration = 'underline';
        link.style.fontWeight = '700';
        link.style.fontSize = '18px';
        link.style.fontFamily = 'Helvetica, sans-serif';
        link.target = '_blank';

        // Añadir fecha si existe
        let fecha = '';
        if (t.created_at) {
          const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
          const d = new Date(t.created_at);
          fecha = `${d.getDate()} ${meses[d.getMonth()]} ${d.getFullYear()}`;
        }
        const spanFecha = document.createElement('span');
        spanFecha.textContent = fecha ? ` — ${fecha}` : '';
        spanFecha.style.fontWeight = 'normal';
        spanFecha.style.fontSize = '15px';
        spanFecha.style.color = '#687484';
        spanFecha.style.marginLeft = '8px';

        item.appendChild(link);
        item.appendChild(spanFecha);
        lista.appendChild(item);
      });
    })
    .catch(err => {
      const lista = document.getElementById('temas');
      if (lista) {
        lista.innerHTML = '<div style="color:#661d1d">No se pudieron cargar los temas.</div>';
      }
    });
});
