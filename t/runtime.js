/* Рантайм перенесённых страниц BI13 (вместо скриптов Тильды и jQuery).
   Делает: масштаб Zero как у Тильды, появление элементов, попапы, перетаскиваемые ленты, аккордеон,
   анкеты без получателя, куки, кнопка «наверх», бургер шапки. Без зависимостей. */
(function () {
  'use strict';
  var d = document, w = window;
  var reduce = w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cfg = {};
  try { cfg = JSON.parse((d.getElementById('bi13-config') || {}).textContent || '{}'); } catch (e) { cfg = {}; }
  var $$ = function (s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); };
  function ready(f) { if (d.readyState !== 'loading') f(); else d.addEventListener('DOMContentLoaded', f); }

  /* ---------- масштаб Zero (как tilda-zero-scale: в окнах шире/уже сетки раскладка растягивается по ширине окна) ---------- */
  function attr(el, name, bp, screens, isArtboard, isGroup) {
    var last = screens[screens.length - 1];
    var pre = isArtboard ? 'data-artboard-' : (isGroup ? 'data-group-' : 'data-field-');
    var suffix = isArtboard ? '' : '-value';
    function get(p) { return el.getAttribute(pre + name + (p === last ? '' : '-res-' + p) + suffix); }
    var v = get(bp);
    if (v === null) for (var i = 0; i < screens.length; i++) { var s = screens[i]; if (s > bp) { v = get(s); if (v !== null) break; } }
    return v;
  }
  var accordionLayouts = [];
  var initialWidth = 0;
  function scaleAll() {
    var a = d.documentElement.clientWidth;
    if (!initialWidth) initialWidth = a;
    $$('.t396__artboard').forEach(function (ab) {
      var screens = (ab.getAttribute('data-artboard-screens') || '320,480,640,960,1200').split(',').map(Number);
      var n = screens[0];
      screens.forEach(function (s) { if (a >= s) n = s; });
      var kids = Array.prototype.filter.call(ab.children, function (c) { return c.classList.contains('t396__elem') || c.classList.contains('t396__group'); });
      var valign = attr(ab, 'valign', n, screens, true) === 'center';
      var grid = attr(ab, 'upscale', n, screens, true) === 'grid';
      var vh = attr(ab, 'height_vh', n, screens, true);
      var h = attr(ab, 'height', n, screens, true);
      var parts = [ab, ab.querySelector('.t396__carrier'), ab.querySelector('.t396__filter')];
      var on = valign && !grid && !vh && h;
      kids.forEach(function (c) { c.style.zoom = ''; });
      $$('[data-bi13-lh]', ab).forEach(function (a) { a.style.lineHeight = ''; a.removeAttribute('data-bi13-lh'); });
      if (!on) { parts.forEach(function (p) { if (p) p.style.removeProperty('height'); }); ab.style.removeProperty('--initial-scale-height'); return; }
      var f = parseFloat((a / n).toFixed(3));
      var hv = Math.floor(parseInt(h, 10) * f) + 'px';
      ab.style.setProperty('--initial-scale-height', hv);
      parts.forEach(function (p) { if (p) p.style.setProperty('height', 'var(--initial-scale-height)'); });
      kids.forEach(function (c) {
        if (!c.querySelector('.tn-molecule, .tn-atom')) return;
        var isG = c.classList.contains('t396__group');
        var cont = attr(c, 'container', n, screens, false, isG);
        if (!cont && isG) cont = 'grid';
        if (cont === 'grid') c.style.zoom = f;
      });
      /* в оконных сценах межстрочный округляется до целого px, как на живом сайте */
      $$('.tn-elem[data-elem-type="text"] .tn-atom, .tn-elem[data-elem-type="button"] .tn-atom', ab).forEach(function (a) {
        var lh = parseFloat(getComputedStyle(a).lineHeight);
        if (isFinite(lh) && lh % 1) { a.style.lineHeight = Math.round(lh) + 'px'; a.setAttribute('data-bi13-lh', '1'); }
      });
    });
    accordionLayouts.forEach(function (layout) { layout(); });
  }
  var rt;
  w.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(scaleAll, 120); });
  w.addEventListener('orientationchange', function () { setTimeout(scaleAll, 200); });
  scaleAll();

  /* ---------- появление элементов (fadeinup и др.) ---------- */
  function animate() {
    var els = $$('.t-animate');
    if (!els.length) return;
    if (reduce || !('IntersectionObserver' in w)) { els.forEach(function (e) { e.classList.add('t-animate_started'); }); return; }
    var io = new IntersectionObserver(function (list) {
      list.forEach(function (x) {
        if (!x.isIntersecting) return;
        var el = x.target, delay = parseFloat(el.getAttribute('data-animate-delay')) || 0;
        var dur = el.getAttribute('data-animate-duration');
        if (dur) el.style.transitionDuration = dur + 's';
        setTimeout(function () { el.classList.add('t-animate_started'); }, delay * 1000);
        io.unobserve(el);
      });
    }, {rootMargin: '0px 0px -8% 0px', threshold: 0.01});
    els.forEach(function (e) { io.observe(e); });
  }

  /* ---------- попапы: #popup:имя, #zeropopupN, #closepopup ---------- */
  var openPopup = null;
  function closePopup() {
    if (!openPopup) return;
    var p = openPopup; openPopup = null;
    p.el.classList.remove('t-popup_show');
    setTimeout(function () { p.el.style.display = 'none'; }, 300);
    d.body.classList.remove('bi-lock');
    if (p.moved) p.moved.forEach(function (m) { m.rec.style.display = 'none'; m.home.appendChild(m.rec); });
    $$('iframe[data-src]', p.el).forEach(function (f) { if (f.getAttribute('src')) f.removeAttribute('src'); });
  }
  function showPopup(hook) {
    var el = $$('.t-popup').filter(function (p) { return p.getAttribute('data-tooltip-hook') === hook; })[0];
    if (!el) return false;
    closePopup();
    var info = {el: el, moved: []};
    var ids = (el.getAttribute('data-popup-rec-ids') || '').split(',').filter(Boolean);
    var cont = el.querySelector('.t-popup__container');
    ids.forEach(function (id) {
      var rec = d.getElementById('rec' + id);
      if (!rec || !cont) return;
      var home = rec.parentNode, ph = d.createComment('rec' + id);
      home.insertBefore(ph, rec);
      info.moved.push({rec: rec, home: {appendChild: function (n) { ph.parentNode.insertBefore(n, ph); ph.remove(); }}});
      rec.style.display = '';
      cont.appendChild(rec);
    });
    $$('iframe[data-src]', el).forEach(function (f) { f.setAttribute('src', f.getAttribute('data-src')); });
    el.style.display = 'block';
    void el.offsetWidth;
    el.classList.add('t-popup_show');
    d.body.classList.add('bi-lock');
    openPopup = info;
    scaleAll();
    return true;
  }
  d.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (a) {
      var h = a.getAttribute('href');
      if (/^#(popup:|zeropopup)/.test(h)) { e.preventDefault(); showPopup(h); return; }
      if (/^#closepopup|^#closeallpopup/.test(h)) { e.preventDefault(); closePopup(); return; }
      if (/^#rec\d+$/.test(h)) { var t = d.querySelector(h); if (t) { e.preventDefault(); t.scrollIntoView({behavior: reduce ? 'auto' : 'smooth'}); } return; }
    }
    if (e.target.closest && e.target.closest('.t-popup__close, .t-popup__block-close-button')) { closePopup(); return; }
    if (openPopup && e.target === openPopup.el) closePopup();
  });
  d.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePopup(); });
  function hashPopup() { if (/^#(popup:|zeropopup)/.test(location.hash)) showPopup(location.hash); }

  /* ---------- перетаскиваемые ленты (вместо scrollbooster и jQuery) ---------- */
  function drag(item) {
    var ab = d.querySelector('#rec' + item.rec + ' .t396__artboard');
    if (!ab) return;
    ab.classList.add('bi-drag');
    $$('img', ab).forEach(function (i) { i.draggable = false; });
    var x0 = 0, l0 = 0, down = false;
    ab.addEventListener('mousedown', function (e) { down = true; x0 = e.clientX; l0 = ab.scrollLeft; ab.classList.add('is-grabbing'); });
    w.addEventListener('mousemove', function (e) { if (down) ab.scrollLeft = l0 - (e.clientX - x0); });
    w.addEventListener('mouseup', function () { down = false; ab.classList.remove('is-grabbing'); });
    if (item.arrows) {
      var box = d.getElementById('rec' + item.arrows);
      if (box) {
        $$('.arrow-left', box).forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); ab.scrollBy({left: -320, behavior: reduce ? 'auto' : 'smooth'}); }); });
        $$('.arrow-right', box).forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); ab.scrollBy({left: 320, behavior: reduce ? 'auto' : 'smooth'}); }); });
      }
    }
    if (item.auto && !reduce) {
      var dir = 1, paused = false;
      ab.addEventListener('mouseenter', function () { paused = true; });
      ab.addEventListener('mouseleave', function () { paused = false; });
      ab.addEventListener('touchstart', function () { paused = true; }, {passive: true});
      setInterval(function () {
        if (paused || d.hidden) return;
        var max = ab.scrollWidth - ab.clientWidth;
        if (ab.scrollLeft >= max - 5) dir = -1; else if (ab.scrollLeft <= 5) dir = 1;
        ab.scrollLeft += dir * 2;
      }, 35);
    }
  }

  /* ---------- Zero FAQ: исходные пары групп, collapse:true; первый ответ открыт ---------- */
  function accordions() {
    if (!cfg.accordion) return;
    $$('.uc-accordion .t396__artboard').forEach(function (ab) {
      var groups = $$('.t396__group', ab).filter(function (g) { return g.parentNode === ab; });
      var pairs = [];
      groups.forEach(function (head, i) {
        var icon = head.querySelector('.accordion-icon'), body = groups[i + 1];
        if (icon && body && !body.querySelector('.accordion-icon')) pairs.push({head: head, body: body, icon: icon});
      });
      if (!pairs.length) return;
      var active = 0;
      function layout() {
        // Read breakpoint CSS afresh: no cumulative offsets after resize or scaleAll().
        pairs.forEach(function (p) { p.head.style.top = ''; p.body.style.top = ''; });
        var top = parseFloat(getComputedStyle(pairs[0].head).top), removed = 0;
        var screens = (ab.getAttribute('data-artboard-screens') || '320,480,640,960,1200').split(',').map(Number);
        var bp = screens[0];
        screens.forEach(function (s) { if (d.documentElement.clientWidth >= s) bp = s; });
        pairs.forEach(function (p, i) {
          var open = i === active;
          var hh = parseFloat(getComputedStyle(p.head).height), bh = parseFloat(getComputedStyle(p.body).height);
          p.head.style.top = top + 'px'; top += hh;
          p.body.style.top = top + 'px';
          // visibility keeps authored group height measurable while inert removes hidden links from Tab.
          p.body.style.visibility = open ? '' : 'hidden';
          p.body.inert = !open;
          p.body.setAttribute('aria-hidden', String(!open));
          p.head.setAttribute('aria-expanded', String(open));
          p.icon.style.transform = open ? '' : 'rotate(45deg)';
          if (open) top += bh; else removed += bh;
        });
        var height = Number(attr(ab, 'height', bp, screens, true));
        var zoom = parseFloat(getComputedStyle(pairs[0].head).zoom) || 1;
        [ab, ab.querySelector('.t396__carrier'), ab.querySelector('.t396__filter')].forEach(function (el) {
          if (el) el.style.height = Math.round((height - removed) * zoom) + 'px';
        });
      }
      pairs.forEach(function (p, i) {
        var id = 'bi13-faq-' + p.body.getAttribute('data-group-id');
        p.body.id = id;
        p.head.setAttribute('role', 'button'); p.head.tabIndex = 0;
        p.head.setAttribute('aria-controls', id);
        p.head.style.cursor = 'pointer';
        function toggle() { active = active === i ? -1 : i; layout(); }
        p.head.addEventListener('click', toggle);
        p.head.addEventListener('keydown', function (e) {
          if (e.target !== p.head || (e.key !== 'Enter' && e.key !== ' ')) return;
          e.preventDefault(); toggle();
        });
        p.head.addEventListener('focus', function () { p.head.style.outline = '2px solid #fff'; p.head.style.outlineOffset = '2px'; });
        p.head.addEventListener('blur', function () { p.head.style.outline = ''; p.head.style.outlineOffset = ''; });
      });
      accordionLayouts.push(layout); layout();
    });
  }

  /* ---------- анкеты: получатель не настроен -> ничего не отправляем, успех не показываем ---------- */
  function forms() {
    var endpoint = d.documentElement.getAttribute('data-form-endpoint') || '';
    $$('form[data-bi13-form]').forEach(function (f) {
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        var st = f.querySelector('.bi-form__status');
        var first = null;
        $$('input,textarea,select', f).forEach(function (i) {
          var bad = false;
          if (i.type === 'checkbox') bad = i.required && !i.checked;
          else if (i.type === 'file') bad = i.required && !(i.files && i.files.length);
          else if (i.required && !String(i.value).trim()) bad = true;
          else if (i.type === 'email' && i.value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(i.value.trim())) bad = true;
          if (bad) { i.setAttribute('aria-invalid', 'true'); if (!first) first = i; } else i.removeAttribute('aria-invalid');
        });
        function say(t) { if (st) { st.textContent = t; st.hidden = false; } }
        if (first) { first.focus(); say('Заполните выделенные поля'); return; }
        if (!endpoint) { say('Анкета пока не принимается, ничего не отправлено. Напишите нам в Telegram'); return; }
        var data = {source: location.pathname};
        $$('input,textarea,select', f).forEach(function (i) { if (i.type === 'file') return; if (i.type === 'checkbox') data[i.name] = i.checked; else data[i.name] = i.value; });
        say('Отправляем…');
        fetch(endpoint, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)})
          .then(function (r) { say(r.ok ? 'Спасибо! Мы получили заявку' : 'Не удалось отправить, попробуйте позже'); })
          .catch(function () { say('Не удалось отправить, попробуйте позже'); });
      });
    });
  }

  /* ---------- куки, «наверх», бургер ---------- */
  function chrome() {
    var KEY = 'bi13-cookie', ck = d.getElementById('bi-cookie');
    var seen = false;
    try { seen = !!localStorage.getItem(KEY); } catch (e) { /* ничего */ }
    if (ck && !seen) ck.hidden = false;
    if (ck) ck.querySelector('.bi-cookie__ok').addEventListener('click', function () { try { localStorage.setItem(KEY, '1'); } catch (e) { /* ничего */ } ck.hidden = true; });
    var up = d.querySelector('.bi-totop');
    if (up) {
      var tick = false;
      w.addEventListener('scroll', function () { if (tick) return; tick = true; requestAnimationFrame(function () { up.hidden = w.scrollY < 600; tick = false; }); }, {passive: true});
      up.addEventListener('click', function () { w.scrollTo({top: 0, behavior: reduce ? 'auto' : 'smooth'}); });
    }
    var nav = d.getElementById('site-nav'), burger = nav && nav.querySelector('.burger');
    if (burger) burger.addEventListener('click', function () { var o = nav.classList.toggle('open'); burger.setAttribute('aria-expanded', String(o)); });
  }

  ready(function () {
    chrome(); animate(); forms(); hashPopup();
    (cfg.drag || []).forEach(drag);
    scaleAll(); accordions();
    w.addEventListener('load', scaleAll);
  });
})();
