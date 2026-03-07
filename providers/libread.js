module.exports = {
    id: 'libread',
    name: 'LibRead',
    getPopularUrl: () => `https://libread.com/sort/top-view-full`,
    
    // Convert spaces to '+' just in case the backend trips on '%20'
    getSearchUrl: (query) => `https://libread.com/search?keyword=${encodeURIComponent(query).replace(/%20/g, '+')}`,
    
    getSearchScript: () => `
    (() => {
        const results = [];
        
        // Target multiple common title classes to be safe
        const titleLinks = document.querySelectorAll('.novel-title a, h3 a, .title a');
        
        titleLinks.forEach(aEl => {
            try {
                const title = aEl.innerText.trim();
                let url = aEl.getAttribute('href');
                
                // Skip empty titles or dead links
                if (!title || !url || url.startsWith('javascript:')) return;
                
                // Safely build absolute URL
                if (url.startsWith('/')) {
                    url = 'https://libread.com' + url;
                } else if (!url.startsWith('http')) {
                    url = aEl.href; 
                }
                
                // Find a container, using multiple common layout classes
                // Fallback to parent nodes if none of these classes exist
                const container = aEl.closest('.row, .item, .novel-item, li, article') 
                               || aEl.parentElement.parentElement.parentElement;
                
                let cover = null;
                if (container) {
                    const imgEl = container.querySelector('img');
                    if (imgEl) {
                        // Check lazy-loading attributes first
                        cover = imgEl.getAttribute('data-src') || 
                                imgEl.getAttribute('data-original') || 
                                imgEl.getAttribute('src');
                        
                        // Make image URL absolute if needed
                        if (cover && cover.startsWith('/')) {
                            cover = 'https://libread.com' + cover;
                        }
                    }
                }
                
                // Try to find the latest chapter text
                let chapters = "Chapters";
                if (container) {
                    const chapEl = container.querySelector('.chapter, .latest-chapter, .text-info, .chapter-title');
                    if (chapEl && chapEl.innerText.trim()) {
                        chapters = chapEl.innerText.trim();
                    }
                }
                
                // Avoid pushing duplicates
                if (!results.find(r => r.url === url)) {
                    results.push({ title, url, chapters, cover, source: 'LibRead' });
                }
            } catch (error) {
                // If one novel fails to parse, catch the error so the rest of the list still loads
                console.warn('Scraping error on LibRead item:', error);
            }
        });
        
        return results;
    })();`
};