import React from 'react';
import { Search as SearchIcon, Globe, ArrowRight } from 'lucide-react';

export default function Search() {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="max-w-2xl mx-auto text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">Discover Novels</h1>
        <p className="text-gray-400">Search across multiple sources to find your next adventure.</p>
        
        <div className="relative group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <SearchIcon className="text-gray-500 group-focus-within:text-blue-500 transition-colors" size={20} />
          </div>
          <input 
            type="text"
            placeholder="Search by title, author, or genre..."
            className="w-full bg-[#1c1c21] border border-white/10 rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-blue-600/50 focus:border-blue-600 transition-all shadow-2xl"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {['NovelBin', 'LightNovelPub', 'RoyalRoad'].map((source) => (
          <div key={source} className="bg-[#1c1c21] p-6 rounded-3xl border border-white/5 hover:border-blue-500/30 transition-all cursor-pointer group">
            <div className="w-12 h-12 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-500 mb-4 group-hover:scale-110 transition-transform">
              <Globe size={24} />
            </div>
            <h3 className="font-bold text-lg">{source}</h3>
            <p className="text-sm text-gray-400 mb-4">Browse top trending novels on {source}.</p>
            <div className="flex items-center text-blue-500 text-sm font-bold gap-1">
              Explore <ArrowRight size={14} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}