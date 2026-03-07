module.exports = {
    id: 'readfromnet',
    name: 'ReadFrom.Net',
    getPopularUrl: () => `https://readfrom.net/home/`,
    
    // Safely encode the search query
    getSearchUrl: (query) => `https://readfrom.net/build_in_search/?q=${encodeURIComponent(query).replace(/%20/g, '+')}`,
    
    getSearchScript: () => `
    (() => {
        const results = [];
        
        // Target the actual container for each search result
        const resultItems = document.querySelectorAll('.box_in');
        
        resultItems.forEach(item => {
            try {
                // 1. Get Title and URL
                const titleLink = item.querySelector('h2.title a');
                if (!titleLink) return;
                
                const title = titleLink.innerText.trim();
                let url = titleLink.getAttribute('href');
                
                // Skip invalid entries
                if (!title || !url || url.startsWith('javascript:')) return;
                
                // Safely build absolute URLs
                if (url.startsWith('/')) {
                    url = 'https://readfrom.net' + url;
                } else if (!url.startsWith('http')) {
                    url = titleLink.href;
                }
                
                // 2. Get Cover Image
                let cover = null;
                // The image is directly inside the container, usually wrapped in an <a> tag
                const imgEl = item.querySelector('img');
                if (imgEl) {
                    cover = imgEl.getAttribute('src');
                    
                    // Ensure image URLs are absolute
                    if (cover && cover.startsWith('/')) {
                        cover = 'https://readfrom.net' + cover;
                    }
                }
                
                // 3. Get Author (Used in place of 'chapters' since this is an Ebook site)
                let chapters = "Ebook";
                const authorLink = item.querySelector('h5.title a');
                if (authorLink) {
                    chapters = authorLink.innerText.trim();
                }
                
                // Deduplicate results
                if (!results.find(r => r.url === url)) {
                    results.push({ title, url, chapters, cover, source: 'ReadFrom.Net' });
                }
                
            } catch (error) {
                console.warn('Scraping error on ReadFrom.Net item:', error);
            }
        });
        
        return results;
    })();`
};