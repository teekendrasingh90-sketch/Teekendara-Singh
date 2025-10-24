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
            // Text-to-Image using gemini-2.5-flash-image to ensure compatibility with user's API key.
            // This model is generally available and avoids permission issues seen with more specialized models like Imagen.
            const generationPromises = Array(numberOfImages).fill(0).map(() =>
                ai.models.generateContent({
                    model: 'gemini-2.5-flash-image',
                    contents: {
                        parts: [
                            // Instruct the model about the desired aspect ratio within the prompt itself.
                            { text: `${prompt}. The final generated image MUST have a strict aspect ratio of ${aspectRatio}.` }
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
                throw new Error("The model did not return any images. This could be due to a safety policy or a problem with the prompt.");
            }
            return images;
        }
    } catch (error) {
        console.error("Error generating images:", error);
        throw new Error("Failed to generate images. Please check your API key and prompt. The model may have refused to generate content for safety reasons.");
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

// FIX: Added generateSpeech function to be used for text-to-speech generation.
export const generateSpeech = async (
    text: string,
    voiceName: string
): Promise<string> => {
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
                        prebuiltVoiceConfig: { voiceName },
                    },
                },
            },
        });
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
            throw new Error("Audio generation failed, no data returned.");
        }
        return base64Audio;
    } catch (error) {
        console.error("Error generating speech:", error);
        throw new Error("Failed to generate speech. Please check your API key and prompt.");
    }
};

// FIX: Added generateVideo function for text-to-video generation using Veo.
export const generateVideo = async (
    prompt: string,
    resolution: '720p' | '1080p',
    aspectRatio: '16:9' | '9:16',
    updateLoadingMessage: (message: string) => void
): Promise<string> => {
    if (!process.env.API_KEY) {
        throw new Error("API Key not found. Please ensure it's configured in your deployment environment.");
    }
    // A new GoogleGenAI instance must be created for each Veo call
    // to ensure the latest API key from the selection dialog is used.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    try {
        updateLoadingMessage("Starting video generation...");
        let operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt,
            config: {
                numberOfVideos: 1,
                resolution,
                aspectRatio,
            }
        });

        updateLoadingMessage("Processing your request... This may take a few minutes.");
        let pollCount = 0;
        const maxPolls = 30; // 5 minutes max wait time
        while (!operation.done && pollCount < maxPolls) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            operation = await ai.operations.getVideosOperation({ operation });
            pollCount++;
            updateLoadingMessage(`Checking status... (${pollCount * 10}s elapsed)`);
        }

        if (!operation.done) {
            throw new Error("Video generation timed out. Please try again with a simpler prompt.");
        }

        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!downloadLink) {
            throw new Error("The model did not return a video. Please try again.");
        }

        updateLoadingMessage("Fetching your video...");
        // Append API key to the URI for access
        const videoUrl = `${downloadLink}&key=${process.env.API_KEY}`;
        
        // Fetch the video to convert it to a blob URL, which is safer for the <video> tag
        const videoResponse = await fetch(videoUrl);
        if (!videoResponse.ok) {
            throw new Error(`Failed to fetch video data (status: ${videoResponse.status}).`);
        }
        const videoBlob = await videoResponse.blob();
        return URL.createObjectURL(videoBlob);

    } catch (error) {
        console.error("Error generating video:", error);
        // Rethrow to be caught by the component
        throw error;
    }
};