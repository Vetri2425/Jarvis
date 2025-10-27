
import React from 'react';
import { ChatSession } from '../types';
import { PlusIcon, TrashIcon, AiIcon } from './Icons';

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  isOpen: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  isOpen
}) => {
  return (
    <div
      className={`bg-white border-r border-slate-200 flex flex-col h-full transition-all duration-300 ease-in-out ${
        isOpen ? 'w-64' : 'w-0'
      } overflow-hidden flex-shrink-0`}
    >
      <div className="flex-shrink-0 p-4 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
           <div className="p-1.5 bg-gradient-to-br from-blue-400 to-sky-500 rounded-lg">
             <AiIcon className="w-6 h-6 text-white" />
           </div>
           <h2 className="text-lg font-semibold text-slate-700">Chat History</h2>
        </div>
      </div>

      <div className="flex-grow p-2 overflow-y-auto">
        <nav className="flex flex-col gap-1">
          {sessions.map((session) => (
            <div key={session.id} className="group relative">
              <button
                onClick={() => onSelectSession(session.id)}
                className={`w-full text-left px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center ${
                  activeSessionId === session.id
                    ? 'bg-blue-100 text-blue-800'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span className="truncate flex-1">{session.title}</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteSession(session.id);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600 transition-opacity"
                title="Delete chat"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          ))}
        </nav>
      </div>

      <div className="flex-shrink-0 p-2 border-t border-slate-200">
        <button
          onClick={onNewSession}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors"
        >
          <PlusIcon className="w-5 h-5" />
          New Chat
        </button>
      </div>
    </div>
  );
};

export default Sidebar;