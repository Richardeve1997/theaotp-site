// theaotp.com funnel script. Loaded synchronously in <head> by every kit page, BEFORE the
// page's own gate script, so it can do two jobs:
//   1. Remember a member. Anyone who has unlocked one kit page in this browser never sees
//      an email form again on any other kit page.
//   2. Report the page half of the funnel (visit, unlock, clicks, scroll, time) to the gate
//      worker, tagged with the campaign code the Instagram DM link carried (?s=).
// It never reads or sends the email address; the gate form does that itself and passes
// window.aotpCtx() alongside so the worker can join the two.
(function () {
  var API = 'https://theaotp-gate.theaotp.workers.dev';
  var MEMBER = 'aotp_member';
  var path = location.pathname.replace(/index\.html$/, '');
  var slug = path.split('/').filter(Boolean)[0] || '';
  var page = slug ? '/' + slug + '/' : '/';

  function get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function set(key, value) { try { localStorage.setItem(key, value); } catch (e) {} }

  // 1. Returning member: any earlier unlock on this site counts.
  var returning = get(MEMBER) === '1';
  if (!returning) {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        if (/^aotp_.+_unlocked$/.test(localStorage.key(i) || '')) { returning = true; break; }
      }
    } catch (e) {}
  }
  if (returning && slug) {
    set(MEMBER, '1');
    set('aotp_' + slug + '_unlocked', '1'); // the page's own gate script reads this key next
  }

  // 2. Campaign code (?s=) and per-person token (?t=) from the DM link.
  var params = new URLSearchParams(location.search);
  var ok = /^[A-Za-z0-9_-]{1,64}$/;
  var query = location.search.slice(0, 200);
  var src = ok.test(params.get('s') || '') ? params.get('s') : '';
  var token = ok.test(params.get('t') || '') ? params.get('t') : '';
  if (src || token) {
    set('aotp_src_' + slug, JSON.stringify({ s: src, t: token }));
    // Drop the codes from the address bar so a shared URL is not credited to this campaign.
    try {
      params.delete('s'); params.delete('t');
      var rest = params.toString();
      history.replaceState(null, '', location.pathname + (rest ? '?' + rest : '') + location.hash);
    } catch (e) {}
  } else {
    try {
      var saved = JSON.parse(get('aotp_src_' + slug) || '{}');
      src = saved.s || ''; token = saved.t || '';
    } catch (e) {}
  }

  // Respect Do Not Track / Global Privacy Control: no visitor id, no page events.
  var quiet = navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true;
  var vid = '';
  if (!quiet) {
    vid = get('aotp_vid') || '';
    if (!ok.test(vid)) {
      vid = 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
      set('aotp_vid', vid);
    }
  }

  window.aotpCtx = function () { return { vid: vid, src: src, t: token, page: page }; };

  function send(type, label, meta) {
    if (quiet || !vid) return;
    var body = JSON.stringify({ vid: vid, type: type, page: page, src: src, t: token, label: label || '', meta: meta || null });
    try {
      // text/plain keeps this a simple CORS request: no preflight, survives page unload.
      if (navigator.sendBeacon && navigator.sendBeacon(API + '/e', new Blob([body], { type: 'text/plain' }))) return;
      fetch(API + '/e', { method: 'POST', body: body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(function () {});
    } catch (e) {}
  }

  send('visit', returning ? 'returning' : 'new', { ref: (document.referrer || '').slice(0, 200), q: query });

  function ready() {
    var kit = document.getElementById('kit');
    if (kit) {
      var unlocked = function (how) { set(MEMBER, '1'); send('unlock', how); };
      if (!kit.hidden) unlocked('returning');
      else if (window.MutationObserver) {
        var watcher = new MutationObserver(function () {
          if (!kit.hidden) { watcher.disconnect(); unlocked('form'); }
        });
        watcher.observe(kit, { attributes: true, attributeFilter: ['hidden'] });
      }
    }

    document.addEventListener('click', function (event) {
      var el = event.target && event.target.closest ? event.target.closest('a[href],button') : null;
      if (!el) return;
      var section = el.closest('section[id]');
      var where = section ? '#' + section.id + ' ' : '';
      if (el.tagName === 'A') send('click', where + 'link:' + el.href);
      else send('click', where + (el.hasAttribute('data-copy') ? 'copy' : 'button:' + (el.textContent || '').trim().slice(0, 40)));
    }, true);

    // Media events do not bubble, so listen in the capture phase.
    document.addEventListener('play', function (event) {
      var media = event.target;
      if (media && media.currentSrc) send('click', 'video:' + media.currentSrc.split('/').pop().split('?')[0]);
    }, true);

    // Scroll depth only means something once the kit is open (the gated page is one screen).
    var marks = { 50: false, 90: false };
    window.addEventListener('scroll', function () {
      if (kit && kit.hidden) return;
      var doc = document.documentElement;
      var seen = (window.scrollY + window.innerHeight) / Math.max(doc.scrollHeight, 1) * 100;
      [50, 90].forEach(function (mark) {
        if (!marks[mark] && seen >= mark) { marks[mark] = true; send('scroll', String(mark)); }
      });
    }, { passive: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();

  // Engaged time: seconds the tab was actually visible, reported each time it is hidden.
  var visibleSince = document.visibilityState === 'visible' ? Date.now() : 0;
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') { visibleSince = Date.now(); return; }
    if (visibleSince) {
      var seconds = Math.round((Date.now() - visibleSince) / 1000);
      visibleSince = 0;
      if (seconds >= 2) send('time', String(Math.min(seconds, 3600)));
    }
  });
})();
