import React, { useState, useEffect } from 'react';
import { Search as SearchIcon, Globe, ArrowRight, Loader2, BookOpen, Download, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ACTIVE_PROVIDERS = [
  { id: 'novelbin', name: 'NovelBin', desc: 'Browse top trending novels.' },
  { id: 'fanmtl', name: 'FanMTL', desc: 'Read the latest machine translations.' },
];

export default function Search({ query, setQuery, hasSearched, setHasSearched, sourceStates, setSourceStates }) {
  const [selectedNovel, setSelectedNovel] = useState(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [activeTab, setActiveTab] = useState('description');
  const [chapterList, setChapterList] = useState([]);

  const navigate = useNavigate();

  const handleSearch = async (e) => {
    if (e.key === 'Enter') {
      const trimmedQuery = query.trim();
      if (!trimmedQuery) {
        setHasSearched(false);
        return;
      }

      setHasSearched(true);

      // 1. Initialize states using our global list
      const initialStates = {};
      ACTIVE_PROVIDERS.forEach(provider => {
        initialStates[provider.id] = { status: 'loading', data: [] };
      });
      setSourceStates(initialStates);

      // 2. Run searches
      for (const provider of ACTIVE_PROVIDERS) {
        try {
          const data = await window.electronAPI.searchNovel({
            sourceId: provider.id,
            query: trimmedQuery
          });

          setSourceStates(prev => ({
            ...prev,
            [provider.id]: {
              status: data && data.length > 0 ? 'success' : 'not_found',
              data: data || []
            }
          }));
        } catch (err) {
          setSourceStates(prev => ({
            ...prev,
            [provider.id]: { status: 'error', data: [] }
          }));
        }
      }
    }
  };

  const handleViewDetails = async (novel) => {
    setSelectedNovel(novel);
    setIsLoadingDetails(true);
    setActiveTab('description');
    setChapterList([]);

    try {
      const details = await window.electronAPI.getNovelDetails(novel.url);
      setSelectedNovel(prev => ({ ...prev, ...details }));
      setChapterList(details.allChapters || []);
    } catch (err) {
      console.error("Error fetching details:", err);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Inside Search.jsx

  const exploreSource = async (provider) => {
    // Update UI immediately
    setQuery(provider.name);
    setHasSearched(true);

    // Clear other sources and show a single loading section for the clicked source
    setSourceStates({
      [provider.id]: { status: 'loading', data: [] }
    });

    try {
      // We call the same API but pass isPopular: true
      const data = await window.electronAPI.searchNovel({
        sourceId: provider.id,
        isPopular: true
      });

      setSourceStates({
        [provider.id]: {
          status: data && data.length > 0 ? 'success' : 'not_found',
          data: data || []
        }
      });
    } catch (err) {
      console.error(`Explore failed for ${provider.name}:`, err);
      setSourceStates({
        [provider.id]: { status: 'error', data: [] }
      });
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-6xl mx-auto pb-20">

      {/* Header & Search Bar */}
      <div className="max-w-2xl mx-auto text-center space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Discover Novels</h1>
          <p className="text-sm text-zinc-400">Find your next story across all integrated sources.</p>
        </div>

        <div className="relative group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <SearchIcon className="text-zinc-500 group-focus-within:text-blue-500 transition-colors" size={20} />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => {
              const val = e.target.value;
              setQuery(val);

              // If the user clears the input, reset the search view
              if (val.trim() === '') {
                setHasSearched(false);
                setSourceStates({}); // Optional: clear the previous results too
              }
            }}
            onKeyDown={handleSearch}
            placeholder="Search by title... (Press Enter)"
            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-white outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-xl"
          />
        </div>
      </div>

      {/* VIEW: Source Results */}
      {hasSearched && (
        <div className="space-y-12">
          {Object.entries(sourceStates).map(([sourceId, state]) => (
            <div key={sourceId} className="space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <h2 className="text-xl font-bold text-white flex items-center gap-2 capitalize">
                  <Globe size={18} className="text-blue-500" />
                  {sourceId}
                </h2>

                {state.status === 'loading' && (
                  <div className="flex items-center gap-2 text-zinc-500 text-xs">
                    <Loader2 size={14} className="animate-spin text-blue-500" />
                    Searching...
                  </div>
                )}
                {state.status === 'success' && (
                  <span className="text-xs text-zinc-500">{state.data.length} results</span>
                )}
              </div>

              {/* Status Handlers */}
              {state.status === 'loading' && (
                <div className="flex gap-4 overflow-hidden py-4">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="min-w-40 h-60 bg-zinc-900/50 rounded-xl animate-pulse border border-zinc-800" />
                  ))}
                </div>
              )}

              {state.status === 'not_found' && (
                <div className="py-10 bg-zinc-900/20 border border-dashed border-zinc-800 rounded-2xl flex flex-col items-center justify-center text-zinc-500">
                  <BookOpen size={24} className="mb-2 opacity-20" />
                  <p className="text-sm italic">No novels found on {sourceId}</p>
                </div>
              )}

              {state.status === 'error' && (
                <div className="py-10 bg-red-500/5 border border-red-500/20 rounded-2xl flex flex-col items-center justify-center text-red-400">
                  <AlertCircle size={24} className="mb-2" />
                  <p className="text-sm">Source failed to respond</p>
                </div>
              )}

              {/* Horizontal Scroll for Success */}
              {state.status === 'success' && (
                <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-hide snap-x">
                  {state.data.map((novel, idx) => (
                    <div
                      key={idx}
                      className="min-w-40 max-w-40 group snap-start cursor-pointer"
                      onClick={() => handleViewDetails(novel)}
                    >
                      <div className="aspect-2/3 bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden relative shadow-lg group-hover:border-blue-500/50 transition-all">
                        {novel.cover ? (
                          <img src={novel.cover} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-700"><BookOpen /></div>
                        )}
                        {novel.chapters && (
                          <div className="absolute bottom-2 left-2 right-2 bg-black/80 backdrop-blur-md px-2 py-1 rounded text-[10px] font-bold text-blue-400 border border-white/5">
                            {novel.chapters}
                          </div>
                        )}
                      </div>
                      <h3 className="mt-2 text-sm font-medium text-zinc-300 line-clamp-2 group-hover:text-blue-400 transition-colors">
                        {novel.title}
                      </h3>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* VIEW: Default Suggestions */}
      {!hasSearched && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
          {ACTIVE_PROVIDERS.map((provider) => (
            <div
              key={provider.id}
              onClick={() => exploreSource(provider)} // 👈 THE TRIGGER
              className="bg-zinc-900/40 p-8 rounded-[2rem] border border-zinc-800/50 hover:border-blue-500/30 hover:bg-zinc-900/60 transition-all cursor-pointer group relative overflow-hidden shadow-xl"
            >
              {/* Subtle Background Glow */}
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/5 blur-3xl group-hover:bg-blue-500/10 transition-all" />

              <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-400 mb-6 group-hover:scale-110 group-hover:bg-blue-500/20 transition-all duration-500">
                <Globe size={28} />
              </div>

              <h3 className="font-bold text-xl text-white mb-2">{provider.name}</h3>
              <p className="text-sm text-zinc-500 mb-6 leading-relaxed">{provider.desc}</p>

              <div className="flex items-center text-blue-400 text-sm font-bold gap-2 group-hover:translate-x-1 transition-transform">
                Explore Latest <ArrowRight size={16} />
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedNovel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-10 bg-black/90 backdrop-blur-md animate-in fade-in duration-500">
          <div className="bg-zinc-950 border border-zinc-800 w-full max-w-5xl rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col md:flex-row h-full max-h-[85vh] relative">

            {/* 1. Left Section: Sticky Cover Image */}
            <div className="w-full md:w-80 h-64 md:h-auto bg-zinc-900 relative shrink-0">
              <img src={selectedNovel.cover} className="w-full h-full object-cover" alt="" />
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent md:bg-gradient-to-r" />

              {/* Mobile Close Button */}
              <button
                onClick={() => setSelectedNovel(null)}
                className="absolute top-6 left-6 bg-black/50 backdrop-blur-md p-2 rounded-full text-white hover:bg-zinc-800 transition-all md:hidden z-50"
              >
                ✕
              </button>
            </div>

            {/* 2. Right Section: Content */}
            <div className="flex-1 flex flex-col min-w-0 bg-zinc-950">

              {/* Header (Fixed at top) */}
              <div className="p-8 pb-4 space-y-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1">
                    <h2 className="text-3xl font-bold text-white tracking-tight leading-tight line-clamp-2">
                      {selectedNovel.title}
                    </h2>
                    <div className="flex items-center gap-4">
                      <p className="text-blue-400 font-medium">{selectedNovel.author || 'Fetching Author...'}</p>
                      {/* 👇 THE GLOBE BUTTON */}
                      <button
                        onClick={() => window.electronAPI.openExternal(selectedNovel.url)}
                        className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 hover:text-blue-400 transition-colors uppercase tracking-widest"
                        title="Open in Browser"
                      >
                        <Globe size={12} />
                        View Source
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedNovel(null)}
                    className="hidden md:flex text-zinc-500 hover:text-white transition-colors p-2 hover:bg-zinc-900 rounded-full"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="text-[10px] font-black text-zinc-400 px-2 py-1 bg-zinc-900 rounded border border-white/5 uppercase tracking-tighter">
                    {selectedNovel.source}
                  </span>
                  <span className="text-[10px] font-black text-blue-400 px-2 py-1 bg-blue-500/10 rounded border border-blue-500/20 uppercase">
                    {selectedNovel.lastChapter || 'Loading Status...'}
                  </span>
                </div>
              </div>

              {/* Tab Navigation */}
              <div className="px-8 flex gap-8 border-b border-zinc-900">
                {['description', 'chapters'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`pb-4 text-sm font-bold transition-all relative ${activeTab === tab ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    {activeTab === tab && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full animate-in slide-in-from-left-2" />
                    )}
                  </button>
                ))}
              </div>

              {/* Scrollable Body Content */}
              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {activeTab === 'description' ? (
                  <div className="space-y-4 animate-in fade-in duration-500">
                    <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Synopsis</h4>
                    {isLoadingDetails ? (
                      <div className="space-y-3">
                        <div className="h-3 bg-zinc-900 rounded w-full animate-pulse"></div>
                        <div className="h-3 bg-zinc-900 rounded w-5/6 animate-pulse"></div>
                        <div className="h-3 bg-zinc-900 rounded w-4/6 animate-pulse"></div>
                      </div>
                    ) : (
                      <p className="text-zinc-400 text-sm leading-relaxed whitespace-pre-line">
                        {selectedNovel.description || "No description found for this title."}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 animate-in slide-in-from-bottom-4 duration-500">
                    {isLoadingDetails ? (
                      <div className="flex flex-col items-center justify-center py-20 text-zinc-600 gap-3">
                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs">Indexing Chapters...</span>
                      </div>
                    ) : chapterList.length > 0 ? (
                      chapterList.map((ch, i) => (
                        <div
                          key={i}
                          className="flex justify-between items-center p-4 rounded-2xl bg-zinc-900/30 border border-zinc-900 hover:border-zinc-700 hover:bg-zinc-900/60 transition-all group"
                        >
                          <div className="flex flex-col">
                            <span className="text-xs text-zinc-500 font-mono mb-0.5">Chapter {i + 1}</span>
                            <span className="text-sm text-zinc-200 font-medium line-clamp-1">{ch.title}</span>
                          </div>
                          <button
                            onClick={() => navigate('/download', { state: { prefill: { ...selectedNovel, url: ch.url } } })}
                            className="opacity-0 group-hover:opacity-100 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all"
                          >
                            SELECT
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-20 text-zinc-600 italic">No chapter index found.</div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Footer (Always Visible) */}
              <div className="p-8 pt-4 bg-gradient-to-t from-zinc-950 to-transparent">
                <button
                  onClick={() => navigate('/download', { state: { prefill: { ...selectedNovel, url: selectedNovel.firstChapterUrl } } })}
                  disabled={isLoadingDetails}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-900 disabled:text-zinc-600 text-white font-bold py-4 rounded-2xl transition-all shadow-xl shadow-blue-600/10 flex items-center justify-center gap-3 group"
                >
                  {isLoadingDetails ? (
                    <div className="w-5 h-5 border-2 border-zinc-600 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <><Download size={18} className="group-hover:translate-y-0.5 transition-transform" /> Start New Download</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}