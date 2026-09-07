import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  ExternalLink,
  Share2,
  QrCode,
  Sparkles,
  MessageSquare,
  ShieldCheck,
  Lock,
  Smartphone,
} from 'lucide-react';
import { Exam, SchoolProfile } from '../types';

interface ShareStudentLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: Exam;
  schoolProfile: SchoolProfile;
}

export const ShareStudentLinkModal: React.FC<ShareStudentLinkModalProps> = ({
  isOpen,
  onClose,
  exam,
  schoolProfile,
}) => {
  const [includeToken, setIncludeToken] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedWA, setCopiedWA] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);

  if (!isOpen) return null;

  const origin = window.location.origin;
  const pathname = window.location.pathname;
  const baseUrl = `${origin}${pathname}?mode=siswa`;
  const shareUrl = includeToken && exam.token ? `${baseUrl}&token=${encodeURIComponent(exam.token)}` : baseUrl;

  // Formatted WhatsApp message
  const waAnnouncement = `📢 *PENGUMUMAN UJIAN CBT ONLINE*
━━━━━━━━━━━━━━━━━━━
🏫 *Sekolah*: ${schoolProfile.name}
📚 *Mata Pelajaran*: ${exam.subject}
👥 *Tingkat / Kelas*: Kelas ${exam.grade}
⏱️ *Alokasi Waktu*: ${exam.durationMinutes} Menit
🔑 *Token Ujian*: *${exam.token}*

🔗 *Tautan Pengerjaan Siswa*:
${shareUrl}

📌 *Petunjuk Pengerjaan*:
1. Buka tautan di atas melalui browser HP / Laptop / Chromebook Anda.
2. Pilih nama Anda dari daftar peserta ujian.
3. Masukkan / periksa Token Akses (${exam.token}).
4. Klik 'Masuk & Mulai Ujian'.
5. *Peringatan*: Dilarang berpindah tab atau membuka aplikasi lain selama ujian berlangsung.

━━━━━━━━━━━━━━━━━━━
_Selamat mengerjakan dengan jujur dan teliti!_`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // Fallback
      const input = document.createElement('input');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleCopyWA = async () => {
    try {
      await navigator.clipboard.writeText(waAnnouncement);
      setCopiedWA(true);
      setTimeout(() => setCopiedWA(false), 2500);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = waAnnouncement;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedWA(true);
      setTimeout(() => setCopiedWA(false), 2500);
    }
  };

  const handleOpenStudentTab = () => {
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
  };

  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
    shareUrl
  )}&bgcolor=ffffff&color=1e1b4b&margin=10`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-800 text-white p-5 sm:p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center border border-white/20 shadow-inner">
              <Share2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg tracking-tight">Bagikan Link Ujian Siswa</h3>
              <p className="text-xs text-indigo-150">
                Mode Siswa Terisolasi • {exam.subject} Kelas {exam.grade}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto text-xs text-slate-700">
          {/* Security Notice */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed text-emerald-900">
              <span className="font-bold">Keamanan Terisolasi:</span> Tautan ini khusus untuk peserta ujian.
              Siswa <strong>tidak memiliki tombol kembali ke dashboard guru</strong> dan tidak dapat melihat kunci
              jawaban atau pengaturan guru.
            </div>
          </div>

          {/* Token Options Toggle */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-indigo-600" />
                Format Tautan yang Dibagikan
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIncludeToken(true)}
                  className={`px-3 py-1 rounded-lg font-semibold text-[11px] transition ${
                    includeToken
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Sertakan Token Otomatis
                </button>
                <button
                  type="button"
                  onClick={() => setIncludeToken(false)}
                  className={`px-3 py-1 rounded-lg font-semibold text-[11px] transition ${
                    !includeToken
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Hanya Link Bersih
                </button>
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              {includeToken
                ? 'Siswa yang mengklik tautan langsung mendapatkan token terisi, mempermudah siswa agar tidak salah ketik.'
                : 'Siswa harus memasukkan token secara manual yang Anda umumkan di kelas atau papan tulis.'}
            </p>
          </div>

          {/* URL Box & Copy Actions */}
          <div className="space-y-2">
            <label className="font-semibold text-slate-800 block text-xs">
              Tautan Khusus Siswa (URL CBT)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="w-full bg-slate-100 border border-slate-300 font-mono text-xs px-3.5 py-2.5 rounded-xl text-slate-800 select-all focus:outline-hidden"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className={`shrink-0 px-4 py-2.5 rounded-xl font-bold flex items-center gap-1.5 transition text-xs shadow-xs ${
                  copiedLink
                    ? 'bg-emerald-600 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95'
                }`}
              >
                {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedLink ? 'Tersalin!' : 'Salin Link'}</span>
              </button>
            </div>
          </div>

          {/* Token Display Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-3 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-indigo-700">Token Akses Ujian Saat Ini</span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono text-2xl font-black text-indigo-900 tracking-wider">
                  {exam.token || 'TIDAK AKTIF'}
                </span>
                <span className="text-[10px] text-indigo-600 font-medium">({exam.durationMinutes} Menit)</span>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[11px] font-semibold text-slate-800 block">QR Code Layar Kelas</span>
                <span className="text-[10px] text-slate-500 block">Scan langsung via kamera HP siswa</span>
              </div>
              <button
                type="button"
                onClick={() => setShowQrCode(!showQrCode)}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition border ${
                  showQrCode
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>{showQrCode ? 'Tutup QR' : 'Tampilkan QR'}</span>
              </button>
            </div>
          </div>

          {/* Collapsible QR Code Card for Classroom Projection */}
          {showQrCode && (
            <div className="p-4 bg-slate-900 text-white rounded-2xl flex flex-col sm:flex-row items-center justify-center gap-4 text-center sm:text-left border border-slate-800 animate-in fade-in">
              <div className="bg-white p-2.5 rounded-xl shadow-md shrink-0">
                <img
                  src={qrApiUrl}
                  alt="QR Code Mode Siswa"
                  className="w-36 h-36 object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-bold">
                  <Smartphone className="w-3 h-3" />
                  <span>Scan via Kamera HP</span>
                </div>
                <h4 className="font-bold text-sm text-white">{exam.title}</h4>
                <p className="text-[11px] text-slate-300">
                  Arahkan kamera smartphone untuk langsung membuka portal ujian tanpa mengetik URL.
                </p>
                <div className="text-[11px] font-mono text-emerald-400 font-bold">
                  Token: {exam.token}
                </div>
              </div>
            </div>
          )}

          {/* WhatsApp Format Announcement Preview & Copy */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50">
            <div className="p-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
              <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                Format Pengumuman WhatsApp / Google Classroom
              </span>
              <button
                type="button"
                onClick={handleCopyWA}
                className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition ${
                  copiedWA
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                }`}
              >
                {copiedWA ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedWA ? 'Tersalin!' : 'Salin Teks Pesan'}</span>
              </button>
            </div>
            <pre className="p-3 font-sans text-[11px] text-slate-600 whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto select-all">
              {waAnnouncement}
            </pre>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleOpenStudentTab}
            className="px-4 py-2.5 rounded-xl font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 flex items-center gap-1.5 transition text-xs"
            title="Buka untuk memeriksa tampilan di tab baru"
          >
            <ExternalLink className="w-4 h-4 text-slate-500" />
            <span>Uji Coba Tampilan Siswa</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl font-bold bg-slate-900 hover:bg-slate-800 text-white text-xs transition"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
};
