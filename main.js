const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { execFile } = require('child_process');
const axios = require('axios');

let mainWindow = null;
let scraperWindow = null;
let pythonProcess = null;
let isScraping = false;
let currentJobId = null;
let scrapeCancelled = false;
let enableCloudflareBypass = false;
let waitingForHuman = false;  // 👈 NEW: Track if waiting for user

// ============ PYTHON BACKEND MANAGEMENT ============
function startPythonBackend() {
    const isDev = !app.isPackaged;
    const backendPath = isDev
        ? path.join(__dirname, 'frontend', 'resources', 'bin', 'scraper-engine')
        : path.join(process.resourcesPath, 'bin', 'scraper-engine');

    console.log("🔧 Engine path:", backendPath);

    if (process.platform === 'darwin') {
        require('child_process').execSync(`chmod +x "${backendPath}"`);
    }

    pythonProcess = execFile(backendPath, { windowsHide: true }, (err) => {
        if (err) {
            console.error("❌ Engine failed:", err);
            mainWindow?.webContents.send('python-error', err.message);
        }
    });

    pythonProcess.stdout?.on('data', (data) => {
        console.log(`🐍 Python: ${data}`);
    });

    pythonProcess.stderr?.on('data', (data) => {
        console.error(`🐍 Python Error: ${data}`);
    });
}

// ============ MAIN WINDOW ============
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        title: "Universal Novel Scraper",
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            devTools: false
        }
    });

    const startUrl = process.env.ELECTRON_START_URL ||
        `file://${path.join(__dirname, './frontend/dist/index.html')}`;
    mainWindow.loadURL(startUrl);

    if (process.env.DEBUG_DEVTOOLS === 'true') {
        mainWindow.webContents.openDevTools();
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
    if (scrapeCancelled) {
        event.sender.send('scrape-status', { 
            status: 'CANCELLED', 
            message: '⏹️ Scraping cancelled by user' 
        });
        isScraping = false;
        scraperWindow?.hide();
        return;
    }

    if (!scraperWindow || scraperWindow.isDestroyed()) {
        createScraperWindow();
    }
    
    event.sender.send('scrape-status', { 
        status: 'LOADING', 
        message: `Chapter ${chapterNum}: Loading...` 
    });

    try {
        // Load page
        await scraperWindow.loadURL(url);
        
        // 👉 RANDOM TIMEOUT: 1.5-4 sec for Cloudflare, 0-1 sec for normal
        const loadTimeout = enableCloudflareBypass 
            ? getRandomTimeout(1500, 4000)  
            : getRandomTimeout(0, 1000);
        
        console.log(`⏱️ Load timeout: ${loadTimeout}ms (Cloudflare: ${enableCloudflareBypass})`);
        
        await new Promise(resolve => {
            scraperWindow.webContents.once('did-finish-load', resolve);
            setTimeout(resolve, loadTimeout);
        });

        // Check for Cloudflare
        const hasCloudflare = await detectCloudflare(scraperWindow);
        
        if (hasCloudflare && enableCloudflareBypass) {
            event.sender.send('scrape-status', { 
                status: 'CLOUDFLARE', 
                message: '🛡️ Cloudflare detected - Showing browser for manual solve...' 
            });
            
            // Show the browser window so user can solve it
            scraperWindow.show();
            scraperWindow.focus();
            waitingForHuman = true;
            
            // Notify user via main window
            event.sender.send('human-action-needed', {
                message: '🛡️ Cloudflare Challenge Detected!',
                instruction: 'Please solve the challenge in the browser window, then scraping will continue automatically.'
            });
            
            // Wait for user to solve it
            const solved = await waitForCloudflareSolve(scraperWindow, jobData.job_id);
            
            waitingForHuman = false;
            
            if (!solved) {
                if (scrapeCancelled) {
                    return;
                }
                throw new Error('Cloudflare challenge timeout - please try again');
            }
            
            // Random wait after solve (1-3 sec)
            const postSolveWait = getRandomTimeout(1000, 3000);
            await new Promise(r => setTimeout(r, postSolveWait));
            
            // Hide window again if user didn't toggle "Watch Live"
            if (!showBrowserWindow) {
                scraperWindow.hide();
            }
        }

        // Extract content
        const pageData = await scraperWindow.webContents.executeJavaScript(`
            (() => {
                const title = document.querySelector('.chr-title, .chapter-title, h1, h2')?.innerText?.trim();
                const paragraphs = Array.from(document.querySelectorAll('#chr-content p, .chapter-content p, .reading-content p, #chapter-content p'))
                                       .map(p => p.innerText.trim())
                                       .filter(p => p.length > 0);
                const nextBtn = Array.from(document.querySelectorAll('a')).find(a => {
                    const text = (a.innerText || '').toLowerCase();
                    const id = (a.id || '').toLowerCase();
                    const cls = (a.className || '').toLowerCase();
                    return text.includes('next') || id.includes('next') || cls.includes('next');
                });
                const nextUrl = nextBtn?.href || null;
                return { title: title || 'Untitled', paragraphs, nextUrl };
            })()
        `);

        // Validate we got content
        if (!pageData.paragraphs || pageData.paragraphs.length === 0) {
            throw new Error('No content found on page');
        }

        // Send to Python
        await axios.post('http://127.0.0.1:8000/api/save-chapter', {
            job_id: jobData.job_id,
            novel_name: jobData.novel_name,
            chapter_title: pageData.title,
            content: pageData.paragraphs,
            start_url: url
        });

        event.sender.send('scrape-status', { 
            status: 'SAVED', 
            message: `✓ Chapter ${chapterNum}: ${pageData.title}` 
        });

        // Continue to next chapter
        if (pageData.nextUrl && pageData.nextUrl !== url) {
            // 👉 RANDOM DELAY BETWEEN CHAPTERS
            const delay = enableCloudflareBypass 
                ? getRandomTimeout(2000, 5000)   // 2-5 sec for Cloudflare sites
                : getRandomTimeout(500, 1500);   // 0.5-1.5 sec for normal sites
            
            console.log(`⏱️ Next chapter delay: ${delay}ms`);
            await new Promise(r => setTimeout(r, delay));
            await scrapeChapter(event, jobData, pageData.nextUrl, chapterNum + 1);
        } else {
            // Finalize EPUB
            event.sender.send('scrape-status', { 
                status: 'FINALIZING', 
                message: '📦 Creating EPUB...' 
            });

            await axios.post('http://127.0.0.1:8000/api/finalize-epub', {
                job_id: jobData.job_id,
                novel_name: jobData.novel_name,
                author: jobData.author,
                cover_data: jobData.cover_data
            });

            event.sender.send('scrape-status', { 
                status: 'COMPLETED', 
                message: '✅ EPUB Created Successfully!' 
            });

            isScraping = false;
            currentJobId = null;
            scraperWindow?.hide();
        }

    } catch (err) {
        console.error("Scrape error:", err);
        event.sender.send('scrape-status', { 
            status: 'ERROR', 
            message: `Chapter ${chapterNum}: ${err.message}` 
        });
        isScraping = false;
    }
}

