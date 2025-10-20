
import { GoogleGenAI, Modality } from "@google/genai";

// This file was the primary suspect for the "blank screen" issue on deployment.
// Accessing `process.env.API_KEY` at the top level of the module can cause a `ReferenceError: process is not defined`
// in a browser environment if the build tool (like Vite or CRA) is not configured to handle it or if the environment variable isn't set during build.
// By moving all logic that uses `process.env.API_KEY` inside the functions that are called by user actions, we ensure the app can load successfully.
// If the API key is missing, the user will see an error message when they try to perform an action, instead of the app crashing on start.

export const generateImages = async (
    prompt: string,
    numberOfImages: number,
    aspectRatio: '16:9' | '1:1' | '9:16',
    uploadedImage?: { data: string; mimeType: string; }
): Promise<string[]> => {
    if (!process.env.API_KEY) {
        throw new Error("API Key not found. Please ensure it's configured in your deployment environment.");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
        if (uploadedImage) {
            // Image-to-Image / Edit using gemini-2.5-flash-image
            // This model generates one image per call, so we make parallel requests.
            const generationPromises = Array(numberOfImages).fill(0).map(() =>
                ai.models.generateContent({
                    model: 'gemini-2.5-flash-image',
                    contents: {
                        parts: [
                            { inlineData: { data: uploadedImage.data, mimeType: uploadedImage.mimeType } },
                            { text: prompt }
                        ]
                    },
                    config: {
                        responseModalities: [Modality.IMAGE],
                    }
                })
            );

            const responses = await Promise.all(generationPromises);

            const images = responses.flatMap(response => 
                response.candidates?.[0]?.content?.parts
                    .filter(part => part.inlineData)
                    .map(part => {
                        const { mimeType, data } = part.inlineData!;
                        return `data:${mimeType};base64,${data}`;
                    }) || []
            );
            
            if (images.length === 0) {
                throw new Error("The model did not return any images.");
            }
            return images;

        } else {
            // Text-to-Image using Imagen
            const response = await ai.models.generateImages({
                model: 'imagen-4.0-generate-001',
                prompt,
                config: {
                    numberOfImages,
                    outputMimeType: 'image/jpeg',
                    aspectRatio,
                },
            });

            if (response.generatedImages && response.generatedImages.length > 0) {
                return response.generatedImages.map(img => {
                    const base64ImageBytes: string = img.image.imageBytes;
                    return `data:image/jpeg;base64,${base64ImageBytes}`;
                });
            }
            return [];
        }
    } catch (error) {
        console.error("Error generating images:", error);
        throw new Error("Failed to generate images. Please check your API key and prompt.");
    }
};


export const generatePromptFromImage = async (
    imageData: string,
    mimeType: string
): Promise<string> => {
    if (!process.env.API_KEY) {
        throw new Error("API Key not found. Please ensure it's configured in your deployment environment.");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { text: "Analyze this image. If it contains significant, legible text (like a sign, a book cover, or a meme), extract that text as the primary content for a prompt. If there is no text or the text is minor/illegible, instead generate a concise, descriptive prompt about the visual content, focusing on the main subject, setting, and style." },
                    { inlineData: { data: imageData, mimeType: mimeType } }
                ]
            },
        });
        return response.text.trim();
    } catch (error) {
        console.error("Error generating prompt from image:", error);
        throw new Error("Failed to analyze the image. Please try again.");
    }
};

export const generateSpeech = async (text: string): Promise<string> => {
    if (!process.env.API_KEY) {
        throw new Error("API Key not found. Please ensure it's configured in your deployment environment.");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                      // Using Charon for consistency with AssistantView
                      prebuiltVoiceConfig: { voiceName: 'Charon' },
                    },
                },
            },
        });
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
            throw new Error("Model did not return audio data.");
        }
        return base64Audio;
    } catch (error) {
        console.error("Error generating speech:", error);
        throw new Error("Failed to generate speech.");
    }
};


export const generateVideo = async (
    prompt: string,
    resolution: '720p' | '1080p',
    aspectRatio: '16:9' | '9:16',
    setLoadingMessage: (message: string) => void
): Promise<string> => {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY is not available. Please select an API key.");
    }

    // Per Veo guidelines, create a new instance to ensure the latest API key is used.
    const veoAI = new GoogleGenAI({ apiKey: process.env.API_KEY });

    try {
        setLoadingMessage('Starting video generation...');
        let operation = await veoAI.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt,
            config: {
                numberOfVideos: 1,
                resolution,
                aspectRatio,
            },
        });

        setLoadingMessage('Processing video... this may take a few minutes.');
        let pollCount = 0;
        const loadingMessages = [
            'Analyzing prompt and preparing assets...',
            'Building scenes and composing shots...',
            'Rendering frames and applying effects...',
            'Finalizing video and encoding output...',
            'Almost there, polishing the final details...'
        ];

        while (!operation.done) {
            // Poll every 10 seconds as per guidelines
            await new Promise(resolve => setTimeout(resolve, 10000));
            setLoadingMessage(loadingMessages[pollCount % loadingMessages.length]);
            operation = await veoAI.operations.getVideosOperation({ operation });
            pollCount++;
        }

        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!downloadLink) {
            throw new Error('Video generation completed, but no download link was found.');
        }

        setLoadingMessage('Fetching generated video...');
        // Per guidelines, append the API key when fetching from the download link.
        const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
        if (!videoResponse.ok) {
            const errorBody = await videoResponse.text();
            console.error('Failed to fetch video:', errorBody);
            throw new Error(`Failed to fetch video. Status: ${videoResponse.statusText}`);
        }
        
        const videoBlob = await videoResponse.blob();
        const videoUrl = URL.createObjectURL(videoBlob);
        
        return videoUrl;
    } catch (error: any) {
        console.error("Error in generateVideo service:", error);
        // Re-throw to be handled by the component, which has logic for API key errors.
        throw error;
    }
};
