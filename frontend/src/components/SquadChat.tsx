'use client';

import { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types/squad';
import { Send, MessageSquare, X, Sparkles } from 'lucide-react';

interface SquadChatProps {
  messages: ChatMessage[];
  currentUserId: string;
  onSendMessage: (text: string, isQuickReply: boolean) => void;
  isOpen: boolean;
  onClose: () => void;
}

const QUICK_REPLIES = [
  'On my way! 🚗',
  'Almost there 🏁',
  'Stuck in traffic 🚦',
  'Quick pit stop ⛽',
  'I am here! 🎉',
  'Where is everyone? 👀',
];

export function SquadChat({
  messages,
  currentUserId,
  onSendMessage,
  isOpen,
  onClose,
}: SquadChatProps) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(20);
    }
    onSendMessage(inputText.trim(), false);
    setInputText('');
  };

  const handleQuickReply = (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(25);
    }
    onSendMessage(text, true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 sm:inset-y-0 sm:left-auto sm:right-0 w-full sm:w-96 h-[85dvh] sm:h-full glass-sheet sm:glass-panel-elevated z-40 flex flex-col shadow-2xl rounded-t-[32px] sm:rounded-none border-t sm:border-t-0 sm:border-l border-white/10 animate-in slide-in-from-bottom sm:slide-in-from-right duration-250">
      {/* Mobile drag handle */}
      <div className="sm:hidden pt-2 pb-1" onClick={onClose}>
        <div className="sheet-handle" />
      </div>

      {/* Header */}
      <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-extrabold text-white text-sm">Squad Road Chat</h2>
            <p className="text-[10px] text-gray-400">{messages.length} messages in convoy</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/10 active-press transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Message Stream */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 no-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 text-sm">
            <Sparkles className="w-8 h-8 text-indigo-400/40 mb-2" />
            <p className="font-medium text-gray-400">No messages yet.</p>
            <p className="text-xs text-gray-500 mt-1">Tap a quick reply to kick off!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isSelf = msg.senderId === currentUserId;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}
              >
                {!isSelf && (
                  <span className="text-[11px] text-gray-400 ml-1 mb-0.5 font-medium">
                    {msg.senderName}
                  </span>
                )}
                <div
                  className={`px-4 py-2.5 rounded-2xl max-w-[85%] text-sm break-words shadow-md ${
                    isSelf
                      ? 'bg-indigo-600 text-white rounded-br-sm'
                      : 'bg-gray-800/90 text-gray-100 rounded-bl-sm border border-white/10'
                  } ${msg.isQuickReply ? 'border-amber-400/40 font-medium' : ''}`}
                >
                  {msg.text}
                </div>
                <span className="text-[9px] text-gray-500 mt-0.5 px-1 font-mono">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Reply Chips */}
      <div className="px-4 py-2 border-t border-white/5 overflow-x-auto flex gap-1.5 no-scrollbar">
        {QUICK_REPLIES.map((reply) => (
          <button
            key={reply}
            onClick={() => handleQuickReply(reply)}
            className="px-3 py-1.5 text-xs whitespace-nowrap rounded-full bg-white/5 active:bg-indigo-600 active:text-white hover:bg-indigo-500/20 text-gray-300 hover:text-indigo-300 border border-white/10 transition-all shrink-0 active-press"
          >
            {reply}
          </button>
        ))}
      </div>

      {/* Input Bar */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-white/10 flex gap-2 pb-safe">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Message squad..."
          className="flex-1 bg-gray-900/90 text-white text-sm rounded-xl px-4 py-3 border border-white/10 focus:outline-none focus:border-indigo-500 transition-colors"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="px-4 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 transition-all active-press"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
