import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Search as SearchIcon, 
  Globe, 
  ArrowRight, 
  Loader2, 
  BookOpen, 
  Download, 
  AlertCircle,
  X,
  ChevronRight,
  Sparkles,
  Clock,
  Filter,
  Grid3X3,
  List,
  ChevronDown,
  Eye,
  Star,
  TrendingUp,
  Calendar
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ACTIVE_PROVIDERS = [
  { id: 'allnovel', name: 'AllNovel', desc: 'A massive library of popular web novels.', icon: '📚', color: 'from-emerald-500 to-teal-500' },
  { id: 'freewebnovel', name: 'FreeWebNovel', desc: 'Read trending novels for free.', icon: '🆓', color: 'from-blue-500 to-cyan-500' },
  { id: 'hiraethtranslation', name: 'HiraethTranslation', desc: 'High-quality fan translations.', icon: '✨', color: 'from-purple-500 to-pink-500' },
  { id: 'libread', name: 'LibRead', desc: 'Extensive collection of completed works.', icon: '📖', color: 'from-amber-500 to-orange-500' },
  { id: 'novelbin', name: 'NovelBin', desc: 'Browse top trending novels.', icon: '🗑️', color: 'from-red-500 to-rose-500' },
  { id: 'novelfull', name: 'NovelFull', desc: 'Fast updates and a wide variety of genres.', icon: '📱', color: 'from-indigo-500 to-blue-500' },
  { id: 'pawread', name: 'PawRead', desc: 'Exclusive translations and daily updates.', icon: '🐾', color: 'from-amber-500 to-yellow-500' },
  { id: 'readfromnet', name: 'ReadFrom.Net', desc: 'E-book style reading experience.', icon: '📱', color: 'from-violet-500 to-purple-500' },
  { id: 'royalroad', name: 'Royal Road', desc: 'The home of original web fiction and LitRPG.', icon: '👑', color: 'from-yellow-500 to-amber-500' },
];

