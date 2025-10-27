import React, { useState, useRef, useCallback, useEffect } from 'react';
// FIX: Imported `LiveServerMessage` to resolve `Cannot find name 'LiveServerMessage'` error.
import { GoogleGenAI, Modality, Blob, LiveServerMessage } from '@google/genai';
import { Message, Author, ContentType, MessageContent, AssistantMode, AspectRatio, GroundingContent, ChatSession } from './types';
import { fileToBase64, blobToBase64 } from './utils/fileUtils';
import ChatMessage from './components/ChatMessage';
import { SendIcon, PaperclipIcon, MicIcon, StopIcon, CheckIcon, MenuIcon, RecordIcon } from './components/Icons';
import { decode, encode, decodeAudioData, createWavBlobFromPcm } from './utils/audioUtils';
import LoginScreen from './components/LoginScreen';
import Sidebar from './components/Sidebar';
import FunMode from './components/FunMode';


// --- Helper Components & Mappings ---

const MODE_MAP: Record<AssistantMode, { label: string; isText: boolean }> = {
    [AssistantMode.BEST]: { label: "🏆 Best (All-Purpose)", isText: true },
    [AssistantMode.ANSWER_EXPLAIN]: { label: "🧠 Answer & Explain", isText: true },
    [AssistantMode.WRITE_EDIT]: { label: "✍️ Write & Edit", isText: true },
    [AssistantMode.CODE_DEBUG]: { label: "💻 Code & Debug", isText: true },
    [AssistantMode.CREATE_DESIGN]: { label: "🎨 Create & Design", isText: true },
    [AssistantMode.PLAN_ORGANIZE]: { label: "📅 Plan & Organize", isText: true },
    [AssistantMode.IMAGE_GEN]: { label: "🖼️ Image Generation", isText: false },
    [AssistantMode.IMAGE_EDIT]: { label: "✂️ Image Editing", isText: false },
    [AssistantMode.VIDEO_GEN]: { label: "🎬 Video Generation", isText: false },
    [AssistantMode.LIVE]: { label: "🎙️ Live Conversation", isText: false },
    [AssistantMode.FUN_MODE]: { label: "🤖 Fun Mode (Video Call)", isText: false },
};

const getModelForMode = (mode: AssistantMode): string => {
    switch (mode) {
        case AssistantMode.BEST:
        case AssistantMode.ANSWER_EXPLAIN:
        case AssistantMode.CODE_DEBUG:
            return 'gemini-2.5-pro';
        case AssistantMode.WRITE_EDIT:
        case AssistantMode.CREATE_DESIGN:
        case AssistantMode.PLAN_ORGANIZE:
            return 'gemini-2.5-flash';
        default: // For modes that are already model names
            return mode;
    }
};

const PLACEHOLDER_MAP: Record<AssistantMode, string> = {
    [AssistantMode.BEST]: "Ask me anything or give me a complex task...",
    [AssistantMode.ANSWER_EXPLAIN]: "Ask a complex question or explain a topic...",
    [AssistantMode.WRITE_EDIT]: "Paste text to edit, or ask me to write an email, essay, etc...",
    [AssistantMode.CODE_DEBUG]: "Paste code to debug, or describe the function you need...",
    [AssistantMode.CREATE_DESIGN]: "Brainstorm ideas or generate creative content...",
    [AssistantMode.PLAN_ORGANIZE]: "Create a study plan, project timeline, or to-do list...",
    [AssistantMode.IMAGE_GEN]: "Describe the image you want to create...",
    [AssistantMode.IMAGE_EDIT]: "Upload an image and describe the edit...",
    [AssistantMode.VIDEO_GEN]: "Describe the video you want to generate...",
    [AssistantMode.LIVE]: "Live session is active...",
    [AssistantMode.FUN_MODE]: "Fun Mode is active. Switch modes to chat.",
};

