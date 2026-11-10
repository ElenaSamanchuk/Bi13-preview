// Продолжаем цепочку с текущего URL. Явные параметры ссылки остаются приоритетными.
document.addEventListener('DOMContentLoaded', () => {
  const allowed = [
    'r', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'utm_id', 'utm_source_platform', 'utm_creative_format', 'utm_marketing_tactic',
  ];
  const source = new URLSearchParams(location.search);
  const parameters = allowed.map(key => [key, source.getAll(key).filter(Boolean)])
    .filter(([, values]) => values.length > 0);
  if (!parameters.length) return;

  const referral = source.get('r');
  if (referral) {
    try { localStorage.setItem('r', referral); } catch { /* хранилище может быть недоступно */ }
  }

  for (const link of document.querySelectorAll('a[href]')) {
    const href = link.getAttribute('href');
    if (!href || href.startsWith('#') || link.hasAttribute('download')) continue;
    let target;
    try { target = new URL(href, location.href); } catch { continue; }
    if (!['http:', 'https:'].includes(target.protocol)) continue;

    const site = target.origin === location.origin ||
      ['https://bi13pro.ru', 'https://www.bi13pro.ru'].includes(target.origin);
    const checkout = target.origin === 'https://lk.bi13pro.ru' &&
      /^\/payments\/tariff_[\w-]+\/checkout\/?$/.test(target.pathname);
    if (!site && !checkout) continue;
    if (site && (/^\/(media|assets|fonts|t)\//.test(target.pathname) ||
        /\.(?!html?$)[\w-]+$/i.test(target.pathname))) continue;

    const previous = target.search;
    for (const [key, values] of parameters) {
      if (!target.searchParams.has(key)) {
        for (const value of values) target.searchParams.append(key, value);
      }
    }
    if (target.search === previous) continue;
    link.setAttribute('href', target.origin === location.origin ? target.pathname + target.search + target.hash : target.href);
  }
}, {once: true});
