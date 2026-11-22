/*! AOTP shared unlock · theaotp.com/guides/unlock.js · one email opens every guide, and nobody types it twice.
 * <script src="/guides/unlock.js"></script> after /f.js and before the gate code, then window.AOTPUnlock:
 *   isSubscribed()          true for a subscriber in this browser: unlock the page at once and ask for nothing.
 *   remember(slug, answer)  after a gate or newsletter submit succeeds ("team"; pass the worker's /subscribe answer
 *                           when you have it). Fires "aotp:subscribed".
 *   forget()                "Use a different email": locks every guide again. Fires "aotp:forgotten".
 * Subscribed = "aotp_subscriber" ({"at": ISO time}, never the email) or /f.js's member flag ("aotp_member" = "2").
 * This script keeps the two in step, writing whichever is missing, because /f.js runs first on every guide page and
 * opens it only for "aotp_member" = "2": so a page that still checks just its own key opens for every subscriber
 * from their next page view. Old "aotp_<slug>_unlocked" flags do not count: Rich ruled on 2026-09-23 that those
 * people never confirmed, so /f.js asks them once more and the re-entry activates them. Extras: note(el);
 * <html>.aotp-subscribed.
 * The bridge with go.theaotp.com (Flywheel ADR 0020): a cookie "aotp_subscriber=1" on theaotp.com, which both hosts
 * read. go.theaotp.com's server sets it on a signup there; this script writes it beside its own keys, afresh on every
 * visit (Safari keeps a cookie a script writes for seven days), and clears it in forget(). The cookie alone opens a
 * guide, but it is never copied into localStorage: a deletion or "Use a different email" on go.theaotp.com clears
 * it, and nothing here may bring that signup back.
 */
