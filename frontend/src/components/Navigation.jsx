import { NavLink, useLocation } from 'react-router-dom';
import { Book, Search, Download, History, Sparkles, Activity, Settings as SettingsIcon } from 'lucide-react';
import { useState, useEffect } from 'react';

const tabs = [
  { 
    id: 'library', 
    label: 'Library', 
    icon: Book,
    description: 'Your collection',
    color: 'from-emerald-500 to-teal-500'
  },
  { 
    id: 'search', 
    label: 'Search', 
    icon: Search,
    description: 'Discover novels',
    color: 'from-blue-500 to-indigo-500'
  },
  { 
    id: 'download', 
    label: 'Download', 
    icon: Download,
    description: 'Manage downloads',
    color: 'from-purple-500 to-pink-500'
  },
  { 
    id: 'history', 
    label: 'History', 
    icon: History,
    description: 'Past jobs',
    color: 'from-amber-500 to-orange-500'
  }, 
  { 
    id: 'settings', 
    label: 'Settings', 
    icon: SettingsIcon,
    description: 'App info & preferences',
    color: 'from-slate-500 to-zinc-500'
  },
];

export default function Navigation({ isScraping }) {
  const location = useLocation();
  const [hoveredTab, setHoveredTab] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      {/* Floating Navigation Bar */}
      <nav className="sticky top-6 z-50 flex justify-center px-4 mb-6">
        {/* Main Container with Glass Effect */}
        <div className="relative group">
          {/* Background Glow Effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-pink-600/10 rounded-3xl blur-xl opacity-0 group-hover:opacity-60 transition-opacity duration-500" />
          
          {/* Main Navigation Bar */}
          <div className="relative flex items-center gap-1 bg-zinc-900/90 backdrop-blur-xl border border-zinc-800/50 p-1 rounded-2xl shadow-2xl shadow-black/50">            
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = `/${tab.id}` === location.pathname;
              
              return (
                <NavLink
                  key={tab.id}
                  to={`/${tab.id}`}
                  className={({ isActive }) => `
                    relative flex items-center gap-3 px-5 py-2.5 rounded-xl transition-all duration-300 overflow-hidden
                    ${isActive 
                      ? 'text-white' 
                      : 'text-zinc-500 hover:text-zinc-300'}
                  `}
                  onMouseEnter={() => setHoveredTab(tab.id)}
                  onMouseLeave={() => setHoveredTab(null)}
                >
                  {/* Active/Background Gradient */}
                  {isActive && (
                    <>
                      <div className={`absolute inset-0 bg-gradient-to-r ${tab.color} opacity-20`} />
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                    </>
                  )}
                  
                  {/* Icon Container */}
                  <div className="relative">
                    <div className={`
                      absolute inset-0 rounded-full blur-md transition-opacity duration-300
                      ${isActive ? `bg-gradient-to-r ${tab.color} opacity-50` : 'opacity-0'}
                    `} />
                    <Icon 
                      size={18} 
                      className={`
                        relative transition-all duration-300
                        ${isActive ? 'scale-110' : 'scale-100'}
                        ${hoveredTab === tab.id && !isActive ? 'scale-110' : ''}
                      `}
                    />
                    
                    {/* Download Activity Indicator */}
                    {tab.id === 'download' && isScraping && (
                      <>
                        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
                        </span>
                        {/* Scraping text for active download */}
                        <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[8px] font-mono text-blue-400 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                          ACTIVE
                        </span>
                      </>
                    )}
                  </div>

                  {/* Label */}
                  <span className="relative text-sm font-medium tracking-wide">
                    {tab.label}
                  </span>

                  {/* Tooltip on Hover */}
                  {hoveredTab === tab.id && !isActive && mounted && (
                    <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-[10px] font-medium text-zinc-400 whitespace-nowrap shadow-xl animate-in fade-in slide-in-from-top-1 duration-200">
                      {tab.description}
                      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-zinc-900 border-t border-l border-zinc-800" />
                    </div>
                  )}
                </NavLink>
              );
            })}
          </div>
        </div>
      </nav>


      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </>
  );
}