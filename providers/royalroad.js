module.exports = {
    id: 'royalroad',
    name: 'Royal Road',
    getPopularUrl: () => `https://www.royalroad.com/fictions/active-popular`,
    getSearchUrl: (query) => `https://www.royalroad.com/fictions/search?title=${encodeURIComponent(query)}`,
    getSearchScript: () => `
    (() => {
        const results = [];
        document.querySelectorAll('.fiction-title a').forEach(aEl => {
            const title = aEl.innerText.trim();
            const url = aEl.href;
            const container = aEl.closest('.fiction-list-item');
            const imgEl = container.querySelector('img');
            results.push({ title, url, chapters: "Original", cover: imgEl ? imgEl.src : null, source: 'Royal Road' });
        });
        return results;
    })();`
};