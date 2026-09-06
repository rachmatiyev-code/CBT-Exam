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

// Konstanta Nama Folder Backup di Google Drive
const ROOT_FOLDER_NAME = "Ujian-CBT-Backup";
const SUB_FOLDER_SOAL = "Soal";
const SUB_FOLDER_HASIL = "Hasil-Ujian";

// Inisialisasi atau Dapatkan Struktur Folder Backup Drive
function getOrCreateBackupFolders() {
  var rootFolders = DriveApp.getFoldersByName(ROOT_FOLDER_NAME);
  var rootFolder;
  if (rootFolders.hasNext()) {
    rootFolder = rootFolders.next();
  } else {
    rootFolder = DriveApp.createFolder(ROOT_FOLDER_NAME);
  }

  // Sub folder Soal
  var soalFolders = rootFolder.getFoldersByName(SUB_FOLDER_SOAL);
  var soalFolder = soalFolders.hasNext() ? soalFolders.next() : rootFolder.createFolder(SUB_FOLDER_SOAL);

  // Sub folder Hasil Ujian
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
    message: "Koneksi Google Apps Script, Google Sheets & Google Drive Aktif!",
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
          "Kelas", "Total Skor", "Skor Maks", "Persentase (%)", "Status KKM",
          "Jumlah Pelanggaran Tab", "Rencana Remidi/Pengayaan"
        ]);
        sheet.getRange(1, 1, 1, 12).setFontWeight("bold").setBackground("#e2e8f0");
      }

      sheet.appendRow([
        new Date(),
        payload.examId,
        payload.subject,
        payload.studentNisn,
        payload.studentName,
        payload.classRoom,
        payload.totalScore,
        payload.maxTotalScore,
        payload.percentage + "%",
        payload.passedKKM ? "TUNTAS" : "REMIDI",
        payload.tabSwitchCount,
        payload.remedialPlan ? (payload.remedialPlan.type.toUpperCase() + ": " + payload.remedialPlan.headline) : "-"
      ]);

      // Buat backup file JSON hasil pengerjaan di Google Drive / Hasil-Ujian
      var fileName = "Hasil_" + payload.studentNisn + "_" + payload.studentName.replace(/\\s+/g, '_') + "_" + new Date().getTime() + ".json";
      folders.hasil.createFile(fileName, JSON.stringify(payload, null, 2), MimeType.PLAIN_TEXT);

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Hasil ujian berhasil dicatat ke Spreadsheet dan dibackup ke Drive!",
        fileName: fileName
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "backup_question_bank") {
      // Backup Soal ke Google Drive / Soal
      var soalFileName = "Soal_" + (payload.subject || "Ujian").replace(/\\s+/g, '_') + "_" + new Date().getTime() + ".json";
      folders.soal.createFile(soalFileName, JSON.stringify(payload, null, 2), MimeType.PLAIN_TEXT);

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Bank Soal berhasil dibackup ke Google Drive sub-folder Soal!",
        fileName: soalFileName
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
};
