(function () {
    if (window.igMasterEngineInjected) return;
    window.igMasterEngineInjected = true;

    // ==========================================
    // 1. NATIVE HAPTIC TRIGGER (iPhone-Style Tap)
    // ==========================================
    function triggerHaptic() {
        if (window.NativeHaptic && window.NativeHaptic.tap) {
            window.NativeHaptic.tap();
        }
    }

    // ==========================================
    // 2. SPEED BOOSTER & GRID DOWNSCALER
    // ==========================================
    function optimizeThumbnailUrl(url) {
        if (!url || typeof url !== 'string' || !url.includes('cdninstagram.com')) return url;
        return url.replace(/\/p\d+x\d+\//g, '/p320x320/').replace(/\/s\d+x\d+\//g, '/s320x320/');
    }

    function patchProfileGrid() {
        if (!window.location.pathname.match(/^\/[A-Za-z0-9_.]+\/?$/)) return;
        const gridImages = document.querySelectorAll('main img');
        for (let i = 0; i < gridImages.length; i++) {
            const img = gridImages[i];
            if (img.dataset.turboBoosted) continue;
            img.dataset.turboBoosted = '1';

            if (img.srcset) img.removeAttribute('srcset');
            const optimized = optimizeThumbnailUrl(img.src);
            if (optimized !== img.src) img.src = optimized;
            img.decoding = 'async';
            img.loading = i < 9 ? 'eager' : 'lazy';
        }
    }

    let speedThrottle;
    const speedObserver = new MutationObserver(() => {
        if (speedThrottle) return;
        speedThrottle = setTimeout(() => {
            patchProfileGrid();
            speedThrottle = null;
        }, 300);
    });
    speedObserver.observe(document.documentElement || document.body, { childList: true, subtree: true });
    patchProfileGrid();

    // ==========================================
    // 3. BACK BUTTON & SCROLL POSITION FIX
    // ==========================================
    window.addEventListener('load', function () {
        const savedPosition = sessionStorage.getItem('ig_scroll_pos_' + window.location.pathname);
        if (savedPosition) {
            setTimeout(() => {
                window.scrollTo(0, parseInt(savedPosition, 10));
            }, 300);
        }
    });

    let scrollTimer = null;
    window.addEventListener('scroll', function () {
        if (scrollTimer) clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
            sessionStorage.setItem('ig_scroll_pos_' + window.location.pathname, window.scrollY);
        }, 200);
    }, { passive: true });

    window.addEventListener('beforeunload', function () {
        sessionStorage.setItem('ig_scroll_pos_' + window.location.pathname, window.scrollY);
    });

    let lastPath = window.location.pathname;
    setInterval(() => {
        if (window.location.pathname !== lastPath) {
            lastPath = window.location.pathname;
            const newPos = sessionStorage.getItem('ig_scroll_pos_' + lastPath);
            if (newPos) {
                setTimeout(() => {
                    window.scrollTo(0, parseInt(newPos, 10));
                }, 300);
            }
        }
    }, 500);

    // ==========================================
    // 4. REELS DOWNLOADER
    // ==========================================
    const reelCache = new Map();
    const globalVideoUrls = [];

    function extractVideoUrls(obj) {
        if (!obj || typeof obj !== 'object') return;
        if (Array.isArray(obj)) {
            obj.forEach(item => extractVideoUrls(item));
            return;
        }
        const shortcode = obj.code || obj.shortcode || obj.id || obj.pk;
        const vUrl = obj.video_url || (obj.video_versions && obj.video_versions[0]?.url);
        if (vUrl) {
            if (!globalVideoUrls.includes(vUrl)) {
                globalVideoUrls.push(vUrl);
                if (globalVideoUrls.length > 25) globalVideoUrls.shift();
            }
            if (shortcode) reelCache.set(String(shortcode), vUrl);
        }
        for (let key in obj) {
            if (obj[key] && typeof obj[key] === 'object') extractVideoUrls(obj[key]);
        }
    }

    const origFetch = window.fetch;
    window.fetch = async function (...args) {
        const response = await origFetch.apply(this, args);
        try {
            const clone = response.clone();
            clone.json().then(json => extractVideoUrls(json)).catch(() => {});
        } catch (e) {}
        return response;
    };

    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
        this._url = url;
        return origOpen.apply(this, arguments);
    };
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function () {
        this.addEventListener('load', function () {
            try {
                if (this.responseText) {
                    const json = JSON.parse(this.responseText);
                    extractVideoUrls(json);
                }
            } catch (e) {}
        });
        return origSend.apply(this, arguments);
    };

    async function handleReelClick(videoEl, btn) {
        let reelUrl = '';
        let shortcode = '';
        const container = videoEl.closest('article, div[role="dialog"], main, section');
        const link = container ? container.querySelector('a[href*="/reel/"], a[href*="/p/"]') : null;
        if (link) {
            const m = link.href.match(/(?:reel|reels|p)\/([A-Za-z0-9_-]+)/);
            if (m) shortcode = m[1];
        }
        if (!shortcode) {
            const pathMatch = window.location.pathname.match(/(?:reel|reels|p)\/([A-Za-z0-9_-]+)/);
            if (pathMatch) shortcode = pathMatch[1];
        }
        if (shortcode && reelCache.has(shortcode)) reelUrl = reelCache.get(shortcode);
        if (!reelUrl && globalVideoUrls.length > 0) reelUrl = globalVideoUrls[globalVideoUrls.length - 1];
        if (!reelUrl && videoEl.src && !videoEl.src.startsWith('blob:')) reelUrl = videoEl.src;

        if (reelUrl) {
            triggerHaptic();
            window.location.href = reelUrl;
        } else {
            alert('Reel link not found. Play the video for a second and try again.');
        }
    }

    setInterval(() => {
        const videos = document.querySelectorAll('video');
        videos.forEach(video => {
            const container = video.parentElement;
            if (!container) return;
            if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
            if (!container.querySelector('.ig-ultimate-reel-btn')) {
                const btn = document.createElement('button');
                btn.className = 'ig-ultimate-reel-btn';
                btn.innerHTML = '📥';
                btn.style.cssText = 'position: absolute !important; top: 15px !important; right: 15px !important; width: 38px !important; height: 38px !important; border-radius: 50% !important; background: rgba(0, 0, 0, 0.65) !important; color: #ffffff !important; border: 1px solid rgba(255, 255, 255, 0.3) !important; font-size: 16px !important; display: flex !important; align-items: center !important; justify-content: center !important; z-index: 999999 !important; cursor: pointer !important; backdrop-filter: blur(4px); outline: none !important; box-shadow: 0 4px 10px rgba(0,0,0,0.4);';
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleReelClick(video, btn);
                });
                container.appendChild(btn);
            }
        });
    }, 1000);

    // ==========================================
    // 5. LONG-PRESS PHOTO DOWNLOADER + HAPTIC & DARK UI
    // ==========================================
    let pressTimer = null;
    let startX = 0;
    let startY = 0;
    let targetPoint = { x: 0, y: 0 };

    const popup = document.createElement('div');
    popup.id = 'ig-custom-popup';
    popup.innerHTML = `
        <button id="ig-save-btn" style="
            background: #1f1b1d;
            color: #ffffff;
            border: 1px solid rgba(255, 255, 255, 0.12);
            padding: 10px 18px;
            border-radius: 14px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 15px;
            font-weight: 500;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.7);
            cursor: pointer;
            outline: none;
            display: flex;
            align-items: center;
            gap: 12px;
            user-select: none;
            -webkit-tap-highlight-color: transparent;
            transform: scale(0.6);
            opacity: 0;
            transition: transform 0.18s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.15s ease;
        ">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d5b4be" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display: block;">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span style="letter-spacing: 0.2px;">Download image</span>
        </button>
    `;
    popup.style.cssText = 'position: fixed; z-index: 2147483647; display: none; transform: translate(-50%, -100%);';
    (document.body || document.documentElement).appendChild(popup);

    const saveBtn = popup.querySelector('#ig-save-btn');

    window.addEventListener('touchstart', function (e) {
        if (e.touches.length !== 1) return;
        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        targetPoint = { x: startX, y: startY };

        clearTimeout(pressTimer);
        pressTimer = setTimeout(() => {
            triggerHaptic();
            popup.style.left = `${Math.min(Math.max(startX, 90), window.innerWidth - 90)}px`;
            popup.style.top = `${Math.max(startY - 14, 60)}px`;
            popup.style.display = 'block';
            requestAnimationFrame(() => {
                saveBtn.style.transform = 'scale(1)';
                saveBtn.style.opacity = '1';
            });
        }, 450);
    }, { capture: true, passive: true });

    window.addEventListener('touchmove', function (e) {
        if (!pressTimer) return;
        if (Math.hypot(e.touches[0].clientX - startX, e.touches[0].clientY - startY) > 15) {
            clearTimeout(pressTimer);
            pressTimer = null;
        }
    }, { capture: true, passive: true });

    window.addEventListener('touchend', function () {
        clearTimeout(pressTimer);
        pressTimer = null;
    }, { capture: true, passive: true });

    window.addEventListener('touchstart', function (e) {
        if (popup.style.display === 'block' && !popup.contains(e.target)) {
            saveBtn.style.transform = 'scale(0.6)';
            saveBtn.style.opacity = '0';
            setTimeout(() => { popup.style.display = 'none'; }, 150);
        }
    }, { capture: false, passive: true });

    saveBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        triggerHaptic();
        saveBtn.style.transform = 'scale(0.6)';
        saveBtn.style.opacity = '0';
        setTimeout(() => { popup.style.display = 'none'; }, 150);

        let mediaUrl = '';
        const elements = document.elementsFromPoint(targetPoint.x, targetPoint.y);

        for (let el of elements) {
            if (el.tagName === 'VIDEO' && el.src) { mediaUrl = el.src; break; }
            const v = el.querySelector('video');
            if (v && v.src) { mediaUrl = v.src; break; }
            if (el.tagName === 'IMG' && el.src && !el.src.includes('profile_pic')) { mediaUrl = el.src; break; }
            const img = el.querySelector('img');
            if (img && img.src && !img.src.includes('profile_pic')) { mediaUrl = img.src; break; }
        }

        if (mediaUrl) {
            window.location.href = mediaUrl;
        } else {
            alert('Media not found on this slide.');
        }
    });
})();
