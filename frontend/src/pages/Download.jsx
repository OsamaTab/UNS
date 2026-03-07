import { useState, useEffect, useRef } from 'react';
import {
  Play, Square, Shield, ExternalLink, Terminal,
  Loader2, BookOpen, Image as ImageIcon, X, AlertCircle,
  CheckCircle, Clock, Link, User, FileText, ChevronDown,
  Settings, Zap, HelpCircle, Download as DownloadIcon,
  RefreshCw, Trash2, Save
} from 'lucide-react';
import { useLocation } from 'react-router-dom';

export default function Download({
  isScraping, setIsScraping, status, setStatus,
  currentJobId, setCurrentJobId
}) {
  const API_BASE = "http://127.0.0.1:8000/api";
  const location = useLocation();
  const prefill = location.state?.prefill || null;

  const [url, setUrl] = useState(prefill ? prefill.url : '');
  const [name, setName] = useState(prefill ? prefill.title : '');
  const [author, setAuthor] = useState('');
  const [coverData, setCoverData] = useState(prefill && prefill.cover ? prefill.cover : '');
  const [coverFileName, setCoverFileName] = useState(prefill && prefill.cover ? 'Cover from search' : '');
  const [coverPreview, setCoverPreview] = useState(prefill && prefill.cover ? prefill.cover : null);

  const [enableCloudflareBypass, setEnableCloudflareBypass] = useState(false);
  const [showBrowser, setShowBrowser] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [logs, setLogs] = useState([]);
  const [chaptersScraped, setChaptersScraped] = useState(0);
  const [totalChapters, setTotalChapters] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState('00:00');

  const logEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Timer for elapsed time
  useEffect(() => {
    let interval;
    if (isScraping && startTime) {
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const secs = (elapsed % 60).toString().padStart(2, '0');
        setElapsedTime(`${mins}:${secs}`);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isScraping, startTime]);

  // Handle logs from main process
  useEffect(() => {
    const handleLog = (data) => {
      const timestamp = new Date().toLocaleTimeString([], {
        hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'
      });

      setLogs(prev => [...prev, {
        time: timestamp,
        msg: data.message || data.status || "Update received",
        type: data.type || 'info'
      }]);

      if (data.status) setStatus(data.status);

      // Extract chapter counts
      if (data.message) {
        const savedMatch = data.message.match(/Saved Chapter (\d+)/i);
        if (savedMatch) {
          const count = parseInt(savedMatch[1]);
          if (!isNaN(count)) setChaptersScraped(count);
        }

        const totalMatch = data.message.match(/Total chapters: (\d+)/i);
        if (totalMatch) {
          setTotalChapters(parseInt(totalMatch[1]));
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
        setCoverPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearCover = () => {
    setCoverData('');
    setCoverFileName('');
    setCoverPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleStart = () => {
    if (!url || !name) return;

    setChaptersScraped(0);
    setTotalChapters(null);
    setStartTime(Date.now());
    setLogs([{
      time: new Date().toLocaleTimeString([], {
        hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'
      }),
      msg: '🚀 Initializing download engine...',
      type: 'success'
    }]);

    const jobId = crypto.randomUUID();
    setCurrentJobId(jobId);
    setIsScraping(true);

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
    setLogs(prev => [...prev, {
      time: new Date().toLocaleTimeString([], {
        hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'
      }),
      msg: '⛔ Download aborted by user',
      type: 'error'
    }]);
    window.electronAPI?.stopScrape({ job_id: currentJobId });
  };

  const clearLogs = () => {
    setLogs([]);
    setChaptersScraped(0);
    setTotalChapters(null);
    setStatus('');
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this novel from history?")) return;
    try {
      await fetch(`${API_BASE}/novel/${currentJobId}`, { method: 'DELETE' });
      handleStop()
      setTimeout(() => {
        clearLogs()
      }, 1000);
      setChaptersScraped(0);
      setTotalChapters(null);
      setStartTime(Date.now());
      setElapsedTime('00:00')
    } catch (e) { console.error("Delete failed", e); }
  };

  // Calculate progress percentage
  const progress = totalChapters && chaptersScraped > 0
    ? Math.min((chaptersScraped / totalChapters) * 100, 100)
    : isScraping ? null : 0;

  return (
    <div className="max-w-7xl mx-auto px-6 animate-in fade-in duration-700">
      {/* Header with Glass Effect */}
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-[2rem] blur-3xl -z-10" />

        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-1 h-8 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full" />
              <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                Download Manager
              </h1>
              {isScraping && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 rounded-full border border-blue-500/20">
                  <Loader2 size={14} className="text-blue-400 animate-spin" />
                  <span className="text-xs font-medium text-blue-400">Active Job</span>
                </div>
              )}
            </div>
            <p className="text-sm text-zinc-500 flex items-center gap-2">
              <Terminal size={14} />
              {currentJobId ? `Job ID: ${currentJobId.slice(0, 8)}...` : 'Ready for new download'}
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              className="p-2.5 bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 rounded-xl text-zinc-400 hover:text-white transition-all"
              title="Clear Console"
            >
              <Trash2 size={18} />
            </button>
            <button
              onClick={() => { setShowBrowser(!showBrowser); window.electronAPI?.toggleScraper(!showBrowser); }}
              className="p-2.5 bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 rounded-xl text-zinc-400 hover:text-white transition-all"
              title="Toggle Scraper Window"
            >
              <ExternalLink size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-8">
        {/* Left Panel - Input Form */}
        <div className="col-span-2 space-y-6">
          {/* Main Input Card */}
          <div className="bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 backdrop-blur-sm rounded-2xl border border-zinc-800/50 shadow-xl overflow-hidden">
            <div className="p-6 space-y-6">
              {/* Required Fields Section */}
              <div className="space-y-5">
                <div className="flex items-center gap-2 text-sm font-medium text-zinc-400">
                  <FileText size={16} className="text-blue-500" />
                  <span>Required Information</span>
                </div>

                {/* URL Field */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                    <Link size={12} />
                    First Chapter URL <span className="text-red-500">*</span>
                  </label>
                  <div className="relative group">
                    <input
                      value={url}
                      onChange={e => setUrl(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3.5 pl-11 text-sm text-white placeholder-zinc-600 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                      placeholder="https://example.com/novel/chapter-1"
                      disabled={isScraping}
                    />
                    <Link size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-blue-400 transition-colors" />
                  </div>
                </div>

                {/* Title Field */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                    <BookOpen size={12} />
                    Novel Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3.5 text-sm text-white placeholder-zinc-600 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 outline-none transition"
                    placeholder="The Greatest Estate Developer"
                    disabled={isScraping}
                  />
                </div>
              </div>

              {/* Optional Fields Grid */}
              <div className="space-y-5">
                <div className="flex items-center gap-2 text-sm font-medium text-zinc-400">
                  <Settings size={16} className="text-zinc-500" />
                  <span>Optional Details</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Author Field */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                      <User size={12} className="inline mr-1" />
                      Author
                    </label>
                    <input
                      value={author}
                      onChange={e => setAuthor(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 outline-none transition"
                      placeholder="Author Name"
                      disabled={isScraping}
                    />
                  </div>

                  {/* Cover Upload */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                      <ImageIcon size={12} className="inline mr-1" />
                      Cover Image
                    </label>

                    {coverPreview ? (
                      <div className="relative group/cover">
                        <img
                          src={coverPreview}
                          alt="Cover preview"
                          className="w-full h-20 object-cover rounded-xl border border-zinc-700"
                        />
                        <button
                          onClick={clearCover}
                          className="absolute top-2 right-2 p-1 bg-black/60 hover:bg-red-600 rounded-lg opacity-0 group-hover/cover:opacity-100 transition-all"
                        >
                          <X size={14} />
                        </button>
                        <span className="absolute bottom-2 left-2 text-[10px] bg-black/60 px-2 py-1 rounded text-zinc-300">
                          {coverFileName}
                        </span>
                      </div>
                    ) : (
                      <div className="relative">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleCoverChange}
                          className="hidden"
                          id="cover-upload"
                          disabled={isScraping}
                        />
                        <label
                          htmlFor="cover-upload"
                          className={`flex items-center justify-center w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm transition-all cursor-pointer group ${isScraping ? 'opacity-50 cursor-not-allowed' : 'hover:border-zinc-700 hover:bg-zinc-900'
                            }`}
                        >
                          <ImageIcon size={16} className="mr-2 text-zinc-500 group-hover:text-blue-400 transition-colors" />
                          <span className="text-zinc-400 group-hover:text-zinc-300 truncate">
                            Choose Image...
                          </span>
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Advanced Options Toggle */}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center justify-between w-full p-4 bg-zinc-950/50 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <Shield size={18} className="text-zinc-500 group-hover:text-blue-400 transition-colors" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-white">Advanced Options</p>
                    <p className="text-xs text-zinc-500">Cloudflare bypass and proxy settings</p>
                  </div>
                </div>
                <ChevronDown size={18} className={`text-zinc-500 transition-transform duration-300 ${showAdvanced ? 'rotate-180' : ''}`} />
              </button>

              {/* Advanced Options Panel */}
              {showAdvanced && (
                <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                  <button
                    onClick={() => !isScraping && setEnableCloudflareBypass(!enableCloudflareBypass)}
                    className={`flex items-center justify-between w-full p-4 rounded-xl border-2 transition-all ${enableCloudflareBypass
                      ? 'bg-blue-500/10 border-blue-500/30'
                      : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'
                      }`}
                    disabled={isScraping}
                  >
                    <div className="flex items-center gap-3">
                      <Zap size={18} className={enableCloudflareBypass ? 'text-blue-400' : 'text-zinc-500'} />
                      <div className="text-left">
                        <p className="text-sm font-medium text-white">Cloudflare Bypass</p>
                        <p className="text-xs text-zinc-500">Enable anti-bot protection handling</p>
                      </div>
                    </div>
                    <div className={`w-3 h-3 rounded-full ${enableCloudflareBypass ? 'bg-blue-500 animate-pulse' : 'bg-zinc-700'}`} />
                  </button>

                  <div className="p-4 bg-zinc-950/30 rounded-xl border border-zinc-800">
                    <div className="flex items-start gap-3">
                      <HelpCircle size={16} className="text-zinc-600 mt-0.5" />
                      <p className="text-xs text-zinc-600 leading-relaxed">
                        Cloudflare bypass may slow down the download process. Only enable if you encounter anti-bot pages.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="p-6 bg-gradient-to-t from-zinc-950 to-transparent border-t border-zinc-800">
              <button
                onClick={isScraping ? handleStop : handleStart}
                className={`w-full py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-3 text-base ${isScraping
                  ? 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 hover:text-red-300'
                  : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-lg shadow-blue-600/20 active:scale-[0.98]'
                  } ${(!url || !name) && !isScraping ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={(!url || !name) && !isScraping}
              >
                {isScraping ? (
                  <>
                    <Square size={18} />
                    <span>Abort Download</span>
                  </>
                ) : (
                  <>
                    <DownloadIcon size={18} />
                    <span>Start Download</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel - Console & Stats */}
        <div className="col-span-1 space-y-6">
          {/* Stats Card */}
          <div className="bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 backdrop-blur-sm rounded-2xl border border-zinc-800/50 shadow-xl overflow-hidden">
            <div className="p-5 border-b border-zinc-800">
              <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <Activity size={16} className="text-blue-500" />
                Download Statistics
              </h3>
            </div>

            <div className="p-5 space-y-4">
              {/* Status & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-zinc-500">Status</p>
                  <div className="flex items-center gap-2">
                    {isScraping ? (
                      <>
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-sm font-medium text-green-400">Active</span>
                      </>
                    ) : (
                      <>
                        <div className="w-2 h-2 bg-zinc-600 rounded-full" />
                        <span className="text-sm font-medium text-zinc-400">Idle</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-zinc-500">Elapsed</p>
                  <p className="text-sm font-medium text-white font-mono">{elapsedTime}</p>
                </div>
              </div>

              {/* Progress Bar */}
              {isScraping && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-500">Progress</span>
                    <span className="text-blue-400 font-mono">
                      {chaptersScraped}{totalChapters ? ` / ${totalChapters}` : ''}
                    </span>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300"
                      style={{ width: progress ? `${progress}%` : '0%' }}
                    />
                  </div>
                </div>
              )}

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="bg-zinc-950/50 rounded-xl p-3 border border-zinc-800">
                  <BookOpen size={16} className="text-blue-500 mb-2" />
                  <p className="text-xs text-zinc-500">Chapters</p>
                  <p className="text-lg font-bold text-white">{chaptersScraped}</p>
                </div>
                <div className="bg-zinc-950/50 rounded-xl p-3 border border-zinc-800">
                  <Clock size={16} className="text-purple-500 mb-2" />
                  <p className="text-xs text-zinc-500">Speed</p>
                  <p className="text-lg font-bold text-white">
                    {chaptersScraped > 0 && elapsedTime !== '00:00'
                      ? `${(chaptersScraped / (parseInt(elapsedTime.split(':')[0]) * 60 + parseInt(elapsedTime.split(':')[1]))).toFixed(1)}/s`
                      : '0/s'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Console Card */}
          <div className="bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 backdrop-blur-sm rounded-2xl border border-zinc-800/50 shadow-xl overflow-hidden h-[400px] flex flex-col">
            <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <Terminal size={16} className="text-blue-500" />
                Console Output
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-600">{logs.length} events</span>
                {logs.length > 0 && (
                  <button
                    onClick={clearLogs}
                    className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors"
                    title="Clear console"
                  >
                    <Trash2 size={14} className="text-zinc-500" />
                  </button>
                )}
              </div>
            </div>

            {/* Logs Area */}
            <div className="flex-1 overflow-y-auto p-4 font-mono text-xs bg-zinc-950/50">
              <div className="space-y-2">
                {logs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-center">
                    <Terminal size={24} className="text-zinc-800 mb-2" />
                    <p className="text-zinc-700 text-xs">No output yet...</p>
                    <p className="text-zinc-800 text-[10px] mt-1">Start a download to see logs</p>
                  </div>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className="flex gap-3 group hover:bg-zinc-900/50 p-1 rounded transition-colors">
                      <span className="text-zinc-700 whitespace-nowrap text-[10px]">[{log.time}]</span>
                      <span className={`break-all text-[11px] ${log.type === 'error' ? 'text-red-400' :
                        log.type === 'success' ? 'text-green-400' :
                          log.msg.includes('Saved') ? 'text-blue-400' :
                            'text-zinc-400'
                        }`}>
                        {log.msg}
                      </span>
                    </div>
                  ))
                )}
                <div ref={logEndRef} />
              </div>
            </div>

            {/* Console Footer */}
            <div className="p-3 border-t border-zinc-800 bg-zinc-950/30">
              <div className="flex items-center gap-2 text-[10px] text-zinc-700">
                <div className={`w-1.5 h-1.5 rounded-full ${isScraping ? 'bg-green-500 animate-pulse' : 'bg-zinc-700'}`} />
                <span>{isScraping ? 'Active' : 'Idle'}</span>
                {currentJobId && (
                  <>
                    <span className="text-zinc-800">•</span>
                    <span className="font-mono">Job: {currentJobId.slice(0, 6)}...</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Quick Tips */}
          <div className="bg-zinc-900/30 rounded-xl border border-zinc-800 p-4">
            <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <HelpCircle size={12} />
              Quick Tips
            </h4>
            <ul className="space-y-2 text-xs text-zinc-500">
              <li className="flex items-start gap-2">
                <div className="w-1 h-1 bg-blue-500 rounded-full mt-1.5" />
                <span>URL should point to the first chapter of the novel</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1 h-1 bg-blue-500 rounded-full mt-1.5" />
                <span>Title is required and will be used for the filename</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1 h-1 bg-blue-500 rounded-full mt-1.5" />
                <span>Cover image can be uploaded or auto-fetched from search</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  );
}

// Missing Activity icon import
function Activity(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}