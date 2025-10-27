import React from 'react';
import { AppSettings, TtsVoice } from '../types';
import { CloseIcon } from './Icons';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: AppSettings;
    onSettingsChange: (newSettings: Partial<AppSettings>) => void;
    availableDevices: MediaDeviceInfo[];
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSettingsChange, availableDevices }) => {
    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50"
            onClick={onClose}
        >
            <div 
                className="bg-white p-6 rounded-lg shadow-2xl max-w-md w-full m-4 space-y-6"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-slate-800">Settings</h2>
                    <button onClick={onClose} className="p-1 rounded-full text-slate-500 hover:bg-slate-200">
                        <CloseIcon className="w-6 h-6" />
                    </button>
                </div>

                <div className="space-y-4">
                    {/* Voice Output Setting */}
                    <div>
                        <label htmlFor="tts-voice" className="block text-sm font-medium text-slate-600 mb-1">
                            AI Voice
                        </label>
                        <select
                            id="tts-voice"
                            value={settings.ttsVoice}
                            onChange={(e) => onSettingsChange({ ttsVoice: e.target.value as TtsVoice })}
                            className="w-full px-3 py-2 text-slate-800 bg-slate-100 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {Object.values(TtsVoice).map(voice => (
                                <option key={voice} value={voice}>{voice}</option>
                            ))}
                        </select>
                    </div>

                    {/* Microphone Input Setting */}
                    <div>
                        <label htmlFor="mic-device" className="block text-sm font-medium text-slate-600 mb-1">
                            Microphone
                        </label>
                        <select
                            id="mic-device"
                            value={settings.microphoneDeviceId}
                            onChange={(e) => onSettingsChange({ microphoneDeviceId: e.target.value })}
                            className="w-full px-3 py-2 text-slate-800 bg-slate-100 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {availableDevices.length > 0 ? (
                                availableDevices.map(device => (
                                    <option key={device.deviceId} value={device.deviceId}>
                                        {device.label || `Microphone ${availableDevices.indexOf(device) + 1}`}
                                    </option>
                                ))
                            ) : (
                                <option value="">No microphones found</option>
                            )}
                        </select>
                    </div>
                </div>

                <div className="flex justify-end">
                    <button 
                        onClick={onClose} 
                        className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-6 rounded-lg transition-colors"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
