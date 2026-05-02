/**
 * DOM polyfill for Three.js / GLTFLoader / TextureLoader on Expo Go.
 *
 * Three probes a lot of browser-only surface (document.body.contains,
 * element.ownerDocument, createElementNS('img'), etc.). Missing any one of
 * these throws and the entire onContextCreate promise rejects, leaving the
 * GLView stuck on the clear color. This file MUST be the first import of any
 * module that pulls in three / expo-three.
 */

/* eslint-disable no-empty */

const noop = () => {};

// ── window ─────────────────────────────────────────────────────────────────
if (typeof global.window === 'undefined') {
  global.window = global;
}

// A dummy DOM element with every surface Three might poke.
function makeElement(tag = 'div') {
  const el = {
    tagName:           String(tag).toUpperCase(),
    nodeName:          String(tag).toUpperCase(),
    nodeType:          1,
    style:             {},
    dataset:           {},
    children:          [],
    childNodes:        [],
    width:             0,
    height:            0,
    clientWidth:       0,
    clientHeight:      0,
    offsetWidth:       0,
    offsetHeight:      0,
    parentElement:     null,
    parentNode:        null,
    ownerDocument:     null, // patched after document exists

    addEventListener:      noop,
    removeEventListener:   noop,
    dispatchEvent:         () => true,
    appendChild:           c => c,
    removeChild:           c => c,
    insertBefore:          c => c,
    replaceChild:          c => c,
    contains:              () => false,
    getContext:            () => null,
    setAttribute:          noop,
    getAttribute:          () => null,
    removeAttribute:       noop,
    hasAttribute:          () => false,
    getBoundingClientRect: () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 }),
    setPointerCapture:     noop,
    releasePointerCapture: noop,

    classList: {
      add:      noop,
      remove:   noop,
      toggle:   noop,
      contains: () => false,
      item:     () => null,
    },
  };
  return el;
}

// ── document ───────────────────────────────────────────────────────────────
if (typeof global.document === 'undefined' || global.document === null) {
  global.document = {};
}
const doc = global.document;

function safeAssign(target, key, value) {
  const cur = target[key];
  if (cur !== undefined && cur !== null) return;
  try {
    target[key] = value;
  } catch {
    try {
      Object.defineProperty(target, key, {
        value,
        writable:     true,
        configurable: true,
        enumerable:   false,
      });
    } catch {}
  }
}

const bodyStub = {
  style:              {},
  children:           [],
  childNodes:         [],
  appendChild:        c => c,
  removeChild:        c => c,
  insertBefore:       c => c,
  replaceChild:       c => c,
  contains:           () => false,
  addEventListener:   noop,
  removeEventListener: noop,
};

const headStub = {
  style:              {},
  children:           [],
  childNodes:         [],
  appendChild:        c => c,
  removeChild:        c => c,
  insertBefore:       c => c,
  replaceChild:       c => c,
  contains:           () => false,
  addEventListener:   noop,
  removeEventListener: noop,
};

const docDefaults = {
  body:                   bodyStub,
  head:                   headStub,
  documentElement:        { style: {}, contains: () => false, clientWidth: 0, clientHeight: 0 },
  createElement:          makeElement,
  createElementNS:        (_ns, tag) => makeElement(tag),
  createTextNode:         () => ({ nodeValue: '', nodeType: 3 }),
  createDocumentFragment: () => makeElement('fragment'),
  getElementById:         () => null,
  getElementsByTagName:   () => [],
  getElementsByClassName: () => [],
  getElementsByName:      () => [],
  querySelector:          () => null,
  querySelectorAll:       () => [],
  addEventListener:       noop,
  removeEventListener:    noop,
  dispatchEvent:          () => true,
  contains:               () => false,
  readyState:             'complete',
  defaultView:            global,
  location:               (typeof global.location === 'object' && global.location) || { href: '', protocol: 'https:', host: '' },
  cookie:                 '',
};

for (const [key, value] of Object.entries(docDefaults)) {
  if (doc[key] === undefined || doc[key] === null) {
    safeAssign(doc, key, value);
  } else if (typeof value === 'object' && typeof doc[key] === 'object') {
    // Fill in missing members on already-existing stubs.
    for (const [k, v] of Object.entries(value)) {
      if (doc[key][k] === undefined || doc[key][k] === null) {
        safeAssign(doc[key], k, v);
      }
    }
  }
}

// Wrap createElement so every element we hand out is fully shaped and
// back-references the document (Three sometimes walks el.ownerDocument.body).
const _origCreate = typeof doc.createElement === 'function' ? doc.createElement.bind(doc) : null;
doc.createElement = (tag) => {
  const base = _origCreate ? _origCreate(tag) : makeElement(tag);
  const el = base && typeof base === 'object' ? base : makeElement(tag);
  if (!el.ownerDocument) el.ownerDocument = doc;
  if (!el.style)         el.style = {};
  if (!el.parentElement) el.parentElement = null;
  if (!el.parentNode)    el.parentNode = null;
  if (!el.addEventListener)    el.addEventListener = noop;
  if (!el.removeEventListener) el.removeEventListener = noop;
  if (!el.contains)            el.contains = () => false;
  if (!el.appendChild)         el.appendChild = c => c;
  if (!el.removeChild)         el.removeChild = c => c;
  return el;
};

// ── navigator ──────────────────────────────────────────────────────────────
if (typeof global.navigator === 'undefined' || global.navigator === null) {
  global.navigator = {};
}
if (!global.navigator.userAgent) {
  try { global.navigator.userAgent = 'ReactNative'; } catch {}
}

// Some Three modules probe Image existence; give them a no-op constructor
// rather than letting `typeof Image === 'undefined'` branches go wrong.
if (typeof global.Image === 'undefined') {
  global.Image = function Image() {
    return makeElement('img');
  };
}
