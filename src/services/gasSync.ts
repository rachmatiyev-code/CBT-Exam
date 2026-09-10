import * as XLSX from 'xlsx';
import { Exam, Student, StudentExamSession, DriveBackupItem } from '../types';

export const APPS_SCRIPT_CODE = `/**
 * =========================================================================
 * GOOGLE APPS SCRIPT (Code.gs) - EDU-CBT AI & GOOGLE SHEETS & DRIVE ENGINE
 * =========================================================================
 * SOLUSI ANTI-ERROR 404 & PANDUAN LENGKAP:
 * 
 * 1. KENAPA ERROR 404 TERJADI MESKI LANGKAH SUDAH BENAR?
 *    a. Akun Google Workspace / Belajar.id:
 *       Banyak akun dinas (@belajar.id atau domain sekolah) mengunci setelan
 *       berbagi sehingga opsi "Anyone" (Siapa saja) tidak mengizinkan akses publik
 *       luar domain. Jika ini terjadi, gunakan akun Gmail pribadi (@gmail.com)
 *       untuk membuat Spreadsheet & Apps Script ini.
 *    b. Versi Deployment Belum Diperbarui:
 *       Di Apps Script, mengklik tombol "Save" (Disket) TIDAK mengupdate deployment!
 *       Anda WAJIB ke Deploy > Manage deployments > ikon Pensil (Edit) > Version: "New version" > Deploy.
 *    c. Pengaturan "Who has access" Salah:
 *       Harus dipilih "Anyone" (Siapa saja), BUKAN "Only myself" atau "Anyone with Google account".
 *    d. Path Multi-Akun (/u/0/ atau /u/1/):
 *       Jika URL Anda mengandung /u/0/ atau /u/1/, aplikasi EduCBT akan otomatis
 *       membersihkannya menjadi https://script.google.com/macros/s/.../exec.
 *
 * 2. LANGKAH PEMASANGAN RESMI:
 *    Langkah 1: Buat Spreadsheet baru di Google Drive (atau buka script.google.com).
 *    Langkah 2: Buka menu Extensions (Ekstensi) > Apps Script.
 *    Langkah 3: Hapus seluruh kode bawaan (myFunction) dan tempel (paste) kode ini.
 *    Langkah 4: Klik ikon Disket (Save).
 *    Langkah 5: [PENTING] Pilih fungsi "setupOtorisasi" di dropdown atas, lalu klik "Jalankan" (Run).
 *               Selesaikan pop-up Review Permissions > Pilih Akun > Advanced > Go to (unsafe) > Allow.
 *    Langkah 6: Klik tombol "Deploy" (Terapkan) di kanan atas > "New deployment" (Penerapan baru).
 *    Langkah 7: Klik ikon roda gigi > pilih jenis "Web app".
 *               - Description: EduCBT AI Web App
 *               - Execute as: Me (Email Google Anda)
 *               - Who has access: Anyone (Siapa saja)  <-- WAJIB ANYONE
 *    Langkah 8: Klik "Deploy", lalu salin "Web app URL" (berakhiran /exec).
 *    Langkah 9: Tempel URL tersebut ke menu Integrasi Google Apps Script di aplikasi EduCBT AI.
 */

// Nama Folder Khusus Penyimpanan di Google Drive
const ROOT_FOLDER_NAME = "EduCBT";
const SUB_FOLDER_SOAL = "Riwayat Soal";
const SUB_FOLDER_HASIL = "Hasil Ujian";

/**
 * JALANKAN FUNGSI INI PERTAMA KALI DI EDITOR APPS SCRIPT:
 * Pilih "setupOtorisasi" di dropdown fungsi sebelah tombol "Debug",
 * lalu klik "Jalankan" (Run) untuk memunculkan pop-up izin Google Drive & Sheets.
 */
function setupOtorisasi() {
  try {
    var folders = getOrCreateBackupFolders();
    var ss = getTargetSpreadsheet();
    Logger.log("✅ OTORISASI BERHASIL!");
    Logger.log("📁 Folder Root: " + folders.root.getName() + " (ID: " + folders.root.getId() + ")");
    Logger.log("📊 Spreadsheet: " + ss.getName() + " (URL: " + ss.getUrl() + ")");
    return "✅ Otorisasi Sukses! Spreadsheet dan Folder Google Drive telah siap digunakan.";
  } catch (err) {
    Logger.log("❌ Gagal otorisasi: " + err.toString());
    throw err;
  }
}

// Inisialisasi atau dapatkan folder di Google Drive
function getOrCreateBackupFolders() {
  var rootFolders = DriveApp.getFoldersByName(ROOT_FOLDER_NAME);
  var rootFolder;
  if (rootFolders.hasNext()) {
    rootFolder = rootFolders.next();
  } else {
    rootFolder = DriveApp.createFolder(ROOT_FOLDER_NAME);
  }

  var soalFolders = rootFolder.getFoldersByName(SUB_FOLDER_SOAL);
  var soalFolder = soalFolders.hasNext() ? soalFolders.next() : rootFolder.createFolder(SUB_FOLDER_SOAL);

  var hasilFolders = rootFolder.getFoldersByName(SUB_FOLDER_HASIL);
  var hasilFolder = hasilFolders.hasNext() ? hasilFolders.next() : rootFolder.createFolder(SUB_FOLDER_HASIL);

  return {
    root: rootFolder,
    soal: soalFolder,
    hasil: hasilFolder
  };
}

// Dapatkan atau buat Spreadsheet untuk penampungan nilai
function getTargetSpreadsheet() {
  try {
    var activeSS = SpreadsheetApp.getActiveSpreadsheet();
    if (activeSS) return activeSS;
  } catch (e) {}

  // Fallback jika script dibuat secara standalone (di script.google.com langsung)
  var files = DriveApp.getFilesByName("EduCBT_Rekap_Nilai_Siswa");
  if (files.hasNext()) {
    return SpreadsheetApp.open(files.next());
  }
  return SpreadsheetApp.create("EduCBT_Rekap_Nilai_Siswa");
}

// Endpoint GET: Dipanggil saat URL dibuka di tab browser atau diuji via GET Probe
function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) || "ping";
    var folders = getOrCreateBackupFolders();
    var ss = getTargetSpreadsheet();

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      success: true,
      action: action,
      message: "✅ Web App EduCBT AI Aktif & Siap Menerima Data!",
      spreadsheetName: ss ? ss.getName() : "EduCBT_Rekap_Nilai_Siswa",
      spreadsheetUrl: ss ? ss.getUrl() : "",
      folders: {
        root: folders.root.getName(),
        soal: folders.soal.getName(),
        hasil: folders.hasil.getName()
      },
      auth: "Anyone - OK",
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "warning",
      success: false,
      message: "Web App aktif namun memerlukan persetujuan izin akses Google Drive & Sheets. Silakan jalankan fungsi 'setupOtorisasi' di editor Apps Script: " + err.toString(),
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Endpoint POST: Menerima sinkronisasi data dari EduCBT AI
function doPost(e) {
  try {
    var data = {};
    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        data = {};
      }
    }
    
    // Fallback baca parameter jika dikirim via URL / Form
    var action = data.action || (e && e.parameter && e.parameter.action) || "test_connection";
    var payload = data.payload || {};
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch(pErr) {}
    }

    var folders = getOrCreateBackupFolders();
    var ss = getTargetSpreadsheet();

    // 1. Uji Koneksi / Ping Webhook
    if (action === "test_connection" || action === "ping") {
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        success: true,
        message: "Koneksi Google Apps Script, Google Sheets, dan Google Drive aktif dan siap menerima data!",
        spreadsheetName: ss ? ss.getName() : "Aktif",
        folderName: folders.root ? folders.root.getName() : "EduCBT",
        timestamp: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 2. Simpan Rekap Nilai Siswa
    if (action === "sync_exam_result") {
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
        payload.examId || "-",
        payload.subject || "-",
        payload.studentNisn || "-",
        payload.studentName || "-",
        payload.classRoom || "-",
        pgText,
        isianText,
        uraianText,
        payload.totalScore || 0,
        payload.maxTotalScore || 100,
        (typeScores.avgTypePercentage ? typeScores.avgTypePercentage.toFixed(1) : (payload.percentage || 0).toFixed(1)) + "%",
        (payload.percentage || 0).toFixed(1),
        payload.passedKKM ? "TUNTAS" : "REMIDI",
        payload.tabSwitchCount || 0,
        payload.remedialPlan ? (payload.remedialPlan.type.toUpperCase() + ": " + payload.remedialPlan.headline) : "-"
      ]);

      var fileName = "Hasil_" + (payload.studentNisn || "NISN") + "_" + (payload.studentName || "Siswa").replace(/\\s+/g, '_') + "_" + new Date().getTime() + ".json";
      folders.hasil.createFile(fileName, JSON.stringify(payload, null, 2), MimeType.PLAIN_TEXT);

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        success: true,
        message: "Hasil ujian berhasil dicatat ke Google Sheet Rekap_Nilai dan diarsipkan di EduCBT/Hasil Ujian!",
        fileName: fileName
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 3. Backup Naskah Soal Asesmen
    if (action === "backup_question_bank") {
      var baseName = (payload.code || "SOAL") + "_" + (payload.subject || "Ujian").replace(/\\s+/g, '_') + "_" + (payload.title ? payload.title.replace(/\\s+/g, '_').substring(0, 25) : "BankSoal");
      
      var jsonFileName = baseName + ".json";
      folders.soal.createFile(jsonFileName, JSON.stringify(payload, null, 2), MimeType.PLAIN_TEXT);

      var txtContent = payload.txtContent || JSON.stringify(payload, null, 2);
      var txtFileName = baseName + ".txt";
      folders.soal.createFile(txtFileName, txtContent, MimeType.PLAIN_TEXT);

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        success: true,
        message: "Soal berhasil diarsipkan ke Google Drive di folder EduCBT/Riwayat Soal (.json dan .txt)!",
        jsonFile: jsonFileName,
        txtFile: txtFileName
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 4. Backup Seluruh Data Sistem (Sekolah, Siswa, Soal, Sesi)
    if (action === "backup_all") {
      var fullBackupName = "Backup_EduCBT_Lengkap_" + new Date().getTime() + ".json";
      folders.root.createFile(fullBackupName, JSON.stringify(payload, null, 2), MimeType.PLAIN_TEXT);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        success: true,
        message: "Data lengkap EduCBT berhasil dicadangkan ke Google Drive folder EduCBT!",
        fileName: fullBackupName
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      success: false,
      message: "Aksi tidak dikenal: " + action
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      success: false,
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

  // Download Question Template (.xlsx or .csv) with sample data for all 4 types
  downloadQuestionTemplate(format: 'xlsx' | 'csv' = 'xlsx') {
    const sampleQuestions = [
      {
        No: 1,
        'Bentuk Soal': 'pilihan_ganda',
        Pertanyaan: 'Organel sel yang berfungsi sebagai pusat respirasi seluler dan penghasil energi utama (ATP) adalah...',
        'Pilihan A': 'Mitokondria',
        'Pilihan B': 'Ribosom',
        'Pilihan C': 'Badan Golgi',
        'Pilihan D': 'Retikulum Endoplasma',
        'Pilihan E': '',
        'Kunci Jawaban': 'A',
        'Kata Kunci Konsep': 'mitokondria, respirasi sel, ATP, konversi energi',
        'Konsep Materi': 'Struktur dan Fungsi Organel Sel',
        'Skor Maks': 10,
        Pembahasan: 'Mitokondria merupakan organel sel penghasil energi selular utama (ATP) melalui metabolisme respirasi aerob.',
      },
      {
        No: 2,
        'Bentuk Soal': 'pilihan_ganda_kompleks',
        Pertanyaan: 'Manakah di antara pernyataan berikut yang BENAR mengenai ciri khas sel tumbuhan? (Pilihlah semua opsi yang sesuai)',
        'Pilihan A': 'Memiliki dinding sel dari zat selulosa yang kaku',
        'Pilihan B': 'Tidak memiliki membran inti sel (prokariotik)',
        'Pilihan C': 'Memiliki kloroplas yang mengandung klorofil untuk fotosintesis',
        'Pilihan D': 'Memiliki vakuola sentral berukuran besar',
        'Pilihan E': '',
        'Kunci Jawaban': 'A, C, D',
        'Kata Kunci Konsep': 'dinding sel, kloroplas, vakuola sentral, selulosa',
        'Konsep Materi': 'Karakteristik Sel Tumbuhan vs Sel Hewan',
        'Skor Maks': 10,
        Pembahasan: 'Pernyataan A, C, dan D benar. Pernyataan B salah karena sel tumbuhan adalah eukariotik.',
      },
      {
        No: 3,
        'Bentuk Soal': 'isian_singkat',
        Pertanyaan: 'Zat hijau daun yang berperan vital menangkap energi foton cahaya matahari dalam reaksi fotosintesis disebut...',
        'Pilihan A': '',
        'Pilihan B': '',
        'Pilihan C': '',
        'Pilihan D': '',
        'Pilihan E': '',
        'Kunci Jawaban': 'Klorofil',
        'Kata Kunci Konsep': 'klorofil, zat hijau daun, pigmen fotosintesis',
        'Konsep Materi': 'Fotosintesis Tumbuhan',
        'Skor Maks': 10,
        Pembahasan: 'Klorofil adalah pigmen utama penangkap cahaya fotosintesis pada tilakoid kloroplas.',
      },
      {
        No: 4,
        'Bentuk Soal': 'uraian',
        Pertanyaan: 'Jelaskan dua tahapan utama dalam proses fotosintesis pada tumbuhan hijau, tempat terjadinya, serta produk yang dihasilkan masing-masing tahapan!',
        'Pilihan A': '',
        'Pilihan B': '',
        'Pilihan C': '',
        'Pilihan D': '',
        'Pilihan E': '',
        'Kunci Jawaban': 'Reaksi terang berlangsung di grana/tilakoid menghasilkan O2, ATP, dan NADPH. Reaksi gelap (siklus Calvin) berlangsung di stroma menghasilkan glukosa (karbohidrat).',
        'Kata Kunci Konsep': 'reaksi terang, reaksi gelap, siklus Calvin, tilakoid, stroma, ATP, NADPH, glukosa',
        'Konsep Materi': 'Mekanisme Biokimia Fotosintesis',
        'Skor Maks': 20,
        Pembahasan: 'Skor penuh jika mencakup perbandingan reaksi terang (di tilakoid) dan reaksi gelap (di stroma) beserta produknya.',
      },
    ];

    const instructions = [
      {
        Kolom: 'Bentuk Soal',
        'Aturan Pengisian': 'Wajib diisi dengan salah satu: pilihan_ganda, pilihan_ganda_kompleks, isian_singkat, atau uraian.',
        Contoh: 'pilihan_ganda',
      },
      {
        Kolom: 'Pertanyaan',
        'Aturan Pengisian': 'Teks butir soal lengkap. Hindari format karakter aneh.',
        Contoh: 'Organel sel yang berfungsi...',
      },
      {
        Kolom: 'Pilihan A - E',
        'Aturan Pengisian': 'Isi teks pilihan untuk bentuk soal pilihan_ganda dan pilihan_ganda_kompleks. Biarkan kosong untuk isian/uraian.',
        Contoh: 'Mitokondria',
      },
      {
        Kolom: 'Kunci Jawaban',
        'Aturan Pengisian': 'Pilihan Ganda: 1 huruf (cth: A). PG Kompleks: huruf dipisah koma (cth: A, C). Isian: kata kunci jawaban. Uraian: ringkasan acuan.',
        Contoh: 'A / A, C, D / Klorofil',
      },
      {
        Kolom: 'Kata Kunci Konsep',
        'Aturan Pengisian': 'Pisahkan dengan koma. Digunakan oleh mesin AI untuk pencocokan jawaban isian & penilaian rubrik uraian.',
        Contoh: 'mitokondria, ATP, respirasi',
      },
      {
        Kolom: 'Skor Maks',
        'Aturan Pengisian': 'Bobot skor maksimal butir soal (misal: 10 untuk PG, 20 untuk Uraian).',
        Contoh: '10',
      },
      {
        Kolom: 'Pembahasan',
        'Aturan Pengisian': 'Penjelasan edukatif yang tampil saat siswa melihat lembar pembahasan ujian.',
        Contoh: 'Mitokondria merupakan...',
      },
    ];

    const wb = XLSX.utils.book_new();
    const wsQuestions = XLSX.utils.json_to_sheet(sampleQuestions);
    const wsInstructions = XLSX.utils.json_to_sheet(instructions);

    XLSX.utils.book_append_sheet(wb, wsQuestions, 'Template_Soal');
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'Petunjuk_Pengisian');

    const filename = format === 'csv' ? 'Template_Soal_EduCBT.csv' : 'Template_Soal_EduCBT.xlsx';
    XLSX.writeFile(wb, filename, { bookType: format === 'csv' ? 'csv' : 'xlsx' });
  },

  // Download Student Template (.xlsx or .csv) with sample data and guidance
  downloadStudentTemplate(format: 'xlsx' | 'csv' = 'xlsx') {
    const sampleStudents = [
      {
        No: 1,
        NISN: '0081234501',
        'Nama Lengkap': 'Ahmad Fauzi Rahman',
        'Jenis Kelamin (L/P)': 'L',
        Kelas: 'IX-A',
        'No. WhatsApp Orang Tua': '081234567801',
        'Email Orang Tua': 'wali.ahmad@gmail.com',
      },
      {
        No: 2,
        NISN: '0081234502',
        'Nama Lengkap': 'Annisa Larasati Putri',
        'Jenis Kelamin (L/P)': 'P',
        Kelas: 'IX-A',
        'No. WhatsApp Orang Tua': '081234567802',
        'Email Orang Tua': 'wali.annisa@gmail.com',
      },
      {
        No: 3,
        NISN: '0081234503',
        'Nama Lengkap': 'Budi Santoso Wibowo',
        'Jenis Kelamin (L/P)': 'L',
        Kelas: 'IX-B',
        'No. WhatsApp Orang Tua': '081234567803',
        'Email Orang Tua': 'wali.budi@gmail.com',
      },
      {
        No: 4,
        NISN: '0081234504',
        'Nama Lengkap': 'Citra Kirana Dewi',
        'Jenis Kelamin (L/P)': 'P',
        Kelas: 'IX-B',
        'No. WhatsApp Orang Tua': '081234567804',
        'Email Orang Tua': 'wali.citra@gmail.com',
      },
      {
        No: 5,
        NISN: '0081234505',
        'Nama Lengkap': 'Dimas Bagus Pratama',
        'Jenis Kelamin (L/P)': 'L',
        Kelas: 'IX-C',
        'No. WhatsApp Orang Tua': '081234567805',
        'Email Orang Tua': 'wali.dimas@gmail.com',
      },
    ];

    const instructions = [
      {
        Kolom: 'NISN',
        'Ketentuan & Format': 'Wajib 10 digit unik angka (menjadi ID login siswa saat membuka ujian CBT).',
        Contoh: '0081234501',
      },
      {
        Kolom: 'Nama Lengkap',
        'Ketentuan & Format': 'Nama lengkap resmi siswa sesuai data Dapodik / Kartu Keluarga.',
        Contoh: 'Ahmad Fauzi Rahman',
      },
      {
        Kolom: 'Jenis Kelamin (L/P)',
        'Ketentuan & Format': 'Isi dengan huruf "L" (Laki-laki) atau "P" (Perempuan).',
        Contoh: 'L atau P',
      },
      {
        Kolom: 'Kelas',
        'Ketentuan & Format': 'Rombongan belajar siswa (misal: IX-A, IX-B, VII-1, dsb).',
        Contoh: 'IX-A',
      },
      {
        Kolom: 'No. WhatsApp Orang Tua',
        'Ketentuan & Format': 'Nomor WhatsApp aktif orang tua diawali 08 atau 62 (untuk kirim rekap nilai & remidi).',
        Contoh: '081234567801',
      },
      {
        Kolom: 'Email Orang Tua',
        'Ketentuan & Format': 'Email orang tua/wali siswa (opsional).',
        Contoh: 'orangtua@gmail.com',
      },
    ];

    const wb = XLSX.utils.book_new();
    const wsStudents = XLSX.utils.json_to_sheet(sampleStudents);
    const wsInstructions = XLSX.utils.json_to_sheet(instructions);

    XLSX.utils.book_append_sheet(wb, wsStudents, 'Template_Siswa');
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'Petunjuk_Pengisian');

    const filename = format === 'csv' ? 'Template_Daftar_Siswa_EduCBT.csv' : 'Template_Daftar_Siswa_EduCBT.xlsx';
    XLSX.writeFile(wb, filename, { bookType: format === 'csv' ? 'csv' : 'xlsx' });
  },

  // Parse Excel or CSV file for students
  async parseStudentsFromExcel(file: File): Promise<Student[]> {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    // Find matching sheet name or fallback to first sheet
    let targetSheetName = wb.SheetNames[0];
    const candidate = wb.SheetNames.find(
      (name) => !name.toLowerCase().includes('petunjuk') && (name.toLowerCase().includes('siswa') || name.toLowerCase().includes('student'))
    );
    if (candidate) targetSheetName = candidate;

    const ws = wb.Sheets[targetSheetName];
    const json: any[] = XLSX.utils.sheet_to_json(ws);

    return json
      .filter((row) => {
        // Must have either NISN or Name to be considered a valid student row
        const hasNisn = row['NISN'] || row['nisn'] || row['Nomor Induk'];
        const hasName = row['Nama Lengkap'] || row['Nama Siswa'] || row['Nama'] || row['name'];
        return hasNisn || hasName;
      })
      .map((row, index) => {
        const nisn = String(row['NISN'] || row['nisn'] || row['Nomor Induk'] || `0089100${index + 1}`).trim();
        const name = String(row['Nama Lengkap'] || row['Nama Siswa'] || row['Nama'] || row['name'] || `Siswa Baru ${index + 1}`).trim();
        const genderRaw = String(row['Jenis Kelamin'] || row['Jenis Kelamin (L/P)'] || row['JK'] || 'L').trim().toUpperCase();
        const gender: 'L' | 'P' = genderRaw.startsWith('P') ? 'P' : 'L';
        const classRoom = String(row['Kelas'] || row['Rombel'] || 'IX-A').trim();
        const parentPhone = String(row['No. WhatsApp Orang Tua'] || row['No WA'] || row['Telepon'] || row['WhatsApp'] || '081234567890').trim();
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

  // Parse questions from Excel or CSV file
  async parseQuestionsFromExcel(file: File): Promise<any[]> {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    // Find matching sheet name or fallback to first sheet
    let targetSheetName = wb.SheetNames[0];
    const candidate = wb.SheetNames.find(
      (name) => !name.toLowerCase().includes('petunjuk') && (name.toLowerCase().includes('soal') || name.toLowerCase().includes('bank') || name.toLowerCase().includes('question'))
    );
    if (candidate) targetSheetName = candidate;

    const ws = wb.Sheets[targetSheetName];
    const json: any[] = XLSX.utils.sheet_to_json(ws);

    return json
      .filter((row) => {
        // Must have question text
        const qText = row['Pertanyaan'] || row['Soal'] || row['question'] || row['Pertanyaan Soal'];
        return qText && String(qText).trim().length > 0;
      })
      .map((row, index) => {
        const typeStr = String(row['Bentuk Soal'] || row['Tipe Soal'] || row['Tipe'] || 'pilihan_ganda').toLowerCase();
        let type = 'pilihan_ganda';
        if (typeStr.includes('kompleks')) type = 'pilihan_ganda_kompleks';
        else if (typeStr.includes('singkat') || typeStr.includes('pendek') || typeStr.includes('isian')) type = 'isian_singkat';
        else if (typeStr.includes('uraian') || typeStr.includes('esai') || typeStr.includes('essay')) type = 'uraian';

        const options: string[] = [];
        ['Pilihan A', 'Pilihan B', 'Pilihan C', 'Pilihan D', 'Pilihan E', 'A', 'B', 'C', 'D', 'E'].forEach((key) => {
          if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
            const label = key.replace('Pilihan ', '').trim();
            const val = String(row[key]).trim();
            // Avoid duplicate prefix like "A. A. text"
            if (val.startsWith(`${label}.`)) {
              options.push(val);
            } else {
              options.push(`${label}. ${val}`);
            }
          }
        });

        const correctAnswerRaw = String(row['Kunci Jawaban'] || row['Kunci'] || row['Jawaban'] || 'A').trim();
        let correctAnswer: any = correctAnswerRaw;
        if (type === 'pilihan_ganda_kompleks') {
          correctAnswer = correctAnswerRaw
            .split(/[,;\s]+/)
            .map((k) => k.trim().toUpperCase())
            .filter(Boolean);
          if (correctAnswer.length === 0) correctAnswer = ['A'];
        }

        const keywordsRaw = String(row['Kata Kunci Konsep'] || row['Kata Kunci'] || '').trim();
        const keywords = keywordsRaw ? keywordsRaw.split(/[,;]+/).map((k) => k.trim()).filter(Boolean) : [];

        return {
          id: `q-imp-${Date.now()}-${index}`,
          type,
          question: String(row['Pertanyaan'] || row['Soal'] || row['question'] || `Soal ${index + 1}`).trim(),
          options,
          correctAnswer,
          keywords,
          concept: String(row['Konsep Materi'] || row['Materi'] || '').trim(),
          maxScore: Number(row['Skor Maks'] || row['Skor'] || (type === 'uraian' ? 20 : 10)),
          explanation: String(row['Pembahasan'] || row['Penjelasan'] || '').trim(),
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
