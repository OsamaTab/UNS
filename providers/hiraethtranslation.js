module.exports = {
    id: 'hiraethtranslation',
    name: 'HiraethTranslation',
    getPopularUrl: () => `https://hiraethtranslation.com/novels/`,
    
    // Converted spaces to '+' (Madara themes often fail search and return the homepage if they see %20)
    getSearchUrl: (query) => `https://hiraethtranslation.com/?s=${encodeURIComponent(query).replace(/%20/g, '+')}&post_type=wp-manga`,
    
    getSearchScript: () => `
    (() => {
        const results = [];
        
        // Scope to main content area
        const mainContent = document.querySelector('.c-page-content, .site-content, .main-col, .content-area, #content') || document;
        const titleLinks = mainContent.querySelectorAll('.post-title h3 a, .post-title h4 a, .tab-content h3 a');
        
        titleLinks.forEach(aEl => {
            try {
                // CRITICAL FIX: Ensure it's not picking up the trending widget!
                if (aEl.closest('.c-sidebar, .widget, .sidebar, .popular-slider')) return;
                
                const title = aEl.innerText.trim();
                const url = aEl.href;
                
                if (!title || !url) return;
                
                const container = aEl.closest('.c-tabs-item__content, .row, .page-item-detail, .manga-item');
                
                let cover = null;
                let chapters = "Latest";
                
                if (container) {
                    const imgEl = container.querySelector('img');
                    if (imgEl) {
                        cover = imgEl.getAttribute('data-src') || 
                                imgEl.getAttribute('data-lazy-src') || 
                                imgEl.getAttribute('src');
                    }

                    const chapEl = container.querySelector('.chapter a, .font-meta.chapter a, .chapter-item a');
                    if (chapEl) {
                        chapters = chapEl.innerText.trim();
                    }
                }
                
                if (!results.find(r => r.url === url)) {
                    results.push({ title, url, chapters, cover, source: 'HiraethTranslation' });
                }
            } catch (error) {
                console.warn('Scraping error on HiraethTranslation:', error);
            }
        });
        
        return results;
    })();`
};