import React, { useState } from 'react';
import { AlertCircle, Copy, Check, X, RefreshCw } from 'lucide-react';
import { copyToClipboard } from '../utils/clipboard';

interface CopyableErrorAlertProps {
  error: string | Error | null | undefined;
  title?: string;
  onClose?: () => void;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}

export const CopyableErrorAlert: React.FC<CopyableErrorAlertProps> = ({
  error,
  title,
  onClose,
  onRetry,
  className = '',
  compact = false,
}) => {
  const [copied, setCopied] = useState(false);

  if (!error) return null;

  const errorMessage = typeof error === 'string' ? error : error.message || 'Terjadi kesalahan sistem yang tidak diketahui.';
  const displayTitle = title || (errorMessage.toLowerCase().includes('404') ? 'Layanan Tidak Ditemukan (404)' : 'Terjadi Kesalahan');

  const handleCopy = async () => {
    const success = await copyToClipboard(errorMessage);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const is404 = errorMessage.toLowerCase().includes('404');
  const isBackendActiveHint = errorMessage.toLowerCase().includes('backend aktif') || errorMessage.toLowerCase().includes('endpoint');

  if (compact) {
    return (
      <div
        className={`p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5 shadow-xs transition-all ${className}`}
      >
        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="font-semibold text-rose-900 flex items-center justify-between gap-2">
            <span>{displayTitle}</span>
            <button
              type="button"
              onClick={handleCopy}
              className={`px-2 py-0.5 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-rose-100 hover:bg-rose-200 text-rose-800'
              }`}
              title="Salin pesan error ke clipboard"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-white" />
                  <span>Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3 text-rose-700" />
                  <span>Salin Error</span>
                </>
              )}
            </button>
          </div>
          <p className="select-text font-mono text-[11px] text-rose-700 break-words leading-relaxed bg-white/70 p-2 rounded border border-rose-200/60">
            {errorMessage}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-rose-400 hover:text-rose-600 p-0.5 rounded"
            title="Tutup notifikasi"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`p-4 bg-rose-50/90 border border-rose-200 rounded-xl text-xs text-rose-900 shadow-xs space-y-3 transition-all ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
            <AlertCircle className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-rose-900 text-sm tracking-tight">{displayTitle}</h4>
            <span className="text-[11px] text-rose-600 font-medium">
              Pesan error di bawah dapat dicopy langsung dengan tombol salin
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs ${
              copied
                ? 'bg-emerald-600 text-white'
                : 'bg-white hover:bg-rose-100 text-rose-800 border border-rose-300'
            }`}
            title="Salin pesan error untuk pelaporan/analisis"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-white" />
                <span>Error Tersalin!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-rose-700" />
                <span>Salin Pesan Error</span>
              </>
            )}
          </button>

          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 transition-colors shadow-xs"
              title="Coba kembali permintaan ini"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Coba Lagi</span>
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-rose-400 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-100 transition-colors"
              title="Tutup pesan ini"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Copyable Error Text Box */}
      <div className="relative group">
        <div className="p-3 bg-white rounded-lg border border-rose-200 select-text font-mono text-[11px] text-rose-800 break-words leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap">
          {errorMessage}
        </div>
      </div>

      {/* Contextual Troubleshooting Hint */}
      {(is404 || isBackendActiveHint) && (
        <div className="text-[11px] bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-amber-900 space-y-1">
          <span className="font-bold flex items-center gap-1 text-amber-800">
            💡 Tips Diagnosis Error 404 / Backend:
          </span>
          <p className="leading-relaxed">
            1. Jika menggunakan Google Apps Script: pastikan Web App sudah di-deploy dengan opsi <strong>"Who has access: Anyone"</strong> dan URL berakhiran <code>/exec</code>.
          </p>
          <p className="leading-relaxed">
            2. Jika terjadi saat pengujian sistem: server EduCBT menyediakan Kunci Server Gemini otomatis yang siap digunakan.
          </p>
        </div>
      )}
    </div>
  );
};
