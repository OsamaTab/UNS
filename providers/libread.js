module.exports = {
    id: 'libread',
    name: 'LibRead',
    getPopularUrl: () => `https://libread.com/sort/top-view-full`,
    getSearchUrl: (query) => `https://libread.com/search?keyword=${encodeURIComponent(query)}`,
    getSearchScript: () => `
    (() => {
        const results = [];
        document.querySelectorAll('.novel-title a').forEach(aEl => {
            const title = aEl.innerText.trim();
            const url = aEl.href;
            const container = aEl.closest('.row');
            const imgEl = container.querySelector('img');
            let cover = imgEl ? (imgEl.getAttribute('data-src') || imgEl.getAttribute('src')) : null;
            if (title && url) {
                results.push({ title, url, chapters: "Chapters", cover, source: 'LibRead' });
            }
        });
        return results;
    })();`
};