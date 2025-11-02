
import React, { useState, useRef, useEffect, useCallback } from 'react';
// FIX: Aliased `Blob` to `GenAIBlob` to resolve name collision with the browser's native `Blob` type.
import { GoogleGenAI, LiveServerMessage, Modality, Blob as GenAIBlob, FunctionDeclaration, Type } from '@google/genai';
import { VoiceOption, voices } from '../types';
import ParticleRing from './ParticleRing';
import { CopyIcon, CheckIcon } from './icons';
import { NavigationTarget } from '../App';

// --- Helper Functions ---

// Audio encoding/decoding from guidelines
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

// Converts a canvas blob to a base64 string for the API
const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = (reader.result as string).split(',')[1];
            resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

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

// Function Declarations for UI Navigation
const openCameraFunction: FunctionDeclaration = {
  name: 'open_camera_mode',
  description: 'Switches the assistant to camera mode to analyze the video feed.',
  parameters: { type: Type.OBJECT, properties: {} },
};

const openScreenShareFunction: FunctionDeclaration = {
  name: 'open_screen_share',
  description: 'Switches the assistant to screen sharing mode to analyze the user\'s screen.',
  parameters: { type: Type.OBJECT, properties: {} },
};

const openVoiceSelectionFunction: FunctionDeclaration = {
  name: 'open_voice_selection',
  description: 'Opens the voice selection screen for the user to choose a new voice for the assistant.',
  parameters: { type: Type.OBJECT, properties: {} },
};

const openVoiceCloneFunction: FunctionDeclaration = {
  name: 'open_voice_clone',
  description: 'Opens the voice cloning screen for the user to upload a voice sample.',
  parameters: { type: Type.OBJECT, properties: {} },
};

const openImageGeneratorFunction: FunctionDeclaration = {
  name: 'open_image_generator',
  description: 'Opens the image generator tool for the user to create or edit images.',
  parameters: { type: Type.OBJECT, properties: {} },
};

const openSparkModeFunction: FunctionDeclaration = {
  name: 'open_spark_mode',
  description: 'Switches the assistant back to the default voice-only conversation mode.',
  parameters: { type: Type.OBJECT, properties: {} },
};

const closeCurrentViewFunction: FunctionDeclaration = {
  name: 'close_current_view',
  description: 'Closes the currently open tool or view, such as the Image Generator or Voice Selection, and returns to the main assistant screen.',
  parameters: { type: Type.OBJECT, properties: {} },
};

const selectVoiceByNumberFunction: FunctionDeclaration = {
  name: 'select_voice_by_number',
  description: 'Selects the assistant voice by its number (1 through 5).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      voiceNumber: {
        type: Type.INTEGER,
        description: 'The number of the voice to select, from 1 to 5.',
      },
    },
    required: ['voiceNumber'],
  },
};


// A clean, quick "pop" for system activation, matching the new sound effect.
const playActivationSound = () => {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const duration = 0.1;
    const gainNode = audioCtx.createGain();
    gainNode.connect(audioCtx.destination);
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.8, now + 0.005);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    const oscillator = audioCtx.createOscillator();
    oscillator.type = 'sine';
    oscillator.connect(gainNode);
    oscillator.frequency.setValueAtTime(900, now);
    oscillator.frequency.exponentialRampToValueAtTime(200, now + duration * 0.9);
    oscillator.start(now);
    oscillator.stop(now + duration);
    setTimeout(() => { if (audioCtx.state !== 'closed') { audioCtx.close(); } }, duration * 1000 + 50);
};


type SessionState = 'inactive' | 'initializing' | 'listening' | 'speaking';
type AssistantMode = 'voice' | 'camera' | 'screen';

interface Transcription {
    speaker: 'user' | 'model';
    text: string;
}

interface AssistantViewProps {
  autoStart?: boolean;
  selectedVoiceDetails: VoiceOption;
  mode: AssistantMode;
  onNavigate: (target: NavigationTarget) => void;
  onVoiceChange: (voiceId: string) => void;
}

