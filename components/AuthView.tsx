
import React, { useState, useEffect } from 'react';
import { SpinnerIcon, EyeIcon, EyeSlashIcon } from './icons';

interface AuthViewProps {
  onLoginSuccess: () => void;
}

const AuthView: React.FC<AuthViewProps> = ({ onLoginSuccess }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  const CORRECT_PASSWORD = 'vv';

  useEffect(() => {
    if (isShaking) {
      const timer = setTimeout(() => setIsShaking(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isShaking]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!password) {
      setError('Please enter the password.');
      setIsShaking(true);
      return;
    }
    
    setIsLoading(true);

    // Simulate network delay for user feedback
    setTimeout(() => {
      if (password === CORRECT_PASSWORD) {
        sessionStorage.setItem('spark-auth-session', 'true');
        onLoginSuccess();
      } else {
        setError('Incorrect password. Please try again.');
        setIsShaking(true);
        setPassword('');
      }
      setIsLoading(false);
    }, 500);
  };

  const inputClasses = "w-full bg-slate-200 dark:bg-gray-800 border border-slate-300 dark:border-gray-600 rounded-lg p-3 text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-gray-500 focus:ring-2 focus:ring-cyan-500 focus:outline-none transition";

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 animate-fade-in bg-slate-50 dark:bg-black">
      <div 
        className={`w-full max-w-sm bg-white dark:bg-gray-900/50 backdrop-blur-lg border border-slate-300 dark:border-gray-700 rounded-2xl shadow-2xl p-8 ${isShaking ? 'animate-shake' : ''}`}
      >
        <div className="flex flex-col items-center mb-6">
            <h1 className="text-4xl font-bold text-center text-slate-800 dark:text-white">
              Assistant Spark
            </h1>
            <p className="text-center text-slate-600 dark:text-gray-300 mt-2">
              Enter Password to Continue
            </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
            <div>
                <label htmlFor="password" className="sr-only">
                  Password
                </label>
                <div className="relative">
                  <input 
                    id="password" 
                    name="password" 
                    type={isPasswordVisible ? 'text' : 'password'} 
                    required 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    className={`${inputClasses} pr-10`} 
                    placeholder="••••••••"
                  />
                  <button 
                    type="button" 
                    onClick={() => setIsPasswordVisible(!isPasswordVisible)} 
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white" 
                    aria-label={isPasswordVisible ? "Hide password" : "Show password"}
                  >
                      {isPasswordVisible ? <EyeSlashIcon /> : <EyeIcon className="h-5 w-5" />}
                  </button>
                </div>
            </div>

            {error && <p className="text-red-500 dark:text-red-400 text-sm text-center">{error}</p>}

            <div>
                <button 
                  type="submit" 
                  disabled={isLoading} 
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white dark:text-black bg-slate-800 dark:bg-white hover:bg-slate-700 dark:hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 disabled:opacity-50 disabled:cursor-wait transition-all transform hover:scale-105"
                >
                    {isLoading ? <SpinnerIcon /> : 'Unlock'}
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default AuthView;