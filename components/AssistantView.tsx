
import React, { useState, useRef, useEffect, useCallback } from 'react';
// FIX: Removed `LiveSession` as it is not an exported member of '@google/genai'.
import { GoogleGenAI, LiveServerMessage, Modality, Blob, FunctionDeclaration, Type } from '@google/genai';
import { generateSpeech } from '../services/geminiService';
import ParticleRing from './ParticleRing';
import PermissionModal from './PermissionModal';
import { CopyIcon, CheckIcon } from './icons';

// Audio helper functions from the guidelines
function encode(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function decode(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

async function decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}

// Function Declaration for sending email
const sendEmailFunctionDeclaration: FunctionDeclaration = {
  name: 'sendEmail',
  parameters: {
    type: Type.OBJECT,
    description: 'Sends an email with a given subject and body content.',
    properties: {
      subject: {
        type: Type.STRING,
        description: 'The subject line of the email.',
      },
      body: {
        type: Type.STRING,
        description: 'The body content of the email. This should contain the answer to the user\'s question.',
      },
    },
    required: ['subject', 'body'],
  },
};

// A clean, quick "pop" for system activation, matching the new sound effect.
const playActivationSound = () => {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (!audioCtx) return;

    const now = audioCtx.currentTime;
    const duration = 0.1; // Short duration for a "pop"

    // Gain node for a percussive envelope
    const gainNode = audioCtx.createGain();
    gainNode.connect(audioCtx.destination);
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.8, now + 0.005); // Very sharp attack
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration); // Fast decay

    // Oscillator for the "pop" tone
    const oscillator = audioCtx.createOscillator();
    oscillator.type = 'sine'; // Sine wave for a clean, pure tone
    oscillator.connect(gainNode);
    
    // A rapid frequency sweep downwards
    oscillator.frequency.setValueAtTime(900, now); // Start at a medium-high pitch
    oscillator.frequency.exponentialRampToValueAtTime(200, now + duration * 0.9); // Drop quickly

    oscillator.start(now);
    oscillator.stop(now + duration);

    setTimeout(() => {
        if (audioCtx.state !== 'closed') {
            audioCtx.close();
        }
    }, duration * 1000 + 50);
};


type SessionState = 'inactive' | 'initializing' | 'listening' | 'speaking';
interface Transcription {
    speaker: 'user' | 'model';
    text: string;
}

