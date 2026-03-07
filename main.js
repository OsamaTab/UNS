const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const { execFile } = require('child_process');
const axios = require('axios');
const fs = require('fs');
const providers = require('./providers');

let mainWindow = null;
let scraperWindow = null;
let pythonProcess = null;
let isScraping = false;
let scrapeCancelled = false; // The Master Switch

let enableCloudflareBypass = false;
let currentJobId = null;
let waitingForHuman = false;

// ============ PATHS ============
const userDataPath = app.getPath('userData');
const outputDir = path.join(userDataPath, 'output');

// Ensure the directory exists before starting Python
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}


function startPythonBackend() {
    const isPackaged = app.isPackaged;
    const enginePath = isPackaged
        ? path.join(process.resourcesPath, 'bin', 'engine') // For Mac/Linux
        : path.join(__dirname, 'backend', 'dist', 'engine'); // For Dev

    // For Windows in production, you'd need to append .exe
    const finalPath = (isPackaged && process.platform === 'win32')
        ? `${enginePath}.exe`
        : enginePath;

    console.log("🔧 Engine path:", finalPath);
    console.log("📂 Storage path:", outputDir);

    if (process.platform === 'darwin' && fs.existsSync(finalPath)) {
        require('child_process').execSync(`chmod +x "${finalPath}"`);
    }

    // PASS outputDir AS THE FIRST ARGUMENT
    pythonProcess = execFile(finalPath, [outputDir], { windowsHide: true }, (err) => {
        if (err) {
            console.error("❌ Engine failed:", err);
        }
    });

    pythonProcess.stdout?.on('data', (data) => console.log(`🐍 Python: ${data}`));
    pythonProcess.stderr?.on('data', (data) => console.error(`🐍 Python Error: ${data}`));
}

async function waitForEngine(mainWindow, attempts = 10) {
    for (let i = 0; i < attempts; i++) {
        try {
            await axios.get('http://127.0.0.1:8000/api/health');
            console.log("✅ Engine is responsive!");
            // Signal the frontend that the engine is ready
            mainWindow.webContents.send('engine-ready');
            return true;
        } catch (e) {
            console.log(`⏳ Waiting for engine... (Attempt ${i + 1}/${attempts})`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    console.error("❌ Engine timed out.");
}

// ============ MAIN WINDOW ============
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 1000,
        title: "Universal Novel Scraper",
        icon: path.join(__dirname, 'assets/icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            devTools: true
        }
    });

    if (app.isPackaged) {
        mainWindow.loadFile(path.join(__dirname, 'frontend', 'dist', 'index.html'));
    } else {
        const startUrl = process.env.ELECTRON_START_URL || 'http://localhost:5173';
        mainWindow.loadURL(startUrl);
    }
}

// ============ SCRAPER WINDOW ============
function createScraperWindow() {
    if (scraperWindow && !scraperWindow.isDestroyed()) {
        return scraperWindow;
    }

    scraperWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        show: false,
        title: "Live Scraper Feed",
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    scraperWindow.webContents.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
    scraperWindow.on('close', (e) => {
        if (!app.isQuitting) {
            e.preventDefault();
            scraperWindow.hide();
        }
    });

    return scraperWindow;
}

// ============ DETECT CLOUDFLARE ============
async function detectCloudflare(window) {
    const title = await window.webContents.getTitle();
    const url = window.webContents.getURL();

    // 1. Only check the page TITLE for generic terms (prevents false positives from novel text)
    const titleIndicators = ['just a moment', 'cloudflare', 'attention required', 'verify you are human'];
    const hasTitleIndicator = titleIndicators.some(i => title.toLowerCase().includes(i));

    // 2. Look for actual Cloudflare challenge HTML elements in the DOM
    const hasCFElements = await window.webContents.executeJavaScript(`
        !!document.querySelector('#cf-challenge-running, #cf-please-wait, #turnstile-wrapper, .cf-turnstile')
    `);

    return hasTitleIndicator || hasCFElements || url.toLowerCase().includes('cloudflare');
}

