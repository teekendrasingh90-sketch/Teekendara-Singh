import React, { useState, useRef } from 'react';
import { PlusIcon } from './icons';

interface UploadedImage {
    data: string; // raw base64
    mimeType: string;
    previewUrl: string; // data URL for <img>
}

interface ImageChatViewProps {
    initialImage: UploadedImage;
    onClose: (instructions?: string, refImage?: UploadedImage) => void;
}

const ImageChatView: React.FC<ImageChatViewProps> = ({ initialImage, onClose }) => {
    const [userInput, setUserInput] = useState('');
    const [referenceImage, setReferenceImage] = useState<UploadedImage | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textInputRef = useRef<HTMLInputElement>(null);

    const handleReferenceUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const fullDataUrl = reader.result as string;
                const mimeType = fullDataUrl.substring(fullDataUrl.indexOf(':') + 1, fullDataUrl.indexOf(';'));
                const base64Data = fullDataUrl.split(',')[1];
                setReferenceImage({ data: base64Data, mimeType, previewUrl: fullDataUrl });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleDone = () => {
        onClose(userInput.trim(), referenceImage ?? undefined);
    };

    const handleInputContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
        // Prevent focusing the text input if the click is on the "Done" button
        if ((e.target as HTMLElement).closest('button')) {
            return;
        }
        textInputRef.current?.focus();
    };

    return (
        <div 
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in p-4"
            onClick={() => onClose()}
        >
            <div 
                className="relative w-full max-w-lg mx-auto flex flex-col bg-white dark:bg-gray-800 rounded-xl overflow-hidden max-h-[90vh] border border-slate-200 dark:border-gray-700 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-gray-700 flex-shrink-0">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white">Chat Edit</h3>
                    <button onClick={() => onClose()} className="text-2xl text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white transition-colors">&times;</button>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col p-4 overflow-y-auto">
                    <img src={initialImage.previewUrl} alt="Image to edit" className="w-full h-auto max-h-80 object-contain rounded-lg bg-slate-100 dark:bg-black/20" />
                </div>

                {/* Input Area */}
                <div className="p-4 border-t border-slate-200 dark:border-gray-700 flex-shrink-0">
                    {referenceImage && (
                        <div className="relative w-20 h-20 mb-2">
                            <img src={referenceImage.previewUrl} className="w-full h-full object-cover rounded-lg" alt="Reference preview"/>
                            <button 
                                onClick={() => {
                                    setReferenceImage(null);
                                    if(fileInputRef.current) fileInputRef.current.value = '';
                                }} 
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm pb-0.5"
                                aria-label="Remove reference image"
                            >
                                &times;
                            </button>
                        </div>
                    )}
                    <div 
                        className="flex items-center gap-2 bg-slate-100 dark:bg-gray-800 rounded-lg p-2 cursor-text"
                        onClick={handleInputContainerClick}
                    >
                        {/* FIX: Replaced button with a label for reliable file uploads on mobile */}
                        <label 
                            htmlFor="reference-upload"
                            className="p-2 text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white transition-colors rounded-full cursor-pointer" 
                            aria-label="Add reference image"
                        >
                            <PlusIcon className="h-6 w-6" />
                        </label>
                        <input id="reference-upload" type="file" ref={fileInputRef} onChange={handleReferenceUpload} accept="image/*" className="hidden" />
                        
                        <input 
                            ref={textInputRef}
                            type="text"
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleDone()}
                            placeholder="Type instructions..."
                            className="flex-1 bg-transparent focus:outline-none text-slate-800 dark:text-white"
                        />
                        <button onClick={handleDone} disabled={!userInput.trim() && !referenceImage} className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50">
                            Done
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ImageChatView;
