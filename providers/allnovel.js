module.exports = {
    id: 'allnovel',
    name: 'AllNovel',
    getPopularUrl: () => `https://allnovel.org/most-viewed`,
    getSearchUrl: (query) => `https://allnovel.org/search?keyword=${encodeURIComponent(query)}`,
    getSearchScript: (query) => `  // Added query parameter even if not used
    (() => {
        const results = [];
        
        // Each novel is in a div with class "row"
        const novelRows = document.querySelectorAll('.list-novel > .row, .search-page .row');
        
        novelRows.forEach(row => {
            // Get title and URL
            const titleLink = row.querySelector('.truyen-title a');
            if (!titleLink) return;
            
            const title = titleLink.innerText.trim();
            const url = titleLink.href;
            
            // Get cover image - from the col-xs-3 div
            const imgEl = row.querySelector('.col-xs-3 img');
            let cover = null;
            if (imgEl) {
                cover = imgEl.getAttribute('src');
                // Fix relative URL
                if (cover && cover.startsWith('/')) {
                    cover = 'https://allnovel.org' + cover;
                }
            }
            
            // Get latest chapter
            let chapters = "View Info";
            const chapterLink = row.querySelector('.col-xs-2 .chapter-text, .col-xs-2 a');
            if (chapterLink) {
                chapters = chapterLink.innerText.trim();
            }
            
            if (title && url && !results.find(r => r.url === url)) {
                results.push({ title, url, chapters, cover, source: 'AllNovel' });
            }
        });
        
        return results;
    })();`
};