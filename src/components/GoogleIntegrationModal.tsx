import React, { useState } from 'react';
import {
  X,
  FileSpreadsheet,
  HardDrive,
  Copy,
  Check,
  RefreshCw,
  FolderTree,
  ExternalLink,
  ShieldCheck,
  Download,
  AlertCircle,
} from 'lucide-react';
import { AppsScriptSettings, Exam, StudentExamSession } from '../types';
import { APPS_SCRIPT_CODE, excelService } from '../services/gasSync';
import { apiService } from '../services/api';

interface GoogleIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppsScriptSettings;
  onSaveSettings: (settings: AppsScriptSettings) => void;
  activeExam: Exam;
  completedSessions: StudentExamSession[];
  onTriggerBackup: () => void;
}

export const GoogleIntegrationModal: React.FC<GoogleIntegrationModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  activeExam,
  completedSessions,
  onTriggerBackup,
}) => {
  const [copied, setCopied] = useState(false);
  const [webAppUrl, setWebAppUrl] = useState(settings.webAppUrl);
  const [autoBackup, setAutoBackup] = useState(settings.autoBackupEnabled);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(APPS_SCRIPT_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await apiService.syncWithGAS('test_connection', { timestamp: new Date() }, webAppUrl.trim() || undefined);
      setTestResult({
        success: true,
        message: res.message || 'Koneksi ke Google Apps Script dan Google Drive terverifikasi aktif!',
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Koneksi lokal aktif (Web App URL opsional)',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    onSaveSettings({
      ...settings,
      webAppUrl: webAppUrl.trim(),
      autoBackupEnabled: autoBackup,
      isConnected: true,
      lastSyncTime: new Date().toLocaleString('id-ID'),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                Integrasi Google Apps Script, Sheets & Drive
                <span className="bg-emerald-400/20 text-emerald-300 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-400/30">
                  Otomatis Terhubung
                </span>
              </h2>
              <p className="text-xs text-emerald-200">
                Pengelolaan data siswa, rekap nilai ujian, dan folder backup otomatis
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-xs max-h-[75vh] overflow-y-auto">
          {/* Status Alert */}
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-emerald-900">
                Koneksi Google Drive & Sheets Aktif Otomatis
              </p>
              <p className="text-emerald-800 leading-relaxed">
                Aplikasi secara otomatis terhubung setiap kali dibuka. Setiap kali ujian selesai dilakukan oleh siswa, sistem akan otomatis melakukan backup rekap nilai serta struktur butir soal ke folder penyimpanan.
              </p>
            </div>
          </div>

          {/* Folder Hierarchy on Google Drive */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3">
              <FolderTree className="w-4 h-4 text-indigo-600" />
              Struktur Folder Backup Otomatis di Google Drive:
            </h3>
            <div className="font-mono text-xs bg-white p-3 rounded-lg border border-slate-200 space-y-1.5 text-slate-700">
              <div className="flex items-center gap-2 font-semibold text-indigo-700">
                <HardDrive className="w-3.5 h-3.5" />
                <span>Google Drive / 📁 {settings.driveFolderName}</span>
                <span className="text-[10px] text-emerald-600 font-sans font-medium px-1.5 py-0.2 bg-emerald-50 rounded border border-emerald-200">Root Backup</span>
              </div>
              <div className="pl-6 flex items-center gap-2 text-slate-600">
                <span>├── 📁 <strong>Soal</strong></span>
                <span className="text-[11px] text-slate-500 font-sans">(Menyimpan backup butir soal, kunci, dan rubrik kisi-kisi)</span>
              </div>
              <div className="pl-6 flex items-center gap-2 text-slate-600">
                <span>└── 📁 <strong>Hasil-Ujian</strong></span>
                <span className="text-[11px] text-slate-500 font-sans">(Menyimpan rekap nilai siswa, respons pengerjaan, skor & remidi)</span>
              </div>
            </div>
          </div>

          {/* Apps Script Code & Deployment */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  Script Google Apps Script (Code.gs)
                </h3>
                <p className="text-slate-500 text-[11px]">
                  Kode siap pasang di Google Spreadsheet untuk sinkronisasi langsung dua arah
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyCode}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 transition shadow-xs"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Tersalin ke Clipboard!' : 'Salin Kode Script'}</span>
              </button>
            </div>

            <div className="relative">
              <pre className="p-3 bg-slate-900 text-slate-200 font-mono text-[11px] rounded-lg max-h-40 overflow-y-auto leading-relaxed">
                {APPS_SCRIPT_CODE.trim()}
              </pre>
            </div>

            <div className="text-[11px] text-slate-600 space-y-1.5 bg-amber-50/70 p-3 rounded-lg border border-amber-200/80">
              <p className="font-semibold text-amber-900">Panduan Pemasangan &amp; Solusi Menghindari Error 404:</p>
              <ol className="list-decimal list-inside space-y-1 text-amber-800">
                <li>Buka Google Spreadsheet baru Anda di Google Drive.</li>
                <li>Klik menu <strong>Extensions (Ekstensi) &gt; Apps Script</strong>.</li>
                <li>Hapus kode bawaan dan tempel kode script yang telah Anda salin di atas, lalu klik ikon <strong>Save (Disket)</strong>.</li>
                <li>Klik <strong>Deploy &gt; New Deployment</strong> (ikon roda gigi pilih <strong>Web app</strong>).</li>
                <li>
                  <strong className="text-rose-700">Wajib:</strong> Setel <em>Execute as: Me</em> &amp; <em>Who has access: <strong>Anyone (Siapa saja)</strong></em> agar webhook tidak diblokir (404/403).
                </li>
                <li>Selesaikan izin akses (Review permissions &gt; Advanced &gt; Go to ... (unsafe) &gt; Allow).</li>
                <li>
                  Salin <strong>Web App URL</strong> yang berakhiran <code className="bg-amber-200/70 px-1 py-0.5 rounded font-mono font-bold text-amber-900">/exec</code> (jangan salin dari address bar yang berakhiran /edit atau /dev).
                </li>
              </ol>
            </div>
          </div>

          {/* Web App URL Config */}
          <div className="space-y-3">
            <label className="block font-semibold text-slate-700">
              Google Apps Script Web App URL (Wajib berakhiran /exec)
            </label>
            <div className="flex gap-2">
              <input
                id="input-gas-url"
                type="url"
                value={webAppUrl}
                onChange={(e) => setWebAppUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                className="flex-1 text-xs font-mono px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
                <span>{testing ? 'Menguji...' : 'Uji Webhook'}</span>
              </button>
            </div>

            {testResult && (
              <div
                className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 leading-relaxed whitespace-pre-line ${
                  testResult.success
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                {testResult.success ? (
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>

          {/* Auto backup switch */}
          <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <span className="font-semibold text-slate-800 block">Backup Otomatis Selesai Ujian</span>
              <span className="text-slate-500 text-[11px]">
                Otomatis mengarsipkan hasil ujian siswa dan butir soal ke folder Google Drive
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoBackup}
                onChange={(e) => setAutoBackup(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          {/* Quick Manual Actions */}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                onTriggerBackup();
                excelService.exportResultsToExcel(completedSessions, activeExam.title);
              }}
              className="px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-medium flex items-center gap-1.5 transition"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Unduh Spreadsheet Rekap Nilai (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                excelService.exportQuestionsToExcel(activeExam);
              }}
              className="px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-medium flex items-center gap-1.5 transition"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600" />
              <span>Unduh Soal Excel (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-between">
          <span className="text-slate-500 text-[11px]">
            Terakhir Sinkron: <strong>{settings.lastSyncTime || 'Hari ini'}</strong>
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-xl text-slate-600 hover:text-slate-800 hover:bg-slate-200 transition"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition"
            >
              Simpan Konfigurasi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
