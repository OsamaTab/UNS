module.exports = {
    id: 'novelsonline',
    name: 'NovelsOnline',
    getPopularUrl: () => `https://novelsonline.net/top-novel`,
    getSearchUrl: (query) => `https://novelsonline.net/search-novels?keyword=${encodeURIComponent(query)}`,
    getSearchScript: () => `
    (() => {
        const results = [];
        document.querySelectorAll('.title a').forEach(aEl => {
            const title = aEl.innerText.trim();
            const url = aEl.href;
            const container = aEl.closest('.item');
            const imgEl = container.querySelector('img');
            results.push({ title, url, chapters: "Online", cover: imgEl ? imgEl.src : null, source: 'NovelsOnline' });
        });
        return results;
    })();`
};