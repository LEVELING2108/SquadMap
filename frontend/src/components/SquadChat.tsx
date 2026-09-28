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
  'Where are you? 👀',
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
    onSendMessage(inputText.trim(), false);
    setInputText('');
  };

  const handleQuickReply = (text: string) => {
    onSendMessage(text, true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-96 glass-panel-elevated z-40 flex flex-col shadow-2xl border-l border-white/10 animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-indigo-400" />
          <h2 className="font-bold text-white text-base">Squad Road Chat</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Message Stream */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 text-sm">
            <Sparkles className="w-8 h-8 text-indigo-400/40 mb-2" />
            <p>No messages yet.</p>
            <p className="text-xs text-gray-600 mt-1">Tap a quick reply to kick off!</p>
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
                  className={`px-3.5 py-2 rounded-2xl max-w-[85%] text-sm break-words shadow-md ${
                    isSelf
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-gray-800/90 text-gray-100 rounded-tl-none border border-white/10'
                  } ${msg.isQuickReply ? 'border-amber-400/40 font-medium' : ''}`}
                >
                  {msg.text}
                </div>
                <span className="text-[9px] text-gray-500 mt-0.5 px-1">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Reply Chips */}
      <div className="px-4 py-2 border-t border-white/5 overflow-x-auto flex gap-1.5 scrollbar-none">
        {QUICK_REPLIES.map((reply) => (
          <button
            key={reply}
            onClick={() => handleQuickReply(reply)}
            className="px-2.5 py-1 text-xs whitespace-nowrap rounded-full bg-white/5 hover:bg-indigo-500/20 text-gray-300 hover:text-indigo-300 border border-white/10 hover:border-indigo-500/40 transition-all shrink-0"
          >
            {reply}
          </button>
        ))}
      </div>

      {/* Input bar */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-white/10 flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Message squad..."
          className="flex-1 bg-gray-900/90 text-white text-sm rounded-xl px-3.5 py-2.5 border border-white/10 focus:outline-none focus:border-indigo-500 transition-colors"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="p-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 transition-all"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
