
import React, { useState, useCallback, useEffect } from 'react';
import { generateVideo } from '../services/geminiService';
import { SpinnerIcon, VideoIcon, ResetIcon } from './icons';

type Resolution = '720p' | '1080p';
type AspectRatio = '16:9' | '9:16';

const resolutions: Resolution[] = ['720p', '1080p'];
const ratios: AspectRatio[] = ['16:9', '9:16'];

const VideoGeneratorView: React.FC = () => {
    const [prompt, setPrompt] = useState<string>('');
    const [selectedResolution, setSelectedResolution] = useState<Resolution>('720p');
    const [selectedRatio, setSelectedRatio] = useState<AspectRatio>('16:9');
    
    // State for API key selection flow, required by Veo
    const [hasSelectedKey, setHasSelectedKey] = useState<boolean | null>(null);

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [loadingMessage, setLoadingMessage] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);

    // Check for API key on component mount
    useEffect(() => {
        const checkApiKey = async () => {
            try {
                // `window.aistudio` is globally available in this environment
                const hasKey = await (window as any).aistudio.hasSelectedApiKey();
                setHasSelectedKey(hasKey);
            } catch (e) {
                console.error("aistudio context not available.", e);
                setHasSelectedKey(false); // Assume no key if context fails
            }
        };
        checkApiKey();
    }, []);
    
    const handleSelectKey = async () => {
        try {
            await (window as any).aistudio.openSelectKey();
            // Optimistically set to true to avoid race conditions.
            // If the key is invalid, the API call will fail and we'll reset this.
            setHasSelectedKey(true);
            setError(null); // Clear previous errors
        } catch (e) {
            console.error("Failed to open API key selection:", e);
            setError("Could not open the API key selection dialog.");
        }
    };

    const startGeneration = useCallback(async () => {
        if (!prompt) {
            setError("Please enter a prompt to generate a video.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setGeneratedVideoUrl(null);

        try {
            const videoUrl = await generateVideo(
                prompt,
                selectedResolution,
                selectedRatio,
                (message) => setLoadingMessage(message)
            );
            setGeneratedVideoUrl(videoUrl);
        } catch (err: any) {
            // Per Veo guidelines, this error indicates an API key issue.
            if (err.message && err.message.includes('Requested entity was not found')) {
                setError("API Key error. Please click 'Select API Key' and choose a valid key with Veo access and billing enabled.");
                setHasSelectedKey(false);
            } else {
                setError(err.message || 'An unknown error occurred.');
            }
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
    }, [prompt, selectedResolution, selectedRatio]);

    const handleStartOver = () => {
        setPrompt('');
        setSelectedResolution('720p');
        setSelectedRatio('16:9');
        setError(null);
        setGeneratedVideoUrl(null);
        setIsLoading(false);
    };

    const isUIReady = hasSelectedKey !== null;
    const isGeneratorDisabled = isLoading || !prompt || !hasSelectedKey;

    const renderApiKeySelection = () => (
        <div className="md:col-span-3 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm p-6 rounded-xl border border-slate-200 dark:border-gray-700 flex flex-col items-center justify-center text-center">
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-3">API Key Required for Veo</h3>
            <p className="text-slate-600 dark:text-gray-400 mb-6 max-w-md">
                Video generation with Veo requires you to select your own API key. Ensure your project has billing enabled to use this feature.
                 <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-cyan-600 dark:text-cyan-400 hover:underline ml-1">Learn more</a>.
            </p>
            <button
                onClick={handleSelectKey}
                className="bg-slate-800 dark:bg-white hover:bg-slate-700 dark:hover:bg-gray-200 text-white dark:text-black font-bold py-3 px-6 rounded-lg transition-transform transform hover:scale-105"
            >
                Select API Key
            </button>
        </div>
    );

    return (
        <div className="animate-fade-in">
            <h2 className="text-3xl font-bold text-center mb-6 text-slate-800 dark:text-white">Text-to-Video Generation</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Conditionally render controls or API key selection */}
                {isUIReady && hasSelectedKey ? (
                    <>
                        {/* Controls */}
                        <div className="md:col-span-1 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm p-6 rounded-xl border border-slate-200 dark:border-gray-700 flex flex-col space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-800 dark:text-white mb-2">1. Your Prompt</label>
                                <textarea
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder="e.g., A neon hologram of a cat driving at top speed"
                                    className="w-full bg-slate-100 dark:bg-gray-900 border border-slate-300 dark:border-gray-700 rounded-lg p-3 focus:ring-2 focus:ring-slate-500 dark:focus:ring-white/50 focus:outline-none transition h-36 resize-none placeholder:text-slate-400 dark:placeholder:text-gray-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-800 dark:text-white mb-2">2. Resolution</label>
                                <div className="flex space-x-2">
                                    {resolutions.map(res => (
                                        <button key={res} onClick={() => setSelectedResolution(res)} className={`px-4 py-2 text-sm rounded-md transition w-full ${selectedResolution === res ? 'bg-slate-800 text-white dark:bg-white dark:text-black font-bold' : 'bg-slate-200 dark:bg-gray-900 text-slate-800 dark:text-white hover:bg-slate-300 dark:hover:bg-gray-800'}`}>
                                            {res.toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-800 dark:text-white mb-2">3. Aspect Ratio</label>
                                <div className="flex space-x-2">
                                    {ratios.map(ratio => (
                                        <button key={ratio} onClick={() => setSelectedRatio(ratio)} className={`px-4 py-2 text-sm rounded-md transition w-full ${selectedRatio === ratio ? 'bg-slate-800 text-white dark:bg-white dark:text-black font-bold' : 'bg-slate-200 dark:bg-gray-900 text-slate-800 dark:text-white hover:bg-slate-300 dark:hover:bg-gray-800'}`}>
                                            {ratio} {ratio === '9:16' ? '(Portrait)' : '(Landscape)'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center space-x-2 pt-2">
                                <button
                                    onClick={startGeneration}
                                    disabled={isGeneratorDisabled}
                                    className="w-full bg-slate-800 dark:bg-white hover:bg-slate-700 dark:hover:bg-gray-200 text-white dark:text-black font-bold py-3 px-4 rounded-lg transition-transform transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                                >
                                    {isLoading ? <SpinnerIcon /> : 'Generate Video'}
                                </button>
                                {generatedVideoUrl && !isLoading && (
                                     <button
                                        onClick={handleStartOver}
                                        className="flex-shrink-0 bg-slate-500 hover:bg-slate-600 dark:bg-gray-600 dark:hover:bg-gray-500 text-white font-bold p-3 rounded-lg transition-colors"
                                        title="Start Over"
                                    >
                                        <ResetIcon />
                                    </button>
                                )}
                            </div>
                            {error && <p className="text-red-500 dark:text-red-400 text-sm mt-2">{error}</p>}
                        </div>

                        {/* Video Display */}
                        <div className="md:col-span-2 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm p-6 rounded-xl border border-slate-200 dark:border-gray-700 min-h-[400px] flex items-center justify-center">
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center text-center">
                                    <SpinnerIcon />
                                    <p className="mt-4 text-slate-600 dark:text-gray-400 animate-pulse">{loadingMessage || 'Initializing...'}</p>
                                    <p className="mt-2 text-sm text-slate-500 dark:text-gray-500">Video generation may take several minutes.</p>
                                </div>
                            ) : generatedVideoUrl ? (
                                <div className="w-full">
                                    <video
                                        src={generatedVideoUrl}
                                        controls
                                        autoPlay
                                        loop
                                        className={`w-full rounded-lg shadow-lg ${selectedRatio === '9:16' ? 'max-w-xs mx-auto' : 'w-full'}`}
                                    >
                                        Your browser does not support the video tag.
                                    </video>
                                    <a
                                        href={generatedVideoUrl}
                                        download={`spark-video-${prompt.substring(0, 20).replace(/[^a-zA-Z0-9]/g, '_') || 'creation'}.mp4`}
                                        className="mt-4 w-full bg-slate-800 dark:bg-white hover:bg-slate-700 dark:hover:bg-gray-200 text-white dark:text-black font-bold py-3 px-4 rounded-lg transition-transform transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                                    >
                                        Download Video
                                    </a>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center text-slate-500 dark:text-gray-400">
                                   <VideoIcon className="h-16 w-16" />
                                   <p className="mt-4">Your generated video will appear here</p>
                                </div>
                            )}
                        </div>
                    </>
                ) : isUIReady && !hasSelectedKey ? (
                    // Show API Key selection UI across all columns
                    renderApiKeySelection()
                ) : (
                    // Initial loading state
                    <div className="md:col-span-3 flex items-center justify-center h-full min-h-[400px]">
                        <SpinnerIcon />
                    </div>
                )}
            </div>
        </div>
    );
};

export default VideoGeneratorView;
