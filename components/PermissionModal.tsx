
import React, { useState } from 'react';
import { MicrophoneIcon } from './icons';

interface PermissionModalProps {
  onAllow: () => void;
  onDeny: () => void;
}

const PermissionModal: React.FC<PermissionModalProps> = ({ onAllow, onDeny }) => {
  const [isClosing, setIsClosing] = useState(false);

  const handleAllow = () => {
    setIsClosing(true);
    setTimeout(onAllow, 300); // Wait for animation to finish
  };

  const handleDeny = () => {
    setIsClosing(true);
    setTimeout(onDeny, 300); // Wait for animation to finish
  };

  const animationClass = isClosing ? 'animate-scale-down-fade-out' : 'animate-scale-up-fade-in';

  return (
    <div className="fixed inset-0 bg-slate-500/30 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4" onClick={handleDeny}>
      <div 
        className={`bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg border border-slate-200 dark:border-gray-700 p-8 rounded-2xl shadow-xl max-w-sm w-full mx-auto text-center ${animationClass}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="permission-title"
        aria-describedby="permission-description"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-slate-200/70 dark:bg-gray-900/70 mb-5 animate-bubble-pulse">
            <MicrophoneIcon className="w-10 h-10 text-slate-700 dark:text-cyan-300" />
        </div>
        <h3 id="permission-title" className="text-xl font-bold text-slate-800 dark:text-white mb-3">
            Microphone Access
        </h3>
        <p id="permission-description" className="text-slate-600 dark:text-gray-400 mb-8 text-sm">
            Spark needs your permission to use the microphone for voice commands.
        </p>
        <div className="flex flex-col space-y-3">
            <button 
                onClick={handleAllow} 
                className="w-full bg-slate-800 text-white dark:bg-white dark:text-slate-900 font-bold py-3 px-4 rounded-lg hover:bg-slate-700 dark:hover:bg-gray-200 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-slate-800/50 dark:focus:ring-white/50"
            >
                Allow Access
            </button>
            <button 
                onClick={handleDeny} 
                className="w-full bg-slate-200/50 dark:bg-gray-700/50 text-slate-700 dark:text-gray-300 font-semibold py-3 px-4 rounded-lg hover:bg-slate-300/70 dark:hover:bg-gray-600/70 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-slate-400/50 dark:focus:ring-white/50"
            >
                Not Now
            </button>
        </div>
      </div>
    </div>
  );
};

export default PermissionModal;
