
import React, { useState, useCallback } from 'react';
import { ImageStyle, AspectRatio } from '../types';
import { generateImages, generatePromptFromImage } from '../services/geminiService';
import { PhotoIcon, SpinnerIcon, EyeIcon, DownloadIcon, CopyIcon, CheckIcon, ResetIcon } from './icons';

const styles: ImageStyle[] = [ImageStyle.Realistic, ImageStyle.Ghibli, ImageStyle.ThreeD];
const ratios: AspectRatio[] = [AspectRatio.SixteenNine, AspectRatio.OneOne, AspectRatio.NineSixteen];


interface UploadedImage {
    data: string; // raw base64
    mimeType: string;
    previewUrl: string; // data URL for <img>
}

const ImageGeneratorView: React.FC = () => {
  const [prompt, setPrompt] = useState<string>('');
  const [uploadedImage, setUploadedImage] = useState<UploadedImage | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<ImageStyle>(ImageStyle.Realistic);
  const [selectedRatio, setSelectedRatio] = useState<AspectRatio>(AspectRatio.SixteenNine);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [placeholderCount, setPlaceholderCount] = useState<number>(0);
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = async () => {
            const fullDataUrl = reader.result as string;
            const mimeType = fullDataUrl.substring(fullDataUrl.indexOf(':') + 1, fullDataUrl.indexOf(';'));
            const base64Data = fullDataUrl.split(',')[1];
            setUploadedImage({
                data: base64Data,
                mimeType: mimeType,
                previewUrl: fullDataUrl,
            });

            // Auto-generate prompt from image
            setIsGeneratingPrompt(true);
            setError(null);
            setPrompt('');

            try {
                const generatedPrompt = await generatePromptFromImage(base64Data, mimeType);
                setPrompt(generatedPrompt);
            } catch (err: any) {
                setError(err.message || 'Failed to generate prompt from image.');
            } finally {
                setIsGeneratingPrompt(false);
            }
        };
        reader.readAsDataURL(file);
    }
  };

  const handleGenerateClick = () => {
    if (!prompt) {
      setError("Please enter a prompt to generate images.");
      return;
    }
    setError(null);
    setIsModalOpen(true);
  };
  
  const startGeneration = useCallback(async (count: number) => {
    setIsModalOpen(false);
    setIsLoading(true);
    setError(null);
    setGeneratedImages([]);
    setPlaceholderCount(count);

    const fullPrompt = uploadedImage
      ? `Crucially, the final generated image MUST have a strict aspect ratio of ${selectedRatio}. Generate a new creative image variation based on the uploaded image, in a ${selectedStyle} style. The instructions are: "${prompt}". Create a visually distinct variation by changing the background or composition, ensuring the final output fits the ${selectedRatio} ratio precisely. Do not just copy the uploaded image.`
      : `A ${selectedStyle.toLowerCase()} style image of ${prompt}`;

    try {
        const imagePayload = uploadedImage 
            ? { data: uploadedImage.data, mimeType: uploadedImage.mimeType } 
            : undefined;
        
        const images = await generateImages(fullPrompt, count, selectedRatio, imagePayload);
        setGeneratedImages(images);
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
      setPlaceholderCount(0);
    }
  }, [prompt, selectedStyle, selectedRatio, uploadedImage]);
  
  const handleRegenerate = useCallback(async () => {
    const count = generatedImages.length;
    if (count === 0) {
        handleGenerateClick();
        return;
    }

    setIsLoading(true);
    setError(null);
    setPlaceholderCount(count);
    setGeneratedImages([]);

    const fullPrompt = uploadedImage
      ? `Crucially, the final generated image MUST have a strict aspect ratio of ${selectedRatio}. Generate a new creative image variation based on the uploaded image, in a ${selectedStyle} style. The instructions are: "${prompt}". Create a visually distinct variation by changing the background or composition, ensuring the final output fits the ${selectedRatio} ratio precisely. Do not just copy the uploaded image.`
      : `A ${selectedStyle.toLowerCase()} style image of ${prompt}`;

    try {
        const imagePayload = uploadedImage 
            ? { data: uploadedImage.data, mimeType: uploadedImage.mimeType } 
            : undefined;
        
        const images = await generateImages(fullPrompt, count, selectedRatio, imagePayload);
        setGeneratedImages(images);
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred.');
      setGeneratedImages([]); // Clear images on failure
    } finally {
      setIsLoading(false);
      setPlaceholderCount(0);
    }
  }, [prompt, selectedStyle, selectedRatio, uploadedImage, generatedImages.length]);
  
  const handleStartOver = () => {
    setPrompt('');
    setUploadedImage(null);
    setSelectedStyle(ImageStyle.Realistic);
    setSelectedRatio(AspectRatio.SixteenNine);
    setError(null);
    setGeneratedImages([]);
    setPlaceholderCount(0);
    setIsCopied(false);
  };

  const handleDownload = (imageSrc: string, index: number) => {
    const link = document.createElement('a');
    link.href = imageSrc;
    link.download = `generated-image-creation-${index + 1}.jpeg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyPrompt = () => {
    if (!prompt || isCopied) return;
    navigator.clipboard.writeText(prompt).then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const getAspectRatioClass = (ratio: AspectRatio) => {
    switch(ratio) {
        case AspectRatio.OneOne: return 'aspect-square';
        case AspectRatio.NineSixteen: return 'aspect-[9/16]';
        case AspectRatio.SixteenNine:
        default:
            return 'aspect-video';
    }
  }

  return (
    <div className="animate-fade-in">
        <h2 className="text-3xl font-bold text-center mb-6 text-slate-800 dark:text-white">Image Generation</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Controls */}
            <div className="md:col-span-1 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm p-6 rounded-xl border border-slate-200 dark:border-gray-700 flex flex-col space-y-6">
                <div>
                    <label className="block text-sm font-medium text-slate-800 dark:text-white mb-2">1. Upload Image (Optional)</label>
                    {uploadedImage ? (
                        <div className="relative group">
                            <img src={uploadedImage.previewUrl} alt="Uploaded preview" className="rounded-lg w-full h-auto object-contain max-h-48 border border-slate-300 dark:border-gray-600"/>
                            <button 
                                onClick={() => setUploadedImage(null)} 
                                className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xl font-bold leading-none pb-1"
                                aria-label="Remove image"
                            >
                                &times;
                            </button>
                        </div>
                    ) : (
                        <div className="relative w-full h-28 border-2 border-dashed border-slate-400 dark:border-gray-700 rounded-lg flex items-center justify-center text-slate-500 dark:text-gray-400 hover:border-slate-800 dark:hover:border-white hover:text-slate-800 dark:hover:text-white transition cursor-pointer bg-slate-100 dark:bg-gray-900">
                            <label htmlFor="image-upload" className="absolute inset-0 flex items-center justify-center cursor-pointer">
                                <span>Click to upload</span>
                            </label>
                            <input id="image-upload" type="file" className="hidden" onChange={handleImageUpload} accept="image/png, image/jpeg, image/webp" />
                        </div>
                    )}
                </div>
                 <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-slate-800 dark:text-white flex items-center">
                          2. Your Prompt
                          {isGeneratingPrompt && <SpinnerIcon />}
                        </label>
                        <button 
                            onClick={handleCopyPrompt} 
                            disabled={!prompt}
                            className={`text-xs font-semibold flex items-center transition-colors px-2 py-1 rounded-md ${
                                isCopied 
                                ? 'text-green-500 bg-green-100 dark:text-green-400 dark:bg-green-900/50' 
                                : 'text-slate-600 dark:text-gray-300 hover:text-black dark:hover:text-white hover:bg-slate-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed'
                            }`}
                        >
                            {isCopied ? <CheckIcon/> : <CopyIcon/>}
                            {isCopied ? 'Copied!' : 'Copy'}
                        </button>
                    </div>
                    <textarea 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder={
                          isGeneratingPrompt 
                            ? "Analyzing image to create prompt..." 
                            : (uploadedImage 
                                ? "e.g., Change the background to a fantasy landscape" 
                                : "e.g., A mystical forest with glowing mushrooms")
                        }
                        disabled={isGeneratingPrompt}
                        className="w-full bg-slate-100 dark:bg-gray-900 border border-slate-300 dark:border-gray-700 rounded-lg p-3 focus:ring-2 focus:ring-slate-500 dark:focus:ring-white/50 focus:outline-none transition h-28 resize-none disabled:opacity-70 disabled:cursor-wait placeholder:text-slate-400 dark:placeholder:text-gray-500"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-800 dark:text-white mb-2">3. Style</label>
                    <div className="grid grid-cols-3 gap-2">
                        {styles.map(style => (
                            <button key={style} onClick={() => setSelectedStyle(style)} className={`px-3 py-2 text-sm rounded-md transition ${selectedStyle === style ? 'bg-slate-800 text-white dark:bg-white dark:text-black font-bold' : 'bg-slate-200 dark:bg-gray-900 text-slate-800 dark:text-white hover:bg-slate-300 dark:hover:bg-gray-800'}`}>
                                {style === ImageStyle.ThreeD ? '3D' : style}
                            </button>
                        ))}
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-800 dark:text-white mb-2">4. Aspect Ratio</label>
                     <div className="grid grid-cols-3 gap-2">
                        {ratios.map(ratio => (
                            <button key={ratio} onClick={() => setSelectedRatio(ratio)} className={`px-3 py-2 text-sm rounded-md transition ${selectedRatio === ratio ? 'bg-slate-800 text-white dark:bg-white dark:text-black font-bold' : 'bg-slate-200 dark:bg-gray-900 text-slate-800 dark:text-white hover:bg-slate-300 dark:hover:bg-gray-800'}`}>
                                {ratio}
                            </button>
                        ))}
                    </div>
                    {uploadedImage && <p className="text-xs text-slate-500 dark:text-gray-400 mt-1 text-center col-span-3">The AI will attempt to generate an image with this ratio.</p>}
                </div>

                <div className="flex items-center space-x-2 pt-2">
                    <button
                        onClick={generatedImages.length > 0 ? handleRegenerate : handleGenerateClick}
                        disabled={isLoading || isGeneratingPrompt || !prompt}
                        className="w-full bg-slate-800 dark:bg-white hover:bg-slate-700 dark:hover:bg-gray-200 text-white dark:text-black font-bold py-3 px-4 rounded-lg transition-transform transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                        {isLoading ? <SpinnerIcon /> : (generatedImages.length > 0 ? 'Regenerate' : 'Generate')}
                    </button>
                    {generatedImages.length > 0 && !isLoading && (
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

            {/* Image Display */}
            <div className="md:col-span-2 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm p-6 rounded-xl border border-slate-200 dark:border-gray-700 min-h-[400px] flex items-center justify-center">
                 <div className={`grid ${generatedImages.length > 1 || placeholderCount > 1 ? 'grid-cols-2' : 'grid-cols-1'} gap-2 w-full h-full`}>
                     {(isLoading ? Array(placeholderCount).fill('') : generatedImages).map((imgSrc, index) => (
                        <div key={index} className={`relative rounded-lg overflow-hidden ${getAspectRatioClass(selectedRatio)}`}>
                            {isLoading ? (
                                <div className={`w-full h-full flex items-center justify-center animate-pulse bg-slate-200 dark:bg-gray-900 rounded-lg ${getAspectRatioClass(selectedRatio)} min-h-[180px]`}><SpinnerIcon /></div>
                            ) : (
                                <>
                                    <img src={imgSrc} alt={`Generated image ${index + 1}`} className="w-full h-full object-cover"/>
                                    <div className="absolute top-2 right-2 flex items-center gap-2">
                                        <button 
                                            onClick={() => setViewingImage(imgSrc)} 
                                            className="bg-black/50 hover:bg-black/80 text-white rounded-full p-2 transition-all transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-white"
                                            aria-label="View image"
                                        >
                                            <EyeIcon className="h-5 w-5" />
                                        </button>
                                        <button 
                                            onClick={() => handleDownload(imgSrc, index)} 
                                            className="bg-black/50 hover:bg-black/80 text-white rounded-full p-2 transition-all transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-white"
                                            aria-label="Download image"
                                        >
                                            <DownloadIcon />
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                     ))}
                     {!isLoading && generatedImages.length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center text-slate-500 dark:text-gray-400 h-full min-h-[350px]">
                           <PhotoIcon />
                           <p className="mt-4">Your generated images will appear here</p>
                        </div>
                     )}
                 </div>
            </div>
        </div>

        {/* Modal for image count */}
        {isModalOpen && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in">
                <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl border border-slate-200 dark:border-gray-700">
                    <h3 className="text-xl font-bold mb-6 text-slate-800 dark:text-white">How many images?</h3>
                    <div className="flex justify-center space-x-4">
                        {[1, 2, 3, 4].map(num => (
                            <button key={num} onClick={() => startGeneration(num)} className="w-16 h-16 bg-slate-800 text-white dark:bg-white dark:text-black rounded-full text-2xl font-bold flex items-center justify-center hover:bg-slate-700 dark:hover:bg-gray-200 transition-transform transform hover:scale-110">
                                {num}
                            </button>
                        ))}
                    </div>
                    <button onClick={() => setIsModalOpen(false)} className="mt-8 text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white transition-colors w-full">Cancel</button>
                </div>
            </div>
        )}

        {/* Modal for viewing image */}
        {viewingImage && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in" onClick={() => setViewingImage(null)}>
                <div className="relative p-4" onClick={(e) => e.stopPropagation()}>
                    <img src={viewingImage} alt="Enlarged view" className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl object-contain"/>
                    <button onClick={() => setViewingImage(null)} className="absolute -top-2 -right-2 bg-white text-black rounded-full w-10 h-10 flex items-center justify-center text-2xl font-bold leading-none pb-1 hover:bg-gray-200 transition-transform transform hover:scale-110">
                        &times;
                    </button>
                </div>
            </div>
        )}
    </div>
  );
};

export default ImageGeneratorView;
