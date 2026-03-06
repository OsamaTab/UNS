const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { execFile } = require('child_process');
const axios = require('axios');
const fs = require('fs');

let mainWindow = null;
let scraperWindow = null;
let pythonProcess = null;
let isScraping = false;
let scrapeCancelled = false; // The Master Switch

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

// ============ MAIN WINDOW ============
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
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
    const html = await window.webContents.executeJavaScript('document.documentElement.innerHTML');

    const cloudflareIndicators = [
        'just a moment',
        'cloudflare',
        'security check',
        'checking your browser',
        'ddos protection',
        'verify you are human',
        'click to verify',
        'challenge'
    ];

    const isCloudflare = cloudflareIndicators.some(indicator =>
        title.toLowerCase().includes(indicator) ||
        url.toLowerCase().includes('cloudflare') ||
        html.toLowerCase().includes(indicator)
    );

    return isCloudflare;
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
        // If we have a 'start_url' saved in the job history, use that
        const actualStartUrl = jobData.start_url;

        console.log(`▶️ Resuming ${jobData.novel_name} from ${actualStartUrl}`);

        // 3. Trigger the standard scraping logic
        // Reset cancellation flags
        scrapeCancelled = false;
        isScraping = true;

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