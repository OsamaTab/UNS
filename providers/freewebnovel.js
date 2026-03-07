module.exports = {
    id: 'freewebnovel',
    name: 'FreeWebNovel',
    getPopularUrl: () => `https://freewebnovel.com/most-popular-novel/`,
    getSearchUrl: (query) => `https://freewebnovel.com/search?searchkey=${encodeURIComponent(query)}`,
    getSearchScript: () => `
(() => {
    const results = [];
    const titleLinks = document.querySelectorAll('.tit a, .pic a');
    titleLinks.forEach(aEl => {
        const title = aEl.title || aEl.innerText.trim();
        const url = aEl.href;
        const container = aEl.closest('.li-row') || aEl.closest('.item') || aEl.parentElement.parentElement;
        const chapterEl = container.querySelector('.s1 a, .chapter');
        let chapters = chapterEl ? chapterEl.innerText.trim() : "View Info";
        
        // Improved image extraction
        const imgEl = container.querySelector('img');
        let cover = null;
        if (imgEl) {
            // Try common lazy-load attributes first
            cover = imgEl.getAttribute('data-src') || 
                    imgEl.getAttribute('data-original') || 
                    imgEl.getAttribute('data-lazy-src') ||
                    imgEl.getAttribute('src'); // Fallback to src
            
            // Clean up relative URLs if necessary
            if (cover && cover.startsWith('/')) {
                cover = 'https://freewebnovel.com' + cover;
            }
        }
        
        if (title && url && !results.find(r => r.url === url)) {
            results.push({ title, url, chapters, cover, source: 'FreeWebNovel' });
        }
    });
    return results;
})();`
};