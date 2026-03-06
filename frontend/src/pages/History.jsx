import React from 'react';
import { Download, Trash2, Clock, CheckCircle, FileText, ExternalLink } from 'lucide-react';

export default function History({ library, fetchLibrary }) {
  const API_BASE = "http://127.0.0.1:8000/api";
  const novels = Object.entries(library).reverse();

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this novel from history?")) return;
    try {
      await fetch(`${API_BASE}/novel/${id}`, { method: 'DELETE' });
      fetchLibrary();
    } catch (e) { console.error("Delete failed", e); }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Scrape History</h1>
          <p className="text-gray-400">Manage your past downloads and exports.</p>
        </div>
        <div className="bg-blue-600/10 text-blue-500 px-4 py-2 rounded-xl text-sm font-bold border border-blue-500/20">
          {novels.length} Total Items
        </div>
      </header>

      <div className="bg-[#1c1c21] rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white/5 text-gray-400 text-xs uppercase tracking-widest font-bold">
              <th className="px-6 py-4">Novel</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Chapters</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {novels.map(([id, novel]) => (
              <tr key={id} className="group hover:bg-white/[0.02] transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center text-gray-500 group-hover:text-blue-500 transition-colors">
                      <FileText size={20} />
                    </div>
                    <div>
                      <div className="font-bold text-sm">{novel.novel_name}</div>
                      <div className="text-xs text-gray-500 truncate max-w-[200px]">{novel.author}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                    novel.status === 'completed' 
                      ? 'bg-green-500/10 text-green-500' 
                      : 'bg-orange-500/10 text-orange-500'
                  }`}>
                    {novel.status === 'completed' ? <CheckCircle size={12} /> : <Clock size={12} />}
                    {novel.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm font-mono text-gray-400">
                  {novel.chapters_scraped || 0}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    {novel.status === 'completed' && (
                      <a 
                        href={`${API_BASE}/download/${id}`}
                        download
                        className="p-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
                        title="Download EPUB"
                      >
                        <Download size={16} />
                      </a>
                    )}
                    <button 
                      onClick={() => handleDelete(id)}
                      className="p-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {novels.length === 0 && (
          <div className="p-20 text-center text-gray-600">
            No history yet. Start a new download to see it here!
          </div>
        )}
      </div>
    </div>
  );
}