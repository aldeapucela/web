const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function createPage(initialHash = '') {
  class Element {
    constructor(tag = 'div') {
      this.tag = tag;
      this.className = '';
      this.children = [];
      this.listeners = new Map();
      this.dataset = {};
      this.style = {};
      this.open = false;
      this.classList = {
        add: (name) => this.setClass(name, true),
        remove: (name) => this.setClass(name, false),
        toggle: (name, force) => this.setClass(name, force ?? !this.hasClass(name))
      };
    }
    hasClass(name) { return this.className.split(' ').includes(name); }
    setClass(name, enabled) {
      const names = new Set(this.className.split(' ').filter(Boolean));
      if (enabled) names.add(name); else names.delete(name);
      this.className = [...names].join(' ');
    }
    addEventListener(name, listener) {
      this.listeners.set(name, [...(this.listeners.get(name) || []), listener]);
    }
    dispatch(name) {
      const event = { target: this, preventDefault() {} };
      for (const listener of this.listeners.get(name) || []) listener(event);
    }
    click() { this.dispatch('click'); }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    setAttribute() {}
    focus() {}
    scrollIntoView() {}
    showModal() { this.open = true; }
    close() { this.open = false; this.dispatch('close'); }
    get offsetWidth() { return 100; }
    matches(selector) {
      return selector.startsWith('.') ? this.hasClass(selector.slice(1)) : this.tag === selector;
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    querySelectorAll(selector) {
      const matches = [];
      for (const child of this.children) {
        if (!(child instanceof Element)) continue;
        if (child.matches(selector)) matches.push(child);
        matches.push(...child.querySelectorAll(selector));
      }
      return matches;
    }
  }

  const trigger = new Element('button');
  const dialog = new Element('dialog');
  const back = new Element('button'); back.className = 'onboarding-back';
  const close = new Element('button'); close.className = 'onboarding-close';
  const progress = new Element(); progress.className = 'onboarding-progress';
  progress.append(new Element('span'), new Element('span'), new Element('span'));
  const content = new Element();
  dialog.append(back, progress, close, content);
  const directory = new Element('h2');
  const telegramModal = new Element();
  const telegramLink = new Element('a'); telegramLink.className = 'btn-modal-action';
  const telegramClose = new Element('button'); telegramClose.className = 'js-modal-close';
  telegramModal.append(telegramLink, telegramClose);
  const elements = {
    'onboarding-trigger': trigger,
    'onboarding-dialog': dialog,
    'onboarding-content': content,
    'projects-primary-title': directory,
    'js-telegram-modal': telegramModal
  };
  const readyListeners = [];
  const document = {
    body: new Element('body'),
    documentElement: { setAttribute() {}, removeAttribute() {} },
    activeElement: trigger,
    getElementById: (id) => elements[id] || null,
    createElement: (tag) => new Element(tag),
    createTextNode: (text) => ({ textContent: text }),
    addEventListener: (name, listener) => { if (name === 'DOMContentLoaded') readyListeners.push(listener); },
    querySelectorAll: (selector) => selector === '.js-modal-close' ? [telegramClose] : []
  };
  const base = 'http://127.0.0.1:4000/';
  const location = { href: base + initialHash, hash: initialHash };
  const windowListeners = new Map();
  const window = {
    location,
    _paq: [],
    scrollY: 0,
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    requestAnimationFrame: (callback) => callback(),
    scrollTo() {},
    addEventListener: (name, listener) => {
      windowListeners.set(name, [...(windowListeners.get(name) || []), listener]);
    }
  };
  const entries = [{ url: base + initialHash, state: null }];
  let position = 0;
  function setLocation(url) {
    location.href = url.startsWith('#') ? base + url : url;
    location.hash = location.href.includes('#') ? location.href.slice(location.href.indexOf('#')) : '';
  }
  window.history = {
    get state() { return entries[position].state; },
    pushState(state, _title, url) {
      entries.splice(position + 1);
      entries.push({ state, url });
      position += 1;
      setLocation(url);
    },
    replaceState(state, _title, url) {
      entries[position] = { state, url };
      setLocation(url);
    },
    go(delta) {
      position += delta;
      setLocation(entries[position].url);
      for (const listener of windowListeners.get('popstate') || []) listener();
      for (const listener of windowListeners.get('hashchange') || []) listener();
    },
    back() { this.go(-1); }
  };
  const context = vm.createContext({
    document, window, navigator: {}, URL, HTMLElement: Element,
    localStorage: { getItem: () => null, setItem() {} },
    console: { log() {} }
  });
  for (const file of ['js/main.js', 'js/onboarding.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }
  window.openTelegramModal = context.openTelegramModal;
  readyListeners.forEach((listener) => listener());
  const eventNames = (category = 'Onboarding') => window._paq
    .filter((event) => event[0] === 'trackEvent' && event[1] === category)
    .map((event) => [event[2], event[3]]);
  return { trigger, close, back, content, telegramLink, eventNames };
}

test('measures one event for each step, result, destination, and close', () => {
  const page = createPage();
  page.trigger.click();
  page.content.querySelector('.onboarding-option-informarme').click();
  page.content.querySelector('.onboarding-option-rapido').click();
  page.content.querySelector('.onboarding-result-whatsapp').click();
  page.close.click();
  assert.deepEqual(page.eventNames(), [
    ['open', 'home'],
    ['choose_first', 'informarme'],
    ['choose_second', 'informarme/rapido'],
    ['show_results', 'informarme/rapido:boletin,whatsapp,resumenes'],
    ['click_recommendation', 'informarme/rapido:whatsapp'],
    ['close', 'results:informarme/rapido']
  ]);
});

test('distinguishes Telegram recommendation from the effective group click', () => {
  const page = createPage();
  page.trigger.click();
  page.content.querySelector('.onboarding-option-hablar').click();
  page.content.querySelector('.onboarding-option-dia').click();
  page.content.querySelector('.onboarding-result-telegram').click();
  page.telegramLink.click();
  assert.deepEqual(page.eventNames().slice(-3), [
    ['show_results', 'hablar/dia:telegram'],
    ['click_recommendation', 'hablar/dia:telegram'],
    ['click_telegram_group', 'hablar/dia:telegram']
  ]);
  assert.deepEqual(page.eventNames('Telegram'), [
    ['open_modal', 'onboarding'],
    ['go_to_group', 'onboarding']
  ]);
});

test('direct links, back, and restart preserve route context without duplicate impressions', () => {
  const page = createPage('#empezar/compartir/proponer');
  assert.deepEqual(page.eventNames(), [
    ['open', 'direct_link'],
    ['show_results', 'compartir/proponer:telegram,campanas']
  ]);
  page.back.click();
  assert.deepEqual(page.eventNames().at(-1), ['back', 'results:compartir/proponer']);
  page.content.querySelector('.onboarding-option-proponer').click();
  page.content.querySelector('.onboarding-restart').click();
  assert.deepEqual(page.eventNames().filter(([action]) => action === 'restart'), [
    ['restart', 'compartir/proponer']
  ]);
});

test('opening the directory is measured as navigation, not abandonment', () => {
  const page = createPage('#empezar/descubrir');
  page.content.querySelector('.onboarding-more').click();
  assert.deepEqual(page.eventNames().slice(-2), [
    ['show_results', 'descubrir/directo:eventos,otraPucela,fotos'],
    ['view_directory', 'descubrir/directo']
  ]);
  assert.equal(page.eventNames().filter(([action]) => action === 'close').length, 0);
});
