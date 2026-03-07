module.exports = {
    id: 'hiraethtranslation',
    name: 'HiraethTranslation',
    getPopularUrl: () => `https://hiraethtranslation.com/novels/`,
    getSearchUrl: (query) => `https://hiraethtranslation.com/?s=${encodeURIComponent(query)}&post_type=wp-manga`,
    getSearchScript: () => `
    (() => {
        const results = [];
        document.querySelectorAll('.post-title h3 a, .h4 a').forEach(aEl => {
            const title = aEl.innerText.trim();
            const url = aEl.href;
            const container = aEl.closest('.c-tabs-item__content') || aEl.closest('.row');
            const imgEl = container.querySelector('img');
            let cover = imgEl ? (imgEl.getAttribute('data-src') || imgEl.getAttribute('src')) : null;
            if (title && url) {
                results.push({ title, url, chapters: "Latest", cover, source: 'HiraethTranslation' });
            }
        });
        return results;
    })();`
};