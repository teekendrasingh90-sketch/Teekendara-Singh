
import React, { useState, useEffect, useRef } from 'react';
import { VoiceOption } from '../types';
import { SpinnerIcon, PlusIcon, SpeakerIcon, TrashIcon, CheckIcon } from './icons';
import { generateSpeech } from '../services/geminiService';


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

    for (let i = 0; i < pcmData.length; i++) {
        view.setUint8(44 + i, pcmData[i]);
    }

    return new Blob([view.buffer], { type: 'audio/wav' });
}


const getClonedVoices = (): VoiceOption[] => {
    try {
        const voicesJson = localStorage.getItem('spark-cloned-voices');
        return voicesJson ? JSON.parse(voicesJson) : [];
    } catch (e) {
        console.error("Failed to parse cloned voices from localStorage", e);
        return [];
    }
};

const saveClonedVoices = (voices: VoiceOption[]) => {
    localStorage.setItem('spark-cloned-voices', JSON.stringify(voices));
};

interface VoiceCloneViewProps {
    currentVoice: string;
    onVoiceSelect: (voiceId: string) => void;
}

const VoiceCloneView: React.FC<VoiceCloneViewProps> = ({ currentVoice, onVoiceSelect }) => {
    const [clonedVoices, setClonedVoices] = useState<VoiceOption[]>(getClonedVoices);
    const [newVoiceName, setNewVoiceName] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [playingVoice, setPlayingVoice] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                setError("File is too large. Please upload a file under 5MB.");
                return;
            }
            setSelectedFile(file);
            // Auto-fill voice name if empty
            if (!newVoiceName) {
                setNewVoiceName(file.name.replace(/\.[^/.]+$/, "").replace(/_/g, ' '));
            }
            setError(null);
        }
    };

    const handleClone = () => {
        if (!selectedFile || !newVoiceName.trim()) {
            setError("Please select an audio file and provide a name for the voice.");
            return;
        }
        setIsLoading(true);
        setError(null);

        // Simulate cloning process
        setTimeout(() => {
            const newVoice: VoiceOption = {
                id: `cloned-${Date.now()}`,
                name: newVoiceName.trim(),
                fileName: selectedFile.name,
                gender: 'Cloned',
                type: 'cloned',
            };
            const updatedVoices = [...clonedVoices, newVoice];
            saveClonedVoices(updatedVoices);
            setClonedVoices(updatedVoices);
            setNewVoiceName('');
            setSelectedFile(null);
            if(fileInputRef.current) fileInputRef.current.value = "";
            setIsLoading(false);
        }, 1000);
    };

    const handleDelete = (voiceId: string) => {
        const updatedVoices = clonedVoices.filter(v => v.id !== voiceId);
        saveClonedVoices(updatedVoices);
        setClonedVoices(updatedVoices);
    };
    
    const playSample = async (voice: VoiceOption) => {
        if (playingVoice) return;

        if (audioRef.current) {
            audioRef.current.pause();
            URL.revokeObjectURL(audioRef.current.src);
            audioRef.current = null;
        }
        
        setPlayingVoice(voice.id);
        setError(null);
        try {
            // Since we can't use the actual cloned voice, we use a pre-built one for the sample audio.
            const text = `This is a sample of the voice named ${voice.name}.`;
            const audioB64 = await generateSpeech(text, 'Kore');
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
            audio.onerror = () => { onEnd(); };

        } catch (err: any) {
            setError('Could not play audio sample.');
            console.error(err);
            setPlayingVoice(null);
        }
    };

    return (
        <div className="animate-fade-in max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-8 text-slate-800 dark:text-white">Clone a Voice</h2>
            
            <div className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm p-6 rounded-xl border border-slate-200 dark:border-gray-700 mb-8">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Create New Clone</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    <div>
                        <label className="block text-sm font-medium text-slate-800 dark:text-white mb-2">1. Upload Audio Sample</label>
                        <label htmlFor="voice-upload" className="w-full flex items-center justify-center gap-2 bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-gray-700 font-semibold py-3 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border border-slate-300 dark:border-gray-600">
                           <PlusIcon className="h-5 w-5" /> {selectedFile ? selectedFile.name : 'Choose file (MP3, WAV)'}
                        </label>
                        <input id="voice-upload" type="file" ref={fileInputRef} onChange={handleFileChange} accept="audio/mp3, audio/wav, audio/mpeg" className="hidden" />
                    </div>
                    <div>
                         <label htmlFor="voice-name" className="block text-sm font-medium text-slate-800 dark:text-white mb-2">2. Give it a Name</label>
                         <input id="voice-name" type="text" value={newVoiceName} onChange={e => setNewVoiceName(e.target.value)} placeholder="e.g., My Custom Voice" className="w-full bg-slate-100 dark:bg-gray-900 border border-slate-300 dark:border-gray-700 rounded-lg p-3 focus:ring-2 focus:ring-slate-500 dark:focus:ring-white/50 focus:outline-none transition" />
                    </div>
                </div>
                <button onClick={handleClone} disabled={isLoading || !selectedFile || !newVoiceName.trim()} className="mt-4 w-full bg-slate-800 dark:bg-white hover:bg-slate-700 dark:hover:bg-gray-200 text-white dark:text-black font-bold py-3 px-4 rounded-lg transition-transform transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center">
                    {isLoading ? <SpinnerIcon /> : 'Create Clone'}
                </button>
                 {error && <p className="text-red-500 dark:text-red-400 text-sm mt-2 text-center">{error}</p>}
            </div>

            <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Your Cloned Voices</h3>
                {clonedVoices.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {clonedVoices.map((voice) => (
                             <div key={voice.id} onClick={() => onVoiceSelect(voice.id)} className={`bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm p-4 rounded-xl border-2 transition-all duration-300 cursor-pointer ${currentVoice === voice.id ? 'border-cyan-500 dark:border-cyan-400' : 'border-slate-200 dark:border-gray-700 hover:border-slate-400 dark:hover:border-gray-500'}`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex-1 overflow-hidden">
                                        <h4 className="text-md font-bold text-slate-800 dark:text-white truncate" title={voice.name}>{voice.name}</h4>
                                        <p className="text-xs text-slate-500 dark:text-gray-400 truncate" title={voice.fileName}>{voice.fileName}</p>
                                    </div>
                                     {currentVoice === voice.id && <div className="text-cyan-500 dark:text-cyan-400 ml-2 flex-shrink-0"><CheckIcon className="h-6 w-6" /></div>}
                                </div>
                                <div className="flex items-center justify-end gap-2 mt-4">
                                     <button onClick={(e) => { e.stopPropagation(); playSample(voice); }} disabled={!!playingVoice} className="bg-slate-200 dark:bg-gray-800 p-2 rounded-full hover:bg-slate-300 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"><SpeakerIcon /></button>
                                     <button onClick={(e) => { e.stopPropagation(); handleDelete(voice.id); }} className="bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 dark:hover:text-red-300 p-2 rounded-full transition-colors"><TrashIcon /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-center text-slate-500 dark:text-gray-400 py-8">You haven't cloned any voices yet.</p>
                )}
            </div>
        </div>
    );
};

export default VoiceCloneView;
