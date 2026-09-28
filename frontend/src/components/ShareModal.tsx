'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, X, QrCode, Share2 } from 'lucide-react';

interface ShareModalProps {
  sessionCode: string;
  tripName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ShareModal({ sessionCode, tripName, isOpen, onClose }: ShareModalProps) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen) return null;

  const joinUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/join/${sessionCode}`
    : `https://squadmap.app/join/${sessionCode}`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(sessionCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="glass-panel-elevated rounded-2xl w-full max-w-sm p-6 relative border border-white/10 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-5">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-2 border border-indigo-500/30">
            <Share2 className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-white">Invite Your Squad</h2>
          <p className="text-xs text-gray-400 mt-0.5 truncate">{tripName}</p>
        </div>

        {/* QR Code Container */}
        <div className="bg-white p-4 rounded-2xl mx-auto w-fit shadow-xl mb-5 flex items-center justify-center">
          <QRCodeSVG value={joinUrl} size={180} level="M" />
        </div>

        {/* 6-character room code */}
        <div className="mb-4">
          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
            Trip Code
          </label>
          <div className="flex items-center justify-between p-3 rounded-xl bg-gray-900/90 border border-white/10">
            <span className="font-mono text-xl font-extrabold tracking-widest text-indigo-400">
              {sessionCode}
            </span>
            <button
              onClick={handleCopyCode}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Direct Link */}
        <div>
          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
            Shareable Link
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={joinUrl}
              className="flex-1 bg-gray-900/90 text-gray-300 text-xs rounded-xl px-3 py-2.5 border border-white/10 truncate font-mono"
            />
            <button
              onClick={handleCopyLink}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-colors shrink-0"
              title="Copy URL"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
