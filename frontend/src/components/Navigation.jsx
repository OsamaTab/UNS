import { NavLink } from 'react-router-dom';
import { Book, Search, Download, History } from 'lucide-react';

const tabs = [
  { id: 'library', label: 'Library', icon: Book },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'download', label: 'Download', icon: Download },
  { id: 'history', label: 'History', icon: History },
];

export default function Navigation({ isScraping }) {
  return (
    <nav className="sticky top-0 z-50 flex justify-center p-4">
      <div className="flex items-center gap-1 bg-[#1c1c21]/80 backdrop-blur-xl border border-white/10 p-1.5 rounded-2xl shadow-2xl">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.id}
              to={`/${tab.id}`}
              className={({ isActive }) => `
                flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200
                ${isActive 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'}
              `}
            >
              <div className="relative">
                <Icon size={18} />
                {tab.id === 'download' && isScraping && (
                  <span className="absolute -top-1 -right-1 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                  </span>
                )}
              </div>
              <span className="text-sm font-medium">{tab.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}