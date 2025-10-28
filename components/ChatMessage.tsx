
import React from 'react';
import { Author, ContentType, Message } from '../types';
import { AiIcon, UserIcon, DownloadIcon, SpeakerIcon, GlobeIcon, MapPinIcon } from './Icons';

interface ChatMessageProps {
  message: Message;
  onPlayAudio: (text: string) => void;
}

const LoadingIndicator: React.FC = () => (
  <div className="flex items-center space-x-2">
    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" style={{ animationDelay: '200ms' }}></div>
    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" style={{ animationDelay: '400ms' }}></div>
  </div>
);

const MessageContentRenderer: React.FC<{ content: Message['content'][0] }> = ({ content }) => {
  switch (content.type) {
    case ContentType.IMAGE:
      return <img src={content.url} alt={content.alt} className="mt-2 rounded-lg max-w-sm" />;
    case ContentType.VIDEO:
      return <video src={content.url} controls className="mt-2 rounded-lg max-w-sm" />;
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

const ChatMessage: React.FC<ChatMessageProps> = ({ message, onPlayAudio }) => {
  const isUser = message.author === Author.USER;
  
  const textContentForActions = message.content
    .filter(c => c.type === ContentType.MARKDOWN || c.type === ContentType.TEXT)
    .map(c => (c as {text: string}).text)
    .join('\n');

  const handleDownload = () => {
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
                    <button onClick={handleDownload} title="Download text" className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition-colors shadow-sm border border-slate-200">
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