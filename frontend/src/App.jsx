import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [author, setAuthor] = useState('');
  const [coverFile, setCoverFile] = useState(null);
  const [coverData, setCoverData] = useState('');
  const [enableCloudflareBypass, setEnableCloudflareBypass] = useState(false);

  const [isScraping, setIsScraping] = useState(false);
  const [status, setStatus] = useState('Ready');
  const [progress, setProgress] = useState('0 chapters scraped');
  const [showBrowser, setShowBrowser] = useState(false);
  const [logs, setLogs] = useState([]);
  const [library, setLibrary] = useState({});
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [resumeConfirm, setResumeConfirm] = useState(null);
  const [currentJobId, setCurrentJobId] = useState(null);
  const [cloudflareAlert, setCloudflareAlert] = useState(null);  // 👈 NEW

  const API_BASE = "http://127.0.0.1:8000/api";

  const convertToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
    });
  };

  const fetchLibrary = async () => {
    try {
      const res = await fetch(`${API_BASE}/history`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setLibrary(data);
      setLibraryLoading(false);
    } catch (e) { 
      console.error("Library fetch failed", e); 
      setLibraryLoading(false);
    }
  };

  useEffect(() => {
    fetchLibrary();
    const interval = setInterval(fetchLibrary, 5000);
    return () => clearInterval(interval);
  }, []);

  // ============ LISTEN TO SCRAPE PROGRESS ============
  useEffect(() => {
    const handleStatus = (data) => {
      setStatus(data.status);
      setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${data.message}`]);
      
      if (data.status === 'COMPLETED') {
        setIsScraping(false);
        setProgress('Completed!');
        setCurrentJobId(null);
        setCloudflareAlert(null);  // Clear alert
        fetchLibrary();
      } else if (data.status === 'SAVED') {
        setProgress(prev => {
          const num = parseInt(prev.match(/\d+/)?.[0]) || 0;
          return `${num + 1} chapters scraped`;
        });
      } else if (data.status === 'PAUSED' || data.status === 'CANCELLED') {
        setIsScraping(false);
        setCurrentJobId(null);
        setCloudflareAlert(null);  // Clear alert
        fetchLibrary();
      } else if (data.status === 'CLOUDFLARE') {
        setCloudflareAlert({
          type: 'warning',
          message: data.message,
          instruction: 'The browser window has been shown. Please complete the challenge.'
        });
      }
    };

    const handleError = (error) => {
      setStatus('ERROR');
      setLogs(prev => [...prev, `[❌ ERROR] ${error}`]);
      setIsScraping(false);
      setCurrentJobId(null);
      setCloudflareAlert(null);
    };

    // 👈 NEW: Listen for human action needed
    const handleHumanAction = (data) => {
      setCloudflareAlert({
        type: 'action',
        message: data.message,
        instruction: data.instruction
      });
    };

    window.electronAPI?.onScrapeStatus(handleStatus);
    window.electronAPI?.onPythonError(handleError);
    window.electronAPI?.onHumanActionNeeded(handleHumanAction);  // 👈 NEW

    return () => {
      window.electronAPI?.removeStatusListener();
      window.electronAPI?.removeErrorListener();
      window.electronAPI?.removeHumanActionListener();
    };
  }, []);

  const startScraping = async () => {
    if (!url || !name) {
      alert('Please enter URL and Novel Name');
      return;
    }

    setIsScraping(true);
    setStatus('INITIALIZING');
    setProgress('0 chapters scraped');
    setLogs([]);
    setCloudflareAlert(null);

    let coverDataBase64 = '';
    if (coverFile) {
      coverDataBase64 = await convertToBase64(coverFile);
    }

    const jobData = {
      job_id: crypto.randomUUID(),
      start_url: url,
      novel_name: name,
      author: author || 'Unknown',
      cover_data: coverDataBase64,
      enable_cloudflare_bypass: enableCloudflareBypass
    };

    setCurrentJobId(jobData.job_id);
    window.electronAPI?.startScrape(jobData);
  };

  const stopScraping = async () => {
    if (!currentJobId) return;

    const jobData = {
      job_id: currentJobId,
      novel_name: name
    };

    window.electronAPI?.stopScrape(jobData);
  };

  const handleToggleBrowser = () => {
    const newState = !showBrowser;
    setShowBrowser(newState);
    window.electronAPI?.toggleScraper(newState);
  };

  const handleDeleteClick = (jobId, novelName) => {
    setDeleteConfirm({ jobId, novelName });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;

    try {
      const res = await fetch(`${API_BASE}/novel/${deleteConfirm.jobId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        const data = await res.json();
        setLogs(prev => [...prev, `[🗑️ DELETED] ${data.novel_name}`]);
        fetchLibrary();
      } else {
        const error = await res.json();
        alert(`Failed to delete: ${error.detail}`);
      }
    } catch (e) {
      console.error("Delete failed:", e);
      alert("Failed to delete novel");
    }

    setDeleteConfirm(null);
  };

  const cancelDelete = () => {
    setDeleteConfirm(null);
  };

  const handleResumeClick = (jobId, novelName, startUrl, author, coverData) => {
    setResumeConfirm({ jobId, novelName, startUrl, author, cover_data: coverData });
  };

  const confirmResume = async () => {
    if (!resumeConfirm) return;

    try {
      const res = await fetch(`${API_BASE}/resume-scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resumeConfirm)
      });

      if (res.ok) {
        const data = await res.json();
        setLogs(prev => [...prev, `[▶️ RESUMED] ${resumeConfirm.novelName} from chapter ${data.chapters_already_saved + 1}`]);
        
        setIsScraping(true);
        setStatus('RESUMING');
        setCurrentJobId(resumeConfirm.jobId);
        
        window.electronAPI?.startScrape({
          job_id: resumeConfirm.jobId,
          start_url: resumeConfirm.startUrl,
          novel_name: resumeConfirm.novelName,
          author: resumeConfirm.author,
          cover_data: resumeConfirm.cover_data
        });
        
        fetchLibrary();
      } else {
        const error = await res.json();
        alert(`Failed to resume: ${error.detail}`);
      }
    } catch (e) {
      console.error("Resume failed:", e);
      alert("Failed to resume scraping");
    }

    setResumeConfirm(null);
  };

  const cancelResume = () => {
    setResumeConfirm(null);
  };

  const handleLibraryClick = (jobId, novel) => {
    if (novel.status === 'completed') {
      return;
    }
    
    if (novel.status === 'paused' || novel.status === 'processing') {
      handleResumeClick(jobId, novel.novel_name, novel.start_url, novel.author, novel.cover_data);
    }
  };

  const dismissCloudflareAlert = () => {
    setCloudflareAlert(null);
  };

  return (
    <div className="app-layout">
      {/* Sidebar: Your Library */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>📖 My Library</h2>
          {Object.keys(library).length > 0 && (
            <span className="library-count">{Object.keys(library).length} novels</span>
          )}
        </div>
        <div className="library-list">
          {libraryLoading ? (
            <p className="empty-msg">⏳ Loading library...</p>
          ) : Object.keys(library).length === 0 ? (
            <p className="empty-msg">📚 No books yet - Start scraping!</p>
          ) : (
            Object.keys(library).reverse().map(id => (
              <div 
                key={id} 
                className={`library-card ${library[id].status} ${library[id].status === 'paused' ? 'clickable' : ''}`}
                onClick={() => handleLibraryClick(id, library[id])}
              >
                <div className="card-info">
                  <span className="card-title">{library[id].novel_name}</span>
                  <span className={`card-status status-${library[id].status}`}>
                    {library[id].status}
                    {library[id].status === 'paused' && ' - Click to Resume'}
                  </span>
                </div>
                <div className="card-actions">
                  {library[id].status === "completed" && (
                    <a 
                      href={`${API_BASE}/download/${id}`} 
                      className="mini-dl-btn"
                      download
                      title="Download EPUB"
                      onClick={(e) => e.stopPropagation()}
                    >
                      ⬇️
                    </a>
                  )}
                  {(library[id].status === "paused" || library[id].status === "processing") && (
                    <button 
                      className="mini-resume-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleResumeClick(id, library[id].novel_name, library[id].start_url, library[id].author, library[id].cover_data);
                      }}
                      title="Resume scraping"
                    >
                      ▶️
                    </button>
                  )}
                  <button 
                    className="mini-delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClick(id, library[id].novel_name);
                    }}
                    title="Delete from library"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={cancelDelete}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>🗑️ Delete Novel?</h3>
            <p>Are you sure you want to delete <strong>"{deleteConfirm.novelName}"</strong>?</p>
            <p className="modal-warning">⚠️ This will permanently remove the EPUB file and cannot be undone.</p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={cancelDelete}>Cancel</button>
              <button className="btn-delete" onClick={confirmDelete}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Resume Confirmation Modal */}
      {resumeConfirm && (
        <div className="modal-overlay" onClick={cancelResume}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>▶️ Resume Scraping?</h3>
            <p>Continue downloading <strong>"{resumeConfirm.novelName}"</strong>?</p>
            <p className="modal-info">📖 New chapters will be added to the existing EPUB.</p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={cancelResume}>Cancel</button>
              <button className="btn-resume" onClick={confirmResume}>Yes, Resume</button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content: Scraper UI */}
      <main className="main-content">
        <header className="top-nav">
          <h1>🌐 Universal Novel Scraper</h1>
          <div className={`status-badge ${isScraping ? 'active' : ''}`}>
            {isScraping ? "⚡ Scraping..." : "✓ Ready"}
          </div>
        </header>

        {/* 👉 CLOUDFLARE ALERT BANNER */}
        {cloudflareAlert && (
          <div className={`alert-banner alert-${cloudflareAlert.type}`}>
            <div className="alert-content">
              <span className="alert-icon">🛡️</span>
              <div className="alert-text">
                <strong>{cloudflareAlert.message}</strong>
                <p>{cloudflareAlert.instruction}</p>
              </div>
            </div>
            <button className="alert-dismiss" onClick={dismissCloudflareAlert}>
              ✕
            </button>
          </div>
        )}

        <section className="workspace">
          <div className="scraper-card">
            <h3>📥 Download New Novel</h3>
            <div className="input-grid">
              <div className="input-group">
                <label>Chapter 1 URL</label>
                <input 
                  type="text" 
                  value={url} 
                  onChange={(e) => setUrl(e.target.value)} 
                  placeholder="https://novelbin.com/book/..." 
                  disabled={isScraping}
                />
              </div>
              <div className="input-group">
                <label>Novel Name</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="e.g. Shadow Slave"
                  disabled={isScraping}
                />
              </div>
              <div className="input-group">
                <label>Author Name</label>
                <input 
                  type="text" 
                  value={author} 
                  onChange={(e) => setAuthor(e.target.value)} 
                  placeholder="Unknown"
                  disabled={isScraping}
                />
              </div>
              <div className="input-group">
                <label>Cover Image (Optional)</label>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={(e) => setCoverFile(e.target.files[0])}
                  disabled={isScraping}
                />
                {coverFile && (
                  <span className="file-hint">✓ {coverFile.name}</span>
                )}
              </div>
            </div>

            <div className="options-row">
              <label className="toggle-checkbox">
                <input 
                  type="checkbox" 
                  checked={enableCloudflareBypass} 
                  onChange={(e) => setEnableCloudflareBypass(e.target.checked)} 
                  disabled={isScraping}
                />
                <span className="toggle-slider"></span>
                <span className="toggle-label">
                  🛡️ Enable Cloudflare Bypass (shows browser for manual solve)
                </span>
              </label>
            </div>

            <div className="button-row">
              {!isScraping ? (
                <button className="primary-btn" onClick={startScraping}>
                  🚀 Start Scrape
                </button>
              ) : (
                <button className="stop-btn" onClick={stopScraping}>
                  ⏹️ Stop Scraping
                </button>
              )}
            </div>
            
            <p className="hint-text">
              💡 <strong>Cloudflare OFF:</strong> Faster (1-2 sec/chapter) - For normal sites<br/>
              ⚡ <strong>Cloudflare ON:</strong> Browser shows for challenges - For protected sites<br/>
              ⏸️ You can stop anytime and resume later from the library.
            </p>
          </div>

          {/* Progress Card */}
          {isScraping && (
            <div className="progress-card">
              <div className="progress-info">
                <h4>{status}</h4>
                <p>{progress}</p>
              </div>
              <div className="loader-bar">
                <div className="loader-fill"></div>
              </div>
            </div>
          )}

          {/* Log Viewer */}
          {logs.length > 0 && (
            <div className="log-viewer">
              <h4>📋 Scraping Log</h4>
              <div className="log-content">
                {logs.map((log, i) => (
                  <div key={i} className="log-line">{log}</div>
                ))}
              </div>
            </div>
          )}

          {/* Scraper Controls */}
          <div className="scraper-controls">
            <button
              className={`live-view-btn ${showBrowser ? 'active' : ''}`}
              onClick={handleToggleBrowser}
            >
              <span style={{ fontSize: '18px' }}>
                {showBrowser ? '⏹' : '📺'}
              </span>
              {showBrowser ? "Close Monitor" : "Watch Live"}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;