export default function Search({ query, setQuery, hasSearched, setHasSearched, sourceStates, setSourceStates }) {
  const [selectedNovel, setSelectedNovel] = useState(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [activeTab, setActiveTab] = useState('description');
  const [chapterList, setChapterList] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [hoveredNovel, setHoveredNovel] = useState(null);
  
  // New state to track which sources are expanded to show all results
  const [expandedSources, setExpandedSources] = useState({});
  
  const searchInputRef = useRef(null);
  const navigate = useNavigate();

  // Auto-focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const toggleSource = (sourceId) => {
    setExpandedSources(prev => ({
      ...prev,
      [sourceId]: !prev[sourceId]
    }));
  };

  // Handle search function - ONLY called on Enter
  const performSearch = useCallback(async () => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setHasSearched(false);
      return;
    }

    console.log('Performing search for:', trimmedQuery);
    setHasSearched(true);
    setIsSearching(true);
    setExpandedSources({}); // Reset expansions on new search

    // Initialize all providers as loading
    const initialStates = {};
    ACTIVE_PROVIDERS.forEach(provider => {
      initialStates[provider.id] = { status: 'loading', data: [] };
    });
    setSourceStates(initialStates);

    // Search each provider sequentially
    for (const provider of ACTIVE_PROVIDERS) {
      try {
        console.log(`Searching ${provider.id}...`);
        const data = await window.electronAPI.searchNovel({
          sourceId: provider.id,
          query: trimmedQuery
        });
        
        console.log(`${provider.id} returned:`, data?.length || 0, 'results');

        setSourceStates(prev => ({
          ...prev,
          [provider.id]: {
            status: data && data.length > 0 ? 'success' : 'not_found',
            data: data || []
          }
        }));
      } catch (err) {
        console.error(`Search failed for ${provider.id}:`, err);
        setSourceStates(prev => ({
          ...prev,
          [provider.id]: { status: 'error', data: [] }
        }));
      }
    }

    setIsSearching(false);
  }, [query, setHasSearched, setSourceStates]);

  // Handle Enter key press
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      performSearch();
    }
  };

  // Handle input change - ONLY update the query state, NO search
  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    
    // If the user clears the input, reset the search view
    if (val.trim() === '') {
      setHasSearched(false);
      setSourceStates({});
      setExpandedSources({});
    }
  };

  const handleViewDetails = async (novel) => {
    console.log('Viewing details for:', novel.title);
    setSelectedNovel(novel);
    setIsLoadingDetails(true);
    setActiveTab('description');
    setChapterList([]);

    try {
      const details = await window.electronAPI.getNovelDetails(novel.url);
      console.log('Details received:', details);
      setSelectedNovel(prev => ({ ...prev, ...details }));
      setChapterList(details.allChapters || []);
    } catch (err) {
      console.error("Error fetching details:", err);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const exploreSource = async (provider) => {
    console.log('Exploring source:', provider.id);
    setSelectedProvider(provider);
    setQuery(provider.name);
    setHasSearched(true);
    setExpandedSources({});

    setSourceStates({
      [provider.id]: { status: 'loading', data: [] }
    });

    try {
      const data = await window.electronAPI.searchNovel({
        sourceId: provider.id,
        isPopular: true
      });

      console.log(`${provider.id} popular returned:`, data?.length || 0, 'results');

      setSourceStates({
        [provider.id]: {
          status: data?.length > 0 ? 'success' : 'not_found',
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

  const clearSearch = () => {
    setQuery('');
    setHasSearched(false);
    setSourceStates({});
    setSelectedProvider(null);
    setExpandedSources({});
    searchInputRef.current?.focus();
  };

  // Calculate search stats
  const searchStats = {
    total: Object.values(sourceStates).length,
    success: Object.values(sourceStates).filter(s => s.status === 'success').length,
    loading: Object.values(sourceStates).filter(s => s.status === 'loading').length,
    error: Object.values(sourceStates).filter(s => s.status === 'error').length,
    notFound: Object.values(sourceStates).filter(s => s.status === 'not_found').length,
  };

  return (
    <div className="max-w-7xl mx-auto px-6 animate-in fade-in duration-700 pb-20">
      {/* Header with Glass Effect */}
      <div className="relative mb-10">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-[2rem] blur-3xl -z-10" />
        
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-1 h-8 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full" />
              <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                Discover Novels
              </h1>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/50 border border-zinc-800 rounded-full">
                <Sparkles size={14} className="text-blue-500" />
                <span className="text-xs font-medium text-zinc-400">{ACTIVE_PROVIDERS.length} Sources</span>
              </div>
            </div>
            <p className="text-sm text-zinc-500 flex items-center gap-2">
              <SearchIcon size={14} />
              Find your next story across multiple platforms
            </p>
          </div>

          {/* View Mode Toggle */}
          {hasSearched && (
            <div className="flex bg-zinc-900/40 border border-zinc-800 rounded-xl p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-all ${
                  viewMode === 'grid' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Grid3X3 size={16} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-all ${
                  viewMode === 'list' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <List size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="max-w-3xl mx-auto mb-12">
        <div className="relative group">
          {/* Glow Effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-60 transition-opacity duration-500" />
          
          <div className="relative flex items-center">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <SearchIcon className="text-zinc-500 group-focus-within:text-blue-500 transition-colors" size={20} />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Search by title... (Press Enter)"
              className="w-full bg-zinc-900/80 backdrop-blur-sm border border-zinc-800 rounded-2xl py-5 pl-12 pr-24 text-white placeholder-zinc-500 outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-xl"
            />
            {query && (
              <button
                onClick={clearSearch}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-all"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Search Status & Stats */}
        {isSearching && (
          <div className="mt-4 flex items-center justify-center gap-3 text-sm">
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full">
              <Loader2 size={14} className="animate-spin text-blue-500" />
              <span className="text-blue-400">Searching {searchStats.loading} of {searchStats.total} sources...</span>
            </div>
          </div>
        )}

        {hasSearched && !isSearching && (
          <div className="mt-4 flex items-center justify-center gap-4 text-xs">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/50 border border-zinc-800 rounded-full">
              <span className="text-zinc-500">Results:</span>
              <span className="text-white font-bold">{searchStats.success}</span>
              <span className="text-zinc-600">sources</span>
            </div>
            {searchStats.error > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-full">
                <AlertCircle size={12} className="text-red-500" />
                <span className="text-red-400">{searchStats.error} failed</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Results View */}
      {hasSearched && (
        <div className="space-y-12">
          {Object.entries(sourceStates).map(([sourceId, state]) => {
            const provider = ACTIVE_PROVIDERS.find(p => p.id === sourceId);
            if (!provider) return null;
            
            const isExpanded = expandedSources[sourceId];
            const hasMore = state.data && state.data.length > 5;
            const displayData = state.data ? (isExpanded ? state.data : state.data.slice(0, 5)) : [];
            
            return (
              <div key={sourceId} className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
                {/* Source Header (Always visible) */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-1 h-8 bg-gradient-to-b ${provider.color} rounded-full`} />
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <Globe size={18} className="text-blue-500" />
                      <span>{provider.name}</span>
                    </h2>
                  </div>

                  <div className="flex items-center gap-3">
                    {state.status === 'loading' && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/50 border border-zinc-800 rounded-full">
                        <Loader2 size={12} className="animate-spin text-blue-500" />
                        <span className="text-xs text-zinc-400">Searching...</span>
                      </div>
                    )}
                    {state.status === 'success' && (
                      <div className="px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full">
                        <span className="text-xs text-green-400 font-mono">{state.data.length} results</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Loading State */}
                {state.status === 'loading' && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="space-y-3">
                        <div className="aspect-[2/3] bg-zinc-900/50 rounded-xl animate-pulse border border-zinc-800" />
                        <div className="h-4 bg-zinc-900/50 rounded w-3/4 animate-pulse" />
                        <div className="h-3 bg-zinc-900/50 rounded w-1/2 animate-pulse" />
                      </div>
                    ))}
                  </div>
                )}

                {/* Success State with Results */}
                {state.status === 'success' && state.data.length > 0 && (
                  <div className="space-y-4">
                    {viewMode === 'grid' ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {displayData.map((novel, idx) => (
                          <NovelCard
                            key={idx}
                            novel={novel}
                            index={idx}
                            provider={provider}
                            onClick={() => handleViewDetails(novel)}
                            onHover={setHoveredNovel}
                            isHovered={hoveredNovel === novel.title}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {displayData.map((novel, idx) => (
                          <NovelListItem
                            key={idx}
                            novel={novel}
                            provider={provider}
                            onClick={() => handleViewDetails(novel)}
                          />
                        ))}
                      </div>
                    )}

                    {/* Expand/Collapse Button */}
                    {hasMore && (
                      <div className="flex justify-center mt-2">
                        <button
                          onClick={() => toggleSource(sourceId)}
                          className="flex items-center gap-2 px-6 py-2.5 bg-zinc-900 hover:bg-zinc-800 rounded-full text-sm font-medium text-zinc-400 hover:text-white transition-all border border-zinc-800 hover:border-blue-500/30"
                        >
                          {isExpanded ? (
                            <>
                              Collapse Results
                              <ChevronDown className="rotate-180 transition-transform" size={16} />
                            </>
                          ) : (
                            <>
                              Show {state.data.length - 5} More
                              <ChevronDown className="transition-transform" size={16} />
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Nothing Found State */}
                {state.status === 'not_found' && (
                  <div className="py-6 bg-zinc-900/20 border border-dashed border-zinc-800 rounded-2xl flex items-center justify-center">
                    <p className="text-sm text-zinc-600 flex items-center gap-2">
                      <BookOpen size={16} />
                      Nothing found
                    </p>
                  </div>
                )}

                {/* Error State */}
                {state.status === 'error' && (
                  <div className="py-6 bg-red-500/5 border border-red-500/20 rounded-2xl flex flex-col items-center justify-center">
                    <AlertCircle size={24} className="text-red-500/50 mb-2" />
                    <p className="text-sm text-red-400">Source temporarily unavailable</p>
                  </div>
                )}
              </div>
            );
          })}

          {/* Global Clear Button if everything failed completely */}
          {Object.values(sourceStates).every(s => s.status === 'not_found' || s.status === 'error') && !isSearching && (
            <div className="py-12 text-center border-t border-zinc-800 mt-8 pt-12">
              <h3 className="text-xl font-bold text-zinc-400 mb-2">No Results Anywhere</h3>
              <p className="text-zinc-600 mb-6">Try searching for a different title or keyword.</p>
              <button
                onClick={clearSearch}
                className="px-6 py-3 bg-zinc-900 hover:bg-zinc-800 rounded-xl text-sm font-medium text-zinc-400 hover:text-white transition-all border border-zinc-800"
              >
                Clear Search
              </button>
            </div>
          )}
        </div>
      )}

      {/* Source Grid - Explore View */}
      {!hasSearched && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ACTIVE_PROVIDERS.map((provider, index) => (
            <ExploreCard
              key={provider.id}
              provider={provider}
              index={index}
              onClick={() => exploreSource(provider)}
            />
          ))}
        </div>
      )}

      {/* Novel Details Modal */}
      {selectedNovel && (
        <NovelDetailsModal
          novel={selectedNovel}
          onClose={() => setSelectedNovel(null)}
          isLoadingDetails={isLoadingDetails}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          chapterList={chapterList}
          navigate={navigate}
        />
      )}
    </div>
  );
}

// Novel Card Component
function NovelCard({ novel, index, provider, onClick, onHover, isHovered }) {
  return (
    <div
      className="group cursor-pointer animate-in fade-in duration-500"
      style={{ animationDelay: `${(index % 5) * 50}ms` }}
      onClick={onClick}
      onMouseEnter={() => onHover(novel.title)}
      onMouseLeave={() => onHover(null)}
    >
      <div className="relative aspect-[2/3] bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden shadow-lg group-hover:border-blue-500/50 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-2xl group-hover:shadow-blue-500/10">
        {/* Cover Image */}
        {novel.cover ? (
          <img 
            src={novel.cover} 
            alt="" 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            onError={(e) => {
              e.target.onerror = null;
              e.target.style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-900 to-zinc-800">
            <BookOpen size={40} className="text-zinc-700" />
          </div>
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-60 transition-opacity duration-300" />

        {/* Chapter Badge */}
        {novel.chapters && (
          <div className="absolute bottom-2 left-2 right-2 bg-black/80 backdrop-blur-sm px-2 py-1.5 rounded-lg text-[10px] font-bold text-blue-400 border border-white/5 opacity-0 group-hover:opacity-60 transition-opacity duration-300 translate-y-2 group-hover:translate-y-0">
            {novel.chapters}
          </div>
        )}

        {/* Quick View Button */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-60 transition-opacity duration-300">
          <div className="p-2 bg-black/60 backdrop-blur-sm rounded-lg border border-white/10">
            <Eye size={14} className="text-white" />
          </div>
        </div>
      </div>

      {/* Title and Author */}
      <div className="mt-3 space-y-1 px-1">
        <h3 className="text-sm font-semibold text-zinc-300 line-clamp-2 group-hover:text-blue-400 transition-colors">
          {novel.title}
        </h3>
        <p className="text-[10px] font-medium text-zinc-600 uppercase tracking-wider">
          {novel.author || 'Unknown Author'}
        </p>
      </div>
    </div>
  );
}

// Novel List Item Component
function NovelListItem({ novel, provider, onClick }) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-4 p-4 bg-zinc-900/30 hover:bg-zinc-900/60 rounded-xl border border-zinc-800 hover:border-blue-500/30 transition-all group cursor-pointer"
    >
      {/* Cover Thumbnail */}
      <div className="w-12 h-16 bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0">
        {novel.cover ? (
          <img src={novel.cover} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen size={20} className="text-zinc-600" />
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-white truncate group-hover:text-blue-400 transition-colors">
          {novel.title}
        </h3>
        <p className="text-xs text-zinc-500 truncate mt-1">
          {novel.author || 'Unknown Author'}
        </p>
        {novel.chapters && (
          <p className="text-[10px] text-blue-400 mt-1">{novel.chapters}</p>
        )}
      </div>

      {/* Arrow */}
      <ChevronRight size={18} className="text-zinc-600 group-hover:text-blue-400 transition-all group-hover:translate-x-1" />
    </div>
  );
}

// Explore Card Component
function ExploreCard({ provider, index, onClick }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="group relative cursor-pointer animate-in fade-in slide-in-from-bottom-4 duration-500"
      style={{ animationDelay: `${index * 100}ms` }}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Background Glow */}
      <div className={`absolute -inset-1 bg-gradient-to-r ${provider.color} rounded-[2rem] blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-500`} />
      
      {/* Card */}
      <div className="relative bg-zinc-900/90 backdrop-blur-sm p-8 rounded-[2rem] border border-zinc-800/50 hover:border-white/10 transition-all overflow-hidden">
        {/* Decorative Gradient */}
        <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${provider.color} rounded-full blur-3xl opacity-10 group-hover:opacity-20 transition-opacity`} />
        
        {/* Icon */}
        <div className={`w-16 h-16 bg-gradient-to-br ${provider.color} rounded-2xl flex items-center justify-center text-3xl mb-6 shadow-lg transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
          {provider.icon}
        </div>

        {/* Content */}
        <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-zinc-400 transition-all">
          {provider.name}
        </h3>
        <p className="text-sm text-zinc-500 mb-8 leading-relaxed">
          {provider.desc}
        </p>

        {/* Action */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-600 uppercase tracking-wider">
            Explore
          </span>
          <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center group-hover:bg-blue-500 group-hover:scale-110 transition-all">
            <ArrowRight size={18} className="text-blue-400 group-hover:text-white transition-colors" />
          </div>
        </div>

        {/* Progress Indicator */}
        {isHovered && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_1.5s_infinite]" />
        )}
      </div>
    </div>
  );
}

// Novel Details Modal Component
function NovelDetailsModal({ novel, onClose, isLoadingDetails, activeTab, setActiveTab, chapterList, navigate }) {
  // Close on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-10 bg-black/90 backdrop-blur-md animate-in fade-in duration-500">
      <div className="bg-zinc-950 border border-zinc-800 w-full max-w-5xl rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col md:flex-row h-full max-h-[85vh] relative">
        
        {/* Left Section: Cover */}
        <div className="w-full md:w-80 h-64 md:h-auto bg-zinc-900 relative shrink-0">
          {novel.cover ? (
            <img 
              src={novel.cover} 
              className="w-full h-full object-cover" 
              alt="" 
              onError={(e) => {
                e.target.onerror = null;
                e.target.style.display = 'none';
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-900 to-zinc-800">
              <BookOpen size={48} className="text-zinc-700" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent md:bg-gradient-to-r" />

          {/* Mobile Close Button */}
          <button
            onClick={onClose}
            className="absolute top-6 left-6 bg-black/50 backdrop-blur-md p-2 rounded-full text-white hover:bg-zinc-800 transition-all md:hidden z-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Right Section: Content */}
        <div className="flex-1 flex flex-col min-w-0 bg-zinc-950">
          {/* Header */}
          <div className="p-8 pb-4 space-y-4">
            <div className="flex justify-between items-start gap-4">
              <div className="space-y-2">
                <h2 className="text-3xl font-bold text-white tracking-tight leading-tight line-clamp-2">
                  {novel.title}
                </h2>
                <div className="flex items-center gap-4">
                  <p className="text-blue-400 font-medium flex items-center gap-1">
                    <span className="text-zinc-600 text-xs">by</span> {novel.author || 'Unknown Author'}
                  </p>
                  <button
                    onClick={() => window.electronAPI?.openExternal(novel.url)}
                    className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 hover:text-blue-400 transition-colors uppercase tracking-widest"
                  >
                    <Globe size={12} />
                    View Source
                  </button>
                </div>
              </div>
              <button
                onClick={onClose}
                className="hidden md:flex text-zinc-500 hover:text-white transition-colors p-2 hover:bg-zinc-900 rounded-full"
              >
                <X size={20} />
              </button>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2">
              <span className="text-[10px] font-black text-zinc-400 px-3 py-1.5 bg-zinc-900 rounded-lg border border-white/5 uppercase tracking-tighter">
                {novel.source}
              </span>
              <span className="text-[10px] font-black text-blue-400 px-3 py-1.5 bg-blue-500/10 rounded-lg border border-blue-500/20 uppercase">
                {novel.lastChapter || 'Status Unknown'}
              </span>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="px-8 flex gap-8 border-b border-zinc-900">
            {['description', 'chapters'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-4 text-sm font-bold transition-all relative ${
                  activeTab === tab ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-in slide-in-from-left-2" />
                )}
              </button>
            ))}
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            {activeTab === 'description' ? (
              <div className="space-y-4 animate-in fade-in duration-500">
                <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
                  <BookOpen size={12} />
                  Synopsis
                </h4>
                {isLoadingDetails ? (
                  <div className="space-y-3">
                    <div className="h-4 bg-zinc-900 rounded w-full animate-pulse" />
                    <div className="h-4 bg-zinc-900 rounded w-5/6 animate-pulse" />
                    <div className="h-4 bg-zinc-900 rounded w-4/6 animate-pulse" />
                    <div className="h-4 bg-zinc-900 rounded w-3/4 animate-pulse" />
                  </div>
                ) : (
                  <p className="text-zinc-400 text-sm leading-relaxed whitespace-pre-line">
                    {novel.description || "No description found for this title."}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3 animate-in slide-in-from-bottom-4 duration-500">
                <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
                  <List size={12} />
                  Chapter List ({chapterList.length})
                </h4>
                {isLoadingDetails ? (
                  <div className="flex flex-col items-center justify-center py-20 text-zinc-600 gap-3">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs">Loading chapters...</span>
                  </div>
                ) : chapterList.length > 0 ? (
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                    {chapterList.map((ch, i) => (
                      <ChapterRow
                        key={i}
                        chapter={ch}
                        index={i}
                        novel={novel}
                        navigate={navigate}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16 bg-zinc-900/20 rounded-2xl border border-dashed border-zinc-800">
                    <BookOpen size={32} className="mx-auto text-zinc-700 mb-3" />
                    <p className="text-zinc-600 text-sm">No chapters available</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-8 pt-4 bg-gradient-to-t from-zinc-950 to-transparent">
            <button
              onClick={() => navigate('/download', { 
                state: { prefill: { ...novel, url: novel.firstChapterUrl || novel.url } } 
              })}
              disabled={isLoadingDetails}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:from-zinc-900 disabled:to-zinc-900 disabled:text-zinc-600 text-white font-bold py-4 rounded-2xl transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center gap-3 group disabled:cursor-not-allowed"
            >
              {isLoadingDetails ? (
                <div className="w-5 h-5 border-2 border-zinc-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Download size={18} className="group-hover:translate-y-0.5 transition-transform" />
                  Start Download
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Chapter Row Component
function ChapterRow({ chapter, index, novel, navigate }) {
  return (
    <div className="flex items-center justify-between p-4 bg-zinc-900/30 hover:bg-zinc-900 rounded-xl border border-zinc-800 hover:border-blue-500/30 transition-all group">
      <div className="flex items-center gap-3">
        <span className="text-xs font-mono text-zinc-600 w-12">#{index + 1}</span>
        <span className="text-sm text-zinc-300 font-medium line-clamp-1">
          {chapter.title || `Chapter ${index + 1}`}
        </span>
      </div>
      <button
        onClick={() => navigate('/download', { 
          state: { prefill: { ...novel, url: chapter.url } } 
        })}
        className="opacity-0 group-hover:opacity-60 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-2"
      >
        <Download size={12} />
        Select
      </button>
    </div>
  );
}