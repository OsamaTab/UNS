import React, { useState, useEffect } from 'react';
import { BookOpen, FolderOpen, Plus, Book, Trash2, Download } from 'lucide-react';

export default function Library() {
  const [books, setBooks] = useState([]);
  const API_BASE = "http://127.0.0.1:8000/api";

  const fetchBooks = async () => {
    try {
      const res = await fetch(`${API_BASE}/library`);
      if (res.ok) {
        const data = await res.json();
        setBooks(data);
      }
    } catch (e) {
      console.error("Failed to fetch library", e);
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

  // 👇 NEW: Delete Function
  const handleDelete = async (filename) => {
    if (!window.confirm("Are you sure you want to delete this EPUB from your library?")) return;
    try {
      await fetch(`${API_BASE}/library/${encodeURIComponent(filename)}`, { method: 'DELETE' });
      fetchBooks();
    } catch (e) {
      console.error("Failed to delete", e);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">My Library</h1>
          <p className="text-sm text-zinc-500 mt-1">Your personal collection of offline novels.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => window.electronAPI?.openEpub('')} 
            className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 px-4 py-2 rounded-xl text-sm font-medium transition-colors text-zinc-300"
            title="Open EPUBS Folder"
          >
            <FolderOpen size={16} />
            Folder
          </button>
          <button 
            onClick={handleAddEpub}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-xl text-sm font-medium transition-colors text-white shadow-lg shadow-blue-600/20"
          >
            <Plus size={16} />
            Add EPUB
          </button>
        </div>
      </div>

      {books.length === 0 ? (
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-16 text-center flex flex-col items-center justify-center">
          <Book size={48} className="text-zinc-700 mb-4" />
          <p className="text-zinc-400 font-medium">Your library is empty.</p>
          <p className="text-zinc-600 text-sm mt-2 max-w-sm">
            Download a novel from the Download page, or import an existing EPUB file from your computer.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {books.map((book, i) => (
            <div key={i} className="group cursor-pointer flex flex-col h-full">
              <div 
                className="aspect-[2/3] bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden relative shadow-lg group-hover:border-zinc-600 transition-all group-hover:-translate-y-1 group-hover:shadow-2xl flex-shrink-0"
              >
                {/* 👇 NEW: Hover Overlay with Actions */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-4 z-20">
                  
                  {/* Top Action Bar */}
                  <div className="flex justify-end gap-2">
                    <a 
                      href={`${API_BASE}/library/download/${encodeURIComponent(book.filename)}`}
                      download
                      onClick={(e) => e.stopPropagation()}
                      className="p-2 bg-zinc-800/80 hover:bg-blue-500 text-zinc-300 hover:text-white rounded-lg backdrop-blur-sm transition-colors"
                      title="Export EPUB"
                    >
                      <Download size={16} />
                    </a>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDelete(book.filename); }}
                      className="p-2 bg-zinc-800/80 hover:bg-red-500 text-zinc-300 hover:text-white rounded-lg backdrop-blur-sm transition-colors"
                      title="Delete from Library"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {/* Bottom Action Button */}
                  <button 
                    onClick={() => handleReadNow(book.filename)}
                    className="w-full bg-blue-600 hover:bg-blue-500 py-2.5 rounded-xl text-sm font-bold shadow-lg transition-colors text-white"
                  >
                    Open Book
                  </button>
                </div>
                
                {/* Dynamic Book Cover */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-700 bg-zinc-900/50 p-4 text-center z-0">
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <BookOpen size={40} strokeWidth={1} className="mb-4 text-zinc-600" />
                    <span className="text-xs font-medium text-zinc-500 uppercase tracking-widest bg-zinc-900 px-2 py-1 rounded">EPUB</span>
                  </div>
                  
                  <img 
                    src={`${API_BASE}/cover/${encodeURIComponent(book.filename)}`} 
                    alt={book.title}
                    className="absolute inset-0 w-full h-full object-cover z-10"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                </div>
              </div>
              
              {/* Novel Info */}
              <div className="mt-3 flex-grow flex flex-col">
                <h3 className="font-semibold text-sm text-zinc-200 line-clamp-1 leading-snug" title={book.title}>
                  {book.title}
                </h3>
                {/* 👇 Displays the Author extracted from metadata */}
                <p className="text-xs text-zinc-500 line-clamp-1 mt-0.5" title={book.author}>
                  {book.author}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}