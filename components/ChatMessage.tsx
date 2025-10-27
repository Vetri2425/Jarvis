import React from 'react';
import { Author, ContentType, Message } from '../types';
import { AiIcon, UserIcon, DownloadIcon, SpeakerIcon, GlobeIcon, MapPinIcon, AudioDownloadIcon } from './Icons';

interface ChatMessageProps {
  message: Message;
  onPlayAudio: (text: string) => void;
  onDownloadAudio: (text: string) => void;
}

const LoadingIndicator: React.FC = () => (
  <div className="flex items-center space-x-2">
    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" style={{ animationDelay: '200ms' }}></div>
    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" style={{ animationDelay: '400ms' }}></div>
  </div>
);

const handleMediaDownload = async (url: string, filename: string) => {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objectUrl);
    } catch (error) {
        console.error('Download failed:', error);
        alert('Failed to download the file.');
    }
};

const MessageContentRenderer: React.FC<{ content: Message['content'][0] }> = ({ content }) => {
  switch (content.type) {
    case ContentType.IMAGE:
      return (
        <div className="relative mt-2 group">
          <img src={content.url} alt={content.alt} className="rounded-lg max-w-sm" />
          <button 
            onClick={() => handleMediaDownload(content.url, 'jarvis-image.jpg')}
            title="Download Image"
            className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/75 text-white rounded-full transition-opacity opacity-0 group-hover:opacity-100"
          >
            <DownloadIcon className="w-4 h-4" />
          </button>
        </div>
      );
    case ContentType.VIDEO:
      return (
        <div className="relative mt-2 group">
            <video src={content.url} controls className="rounded-lg max-w-sm" />
             <button 
                onClick={() => handleMediaDownload(content.url, 'jarvis-video.mp4')}
                title="Download Video"
                className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/75 text-white rounded-full transition-opacity opacity-0 group-hover:opacity-100"
            >
                <DownloadIcon className="w-4 h-4" />
            </button>
        </div>
      );
    case ContentType.GROUNDING:
        return (
            <div className="mt-3 pt-3 border-t border-slate-200">
                <h4 className="text-xs font-semibold text-slate-500 mb-2">Sources:</h4>
                <div className="flex flex-wrap gap-2">
                    {content.sources.map((source, i) => (
                        <a 
                            key={i} 
                            href={source.uri} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-xs bg-slate-100 hover:bg-slate-200 text-blue-600 px-2 py-1 rounded-md transition-colors flex items-center gap-1.5"
                        >
                            {source.uri.includes('google.com/maps') ? <MapPinIcon className="w-3 h-3 flex-shrink-0" /> : <GlobeIcon className="w-3 h-3 flex-shrink-0" />}
                            <span className="truncate">{source.title}</span>
                        </a>
                    ))}
                </div>
            </div>
        )
    case ContentType.MARKDOWN:
    case ContentType.TEXT:
        return <p className="whitespace-pre-wrap">{content.text}</p>;
    default:
      return null;
  }
};

const ChatMessage: React.FC<ChatMessageProps> = ({ message, onPlayAudio, onDownloadAudio }) => {
  const isUser = message.author === Author.USER;
  
  const textContentForActions = message.content
    .filter(c => c.type === ContentType.MARKDOWN || c.type === ContentType.TEXT)
    .map(c => (c as {text: string}).text)
    .join('\n');

  const handleDownloadText = () => {
    if (!textContentForActions) return;
    const blob = new Blob([textContentForActions], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'jarvis-response.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`flex items-start gap-3 my-6 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && (
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-sky-500 flex items-center justify-center shadow">
          <AiIcon className="w-6 h-6 text-white" />
        </div>
      )}
      <div className={`flex flex-col max-w-2xl ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`relative px-4 py-3 rounded-2xl shadow-sm ${isUser ? 'bg-blue-500 text-white rounded-br-none' : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'}`}>
          {message.isLoading ? (
            <LoadingIndicator />
          ) : (
            <>
              {message.content.map((contentPart, index) => (
                <MessageContentRenderer key={index} content={contentPart} />
              ))}
              {!isUser && textContentForActions && (
                 <div className="absolute -bottom-2 -right-2 flex gap-1">
                    <button onClick={() => onPlayAudio(textContentForActions)} title="Read aloud" className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition-colors shadow-sm border border-slate-200">
                       <SpeakerIcon className="w-4 h-4" />
                    </button>
                    <button onClick={() => onDownloadAudio(textContentForActions)} title="Download audio" className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition-colors shadow-sm border border-slate-200">
                       <AudioDownloadIcon className="w-4 h-4" />
                    </button>
                    <button onClick={handleDownloadText} title="Download text" className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition-colors shadow-sm border border-slate-200">
                       <DownloadIcon className="w-4 h-4" />
                    </button>
                 </div>
              )}
            </>
          )}
        </div>
      </div>
      {isUser && (
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center shadow">
          <UserIcon className="w-6 h-6 text-slate-500" />
        </div>
      )}
    </div>
  );
};

export default ChatMessage;