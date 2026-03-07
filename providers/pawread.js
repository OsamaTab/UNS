module.exports = {
    id: 'pawread',
    name: 'PawRead',
    getPopularUrl: () => `https://pawread.com/list/most-popular/`,
    
    // Updated 'key=' to 'keyword=' and converted spaces to '+' to prevent server errors
    getSearchUrl: (query) => `https://pawread.com/search/?keyword=${encodeURIComponent(query).replace(/%20/g, '+')}`,
    
    getSearchScript: () => `
    (() => {
        const results = [];
        
        // Scope the search to the main container so we don't accidentally scrape the sidebar
        const mainContent = document.querySelector('.main-content, .left-column, .search-container, .list-container, .col-md-8, #main') || document;
        const titleLinks = mainContent.querySelectorAll('.book-title a, .novel-title a, h3 a');
        
        titleLinks.forEach(aEl => {
            try {
                // CRITICAL FIX: Ignore sidebar, widget, and recommendation items!
                if (aEl.closest('.sidebar, .widget, .recommend, .popular, .right-column')) return;

                const title = aEl.innerText.trim();
                let url = aEl.getAttribute('href');
                
                if (!title || !url || url.startsWith('javascript:')) return;
                
                if (url.startsWith('/')) {
                    url = 'https://pawread.com' + url;
                } else if (!url.startsWith('http')) {
                    url = aEl.href;
                }
                
                let cover = null;
                let chapters = "Free";
                
                let currentElement = aEl.parentElement;
                let imgEl = null;
                let chapEl = null;
                let maxClimbs = 5; 
                
                while (currentElement && maxClimbs > 0) {
                    if (!imgEl) imgEl = currentElement.querySelector('img');
                    
                    if (!chapEl) {
                        const links = currentElement.querySelectorAll('a');
                        for (let link of links) {
                            const linkText = link.innerText.trim().toLowerCase();
                            if ((linkText.includes('chapter') || linkText.includes('ch.')) && linkText !== title.toLowerCase()) {
                                chapEl = link;
                                break;
                            }
                        }
                    }
                    if (imgEl && chapEl) break;
                    currentElement = currentElement.parentElement;
                    maxClimbs--;
                }
                
                if (imgEl) {
                    cover = imgEl.getAttribute('data-src') || 
                            imgEl.getAttribute('data-original') || 
                            imgEl.getAttribute('src');
                    if (cover && cover.startsWith('/')) cover = 'https://pawread.com' + cover;
                }
                
                if (chapEl && chapEl.innerText.trim()) {
                    chapters = chapEl.innerText.trim();
                } else {
                    const parentText = aEl.parentElement.parentElement.innerText;
                    const chapMatch = parentText.match(/(Chapter\\s*\\d+|Ch\\.\\s*\\d+)/i);
                    if (chapMatch) chapters = chapMatch[1];
                }
                
                if (!results.find(r => r.url === url)) {
                    results.push({ title, url, chapters, cover, source: 'PawRead' });
                }
                
            } catch (error) {
                console.warn('Scraping error on PawRead:', error);
            }
        });
        
        return results;
    })();`
};