// ============ WAIT FOR CLOUDFLARE SOLVE ============
async function waitForCloudflareSolve(window, jobId, maxWaitTime = 60000) {
    const startTime = Date.now();
    const checkInterval = 2000;  // Check every 2 seconds

    console.log("⏳ Waiting for user to solve Cloudflare challenge...");

    while (Date.now() - startTime < maxWaitTime) {
        if (scrapeCancelled) {
            return false;  // User cancelled
        }

        const hasCloudflare = await detectCloudflare(window);

        if (!hasCloudflare) {
            console.log("✅ Cloudflare challenge solved!");
            return true;  // Challenge solved
        }

        // Wait before checking again
        await new Promise(r => setTimeout(r, checkInterval));
    }

    console.log("⏰ Timeout waiting for Cloudflare solve");
    return false;  // Timeout
}

function getRandomTimeout(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ============ SCRAPING LOGIC (With Human Interaction) ============
async function scrapeChapter(event, jobData, url, chapterNum) {
    // ============ 🛑 CHECKPOINT 1: START OF LOOP ============
    if (scrapeCancelled) {
        console.log("🛑 Scraping stopped by user before loading.");
        isScraping = false;
        return;
    }

    if (!scraperWindow || scraperWindow.isDestroyed()) {
        createScraperWindow();
    }

    // Notify React UI
    event.sender.send('scrape-status', {
        status: 'LOADING',
        message: `Chapter ${chapterNum}: Fetching URL...`
    });

    try {
        // ============ 🌐 LOAD PAGE ============
        await scraperWindow.loadURL(url);

        // Handle Cloudflare/Normal wait times
        const loadTimeout = enableCloudflareBypass
            ? getRandomTimeout(1500, 4000)
            : getRandomTimeout(500, 1000);

        await new Promise(resolve => setTimeout(resolve, loadTimeout));

        // ============ 🛑 CHECKPOINT 2: AFTER LOAD ============
        if (scrapeCancelled) return;

        // Check for Cloudflare Challenge
        const hasCloudflare = await detectCloudflare(scraperWindow);

        if (hasCloudflare && enableCloudflareBypass) {
            event.sender.send('scrape-status', {
                status: 'CLOUDFLARE',
                message: '🛡️ Cloudflare detected - Manual solve required.'
            });

            scraperWindow.show();
            scraperWindow.focus();
            waitingForHuman = true;

            const solved = await waitForCloudflareSolve(scraperWindow, jobData.job_id);
            waitingForHuman = false;

            if (!solved || scrapeCancelled) return;

            // Brief pause after solving to let page settle
            await new Promise(r => setTimeout(r, 2000));
            if (!showBrowserWindow) scraperWindow.hide();
        }

        // ============ 🧠 EXTRACTION ============
        // We extract content AND the 'Next' button URL
        const pageData = await scraperWindow.webContents.executeJavaScript(`
            (() => {
                const title = document.querySelector('.chr-title, .chapter-title, h1, h2, .entry-title')?.innerText?.trim();
                
                // Common content selectors for novel sites
                const contentSelectors = [
                    '#chr-content p', '.chapter-content p', 
                    '.reading-content p', '#chapter-content p', 
                    '.fr-view p', '.text-left p'
                ];
                
                let paragraphs = [];
                for (let selector of contentSelectors) {
                    const found = Array.from(document.querySelectorAll(selector))
                                       .map(p => p.innerText.trim())
                                       .filter(p => p.length > 0);
                    if (found.length > 0) {
                        paragraphs = found;
                        break;
                    }
                }

                // Find the Next Chapter link
                const nextBtn = Array.from(document.querySelectorAll('a')).find(a => {
                    const text = (a.innerText || '').toLowerCase();
                    const href = (a.getAttribute('href') || '').toLowerCase();
                    return (text.includes('next') || href.includes('next')) && 
                           !text.includes('previous') && 
                           a.href && a.href !== window.location.href;
                });

                return { 
                    title: title || 'Untitled Chapter', 
                    paragraphs, 
                    nextUrl: nextBtn?.href || null 
                };
            })()
        `);

        // Validate content
        if (!pageData.paragraphs || pageData.paragraphs.length === 0) {
            throw new Error('No content found. The site structure might have changed.');
        }

        // ============ 🛑 CHECKPOINT 3: BEFORE SAVE ============
        if (scrapeCancelled) return;

        // ============ 💾 SAVE TO BACKEND ============
        // We send 'nextUrl' as the bookmark for the Resume feature
        await axios.post('http://127.0.0.1:8000/api/save-chapter', {
            job_id: jobData.job_id,
            novel_name: jobData.novel_name,
            chapter_title: pageData.title,
            author: jobData.author,
            cover_data: jobData.cover_data,
            content: pageData.paragraphs,
            start_url: url,
            next_url: pageData.nextUrl
        });

        event.sender.send('scrape-status', {
            status: 'SAVED',
            message: `✓ Saved Chapter ${chapterNum}: ${pageData.title}`
        });

        // ============ 🔁 LOOP OR FINISH ============
        if (pageData.nextUrl && pageData.nextUrl !== url) {

            const delay = enableCloudflareBypass
                ? getRandomTimeout(3000, 6000)
                : getRandomTimeout(1000, 2000);

            // ============ 🛑 CHECKPOINT 4: SMART DELAY ============
            // Break the long wait into 100ms chunks so "Stop" is instant
            for (let i = 0; i < delay; i += 100) {
                if (scrapeCancelled) {
                    isScraping = false;
                    return;
                }
                await new Promise(r => setTimeout(r, 100));
            }

            // Recursive call for next chapter
            await scrapeChapter(event, jobData, pageData.nextUrl, chapterNum + 1);

        } else {
            // ============ 📦 FINALIZE ============
            event.sender.send('scrape-status', {
                status: 'FINALIZING',
                message: '📦 Generating EPUB file...'
            });

            await axios.post('http://127.0.0.1:8000/api/finalize-epub', {
                job_id: jobData.job_id,
                novel_name: jobData.novel_name,
                author: jobData.author,
                cover_data: jobData.cover_data
            });

            event.sender.send('scrape-status', {
                status: 'COMPLETED',
                message: '✅ Success! EPUB is ready in your library.'
            });

            isScraping = false;
            if (!showBrowserWindow) scraperWindow?.hide();
        }

    } catch (err) {
        console.error("❌ Scrape error:", err);
        event.sender.send('scrape-status', {
            status: 'ERROR',
            message: `Error at Chapter ${chapterNum}: ${err.message}`
        });
        isScraping = false;
    }
}

ipcMain.handle('add-epub-to-library', async (event) => {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Add EPUB to Library',
        buttonLabel: 'Add to Library',
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'EPUB Books', extensions: ['epub'] }]
    });

    if (result.canceled) return false;

    let added = false;
    for (const filePath of result.filePaths) {
        const fileName = path.basename(filePath);
        const destPath = path.join(outputDir, 'epubs', fileName);

        // Only copy if it doesn't already exist
        if (!fs.existsSync(destPath)) {
            fs.copyFileSync(filePath, destPath);
            added = true;
        }
    }
    return added;
});

