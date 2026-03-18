/**
 * Cyber News Feed Ticker overlay.
 *
 * Fetches the top 5 headlines from the /api/news RSS proxy and renders a
 * scrolling bar fixed to the bottom of the viewport.  Wired into the layer
 * control menu exactly like every other overlay: toggleNewsTicker(true/false).
 *
 * Scroll direction matches the map auto-scroll (content moves right-to-left).
 * When auto-scroll is active, ticker speed increases slightly (+1 notch).
 *
 * Refresh cadence: every 15 minutes (matches the API Cache-Control header).
 */

const REFRESH_MS   = 15 * 60 * 1000;  // 15 minutes
const API_ENDPOINT  = '/api/news';
const BASE_SPEED_PX = 80;              // px per second at normal speed
const BOOST_SPEED_PX = 95;            // px per second when auto-scroll is active

let _refreshTimer    = null;
let _tickerEl        = null;
let _contentEl       = null;
let _baseDurationSec = 60;            // updated after first render
let _autoScrollActive = false;

// ---------------------------------------------------------------------------
// Auto-scroll coupling
// ---------------------------------------------------------------------------

document.addEventListener('autoScrollChanged', (e) => {
    _autoScrollActive = e.detail.active;
    _applySpeed();
});

function _applySpeed() {
    if (!_contentEl) return;
    const speed = _autoScrollActive ? BOOST_SPEED_PX : BASE_SPEED_PX;
    // Recalculate from base content width stored at render time
    const durationSec = Math.max(10, _baseDurationSec * (BASE_SPEED_PX / speed));
    _contentEl.style.animationDuration = `${durationSec}s`;
}

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
 * Duplicates the set so the CSS translate loop is seamless.
 */
function _render(items) {
    if (!_contentEl) return;
    if (!items || items.length === 0) {
        _contentEl.textContent = 'No news available.';
        return;
    }

    _contentEl.innerHTML = '';

    // Duplicate the item set so the marquee loops without a visible gap
    _contentEl.appendChild(_buildItems(items));
    _contentEl.appendChild(_buildItems(items));

    // Measure content width after the browser has painted, then set a
    // duration that gives a consistent px-per-second scroll rate.
    requestAnimationFrame(() => {
        const halfWidth = _contentEl.scrollWidth / 2;  // width of one set
        _baseDurationSec = Math.max(10, halfWidth / BASE_SPEED_PX);
        _applySpeed();
        // Reset animation so it starts from the beginning with the new duration
        _contentEl.style.animation = 'none';
        // Force reflow before re-applying the animation
        void _contentEl.offsetWidth;
        _contentEl.style.animation = '';
    });
}

/**
 * Build a DocumentFragment of ticker item spans for the given news items.
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
