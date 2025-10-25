import React, { useState, useRef, useEffect } from 'react';
import { generateSpeech } from '../services/geminiService';
import { voices } from '../types';
import { SpeakerIcon, SpinnerIcon, CheckIcon } from './icons';

interface VoiceSelectionViewProps {
  currentVoice: string;
  onVoiceSelect: (voiceId: string) => void;
}

// Helper function to decode base64
function decode(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

// Helper function to convert raw PCM to a WAV Blob
function pcmToWavBlob(pcmData: Uint8Array): Blob {
    const sampleRate = 24000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const dataSize = pcmData.length;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const byteRate = sampleRate * blockAlign;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const writeString = (view: DataView, offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };

    /* RIFF header */
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');
    /* "fmt " sub-chunk */
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // 16 for PCM
    view.setUint16(20, 1, true); // Audio format 1 for PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    /* "data" sub-chunk */
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Write PCM data from the Uint8Array
    for (let i = 0; i < pcmData.length; i++) {
        view.setUint8(44 + i, pcmData[i]);
    }

    return new Blob([view.buffer], { type: 'audio/wav' });
}

const VoiceSelectionView: React.FC<VoiceSelectionViewProps> = ({ currentVoice, onVoiceSelect }) => {
    const [playingVoice, setPlayingVoice] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const playSample = async (voiceId: string, voiceName: string) => {
        if (playingVoice) return; // Don't allow multiple plays at once

        // Stop any currently playing audio from a previous sample
        if (audioRef.current) {
            audioRef.current.pause();
            URL.revokeObjectURL(audioRef.current.src);
            audioRef.current = null;
        }
        
        setPlayingVoice(voiceId);
        setError(null);
        try {
            const text = `Hello, this is what ${voiceName.toLowerCase()} sounds like.`;
            const audioB64 = await generateSpeech(text, voiceId);
            
            const pcmData = decode(audioB64);
            const wavBlob = pcmToWavBlob(pcmData);
            const audioUrl = URL.createObjectURL(wavBlob);
            
            const audio = new Audio(audioUrl);
            audioRef.current = audio;

            audio.play();

            const onEnd = () => {
                setPlayingVoice(null);
                URL.revokeObjectURL(audioUrl);
                audioRef.current = null;
            };

            audio.onended = onEnd;
            audio.onerror = () => {
                setError('Could not play audio sample. Please try again.');
                console.error("Audio playback error");
                onEnd(); // Also run cleanup on error
            };

        } catch (err: any) {
            setError('Could not play audio sample. Please try again.');
            console.error(err);
            setPlayingVoice(null);
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                URL.revokeObjectURL(audioRef.current.src);
            }
        };
    }, []);
    
    return (
        <div className="animate-fade-in">
            <h2 className="text-3xl font-bold text-center mb-8 text-slate-800 dark:text-white">Select a Voice</h2>
            {error && <p className="text-center text-red-500 dark:text-red-400 mb-4">{error}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
                {voices.map((voice) => (
                    <div 
                        key={voice.id}
                        onClick={() => onVoiceSelect(voice.id)}
                        className={`bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm p-6 rounded-xl border transition-all duration-300 cursor-pointer ${
                            currentVoice === voice.id 
                                ? 'border-cyan-500 dark:border-cyan-400 ring-2 ring-cyan-500/50 dark:ring-cyan-400/50' 
                                : 'border-slate-200 dark:border-gray-700 hover:border-slate-400 dark:hover:border-gray-500'
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-white">{voice.name}</h3>
                                <p className="text-sm text-slate-500 dark:text-gray-400">{voice.gender}</p>
                            </div>
                            <div className="flex items-center space-x-4">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        playSample(voice.id, voice.name);
                                    }}
                                    disabled={!!playingVoice}
                                    className="bg-slate-200 dark:bg-gray-800 p-3 rounded-full hover:bg-slate-300 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-wait transition-colors"
                                    aria-label={`Play sample for ${voice.name}`}
                                >
                                    {playingVoice === voice.id ? <SpinnerIcon /> : <SpeakerIcon />}
                                </button>
                                {currentVoice === voice.id && (
                                    <div className="text-cyan-500 dark:text-cyan-400">
                                       <CheckIcon className="h-6 w-6" />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default VoiceSelectionView;