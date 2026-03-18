/**
 * Cyber News Ticker overlay.
 *
 * Fetches headlines from the /api/news RSS proxy and renders a scrolling bar
 * fixed to the bottom of the viewport.  The bar is wired into the layer
 * control menu exactly like every other overlay: toggleNewsTicker(true/false).
 *
 * Refresh cadence: every 15 minutes (matches the API Cache-Control header).
 */

const REFRESH_MS  = 15 * 60 * 1000;   // 15 minutes
const API_ENDPOINT = '/api/news';

let _refreshTimer = null;
let _tickerEl     = null;
let _contentEl    = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Enable or disable the news ticker layer.
 * @param {boolean} enabled
 */
export async function toggleNewsTicker(enabled) {
    _ensureDOM();

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

/** Grab DOM references (created in index.html). */
function _ensureDOM() {
    if (!_tickerEl) {
        _tickerEl  = document.getElementById('newsTicker');
        _contentEl = document.getElementById('newsTickerContent');
    }
}

/** Fetch headlines and rebuild the scrolling content. */
async function _loadNews() {
    try {
        const resp = await fetch(API_ENDPOINT);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const items = await resp.json();
        _render(items);
    } catch (err) {
        console.warn('[newsTicker] fetch failed:', err);
        // Leave existing content in place so the ticker keeps running.
    }
}

/**
 * Build the scrolling item list from the news array.
 * @param {Array<{title: string, source: string, url: string, published: string}>} items
 */
function _render(items) {
    if (!_contentEl) return;
    if (!items || items.length === 0) {
        _contentEl.textContent = 'No news available.';
        return;
    }

    _contentEl.innerHTML = '';

    // Build all items then duplicate them so the CSS marquee loops seamlessly
    const fragment = _buildItems(items);
    const clone    = _buildItems(items);   // duplicate for seamless loop

    _contentEl.appendChild(fragment);
    _contentEl.appendChild(clone);

    // Recalculate animation duration based on content width so scroll speed
    // stays constant regardless of headline count.
    //   Speed target: ~80px per second
    requestAnimationFrame(() => {
        const contentWidth = _contentEl.scrollWidth / 2;   // half = one set
        const durationSec  = Math.max(20, contentWidth / 80);
        _contentEl.style.animationDuration = `${durationSec}s`;
    });
}

/**
 * Build a DocumentFragment of ticker item spans for the given news items.
 * @param {Array} items
 * @returns {DocumentFragment}
 */
function _buildItems(items) {
    const fragment = document.createDocumentFragment();
    items.forEach((item) => {
        const span = document.createElement('span');
        span.className = 'news-ticker-item';

        const source = document.createElement('span');
        source.className = 'news-ticker-source';
        source.textContent = item.source;

        const link = document.createElement('a');
        link.href = item.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = item.title;

        const sep = document.createElement('span');
        sep.className = 'news-ticker-sep';
        sep.textContent = '·';
        sep.setAttribute('aria-hidden', 'true');

        span.appendChild(source);
        span.appendChild(link);
        span.appendChild(sep);
        fragment.appendChild(span);
    });
    return fragment;
}