ipcMain.handle('search-novel', async (event, { sourceId, query }) => {
    const provider = providers[sourceId];
    if (!provider) return [];

    if (!scraperWindow || scraperWindow.isDestroyed()) createScraperWindow();

    try {
        // 1. Force stop any previous loading/navigation
        scraperWindow.webContents.stop();

        // 2. Small 200ms pause to let the network stack breathe
        await new Promise(r => setTimeout(r, 200));

        // 3. Navigate
        await scraperWindow.loadURL(provider.getSearchUrl(query));

        await scraperWindow.webContents.executeJavaScript(`
            new Promise(resolve => {
                if (document.readyState === 'complete') resolve();
                else window.addEventListener('load', resolve);
            });
        `);

        // 5. Scrape
        const results = await scraperWindow.webContents.executeJavaScript(
            provider.getSearchScript(query)
        );
        return results;
    } catch (err) {
        console.error(`Search error on ${sourceId}:`, err);
        return [];
    }
});

ipcMain.handle('get-novel-details', async (event, novelUrl) => {
    if (!scraperWindow || scraperWindow.isDestroyed()) createScraperWindow();
    try {
        scraperWindow.webContents.stop();
        await scraperWindow.loadURL(novelUrl);
        await new Promise(r => setTimeout(r, 2500));

        const details = await scraperWindow.webContents.executeJavaScript(`
            (() => {
                // ... (previous desc and author selectors) ...

                // Improved Chapter Scraper
                const chapterLinks = document.querySelectorAll('ul.list-chapter a, #list-chapter a, .chapters a');
                let allChapters = Array.from(chapterLinks).map(a => ({
                    title: a.innerText.trim(),
                    url: a.href
                }));

                // If we only found ~30, the site might be using a paginated list or a hidden "Load More"
                // For now, we grab the last chapter text to show the TRUE total
                const lastChEl = document.querySelector('.l-chapters, .last-chapter');
                const lastChText = lastChEl ? lastChEl.innerText.trim() : (allChapters.length > 0 ? allChapters[allChapters.length-1].title : "N/A");

                return {
                    description: document.querySelector('.desc-text, .summary')?.innerText.trim() || "No description.",
                    author: document.querySelector('.author')?.innerText.trim() || "Unknown",
                    lastChapter: lastChText, 
                    firstChapterUrl: document.querySelector('a.btn-read-now, a[href*="chapter-1"]')?.href || window.location.href,
                    allChapters: allChapters // We show the first page for selection
                };
            })()
        `);
        return details;
    } catch (e) { return { description: "Error", allChapters: [] }; }
});

