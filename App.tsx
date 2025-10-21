import React, { useState, useEffect, useRef } from 'react';
import { 
  AssistantView, 
  ImageGeneratorView, 
  ThumbnailGeneratorView, 
  AuthView
} from './components';
import { View } from './types';
import { 
  SettingsIcon, 
  PlusIcon, 
  PhotoIcon, 
  ThumbnailIcon, 
  MicrophoneIcon, 
  ThemeIcon, 
  LogoutIcon,
  DownloadIcon
} from './components/icons';


type Theme = 'light' | 'dark';

const DownloadPrompt: React.FC<{ onInstall: () => void; onDismiss: () => void }> = ({ onInstall, onDismiss }) => {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-full max-w-lg animate-slide-down-fade-in">
        <div className="bg-white/80 dark:bg-gray-800/90 backdrop-blur-lg border border-slate-300 dark:border-gray-700 rounded-xl shadow-xl p-4 mx-4 flex items-center justify-between gap-4">
            <div className="flex-shrink-0 bg-slate-200 dark:bg-gray-900 p-3 rounded-full">
                <DownloadIcon />
            </div>
            <div className="flex-grow">
                <p className="font-bold text-slate-800 dark:text-white">Get the Spark App!</p>
                <p className="text-sm text-slate-600 dark:text-gray-300">Add to home screen for a seamless experience.</p>
            </div>
            <button
                onClick={onInstall}
                className="flex-shrink-0 bg-slate-800 text-white dark:bg-white dark:text-black px-4 py-2 rounded-lg font-semibold text-sm hover:bg-slate-700 dark:hover:bg-gray-200 transition-colors"
                aria-label="Install app"
            >
                Install
            </button>
            <button
                onClick={onDismiss}
                className="flex-shrink-0 text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white transition-colors p-1 rounded-full"
                aria-label="Close prompt"
            >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>
    </div>
  );
};

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [activeGenerator, setActiveGenerator] = useState<View.Images | View.Thumbnail | null>(null);
  const [isFabMenuOpen, setIsFabMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('spark-theme') as Theme) || 'dark');
  const [showDownloadPrompt, setShowDownloadPrompt] = useState(false);
  const [installPromptEvent, setInstallPromptEvent] = useState<Event | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLDivElement>(null);

  // Apply theme class to HTML element
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('spark-theme', theme);
  }, [theme]);

  // Check for session on initial load
  useEffect(() => {
    const sessionExists = localStorage.getItem('spark-session');
    if (sessionExists) {
      setIsAuthenticated(true);
    }
  }, []);
  
  // Listen for the browser's install prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPromptEvent(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Show download prompt after 5 seconds, if not installed or dismissed
  useEffect(() => {
    const promptDismissed = sessionStorage.getItem('spark-download-prompt-dismissed');
    // Check if the app is running in standalone mode (already installed)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

    if (!promptDismissed && !isStandalone) {
      const timer = setTimeout(() => {
        setShowDownloadPrompt(true);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, []);

  // Click outside handler for settings menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
    };

    if (isSettingsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSettingsOpen]);
  
  // Click outside handler for FAB menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (fabRef.current && !fabRef.current.contains(event.target as Node)) {
        setIsFabMenuOpen(false);
      }
    };

    if (isFabMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFabMenuOpen]);
  
  const handleInstallClick = async () => {
    // Hide the prompt immediately and mark as dismissed for the session
    setShowDownloadPrompt(false);
    sessionStorage.setItem('spark-download-prompt-dismissed', 'true');

    if (installPromptEvent) {
        // Show the browser's install prompt
        (installPromptEvent as any).prompt();

        // Wait for the user to respond to the prompt.
        const { outcome } = await (installPromptEvent as any).userChoice;
        console.log(`User response to the install prompt: ${outcome}`);

        // We can only use the prompt once. Clear it.
        setInstallPromptEvent(null);
    } else {
        // If the prompt event is not available, we can't trigger the install.
        // Inform the user how to do it manually.
        alert("This app can be installed! Open your browser's menu and look for 'Add to Home Screen' or 'Install app'.");
    }
  };

  const handleDismissDownloadPrompt = () => {
    setShowDownloadPrompt(false);
    sessionStorage.setItem('spark-download-prompt-dismissed', 'true');
  };

  const handleLogout = () => {
    localStorage.removeItem('spark-session');
    setIsAuthenticated(false);
    setIsSettingsOpen(false); // Close menu on logout
    setIsFabMenuOpen(false); // Close FAB menu on logout
  };

  const openGenerator = (generator: View.Images | View.Thumbnail) => {
    setActiveGenerator(generator);
    setIsFabMenuOpen(false);
  };

  const closeGeneratorAndMenu = () => {
    setActiveGenerator(null);
    setIsFabMenuOpen(false);
  };
  
  // Render AuthView if not authenticated
  if (!isAuthenticated) {
    return <AuthView onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  // Render main app if authenticated
  return (
    <div className="relative min-h-screen w-full bg-transparent overflow-hidden text-slate-800 dark:text-slate-200">
        {showDownloadPrompt && <DownloadPrompt onInstall={handleInstallClick} onDismiss={handleDismissDownloadPrompt} />}
        {/* Settings Button and Menu */}
        <div ref={settingsRef} className="absolute top-4 right-4 z-50">
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className="bg-slate-200/70 dark:bg-gray-800/70 backdrop-blur-sm p-2 rounded-full hover:bg-slate-300/80 dark:hover:bg-gray-700/80 transition-colors duration-300 border border-slate-300 dark:border-gray-700"
              aria-label="Settings"
            >
              <SettingsIcon />
            </button>

            {isSettingsOpen && (
                <div className="absolute top-14 right-0 bg-white/80 dark:bg-gray-800/90 backdrop-blur-lg border border-slate-300 dark:border-gray-700 rounded-lg shadow-xl p-2 animate-fade-in w-auto">
                    <div className="flex flex-col gap-2">
                        {/* Theme Switcher Button */}
                        <button
                          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                          className="flex items-center gap-3 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm pl-2 pr-4 py-2 rounded-full hover:bg-slate-200/90 dark:hover:bg-gray-700/90 transition-all duration-300 border border-slate-300 dark:border-gray-700 shadow-lg transform hover:scale-105"
                          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                        >
                          <div className="bg-slate-100 dark:bg-gray-900 p-2 rounded-full">
                              <ThemeIcon theme={theme} className="h-5 w-5 text-slate-800 dark:text-white" />
                          </div>
                          <span className="text-slate-800 dark:text-white font-semibold text-sm whitespace-nowrap">
                              Switch to {theme === 'dark' ? 'Light' : 'Dark'}
                          </span>
                        </button>

                        {/* Logout Button */}
                        <button
                          onClick={handleLogout}
                          className="flex items-center gap-3 bg-red-500/10 dark:bg-red-500/20 backdrop-blur-sm pl-2 pr-4 py-2 rounded-full hover:bg-red-500/20 dark:hover:bg-red-500/30 transition-all duration-300 border border-red-500/20 dark:border-red-500/30 shadow-lg transform hover:scale-105"
                          aria-label="Logout"
                        >
                          <div className="bg-slate-100 dark:bg-gray-900 p-2 rounded-full">
                              <LogoutIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
                          </div>
                          <span className="text-red-600 dark:text-red-400 font-semibold text-sm whitespace-nowrap">Logout</span>
                        </button>
                    </div>
                </div>
            )}
        </div>

        {/* Assistant View is always the base layer */}
        <AssistantView />

        {/* Floating Action Button (FAB) and Menu */}
        <div ref={fabRef} className="fixed bottom-6 left-6 sm:bottom-8 sm:left-8 z-50">
          <div className="flex flex-col items-start gap-4">
            <div 
              className={`transition-all duration-300 ease-in-out flex flex-col items-start gap-4 ${
                isFabMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
              }`}
            >
              {/* Spark Assistant Button */}
              <button
                onClick={closeGeneratorAndMenu}
                className={`flex items-center gap-3 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm pl-2 pr-4 py-2 rounded-full hover:bg-slate-200/90 dark:hover:bg-gray-700/90 transition-all duration-300 border shadow-lg transform hover:scale-105 ${activeGenerator === null ? 'border-slate-800 dark:border-white' : 'border-slate-300 dark:border-gray-700'}`}
                aria-label="Spark Voice Assistant"
              >
                 <div className="bg-slate-100 dark:bg-gray-900 p-2 rounded-full">
                    <MicrophoneIcon className="h-5 w-5 text-slate-800 dark:text-white" />
                 </div>
                <span className="text-slate-800 dark:text-white font-semibold text-sm whitespace-nowrap">Spark</span>
              </button>

              {/* Image Generator Button */}
              <button
                onClick={() => openGenerator(View.Images)}
                className="flex items-center gap-3 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm pl-2 pr-4 py-2 rounded-full hover:bg-slate-200/90 dark:hover:bg-gray-700/90 transition-all duration-300 border border-slate-300 dark:border-gray-700 shadow-lg transform hover:scale-105"
                aria-label="Image Generator"
              >
                <div className="bg-slate-100 dark:bg-gray-900 p-2 rounded-full">
                    <PhotoIcon className="h-5 w-5 text-slate-800 dark:text-white" />
                </div>
                <span className="text-slate-800 dark:text-white font-semibold text-sm whitespace-nowrap">Image Generator</span>
              </button>
              
              {/* Thumbnail Generator Button */}
              <button
                onClick={() => openGenerator(View.Thumbnail)}
                className="flex items-center gap-3 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm pl-2 pr-4 py-2 rounded-full hover:bg-slate-200/90 dark:hover:bg-gray-700/90 transition-all duration-300 border border-slate-300 dark:border-gray-700 shadow-lg transform hover:scale-105"
                aria-label="Thumbnail Generator"
              >
                <div className="bg-slate-100 dark:bg-gray-900 p-2 rounded-full">
                    <ThumbnailIcon className="h-5 w-5 text-slate-800 dark:text-white" />
                </div>
                <span className="text-slate-800 dark:text-white font-semibold text-sm whitespace-nowrap">Thumbnail Generator</span>
              </button>
            </div>
            
            <button
              onClick={() => setIsFabMenuOpen(!isFabMenuOpen)}
              className="bg-slate-800 text-white dark:bg-white dark:text-black p-4 rounded-full shadow-lg shadow-slate-800/30 dark:shadow-white/30 hover:bg-slate-700 dark:hover:bg-gray-200 transition-transform transform hover:scale-110 focus:outline-none focus:ring-4 focus:ring-slate-800/50 dark:focus:ring-white/50"
              aria-expanded={isFabMenuOpen}
              aria-label={isFabMenuOpen ? "Close menu" : "Open menu"}
            >
              <div className={`transition-transform duration-300 ${isFabMenuOpen ? 'rotate-45' : ''}`}>
                <PlusIcon className="h-8 w-8" />
              </div>
            </button>
          </div>
        </div>

        {/* Generator Modal Overlay */}
        {activeGenerator && (
          <div className="fixed inset-0 z-40 bg-slate-50/80 dark:bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto text-gray-800 dark:text-gray-100 font-sans">
            <div className="container mx-auto px-4 py-8 pb-28">
              <button 
                onClick={() => setActiveGenerator(null)} 
                className="fixed top-4 right-4 bg-slate-200/70 dark:bg-gray-800/70 backdrop-blur-sm p-2 rounded-full hover:bg-slate-300/80 dark:hover:bg-gray-700/80 transition-colors duration-300 border border-slate-300 dark:border-gray-700 z-50"
                aria-label="Close generator"
              >
                <svg className="h-6 w-6 text-slate-800 dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              <main className="mt-16 md:mt-8 relative">
                {activeGenerator === View.Images && <ImageGeneratorView />}
                {activeGenerator === View.Thumbnail && <ThumbnailGeneratorView />}
              </main>
            </div>
          </div>
        )}
    </div>
  );
};

export default App;