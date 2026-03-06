# 📖 Universal Novel Scraper
### Electron + React + Python Sidecar Architecture

A high-performance desktop application optimized for **macOS (M4 Apple Silicon)** designed to scrape web novels chapter-by-chapter and package them into professionally formatted **EPUB** files. 

By leveraging **Electron’s native Chromium** for scraping, the app naturally bypasses common bot-detection (like Cloudflare) while using a **Python FastAPI sidecar** as the "Architect" for file processing and EPUB generation.



## 🎯 Project Overview
The Universal Novel Scraper provides a seamless way to archive web literature. It moves away from heavy, detectable scraping frameworks (like Playwright or Botasaurus) in favor of a "Human-in-the-loop" approach where Electron manages the browsing session, and Python handles the complex data structuring required for E-book standards.

## 🏗️ Technical Architecture

The project uses a **Sidecar Pattern**, separating the UI/Browser from the heavy-duty file logic:

* **Frontend**: React (Vite) + Tailwind-style Dark Mode CSS.
* **Desktop Wrapper**: Electron (Main process manages the Python lifecycle and Browser navigation).
* **Backend (Sidecar)**: FastAPI engine bundled into a standalone binary via PyInstaller.
* **Scraping Strategy**: Uses Electron's native `BrowserWindow` (Chromium) to execute extraction scripts directly in the DOM.



---

## 📂 Project Structure

```plaintext
NOVEL-SCRAPER/
├── main.js                 # Electron Main Process (Window & Sidecar management)
├── preload.js              # Secure bridge (IPC) between React and Electron
├── package.json            # Scripts for electron-builder and dependencies
├── backend/
│   ├── api.py              # FastAPI Server (EPUB logic & Save-chapter endpoints)
│   ├── main.py             # EPUB Architect (ebooklib implementation)
│   └── jobs_history.json   # Persisted library data
└── frontend/
    ├── src/
    │   ├── App.jsx         # Modern Sidebar/Workspace UI
    │   └── main.jsx        # React Entry point
    └── resources/bin/      # Location of bundled 'scraper-engine' binary
🚀 Getting Started
```

## Prerequisites

Node.js (v18+)

Python 3.11+

M4 Mac Note: Ensure you have Command Line Tools installed (xcode-select --install).

## Installation

Clone the repository:

Bash
git clone [https://github.com/your-username/novel-scraper.git](https://github.com/your-username/novel-scraper.git)
cd novel-scraper
Install Frontend Dependencies:

Bash
npm install
Setup Python Backend:

Bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
🛠️ Building the Engine
To run the app as a standalone package, you must build the Python binary:

Generate Binary:

Bash
cd backend
python -m PyInstaller --noconfirm --onefile --windowed --name "scraper-engine" api.py
Move to Resources:
Move the generated dist/scraper-engine to frontend/resources/bin/.

## ⚙️ Key Logic & Configurations
1. Sidecar Management (main.js)

Electron is configured to launch the scraper-engine binary on startup and kill it on quit.

Dev Path: frontend/resources/bin/scraper-engine

Production Path: process.resourcesPath/bin/scraper-engine

2. The Native Scraper Flow

React sends jobData to Electron via window.electronAPI.startScrape.

Electron opens a BrowserWindow (can be hidden or visible for monitoring).

Electron waits for did-finish-load, then injects executeJavaScript to extract:

title, paragraphs (array), and nextUrl.

Electron sends this data to Python via axios.post('.../api/save-chapter').

Electron auto-navigates to nextUrl to repeat until the "Next" button is missing.

3. Python Backend (api.py)

Endpoint /api/save-chapter: Appends scraped text to a .jsonl progress file.

Endpoint /api/finalize: Once chapters are done, it triggers ebooklib to build the EPUB with full metadata (Title, Author, Cover Image).

## 🚧 Troubleshooting M4/Permission Issues
If the engine fails to start on macOS, ensure the binary has execution permissions. The app handles this automatically in main.js, but it can be done manually:

Bash
chmod +x ./frontend/resources/bin/scraper-engine
Note: If you encounter a ModuleNotFoundError after bundling, ensure you ran PyInstaller inside the active virtual environment where fastapi, uvicorn, and ebooklib are installed.

## 🛣️ Roadmap
[x] Migrate from Botasaurus to Electron Native Scraper.

[ ] Add "Log Viewer" tab in React to see real-time text extraction.

[ ] Implement Regex-based "Ad-Cleaner" to strip generic site text.

[ ] Multi-format support (PDF/Mobi).

## ⚖️ License

Copyright (c) 2026 Osama.

This project is licensed under the **Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)**. 

**Summary of Terms:**
- ✅ **Personal Use**: You are free to use, copy, and modify this for your own use.
- ✅ **Attribution**: You must give credit to the original author.
- ❌ **No Commercial Use**: You may NOT sell this software, use it for profit, or include it in any commercial service.

For commercial licensing or business inquiries, please reach out via GitHub.