// ipcMain.handle('get-novel-details', async (event, { sourceId, novelUrl }) => {
//     const provider = providers[sourceId];
//     if (!provider) return { description: "Provider not found", allChapters: [] };

//     if (!scraperWindow || scraperWindow.isDestroyed()) createScraperWindow();

//     try {
//         scraperWindow.show(); // Keep this enabled so you can visually debug!
//         await scraperWindow.loadURL(novelUrl);

//         let details = null;
//         let attempts = 0;
//         const maxAttempts = 20; // Try for up to 10 seconds (20 * 500ms)

//         while (attempts < maxAttempts) {
//             attempts++;
//             await new Promise(r => setTimeout(r, 500));

//             if (scraperWindow.webContents.isLoading()) continue;

//             try {
//                 // Execute the provider-specific script
//                 details = await scraperWindow.webContents.executeJavaScript(
//                     provider.getNovelDetailsScript()
//                 );

//                 // If we successfully found chapters, break the loop
//                 if (details && details.allChapters && details.allChapters.length > 0) {
//                     console.log(`[Scraper] Success! Loaded details for ${novelUrl}`);
//                     return details; 
//                 }
//             } catch (err) {
//                 if (!err.message.includes('Execution context was destroyed')) {
//                     console.error("Execute JS Error:", err);
//                 }
//             }
//         }

//         console.log(`[Scraper] Timeout: No details found after 10 seconds for ${novelUrl}`);
//         return { description: "Timeout or structure changed", allChapters: [] }; 

//     } catch (err) {
//         console.error(`Details error on ${sourceId}:`, err);
//         return { description: "Error", allChapters: [] };
//     }
// });

ipcMain.on('open-external', (event, url) => {
    require('electron').shell.openExternal(url);
});

ipcMain.handle('resolve-first-chapter', async (event, novelUrl) => {
    if (!scraperWindow || scraperWindow.isDestroyed()) createScraperWindow();

    try {
        await scraperWindow.loadURL(novelUrl);
        // Find the "Read Now" or "Chapter 1" link
        const firstChapterUrl = await scraperWindow.webContents.executeJavaScript(`
            (() => {
                // Common selectors for "Read Now" buttons
                const readBtn = document.querySelector('a.btn-read-now, a[href*="chapter-1"], .btn-info');
                return readBtn ? readBtn.href : null;
            })()
        `);
        return firstChapterUrl || novelUrl; // Fallback to novelUrl if not found
    } catch (e) {
        return novelUrl;
    }
});

ipcMain.on('open-epub', (event, filename) => {
    const filePath = path.join(outputDir, 'epubs', filename);
    shell.openPath(filePath); // Opens in Apple Books, Calibre, Sumatra, etc.
});

// ============ TRACK BROWSER VIEW STATE ============
let showBrowserWindow = false;

