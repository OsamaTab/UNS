// providers/fanmtl.js

module.exports = {
    id: 'fanmtl',
    name: 'FanMTL',

    getSearchUrl: (query) => {
        return `https://www.fanmtl.com/?s=${encodeURIComponent(query)}`;
    },

    getSearchScript: () => `
        (() => {
            const results = [];
            // FanMTL often uses a grid or list of 'category-item' or 'item'
            // We search for all links that contain "/novel/" in their URL
            const novelLinks = document.querySelectorAll('a[href*="/novel/"]');
            
            novelLinks.forEach(aEl => {
                // We want the link that contains the title, usually inside an h3 or h4
                const titleEl = aEl.querySelector('h3, h4, font') || aEl;
                const titleText = titleEl.innerText.trim();
                
                // Skip if it's an empty link or just a "Read More" button
                if (!titleText || titleText.toLowerCase().includes('read more')) return;

                // Find the image by looking in the parent container
                const container = aEl.closest('.category-item') || aEl.closest('.item') || aEl.parentElement;
                const imgEl = container ? container.querySelector('img') : null;
                
                let cover = null;
                if (imgEl) {
                    cover = imgEl.getAttribute('data-src') || imgEl.getAttribute('src');
                    if (cover && cover.startsWith('/')) cover = window.location.origin + cover;
                }

                // Get chapter info if it exists (usually in a span or small tag)
                const chapterEl = container ? container.querySelector('.chapter, .last-chapter, span[style*="color"]') : null;

                if (titleText && !results.find(r => r.url === aEl.href)) {
                    results.push({
                        title: titleText,
                        url: aEl.href,
                        cover: cover,
                        chapters: chapterEl ? chapterEl.innerText.trim() : null,
                        source: 'FanMTL'
                    });
                }
            });
            
            return results;
        })();
    `
};