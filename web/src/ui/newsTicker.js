/**
 * Cyber News Feed Ticker overlay.
 *
 * Fetches headlines from /api/news and renders a right-to-left scrolling bar
 * fixed to the bottom of the viewport. Animation is handled entirely by CSS
 * (linear, constant speed, pauses on hover). JS only fetches and builds DOM.
 *
 * Refresh cadence: every 15 minutes (matches the API Cache-Control header).
 */

const REFRESH_MS   = 15 * 60 * 1000;
const API_ENDPOINT = '/api/news';

let _refreshTimer = null;
let _tickerEl     = null;
let _contentEl    = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function toggleNewsTicker(enabled) {
    if (!_tickerEl) {
        _tickerEl  = document.getElementById('newsTicker');
        _contentEl = document.getElementById('newsTickerContent');
    }

    if (enabled) {
        _tickerEl.classList.remove('hidden');
        await _loadNews();
        _refreshTimer = setInterval(_loadNews, REFRESH_MS);
    } else {
        _tickerEl.classList.add('hidden');
        clearInterval(_refreshTimer);
        _refreshTimer = null;
    }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function _loadNews() {
    try {
        const resp = await fetch(API_ENDPOINT);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const items = await resp.json();
        _render(items);
    } catch (err) {
        console.warn('[newsTicker] fetch failed:', err);
    }
}

function _render(items) {
    if (!_contentEl) return;
    _contentEl.innerHTML = '';
    if (!items || items.length === 0) return;

    // Build items twice for a seamless CSS loop (translateX(-50%) scrolls one full set)
    _contentEl.appendChild(_buildSet(items));
    _contentEl.appendChild(_buildSet(items));
}

function _buildSet(items) {
    const frag = document.createDocumentFragment();
    items.forEach((item) => {
        const link = document.createElement('a');
        link.href   = item.url;
        link.target = '_blank';
        link.rel    = 'noopener noreferrer';
        link.textContent = item.title;
        link.className = 'news-ticker-link';

        const source = document.createElement('span');
        source.className   = 'news-ticker-source';
        source.textContent = item.source;

        const sep = document.createElement('span');
        sep.className   = 'news-ticker-sep';
        sep.textContent = '◆';
        sep.setAttribute('aria-hidden', 'true');

        const wrap = document.createElement('span');
        wrap.className = 'news-ticker-item';
        wrap.appendChild(source);
        wrap.appendChild(link);
        wrap.appendChild(sep);
        frag.appendChild(wrap);
    });
    return frag;
}
