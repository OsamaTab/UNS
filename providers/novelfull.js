module.exports = {
    id: 'novelfull',
    name: 'NovelFull',
    getPopularUrl: () => `https://novelfull.com/most-popular`,
    getSearchUrl: (query) => `https://novelfull.com/search?keyword=${encodeURIComponent(query)}`,
    getSearchScript: () => `
    (() => {
        const results = [];
        const items = document.querySelectorAll('.row');
        
        items.forEach(container => {
            const aEl = container.querySelector('.novel-title a, h3 a');
            if (!aEl) return;

            const title = aEl.innerText.trim();
            const url = aEl.href;
            
            const imgEl = container.querySelector('img');
            let cover = imgEl ? imgEl.src : null;

            const chapterEl = container.querySelector('.chapter-text');
            let chapters = chapterEl ? chapterEl.innerText.trim() : "View Info";

            if (title && url && !results.find(r => r.url === url)) {
                results.push({ title, url, chapters, cover, source: 'NovelFull' });
            }
        });
        return results;
    })();
`
};