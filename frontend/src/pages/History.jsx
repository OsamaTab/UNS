import React, { useEffect } from 'react';
import { Download, Trash2, Clock, CheckCircle, Play, Terminal, BookOpen, AlertCircle, Archive } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function History({ library, fetchLibrary, setCurrentJobId, setIsScraping }) {
  const API_BASE = "http://127.0.0.1:8000/api";
  const novels = Object.entries(library).reverse();
  const navigate = useNavigate();

  useEffect(() => {
    fetchLibrary();
  }, [fetchLibrary]);

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this novel from history?")) return;
    try {
      await fetch(`${API_BASE}/novel/${id}`, { method: 'DELETE' });
      fetchLibrary();
    } catch (e) { console.error("Delete failed", e); }
  };

  const handleResume = (id, novel) => {
    setCurrentJobId(id);
    setIsScraping(true);
    window.electronAPI?.resumeScrape({
      job_id: id,
      novel_name: novel.novel_name,
      author: novel.author || "",
      start_url: novel.start_url || "",
      cover_data: novel.cover_data || ""
    });
    navigate('/download');
  };

  const handleEarlyFinalize = async (id, novel) => {
    const confirmed = window.confirm(
      "Create an EPUB with the currently downloaded chapters?\n\nThis will remove the ongoing download from your History, but the finished book will be saved to your Library."
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`${API_BASE}/early-finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: id,
          novel_name: novel.novel_name,
          author: novel.author || "",
          cover_data: novel.cover_data || ""
        })
      });

      if (!res.ok) throw new Error("Backend failed to process");
      fetchLibrary(); // Refresh the list

    } catch (e) {
      console.error(e);
      alert("Failed to create EPUB. Ensure you have scraped at least one chapter.");
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">Scrape History</h1>
          <p className="text-sm text-zinc-500">Terminal interface v2.0</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-full">
          <Terminal size={14} className="text-zinc-500" />
          <span className="text-xs font-medium text-zinc-400">{novels.length} Jobs Found</span>
        </div>
      </div>

      {/* List Container */}
      <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 overflow-hidden">

        {/* Table Headers */}
        <div className="grid grid-cols-12 gap-4 p-4 border-b border-zinc-800 bg-zinc-900/30">
          <div className="col-span-5 text-xs font-medium text-zinc-400 uppercase tracking-wider">Novel Info</div>
          <div className="col-span-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">Status</div>
          <div className="col-span-2 text-xs font-medium text-zinc-400 uppercase tracking-wider text-center">Chapters</div>
          <div className="col-span-2 text-xs font-medium text-zinc-400 uppercase tracking-wider text-right">Actions</div>
        </div>

        {/* List Items */}
        <div className="divide-y divide-zinc-800/50">
          {novels.length === 0 ? (
            <div className="p-16 text-center flex flex-col items-center justify-center">
              <Terminal size={32} className="text-zinc-700 mb-4" />
              <p className="text-zinc-500 text-sm">No history records found in output directory.</p>
            </div>
          ) : (
            novels.map(([id, novel]) => (
              <div key={id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-zinc-800/30 transition-colors group">

                {/* Info */}
                <div className="col-span-5 flex items-center gap-4">
                  <div className="w-10 h-10 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center justify-center text-zinc-600 group-hover:text-blue-500 transition-colors shrink-0 overflow-hidden relative">
                    {novel.cover_data ? (
                      <img
                        src={novel.cover_data}
                        alt="Cover"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <BookOpen size={18} className="relative z-10" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm text-white truncate">{novel.novel_name}</div>
                    <div className="text-xs text-zinc-500 truncate">{novel.author || 'Unknown Author'}</div>
                  </div>
                </div>

                {/* Status */}
                <div className="col-span-3">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${novel.status === 'completed'
                    ? 'bg-green-500/10 text-green-400 border-green-500/20'
                    : novel.status === 'paused'
                      ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                      : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                    }`}>
                    {novel.status === 'completed' ? <CheckCircle size={12} /> : novel.status === 'paused' ? <AlertCircle size={12} /> : <Clock size={12} />}
                    <span className="capitalize">{novel.status}</span>
                  </span>
                </div>

                {/* Chapters */}
                <div className="col-span-2 text-center">
                  <span className="text-sm font-mono text-zinc-400">
                    {novel.chapters_count || 0}
                  </span>
                </div>

                {/* Actions */}
                <div className="col-span-2 flex justify-end gap-2">
                  {novel.status !== 'completed' && (
                    <>
                      {/* 👇 NEW: Early Finalize Button */}
                      <button
                        onClick={() => handleEarlyFinalize(id, novel)}
                        className="p-2 bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500 text-purple-400 hover:text-white rounded-lg transition-all"
                        title="Finalize Early & Move to Library"
                      >
                        <Archive size={14} />
                      </button>

                      <button
                        onClick={() => handleResume(id, novel)}
                        className="p-2 bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500 text-blue-500 hover:text-white rounded-lg transition-all"
                        title="Resume Download"
                      >
                        <Play size={14} />
                      </button>
                    </>
                  )}

                  {novel.status === 'completed' && (
                    <a
                      href={`${API_BASE}/download/${id}`}
                      download
                      className="p-2 bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg transition-all"
                      title="Download EPUB"
                    >
                      <Download size={14} />
                    </a>
                  )}

                  <button
                    onClick={() => handleDelete(id)}
                    className="p-2 bg-red-500/5 border border-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                    title="Delete Job"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}