const ModeSelector: React.FC<{
    selectedMode: AssistantMode;
    setSelectedMode: (mode: AssistantMode) => void;
    disabled: boolean;
}> = ({ selectedMode, setSelectedMode, disabled }) => {
    return (
        <select
            value={selectedMode}
            onChange={(e) => setSelectedMode(e.target.value as AssistantMode)}
            disabled={disabled}
            className="bg-slate-100 border border-slate-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 transition-all appearance-none"
        >
            {Object.entries(MODE_MAP).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
            ))}
        </select>
    );
};

const AspectRatioSelector: React.FC<{
    selected: AspectRatio;
    setSelected: (ratio: AspectRatio) => void;
    options: AspectRatio[];
    disabled: boolean;
}> = ({ selected, setSelected, options, disabled }) => (
    <div className="flex items-center gap-1 bg-slate-100 border border-slate-300 p-1 rounded-md">
        {options.map(ratio => (
            <button
                key={ratio}
                onClick={() => setSelected(ratio)}
                disabled={disabled}
                className={`px-2 py-1 text-xs rounded ${selected === ratio ? 'bg-blue-500 text-white' : 'hover:bg-slate-200'}`}
            >
                {ratio}
            </button>
        ))}
    </div>
);

const GroundingToggle: React.FC<{
    label: string;
    enabled: boolean;
    setEnabled: (enabled: boolean) => void;
    disabled: boolean;
}> = ({ label, enabled, setEnabled, disabled }) => (
    <button
        onClick={() => setEnabled(!enabled)}
        disabled={disabled}
        className="flex items-center gap-1.5 text-xs text-slate-600 disabled:opacity-50"
    >
        <div className={`w-4 h-4 rounded border-2 ${enabled ? 'bg-blue-500 border-blue-500' : 'border-slate-400'} flex items-center justify-center`}>
            {enabled && <CheckIcon className="w-3 h-3 text-white" />}
        </div>
        {label}
    </button>
);

interface LiveSession {
  close(): void;
  sendRealtimeInput(input: { media: Blob }): void;
}


// --- Main App Component ---

