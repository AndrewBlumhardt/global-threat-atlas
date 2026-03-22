import { getApiUrl } from '../shared/demoMode.js';
const API_URL = getApiUrl('/api/news');
const TICKER_HEIGHT = 40; // px — must match .news-ticker height in CSS

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
    _shiftControls(false);
    return;
  }

  _tickerEl.classList.remove('hidden');
  _shiftControls(true);
  if (_innerEl) _innerEl.textContent = 'Loading cyber news\u2026';

  try {
    const resp = await fetch(API_URL);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();

    // Handle both old (plain array) and new ({items, speed_s}) response shapes
    const items   = Array.isArray(data) ? data : (data.items  || []);
    const speed_s = Array.isArray(data) ? 70   : (data.speed_s || 70);

    if (items.length === 0) {
      if (_innerEl) _innerEl.textContent = 'No headlines available.';
      return;
    }

    const html = items.map(item =>
      `<a class="news-ticker-item" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">` +
      `<span class="news-ticker-source">${esc(item.source)}</span>${esc(item.title)}` +
      `</a>`
    ).join('<span class="news-ticker-sep">\u25c6</span>');

    if (_innerEl) {
      _innerEl.innerHTML = html +
        '<span class="news-ticker-sep">\u25c6</span>' +
        html +
        '<span class="news-ticker-sep">\u25c6</span>';
      _innerEl.style.animationDuration = `${speed_s}s`;
    }
  } catch (e) {
    console.warn('[newsTicker] fetch failed:', e.message);
    if (_innerEl) _innerEl.textContent = 'Could not load headlines.';
  }
}

function _shiftControls(tickerVisible) {
  const dl = document.getElementById('downloadControl');
  if (dl) dl.style.bottom = tickerVisible ? `${TICKER_HEIGHT + 10}px` : '10px';
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
