import React, { useState, useEffect } from 'react';
import { BookOpen, FolderOpen, Plus, Book, Trash2, Download, Loader2 } from 'lucide-react';

export default function Library() {
  const [books, setBooks] = useState([]);
  const [isLoading, setIsLoading] = useState(true); // 👈 Track loading state
  const API_BASE = "http://127.0.0.1:8000/api";

  const fetchBooks = async (retryCount = 0) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/library`);
      if (res.ok) {
        const data = await res.json();
        setBooks(data);
        setIsLoading(false); // Success! Stop loading.
      } else {
        throw new Error("Server not ready");
      }
    } catch (e) {
      // If it fails and we haven't tried too many times, wait 1 second and try again
      if (retryCount < 5) {
        console.log(`Backend not ready, retrying... (${retryCount + 1}/5)`);
        setTimeout(() => fetchBooks(retryCount + 1), 1000);
      } else {
        console.error("Failed to fetch library after retries", e);
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchBooks();
  }, []);

  const handleAddEpub = async () => {
    if (window.electronAPI) {
      const added = await window.electronAPI.addEpubToLibrary();
      if (added) fetchBooks();
    }
  };

  const handleReadNow = (filename) => {
    if (window.electronAPI) {
      window.electronAPI.openEpub(filename);
    }
  };

  const handleDelete = async (filename) => {
    if (!window.confirm("Delete this EPUB from your library?")) return;
    try {
      await fetch(`${API_BASE}/library/${encodeURIComponent(filename)}`, { method: 'DELETE' });
      // Filter locally for instant UI feedback
      setBooks(prev => prev.filter(b => b.filename !== filename));
    } catch (e) {
      console.error("Failed to delete", e);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 animate-in fade-in duration-700">

      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-12">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-6 bg-blue-500 rounded-full" />
            <h1 className="text-3xl font-bold tracking-tight text-white">My Library</h1>
          </div>
          <p className="text-zinc-500 text-sm">Managing {books.length} offline titles</p>
        </div>

        <div className="flex gap-3 w-full md:w-auto">
          <button
            onClick={() => window.electronAPI?.openEpub('')}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-zinc-900/50 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 px-5 py-2.5 rounded-2xl text-sm font-semibold transition-all text-zinc-300"
          >
            <FolderOpen size={18} />
            Browse Files
          </button>
          <button
            onClick={handleAddEpub}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 px-5 py-2.5 rounded-2xl text-sm font-semibold transition-all text-white shadow-lg shadow-blue-600/20 active:scale-95"
          >
            <Plus size={18} />
            Import EPUB
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        // SKELETON LOADER GRID
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-8">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="space-y-3 animate-pulse">
              <div className="aspect-[2/3] bg-zinc-900 rounded-2xl border border-zinc-800" />
              <div className="h-4 bg-zinc-900 rounded w-3/4" />
              <div className="h-3 bg-zinc-900 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : books.length === 0 ? (
        // EMPTY STATE
        <div className="bg-zinc-900/20 rounded-[3rem] border border-dashed border-zinc-800 p-20 text-center flex flex-col items-center justify-center animate-in zoom-in-95 duration-500">
          <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center mb-6 shadow-inner">
            <Book size={40} className="text-zinc-700" />
          </div>
          <h3 className="text-xl font-bold text-zinc-300">Your collection is empty</h3>
          <p className="text-zinc-500 text-sm mt-2 max-w-xs leading-relaxed">
            Import your EPUB files or download new ones to start building your personal library.
          </p>
        </div>
      ) : (
        // BOOK GRID
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-6 gap-y-10">
          {books.map((book, i) => (
            <div key={i} className="group flex flex-col h-full animate-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="aspect-[2/3] bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden relative shadow-md group-hover:border-blue-500/50 transition-all duration-500 group-hover:-translate-y-2 group-hover:shadow-2xl group-hover:shadow-blue-500/10">

                {/* Hover Overlay: Dark Glassmorphism */}
                <div className="absolute inset-0 bg-zinc-950/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-between p-4 z-20">
                  <div className="flex justify-end gap-2 translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                    <a
                      href={`${API_BASE}/library/download/${encodeURIComponent(book.filename)}`}
                      download
                      onClick={(e) => e.stopPropagation()}
                      className="p-2.5 bg-zinc-900/80 hover:bg-blue-600 text-zinc-300 hover:text-white rounded-xl border border-white/5 transition-colors shadow-xl"
                      title="Export EPUB"
                    >
                      <Download size={18} />
                    </a>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(book.filename); }}
                      className="p-2.5 bg-zinc-900/80 hover:bg-red-600 text-zinc-300 hover:text-white rounded-xl border border-white/5 transition-colors shadow-xl"
                      title="Delete Book"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  <button
                    onClick={() => handleReadNow(book.filename)}
                    className="w-full bg-white text-black hover:bg-blue-500 hover:text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-2xl transition-all translate-y-4 group-hover:translate-y-0 duration-300"
                  >
                    Read Now
                  </button>
                </div>

                {/* Book Cover Container */}
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 p-4 text-center z-0">
                  <BookOpen size={48} strokeWidth={1.5} className="text-zinc-800 mb-2" />
                  <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-tighter">No Cover</span>

                  <img
                    src={`${API_BASE}/cover/${encodeURIComponent(book.filename)}`}
                    alt={book.title}
                    className="absolute inset-0 w-full h-full object-cover z-10 transition-transform duration-700 group-hover:scale-110"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                </div>
              </div>

              {/* Text Info */}
              <div className="mt-4 space-y-1 px-1">
                <h3 className="font-bold text-sm text-zinc-200 line-clamp-2 leading-tight group-hover:text-blue-400 transition-colors" title={book.title}>
                  {book.title}
                </h3>
                <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider line-clamp-1">
                  {book.author || 'Unknown Author'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}