import React, { useState } from 'react';
import {
  KeyRound,
  Dices,
  Copy,
  Check,
  X,
  Sparkles,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { Exam } from '../types';

interface TokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: Exam;
  onUpdateToken: (newToken: string) => void;
}

// Generates a clean, readable random token (omits confusing characters like 0/O, 1/I)
export function generateRandomToken(prefix?: string, length = 5): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  if (prefix && prefix.trim()) {
    const cleanPrefix = prefix.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
    let rand = '';
    const remaining = Math.max(2, length - cleanPrefix.length);
    for (let i = 0; i < remaining; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${cleanPrefix}${rand}`;
  }

  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export const TokenModal: React.FC<TokenModalProps> = ({
  isOpen,
  onClose,
  exam,
  onUpdateToken,
}) => {
  const [tokenInput, setTokenInput] = useState(exam.token || 'EXAM26');
  const [copied, setCopied] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRandomize = (customPrefix?: string, len = 5) => {
    const random = generateRandomToken(customPrefix, len);
    setTokenInput(random);
    setNotification(`Token baru dibuat: ${random}`);
    setTimeout(() => setNotification(null), 2500);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = tokenInput.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!clean) {
      alert('Token tidak boleh kosong.');
      return;
    }
    onUpdateToken(clean);
    onClose();
  };

  const subjectPrefix = exam.subject
    ? exam.subject.trim().slice(0, 3).toUpperCase()
    : 'CBT';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-amber-300">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">Buat &amp; Atur Token Ujian</h3>
              <p className="text-xs text-indigo-200">
                Kelola token akses siswa untuk naskah soal
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-indigo-200 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-5">
          {/* Active Token Display */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Token Ujian Saat Ini
              </span>
              <span className="text-xl font-mono font-black text-indigo-700 tracking-wider">
                {exam.token || 'BELUM DIATUR'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(exam.token)}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Salin Token</span>
                </>
              )}
            </button>
          </div>

          {/* Form Input New Token */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">
              Ketik Token Baru atau Buat Acak
            </label>
            <div className="relative">
              <input
                type="text"
                value={tokenInput}
                onChange={(e) =>
                  setTokenInput(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))
                }
                placeholder="Misal: PAS26, IPA9, dll"
                maxLength={12}
                className="w-full text-lg font-mono font-bold tracking-widest uppercase px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-900 pr-12"
              />
              <button
                type="button"
                onClick={() => handleRandomize('', 5)}
                title="Acak token sekarang"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Siswa wajib memasukkan token ini pada layar login untuk mulai mengerjakan soal.
            </p>
          </div>

          {/* Generator Preset Buttons */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Dices className="w-4 h-4 text-purple-600" />
              Pilihan Acak Token Otomatis:
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleRandomize('', 5)}
                className="p-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-800 text-xs font-semibold flex flex-col items-center justify-center transition"
              >
                <Sparkles className="w-4 h-4 text-purple-600 mb-0.5" />
                <span>Acak 5 Digit</span>
                <span className="text-[10px] text-purple-600/80 font-normal font-mono">
                  (Huruf + Angka)
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleRandomize(subjectPrefix, 5)}
                className="p-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 text-xs font-semibold flex flex-col items-center justify-center transition"
              >
                <KeyRound className="w-4 h-4 text-blue-600 mb-0.5" />
                <span>Awalan Mapel</span>
                <span className="text-[10px] text-blue-600/80 font-normal font-mono">
                  ({subjectPrefix}...)
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleRandomize('', 6)}
                className="p-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-semibold flex flex-col items-center justify-center transition"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-600 mb-0.5" />
                <span>Acak 6 Digit</span>
                <span className="text-[10px] text-emerald-600/80 font-normal font-mono">
                  (Super Unik)
                </span>
              </button>
            </div>
          </div>

          {notification && (
            <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-800 text-xs flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
              <span>{notification}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm flex items-center gap-2 transition"
            >
              <Check className="w-4 h-4" />
              <span>Terapkan &amp; Simpan Token</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
