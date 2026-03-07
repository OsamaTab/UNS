module.exports = {
    id: 'pawread',
    name: 'PawRead',
    getPopularUrl: () => `https://pawread.com/list/most-popular/`,
    getSearchUrl: (query) => `https://pawread.com/search/?key=${encodeURIComponent(query)}`,
    getSearchScript: () => `
    (() => {
        const results = [];
        document.querySelectorAll('.book-title a').forEach(aEl => {
            const title = aEl.innerText.trim();
            const url = aEl.href;
            const container = aEl.closest('.book-item');
            const imgEl = container.querySelector('img');
            results.push({ title, url, chapters: "Free", cover: imgEl ? imgEl.src : null, source: 'PawRead' });
        });
        return results;
    })();`
};