// ============ IPC: START / RESUME ============
ipcMain.on('start-browser-scrape', async (event, jobData) => {
    // 1. Safety Guard
    if (isScraping && currentJobId === jobData.job_id) {
        console.warn("⚠️ Already scraping this novel.");
        return;
    }

    scrapeCancelled = false;
    isScraping = true;
    currentJobId = jobData.job_id;

    enableCloudflareBypass = jobData.enable_cloudflare_bypass || false;
    showBrowserWindow = false;

    let startChapter = 1;
    let actualUrl = jobData.start_url; // Default to what React sent

    // 2. FETCH LATEST STATE FROM BACKEND
    try {
        const statusRes = await axios.get(`http://127.0.0.1:8000/api/status/${jobData.job_id}`);
        const historyRes = await axios.get(`http://127.0.0.1:8000/api/history`);

        // Update Chapter Count
        const match = statusRes.data.progress.match(/\d+/);
        startChapter = match ? parseInt(match[0]) + 1 : 1;

        // 🔥 THE BOOKMARK FIX: 
        // Get the latest saved 'start_url' from history (which is actually the NEXT chapter)
        const savedJob = historyRes.data[jobData.job_id];
        if (savedJob && savedJob.start_url) {
            actualUrl = savedJob.start_url;
            console.log(`📖 Bookmark found! Resuming from: ${actualUrl}`);
        }
    } catch (e) {
        console.log("Using default jobData (Engine might still be starting or job is new)");
    }

    event.sender.send('scrape-status', {
        status: 'STARTED',
        message: `🚀 ${startChapter > 1 ? 'Resuming' : 'Starting'}... (Cloudflare: ${enableCloudflareBypass ? 'ON' : 'OFF'})`
    });

    // 3. Kick off the recursive loop with the CORRECT url and chapter number
    await scrapeChapter(event, jobData, actualUrl, startChapter);
});

// ============ IPC: STOP ============
ipcMain.on('stop-scrape', async (event, jobData) => {
    console.log("🛑 STOP SIGNAL RECEIVED");

    // 1. Flip the switch (This kills the 'scrapeChapter' loop mid-flight)
    scrapeCancelled = true;
    isScraping = false;

    // 2. Immediate UI Feedback
    event.sender.send('scrape-status', {
        status: 'STOPPING',
        message: '⏹️ Stopping scraper...'
    });

    // 3. Tell the Python Backend to mark this job as "paused"
    try {
        await axios.post('http://127.0.0.1:8000/api/stop-scrape', {
            job_id: jobData.job_id,
            reason: 'user_requested'
        });

        event.sender.send('scrape-status', {
            status: 'PAUSED',
            message: '⏸️ Scraping paused - Bookmark saved.'
        });

        // Hide browser if it was open
        if (scraperWindow && !scraperWindow.isDestroyed()) {
            scraperWindow.webContents.stop();
            scraperWindow.hide();
        }
    } catch (err) {
        console.error("❌ Failed to notify Python of stop:", err.message);
        event.sender.send('scrape-status', {
            status: 'PAUSED',
            message: '⚠️ Paused (Backend sync failed, but scraper stopped)'
        });
    }
});


ipcMain.on('toggle-scraper-view', (event, shouldShow) => {
    const win = createScraperWindow();
    showBrowserWindow = shouldShow;  // 👈 Track user preference

    if (shouldShow) {
        if (!win.webContents.getURL() || win.webContents.getURL() === 'about:blank') {
            win.loadURL('about:blank');
        }
        win.show();
        win.focus();
    } else {
        // Don't hide if waiting for human interaction
        if (!waitingForHuman) {
            win.hide();
        }
    }
});

ipcMain.on('resume-scrape', async (event, jobData) => {
    try {
        // 1. Ask Python for the latest state of this job
        const response = await axios.get(`http://127.0.0.1:8000/api/status/${jobData.job_id}`);
        const statusData = response.data;

        // 2. Determine where to actually start
        const actualStartUrl = jobData.start_url;
        console.log(`▶️ Resuming ${jobData.novel_name} from ${actualStartUrl}`);

        // 3. Trigger the standard scraping logic
        // 👇 ADD/UPDATE THESE LINES TO RESET STATE
        scrapeCancelled = false;
        isScraping = true;
        currentJobId = jobData.job_id;
        enableCloudflareBypass = jobData.enable_cloudflare_bypass || false;

        // Pass the jobData to the existing scrape function
        await scrapeChapter(event, jobData, actualStartUrl, statusData.chapters_count + 1);

    } catch (err) {
        event.sender.send('scrape-status', { status: 'ERROR', message: 'Failed to resume: ' + err.message });
    }
});

ipcMain.on('open-output-folder', () => {
    shell.openPath(path.join(outputDir, 'epubs'));
});

// ============ APP LIFECYCLE ============

app.on('ready', () => {
    startPythonBackend();
    createWindow();

    setTimeout(() => {
        waitForEngine(mainWindow);
    }, 1000);
});

app.on('will-quit', () => {
    if (pythonProcess) {
        pythonProcess.kill();
    }
    if (scraperWindow && !scraperWindow.isDestroyed()) {
        scraperWindow.destroy();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});