
import React, { useState } from 'react';
import { SpinnerIcon, EyeIcon, EyeSlashIcon } from './icons';

interface AuthViewProps {
  onLoginSuccess: () => void;
}

type AuthMode = 'signup' | 'login' | 'forgotPassword';
type ForgotPasswordStep = 'enterEmail' | 'resetPassword';

const AuthView: React.FC<AuthViewProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<AuthMode>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [forgotPasswordStep, setForgotPasswordStep] = useState<ForgotPasswordStep>('enterEmail');

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    // Simulate network delay for user feedback
    setTimeout(() => {
      switch (mode) {
        case 'login':
          handleLogin();
          break;
        case 'signup':
          handleSignUp();
          break;
        case 'forgotPassword':
          handleForgotPassword();
          break;
      }
      setIsLoading(false);
    }, 1000);
  };
  
  const getUsers = () => {
    const storedUsers = localStorage.getItem('spark-users');
    return storedUsers ? JSON.parse(storedUsers) : [];
  };
  
  const setUsers = (users: any[]) => {
      localStorage.setItem('spark-users', JSON.stringify(users));
  };

  const handleLogin = () => {
    const users = getUsers();
    const user = users.find((u: any) => u.email === email);
    
    if (user && user.password === password) {
        localStorage.setItem('spark-session', 'true');
        onLoginSuccess();
    } else {
      setError('Invalid email or password.');
    }
  };

  const handleSignUp = () => {
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    
    const users = getUsers();
    const existingUser = users.find((u: any) => u.email === email);

    if (existingUser) {
        setError('This email is already registered. Please login.');
        setMode('login');
        return;
    }

    const updatedUsers = [...users, { email, password }];
    setUsers(updatedUsers);

    localStorage.setItem('spark-session', 'true');
    onLoginSuccess();
  };
  
  const handleForgotPassword = () => {
    const users = getUsers();
    
    if (forgotPasswordStep === 'enterEmail') {
        const userExists = users.some((u: any) => u.email === email);
        if (userExists) {
            setForgotPasswordStep('resetPassword');
            setSuccess('Account found. Please enter a new password.');
        } else {
            setError('No account found with that email address.');
        }
    } else { // resetPassword step
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }
        if (newPassword.length < 6) {
            setError('Password must be at least 6 characters long.');
            return;
        }
        
        const updatedUsers = users.map((u: any) => 
            u.email === email ? { ...u, password: newPassword } : u
        );
        setUsers(updatedUsers);
        
        // Reset state and switch to login mode
        setSuccess('Password has been successfully reset. Please log in.');
        setMode('login');
        setForgotPasswordStep('enterEmail');
        setPassword('');
        setNewPassword('');
        setConfirmPassword('');
    }
  };

  const clearState = () => {
      setError(null);
      setSuccess(null);
      setPassword('');
      setNewPassword('');
      setConfirmPassword('');
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    clearState();
  };

  const renderFormContent = () => {
    const inputClasses = "w-full bg-slate-200 dark:bg-gray-800 border border-slate-300 dark:border-gray-600 rounded-lg p-3 text-slate-800 dark:text-white placeholder-slate-500 dark:placeholder-gray-500 focus:ring-2 focus:ring-cyan-500 focus:outline-none transition";
    
    if (mode === 'forgotPassword') {
        return (
            <>
                {forgotPasswordStep === 'enterEmail' ? (
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-slate-600 dark:text-gray-300">
                            Email Address
                        </label>
                        <div className="mt-1">
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className={inputClasses}
                                placeholder="Enter your registered email"
                            />
                        </div>
                    </div>
                ) : (
                    <>
                        <div>
                            <label htmlFor="new-password"className="block text-sm font-medium text-slate-600 dark:text-gray-300">
                                New Password
                            </label>
                            <div className="mt-1">
                                <input id="new-password" name="new-password" type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClasses} placeholder="••••••••"
                                />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="confirm-password"className="block text-sm font-medium text-slate-600 dark:text-gray-300">
                                Confirm New Password
                            </label>
                            <div className="mt-1">
                                <input id="confirm-password" name="confirm-password" type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClasses} placeholder="••••••••"
                                />
                            </div>
                        </div>
                    </>
                )}
            </>
        )
    }

    return (
        <>
            <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-600 dark:text-gray-300">
                  Email Address
                </label>
                <div className="mt-1">
                  <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClasses} placeholder="you@example.com"
                  />
                </div>
            </div>
            <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-600 dark:text-gray-300">
                  Password
                </label>
                <div className="mt-1 relative">
                  <input id="password" name="password" type={isPasswordVisible ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputClasses} pr-10`} placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setIsPasswordVisible(!isPasswordVisible)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white" aria-label={isPasswordVisible ? "Hide password" : "Show password"}>
                      {isPasswordVisible ? <EyeSlashIcon /> : <EyeIcon className="h-5 w-5" />}
                  </button>
                </div>
            </div>
        </>
    )
  }

  const getTitle = () => {
      switch(mode) {
          case 'login': return 'Welcome back';
          case 'signup': return 'Create your account';
          case 'forgotPassword': return 'Reset Your Password';
          default: return '';
      }
  }

  const getButtonText = () => {
    if (isLoading) return <SpinnerIcon />;
    switch(mode) {
        case 'login': return 'Login';
        case 'signup': return 'Sign Up';
        case 'forgotPassword': 
            return forgotPasswordStep === 'enterEmail' ? 'Find Account' : 'Reset Password';
        default: return '';
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 animate-fade-in bg-slate-50 dark:bg-black">
      <div className="w-full max-w-md bg-white dark:bg-gray-900/50 backdrop-blur-lg border border-slate-300 dark:border-gray-700 rounded-2xl shadow-2xl p-8">
        <div className="flex flex-col items-center mb-6">
            <h1 className="text-4xl font-bold text-center text-slate-800 dark:text-white">
              Assistant Spark
            </h1>
            <p className="text-center text-slate-600 dark:text-gray-300 mt-2">
              {getTitle()}
            </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
            {renderFormContent()}
            
            {mode === 'login' && (
                <div className="flex items-center justify-end">
                    <div className="text-sm">
                        <button type="button" onClick={() => switchMode('forgotPassword')} className="font-medium text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 dark:hover:text-cyan-300 focus:outline-none focus:underline">
                            Forgot password?
                        </button>
                    </div>
                </div>
            )}

            {error && <p className="text-red-500 dark:text-red-400 text-sm text-center">{error}</p>}
            {success && <p className="text-green-500 dark:text-green-400 text-sm text-center">{success}</p>}

            <div>
                <button type="submit" disabled={isLoading} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white dark:text-black bg-slate-800 dark:bg-white hover:bg-slate-700 dark:hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 disabled:opacity-50 disabled:cursor-wait transition-all transform hover:scale-105">
                    {getButtonText()}
                </button>
            </div>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600 dark:text-gray-400">
            {mode === 'login' ? "Don't have an account?" : (mode === 'signup' ? "Already have an account?" : "")}{' '}
            {mode !== 'forgotPassword' && (
                <button onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')} className="font-medium text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 dark:hover:text-cyan-300 focus:outline-none focus:underline">
                    {mode === 'login' ? 'Sign Up' : 'Login'}
                </button>
            )}
             {mode === 'forgotPassword' && (
                <button onClick={() => switchMode('login')} className="font-medium text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 dark:hover:text-cyan-300 focus:outline-none focus:underline">
                    Back to Login
                </button>
            )}
        </p>
      </div>
    </div>
  );
};

export default AuthView;
