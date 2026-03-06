import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navigation from './components/Navigation';
import Download from './pages/Download';
import Library from './pages/Library';
import Search from './pages/Search';
import History from './pages/History';

export default function App() {
  // Global Scraper State
  const [isScraping, setIsScraping] = useState(false);
  const [status, setStatus] = useState('Ready');
  const [progress, setProgress] = useState('0 chapters');
  const [currentJobId, setCurrentJobId] = useState(null);
  const [library, setLibrary] = useState({});

  const API_BASE = "http://127.0.0.1:8000/api";

  const fetchLibrary = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/history`);
      if (res.ok) {
        const data = await res.json();
        setLibrary(data);
      }
    } catch (e) {
      console.error("Failed to fetch library", e);
    }
  }, []);

  useEffect(() => {
    fetchLibrary();
    window.electronAPI?.onEngineReady(fetchLibrary);
    
    // Listen for global scrape updates
    const handleStatus = (data) => {
      setStatus(data.status);
      if (data.status === 'SAVED') {
        setProgress(prev => `${(parseInt(prev) || 0) + 1} chapters`);
      }
      if (['COMPLETED', 'PAUSED', 'CANCELLED'].includes(data.status)) {
        setIsScraping(false);
        fetchLibrary();
      }
    };

    window.electronAPI?.onScrapeStatus(handleStatus);
    return () => window.electronAPI?.removeStatusListener();
  }, [fetchLibrary]);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#0f0f12] text-white selection:bg-blue-500/30">
        <Navigation isScraping={isScraping} />
        <main className="max-w-6xl mx-auto px-6 py-8">
          <Routes>
            <Route path="/" element={<Navigate to="/download" />} />
            <Route path="/download" element={
              <Download 
                isScraping={isScraping} setIsScraping={setIsScraping}
                status={status} setStatus={setStatus}
                progress={progress} setProgress={setProgress}
                currentJobId={currentJobId} setCurrentJobId={setCurrentJobId}
              />
            } />
            <Route path="/library" element={<Library />} />
            <Route path="/search" element={<Search />} />
            <Route path="/history" element={<History library={library} fetchLibrary={fetchLibrary} />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}