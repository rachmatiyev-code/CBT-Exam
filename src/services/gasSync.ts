import * as XLSX from 'xlsx';
import { Exam, Student, StudentExamSession, DriveBackupItem } from '../types';

export const APPS_SCRIPT_CODE = `/**
 * =========================================================================
 * GOOGLE APPS SCRIPT (Code.gs) - EDU-CBT AI & GOOGLE SHEETS & DRIVE ENGINE
 * =========================================================================
 * Panduan Pemasangan:
 * 1. Buat Google Spreadsheet baru di Google Drive Anda.
 * 2. Buka menu Extensions (Ekstensi) > Apps Script.
 * 3. Hapus kode bawaan dan tempel (paste) seluruh kode ini.
 * 4. Klik "Deploy" (Terapkan) > "New deployment" (Penerapan Baru).
 * 5. Pilih jenis "Web app" (Aplikasi Web).
 *    - Description: EduCBT AI Integration Web App
 *    - Execute as: Me (Email Anda)
 *    - Who has access: Anyone (Siapa saja)
 * 6. Klik Deploy, beri izin akses (Review Permissions > Allow).
 * 7. Salin Web App URL dan tempel ke menu "Integrasi Google Apps Script" di aplikasi EduCBT AI.
 */

// Konstanta Nama Folder Khusus Backup & Arsip di Google Drive
const ROOT_FOLDER_NAME = "EduCBT";
const SUB_FOLDER_SOAL = "Riwayat Soal";
const SUB_FOLDER_HASIL = "Hasil Ujian";

// Inisialisasi atau Dapatkan Struktur Folder Khusus EduCBT di Google Drive
function getOrCreateBackupFolders() {
  var rootFolders = DriveApp.getFoldersByName(ROOT_FOLDER_NAME);
  var rootFolder;
  if (rootFolders.hasNext()) {
    rootFolder = rootFolders.next();
  } else {
    rootFolder = DriveApp.createFolder(ROOT_FOLDER_NAME);
  }

  // Sub folder "Riwayat Soal"
  var soalFolders = rootFolder.getFoldersByName(SUB_FOLDER_SOAL);
  var soalFolder = soalFolders.hasNext() ? soalFolders.next() : rootFolder.createFolder(SUB_FOLDER_SOAL);

  // Sub folder "Hasil Ujian"
  var hasilFolders = rootFolder.getFoldersByName(SUB_FOLDER_HASIL);
  var hasilFolder = hasilFolders.hasNext() ? hasilFolders.next() : rootFolder.createFolder(SUB_FOLDER_HASIL);

  return {
    root: rootFolder,
    soal: soalFolder,
    hasil: hasilFolder
  };
}

// Endpoint GET untuk status pemeriksaan koneksi
function doGet(e) {
  var folders = getOrCreateBackupFolders();
  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    message: "Koneksi Google Apps Script, Google Sheets & Google Drive (Folder EduCBT/Riwayat Soal) Aktif!",
    rootFolderId: folders.root.getId(),
    soalFolderId: folders.soal.getId(),
    hasilFolderId: folders.hasil.getId(),
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

// Endpoint POST untuk sinkronisasi data dari EduCBT AI
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    var payload = data.payload;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var folders = getOrCreateBackupFolders();

    if (action === "sync_exam_result") {
      // Simpan rekap nilai siswa ke Sheet "Rekap_Nilai"
      var sheet = ss.getSheetByName("Rekap_Nilai");
      if (!sheet) {
        sheet = ss.insertSheet("Rekap_Nilai");
        sheet.appendRow([
          "Waktu Selesai", "ID Ujian", "Mata Pelajaran", "NISN", "Nama Siswa",
          "Kelas", "Skor PG", "Skor Isian", "Skor Uraian", "Total Skor",
          "Skor Maksimal", "Rerata Jenis Soal (%)", "Nilai Akhir", "Status KKM",
          "Pelanggaran Tab", "Catatan Remidi/Pengayaan"
        ]);
        sheet.getRange(1, 1, 1, 16).setFontWeight("bold").setBackground("#673ab7").setFontColor("#ffffff");
      }

      var typeScores = payload.typeScores || {};
      var pgText = typeScores.pg ? (typeScores.pg.score + "/" + typeScores.pg.max) : "-";
      var isianText = typeScores.isian ? (typeScores.isian.score + "/" + typeScores.isian.max) : "-";
      var uraianText = typeScores.uraian ? (typeScores.uraian.score + "/" + typeScores.uraian.max) : "-";

      sheet.appendRow([
        new Date(),
        payload.examId,
        payload.subject || "-",
        payload.studentNisn,
        payload.studentName,
        payload.classRoom,
        pgText,
        isianText,
        uraianText,
        payload.totalScore,
        payload.maxTotalScore,
        (typeScores.avgTypePercentage ? typeScores.avgTypePercentage.toFixed(1) : payload.percentage.toFixed(1)) + "%",
        payload.percentage.toFixed(1),
        payload.passedKKM ? "TUNTAS" : "REMIDI",
        payload.tabSwitchCount || 0,
        payload.remedialPlan ? (payload.remedialPlan.type.toUpperCase() + ": " + payload.remedialPlan.headline) : "-"
      ]);

      // Buat backup file JSON hasil pengerjaan di Google Drive folder EduCBT / Hasil Ujian
      var fileName = "Hasil_" + payload.studentNisn + "_" + payload.studentName.replace(/\s+/g, '_') + "_" + new Date().getTime() + ".json";
      folders.hasil.createFile(fileName, JSON.stringify(payload, null, 2), MimeType.PLAIN_TEXT);

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Hasil ujian berhasil dicatat ke Google Sheet Rekap_Nilai dan diarsipkan di EduCBT/Hasil Ujian!",
        fileName: fileName
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "backup_question_bank") {
      // Simpan arsip soal dalam format .json dan .txt di subfolder EduCBT / Riwayat Soal
      var baseName = (payload.code || "SOAL") + "_" + (payload.subject || "Ujian").replace(/\s+/g, '_') + "_" + (payload.title ? payload.title.replace(/\s+/g, '_').substring(0, 25) : "BankSoal");
      
      // 1. Simpan format .json
      var jsonFileName = baseName + ".json";
      folders.soal.createFile(jsonFileName, JSON.stringify(payload, null, 2), MimeType.PLAIN_TEXT);

      // 2. Simpan format .txt
      var txtContent = payload.txtContent || JSON.stringify(payload, null, 2);
      var txtFileName = baseName + ".txt";
      folders.soal.createFile(txtFileName, txtContent, MimeType.PLAIN_TEXT);

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Soal berhasil diarsipkan ke Google Drive di folder EduCBT/Riwayat Soal (.json dan .txt)!",
        jsonFile: jsonFileName,
        txtFile: txtFileName
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "Aksi tidak dikenal: " + action
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "Aksi tidak dikenal: " + action
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
`;

