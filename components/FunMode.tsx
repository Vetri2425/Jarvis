import React, { useState, useRef, useEffect, useCallback } from 'react';
// FIX: Removed 'Blob' import and replaced with local 'MediaBlob' type to fix runtime error.
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { decode, encode, decodeAudioData } from '../utils/audioUtils';
import JarvisAvatar from './JarvisAvatar';
import { CameraIcon, MicIcon } from './Icons';
import { MediaBlob } from '../types';

interface FunModeProps {
    onExit: () => void;
    microphoneDeviceId: string;
}

interface LiveSession {
    close(): void;
    sendRealtimeInput(input: { media: MediaBlob }): void;
}

const FunMode: React.FC<FunModeProps> = ({ onExit, microphoneDeviceId }) => {
    const [permissionStatus, setPermissionStatus] = useState<'idle' | 'pending' | 'granted' | 'denied'>('idle');
    const videoRef = useRef<HTMLVideoElement>(null);
    const [status, setStatus] = useState('Initializing...');
    const [userTranscript, setUserTranscript] = useState('');
    const [jarvisTranscript, setJarvisTranscript] = useState('');
    const [isSpeaking, setIsSpeaking] = useState(false);
    
    const liveSessionRef = useRef<LiveSession | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const nextStartTimeRef = useRef(0);
    const speakingTimeoutRef = useRef<number | null>(null);

    const playAudioData = useCallback(async (base64Audio: string) => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        const ctx = audioContextRef.current;
        
        try {
            const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
            
            setIsSpeaking(true);
            if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);

            const nextStartTime = Math.max(nextStartTimeRef.current, ctx.currentTime);
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(ctx.destination);
            source.start(nextStartTime);
            
            source.onended = () => {
                speakingTimeoutRef.current = window.setTimeout(() => setIsSpeaking(false), 500);
            };

            nextStartTimeRef.current = nextStartTime + audioBuffer.duration;
        } catch (e) {
            console.error("Error playing audio data:", e);
            setIsSpeaking(false);
        }
    }, []);

    const startSession = useCallback(async () => {
        if (permissionStatus === 'granted' || permissionStatus === 'pending') return;

        setPermissionStatus('pending');
        setStatus('Requesting permissions...');

        try {
            const constraints = {
                video: true,
                audio: microphoneDeviceId ? { deviceId: { exact: microphoneDeviceId } } : true,
            };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            mediaStreamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }

            setPermissionStatus('granted');
            setStatus('Connecting to Jarvis...');

            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    systemInstruction: "You are Jarvis, a friendly and helpful AI assistant. Keep your responses conversational and relatively brief, as if you're on a video call."
                },
                callbacks: {
                    onopen: () => {
                        setStatus('Connected! You can start talking.');
                        const ctx = new AudioContext({ sampleRate: 16000 });
                        inputAudioContextRef.current = ctx;
                        const sourceNode = ctx.createMediaStreamSource(stream);
                        const processor = ctx.createScriptProcessor(4096, 1, 1);
                        processor.onaudioprocess = (e) => {
                            const pcmBlob: MediaBlob = {
                                data: encode(new Uint8Array(new Int16Array(e.inputBuffer.getChannelData(0).map(f => f * 32768)).buffer)),
                                mimeType: 'audio/pcm;rate=16000',
                            };
                            sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
                        };
                        sourceNode.connect(processor);
                        processor.connect(ctx.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.serverContent?.inputTranscription?.text) {
                            setUserTranscript(prev => prev + message.serverContent.inputTranscription.text);
                        }
                        if (message.serverContent?.outputTranscription?.text) {
                            setJarvisTranscript(prev => prev + message.serverContent.outputTranscription.text);
                        }
                        if (message.serverContent?.turnComplete) {
                            setUserTranscript('');
                            setJarvisTranscript('');
                        }
                        const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (audioData) await playAudioData(audioData);
                    },
                    onerror: (e) => {
                         console.error("Live API Error:", e);
                         setStatus(`Connection error.`);
                    },
                    onclose: () => {
                        setStatus("Session ended.");
                    },
                },
            });
            liveSessionRef.current = await sessionPromise;

        } catch (err) {
            console.error("Failed to start Fun Mode:", err);
            setStatus("Error: Could not access camera or microphone.");
            setPermissionStatus('denied');
        }
    }, [playAudioData, permissionStatus, microphoneDeviceId]);

    useEffect(() => {
        return () => {
            liveSessionRef.current?.close();
            mediaStreamRef.current?.getTracks().forEach(track => track.stop());
            if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
                inputAudioContextRef.current.close();
            }
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close();
            }
        };
    }, []);

    const renderContent = () => {
        switch (permissionStatus) {
            case 'granted':
                return (
                    <>
                        <video
                            ref={videoRef}
                            autoPlay
                            muted
                            playsInline
                            className="absolute top-4 right-4 w-48 h-36 rounded-lg shadow-2xl object-cover border-2 border-slate-700 z-20"
                        />
                         <div className="absolute top-4 left-4 z-20">
                            <button onClick={onExit} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition-colors">
                                Exit Fun Mode
                            </button>
                        </div>
                        <div className="flex flex-col items-center justify-center">
                            <JarvisAvatar isSpeaking={isSpeaking} />
                            <p className="mt-4 text-lg font-medium bg-black/30 px-3 py-1 rounded-md">{status}</p>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-slate-900 to-transparent">
                            <div className="max-w-4xl mx-auto bg-black/30 p-4 rounded-lg backdrop-blur-sm">
                                <p className="text-lg text-blue-300"><span className="font-bold">You:</span> {userTranscript}</p>
                                <p className="text-lg text-slate-100 mt-2"><span className="font-bold">Jarvis:</span> {jarvisTranscript}</p>
                            </div>
                        </div>
                    </>
                );
            case 'denied':
                return (
                    <div className="text-center max-w-lg p-8">
                        <h2 className="text-3xl font-bold text-red-400 mb-4">Permissions Denied</h2>
                        <p className="text-slate-300 mb-6">
                            Jarvis needs access to your camera and microphone for the video call. Please enable these permissions in your browser's site settings and try again.
                        </p>
                        <div className="flex justify-center gap-4">
                            <button onClick={onExit} className="px-5 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition-colors">
                                Exit
                            </button>
                            <button onClick={startSession} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors">
                                Retry
                            </button>
                        </div>
                    </div>
                );
            case 'pending':
                 return (
                    <div className="text-center p-8">
                        <div className="w-16 h-16 border-4 border-slate-500 border-t-blue-400 rounded-full animate-spin mx-auto mb-6"></div>
                        <h2 className="text-3xl font-bold text-slate-200">Waiting for Permission</h2>
                        <p className="text-slate-400 mt-2">Please allow camera and microphone access in the browser prompt.</p>
                    </div>
                 );
            case 'idle':
            default:
                return (
                    <div className="text-center max-w-lg p-8">
                        <h2 className="text-4xl font-bold text-slate-100 mb-4">Enter Fun Mode</h2>
                        <p className="text-slate-300 mb-8">
                            Experience a live, face-to-face conversation with Jarvis. This mode requires access to your camera and microphone to function.
                        </p>
                        <div className="flex items-center justify-center gap-6 mb-8 text-slate-400">
                            <div className="flex items-center gap-2"><CameraIcon className="w-6 h-6" /> Camera Access</div>
                            <div className="flex items-center gap-2"><MicIcon className="w-6 h-6" /> Microphone Access</div>
                        </div>
                        <div className="flex justify-center gap-4">
                             <button onClick={onExit} className="px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition-colors">
                                Cancel
                            </button>
                            <button onClick={startSession} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold text-lg transition-colors">
                                Grant Permissions & Start
                            </button>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900 text-white flex flex-col items-center justify-center z-50 transition-opacity duration-300">
            {renderContent()}
        </div>
    );
};

export default FunMode;