// ============ TRACK BROWSER VIEW STATE ============
let showBrowserWindow = false;

// ============ IPC HANDLERS ============
ipcMain.on('start-browser-scrape', async (event, jobData) => {
    if (isScraping) {
        event.sender.send('scrape-status', {
            status: 'ERROR',
            message: 'Scraping already in progress'
        });
        return;
    }

    scrapeCancelled = false;
    enableCloudflareBypass = jobData.enable_cloudflare_bypass || false;
    showBrowserWindow = false;  // Reset on new scrape
    isScraping = true;
    currentJobId = jobData.job_id;

    event.sender.send('scrape-status', {
        status: 'STARTED',
        message: `🚀 Starting... (Cloudflare: ${enableCloudflareBypass ? 'ON' : 'OFF'})`
    });

    await scrapeChapter(event, jobData, jobData.start_url, 1);
});

ipcMain.on('stop-scrape', async (event, jobData) => {
    scrapeCancelled = true;
    currentJobId = jobData.job_id;

    event.sender.send('scrape-status', {
        status: 'STOPPING',
        message: '⏹️ Stopping scraper...'
    });

    try {
        await axios.post('http://127.0.0.1:8000/api/stop-scrape', {
            job_id: jobData.job_id,
            reason: 'user_requested'
        });

        event.sender.send('scrape-status', {
            status: 'PAUSED',
            message: '⏸️ Scraping paused - Click novel in library to resume'
        });

        isScraping = false;
        scraperWindow?.hide();
    } catch (err) {
        console.error("Failed to notify Python:", err);
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

// ============ APP LIFECYCLE ============
app.on('ready', () => {
    startPythonBackend();
    createWindow();
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