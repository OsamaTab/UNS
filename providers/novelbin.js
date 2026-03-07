// providers/novelbin.js

module.exports = {
    id: 'novelbin',
    name: 'NovelBin',

    getPopularUrl: () => `https://novelbin.com/sort/top-view-full`,
    getSearchUrl: (query) => {
        return `https://novelbin.com/search?keyword=${encodeURIComponent(query)}`;
    },

    getSearchScript: () => `
    (() => {
        const results = [];
        const titleLinks = document.querySelectorAll('.novel-title a');
        
        titleLinks.forEach(aEl => {
            const title = aEl.innerText.trim();
            const url = aEl.href;
            const container = aEl.closest('.row') || aEl.closest('.novel-item') || aEl.parentElement.parentElement;
            
            // Fix: Chapter logic must be INSIDE the loop for each container
            const chapterEl = container.querySelector('.chapter-text, .label-info, .chapter, span[title*="Chapter"]');
            let chapters = "View Info";

            if (chapterEl) {
                chapters = chapterEl.innerText.trim();
            } else {
                const allSpans = container.querySelectorAll('span');
                if (allSpans.length > 0) chapters = allSpans[allSpans.length - 1].innerText.trim();
            }

            const imgEl = container.querySelector('img');
            let cover = null;
            if (imgEl) {
                cover = imgEl.getAttribute('data-src') || imgEl.getAttribute('src');
                if (cover && cover.startsWith('//')) cover = 'https:' + cover;
                else if (cover && cover.startsWith('/')) cover = window.location.origin + cover;
            }
            
            if (title && url && !results.find(r => r.url === url)) {
                results.push({ title, url, chapters, cover, source: 'NovelBin' });
            }
        });
        return results;
    })();
`
};