(function () {
  'use strict';
  if (window.AOTPUnlock && window.AOTPUnlock.version) return;

  var doc = document;
  var SUB = 'aotp_subscriber';
  var MEMBER = 'aotp_member'; /* /f.js: '2' = on the list for good (the older '1' does not count) */
  var PAGE_KEY = /^aotp_.+_unlocked$/;
  /* Whether an old per-guide flag on its own counts as subscribed. Off: see the note at the top. Turning it on also
     writes both keys for those visitors, so /f.js opens their guides from the next page view. */
  var LEGACY_FLAGS_COUNT = false;
  var SLUG = /^[a-z0-9][a-z0-9-]*$/i;
  var BRIDGE = 'aotp_subscriber'; /* the cookie go.theaotp.com shares: "1", never the email */
  var BRIDGED = /(?:^|;\s*)aotp_subscriber=[^;\s]/;
  var BRIDGE_DOMAIN = 'theaotp.com';
  var BRIDGE_AGE = 34560000; /* 400 days, the longest a browser keeps a cookie */
  /* Only when the browser refuses to store the answer (a private window, blocked site data): a settled submit
     still counts for the rest of this page view. Never set while storage works, so another tab's forget() wins. */
  var memory = false;
  var last = null; /* the state this page last announced, so an event fires only on a change */

  function store() {
    try {
      var s = window.localStorage;
      return s && typeof s.getItem === 'function' ? s : null;
    } catch (e) { return null; }
  }
  function get(s, k) { try { return s.getItem(k); } catch (e) { return null; } }
  function set(s, k, v) { try { s.setItem(k, v); return true; } catch (e) { return false; } }
  function del(s, k) { try { s.removeItem(k); } catch (e) { /* nothing to undo */ } }
  function keys(s) {
    var out = [];
    try { for (var i = 0; i < s.length; i++) { var k = s.key(i); if (k) out.push(k); } } catch (e) { /* none readable */ }
    return out;
  }
  function stamp() { return JSON.stringify({ at: new Date().toISOString() }); }
  function pageKey(id) {
    if (typeof id !== 'string' || !id) return '';
    if (PAGE_KEY.test(id)) return id;
    return SLUG.test(id) ? 'aotp_' + id + '_unlocked' : '';
  }
  function emit(name, detail) {
    var ev;
    try { ev = new CustomEvent(name, { detail: detail || {} }); } catch (e) {
      ev = doc.createEvent('CustomEvent');
      ev.initCustomEvent(name, false, false, detail || {});
    }
    doc.dispatchEvent(ev);
  }
  /* The bridge cookie. On theaotp.com and its subdomains it goes on theaotp.com, so go.theaotp.com reads it; on a
     preview host (localhost) a cookie on that host stands in. */
  function onSite() {
    var h = location.hostname || '';
    return h === BRIDGE_DOMAIN || h.slice(-(BRIDGE_DOMAIN.length + 1)) === '.' + BRIDGE_DOMAIN;
  }
  function bridged() { try { return BRIDGED.test(doc.cookie || ''); } catch (e) { return false; } }
  function bridge() {
    try {
      doc.cookie = BRIDGE + '=1; Max-Age=' + BRIDGE_AGE + '; Path=/; Secure; SameSite=Lax' + (onSite() ? '; Domain=' + BRIDGE_DOMAIN : '');
    } catch (e) { /* cookies blocked: go.theaotp.com asks once */ }
  }
  function unbridge() {
    var gone = BRIDGE + '=; Max-Age=0; Path=/; Secure; SameSite=Lax';
    try { doc.cookie = gone + '; Domain=' + BRIDGE_DOMAIN; doc.cookie = gone; } catch (e) { /* nothing to undo */ }
  }

  function mark(on) {
    var root = doc.documentElement;
    if (root && root.classList) root.classList.toggle('aotp-subscribed', !!on);
  }

  /* Subscribed = "aotp_subscriber" or "aotp_member" = "2" in this site's storage, or the bridge cookie. With write,
     the missing one of the pair is written, so /f.js (which reads only the member flag) and this script (which reads
     either) always agree, and the bridge cookie is written afresh from them. The cookie alone opens the page and
     writes nothing: copied into storage it would outlive the go.theaotp.com signup it stands for. A storage event
     reads without writing: another tab's forget() removes the two keys one at a time, and writing back in between
     would bring the old email back. */
  function check(write) {
    if (memory) return true;
    var s = store(), found = false;
    if (s) {
      var sub = !!get(s, SUB), member = get(s, MEMBER) === '2';
      found = sub || member;
      if (!found && LEGACY_FLAGS_COUNT) {
        found = keys(s).some(function (k) { return PAGE_KEY.test(k) && !!get(s, k); });
      }
      if (found && write) {
        if (!sub) set(s, SUB, stamp());
        if (!member) set(s, MEMBER, '2');
        bridge();
      }
    }
    return found || bridged();
  }
  function announce(on, source) {
    mark(on);
    if (on === last) return;
    last = on;
    emit(on ? 'aotp:subscribed' : 'aotp:forgotten', { source: source });
  }
  function isSubscribed() {
    var on = check(true);
    mark(on);
    return on;
  }

  /* answer: the worker's /subscribe reply, if the page has it. member:false means the email is not settled yet
     (unconfirmed, or its activation failed): this page opens, but nothing is kept and the visitor does not count
     as subscribed, so the next guide asks again and the worker gets another go at activating it, as /f.js intends.
     Returns true when the browser kept it. Always fires "aotp:subscribed" (detail.kept says whether it counts). */
  function remember(id, answer) {
    var s = store(), k = pageKey(id), saved = false;
    var settled = !(answer && answer.member === false);
    if (s) {
      if (settled) {
        saved = set(s, SUB, stamp());
        if (saved) set(s, MEMBER, '2');
      }
      if (k) set(s, k, '1');
    }
    if (settled) bridge();
    memory = settled && !saved;
    var on = settled || check(false);
    mark(on);
    last = on;
    emit('aotp:subscribed', { key: k, saved: saved, settled: settled, kept: on, source: 'page' });
    return saved;
  }

  function forget() {
    var s = store();
    memory = false;
    if (s) {
      del(s, SUB);
      del(s, MEMBER); /* or /f.js would open the next guide for the old email */
      keys(s).forEach(function (k) { if (PAGE_KEY.test(k)) del(s, k); });
    }
    unbridge(); /* go.theaotp.com's own signup stays on its host, which sets the cookie again on its next check */
    mark(false);
    last = false;
    emit('aotp:forgotten', { source: 'page' });
  }

  /* The line an unlocked page shows. Writes into el (emptied first) and returns it. "Use a different email" calls
     forget(), then opts.onForget() if given, or reloads the page so its gate comes back. */
  function note(el, opts) {
    if (!el) return null;
    opts = opts || {};
    while (el.firstChild) el.removeChild(el.firstChild);
    el.appendChild(doc.createTextNode((opts.text || 'You\'re subscribed, so every guide is open.') + ' '));
    var a = doc.createElement('a');
    a.href = '#';
    a.className = opts.linkClass || 'aotp-unlock-forget';
    a.textContent = opts.linkText || 'Use a different email';
    a.addEventListener('click', function (e) {
      e.preventDefault();
      forget();
      if (typeof opts.onForget === 'function') opts.onForget();
      else location.reload();
    });
    el.appendChild(a);
    return el;
  }

  /* Another tab subscribed or used a different email: this page hears about it too. */
  window.addEventListener('storage', function (e) {
    if (e.key !== null && e.key !== SUB && e.key !== MEMBER && !PAGE_KEY.test(e.key)) return;
    if (e.key === null || ((e.key === SUB || e.key === MEMBER) && e.newValue === null)) memory = false;
    announce(check(false), 'storage');
  });

  /* A page that subscribes someone without calling remember() (the homepage letter form writes "aotp_subscriber"
     itself) still leaves both keys behind: the pair is checked again as the visitor heads for a link or leaves the
     page, so /f.js opens the guide they land on next. Cheap: two storage reads, only at those moments. */
  function settle() { announce(check(true), 'page'); }
  function onLink(e) {
    var t = e.target;
    if (t && t.closest && t.closest('a[href]')) settle();
  }
  doc.addEventListener('click', onLink, true);
  doc.addEventListener('auxclick', onLink, true);
  doc.addEventListener('contextmenu', onLink, true);
  window.addEventListener('pagehide', settle);
  doc.addEventListener('visibilitychange', function () { if (doc.visibilityState === 'hidden') settle(); });

  window.AOTPUnlock = {
    version: '1.3.0',
    isSubscribed: isSubscribed,
    remember: remember,
    forget: forget,
    note: note,
    pageKey: pageKey
  };
  last = isSubscribed();
})();