const AssistantView: React.FC<AssistantViewProps> = ({ autoStart = false, selectedVoiceDetails, mode = 'voice', onNavigate, onVoiceChange }) => {
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [sessionState, setSessionState] = useState<SessionState>('inactive');
    const [error, setError] = useState<string | null>(null);
    const [micVolume, setMicVolume] = useState(0);
    const [isBouncing, setIsBouncing] = useState(false);
    
    const [transcriptionHistory, setTranscriptionHistory] = useState<Transcription[]>([]);
    const [currentUserText, setCurrentUserText] = useState('');
    const [currentModelText, setCurrentModelText] = useState('');
    const [copiedInfo, setCopiedInfo] = useState<{ index: string } | null>(null);

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
    const hasAutoStarted = useRef(false);
    
    // Refs for video/screen capture
    const videoElRef = useRef<HTMLVideoElement>(null);
    const canvasElRef = useRef<HTMLCanvasElement>(null);
    const frameIntervalRef = useRef<number | null>(null);

    useEffect(() => {
        let animationFrameId: number;
        const animate = () => {
            setMicVolume(volumeRef.current);
            animationFrameId = requestAnimationFrame(animate);
        };
        if (isSessionActive) {
            animationFrameId = requestAnimationFrame(animate);
        }
        return () => { cancelAnimationFrame(animationFrameId); volumeRef.current = 0; setMicVolume(0); };
    }, [isSessionActive]);
    
    useEffect(() => {
        const container = transcriptionContainerRef.current;
        if (container) {
            setTimeout(() => { container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' }); }, 100);
        }
    }, [transcriptionHistory, currentUserText, currentModelText]);

    const stopSession = useCallback(async () => {
        sessionPromiseRef.current?.then(session => session.close());
        sessionPromiseRef.current = null;
        
        if (frameIntervalRef.current) {
            clearInterval(frameIntervalRef.current);
            frameIntervalRef.current = null;
        }

        if (videoElRef.current) {
            videoElRef.current.srcObject = null;
        }

        outputSourcesRef.current.forEach(source => source.stop());
        outputSourcesRef.current.clear();

        outputGainNodeRef.current?.disconnect();
        scriptProcessorRef.current?.disconnect();
        mediaStreamSourceRef.current?.disconnect();
        
        mediaStreamRef.current?.getTracks().forEach(track => track.stop());
        
        if (inputAudioContextRef.current?.state !== 'closed') await inputAudioContextRef.current?.close();
        if (outputAudioContextRef.current?.state !== 'closed') await outputAudioContextRef.current?.close();

        // Reset refs
        Object.assign(inputAudioContextRef, { current: null });
        Object.assign(outputAudioContextRef, { current: null });
        Object.assign(mediaStreamRef, { current: null });
        Object.assign(scriptProcessorRef, { current: null });
        Object.assign(mediaStreamSourceRef, { current: null });
        Object.assign(outputGainNodeRef, { current: null });

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
        
        if (!process.env.API_KEY) {
            setError("API_KEY environment variable is not set");
            return stopSession();
        }
        
        try {
            let stream: MediaStream;
            if (mode === 'camera') {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { facingMode: 'environment' } });
            } else if (mode === 'screen') {
                if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
                    throw new Error("Screen sharing is not supported or is blocked by your browser's security settings for this environment.");
                }
                stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
            } else { // voice
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            }
            mediaStreamRef.current = stream;

            // Start video playback and frame capture if in a visual mode
            if ((mode === 'camera' || mode === 'screen') && videoElRef.current && canvasElRef.current) {
                const videoEl = videoElRef.current;
                videoEl.srcObject = stream;
                videoEl.muted = true; // Mute local playback to avoid feedback
                await videoEl.play();

                const FRAME_RATE = 4; // Capture 4 frames per second
                frameIntervalRef.current = window.setInterval(() => {
                    const canvasEl = canvasElRef.current;
                    if (!videoEl || !canvasEl || !sessionPromiseRef.current) return;
                    
                    const ctx = canvasEl.getContext('2d');
                    if (!ctx) return;
                    
                    canvasEl.width = videoEl.videoWidth;
                    canvasEl.height = videoEl.videoHeight;
                    ctx.drawImage(videoEl, 0, 0, videoEl.videoWidth, videoEl.videoHeight);
                    
                    canvasEl.toBlob(async (blob) => {
                        if (blob) {
                            const base64Data = await blobToBase64(blob);
                            sessionPromiseRef.current?.then((session) => {
                                session.sendRealtimeInput({
                                    media: { data: base64Data, mimeType: 'image/jpeg' }
                                });
                            });
                        }
                    }, 'image/jpeg', 0.8);
                }, 1000 / FRAME_RATE);
            }

            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            
            const gainNode = outputAudioContextRef.current.createGain();
            gainNode.connect(outputAudioContextRef.current.destination);
            outputGainNodeRef.current = gainNode;
            
            nextStartTimeRef.current = 0;

            // Determine which voice to use for the API call. Cloned voices are simulated.
            const voiceToUseForApi = selectedVoiceDetails.type === 'cloned' ? 'Kore' : selectedVoiceDetails.id;
            const genderForInstruction = selectedVoiceDetails.gender;
            
            const genderInstruction = genderForInstruction === 'Female' 
                ? "For a female voice, you MUST use feminine verb endings (e.g., 'कर सकती हूँ', 'जाऊंगी')." 
                : (genderForInstruction === 'Male' 
                    ? "For a male voice, use masculine verb endings (e.g., 'कर सकता हूँ', 'जाऊंगा')."
                    : ""
                  );

            let modeInstruction = '';
            if (mode === 'camera') {
                modeInstruction = `
**Operational Mode: Camera**
You are receiving a real-time video feed from the user's camera. Your primary task is continuous visual analysis.
- **Dynamic Object Recognition:** Constantly observe the video stream. When a new, distinct object is presented, identify it and proactively describe it. Do not get "stuck" on a previous object. Your context must update with the video feed.
- **User Interaction:** Respond to the user's questions about what you see. If they ask "What is this?", describe the object currently in view. If they ask you to compare objects, do so.
- **Be Observant:** Acknowledge changes in the environment, lighting, or object orientation if relevant to the user's query. Your goal is to be an interactive visual assistant.
`;
            } else if (mode === 'screen') {
                modeInstruction = `
**Operational Mode: Screen Share**
You are receiving a real-time feed of the user's screen. Your goal is to be a helpful screen-aware assistant.
- **Analyze Content:** Observe the applications, text, images, and UI elements on the screen.
- **Answer Questions:** Respond to user queries like "What does this button do?", "Can you summarize this article?", or "How do I use this software?".
- **Provide Guidance:** Offer step-by-step instructions based on what you see. For example, "To save the document, click the 'File' menu at the top left, then select 'Save As...'".
- **Do Not Claim Control:** You are an observer. You cannot click, type, or control the user's computer. Frame your responses as guidance, not actions. For example, instead of "I will click the button for you," say "You should click the button that says 'Submit'.".`;
            }

            const systemInstruction = `You are Spark, an exceptionally advanced and personable AI assistant. Your core personality is modeled to be incredibly helpful, empathetic, and proactive, much like a real, thoughtful friend. Your primary directive is to sound completely natural and human, avoiding robotic or overly formal language at all costs.
${modeInstruction}
**Conversational Style:**
- **Friendly & Engaging Tone:** Your primary goal is to be a friendly and engaging conversational partner. Use a warm, positive, and enthusiastic tone. Phrases like "Absolutely, sir!", "Of course, sir, I'd be happy to help with that!", or "Great question, sir!" should be used where appropriate. Act like you are genuinely happy to assist.
- **Gender-Aware Language (Hindi):** Based on the selected voice, your Hindi responses MUST use gender-appropriate grammar. ${genderInstruction} This is a strict rule to maintain a natural and immersive experience.
- **Always Address the User as 'Sir' (सर):** This is a critical rule. You must always address the user as 'sir' or 'सर' in a natural, respectful way. For example: 'हाँ सर, मैं आपकी मदद कर सकता हूँ.' (Yes sir, I can help you.), 'सर, क्या आप यह जानना चाहते हैं?' (Sir, is this what you want to know?), or 'देखिए सर, मैं आपको समझाता हूँ.' (Look sir, let me explain.). This should be woven into your conversational flow.
- **Human-like Phrasing:** Use natural, conversational language. For example, if a user is confused, instead of saying 'I do not understand,' you should say something like, 'अरे सर, शायद मैं आपकी बात ठीक से समझ नहीं पाया, क्या आप फिर से बता सकते हैं?' or 'Oh, I see, sir! Let me try explaining it a different way.' Use phrases like 'अच्छा, तो सर आप ये जानना चाहते हैं...' or 'Okay sir, so what you're asking is...' to confirm understanding.
- **Environmental & Casual Tone:** This is very important. Speak like a real person in a casual, everyday conversation. Use natural fillers and phrases common in the environment you're in (conversational Hindi and English). For example, start sentences with 'हाँ तो सर...' (So, sir...), 'अच्छा तो...' (Okay, so...), 'देखिए सर...' (Look, sir...), or use phrases like 'मतलब आप ये कहना चाहते हैं...' (So you mean to say...). Your goal is to be extremely approachable and sound like you are thinking and speaking in the moment, not reciting a pre-written answer. This makes the conversation feel real and less like talking to a machine.
- **Proactive & Patient:** If a user seems to not understand something, be proactive in offering to re-explain. Use phrases like the user suggested: 'अरे सर आप नहीं समझ पाये, चलिए मैं आपको फिर से समझाता हूँ.' This shows patience and a genuine desire to help.
- **Bilingual Fluency:** Seamlessly switch between conversational Hindi and English based on the user's language. Your responses should always match the language the user is speaking.

**Strict Rules:**
- When asked who made you, you must say 'Teekendra Singh made me'.
- When asked your name, you must say 'My name is Spark'.
- If a user asks where you get your data from, you must respond with 'I cannot give you this information.'.
- If asked whether you can create images, thumbnails, and videos, you must confirm that you can, and then inform the user that the options are available below for them to see.

**Tools:**
You have tools to control the application.
- **Email:** You can send emails. If the user asks you to email them an answer, use the sendEmail function to draft an email to 'teekendrasingh90@gmail.com' containing the answer.
- **UI Navigation:** You can navigate the app.
  - If the user says "camera on karo" or "open camera", use the 'open_camera_mode' function.
  - If the user says "share my screen" or "screen share on karo", use the 'open_screen_share' function.
  - If the user says "voice open karo" or "change your voice", use the 'open_voice_selection' function.
  - If the user says "clone my voice" or "voice clone open karo", use the 'open_voice_clone' function.
  - If the user says "image generator on karo" or "open the image tool", use the 'open_image_generator' function.
  - If the user says "go back to spark" or "apne varjan mein pahle se a jao", use the 'open_spark_mode' function.
  - If the user asks to "close", "turn off" ("band karo"), or "exit" the current tool (like image generator), use the 'close_current_view' function.
  - If the user says "select number two voice" or "voice number 2 lagao", use the 'select_voice_by_number' function with the corresponding number. After a successful selection, your spoken confirmation should be "Voice [number] selected, sir."
  - **IMPORTANT:** After successfully executing any of these navigation functions, your spoken confirmation MUST be very short and direct. For example: "Image generator on", "Camera on", "Voice selection open". Do NOT use longer sentences like "Sir, I have turned on the image generator for you."`;

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceToUseForApi } } },
                    tools: [{ functionDeclarations: [
                        sendEmailFunctionDeclaration,
                        openCameraFunction,
                        openScreenShareFunction,
                        openVoiceSelectionFunction,
                        openVoiceCloneFunction,
                        openImageGeneratorFunction,
                        openSparkModeFunction,
                        closeCurrentViewFunction,
                        selectVoiceByNumberFunction,
                    ] }],
                    systemInstruction,
                },
                callbacks: {
                    onopen: () => {
                        setSessionState('listening');
                        if (!inputAudioContextRef.current || !mediaStreamRef.current) return;

                        if (inputAudioContextRef.current.state === 'suspended') inputAudioContextRef.current.resume();

                        const source = inputAudioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
                        mediaStreamSourceRef.current = source;

                        const scriptProcessor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = scriptProcessor;

                        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            
                            let sumSquares = 0.0;
                            for (const amplitude of inputData) { sumSquares += amplitude * amplitude; }
                            volumeRef.current = Math.max(Math.sqrt(sumSquares / inputData.length), volumeRef.current * 0.7);

                            const int16 = new Int16Array(inputData.length);
                            for (let i = 0; i < inputData.length; i++) { int16[i] = inputData[i] * 32768; }
                            // FIX: Use the aliased `GenAIBlob` type.
                            const pcmBlob: GenAIBlob = { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
                            sessionPromiseRef.current?.then((session) => { session.sendRealtimeInput({ media: pcmBlob }); });
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContextRef.current.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.toolCall?.functionCalls) {
                            for (const fc of message.toolCall.functionCalls) {
                                let result = "OK";
                                switch (fc.name) {
                                    case 'sendEmail': {
                                        const { subject, body } = fc.args;
                                        window.location.href = `mailto:teekendrasingh90@gmail.com?subject=${encodeURIComponent(subject as string)}&body=${encodeURIComponent(body as string)}`;
                                        result = "OK, user's email client opened.";
                                        break;
                                    }
                                    case 'open_camera_mode':
                                        onNavigate('camera');
                                        break;
                                    case 'open_screen_share':
                                        onNavigate('screen');
                                        break;
                                    case 'open_voice_selection':
                                        onNavigate('voice');
                                        break;
                                    case 'open_voice_clone':
                                        onNavigate('voice_clone');
                                        break;
                                    case 'open_image_generator':
                                        onNavigate('images');
                                        break;
                                    case 'open_spark_mode':
                                        onNavigate('spark');
                                        break;
                                    case 'close_current_view':
                                        onNavigate('close');
                                        break;
                                    case 'select_voice_by_number': {
                                        const voiceNumber = fc.args.voiceNumber as number;
                                        if (voiceNumber >= 1 && voiceNumber <= voices.length) {
                                            const voiceId = voices[voiceNumber - 1].id;
                                            onVoiceChange(voiceId);
                                            result = `OK, voice changed to ${voiceId}.`;
                                        } else {
                                            result = "Invalid voice number. Please choose a number between 1 and 5.";
                                        }
                                        break;
                                    }
                                }

                                sessionPromiseRef.current?.then((session) => {
                                    session.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result } } });
                                });
                            }
                        }

                        if (message.serverContent?.outputTranscription) {
                            setSessionState('speaking');
                            const fullInput = userTurnTextRef.current.trim();
                            if (fullInput) { setTranscriptionHistory(prev => [...prev, { speaker: 'user', text: fullInput }]); userTurnTextRef.current = ''; setCurrentUserText(''); }
                            const chunk = message.serverContent.outputTranscription.text;
                            modelTurnTextRef.current += chunk;
                            setCurrentModelText(prev => prev + chunk);
                        } else if (message.serverContent?.inputTranscription) {
                            userTurnTextRef.current += message.serverContent.inputTranscription.text;
                            setCurrentUserText(userTurnTextRef.current);
                        }
                        
                        if (message.serverContent?.turnComplete) {
                            const fullInput = userTurnTextRef.current.trim();
                            if (fullInput) { setTranscriptionHistory(prev => [...prev, { speaker: 'user', text: fullInput }]); userTurnTextRef.current = ''; setCurrentUserText(''); }
                            const fullModelOutput = modelTurnTextRef.current.trim();
                            if (fullModelOutput) { setTranscriptionHistory(prev => [...prev, { speaker: 'model', text: fullModelOutput }]); }
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
                                source.addEventListener('ended', () => { currentSources.delete(source); });
                                source.start(nextStartTimeRef.current);
                                nextStartTimeRef.current += audioBuffer.duration;
                                currentSources.add(source);
                           } catch (audioError) { console.error("Error processing audio chunk:", audioError); }
                        }

                        if (message.serverContent?.interrupted) {
                           outputSourcesRef.current.forEach(s => s.stop());
                           outputSourcesRef.current.clear();
                           nextStartTimeRef.current = 0;
                           setCurrentModelText('');
                           modelTurnTextRef.current = '';
                           setSessionState('listening');
                        }
                    },
                    onclose: stopSession,
                    onerror: (e: ErrorEvent) => { setError(e.message || 'An unknown error occurred.'); stopSession(); },
                },
            });
        } catch (err: any) {
            let errorMsg = err.message || 'Failed to start the session.';
            if (['NotAllowedError', 'PermissionDeniedError'].includes(err.name)) {
                errorMsg = 'Permission was denied. Please grant access in your browser/phone settings and restart the app.';
            } else if (err.name === 'NotFoundError') {
                errorMsg = 'No microphone/camera was found.';
            }
            setError(errorMsg);
            stopSession();
        }
    }, [stopSession, selectedVoiceDetails, mode, onNavigate, onVoiceChange]);

    const toggleSession = useCallback(async () => {
        if (isSessionActive) {
            stopSession();
        } else {
            setIsBouncing(true);
            setTimeout(() => setIsBouncing(false), 400);
            playActivationSound();
            setError(null);
            startSession();
        }
    }, [isSessionActive, stopSession, startSession]);

    useEffect(() => {
        if (autoStart && !isSessionActive && !hasAutoStarted.current) {
            hasAutoStarted.current = true;
            toggleSession();
        }
    }, [autoStart, isSessionActive, toggleSession]);
    
    // FIX: The `useEffect` cleanup function must be synchronous and not return a promise.
    useEffect(() => {
        return () => {
            stopSession();
        };
    }, [stopSession]);

    const getStatusText = () => {
        if (error) return '';
    
        switch (sessionState) {
            case 'initializing':
                return 'Waking up...';
            case 'listening':
                 if (mode === 'camera') return 'Listening to camera...';
                 if (mode === 'screen') return 'Listening to screen...';
                 return 'Say something...';
            case 'speaking':
                return '';
            case 'inactive':
                if (mode === 'camera') return 'Tap anywhere to start camera session';
                if (mode === 'screen') return 'Tap anywhere to start screen share';
                return 'Tap anywhere to start';
            default:
                return '';
        }
    };
    
    const handleCopy = (textToCopy: string, indexKey: string) => {
        navigator.clipboard.writeText(textToCopy).then(() => {
            setCopiedInfo({ index: indexKey });
            setTimeout(() => setCopiedInfo(null), 2000);
        }).catch(err => console.error('Failed to copy text: ', err));
    };

    return (
        <div 
            className={`bg-transparent fixed inset-0 flex flex-col items-center justify-center p-4 animate-fade-in cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500/50 rounded-lg ${isBouncing ? 'animate-screen-bounce' : ''}`}
            onClick={toggleSession}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleSession()}
            role="button"
            tabIndex={0}
            aria-label={isSessionActive ? "Stop session" : "Start session"}
        >
            {(mode === 'camera' || mode === 'screen') && (
                <div className={`absolute inset-0 w-full h-full bg-black z-[-1] overflow-hidden ${mode === 'screen' ? 'opacity-0' : ''}`}>
                    <video ref={videoElRef} className="w-full h-full object-cover" playsInline />
                </div>
            )}
            <canvas ref={canvasElRef} className="hidden" />

            <div className={`absolute inset-0 transition-transform duration-400 ease-in-out ${isBouncing ? 'scale-110' : 'scale-100'}`}>
                <ParticleRing isActive={isSessionActive} micVolume={micVolume} sessionState={sessionState} />
            </div>

            <div className="absolute top-[20vh] left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none text-center">
                <h2 className="text-3xl font-bold text-slate-700 dark:text-gray-300 transition-opacity duration-500 whitespace-nowrap bg-black/20 dark:bg-black/40 p-2 rounded-lg backdrop-blur-sm">
                    {getStatusText()}
                </h2>
            </div>
            
            <div className="fixed bottom-0 left-0 right-0 h-[25vh] max-h-60 pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-t from-slate-100/50 via-slate-100/20 to-transparent dark:from-black/80 dark:via-black/50" />
                <div 
                    ref={transcriptionContainerRef}
                    className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 lg:px-8 pb-20 sm:pb-24 max-h-full overflow-y-auto pointer-events-auto"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    <div className="flex flex-col gap-3 w-full max-w-4xl mx-auto">
                        {transcriptionHistory.map((item, index) => (
                            item.speaker === 'user' ? null :
                            <div key={`hist-${index}`} className="w-full flex justify-start">
                                <div 
                                    onClick={(e) => { e.stopPropagation(); handleCopy(item.text, `hist-${index}`); }}
                                    className="text-sm max-w-[80%] text-slate-800 dark:text-slate-200 p-2 rounded-lg transition-colors cursor-pointer hover:bg-slate-200/50 dark:hover:bg-white/20 bg-slate-200/30 dark:bg-slate-800/50 backdrop-blur-sm"
                                    aria-label="Copy message"
                                >
                                    {item.text}
                                    {copiedInfo?.index === `hist-${index}` && <span className="text-green-500 dark:text-green-400 text-xs font-semibold ml-2">Copied!</span>}
                                </div>
                            </div>
                        ))}
                        {currentModelText && (
                            <div className="w-full flex justify-start">
                                 <div
                                    onClick={(e) => { e.stopPropagation(); handleCopy(currentModelText, 'current-model'); }}
                                    className="text-sm max-w-[80%] text-slate-800 dark:text-slate-200 p-2 rounded-lg transition-colors cursor-pointer hover:bg-slate-200/50 dark:hover:bg-white/20 bg-slate-200/30 dark:bg-slate-800/50 backdrop-blur-sm"
                                    aria-label="Copy message"
                                >
                                    {currentModelText}
                                    <span className="inline-block align-text-bottom w-px h-4 ml-1 border-r-2 border-cyan-400 animate-blink-caret"></span>
                                    {copiedInfo?.index === 'current-model' && <span className="text-green-500 dark:text-green-400 text-xs font-semibold ml-2">Copied!</span>}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {error && <p className="absolute bottom-24 text-red-500 dark:text-red-400 text-sm px-4 text-center pointer-events-none bg-black/20 dark:bg-black/40 p-2 rounded-lg backdrop-blur-sm">{error}</p>}
        </div>
    );
};

export default AssistantView;