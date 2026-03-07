import { useState, useEffect } from 'react';
import {
    Info, Package, User, Calendar, Hash, FileText, Github, Heart, Sparkles,
    Zap, CheckCircle, Settings as SettingsIcon,
    ArrowUpCircle, RefreshCw, Download
} from 'lucide-react';

export default function Settings() {
    const [updateLoading, setUpdateLoading] = useState(false);
    const [latestVersion, setLatestVersion] = useState(null);
    const [updateAvailable, setUpdateAvailable] = useState(false);

    const packageInfo = {
        name: "novel-scraper-desktop",
        productName: "UNS",
        description: "Desktop app for scraping web novels into EPUB format",
        version: "1.0.6", // Current Version
        author: "Osama",
        license: "CC-BY-NC-4.0",
        appId: "com.universalnovelscraper.app",
        repo: "OsamaTab/UNS"
    };

    useEffect(() => {
        checkForUpdates();
    }, []);

    const checkForUpdates = async () => {
        setUpdateLoading(true);
        try {
            // Fetch from GitHub API
            const response = await fetch(`https://api.github.com/repos/${packageInfo.repo}/releases/latest`);
            const data = await response.json();

            if (data.tag_name) {
                const latest = data.tag_name.replace('v', '');
                setLatestVersion(latest);

                // Simple version comparison
                if (latest !== packageInfo.version) {
                    setUpdateAvailable(true);
                }
            }
        } catch (error) {
            console.error("Failed to check for updates:", error);
        } finally {
            setUpdateLoading(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto px-6 animate-in fade-in duration-700">
            {/* Header */}
            <div className="relative mb-10">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-[2rem] blur-3xl -z-10" />
                <div className="flex items-center justify-between">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="w-1 h-8 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full" />
                            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                                Settings & Info
                            </h1>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/50 border border-zinc-800 rounded-full">
                                <SettingsIcon size={14} className="text-zinc-500" />
                                <span className="text-xs font-medium text-zinc-400">v{packageInfo.version}</span>
                            </div>
                        </div>
                        <p className="text-sm text-zinc-500 flex items-center gap-2">
                            <Info size={14} />
                            Manage application updates and view system details
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">

                    {/* NEW: Update Status Card */}
                    <div className="bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 backdrop-blur-sm rounded-2xl border border-zinc-800/50 shadow-xl overflow-hidden">
                        <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
                            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                                <ArrowUpCircle size={18} className="text-blue-500" />
                                Software Update
                            </h2>
                            <button
                                onClick={checkForUpdates}
                                disabled={updateLoading}
                                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400"
                            >
                                <RefreshCw size={16} className={updateLoading ? "animate-spin" : ""} />
                            </button>
                        </div>
                        <div className="p-6">
                            {updateAvailable ? (
                                <div className="flex items-center justify-between p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                                            <Sparkles size={20} className="text-blue-400" />
                                        </div>
                                        <div>
                                            <p className="text-white font-medium">New Version Available!</p>
                                            <p className="text-sm text-zinc-400">Version v{latestVersion} is ready for download.</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => window.electronAPI?.openExternal(`https://github.com/${packageInfo.repo}/releases/latest`)}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-all"
                                    >
                                        <Download size={16} />
                                        Update Now
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 text-zinc-400">
                                    <CheckCircle size={18} className="text-green-500" />
                                    <p className="text-sm">You are running the latest version of UNS.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* App Info Card */}
                    <div className="bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 backdrop-blur-sm rounded-2xl border border-zinc-800/50 shadow-xl overflow-hidden">
                        <div className="p-6 border-b border-zinc-800">
                            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                                <Info size={18} className="text-blue-500" />
                                Application Information
                            </h2>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="flex items-center justify-between p-4 bg-zinc-950/50 rounded-xl border border-zinc-800">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center">
                                        <Package size={24} className="text-blue-500" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white">{packageInfo.productName}</h3>
                                        <p className="text-sm text-zinc-500">{packageInfo.description}</p>
                                    </div>
                                </div>
                                <div className="px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                                    <span className="text-blue-400 font-mono font-bold">v{packageInfo.version}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-3 p-4 bg-zinc-950/30 rounded-xl border border-zinc-800">
                                    <div className="flex items-center gap-2 text-zinc-400">
                                        <User size={16} /><span className="text-xs font-medium">Author</span>
                                    </div>
                                    <p className="text-white font-medium">{packageInfo.author}</p>
                                </div>
                                <div className="space-y-3 p-4 bg-zinc-950/30 rounded-xl border border-zinc-800">
                                    <div className="flex items-center gap-2 text-zinc-400">
                                        <Hash size={16} /><span className="text-xs font-medium">App ID</span>
                                    </div>
                                    <p className="text-white font-medium text-sm truncate">{packageInfo.appId}</p>
                                </div>
                                <div className="space-y-3 p-4 bg-zinc-950/30 rounded-xl border border-zinc-800">
                                    <div className="flex items-center gap-2 text-zinc-400">
                                        <FileText size={16} /><span className="text-xs font-medium">License</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <p className="text-white font-medium">{packageInfo.license}</p>
                                    </div>
                                </div>
                                <div className="space-y-3 p-4 bg-zinc-950/30 rounded-xl border border-zinc-800">
                                    <div className="flex items-center gap-2 text-zinc-400">
                                        <Calendar size={16} /><span className="text-xs font-medium">Built with</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <span className="px-2 py-1 bg-zinc-800 rounded text-xs text-zinc-300">Electron</span>
                                        <span className="px-2 py-1 bg-zinc-800 rounded text-xs text-zinc-300">React</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column - System Info & Credits */}
                <div className="space-y-6">
                    <div className="bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 backdrop-blur-sm rounded-2xl border border-zinc-800/50 shadow-xl overflow-hidden text-center p-8">
                        <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/20">
                            <Zap className="text-blue-500" size={32} />
                        </div>
                        <h3 className="text-white font-bold text-lg">System Status</h3>
                        <p className="text-zinc-500 text-sm mb-4">Core services are operational</p>
                        <div className="flex justify-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 backdrop-blur-sm rounded-2xl border border-zinc-800/50 shadow-xl overflow-hidden">
                        <div className="p-6 border-b border-zinc-800">
                            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                                <Heart size={18} className="text-red-500" />
                                Credits
                            </h2>
                        </div>
                        <div className="p-4 space-y-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold">O</div>
                                <div>
                                    <p className="text-sm text-white">Developed by <span className="font-bold">Osama</span></p>
                                    <p className="text-xs text-zinc-500">Universal Novel Scraper</p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <button onClick={() => window.electronAPI?.openExternal(`https://github.com/${packageInfo.repo}`)} className="w-full flex items-center justify-between p-3 bg-zinc-950/30 hover:bg-zinc-900 rounded-xl border border-zinc-800 transition-all group">
                                    <span className="text-sm text-zinc-400 group-hover:text-white transition-colors">GitHub Repository</span>
                                    <Github size={16} className="text-zinc-600 group-hover:text-white" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}