const App: React.FC = () => {
    // --- State Management ---
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    
    // Lazy initialize chat sessions from localStorage for robust persistence.
    const [chatSessions, setChatSessions] = useState<ChatSession[]>(() => {
        try {
            const savedChats = localStorage.getItem('jarvisChatSessions');
            return savedChats ? JSON.parse(savedChats) : [];
        } catch (error) {
            console.error("Failed to parse chat sessions from localStorage:", error);
            return [];
        }
    });
    
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const [input, setInput] = useState('');
    const [attachedFile, setAttachedFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
    
    // Mode & Options State
    const [mode, setMode] = useState<AssistantMode>(AssistantMode.BEST);
    const [imageAspectRatio, setImageAspectRatio] = useState<AspectRatio>("1:1");
    const [videoAspectRatio, setVideoAspectRatio] = useState<AspectRatio>("16:9");
    const [useSearch, setUseSearch] = useState(false);
    const [useMaps, setUseMaps] = useState(false);
    
    // Live API & Audio State
    const [isLiveSession, setIsLiveSession] = useState(false);
    const liveSessionRef = useRef<LiveSession | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    let nextStartTime = 0; // for TTS playback queue
    
    // Refs
    const fileInputRef = useRef<HTMLInputElement>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const activeChat = chatSessions.find(c => c.id === activeChatId);
    
    // --- Effects ---
    // Auto-save chat sessions to local storage whenever they change.
    useEffect(() => {
        try {
            localStorage.setItem('jarvisChatSessions', JSON.stringify(chatSessions));
        } catch (error) {
            console.error("Failed to save chat sessions to localStorage:", error);
        }
    }, [chatSessions]);

    // Effect to manage the active chat ID based on the session list.
    useEffect(() => {
        // If there's no active chat but sessions exist, select the first one.
        if (!activeChatId && chatSessions.length > 0) {
            setActiveChatId(chatSessions[0].id);
        }
        // If the active chat was deleted, select the new first chat or none.
        if (activeChatId && !chatSessions.find(s => s.id === activeChatId)) {
            setActiveChatId(chatSessions.length > 0 ? chatSessions[0].id : null);
        }
    }, [chatSessions, activeChatId]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [activeChat?.messages]);

    // Create a new session on first login if none exist.
    useEffect(() => {
        if (isAuthenticated && chatSessions.length === 0) {
            handleNewSession();
        }
    }, [isAuthenticated, chatSessions]);

    // Cleanup Live session on unmount
    useEffect(() => {
        return () => {
            liveSessionRef.current?.close();
        };
    }, []);

    // --- Session Management ---
    const handleNewSession = () => {
        const newSession: ChatSession = {
            id: crypto.randomUUID(),
            title: 'New Chat',
            messages: [{
                id: 'init',
                author: Author.AI,
                content: [{ type: ContentType.MARKDOWN, text: "Hello! I am Jarvis. How can I assist you today? I'm currently in 'Best' mode, ready for any complex task." }],
            }],
        };
        setChatSessions(prev => [newSession, ...prev]);
        setActiveChatId(newSession.id);
    };
    
    const handleDeleteSession = (idToDelete: string) => {
        setChatSessions(prev => prev.filter(s => s.id !== idToDelete));
        // Active chat ID is managed by a separate useEffect for robustness.
    };

    // --- Core Message Functions ---
    const addMessage = useCallback((author: Author, content: MessageContent[], isLoading = false): string => {
        if (!activeChatId) return '';
        const newMessage: Message = { id: crypto.randomUUID(), author, content, isLoading };
        setChatSessions(prev => prev.map(s => s.id === activeChatId ? {...s, messages: [...s.messages, newMessage]} : s));
        return newMessage.id;
    }, [activeChatId]);

    const updateMessage = useCallback((id: string, newContent: MessageContent[], isLoading = false) => {
        if (!activeChatId) return;
        setChatSessions(prev => prev.map(s => {
            if (s.id === activeChatId) {
                const updatedMessages = s.messages.map(msg => msg.id === id ? { ...msg, content: newContent, isLoading } : msg);
                return {...s, messages: updatedMessages};
            }
            return s;
        }));
    }, [activeChatId]);
    
    const streamToMessage = useCallback((id: string, chunk: string) => {
        if (!activeChatId) return;
        setChatSessions(prev => prev.map(s => {
            if (s.id === activeChatId) {
                 const updatedMessages = s.messages.map(msg => {
                    if (msg.id === id) {
                        const newMsg = { ...msg };
                        let textContent = newMsg.content.find(c => c.type === ContentType.MARKDOWN) as { type: ContentType.MARKDOWN, text: string } | undefined;
                        if (textContent) {
                            textContent.text += chunk;
                        } else {
                            newMsg.content.push({ type: ContentType.MARKDOWN, text: chunk });
                        }
                        return newMsg;
                    }
                    return msg;
                });
                return {...s, messages: updatedMessages};
            }
            return s;
        }));
    }, [activeChatId]);

    // --- Text-to-Speech & Audio Playback ---
    const playAudioData = useCallback(async (base64Audio: string) => {
        if (!outputAudioContextRef.current) {
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        const ctx = outputAudioContextRef.current;
        if (!ctx) return;
        
        try {
            const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
            
            nextStartTime = Math.max(nextStartTime, ctx.currentTime);
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(ctx.destination);
            source.start(nextStartTime);
            nextStartTime += audioBuffer.duration;
        } catch (e) {
            console.error("Error playing audio data:", e);
        }
    }, []);
    
    const getTtsAudio = async (text: string): Promise<string | null> => {
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
            
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text: `Say: ${text}` }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: 'Puck' },
                        },
                    },
                },
            });
            return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
        } catch (e) {
            console.error("TTS Error:", e);
            addMessage(Author.SYSTEM, [{ type: ContentType.TEXT, text: "Sorry, I couldn't generate audio for that." }]);
            return null;
        }
    };

    const handlePlayAudio = async (text: string) => {
        const base64Audio = await getTtsAudio(text);
        if (base64Audio) {
            await playAudioData(base64Audio);
        }
    };

    const handleDownloadAudio = async (text: string) => {
        const base64Audio = await getTtsAudio(text);
        if (base64Audio) {
            const pcmData = decode(base64Audio);
            const wavBlob = createWavBlobFromPcm(pcmData, 24000, 1);
            const url = URL.createObjectURL(wavBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'jarvis-audio.wav';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    };
    
    // --- Live API ---
    const toggleLiveSession = async () => {
        if (isLiveSession) {
            liveSessionRef.current?.close();
            setIsLiveSession(false);
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setIsLiveSession(true);
            addMessage(Author.SYSTEM, [{ type: ContentType.TEXT, text: "Live session started. I'm listening..." }]);
            
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
            const sessionPromise = ai.live.connect({
                model: AssistantMode.LIVE,
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                },
                callbacks: {
                    onopen: () => {
                        const inputAudioContext = new AudioContext({ sampleRate: 16000 });
                        const source = inputAudioContext.createMediaStreamSource(stream);
                        const processor = inputAudioContext.createScriptProcessor(4096, 1, 1);
                        processor.onaudioprocess = (e) => {
                            const pcmBlob: Blob = {
                                data: encode(new Uint8Array(new Int16Array(e.inputBuffer.getChannelData(0).map(f => f * 32768)).buffer)),
                                mimeType: 'audio/pcm;rate=16000',
                            };
                            sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
                        };
                        source.connect(processor);
                        processor.connect(inputAudioContext.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.serverContent?.turnComplete) {
                            const userInput = message.serverContent?.inputTranscription?.text;
                            const modelOutput = message.serverContent?.outputTranscription?.text;
                            if(userInput) addMessage(Author.USER, [{type: ContentType.TEXT, text: userInput}]);
                            if(modelOutput) addMessage(Author.AI, [{type: ContentType.MARKDOWN, text: modelOutput}]);
                        }
                        const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (audioData) await playAudioData(audioData);
                    },
                    onerror: (e) => {
                         console.error("Live API Error:", e);
                         addMessage(Author.SYSTEM, [{ type: ContentType.TEXT, text: `Live session error: ${e}` }]);
                         setIsLiveSession(false);
                    },
                    onclose: () => {
                        stream.getTracks().forEach(track => track.stop());
                        addMessage(Author.SYSTEM, [{ type: ContentType.TEXT, text: "Live session ended." }]);
                    },
                },
            });
            liveSessionRef.current = await sessionPromise;

        } catch (error) {
            console.error("Failed to start live session:", error);
            addMessage(Author.SYSTEM, [{ type: ContentType.TEXT, text: "Could not start microphone. Please check permissions." }]);
            setIsLiveSession(false);
        }
    };
    
    const generateTitle = async (prompt: string) => {
        if (!activeChatId) return;
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Create a very short, concise title (4 words max) for a conversation that starts with this user prompt: "${prompt}"`,
            });
            const newTitle = response.text.replace(/["*]/g, '').trim();
            if (newTitle) {
                setChatSessions(prev => prev.map(s => s.id === activeChatId ? {...s, title: newTitle} : s));
            }
        } catch (error) {
            console.error("Failed to generate title:", error);
        }
    };

    // --- Main Send Handler ---
    const handleSend = async () => {
        if ((!input.trim() && !attachedFile) || isLoading || !activeChat) return;

        // Auto-generate title for new chats
        if (activeChat.messages.length <= 1 && input.trim()) {
            generateTitle(input.trim());
        }

        setIsLoading(true);
        const currentInput = input;
        const currentFile = attachedFile;
        const currentMode = mode;
        
        let userContent: MessageContent[] = [];
        if (currentInput.trim()) userContent.push({ type: ContentType.TEXT, text: currentInput });
        if (currentFile) {
            const mime = currentFile.type;
            if (mime.startsWith('image/')) {
                userContent.push({ type: ContentType.IMAGE, url: URL.createObjectURL(currentFile), alt: currentFile.name });
            } else if (mime.startsWith('video/')) {
                 userContent.push({ type: ContentType.VIDEO, url: URL.createObjectURL(currentFile) });
            }
        }
        
        addMessage(Author.USER, userContent);
        setInput('');
        setAttachedFile(null);
        
        const aiMessageId = addMessage(Author.AI, [], true);
        
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
            
            switch(currentMode) {
                case AssistantMode.IMAGE_GEN: {
                    const response = await ai.models.generateImages({
                        model: currentMode,
                        prompt: currentInput,
                        config: { numberOfImages: 1, outputMimeType: 'image/jpeg', aspectRatio: imageAspectRatio },
                    });
                    const imageUrl = `data:image/jpeg;base64,${response.generatedImages[0].image.imageBytes}`;
                    updateMessage(aiMessageId, [{ type: ContentType.IMAGE, url: imageUrl, alt: currentInput }]);
                    break;
                }
                case AssistantMode.VIDEO_GEN: {
                    const hasKey = await (window as any).aistudio?.hasSelectedApiKey();
                    if(!hasKey) {
                        setIsApiKeyModalOpen(true);
                        updateMessage(aiMessageId, [{ type: ContentType.TEXT, text: "Video generation requires an API key. Please follow the prompt." }]);
                        setIsLoading(false);
                        return;
                    }
                    streamToMessage(aiMessageId, "📹 Starting video generation... This can take a few minutes.");
                    
                    let operation = await ai.models.generateVideos({
                        model: currentMode,
                        prompt: currentInput,
                        image: currentFile ? { imageBytes: await fileToBase64(currentFile), mimeType: currentFile.type } : undefined,
                        config: { numberOfVideos: 1, resolution: '720p', aspectRatio: videoAspectRatio }
                    });

                    while (!operation.done) {
                        await new Promise(resolve => setTimeout(resolve, 10000));
                        operation = await ai.operations.getVideosOperation({ operation });
                        streamToMessage(aiMessageId, ".");
                    }

                    if (operation.done && operation.response?.generatedVideos?.[0]?.video?.uri) {
                        const downloadLink = operation.response.generatedVideos[0].video.uri;
                        const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
                        const videoUrl = URL.createObjectURL(await videoResponse.blob());
                        updateMessage(aiMessageId, [{ type: ContentType.VIDEO, url: videoUrl }]);
                    } else { throw new Error('Video generation failed or timed out.'); }
                    break;
                }
                case AssistantMode.IMAGE_EDIT: {
                    if (!currentFile || !currentFile.type.startsWith('image/')) {
                         throw new Error("Please attach an image to edit.");
                    }
                    const base64Image = await fileToBase64(currentFile);
                    const response = await ai.models.generateContent({
                        model: currentMode,
                        contents: { parts: [ { inlineData: { data: base64Image, mimeType: currentFile.type } }, { text: currentInput } ] },
                        config: { responseModalities: [Modality.IMAGE] },
                    });
                    const newImagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
                    if (newImagePart?.inlineData) {
                        const imageUrl = `data:${newImagePart.inlineData.mimeType};base64,${newImagePart.inlineData.data}`;
                        updateMessage(aiMessageId, [{ type: ContentType.IMAGE, url: imageUrl, alt: "Edited image" }]);
                    } else { throw new Error("Image editing failed to produce an image."); }
                    break;
                }
                case AssistantMode.BEST:
                case AssistantMode.ANSWER_EXPLAIN:
                case AssistantMode.WRITE_EDIT:
                case AssistantMode.CODE_DEBUG:
                case AssistantMode.CREATE_DESIGN:
                case AssistantMode.PLAN_ORGANIZE:
                default: {
                    const modelName = getModelForMode(currentMode);
                    const chat = ai.chats.create({
                        model: modelName,
                        config: {
                            thinkingConfig: (currentMode === AssistantMode.BEST || currentMode === AssistantMode.CODE_DEBUG || currentMode === AssistantMode.ANSWER_EXPLAIN) ? { thinkingBudget: 32768 } : undefined,
                            tools: [ ...(useSearch ? [{googleSearch: {}}] : []), ...(useMaps ? [{googleMaps: {}}] : []) ],
                        }
                    });
                    
                    let messagePayload: (string | {inlineData: {data: string, mimeType: string}} | {text: string})[] = [currentInput];
                    if (currentFile) {
                        const base64File = await fileToBase64(currentFile);
                        messagePayload = [ { text: currentInput }, { inlineData: { data: base64File, mimeType: currentFile.type } } ];
                    }

                    const resultStream = await chat.sendMessageStream({ message: messagePayload });
                    updateMessage(aiMessageId, [{ type: ContentType.MARKDOWN, text: "" }], true);
                    let fullResponseText = "";
                    let groundingSources: GroundingContent['sources'] = [];

                    for await (const chunk of resultStream) {
                        const chunkText = chunk.text;
                        if(chunkText) {
                            streamToMessage(aiMessageId, chunkText);
                            fullResponseText += chunkText;
                        }
                        
                        const groundingMeta = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
                        if (groundingMeta) {
                            for (const g of groundingMeta) {
                                const source = g.web || g.maps;
                                if (source && source.uri) {
                                    groundingSources.push({ uri: source.uri, title: source.title || source.uri });
                                }
                            }
                        }
                    }

                    const finalContent: MessageContent[] = [{ type: ContentType.MARKDOWN, text: fullResponseText }];
                    if (groundingSources.length > 0) {
                        const uniqueSources = Array.from(new Map(groundingSources.map(s => [s.uri, s])).values());
                        finalContent.push({ type: ContentType.GROUNDING, sources: uniqueSources });
                    }
                    updateMessage(aiMessageId, finalContent, false);
                    break;
                }
            }
        } catch (error: any) {
            console.error(error);
            const errorMessage = error.message?.includes("not found") ? "API Key error. For video, please re-select your key." : error.message || "Sorry, something went wrong.";
            updateMessage(aiMessageId, [{type: ContentType.TEXT, text: `Error: ${errorMessage}`}]);
            if(error.message?.includes("not found")) setIsApiKeyModalOpen(true);
        } finally {
            setIsLoading(false);
        }
    };
    
    // --- UI Handlers ---
    const handleSelectKey = async () => {
        await (window as any).aistudio?.openSelectKey();
        setIsApiKeyModalOpen(false);
        addMessage(Author.SYSTEM, [{type: ContentType.TEXT, text: "API Key selected. You can now try again."}])
    }

    // --- Render ---
    if (!isAuthenticated) {
        return <LoginScreen onLoginSuccess={() => setIsAuthenticated(true)} />;
    }

    if (mode === AssistantMode.FUN_MODE) {
        return <FunMode onExit={() => setMode(AssistantMode.BEST)} />;
    }

    const isTextMode = MODE_MAP[mode]?.isText;

    return (
        <div className="flex h-screen bg-slate-50 text-slate-800 font-sans">
            <Sidebar 
                sessions={chatSessions}
                activeSessionId={activeChatId}
                onSelectSession={setActiveChatId}
                onNewSession={handleNewSession}
                onDeleteSession={handleDeleteSession}
                isOpen={isSidebarOpen}
            />
            <div className="flex flex-col flex-1 h-screen transition-all duration-300 ease-in-out">
                <header className="p-4 border-b border-slate-200 shadow-sm flex items-center gap-4 bg-white/80 backdrop-blur-sm">
                    <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-slate-100 rounded-full">
                        <MenuIcon className="w-6 h-6 text-slate-600" />
                    </button>
                    <h1 className="text-xl font-bold text-slate-700">
                        {activeChat?.title || 'Jarvis'}
                    </h1>
                </header>

                {isApiKeyModalOpen && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white p-8 rounded-lg shadow-2xl max-w-md text-center">
                            <h2 className="text-2xl font-bold mb-4 text-slate-800">API Key Required</h2>
                            <p className="mb-6 text-slate-500">
                                This feature requires you to select your own API key. See <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">billing docs</a>.
                            </p>
                            <button onClick={handleSelectKey} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-colors w-full">Select API Key</button>
                        </div>
                    </div>
                )}

                <main className="flex-1 overflow-y-auto p-4 md:p-6">
                    <div className="max-w-4xl mx-auto">
                        {activeChat?.messages.map((msg) => (
                            <ChatMessage key={msg.id} message={msg} onPlayAudio={handlePlayAudio} onDownloadAudio={handleDownloadAudio} />
                        ))}
                        <div ref={chatEndRef} />
                    </div>
                </main>

                <footer className="p-4 bg-white/80 backdrop-blur-sm border-t border-slate-200">
                    <div className="max-w-4xl mx-auto flex flex-col gap-3">
                         <div className="flex items-center gap-4 px-2">
                            <ModeSelector selectedMode={mode} setSelectedMode={setMode} disabled={isLoading || isLiveSession} />
                            {mode === AssistantMode.IMAGE_GEN && <AspectRatioSelector selected={imageAspectRatio} setSelected={setImageAspectRatio} options={["1:1", "16:9", "9:16", "4:3", "3:4"]} disabled={isLoading} />}
                            {mode === AssistantMode.VIDEO_GEN && <AspectRatioSelector selected={videoAspectRatio} setSelected={setVideoAspectRatio} options={["16:9", "9:16"]} disabled={isLoading} />}
                            {isTextMode && (
                                <div className="flex items-center gap-4">
                                    <GroundingToggle label="Search" enabled={useSearch} setEnabled={setUseSearch} disabled={isLoading} />
                                    <GroundingToggle label="Maps" enabled={useMaps} setEnabled={setUseMaps} disabled={isLoading} />
                                </div>
                            )}
                        </div>
                        <div className="relative flex items-center bg-white border border-slate-300 rounded-xl p-2 shadow-sm">
                            <button onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-500 hover:text-blue-500 transition-colors rounded-full" disabled={isLoading || isLiveSession}>
                                <PaperclipIcon className="w-6 h-6" />
                            </button>
                            <input type="file" ref={fileInputRef} onChange={(e) => setAttachedFile(e.target.files?.[0] || null)} className="hidden" />

                            <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                                placeholder={
                                    attachedFile ? `Attached: ${attachedFile.name}` : PLACEHOLDER_MAP[mode]
                                }
                                rows={1}
                                className="flex-1 bg-transparent text-lg resize-none p-2 focus:outline-none placeholder-slate-400"
                                disabled={isLoading || isLiveSession}
                            />

                            {mode === AssistantMode.LIVE && (
                                <button onClick={toggleLiveSession} className={`p-2 transition-colors rounded-full ${isLiveSession ? 'text-red-500 animate-pulse' : 'text-slate-500 hover:text-red-500'}`}>
                                    {isLiveSession ? <StopIcon className="w-6 h-6" /> : <MicIcon className="w-6 h-6" />}
                                </button>
                            )}

                            <button
                                onClick={handleSend}
                                disabled={isLoading || (!input.trim() && !attachedFile) || isLiveSession}
                                className="ml-2 bg-blue-500 text-white rounded-lg p-3 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600 transition-all"
                            >
                                {isLoading ? <div className="w-6 h-6 border-2 border-white/50 border-t-white rounded-full animate-spin"></div> : <SendIcon className="w-6 h-6" />}
                            </button>
                        </div>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default App;