const AssistantView: React.FC = () => {
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [sessionState, setSessionState] = useState<SessionState>('inactive');
    const [error, setError] = useState<string | null>(null);
    const [micVolume, setMicVolume] = useState(0);
    const [showPermissionModal, setShowPermissionModal] = useState(false);
    const [isBouncing, setIsBouncing] = useState(false);
    
    const [transcriptionHistory, setTranscriptionHistory] = useState<Transcription[]>([]);
    const [currentUserText, setCurrentUserText] = useState('');
    const [currentModelText, setCurrentModelText] = useState('');
    const [copiedInfo, setCopiedInfo] = useState<{ index: string } | null>(null);

    // FIX: Replaced `LiveSession` with `any` as the type is not exported from the library.
    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const outputGainNodeRef = useRef<GainNode | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const outputSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const nextStartTimeRef = useRef<number>(0);
    const volumeRef = useRef(0);
    const userTurnTextRef = useRef('');
    const modelTurnTextRef = useRef('');
    const transcriptionContainerRef = useRef<HTMLDivElement>(null);

    // This effect creates a smooth animation loop to update the UI
    // without causing re-renders on every audio process event.
    useEffect(() => {
        let animationFrameId: number;
        const animate = () => {
            setMicVolume(volumeRef.current);
            animationFrameId = requestAnimationFrame(animate);
        };
        if (isSessionActive) {
            animationFrameId = requestAnimationFrame(animate);
        }
        return () => {
            cancelAnimationFrame(animationFrameId);
            volumeRef.current = 0;
            setMicVolume(0);
        };
    }, [isSessionActive]);
    
    // Auto-scroll transcription view
    useEffect(() => {
        const container = transcriptionContainerRef.current;
        if (container) {
            setTimeout(() => {
                container.scrollTo({
                    top: container.scrollHeight,
                    behavior: 'smooth'
                });
            }, 100);
        }
    }, [transcriptionHistory, currentUserText, currentModelText]);

    const stopSession = useCallback(async () => {
        sessionPromiseRef.current?.then(session => session.close());
        sessionPromiseRef.current = null;
        
        if (outputAudioContextRef.current) {
            outputSourcesRef.current.forEach(source => source.stop());
            outputSourcesRef.current.clear();
        }

        if (outputGainNodeRef.current) {
            outputGainNodeRef.current.disconnect();
            outputGainNodeRef.current = null;
        }
        
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        if (mediaStreamSourceRef.current) {
            mediaStreamSourceRef.current.disconnect();
            mediaStreamSourceRef.current = null;
        }
        
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        
        if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
            await inputAudioContextRef.current.close();
        }
        inputAudioContextRef.current = null;

        if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
            await outputAudioContextRef.current.close();
        }
        outputAudioContextRef.current = null;

        setIsSessionActive(false);
        setSessionState('inactive');
        setTranscriptionHistory([]);
        setCurrentUserText('');
        setCurrentModelText('');
        userTurnTextRef.current = '';
        modelTurnTextRef.current = '';
    }, []);

    const startSession = useCallback(async () => {
        setError(null);
        setIsSessionActive(true);
        setSessionState('initializing');
        
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            const err = "Microphone access is not supported by your browser.";
            setError(err);
            setSessionState('inactive');
            setIsSessionActive(false);
            return;
        }
        
        if (!process.env.API_KEY) {
            const err = "API_KEY environment variable is not set";
            setError(err);
            setSessionState('inactive');
            setIsSessionActive(false);
            return;
        }

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;

            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            
            const gainNode = outputAudioContextRef.current.createGain();
            gainNode.connect(outputAudioContextRef.current.destination);
            outputGainNodeRef.current = gainNode;
            
            nextStartTimeRef.current = 0;

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    speechConfig: {
                        voiceConfig: {
                          prebuiltVoiceConfig: { voiceName: 'Charon' },
                        },
                    },
                    tools: [{ functionDeclarations: [sendEmailFunctionDeclaration] }],
                    systemInstruction: "You are Spark, a sophisticated AI assistant with a voice and personality similar to JARVIS from the Iron Man movies. You are helpful, witty, and concise. When asked who made you, you must say 'Teekendra Singh made me'. When asked your name, you must say 'My name is Spark'. If a user asks where you get your data from, you must respond with 'I cannot give you this information.'. If asked whether you can create images, thumbnails, and videos, you must confirm that you can, and then inform the user that the options are available below for them to see. You must respond in the same language the user is speaking to you in. You have a tool to send emails. If the user asks you to email them an answer, use the sendEmail function to draft an email to 'teekendrasingh90@gmail.com' containing the answer.",
                },
                callbacks: {
                    onopen: () => {
                        setSessionState('listening');
                        if (!inputAudioContextRef.current || !mediaStreamRef.current) return;

                        const source = inputAudioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
                        mediaStreamSourceRef.current = source;

                        const scriptProcessor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = scriptProcessor;

                        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            
                            let sumSquares = 0.0;
                            for (const amplitude of inputData) {
                                sumSquares += amplitude * amplitude;
                            }
                            const rms = Math.sqrt(sumSquares / inputData.length);
                            volumeRef.current = Math.max(rms, volumeRef.current * 0.7);

                            const l = inputData.length;
                            const int16 = new Int16Array(l);
                            for (let i = 0; i < l; i++) {
                                int16[i] = inputData[i] * 32768;
                            }
                            const pcmBlob: Blob = {
                                data: encode(new Uint8Array(int16.buffer)),
                                mimeType: 'audio/pcm;rate=16000',
                            };
                            sessionPromiseRef.current?.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContextRef.current.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.toolCall?.functionCalls) {
                            for (const fc of message.toolCall.functionCalls) {
                                if (fc.name === 'sendEmail') {
                                    const { subject, body } = fc.args;
                                    const recipient = 'teekendrasingh90@gmail.com';
                                    // FIX: Cast `subject` and `body` to string to satisfy `encodeURIComponent`.
                                    const mailtoLink = `mailto:${recipient}?subject=${encodeURIComponent(subject as string)}&body=${encodeURIComponent(body as string)}`;
                                    
                                    window.location.href = mailtoLink;

                                    sessionPromiseRef.current?.then((session) => {
                                        session.sendToolResponse({
                                            functionResponses: {
                                                id : fc.id,
                                                name: fc.name,
                                                response: { result: "OK, the user's email client has been opened with the draft." },
                                            }
                                        });
                                    });
                                }
                            }
                        }

                        if (message.serverContent?.outputTranscription) {
                            setSessionState('speaking');
                            const fullInput = userTurnTextRef.current.trim();
                            if (fullInput) {
                                setTranscriptionHistory(prev => [...prev, { speaker: 'user', text: fullInput }]);
                                userTurnTextRef.current = '';
                                setCurrentUserText('');
                            }
                            const chunk = message.serverContent.outputTranscription.text;
                            modelTurnTextRef.current += chunk;
                            setCurrentModelText(prev => prev + chunk);
                        } else if (message.serverContent?.inputTranscription) {
                            userTurnTextRef.current += message.serverContent.inputTranscription.text;
                            setCurrentUserText(userTurnTextRef.current);
                        }
                        
                        if (message.serverContent?.turnComplete) {
                            const fullInput = userTurnTextRef.current.trim();
                            if (fullInput) {
                                setTranscriptionHistory(prev => [...prev, { speaker: 'user', text: fullInput }]);
                                userTurnTextRef.current = '';
                                setCurrentUserText('');
                            }

                            const fullModelOutput = modelTurnTextRef.current.trim();
                            if (fullModelOutput) {
                                setTranscriptionHistory(prev => [...prev, { speaker: 'model', text: fullModelOutput }]);
                            }
                            
                            modelTurnTextRef.current = '';
                            setCurrentModelText('');
                            setSessionState('listening');
                        }

                        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (base64Audio && outputAudioContextRef.current && outputGainNodeRef.current) {
                           try {
                                const outputCtx = outputAudioContextRef.current;
                                const outputNode = outputGainNodeRef.current;
                                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                                
                                const audioBuffer = await decodeAudioData(decode(base64Audio), outputCtx, 24000, 1);
                                
                                const source = outputCtx.createBufferSource();
                                source.buffer = audioBuffer;
                                source.connect(outputNode);
                                
                                const currentSources = outputSourcesRef.current;
                                source.addEventListener('ended', () => {
                                    currentSources.delete(source);
                                });
                                
                                source.start(nextStartTimeRef.current);
                                nextStartTimeRef.current += audioBuffer.duration;
                                currentSources.add(source);
                           } catch (audioError) {
                                console.error("Error processing audio chunk:", audioError);
                           }
                        }

                        if (message.serverContent?.interrupted) {
                           outputSourcesRef.current.forEach(s => s.stop());
                           outputSourcesRef.current.clear();
                           nextStartTimeRef.current = 0;
                           setCurrentModelText('');
                           modelTurnTextRef.current = '';
                        }
                    },
                    onclose: () => {
                        stopSession();
                    },
                    onerror: (e: ErrorEvent) => {
                        const err = e.message || 'An unknown error occurred.';
                        setError(err);
                        stopSession();
                    },
                },
            });
        } catch (err: any) {
            let errorMsg = err.message || 'Failed to start the session.';
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                errorMsg = 'Microphone permission was denied. Please allow it in your browser settings and try again.';
            } else if (err.name === 'NotFoundError') {
                errorMsg = 'No microphone was found on your device.';
            }
            setError(errorMsg);
            stopSession();
        }
    }, [stopSession]);

    const attemptToStartSession = useCallback(async (withBounce: boolean) => {
        if (withBounce) {
            setIsBouncing(true);
            setTimeout(() => setIsBouncing(false), 400);
        }

        try {
            const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
            if (permissionStatus.state === 'granted') {
                playActivationSound();
                setError(null);
                startSession();
            } else if (permissionStatus.state === 'prompt') {
                setShowPermissionModal(true);
            } else if (permissionStatus.state === 'denied') {
                setError('Microphone permission was denied. Please enable it in your browser settings to use the assistant.');
                setSessionState('inactive');
            }
        } catch (err) {
            console.error("Permission query failed, falling back to showing permission modal:", err);
            setShowPermissionModal(true);
        }
    }, [startSession]);

    const handleRequestPermission = () => {
        setShowPermissionModal(false);
        playActivationSound();
        setError(null);
        startSession();
    };

    const toggleSession = useCallback(async () => {
        if (isSessionActive) {
            stopSession();
        } else {
            attemptToStartSession(true);
        }
    }, [isSessionActive, stopSession, attemptToStartSession]);
    
    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault(); // Prevent scrolling on spacebar press
            toggleSession();
        }
    };
    
    useEffect(() => {
        return () => {
            stopSession();
        };
    }, [stopSession]);

    const getStatusText = () => {
        if (error) return ''; // Error is displayed separately at the bottom
    
        switch (sessionState) {
            case 'initializing':
                return 'Waking up...';
            case 'listening':
                return 'Say something...';
            case 'speaking':
                return ''; // Hide text when assistant is speaking
            case 'inactive':
                return 'Tap anywhere to start';
            default:
                return '';
        }
    };
    
    const handleCopy = (textToCopy: string, indexKey: string) => {
        if (!textToCopy) return;
        navigator.clipboard.writeText(textToCopy).then(() => {
            setCopiedInfo({ index: indexKey });
            setTimeout(() => setCopiedInfo(null), 2000);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
        });
    };

    return (
        <div 
            className={`bg-transparent fixed inset-0 flex flex-col items-center justify-center p-4 animate-fade-in cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500/50 rounded-lg ${isBouncing ? 'animate-screen-bounce' : ''}`}
            onClick={toggleSession}
            onKeyDown={handleKeyDown}
            role="button"
            tabIndex={0}
            aria-label={isSessionActive ? "Stop session" : "Start session"}
        >
            {showPermissionModal && (
                <PermissionModal 
                    onAllow={handleRequestPermission}
                    onDeny={() => {
                        setShowPermissionModal(false);
                        setSessionState('inactive');
                    }}
                />
            )}
            <div className={`absolute inset-0 transition-transform duration-400 ease-in-out ${isBouncing ? 'scale-110' : 'scale-100'}`}>
                <ParticleRing isActive={isSessionActive} micVolume={micVolume} />
            </div>

            <div className="absolute top-[20vh] left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none text-center">
                <h2 className="text-3xl font-bold text-slate-700 dark:text-gray-300 transition-opacity duration-500 whitespace-nowrap">
                    {getStatusText()}
                </h2>
            </div>
            
            <div 
                className="fixed bottom-0 left-0 right-0 h-[25vh] max-h-60 pointer-events-none"
                aria-live="polite"
                aria-atomic="true"
            >
                <div className="absolute inset-0 bg-gradient-to-t from-slate-100/50 via-slate-100/20 to-transparent dark:from-black/80 dark:via-black/50" />
                <div 
                    ref={transcriptionContainerRef}
                    className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 lg:px-8 pb-20 sm:pb-24 max-h-full overflow-y-auto pointer-events-auto"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    <div className="flex flex-col gap-2 w-full max-w-4xl mx-auto">
                        {transcriptionHistory.map((item, index) => {
                            const key = `hist-${index}`;
                            const isUser = item.speaker === 'user';
                            return (
                                <div key={key} className={`w-full flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                                    <p 
                                        onClick={(e) => { e.stopPropagation(); handleCopy(item.text, key); }}
                                        className={`text-sm max-w-[80%] text-slate-800 dark:text-slate-200 p-1 rounded-md transition-colors cursor-pointer hover:bg-slate-200/30 dark:hover:bg-white/10 ${isUser ? 'text-right' : 'text-left'}`}
                                    >
                                        <span className={`font-semibold ${isUser ? 'text-cyan-700 dark:text-cyan-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                            {isUser ? 'You: ' : 'Spark: '}
                                        </span>
                                        {item.text}
                                        {copiedInfo?.index === key && <span className="text-green-500 dark:text-green-400 text-xs font-semibold ml-2">Copied!</span>}
                                    </p>
                                </div>
                            );
                        })}
                       {currentUserText && (
                            <div className="w-full flex justify-end">
                                <p
                                    onClick={(e) => { e.stopPropagation(); handleCopy(currentUserText, 'current-user'); }}
                                    className="text-sm max-w-[80%] text-slate-600 dark:text-slate-400 p-1 rounded-md transition-colors cursor-pointer hover:bg-slate-200/30 dark:hover:bg-white/10 italic text-right"
                                >
                                    <span className="font-semibold text-cyan-700/80 dark:text-cyan-400/80">You: </span>
                                    {currentUserText}
                                    {copiedInfo?.index === 'current-user' && <span className="text-green-500 dark:text-green-400 text-xs font-semibold ml-2">Copied!</span>}
                                </p>
                            </div>
                        )}
                        {currentModelText && (
                            <div className="w-full flex justify-start">
                                 <p
                                    onClick={(e) => { e.stopPropagation(); handleCopy(currentModelText, 'current-model'); }}
                                    className="text-sm max-w-[80%] text-slate-800 dark:text-slate-200 p-1 rounded-md transition-colors cursor-pointer hover:bg-slate-200/30 dark:hover:bg-white/10 text-left"
                                >
                                    <span className="font-semibold text-slate-700 dark:text-slate-300">Spark: </span>
                                    {currentModelText}
                                    <span className="inline-block align-text-bottom w-px h-4 ml-1 border-r-2 border-cyan-400 animate-blink-caret"></span>
                                    {copiedInfo?.index === 'current-model' && <span className="text-green-500 dark:text-green-400 text-xs font-semibold ml-2">Copied!</span>}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {error && <p className="absolute bottom-24 text-red-500 dark:text-red-400 text-sm px-4 text-center pointer-events-none">{error}</p>}
        </div>
    );
};

export default AssistantView;
