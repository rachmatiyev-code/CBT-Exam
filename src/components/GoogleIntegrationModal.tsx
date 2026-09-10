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
  HelpCircle,
  Activity,
  ChevronDown,
  ChevronUp,
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
  const [diagnosing, setDiagnosing] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    isGas404?: boolean;
    recommendations?: string[];
  } | null>(null);
  const [diagnosticReport, setDiagnosticReport] = useState<any | null>(null);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);
  const [urlNotice, setUrlNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  // Sanitasi URL otomatis saat diinput
  const handleUrlChange = (raw: string) => {
    let clean = raw.trim().replace(/^["'<]+|["'>]+$/g, '');
    let notice: string | null = null;

    if (/\/u\/\d+\//.test(clean)) {
      clean = clean.replace(/\/u\/\d+\//, '/');
      notice = 'Path multi-akun (/u/0/ atau /u/1/) telah otomatis dibersihkan.';
    }

    if (/^AKfycb[A-Za-z0-9_-]{20,}$/.test(clean)) {
      clean = `https://script.google.com/macros/s/${clean}/exec`;
      notice = 'Deployment ID otomatis dikonversi ke format URL resmi (/exec).';
    }

    if (clean.endsWith('/exec/')) {
      clean = clean.slice(0, -1);
    }

    if (clean.includes('/edit')) {
      notice = '⚠️ Peringatan: Anda memasukkan URL editor (.../edit). Harap gunakan Web App URL dari menu Deploy > New deployment yang berakhiran /exec.';
    } else if (clean.endsWith('/dev')) {
      notice = '⚠️ Peringatan: Anda memasukkan Test URL (.../dev). Harap gunakan Web App URL resmi yang berakhiran /exec.';
    }

    setUrlNotice(notice);
    setWebAppUrl(clean);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(APPS_SCRIPT_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    setDiagnosticReport(null);
    try {
      const res = await apiService.syncWithGAS('test_connection', { timestamp: new Date() }, webAppUrl.trim() || undefined);
      if (res.success) {
        setTestResult({
          success: true,
          message: res.message || 'Koneksi ke Google Apps Script dan Google Drive terverifikasi aktif!',
        });
      } else {
        setTestResult({
          success: false,
          message: res.error || 'Gagal terhubung ke Google Apps Script',
          isGas404: res.isGas404,
          recommendations: res.recommendations,
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Gagal sinkronisasi dengan Google Apps Script',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleRunDiagnostics = async () => {
    if (!webAppUrl.trim()) {
      setUrlNotice('Silakan masukkan Web App URL terlebih dahulu sebelum menjalankan diagnosa.');
      return;
    }
    setDiagnosing(true);
    setDiagnosticReport(null);
    try {
      const res = await apiService.diagnoseGAS(webAppUrl.trim());
      setDiagnosticReport(res);
      if (res.cleanUrl && res.cleanUrl !== webAppUrl) {
        setWebAppUrl(res.cleanUrl);
      }
    } catch (err: any) {
      setDiagnosticReport({
        success: false,
        probe: {
          diagnosis: 'Gagal menghubungi server diagnostik: ' + err.message,
          recommendation: ['Periksa koneksi jaringan server dan pastikan URL valid.'],
        },
      });
    } finally {
      setDiagnosing(false);
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
                Solusi sinkronisasi rekap nilai siswa & cadangan otomatis ke Google Drive
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
                Penyimpanan Otomatis Aktif (Lokal & Google Drive)
              </p>
              <p className="text-emerald-800 leading-relaxed">
                Setiap kali siswa selesai mengerjakan ujian, rekap nilai beserta detail jawaban otomatis dicatat ke Google Spreadsheet dan diarsipkan ke Google Drive. Jika Web App URL belum dipasang, sistem tetap menyimpan data secara aman di browser & server lokal.
              </p>
            </div>
          </div>

          {/* Folder Hierarchy on Google Drive */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
              <FolderTree className="w-4 h-4 text-indigo-600" />
              Struktur Penyimpanan di Google Drive Anda:
            </h3>
            <div className="font-mono text-xs bg-white p-3 rounded-lg border border-slate-200 space-y-1.5 text-slate-700">
              <div className="flex items-center gap-2 font-semibold text-indigo-700">
                <HardDrive className="w-3.5 h-3.5" />
                <span>Google Drive / 📁 {settings.driveFolderName}</span>
                <span className="text-[10px] text-emerald-600 font-sans font-medium px-1.5 py-0.2 bg-emerald-50 rounded border border-emerald-200">Root Folder</span>
              </div>
              <div className="pl-6 flex items-center gap-2 text-slate-600">
                <span>├── 📁 <strong>Riwayat Soal</strong></span>
                <span className="text-[11px] text-slate-500 font-sans">(Backup otomatis bank soal, kunci jawaban & rubrik kisi-kisi)</span>
              </div>
              <div className="pl-6 flex items-center gap-2 text-slate-600">
                <span>└── 📁 <strong>Hasil Ujian</strong></span>
                <span className="text-[11px] text-slate-500 font-sans">(Arsip JSON hasil ujian siswa per sesi & rekap spreadsheet)</span>
              </div>
            </div>
          </div>

          {/* Apps Script Code & Deployment */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  Kode Google Apps Script (Code.gs)
                </h3>
                <p className="text-slate-500 text-[11px]">
                  Dilengkapi fungsi <code>setupOtorisasi()</code> untuk aktivasi instan tanpa hambatan izin
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyCode}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 transition shadow-xs"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Tersalin ke Clipboard!' : 'Salin Seluruh Kode'}</span>
              </button>
            </div>

            <div className="relative">
              <pre className="p-3 bg-slate-900 text-slate-200 font-mono text-[11px] rounded-lg max-h-40 overflow-y-auto leading-relaxed">
                {APPS_SCRIPT_CODE.trim()}
              </pre>
            </div>

            {/* Quick Step Guide */}
            <div className="text-[11px] text-slate-700 space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <p className="font-bold text-slate-900">3 Langkah Cepat Pemasangan di Google Apps Script:</p>
              <ol className="list-decimal list-inside space-y-1 text-slate-600">
                <li>Buka Spreadsheet baru &gt; Menu <strong>Extensions (Ekstensi) &gt; Apps Script</strong> &gt; Tempel kode di atas &gt; Klik <strong>Save (Disket)</strong>.</li>
                <li>Pilih fungsi <strong>setupOtorisasi</strong> di dropdown fungsi atas, lalu klik <strong>Jalankan (Run)</strong> untuk menyelesaikan izin Google Drive.</li>
                <li>Klik tombol <strong>Deploy (Terapkan) &gt; New deployment</strong> &gt; pilih jenis <strong>Web app</strong> &gt; Setel <em>Who has access: <strong>Anyone</strong></em> &gt; Klik Deploy &gt; Salin URL berakhiran <code>/exec</code>.</li>
              </ol>
            </div>

            {/* Note on Folder in Drive vs 404 Error */}
            <div className="text-[11px] bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-3 space-y-1.5">
              <div className="font-bold flex items-center gap-1.5 text-amber-800">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                <span>Penting: Folder Sudah Muncul di Google Drive tapi Muncul Error 404?</span>
              </div>
              <p className="leading-relaxed">
                Menjalankan <strong>setupOtorisasi</strong> langsung di editor Apps Script membuktikan kode dan koneksi Google Drive Anda sudah 100% benar (sehingga folder backup berhasil dibuat).
              </p>
              <p className="leading-relaxed">
                Penyebab <strong>Error 404</strong> saat aplikasi EduCBT menghubungi Web App adalah karena URL Web App belum dipublikasikan dengan akses umum:
              </p>
              <ul className="list-disc list-inside pl-1 space-y-0.5 text-amber-800 font-medium">
                <li>Klik tombol <strong>Deploy</strong> (biru di kanan atas) &gt; <strong>New deployment</strong> (atau Manage deployments &gt; ikon Pensil).</li>
                <li>Pada opsi <strong>Who has access</strong>, WAJIB pilih <strong>"Anyone" (Siapa saja)</strong>. Jika memilih 'Only myself', Google menolak permintaan eksternal dengan status 404.</li>
                <li>Jika mengedit deployment lama, pada dropdown <strong>Version</strong> wajib pilih <strong>"New version"</strong>.</li>
                <li>Jika akun Anda adalah akun sekolah/Belajar.id yang dibatasi admin, buat spreadsheet di akun Gmail pribadi (@gmail.com).</li>
                <li>Salin Web App URL yang berakhiran <code>/exec</code> (bukan <code>/edit</code> atau <code>/dev</code>).</li>
              </ul>
            </div>
          </div>

          {/* Web App URL Config */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block font-semibold text-slate-700">
                Google Apps Script Web App URL (Berakhiran /exec)
              </label>
              {webAppUrl && (
                <a
                  href={webAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-700 hover:text-emerald-800 font-semibold text-[11px] flex items-center gap-1"
                  title="Buka Web App di tab baru untuk melihat respons langsung dari Google"
                >
                  <span>Buka di Tab Baru (Tes Browser)</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            <div className="flex gap-2">
              <input
                id="input-gas-url"
                type="url"
                value={webAppUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                className="flex-1 text-xs font-mono px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing || diagnosing}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
                <span>{testing ? 'Menguji...' : 'Uji Webhook'}</span>
              </button>
              <button
                type="button"
                onClick={handleRunDiagnostics}
                disabled={testing || diagnosing}
                className="px-3 py-2 text-xs font-semibold rounded-xl bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 flex items-center gap-1.5 transition disabled:opacity-50"
                title="Jalankan diagnosa lengkap untuk mendeteksi akar penyebab 404"
              >
                <Activity className={`w-3.5 h-3.5 ${diagnosing ? 'animate-spin' : ''}`} />
                <span>{diagnosing ? 'Diagnosa...' : 'Diagnosa 404'}</span>
              </button>
            </div>

            {urlNotice && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{urlNotice}</span>
              </div>
            )}

            {/* Test Result Box */}
            {testResult && (
              <div
                className={`p-3.5 rounded-xl border text-xs flex flex-col gap-2 leading-relaxed whitespace-pre-line ${
                  testResult.success
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                    : 'bg-rose-50 text-rose-900 border-rose-200'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {testResult.success ? (
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <span className="font-medium">{testResult.message}</span>
                </div>
                {testResult.recommendations && testResult.recommendations.length > 0 && (
                  <div className="mt-1 pl-6 space-y-1 text-rose-800 text-[11px]">
                    <p className="font-semibold text-rose-900">Langkah Perbaikan yang Disarankan:</p>
                    {testResult.recommendations.map((rec, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <span className="font-bold">•</span>
                        <span>{rec}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Comprehensive Diagnostic Report Card */}
            {diagnosticReport && (
              <div className="p-4 rounded-xl border bg-slate-50 border-slate-200 space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-indigo-600" />
                    Hasil Diagnosa Mendalam Endpoint:
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                      diagnosticReport.success
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-rose-100 text-rose-800 border border-rose-300'
                    }`}
                  >
                    {diagnosticReport.success ? 'KONEKSI SEMPURNA' : 'PERLU PERBAIKAN'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                    <span className="text-slate-500 block">Probe GET Status:</span>
                    <span className="font-mono font-bold text-slate-800">
                      HTTP {diagnosticReport.probe?.getStatus || 'Tidak ada respon'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                    <span className="text-slate-500 block">Probe POST Status:</span>
                    <span className="font-mono font-bold text-slate-800">
                      HTTP {diagnosticReport.probe?.postStatus || 'Tidak ada respon'}
                    </span>
                  </div>
                </div>

                {diagnosticReport.probe?.diagnosis && (
                  <div className="p-2.5 bg-indigo-50/70 rounded-lg border border-indigo-200 text-indigo-900 text-[11px]">
                    <span className="font-bold block mb-1">Analisis Sistem:</span>
                    <p>{diagnosticReport.probe.diagnosis}</p>
                  </div>
                )}

                {diagnosticReport.probe?.recommendation && (
                  <div className="space-y-1 text-slate-700 text-[11px] bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="font-bold text-slate-800 block">Solusi Praktis:</span>
                    <ol className="list-decimal list-inside space-y-1">
                      {diagnosticReport.probe.recommendation.map((rec: string, idx: number) => (
                        <li key={idx} className="leading-relaxed">{rec}</li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Troubleshooting Accordion for Error 404 */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowTroubleshooting(!showTroubleshooting)}
              className="w-full px-4 py-3 bg-amber-50/70 hover:bg-amber-100/70 text-amber-950 font-bold flex items-center justify-between text-left transition"
            >
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-amber-700" />
                <span>Kenapa Terjadi Error 404 Padahal Langkah Sudah Benar? (Buka Solusi)</span>
              </div>
              {showTroubleshooting ? (
                <ChevronUp className="w-4 h-4 text-amber-700" />
              ) : (
                <ChevronDown className="w-4 h-4 text-amber-700" />
              )}
            </button>

            {showTroubleshooting && (
              <div className="p-4 bg-white space-y-3.5 text-[11px] text-slate-700 border-t border-slate-200 leading-relaxed">
                <div className="space-y-1">
                  <h4 className="font-bold text-rose-800">1. Akun Google Workspace / Belajar.id Membatasi Akses "Anyone":</h4>
                  <p>
                    Banyak akun dinas (seperti <code>@guru.smp.belajar.id</code> atau domain sekolah) secara otomatis <strong>memblokir akses publik ke luar domain</strong>. Opsi "Anyone" pada akun dinas sering kali hanya berlaku untuk akun dalam sekolah yang sama.
                  </p>
                  <p className="font-semibold text-emerald-800">
                    💡 Solusi Ampuh: Buat Spreadsheet dan Google Apps Script ini menggunakan <strong>akun Gmail pribadi (@gmail.com)</strong>. Akun pribadi bebas dari pembatasan kebijakan admin sekolah dan 100% mendukung opsi "Anyone".
                  </p>
                </div>

                <div className="space-y-1">
                  <h4 className="font-bold text-indigo-800">2. Menekan Save Tidak Mengupdate Web App yang Sudah Dideploy:</h4>
                  <p>
                    Di Google Apps Script, tombol <strong>Save (Disket)</strong> hanya menyimpan draft di editor. Web App yang sudah aktif tidak akan berubah sampai Anda memperbarui versinya.
                  </p>
                  <p className="font-semibold text-slate-800">
                    💡 Cara Memperbarui: Buka Apps Script &gt; Klik <strong>Deploy</strong> &gt; <strong>Manage deployments</strong> &gt; Klik ikon <strong>Pensil (Edit)</strong> &gt; Pada Version pilih <strong>"New version" (Versi Baru)</strong> &gt; Klik <strong>Deploy</strong>.
                  </p>
                </div>

                <div className="space-y-1">
                  <h4 className="font-bold text-slate-800">3. Izin Akses Google Drive Belum Selesai (setupOtorisasi):</h4>
                  <p>
                    Jika skrip belum pernah dijalankan di editor, Google belum memberikan izin akses DriveApp.
                  </p>
                  <p className="font-semibold text-slate-800">
                    💡 Solusi: Di toolbar atas Apps Script, pilih fungsi <code>setupOtorisasi</code> lalu klik tombol <strong>Jalankan (Run)</strong> satu kali.
                  </p>
                </div>

                <div className="space-y-1">
                  <h4 className="font-bold text-emerald-800">4. Path Multi-Akun (/u/0/ atau /u/1/):</h4>
                  <p>
                    Jika di peramban Anda login lebih dari satu akun Google, URL Apps Script sering otomatis disisipi <code>/u/0/</code> yang menyebabkan 404 pada sistem luar. Aplikasi EduCBT ini sudah <strong>secara otomatis membersihkan</strong> bagian tersebut saat Anda menempelkan URL!
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Auto backup switch */}
          <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <span className="font-semibold text-slate-800 block">Backup Otomatis Setiap Siswa Selesai Ujian</span>
              <span className="text-slate-500 text-[11px]">
                Otomatis mengarsipkan skor, detail isian, dan status KKM ke Google Drive & Sheets
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

          {/* Quick Manual Export Actions */}
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

