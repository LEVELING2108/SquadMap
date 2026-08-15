"use client";

import { QRCodeSVG } from "qrcode.react";
import { X, Copy, Check, QrCode } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface QrShareModalProps {
  code: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function QrShareModal({ code, isOpen, onClose }: QrShareModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const roomUrl = typeof window !== "undefined"
    ? `${window.location.origin}/room/${code}`
    : `https://squadmap.app/room/${code}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(roomUrl);
    setCopied(true);
    toast.success("Trip room link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 max-w-sm w-full rounded-3xl p-6 shadow-2xl space-y-5 text-center relative animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center mx-auto shadow-xs">
          <QrCode className="w-6 h-6" />
        </div>

        <div>
          <h3 className="text-lg font-bold text-slate-900">Scan to Join Trip</h3>
          <p className="text-xs text-slate-500 mt-1">Point your phone camera to open SquadMap room</p>
        </div>

        {/* QR Code Canvas */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl inline-block mx-auto shadow-inner">
          <QRCodeSVG
            value={roomUrl}
            size={180}
            bgColor="#F8FAFC"
            fgColor="#0F172A"
            level="M"
          />
        </div>

        {/* Room Code Display */}
        <div className="bg-emerald-50 border border-emerald-200 px-4 py-2.5 rounded-xl">
          <span className="text-xs text-emerald-800 font-semibold uppercase tracking-wider block">Room Code</span>
          <span className="text-xl font-extrabold text-emerald-950 tracking-widest">{code}</span>
        </div>

        {/* Actions */}
        <button
          onClick={handleCopyLink}
          className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs py-3 rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          <span>{copied ? "Link Copied!" : "Copy Trip Room Link"}</span>
        </button>
      </div>
    </div>
  );
}
