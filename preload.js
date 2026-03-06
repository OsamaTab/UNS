const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Scraper control
    startScrape: (jobData) => ipcRenderer.send('start-browser-scrape', jobData),
    stopScrape: (jobData) => ipcRenderer.send('stop-scrape', jobData),
    resumeScrape: (jobData) => ipcRenderer.send('resume-scrape', jobData),
    toggleScraper: (show) => ipcRenderer.send('toggle-scraper-view', show),
    onEngineReady: (callback) => ipcRenderer.on('engine-ready', callback),
    addEpubToLibrary: () => ipcRenderer.invoke('add-epub-to-library'),
    openEpub: (filename) => ipcRenderer.send('open-epub', filename),
    
    // Progress listeners
    onScrapeStatus: (callback) => {
        ipcRenderer.on('scrape-status', (event, data) => callback(data));
    },
    onPythonError: (callback) => {
        ipcRenderer.on('python-error', (event, data) => callback(data));
    },
    onHumanActionNeeded: (callback) => {
        ipcRenderer.on('human-action-needed', (event, data) => callback(data));
    },
    
    // Remove listeners on cleanup
    removeStatusListener: () => ipcRenderer.removeAllListeners('scrape-status'),
    removeErrorListener: () => ipcRenderer.removeAllListeners('python-error'),
    removeHumanActionListener: () => ipcRenderer.removeAllListeners('human-action-needed'),
    removeEngineReadyListener: () => ipcRenderer.removeAllListeners('engine-ready')
});