import React, { useState, useEffect, useMemo } from 'react';
import { 
  Download, Trash2, Clock, CheckCircle, Play, Terminal, 
  BookOpen, AlertCircle, Archive, Search, X, 
  ArrowUpDown, Calendar, Book, User, Filter,
  ChevronDown, Layers, HardDrive, RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function History({ library, fetchLibrary, setCurrentJobId, setIsScraping }) {
  const API_BASE = "http://127.0.0.1:8000/api";
  const navigate = useNavigate();

  // State for search and sort
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date'); // date, title, author, chapters
  const [sortDirection, setSortDirection] = useState('desc'); // desc = newest first
  const [statusFilter, setStatusFilter] = useState('all'); // all, active, completed, paused
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchLibrary();
  }, [fetchLibrary]);

  // Transform library object into array with proper format
  const novelsArray = useMemo(() => {
    return Object.entries(library || {}).map(([id, novel]) => ({
      id,
      ...novel,
      // Ensure we have proper counts
      chapters_count: novel.chapters_count || 0,
      // Format date for display
      date: novel.created_at || novel.updated_at || new Date().toISOString()
    }));
  }, [library]);

  // Filter and sort novels
  const filteredAndSortedNovels = useMemo(() => {
    let filtered = [...novelsArray];

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(novel => novel.status === statusFilter);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(novel => 
        novel.novel_name?.toLowerCase().includes(query) ||
        novel.author?.toLowerCase().includes(query) ||
        novel.id?.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'title':
          comparison = (a.novel_name || '').localeCompare(b.novel_name || '');
          break;
        case 'author':
          comparison = (a.author || '').localeCompare(b.author || '');
          break;
        case 'chapters':
          comparison = (a.chapters_count || 0) - (b.chapters_count || 0);
          break;
        case 'status':
          comparison = (a.status || '').localeCompare(b.status || '');
          break;
        case 'date':
        default:
          comparison = new Date(a.date || 0) - new Date(b.date || 0);
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [novelsArray, searchQuery, sortBy, sortDirection, statusFilter]);

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
      fetchLibrary();
    } catch (e) {
      console.error(e);
      alert("Failed to create EPUB. Ensure you have scraped at least one chapter.");
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchLibrary();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setSortBy('date');
    setSortDirection('desc');
  };

  const toggleSort = (newSortBy) => {
    if (sortBy === newSortBy) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortDirection('desc');
    }
  };

  // Stats
  const totalNovels = novelsArray.length;
  const activeCount = novelsArray.filter(n => n.status === 'active' || n.status === 'paused').length;
  const completedCount = novelsArray.filter(n => n.status === 'completed').length;
  const filteredCount = filteredAndSortedNovels.length;

  // Status color mapping
  const statusConfig = {
    completed: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20', icon: CheckCircle },
    active: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20', icon: Clock },
    paused: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20', icon: AlertCircle }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 animate-in fade-in duration-500">
      {/* Header with Glass Effect */}
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-[2rem] blur-3xl -z-10" />
        
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-1 h-8 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full" />
              <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                Scrape History
              </h1>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/50 border border-zinc-800 rounded-full">
                <Terminal size={14} className="text-zinc-500" />
                <span className="text-xs font-medium text-zinc-400">{totalNovels} Jobs</span>
              </div>
            </div>
            
            {/* Stats Cards */}
            <div className="flex gap-3 text-sm mt-3">
              <div className="bg-zinc-900/40 backdrop-blur-sm border border-zinc-800 rounded-xl px-4 py-2">
                <span className="text-zinc-500 mr-2">Total</span>
                <span className="text-white font-bold">{totalNovels}</span>
              </div>
              <div className="bg-zinc-900/40 backdrop-blur-sm border border-zinc-800 rounded-xl px-4 py-2">
                <span className="text-zinc-500 mr-2">Active</span>
                <span className="text-blue-400 font-bold">{activeCount}</span>
              </div>
              <div className="bg-zinc-900/40 backdrop-blur-sm border border-zinc-800 rounded-xl px-4 py-2">
                <span className="text-zinc-500 mr-2">Completed</span>
                <span className="text-green-400 font-bold">{completedCount}</span>
              </div>
              {filteredCount !== totalNovels && (
                <div className="bg-zinc-900/40 backdrop-blur-sm border border-zinc-800 rounded-xl px-4 py-2">
                  <span className="text-zinc-500 mr-2">Showing</span>
                  <span className="text-purple-400 font-bold">{filteredCount}</span>
                </div>
              )}
            </div>
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            className="p-2.5 bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 rounded-xl text-zinc-400 hover:text-white transition-all"
            disabled={isRefreshing}
          >
            <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="mb-6 space-y-4">
        {/* Search Row */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-blue-400 transition-colors" size={18} />
            <input 
              type="text"
              placeholder="Search by title, author, or job ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900/40 border border-zinc-800 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 rounded-xl py-3 pl-12 pr-10 text-sm text-zinc-200 outline-none transition-all"
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

          {/* Filter Chips */}
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-zinc-900/40 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-300 outline-none cursor-pointer hover:bg-zinc-800/60 transition-all"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
            </select>

            {/* Sort Indicators */}
            <div className="flex bg-zinc-900/40 border border-zinc-800 rounded-xl p-1">
              <button
                onClick={() => toggleSort('date')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                  sortBy === 'date' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-zinc-400 hover:text-zinc-300'
                }`}
              >
                <Calendar size={14} />
                Date
                {sortBy === 'date' && (
                  <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </button>
              <button
                onClick={() => toggleSort('title')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                  sortBy === 'title' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-zinc-400 hover:text-zinc-300'
                }`}
              >
                <Book size={14} />
                Title
                {sortBy === 'title' && (
                  <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Active Filters Display */}
        {(searchQuery || statusFilter !== 'all') && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-zinc-500">Active filters:</span>
            {searchQuery && (
              <span className="px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400 flex items-center gap-1">
                <Search size={12} />
                "{searchQuery}"
              </span>
            )}
            {statusFilter !== 'all' && (
              <span className="px-2 py-1 bg-purple-500/10 border border-purple-500/20 rounded-lg text-purple-400 flex items-center gap-1 capitalize">
                <Filter size={12} />
                {statusFilter}
              </span>
            )}
            <button
              onClick={clearFilters}
              className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-colors"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Main Table */}
      <div className="bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 backdrop-blur-sm rounded-2xl border border-zinc-800/50 shadow-xl overflow-hidden">
        {/* Table Headers */}
        <div className="grid grid-cols-12 gap-4 p-5 border-b border-zinc-800 bg-zinc-950/50">
          <div className="col-span-5 text-xs font-medium text-zinc-400 uppercase tracking-wider flex items-center gap-1">
            <BookOpen size={14} className="text-blue-500" />
            Novel Info
          </div>
          <div className="col-span-2 text-xs font-medium text-zinc-400 uppercase tracking-wider flex items-center gap-1">
            <Layers size={14} className="text-purple-500" />
            Status
          </div>
          <div className="col-span-2 text-xs font-medium text-zinc-400 uppercase tracking-wider text-center flex items-center gap-1 justify-center">
            <HardDrive size={14} className="text-green-500" />
            Chapters
          </div>
          <div className="col-span-3 text-xs font-medium text-zinc-400 uppercase tracking-wider text-right">
            Actions
          </div>
        </div>

        {/* List Items */}
        <div className="divide-y divide-zinc-800/50">
          {filteredAndSortedNovels.length === 0 ? (
            <div className="p-16 text-center flex flex-col items-center justify-center">
              <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center mb-4">
                <Terminal size={40} className="text-zinc-700" />
              </div>
              <p className="text-zinc-500 text-lg mb-2">No history records found</p>
              <p className="text-zinc-700 text-sm max-w-md">
                {searchQuery || statusFilter !== 'all' 
                  ? "Try adjusting your filters to see more results."
                  : "Start downloading novels to see your scrape history here."}
              </p>
              {(searchQuery || statusFilter !== 'all') && (
                <button
                  onClick={clearFilters}
                  className="mt-6 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm font-medium transition-all text-zinc-300 flex items-center gap-2"
                >
                  <X size={16} />
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            filteredAndSortedNovels.map((novel, index) => {
              const status = novel.status || 'unknown';
              const config = statusConfig[status] || statusConfig.paused;
              const StatusIcon = config.icon;
              
              return (
                <div 
                  key={novel.id} 
                  className="grid grid-cols-12 gap-4 p-5 items-center hover:bg-zinc-800/30 transition-all group relative"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* Novel Info */}
                  <div className="col-span-5 flex items-center gap-4">
                    <div className="w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center text-zinc-600 group-hover:text-blue-500 transition-colors shrink-0 overflow-hidden relative shadow-lg">
                      {novel.cover_data ? (
                        <img
                          src={novel.cover_data}
                          alt="Cover"
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                      ) : (
                        <BookOpen size={20} className="relative z-10" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-white truncate group-hover:text-blue-400 transition-colors">
                        {novel.novel_name || 'Untitled Novel'}
                      </div>
                      <div className="flex items-center gap-2 text-xs mt-1">
                        <span className="text-zinc-500 flex items-center gap-1">
                          <User size={10} />
                          {novel.author || 'Unknown Author'}
                        </span>
                        <span className="text-zinc-700">•</span>
                        <span className="text-zinc-600 font-mono text-[10px]">
                          ID: {novel.id.slice(0, 8)}...
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="col-span-2">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${config.bg} ${config.text} ${config.border}`}>
                      <StatusIcon size={12} />
                      <span className="capitalize">{status}</span>
                    </span>
                  </div>

                  {/* Chapters */}
                  <div className="col-span-2 text-center">
                    <div className="inline-flex items-center gap-2 bg-zinc-950/50 px-4 py-1.5 rounded-lg border border-zinc-800">
                      <Book size={12} className="text-zinc-500" />
                      <span className="text-sm font-mono text-zinc-300 font-bold">
                        {novel.chapters_count || 0}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="col-span-3 flex justify-end gap-2">
                    {status !== 'completed' && (
                      <>
                        <button
                          onClick={() => handleEarlyFinalize(novel.id, novel)}
                          className="p-2.5 bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500 text-purple-400 hover:text-white rounded-xl transition-all"
                          title="Finalize Early & Move to Library"
                        >
                          <Archive size={16} />
                        </button>

                        <button
                          onClick={() => handleResume(novel.id, novel)}
                          className="p-2.5 bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500 text-blue-400 hover:text-white rounded-xl transition-all"
                          title="Resume Download"
                        >
                          <Play size={16} />
                        </button>
                      </>
                    )}

                    {status === 'completed' && (
                      <a
                        href={`${API_BASE}/download/${novel.id}`}
                        download
                        className="p-2.5 bg-green-500/10 border border-green-500/20 hover:bg-green-500 text-green-400 hover:text-white rounded-xl transition-all"
                        title="Download EPUB"
                      >
                        <Download size={16} />
                      </a>
                    )}

                    <button
                      onClick={() => handleDelete(novel.id)}
                      className="p-2.5 bg-red-500/5 border border-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-all opacity-60 group-hover:opacity-100"
                      title="Delete Job"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {/* Progress indicator for active jobs */}
                  {status === 'active' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 animate-pulse" />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer with summary */}
        {filteredAndSortedNovels.length > 0 && (
          <div className="p-4 border-t border-zinc-800 bg-zinc-950/30 flex justify-between items-center text-xs text-zinc-600">
            <div className="flex items-center gap-4">
              <span>Showing {filteredAndSortedNovels.length} of {totalNovels} jobs</span>
              <span className="flex items-center gap-1">
                <HardDrive size={12} />
                Total chapters: {filteredAndSortedNovels.reduce((acc, n) => acc + (n.chapters_count || 0), 0)}
              </span>
            </div>
            <div className="flex gap-3">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                Active: {filteredAndSortedNovels.filter(n => n.status === 'active').length}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                Completed: {filteredAndSortedNovels.filter(n => n.status === 'completed').length}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}