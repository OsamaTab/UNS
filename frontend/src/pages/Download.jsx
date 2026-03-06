import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Shield, ExternalLink, Terminal, Loader2, BookOpen, Image as ImageIcon } from 'lucide-react';

export default function Download({
  isScraping, setIsScraping, status, setStatus,
  currentJobId, setCurrentJobId
}) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [author, setAuthor] = useState('');
  const [coverData, setCoverData] = useState('');
  const [coverFileName, setCoverFileName] = useState('');
  const [enableCloudflareBypass, setEnableCloudflareBypass] = useState(false);
  const [showBrowser, setShowBrowser] = useState(false);
  const [logs, setLogs] = useState([]);
  const [chaptersScraped, setChaptersScraped] = useState(0);
  const logEndRef = useRef(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  useEffect(() => {
    const handleLog = (data) => {
      const timestamp = new Date().toLocaleTimeString([], {
        hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
      setLogs(prev => [...prev, { time: timestamp, msg: data.message || data.status || "Update received" }]);

      // Update status
      if (data.status) setStatus(data.status);

      // Extract exact chapter count from the "Saved Chapter X:" log message
      if (data.message) {
        const savedMatch = data.message.match(/Saved Chapter (\d+)/i);
        if (savedMatch) {
          const count = parseInt(savedMatch[1]);
          if (!isNaN(count)) {
            setChaptersScraped(count);
          }
        }
      }
    };

    window.electronAPI?.onScrapeStatus(handleLog);
    return () => window.electronAPI?.removeStatusListener();
  }, [setStatus]);

  const handleCoverChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setCoverFileName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverData(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStart = () => {
    if (!url || !name) return;

    // Reset counters and logs
    setChaptersScraped(0);
    setLogs([{ time: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }), msg: 'Initializing engine...' }]);

    const jobId = crypto.randomUUID();
    setCurrentJobId(jobId);
    setIsScraping(true);

    // Pass everything to the electron backend
    window.electronAPI?.startScrape({
      job_id: jobId,
      start_url: url,
      novel_name: name,
      author: author,
      cover_data: coverData,
      enable_cloudflare_bypass: enableCloudflareBypass
    });
  };

  const handleStop = () => {
    setIsScraping(false);
    window.electronAPI?.stopScrape({ job_id: currentJobId });
  };

  return (
    <div className="max-w-6xl mx-auto px-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">Download Manager</h1>
          <p className="text-sm text-zinc-500">Terminal interface v2.0</p>
        </div>

        {isScraping && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 rounded-full">
            <Loader2 size={14} className="text-blue-400 animate-spin" />
            <span className="text-xs font-medium text-blue-400">Processing</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Input Panel */}
        <div className="col-span-2 space-y-6">
          <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-6">
            <div className="space-y-5">

              {/* URL Field */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                  First Chapter Source URL <span className="text-red-500 text-sm">*</span>
                </label>
                <input
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white placeholder-zinc-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
                  placeholder="https://..."
                  disabled={isScraping}
                />
              </div>

              {/* Title Field */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                  Novel Title <span className="text-red-500 text-sm">*</span>
                </label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white placeholder-zinc-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
                  placeholder="The Greatest Estate Developer"
                  disabled={isScraping}
                />
              </div>

              {/* Author & Cover Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Author <span className="text-zinc-600 normal-case tracking-normal ml-1">(Optional)</span>
                  </label>
                  <input
                    value={author}
                    onChange={e => setAuthor(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white placeholder-zinc-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
                    placeholder="Author Name"
                    disabled={isScraping}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Cover Image <span className="text-zinc-600 normal-case tracking-normal ml-1">(Optional)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCoverChange}
                      className="hidden"
                      id="cover-upload"
                      disabled={isScraping}
                    />
                    <label
                      htmlFor="cover-upload"
                      className={`flex items-center justify-center w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm transition ${isScraping
                          ? 'opacity-50 cursor-not-allowed text-zinc-600'
                          : 'text-zinc-400 hover:text-white hover:border-zinc-700 cursor-pointer'
                        }`}
                    >
                      <ImageIcon size={16} className="mr-2 shrink-0" />
                      <span className="truncate">{coverFileName || "Choose Image..."}</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Cloudflare Toggle */}
              <div className="pt-2">
                <button
                  onClick={() => !isScraping && setEnableCloudflareBypass(!enableCloudflareBypass)}
                  className={`flex items-center justify-between w-full p-4 rounded-lg border transition ${enableCloudflareBypass
                      ? 'bg-blue-500/10 border-blue-500/30'
                      : 'bg-zinc-900/50 border-zinc-800 hover:bg-zinc-900'
                    }`}
                  disabled={isScraping}
                >
                  <div className="flex items-center gap-3">
                    <Shield size={18} className={enableCloudflareBypass ? 'text-blue-400' : 'text-zinc-500'} />
                    <div className="text-left">
                      <p className="text-sm font-medium text-white">Cloudflare Bypass</p>
                      <p className="text-xs text-zinc-500">Enable anti-bot protection manually</p>
                    </div>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${enableCloudflareBypass ? 'bg-blue-500' : 'bg-zinc-700'
                    }`} />
                </button>
              </div>

              <button
                onClick={isScraping ? handleStop : handleStart}
                className={`w-full py-3 rounded-lg font-medium transition flex items-center justify-center gap-2 ${isScraping
                    ? 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20'
                    : 'bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed'
                  }`}
                disabled={(!url || !name) && !isScraping} // 👈 FIX: Only disable if we are NOT currently scraping
              >
                {isScraping ? (
                  <>
                    <Square size={16} />
                    <span>Abort Download</span>
                  </>
                ) : (
                  <>
                    <Play size={16} />
                    <span>Start Download</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Job Info */}
          <div className="bg-zinc-900/30 rounded-xl border border-zinc-800 p-4">
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Terminal size={14} />
              <span>Job ID: {currentJobId || 'Not started'}</span>
            </div>
          </div>
        </div>

        {/* Monitor Panel */}
        <div className="space-y-6">
          <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 h-137 flex flex-col">
            {/* Monitor Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Terminal size={16} className="text-zinc-500" />
                <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Console Output
                </span>
              </div>
              <button
                onClick={() => { setShowBrowser(!showBrowser); window.electronAPI?.toggleScraper(!showBrowser); }}
                className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-white transition"
                title="Toggle Live Scraper Window"
              >
                <ExternalLink size={14} />
              </button>
            </div>

            {/* Status & Chapter Counter */}
            <div className="p-4 border-b border-zinc-800 bg-zinc-900/30">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Status</p>
                  <p className="text-sm font-medium text-white">{status || 'Ready'}</p>
                </div>

                {/* Chapter Counter */}
                {isScraping && (
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs text-zinc-500 mb-1">Downloaded</p>
                      <div className="flex items-center gap-2">
                        <BookOpen size={14} className="text-blue-400" />
                        <span className="text-sm font-medium text-white">
                          {chaptersScraped} Chapters
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Activity Indicator */}
              {isScraping && (
                <div className="space-y-2">
                  <div className="h-1 bg-zinc-800 rounded-full overflow-hidden relative">
                    <div className="absolute top-0 bottom-0 left-0 w-1/3 bg-blue-500 rounded-full animate-pulse blur-[2px]" />
                    <div className="h-full bg-blue-500 w-full animate-[progress_2s_ease-in-out_infinite]" style={{
                      backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 1.5s infinite linear'
                    }} />
                  </div>
                </div>
              )}
            </div>

            {/* Logs */}
            <div className="flex-1 overflow-y-auto p-4 font-mono text-xs">
              <div className="space-y-2">
                {logs.length === 0 ? (
                  <p className="text-zinc-600 italic">No output yet...</p>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className="flex gap-3">
                      <span className="text-zinc-600 whitespace-nowrap">[{log.time}]</span>
                      <span className="text-zinc-300 break-all">{log.msg}</span>
                    </div>
                  ))
                )}
                <div ref={logEndRef} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}} />
    </div>
  );
}