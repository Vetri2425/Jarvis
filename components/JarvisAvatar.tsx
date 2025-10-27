import React from 'react';

interface JarvisAvatarProps {
    isSpeaking: boolean;
}

const JarvisAvatar: React.FC<JarvisAvatarProps> = ({ isSpeaking }) => {
    return (
        <div className="relative w-64 h-64 md:w-96 md:h-96">
            <style>
                {`
                @keyframes breath {
                    0%, 100% { transform: scale(1); opacity: 0.8; }
                    50% { transform: scale(1.03); opacity: 1; }
                }
                @keyframes pulse {
                    0%, 100% { transform: scale(1); box-shadow: 0 0 40px 10px rgba(59, 130, 246, 0.5); }
                    50% { transform: scale(1.05); box-shadow: 0 0 60px 20px rgba(59, 130, 246, 0.7); }
                }
                .breathing-orb {
                    animation: breath 5s ease-in-out infinite;
                }
                .speaking-orb {
                    animation: pulse 1.5s ease-in-out infinite;
                }
                `}
            </style>
            <svg viewBox="0 0 200 200" className={`w-full h-full filter drop-shadow-lg ${isSpeaking ? 'speaking-orb' : 'breathing-orb'}`}>
                {/* Defs for gradients */}
                <defs>
                    <radialGradient id="grad1" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                        <stop offset="0%" style={{ stopColor: 'rgb(147, 197, 253)', stopOpacity: 1 }} />
                        <stop offset="100%" style={{ stopColor: 'rgb(59, 130, 246)', stopOpacity: 1 }} />
                    </radialGradient>
                    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="10" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {/* Main Orb */}
                <circle cx="100" cy="100" r="90" fill="url(#grad1)" filter="url(#glow)" />

                {/* Inner Rings */}
                <circle cx="100" cy="100" r="75" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
                <circle cx="100" cy="100" r="60" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />

                {/* Animated Dashed Ring */}
                <circle cx="100" cy="100" r="85" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeDasharray="5 15">
                    <animateTransform
                        attributeName="transform"
                        type="rotate"
                        from="0 100 100"
                        to="360 100 100"
                        dur="30s"
                        repeatCount="indefinite"
                    />
                </circle>
            </svg>
        </div>
    );
};

export default JarvisAvatar;
