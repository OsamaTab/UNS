import React from 'react';
import { BookOpen, Star, MoreVertical } from 'lucide-react';

export default function Library() {
  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Library</h1>
          <p className="text-gray-400 mt-1">Your personal collection of offline novels.</p>
        </div>
        <button className="bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl text-sm font-medium transition-colors">
          Manage Shelves
        </button>
      </div>

      {/* Grid for Books */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {/* Placeholder Book Card */}
        {[1, 2, 3].map((i) => (
          <div key={i} className="group cursor-pointer">
            <div className="aspect-[2/3] bg-[#1c1c21] rounded-2xl border border-white/5 overflow-hidden relative shadow-lg group-hover:shadow-blue-600/10 transition-all group-hover:-translate-y-2">
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                <button className="w-full bg-blue-600 py-2 rounded-xl text-sm font-bold shadow-lg">Read Now</button>
              </div>
              <div className="flex items-center justify-center h-full text-gray-700">
                <BookOpen size={48} strokeWidth={1} />
              </div>
            </div>
            <h3 className="mt-3 font-bold text-sm truncate">Novel Title {i}</h3>
            <p className="text-xs text-gray-500">Author Name</p>
          </div>
        ))}
      </div>
    </div>
  );
}