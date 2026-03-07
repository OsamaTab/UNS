module.exports = {
    id: 'graycity',
    name: 'Graycity',
    getPopularUrl: () => `https://graycity.net/most-popular`,
    getSearchUrl: (query) => `https://graycity.net/search?q=${encodeURIComponent(query)}`,
    getSearchScript: () => `
    (() => {
        const results = [];
        document.querySelectorAll('a[href*="/novel/"]').forEach(aEl => {
            const title = aEl.innerText.trim();
            const url = aEl.href;
            const container = aEl.closest('.book-item') || aEl.parentElement;
            if (title && url && !results.find(r => r.url === url)) {
                results.push({ title, url, chapters: "View Info", cover: null, source: 'Graycity' });
            }
        });
        return results;
    })();`
};