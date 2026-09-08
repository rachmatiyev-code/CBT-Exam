import React, { useState, useEffect } from 'react';
import { X, Key, CheckCircle, AlertCircle, RefreshCw, Sparkles, ExternalLink } from 'lucide-react';
import { apiService } from '../services/api';

interface GeminiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeySaved: (key: string) => void;
}

export const GeminiKeyModal: React.FC<GeminiKeyModalProps> = ({ isOpen, onClose, onKeySaved }) => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [hasServerKey, setHasServerKey] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setApiKey(apiService.getStoredApiKey());
      setTestResult(null);
      apiService.checkServerKeyStatus().then((res) => {
        setHasServerKey(res.hasServerKey);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestKey = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await apiService.validateKey(apiKey.trim());
      let msg = res.message || '';
      if (
        msg.toLowerCase().includes('unexpected token') ||
        msg.toLowerCase().includes('the page') ||
        msg.toLowerCase().includes('is not valid json')
      ) {
        msg = 'Layanan verifikasi Google sedang mengalami antrean jaringan sementara. Silakan coba klik Uji Koneksi kembali.';
      }
      setTestResult({
        ...res,
        message: msg,
      });
    } catch (err: any) {
      let msg = err?.message || '';
      if (
        msg.toLowerCase().includes('unexpected token') ||
        msg.toLowerCase().includes('the page') ||
        msg.toLowerCase().includes('is not valid json')
      ) {
        msg = 'Koneksi ke server AI terputus sesaat. Pastikan format Kunci API valid dan coba beberapa detik lagi.';
      }
      setTestResult({
        success: false,
        message: msg || 'Gagal menghubungi server AI Gemini. Periksa format kunci Anda.',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    const clean = apiKey.trim();
    apiService.setStoredApiKey(clean);
    onKeySaved(clean);
    onClose();
  };

  const handleClear = () => {
    setApiKey('');
    apiService.setStoredApiKey('');
    onKeySaved('');
    setTestResult(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">Pengaturan Kunci API Gemini</h2>
              <p className="text-xs text-indigo-200">Koneksi AI untuk Pembuat Soal, Skoring Esai, Remidi & Pengayaan</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {hasServerKey && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Kunci Server Bawaan Aktif:</strong> Server telah memiliki konfigurasi Gemini API Key yang siap digunakan.
                </span>
              </div>
              <span className="text-[10px] uppercase font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                Tersedia
              </span>
            </div>
          )}

          <div className="bg-indigo-50/80 border border-indigo-100 rounded-xl p-3.5 text-xs text-indigo-900 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              Kunci API digunakan untuk menghasilkan soal secara otomatis berbasis topik kurikulum, menilai uraian/isian dengan pencocokan kata kunci, dan menyusun program remidi/pengayaan siswa.
              <span className="block mt-1 font-medium text-indigo-700">
                Catatan: Masukkan kunci API Anda (tanpa tanda kutip), atau kosongkan untuk otomatis memakai kunci server bawaan.
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">
                Google Gemini API Key
              </label>
              {apiKey && (
                <span className="text-[11px] text-indigo-600 font-medium">
                  Kunci Kustom Terpasang
                </span>
              )}
            </div>
            <div className="relative">
              <input
                id="input-gemini-key"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy... (atau biarkan kosong untuk kunci server)"
                className="w-full text-xs font-mono px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 pr-20"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-800 font-medium px-2 py-1 rounded"
              >
                {showKey ? 'Sembunyikan' : 'Lihat'}
              </button>
            </div>
          </div>

          {/* Test connection result */}
          {testResult && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 animate-in fade-in duration-200 ${
                testResult.success
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              {testResult.success ? (
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="leading-relaxed font-medium">{testResult.message}</div>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-indigo-600 hover:underline flex items-center gap-1 font-medium"
            >
              <span>Dapatkan Kunci API di Google AI Studio</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            {apiKey && (
              <button
                type="button"
                onClick={handleClear}
                className="text-rose-600 hover:text-rose-700 hover:underline"
              >
                Gunakan Kunci Server
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleTestKey}
            disabled={testing}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
            <span>{testing ? 'Menguji API...' : 'Uji Koneksi'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-xl text-slate-600 hover:text-slate-800 hover:bg-slate-200 transition"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition"
            >
              Simpan Pengaturan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
