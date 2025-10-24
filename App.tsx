



import React, { useState, useEffect, useRef } from 'react';
import { 
  AuthView,
  AssistantView, 
  ImageGeneratorView, 
  VoiceSelectionView,
} from './components';
import { View, voices } from './types';
import { 
  SettingsIcon, 
  PlusIcon, 
  PhotoIcon, 
  MicrophoneIcon, 
  ThemeIcon, 
  DownloadIcon,
  LogoutIcon,
  SoundWaveIcon,
  CameraIcon,
  DisplayIcon,
} from './components/icons';


type Theme = 'light' | 'dark';
type AssistantMode = 'voice' | 'camera' | 'screen';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => !!sessionStorage.getItem('spark-auth-session'));
  const [startAssistant, setStartAssistant] = useState(false);
  const [activeGenerator, setActiveGenerator] = useState<View.Images | View.Voice | null>(null);
  const [assistantMode, setAssistantMode] = useState<AssistantMode>('voice');
  const [isFabMenuOpen, setIsFabMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('spark-theme') as Theme) || 'dark');
  const [selectedVoice, setSelectedVoice] = useState<string>(() => localStorage.getItem('spark-voice') || 'Charon');
  const [installPromptEvent, setInstallPromptEvent] = useState<any>(null);
  const [assistantKey, setAssistantKey] = useState(0); // Key to force AssistantView remount
  const settingsRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLDivElement>(null);

  const selectedVoiceDetails = voices.find(v => v.id === selectedVoice) || voices[0];

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

  // Listen for PWA install prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPromptEvent(event);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
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
    if (!installPromptEvent) {
      return;
    }
    installPromptEvent.prompt();
    const { outcome } = await installPromptEvent.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted the A2HS prompt');
    } else {
      console.log('User dismissed the A2HS prompt');
    }
    setInstallPromptEvent(null);
    setIsSettingsOpen(false);
  };

  const openGenerator = (generator: View.Images | View.Voice) => {
    setActiveGenerator(generator);
    setIsFabMenuOpen(false);
  };

  const openAssistantMode = (mode: AssistantMode) => {
    setActiveGenerator(null);
    setAssistantMode(mode);
    setIsFabMenuOpen(false);
    setAssistantKey(prev => prev + 1); // Remount to start session in new mode
  };

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    setStartAssistant(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('spark-auth-session');
    setIsAuthenticated(false);
    setStartAssistant(false);
    setIsSettingsOpen(false);
  };

  const handleVoiceSelect = (voiceId: string) => {
    setSelectedVoice(voiceId);
    localStorage.setItem('spark-voice', voiceId);
    setActiveGenerator(null); // Close the voice selection view
    setAssistantKey(prev => prev + 1); // Trigger remount of AssistantView to apply voice and auto-start
  };
  
  if (!isAuthenticated) {
    return <AuthView onLoginSuccess={handleLoginSuccess} />;
  }
  
  return (
    <div className="relative min-h-screen w-full bg-transparent overflow-hidden text-slate-800 dark:text-slate-200">
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

                        {/* Install App Button */}
                        {installPromptEvent && (
                          <button
                            onClick={handleInstallClick}
                            className="flex items-center gap-3 bg-cyan-500/10 dark:bg-cyan-500/20 backdrop-blur-sm pl-2 pr-4 py-2 rounded-full hover:bg-cyan-500/20 dark:hover:bg-cyan-500/30 transition-all duration-300 border border-cyan-500/20 dark:border-cyan-500/30 shadow-lg transform hover:scale-105"
                            aria-label="Install App"
                          >
                            <div className="bg-slate-100 dark:bg-gray-900 p-2 rounded-full">
                                <DownloadIcon className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                            </div>
                            <span className="text-cyan-600 dark:text-cyan-400 font-semibold text-sm whitespace-nowrap">Download App</span>
                          </button>
                        )}
                        
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
        <AssistantView key={`${assistantKey}-${assistantMode}`} autoStart={startAssistant} mode={assistantMode} selectedVoice={selectedVoiceDetails.id} selectedVoiceGender={selectedVoiceDetails.gender} />

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
                onClick={() => openAssistantMode('voice')}
                className={`flex items-center gap-3 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm pl-2 pr-4 py-2 rounded-full hover:bg-slate-200/90 dark:hover:bg-gray-700/90 transition-all duration-300 border shadow-lg transform hover:scale-105 ${activeGenerator === null && assistantMode === 'voice' ? 'border-slate-800 dark:border-white' : 'border-slate-300 dark:border-gray-700'}`}
                aria-label="Spark Voice Assistant"
              >
                 <div className="bg-slate-100 dark:bg-gray-900 p-2 rounded-full">
                    <MicrophoneIcon className="h-5 w-5 text-slate-800 dark:text-white" />
                 </div>
                <span className="text-slate-800 dark:text-white font-semibold text-sm whitespace-nowrap">Spark</span>
              </button>
              
              {/* Camera Mode Button */}
              <button
                onClick={() => openAssistantMode('camera')}
                className={`flex items-center gap-3 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm pl-2 pr-4 py-2 rounded-full hover:bg-slate-200/90 dark:hover:bg-gray-700/90 transition-all duration-300 border shadow-lg transform hover:scale-105 ${activeGenerator === null && assistantMode === 'camera' ? 'border-slate-800 dark:border-white' : 'border-slate-300 dark:border-gray-700'}`}
                aria-label="Camera Mode"
              >
                 <div className="bg-slate-100 dark:bg-gray-900 p-2 rounded-full">
                    <CameraIcon className="h-5 w-5 text-slate-800 dark:text-white" />
                 </div>
                <span className="text-slate-800 dark:text-white font-semibold text-sm whitespace-nowrap">Camera</span>
              </button>
              
              {/* Screen Share Mode Button */}
              <button
                onClick={() => openAssistantMode('screen')}
                className={`flex items-center gap-3 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm pl-2 pr-4 py-2 rounded-full hover:bg-slate-200/90 dark:hover:bg-gray-700/90 transition-all duration-300 border shadow-lg transform hover:scale-105 ${activeGenerator === null && assistantMode === 'screen' ? 'border-slate-800 dark:border-white' : 'border-slate-300 dark:border-gray-700'}`}
                aria-label="Screen Share Mode"
              >
                 <div className="bg-slate-100 dark:bg-gray-900 p-2 rounded-full">
                    <DisplayIcon className="h-5 w-5 text-slate-800 dark:text-white" />
                 </div>
                <span className="text-slate-800 dark:text-white font-semibold text-sm whitespace-nowrap">Screen Share</span>
              </button>

              {/* Voice Selection Button */}
              <button
                onClick={() => openGenerator(View.Voice)}
                className={`flex items-center gap-3 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm pl-2 pr-4 py-2 rounded-full hover:bg-slate-200/90 dark:hover:bg-gray-700/90 transition-all duration-300 border shadow-lg transform hover:scale-105 ${activeGenerator === View.Voice ? 'border-slate-800 dark:border-white' : 'border-slate-300 dark:border-gray-700'}`}
                aria-label="Voice Selection"
              >
                 <div className="bg-slate-100 dark:bg-gray-900 p-2 rounded-full">
                    <SoundWaveIcon className="h-5 w-5 text-slate-800 dark:text-white" />
                 </div>
                <span className="text-slate-800 dark:text-white font-semibold text-sm whitespace-nowrap">Voice</span>
              </button>

              {/* Image Generator Button */}
              <button
                onClick={() => openGenerator(View.Images)}
                className={`flex items-center gap-3 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm pl-2 pr-4 py-2 rounded-full hover:bg-slate-200/90 dark:hover:bg-gray-700/90 transition-all duration-300 border shadow-lg transform hover:scale-105 ${activeGenerator === View.Images ? 'border-slate-800 dark:border-white' : 'border-slate-300 dark:border-gray-700'}`}
                aria-label="Image Generator"
              >
                <div className="bg-slate-100 dark:bg-gray-900 p-2 rounded-full">
                    <PhotoIcon className="h-5 w-5 text-slate-800 dark:text-white" />
                </div>
                <span className="text-slate-800 dark:text-white font-semibold text-sm whitespace-nowrap">Image Generator</span>
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
                {activeGenerator === View.Voice && <VoiceSelectionView currentVoice={selectedVoice} onVoiceSelect={handleVoiceSelect} />}
              </main>
            </div>
          </div>
        )}
    </div>
  );
};

export default App;