export const excelService = {
  // Export students to Excel template or list
  exportStudentsToExcel(students: Student[], filename = 'Data_Siswa.xlsx') {
    const data = students.map((s, idx) => ({
      No: idx + 1,
      NISN: s.nisn,
      'Nama Lengkap': s.name,
      'Jenis Kelamin (L/P)': s.gender,
      Kelas: s.classRoom,
      'No. WhatsApp Orang Tua': s.parentPhone,
      'Email Orang Tua': s.parentEmail,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data_Siswa');
    XLSX.writeFile(wb, filename);
  },

  // Export questions to Excel or CSV
  exportQuestionsToExcel(exam: Exam, filename = 'Bank_Soal.xlsx') {
    const data = exam.questions.map((q, idx) => ({
      No: idx + 1,
      'Bentuk Soal': q.type,
      Pertanyaan: q.question,
      'Pilihan A': q.options[0] || '',
      'Pilihan B': q.options[1] || '',
      'Pilihan C': q.options[2] || '',
      'Pilihan D': q.options[3] || '',
      'Pilihan E': q.options[4] || '',
      'Kunci Jawaban': Array.isArray(q.correctAnswer) ? q.correctAnswer.join(', ') : q.correctAnswer,
      'Kata Kunci Konsep': q.keywords ? q.keywords.join(', ') : '',
      'Konsep Materi': q.concept || '',
      'Skor Maks': q.maxScore,
      Pembahasan: q.explanation || '',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bank_Soal');
    XLSX.writeFile(wb, filename);
  },

  // Export class exam results to Excel
  exportResultsToExcel(sessions: StudentExamSession[], examTitle: string, filename = 'Rekap_Hasil_Ujian.xlsx') {
    const data = sessions.map((s, idx) => ({
      Ranking: idx + 1,
      NISN: s.studentNisn,
      'Nama Siswa': s.studentName,
      Kelas: s.classRoom,
      'Nilai Akhir (0-100)': s.percentage.toFixed(1),
      'Skor Diperoleh': s.totalScore,
      'Skor Maksimal': s.maxTotalScore,
      'Status KKM': s.passedKKM ? 'TUNTAS' : 'REMIDI',
      'Waktu Pengerjaan': s.finishTime ? new Date(s.finishTime).toLocaleString('id-ID') : 'Belum Selesai',
      'Pelanggaran Tab Switch': s.tabSwitchCount,
      'Status Program': s.remedialPlan ? (s.remedialPlan.type === 'remidi' ? 'Perlu Remidi' : 'Pengayaan') : '-',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap_Hasil');
    XLSX.writeFile(wb, filename);
  },

  // Parse Excel file for students
  async parseStudentsFromExcel(file: File): Promise<Student[]> {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const firstSheetName = wb.SheetNames[0];
    const ws = wb.Sheets[firstSheetName];
    const json: any[] = XLSX.utils.sheet_to_json(ws);

    return json.map((row, index) => {
      // Flexible column name matching
      const nisn = String(row['NISN'] || row['nisn'] || row['Nomor Induk'] || `0089100${index + 1}`).trim();
      const name = String(row['Nama Lengkap'] || row['Nama Siswa'] || row['Nama'] || row['name'] || `Siswa Baru ${index + 1}`).trim();
      const genderRaw = String(row['Jenis Kelamin'] || row['Jenis Kelamin (L/P)'] || row['JK'] || 'L').trim().toUpperCase();
      const gender: 'L' | 'P' = genderRaw.startsWith('P') ? 'P' : 'L';
      const classRoom = String(row['Kelas'] || row['Rombel'] || 'IX-A').trim();
      const parentPhone = String(row['No. WhatsApp Orang Tua'] || row['No WA'] || row['Telepon'] || '081234567890').trim();
      const parentEmail = String(row['Email Orang Tua'] || row['Email'] || '').trim();

      return {
        id: `std-imp-${Date.now()}-${index}`,
        nisn,
        name,
        gender,
        classRoom,
        parentPhone,
        parentEmail,
      };
    });
  },

  // Parse questions from Excel file
  async parseQuestionsFromExcel(file: File): Promise<any[]> {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const firstSheetName = wb.SheetNames[0];
    const ws = wb.Sheets[firstSheetName];
    const json: any[] = XLSX.utils.sheet_to_json(ws);

    return json.map((row, index) => {
      const typeStr = String(row['Bentuk Soal'] || row['Tipe Soal'] || 'pilihan_ganda').toLowerCase();
      let type = 'pilihan_ganda';
      if (typeStr.includes('kompleks')) type = 'pilihan_ganda_kompleks';
      else if (typeStr.includes('singkat') || typeStr.includes('pendek')) type = 'isian_singkat';
      else if (typeStr.includes('uraian') || typeStr.includes('esai') || typeStr.includes('essay')) type = 'uraian';

      const options: string[] = [];
      ['Pilihan A', 'Pilihan B', 'Pilihan C', 'Pilihan D', 'Pilihan E', 'A', 'B', 'C', 'D', 'E'].forEach((key) => {
        if (row[key]) {
          options.push(`${key.replace('Pilihan ', '')}. ${row[key]}`);
        }
      });

      const correctAnswerRaw = String(row['Kunci Jawaban'] || row['Kunci'] || 'A').trim();
      let correctAnswer: any = correctAnswerRaw;
      if (type === 'pilihan_ganda_kompleks') {
        correctAnswer = correctAnswerRaw.split(/[,;\s]+/).map((k) => k.trim().toUpperCase()).filter(Boolean);
      }

      const keywordsRaw = String(row['Kata Kunci Konsep'] || row['Kata Kunci'] || '').trim();
      const keywords = keywordsRaw ? keywordsRaw.split(/[,;]+/).map((k) => k.trim()) : [];

      return {
        id: `q-imp-${Date.now()}-${index}`,
        type,
        question: String(row['Pertanyaan'] || row['Soal'] || `Soal ${index + 1}`).trim(),
        options,
        correctAnswer,
        keywords,
        concept: String(row['Konsep Materi'] || '').trim(),
        maxScore: Number(row['Skor Maks'] || (type === 'uraian' ? 20 : 10)),
        explanation: String(row['Pembahasan'] || '').trim(),
      };
    });
  },

  // Generate readable .txt formatted exam question paper
  generateExamTxt(exam: Exam, schoolProfile?: any): string {
    const divider = '='.repeat(68);
    const subDivider = '-'.repeat(68);

    let text = `${divider}\n`;
    text += `                   NASKAH SOAL ASESMEN / UJIAN CBT\n`;
    if (schoolProfile?.name) {
      text += `                   ${schoolProfile.name.toUpperCase()}\n`;
    }
    text += `${divider}\n`;
    text += `Mata Pelajaran    : ${exam.subject}\n`;
    text += `Kelas / Semester  : ${exam.grade} / Semester ${exam.semester}\n`;
    text += `Judul Paket       : ${exam.title}\n`;
    text += `Kode Soal         : ${exam.code || '-'}\n`;
    text += `Token Akses Siswa : ${exam.token || '-'}\n`;
    text += `Alokasi Waktu     : ${exam.durationMinutes} Menit\n`;
    text += `KKM Kelulusan     : ${exam.kkm}\n`;
    text += `Jumlah Butir Soal : ${exam.questions.length} Soal\n`;
    text += `Tanggal Arsip     : ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}\n`;
    text += `${subDivider}\n`;
    text += `PETUNJUK UMUM:\n`;
    text += `1. Periksa dan bacalah setiap butir soal dengan teliti sebelum menjawab.\n`;
    text += `2. Soal Pilihan Ganda: Beri tanda silang (X) pada satu pilihan jawaban yang paling tepat (Bobot Benar: 1, Salah: 0).\n`;
    text += `3. Soal Isian Singkat: Jawablah dengan satu kata atau frasa singkat yang tepat (Bobot Benar: 2, Salah: 1).\n`;
    text += `4. Soal Uraian / Esai: Tuliskan penjelasan lengkap secara runtut menggunakan konsep materi (Bobot Benar: 3, Benar Sebagian: 2, Salah: 1).\n`;
    text += `${divider}\n\n`;

    exam.questions.forEach((q, idx) => {
      const typeLabel =
        q.type === 'pilihan_ganda'
          ? 'PILIHAN GANDA'
          : q.type === 'pilihan_ganda_kompleks'
          ? 'PILIHAN GANDA KOMPLEKS'
          : q.type === 'isian_singkat'
          ? 'ISIAN SINGKAT'
          : 'URAIAN / ESAI';

      text += `[No. ${idx + 1}] (${typeLabel} - Bobot Skor: ${q.maxScore || (q.type === 'pilihan_ganda' ? 1 : q.type === 'isian_singkat' ? 2 : 3)} Poin)\n`;
      text += `${q.question}\n`;

      if (q.image) {
        text += `[Gambar Terlampir pada Soal]\n`;
      }

      if (q.type === 'pilihan_ganda' || q.type === 'pilihan_ganda_kompleks') {
        q.options.forEach((opt) => {
          text += `   ${opt}\n`;
        });
      } else if (q.type === 'isian_singkat') {
        text += `   Jawaban: ___________________________________________________\n`;
      } else if (q.type === 'uraian') {
        text += `   Lembar Uraian:\n   _____________________________________________________________\n   _____________________________________________________________\n   _____________________________________________________________\n`;
      }

      text += `\n`;
    });

    text += `\n${divider}\n`;
    text += `                   KUNCI JAWABAN & PEDOMAN PENSKORAN\n`;
    text += `${divider}\n`;

    exam.questions.forEach((q, idx) => {
      const ansKey = Array.isArray(q.correctAnswer) ? q.correctAnswer.join(', ') : q.correctAnswer;
      text += `No. ${idx + 1} (${q.type}):\n`;
      text += `   - Kunci Jawaban : ${ansKey || '-'}\n`;
      if (q.keywords && q.keywords.length > 0) {
        text += `   - Kata Kunci    : ${q.keywords.join(', ')}\n`;
      }
      if (q.concept) {
        text += `   - Konsep Pokok  : ${q.concept}\n`;
      }
      if (q.rubric) {
        text += `   - Rubrik        : ${q.rubric}\n`;
      }
      if (q.explanation) {
        text += `   - Pembahasan    : ${q.explanation}\n`;
      }
      text += `\n`;
    });

    text += `${divider}\n`;
    text += `EduCBT AI - Folder Penyimpanan: EduCBT/Riwayat Soal\n`;
    return text;
  },

  // Download Exam Archive in .json, .txt, or both
  downloadExamArchive(exam: Exam, format: 'json' | 'txt' | 'both', schoolProfile?: any) {
    const cleanSubject = (exam.subject || 'Ujian').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanCode = (exam.code || 'SOAL').replace(/[^a-zA-Z0-9_-]/g, '_');
    const timestamp = new Date().toISOString().slice(0, 10);
    const baseFilename = `EduCBT_RiwayatSoal_${cleanCode}_${cleanSubject}_${timestamp}`;

    const triggerDownload = (content: string, filename: string, mimeType: string) => {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    if (format === 'json' || format === 'both') {
      const jsonContent = JSON.stringify(exam, null, 2);
      triggerDownload(jsonContent, `${baseFilename}.json`, 'application/json');
    }

    if (format === 'txt' || format === 'both') {
      const txtContent = this.generateExamTxt(exam, schoolProfile);
      triggerDownload(txtContent, `${baseFilename}.txt`, 'text/plain;charset=utf-8');
    }
  },
};
