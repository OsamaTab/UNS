import React, { useState, useEffect, useMemo } from 'react';
import { 
  BookOpen, FolderOpen, Plus, Book, Trash2, 
  Download, Search, ArrowUpDown, ChevronDown,
  Grid3X3, List, Calendar, User, Type, Star,
  X, Check, SortAsc, SortDesc
} from 'lucide-react';

export default function Library() {
  const [books, setBooks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("title"); 
  const [sortDirection, setSortDirection] = useState("asc");
  const [viewMode, setViewMode] = useState("grid"); // grid or list
  const [selectedBooks, setSelectedBooks] = useState([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const API_BASE = "http://127.0.0.1:8000/api";

  const fetchBooks = async (retryCount = 0) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/library`);
      if (res.ok) {
        const data = await res.json();
        setBooks(data);
        setIsLoading(false);
      } else {
        throw new Error("Server not ready");
      }
    } catch (e) {
      if (retryCount < 5) {
        setTimeout(() => fetchBooks(retryCount + 1), 1000);
      } else {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchBooks();
  }, []);

  // Fixed sorting logic
  const filteredAndSortedBooks = useMemo(() => {
    return books
      .filter(book => 
        book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (book.author && book.author.toLowerCase().includes(searchQuery.toLowerCase()))
      )
      .sort((a, b) => {
        let comparison = 0;
        
        if (sortBy === "title") {
          comparison = a.title.localeCompare(b.title);
        } else if (sortBy === "author") {
          const authorA = a.author || "";
          const authorB = b.author || "";
          comparison = authorA.localeCompare(authorB);
        } else if (sortBy === "newest") {
          // Assuming there's a date_added field, if not use filename as fallback
          comparison = (a.date_added || a.filename || "").localeCompare(b.date_added || b.filename || "");
        } else if (sortBy === "oldest") {
          comparison = (b.date_added || b.filename || "").localeCompare(a.date_added || a.filename || "");
        } else if (sortBy === "filesize") {
          comparison = (a.size || 0) - (b.size || 0);
        }
        
        return sortDirection === "asc" ? comparison : -comparison;
      });
  }, [books, searchQuery, sortBy, sortDirection]);

  const handleAddEpub = async () => {
    if (window.electronAPI) {
      const added = await window.electronAPI.addEpubToLibrary();
      if (added) fetchBooks();
    }
  };

  const handleReadNow = (filename) => {
    if (window.electronAPI) window.electronAPI.openEpub(filename);
  };

  const handleDelete = async (filename) => {
    if (!window.confirm("Delete this EPUB from your library?")) return;
    try {
      await fetch(`${API_BASE}/library/${encodeURIComponent(filename)}`, { method: 'DELETE' });
      setBooks(prev => prev.filter(b => b.filename !== filename));
      setSelectedBooks(prev => prev.filter(f => f !== filename));
    } catch (e) {
      console.error("Failed to delete", e);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedBooks.length === 0) return;
    if (!window.confirm(`Delete ${selectedBooks.length} EPUB${selectedBooks.length > 1 ? 's' : ''} from your library?`)) return;
    
    try {
      await Promise.all(selectedBooks.map(filename => 
        fetch(`${API_BASE}/library/${encodeURIComponent(filename)}`, { method: 'DELETE' })
      ));
      setBooks(prev => prev.filter(b => !selectedBooks.includes(b.filename)));
      setSelectedBooks([]);
      setIsSelectionMode(false);
    } catch (e) {
      console.error("Failed to delete books", e);
    }
  };

  const toggleBookSelection = (filename) => {
    setSelectedBooks(prev => 
      prev.includes(filename) 
        ? prev.filter(f => f !== filename)
        : [...prev, filename]
    );
  };

  const toggleSort = (newSortBy) => {
    if (sortBy === newSortBy) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortBy(newSortBy);
      setSortDirection("asc");
    }
  };

  const clearSelection = () => {
    setSelectedBooks([]);
    setIsSelectionMode(false);
  };

  // Stats
  const totalBooks = books.length;
  const filteredCount = filteredAndSortedBooks.length;
  const uniqueAuthors = new Set(books.map(b => b.author).filter(Boolean)).size;

  return (
    <div className="max-w-7xl mx-auto px-6 animate-in fade-in duration-700">
      {/* Header Section with Glass Effect */}
      <div className="relative mb-12">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-[3rem] blur-3xl -z-10" />
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-1 h-8 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full" />
              <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                My Library
              </h1>
            </div>
            
            {/* Stats Cards */}
            <div className="flex gap-4 text-sm">
              <div className="bg-zinc-900/40 backdrop-blur-sm border border-zinc-800 rounded-2xl px-4 py-2">
                <span className="text-zinc-500 mr-2">Total</span>
                <span className="text-white font-bold">{totalBooks}</span>
              </div>
              <div className="bg-zinc-900/40 backdrop-blur-sm border border-zinc-800 rounded-2xl px-4 py-2">
                <span className="text-zinc-500 mr-2">Authors</span>
                <span className="text-white font-bold">{uniqueAuthors}</span>
              </div>
              <div className="bg-zinc-900/40 backdrop-blur-sm border border-zinc-800 rounded-2xl px-4 py-2">
                <span className="text-zinc-500 mr-2">Showing</span>
                <span className="text-white font-bold">{filteredCount}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3 w-full md:w-auto">
            {isSelectionMode ? (
              <>
                <button
                  onClick={clearSelection}
                  className="flex items-center justify-center gap-2 bg-zinc-900/50 border border-zinc-800 hover:bg-zinc-800 px-5 py-2.5 rounded-2xl text-sm font-semibold transition-all text-zinc-300"
                >
                  <X size={18} />
                  Cancel ({selectedBooks.length})
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center justify-center gap-2 bg-red-600/20 border border-red-600/30 hover:bg-red-600 hover:text-white px-5 py-2.5 rounded-2xl text-sm font-semibold transition-all text-red-400"
                >
                  <Trash2 size={18} />
                  Delete
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => window.electronAPI?.openEpub('')}
                  className="flex items-center justify-center gap-2 bg-zinc-900/50 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 px-5 py-2.5 rounded-2xl text-sm font-semibold transition-all text-zinc-300"
                >
                  <FolderOpen size={18} />
                  Browse
                </button>
                <button
                  onClick={handleAddEpub}
                  className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 px-5 py-2.5 rounded-2xl text-sm font-semibold transition-all text-white shadow-lg shadow-blue-600/20 active:scale-95"
                >
                  <Plus size={18} />
                  Import EPUB
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Search, Sort, and View Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-10">
        {/* Search Bar */}
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-blue-400 transition-colors" size={18} />
          <input 
            type="text"
            placeholder="Search by title or author..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900/40 border border-zinc-800 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 rounded-2xl py-3 pl-12 pr-10 text-sm text-zinc-200 outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>
        
        {/* Sort Controls */}
        <div className="flex gap-2">
          <div className="relative group">
            <ArrowUpDown className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-hover:text-blue-400 transition-colors" size={16} />
            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="appearance-none bg-zinc-900/40 border border-zinc-800 focus:border-blue-500/50 rounded-2xl py-3 pl-10 pr-10 text-sm text-zinc-300 outline-none cursor-pointer hover:bg-zinc-800/60 transition-all w-full sm:w-44"
            >
              <option value="title">Title</option>
              <option value="author">Author</option>
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="filesize">File Size</option>
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" size={14} />
          </div>

          {/* Sort Direction Toggle */}
          <button
            onClick={() => setSortDirection(prev => prev === "asc" ? "desc" : "asc")}
            className="bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700 rounded-2xl px-4 py-3 text-zinc-400 hover:text-white transition-all"
            title={sortDirection === "asc" ? "Ascending" : "Descending"}
          >
            {sortDirection === "asc" ? <SortAsc size={16} /> : <SortDesc size={16} />}
          </button>

          {/* View Mode Toggle */}
          <div className="flex bg-zinc-900/40 border border-zinc-800 rounded-2xl p-1">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2.5 rounded-xl transition-all ${
                viewMode === "grid" 
                  ? "bg-blue-600 text-white" 
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Grid3X3 size={16} />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2.5 rounded-xl transition-all ${
                viewMode === "list" 
                  ? "bg-blue-600 text-white" 
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <List size={16} />
            </button>
          </div>

          {/* Selection Mode Toggle */}
          {!isSelectionMode && books.length > 0 && (
            <button
              onClick={() => setIsSelectionMode(true)}
              className="bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700 rounded-2xl px-4 py-3 text-zinc-400 hover:text-white transition-all"
              title="Select Multiple"
            >
              <Check size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className={`grid ${
          viewMode === "grid" 
            ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-8" 
            : "grid-cols-1 gap-4"
        }`}>
          {[...Array(10)].map((_, i) => (
            <div key={i} className="space-y-3 animate-pulse">
              <div className={`${viewMode === "grid" ? "aspect-[2/3]" : "h-24"} bg-zinc-900 rounded-2xl border border-zinc-800`} />
              {viewMode === "grid" && (
                <>
                  <div className="h-4 bg-zinc-900 rounded w-3/4" />
                  <div className="h-3 bg-zinc-900 rounded w-1/2" />
                </>
              )}
            </div>
          ))}
        </div>
      ) : filteredAndSortedBooks.length === 0 ? (
        <div className="bg-zinc-900/20 rounded-[3rem] border border-dashed border-zinc-800 p-20 text-center flex flex-col items-center justify-center animate-in zoom-in-95 duration-500">
          <div className="w-24 h-24 bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-3xl flex items-center justify-center mb-6 shadow-inner">
            <Book size={48} className="text-zinc-700" />
          </div>
          <h3 className="text-2xl font-bold text-zinc-300">
            {searchQuery ? "No matches found" : "Your collection is empty"}
          </h3>
          <p className="text-zinc-500 text-sm mt-3 max-w-md leading-relaxed">
            {searchQuery 
              ? "Try adjusting your search terms or clear the filter to see all books." 
              : "Import your EPUB files to start building your personal library."}
          </p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="mt-6 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-2xl text-sm font-semibold transition-all text-zinc-300 flex items-center gap-2"
            >
              <X size={16} />
              Clear Search
            </button>
          )}
        </div>
      ) : viewMode === "grid" ? (
        /* Grid View */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-6 gap-y-10">
          {filteredAndSortedBooks.map((book, i) => (
            <div 
              key={book.filename} 
              className={`group flex flex-col h-full animate-in slide-in-from-bottom-4 duration-500 ${
                isSelectionMode && selectedBooks.includes(book.filename) ? "ring-2 ring-blue-500 rounded-2xl" : ""
              }`}
              style={{ animationDelay: `${i * 30}ms` }}
              onClick={() => isSelectionMode && toggleBookSelection(book.filename)}
            >
              <div className="aspect-[2/3] bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden relative shadow-md group-hover:border-blue-500/50 transition-all duration-500 group-hover:-translate-y-2 group-hover:shadow-2xl group-hover:shadow-blue-500/10 cursor-pointer">
                
                {/* Selection Checkbox */}
                {isSelectionMode && (
                  <div className="absolute top-3 left-3 z-30">
                    <div className={`w-5 h-5 rounded border-2 transition-all ${
                      selectedBooks.includes(book.filename)
                        ? "bg-blue-500 border-blue-500"
                        : "bg-zinc-900/80 border-zinc-600"
                    }`}>
                      {selectedBooks.includes(book.filename) && (
                        <Check size={16} className="text-white" />
                      )}
                    </div>
                  </div>
                )}

                {/* Hover Overlay */}
                <div className={`absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/50 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-4 z-20 ${
                  isSelectionMode ? "pointer-events-none" : ""
                }`}>
                  <div className="flex justify-end gap-2 mb-2 translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
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

                {/* Cover Image */}
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

              {/* Book Info */}
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
      ) : (
        /* List View */
        <div className="space-y-3">
          {filteredAndSortedBooks.map((book, i) => (
            <div
              key={book.filename}
              className={`bg-zinc-900/30 border ${isSelectionMode && selectedBooks.includes(book.filename) ? 'border-blue-500' : 'border-zinc-800'} rounded-2xl p-4 hover:bg-zinc-900/50 transition-all group animate-in slide-in-from-bottom-4 duration-500`}
              style={{ animationDelay: `${i * 30}ms` }}
              onClick={() => isSelectionMode && toggleBookSelection(book.filename)}
            >
              <div className="flex items-center gap-4">
                {/* Selection Checkbox */}
                {isSelectionMode && (
                  <div className={`w-5 h-5 rounded border-2 transition-all ${
                    selectedBooks.includes(book.filename)
                      ? "bg-blue-500 border-blue-500"
                      : "border-zinc-600"
                  }`}>
                    {selectedBooks.includes(book.filename) && (
                      <Check size={16} className="text-white" />
                    )}
                  </div>
                )}

                {/* Cover Thumbnail */}
                <div className="w-12 h-16 bg-zinc-800 rounded-lg overflow-hidden relative flex-shrink-0">
                  <img
                    src={`${API_BASE}/cover/${encodeURIComponent(book.filename)}`}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                </div>

                {/* Book Details */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-zinc-200 truncate group-hover:text-blue-400 transition-colors">
                    {book.title}
                  </h3>
                  <p className="text-sm text-zinc-500 truncate">
                    {book.author || 'Unknown Author'}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleReadNow(book.filename)}
                    className="p-2 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white rounded-xl transition-all"
                    title="Read Now"
                  >
                    <BookOpen size={18} />
                  </button>
                  <a
                    href={`${API_BASE}/library/download/${encodeURIComponent(book.filename)}`}
                    download
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 bg-zinc-800 hover:bg-blue-600 text-zinc-400 hover:text-white rounded-xl transition-all"
                    title="Download"
                  >
                    <Download size={18} />
                  </a>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(book.filename); }}
                    className="p-2 bg-zinc-800 hover:bg-red-600 text-zinc-400 hover:text-white rounded-xl transition-all"
                    title="Delete"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}