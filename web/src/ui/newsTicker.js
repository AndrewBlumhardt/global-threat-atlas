const API_URL = '/api/news';

let _tickerEl = null;
let _innerEl  = null;

export async function toggleNewsTicker(enabled) {
  if (!_tickerEl) {
    _tickerEl = document.getElementById('newsTicker');
    _innerEl  = document.getElementById('newsTickerInner');
  }

  if (!_tickerEl) return;

  if (!enabled) {
    _tickerEl.classList.add('hidden');
    return;
  }

  _tickerEl.classList.remove('hidden');
  if (_innerEl) _innerEl.textContent = 'Loading cyber news…';

  try {
    const resp = await fetch(API_URL);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const items = await resp.json();

    if (!items || items.length === 0) {
      if (_innerEl) _innerEl.textContent = 'No headlines available.';
      return;
    }

    // Build headline spans — duplicate for seamless CSS scroll loop
    const html = items.map(item =>
      `<a class="news-ticker-item" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">` +
      `<span class="news-ticker-source">${esc(item.source)}</span>${esc(item.title)}` +
      `</a>`
    ).join('<span class="news-ticker-sep">◆</span>');

    if (_innerEl) {
      _innerEl.innerHTML = html +
        '<span class="news-ticker-sep">◆</span>' +
        html +
        '<span class="news-ticker-sep">◆</span>';
    }
  } catch (e) {
    console.warn('[newsTicker] fetch failed:', e.message);
    if (_innerEl) _innerEl.textContent = 'Could not load headlines.';
  }
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
