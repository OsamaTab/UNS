module.exports = {
    id: 'readfromnet',
    name: 'ReadFrom.Net',
    getPopularUrl: () => `https://readfrom.net/`,
    getSearchUrl: (query) => `https://readfrom.net/search?q=${encodeURIComponent(query)}`,
    getSearchScript: () => `
    (() => {
        const results = [];
        document.querySelectorAll('.title a').forEach(aEl => {
            const title = aEl.innerText.trim();
            const url = aEl.href;
            results.push({ title, url, chapters: "Ebook", cover: null, source: 'ReadFrom.Net' });
        });
        return results;
    })();`
};