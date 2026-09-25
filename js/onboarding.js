// Questions, results and destinations are kept apart from the interface logic.
const onboardingContent = {
  firstQuestion: {
    title: '¿Qué quieres hacer?',
    options: [
      { id: 'informarme', label: 'Informarme sobre Valladolid', icon: 'fa-regular fa-newspaper' },
      { id: 'hablar', label: 'Hablar con otros vecinos', icon: 'fa-regular fa-comments' },
      { id: 'mejorar', label: 'Mejorar algo de mi barrio o ciudad', icon: 'fa-solid fa-wrench' },
      { id: 'descubrir', label: 'Buscar planes y descubrir Valladolid', icon: 'fa-regular fa-calendar-days', results: ['eventos', 'otraPucela', 'fotos'] },
      { id: 'compartir', label: 'Compartir, encontrar o proponer', icon: 'fa-regular fa-handshake' }
    ]
  },
  followUps: {
    informarme: {
      title: '¿Cómo quieres informarte?',
      options: [
        { id: 'rapido', label: 'Rápido y sin estar pendiente', icon: 'fa-regular fa-envelope', results: ['boletin', 'whatsapp', 'resumenes'] },
        { id: 'vecinos', label: 'Saber de qué hablan los vecinos', icon: 'fa-regular fa-comments', results: ['resumenes', 'telegram'] },
        { id: 'calma', label: 'Leer con calma', icon: 'fa-regular fa-newspaper', results: ['otraPucela'] }
      ]
    },
    hablar: {
      title: '¿Cómo quieres participar?',
      options: [
        { id: 'dia', label: 'Conversaciones del día a día', icon: 'fa-regular fa-comments', results: ['telegram'] },
        { id: 'primero_ver', label: 'Primero quiero ver de qué se habla', icon: 'fa-regular fa-eye', results: ['resumenes', 'telegram'] },
        { id: 'tema', label: 'Plantear un tema con más calma', icon: 'fa-regular fa-message', results: ['foro'] }
      ]
    },
    mejorar: {
      title: '¿Cómo quieres mejorar tu barrio?',
      options: [
        { id: 'problema', label: 'Avisar de un problema', icon: 'fa-solid fa-wrench', results: ['incidencias'] },
        { id: 'idea', label: 'Impulsar una idea con otros vecinos', icon: 'fa-regular fa-lightbulb', results: ['telegram', 'campanas'] }
      ]
    },
    compartir: {
      title: '¿Qué quieres compartir o encontrar?',
      options: [
        { id: 'cosas', label: 'Dar o encontrar cosas', icon: 'fa-solid fa-recycle', results: ['segundaVida'] },
        { id: 'valladolid', label: 'Compartir fotos de Valladolid', icon: 'fa-regular fa-image', results: ['fotos'] },
        { id: 'proponer', label: 'Proponer una idea', icon: 'fa-regular fa-lightbulb', results: ['telegram', 'campanas'] }
      ]
    }
  },
  recommendations: {
    boletin: { name: 'Boletín semanal', description: 'Lo importante, una vez por semana.', action: 'Suscribirme', media: '/img/marca_2/isotipo.png', href: '/boletin/' },
    whatsapp: { name: 'Canal WhatsApp', description: 'Novedades sin entrar al chat.', action: 'Seguir canal', icon: 'fa-brands fa-whatsapp', href: '/whatsapp/' },
    resumenes: { name: 'Resúmenes del chat', description: 'Descubre de qué se ha hablado.', action: 'Ver resúmenes', media: '/img/marca_2/isotipo.png', href: 'https://foro.aldeapucela.org/tag/resumen-chat/14' },
    telegram: { name: 'Chat de Telegram', description: 'Conversa con los vecinos al momento.', action: 'Entrar al chat', icon: 'fa-brands fa-telegram', href: 'telegram-modal' },
    foro: { name: 'Foro', description: 'Debate un tema con más calma.', action: 'Ir al foro', media: '/img/marca_2/isotipo.png', href: 'https://foro.aldeapucela.org/' },
    incidencias: { name: 'Incidencias vecinales', description: 'Registra un problema sin resolver.', action: 'Avisar de un problema', media: 'https://basuracero.aldeapucela.org/img/default/logo.png', href: 'https://basuracero.aldeapucela.org' },
    campanas: { name: 'Campañas vecinales', description: 'Organiza una propuesta con vecinos.', action: 'Participar o proponer', media: '/img/onboarding/campanas-icon.png', href: 'https://participa.aldeapucela.org' },
    eventos: { name: 'Eventos culturales', description: 'Qué hacer en Valladolid.', action: 'Ver eventos', media: '/img/onboarding/eventos-icon.png', href: 'https://eventos.aldeapucela.org' },
    otraPucela: { name: 'La Otra Pucela', description: 'Historias y artículos de la ciudad.', action: 'Leer artículos', media: '/img/onboarding/otra-pucela.svg', href: 'https://otrapucela.org' },
    fotos: { name: 'Fotos de Valladolid', description: 'La ciudad vista por sus vecinos.', action: 'Ver fotos', media: '/img/onboarding/fotos-cover.webp', href: 'https://fotos.aldeapucela.org' },
    segundaVida: { name: 'Segunda Vida', description: 'Da y encuentra cosas gratis.', action: 'Ir a Segunda Vida', media: '/img/onboarding/segunda-vida-icon.png', href: 'https://segundavida.aldeapucela.org' }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const trigger = document.getElementById('onboarding-trigger');
  const dialog = document.getElementById('onboarding-dialog');
  const content = document.getElementById('onboarding-content');
  const backButton = dialog?.querySelector('.onboarding-back');
  const closeButton = dialog?.querySelector('.onboarding-close');
  const progress = dialog?.querySelectorAll('.onboarding-progress span');
  const directory = document.getElementById('projects-primary-title');
  if (!trigger || !dialog || !content || !backButton || !closeButton || !directory) return;

  let firstChoice = null;
  let secondChoice = null;
  let currentScreen = 'first';
  let openingFocus = trigger;
  let openingScroll = 0;
  let pendingExit = false;
  let suppressClose = false;
  let lastRouteHash = null;
  let originUrl = window.location.href.split('#')[0];

  const rootHash = '#empezar';

  function readRoute() {
    const parts = window.location.hash.slice(1).split('/');
    if (parts[0] !== 'empezar' || parts.length > 3) return null;
    if (parts.length === 1) return { screen: 'first' };
    const first = onboardingContent.firstQuestion.options.find((option) => option.id === parts[1]);
    if (!first) return null;
    if (first.results) return parts.length === 2 ? { screen: 'results', first, results: first.results } : null;
    const followUp = onboardingContent.followUps[first.id];
    if (parts.length === 2) return { screen: 'second', first, followUp };
    const second = followUp.options.find((option) => option.id === parts[2]);
    return second ? { screen: 'results', first, second, results: second.results } : null;
  }

  function navigate(hash) {
    const previous = window.history.state;
    const depth = previous?.onboardingDepth || 0;
    window.history.pushState({ onboardingDepth: depth + 1, onboardingOrigin: originUrl }, '', hash);
    renderFromLocation();
  }

  function finishExit(reason) {
    pendingExit = false;
    lastRouteHash = null;
    if (dialog.open) {
      suppressClose = true;
      dialog.close();
    }
    document.body.classList.remove('onboarding-open');
    if (reason === 'telegram') {
      window.openTelegramModal(null, 'onboarding');
      return;
    }
    if (reason === 'directory') {
      window.requestAnimationFrame(() => {
        directory.scrollIntoView({ behavior: 'auto', block: 'start' });
        directory.focus({ preventScroll: true });
      });
      return;
    }
    track('close', currentScreen);
    openingFocus.focus({ preventScroll: true });
    window.scrollTo({ top: openingScroll, behavior: 'auto' });
  }

  function requestExit(reason = 'close') {
    if (pendingExit) return;
    pendingExit = reason;
    const depth = window.history.state?.onboardingDepth || 0;
    if (depth > 0) {
      window.history.go(-depth);
      return;
    }
    window.history.replaceState(null, '', originUrl);
    finishExit(reason);
  }

  function renderFromLocation() {
    if (pendingExit) {
      const reason = pendingExit;
      if (readRoute()) window.history.replaceState(null, '', originUrl);
      finishExit(reason);
      return;
    }
    const route = readRoute();
    if (!route) {
      if (dialog.open) finishExit('close');
      return;
    }
    if (lastRouteHash === window.location.hash && dialog.open) return;
    if (!dialog.open) {
      dialog.showModal();
      document.body.classList.add('onboarding-open');
    }
    lastRouteHash = window.location.hash;
    firstChoice = route.first?.id || null;
    secondChoice = route.second?.id || null;
    backButton.hidden = route.screen === 'first';
    if (route.screen === 'first') showQuestion(onboardingContent.firstQuestion, 'first');
    else if (route.screen === 'second') showQuestion(route.followUp, 'second');
    else showResults(route.results);
  }

  function track(action, name) {
    window._paq?.push(['trackEvent', 'Onboarding', action, name]);
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function updateProgress() {
    const active = currentScreen === 'first' ? 0 : currentScreen === 'second' ? 1 : 2;
    progress.forEach((bar, index) => bar.classList.toggle('is-active', index <= active));
  }

  function replaceScreen(nodes) {
    content.replaceChildren(...nodes);
    content.classList.remove('onboarding-enter');
    // Restart the brief transition when changing screens.
    void content.offsetWidth;
    content.classList.add('onboarding-enter');
    updateProgress();
    content.querySelector('h2')?.focus({ preventScroll: true });
  }

  function showQuestion(question, level) {
    currentScreen = level;
    const title = element('h2', 'onboarding-title', question.title);
    title.id = 'onboarding-title';
    title.tabIndex = -1;
    const options = element('div', 'onboarding-options');
    question.options.forEach((option) => {
      const button = element('button', `onboarding-option onboarding-option-${option.id}`);
      button.type = 'button';
      button.append(element('span', 'onboarding-option-label', option.label));
      button.addEventListener('click', () => {
        track(level === 'first' ? 'choose_first' : 'choose_second', option.id);
        if (level === 'first') {
          navigate(`${rootHash}/${option.id}`);
        } else {
          navigate(`${rootHash}/${firstChoice}/${option.id}`);
        }
      });
      options.append(button);
    });
    options.classList.add(`onboarding-options-${level}`);
    replaceScreen([title, options]);
  }

  function showResults(ids) {
    currentScreen = 'results';
    track('show_results', `${firstChoice}/${secondChoice || 'direct'}:${ids.join(',')}`);
    const title = element('h2', 'onboarding-title', 'Te puede interesar');
    title.id = 'onboarding-title';
    title.tabIndex = -1;
    const list = element('div', 'onboarding-results');

    ids.slice(0, 3).forEach((id, index) => {
      const item = onboardingContent.recommendations[id];
      const link = element('a', `onboarding-result onboarding-result-${id}${index === 0 ? ' onboarding-result-primary' : ''}`);
      link.href = item.href === 'telegram-modal' ? '#js-telegram-modal' : item.href;
      if (item.href.startsWith('https://')) {
        link.target = '_blank';
        link.rel = 'noopener';
      }
      const art = element('span', 'onboarding-result-art');
      if (item.media) {
        const image = element('img');
        image.src = item.media;
        image.alt = '';
        image.decoding = 'async';
        art.append(image);
      } else {
        const icon = element('i', item.icon);
        icon.setAttribute('aria-hidden', 'true');
        art.append(icon);
      }
      const copy = element('span', 'onboarding-result-copy');
      copy.append(element('strong', '', item.name), element('small', '', item.description));
      const action = element('span', 'onboarding-result-action', item.action);
      link.append(art, copy, action);
      link.addEventListener('click', (event) => {
        track('click_recommendation', `${firstChoice}/${secondChoice || 'direct'}:${id}`);
        if (item.href === 'telegram-modal') {
          event.preventDefault();
          requestExit('telegram');
        }
      });
      list.append(link);
    });

    const actions = element('div', 'onboarding-footer-actions');
    const more = element('button', 'onboarding-more', 'Ver otras cosas de Aldea Pucela');
    more.type = 'button';
    more.addEventListener('click', () => {
      track('view_directory', `${firstChoice}/${secondChoice || 'direct'}`);
      requestExit('directory');
    });
    const restart = element('button', 'onboarding-restart', 'Quiero buscar otra cosa');
    restart.type = 'button';
    restart.addEventListener('click', () => {
      track('restart', `${firstChoice}/${secondChoice || 'direct'}`);
      navigate(rootHash);
    });
    actions.append(more, restart);
    replaceScreen([title, list, actions]);
  }

  trigger.addEventListener('click', () => {
    openingFocus = document.activeElement instanceof HTMLElement ? document.activeElement : trigger;
    openingScroll = window.scrollY;
    originUrl = window.location.href;
    firstChoice = null;
    secondChoice = null;
    navigate(rootHash);
    track('open', 'home');
  });

  backButton.addEventListener('click', () => {
    const depth = window.history.state?.onboardingDepth || 0;
    if (depth > 0) {
      window.history.back();
      return;
    }
    const route = readRoute();
    const parent = route?.screen === 'results' && route.second ? `${rootHash}/${route.first.id}` : rootHash;
    window.history.replaceState(null, '', parent);
    renderFromLocation();
  });
  closeButton.addEventListener('click', () => requestExit());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) requestExit();
  });
  dialog.addEventListener('close', () => {
    if (suppressClose) {
      suppressClose = false;
      return;
    }
    requestExit();
  });

  window.addEventListener('popstate', renderFromLocation);
  window.addEventListener('hashchange', renderFromLocation);
  if (readRoute()) {
    originUrl = window.location.href.split('#')[0];
    renderFromLocation();
    track('open', 'direct_link');
  }
});
