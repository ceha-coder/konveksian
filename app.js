/**
 * ============================================================================
 * SISTEM MANAJEMEN OPERASIONAL KONVEKSI HULU KE HILIR (MTO)
 * FILE: app.js (BAGIAN 1: Core Config, Image Compression, Dashboard & Master CRUD)
 * ============================================================================
 */

// 1. KONFIGURASI SUPABASE (Ganti dengan Project URL & Anon Key Supabase Anda)
const SUPABASE_URL = 'https://isgypiahnskpcpktfdrv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_vMnIJ0LyrYtJTmd35KIkuQ_EvsZX8Q7';
const STORAGE_BUCKET = 'konveksi-assets';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2. STATE GLOBAL APLIKASI
const AppState = {
    bahan: [],
    produk: [],
    pekerja: [],
    pesanan: [],
    spk: [],
    rincianUkuran: [],
    logUpah: [],
    keuangan: [],
    dataTables: {}
};

// ============================================================================
// UTILITY FUNCTIONS (FORMAT RUPIAH, TANGGAL, DATATABLES & LOADER)
// ============================================================================

function showLoader(text = 'Memproses data...') {
    document.getElementById('loaderText').textContent = text;
    document.getElementById('globalLoader').classList.remove('d-none');
}

function hideLoader() {
    document.getElementById('globalLoader').classList.add('d-none');
}

function formatRupiah(nominal) {
    const num = Number(nominal) || 0;
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(num);
}

function formatAngka(nominal, desimal = 2) {
    const num = Number(nominal) || 0;
    return num.toLocaleString('id-ID', {
        minimumFractionDigits: 0,
        maximumFractionDigits: desimal
    });
}

function formatTanggalIndo(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getTodayISO() {
    return new Date().toISOString().split('T')[0];
}

function getBadgeTahapan(tahapan) {
    const map = {
        'Antri Potong': 'bg-secondary',
        'Cutting': 'bg-info text-dark',
        'Sablon/Bordir': 'bg-warning text-dark',
        'Sewing': 'bg-primary',
        'Kancing': 'bg-primary bg-opacity-75',
        'QC & Trimming': 'bg-dark',
        'Steam & Packing': 'bg-info text-dark',
        'Selesai': 'bg-success'
    };
    const cls = map[tahapan] || 'bg-secondary';
    return `<span class="badge ${cls}">${tahapan}</span>`;
}

/**
 * Helper aman untuk merender ulang DataTables (dilengkapi tombol Export Excel & PDF)
 */
function renderDataTable(tableId, rowsHtml) {
    if (AppState.dataTables[tableId]) {
        AppState.dataTables[tableId].destroy();
    }
    const tbody = document.querySelector(`#${tableId} tbody`);
    if (tbody) {
        tbody.innerHTML = rowsHtml;
    }
    AppState.dataTables[tableId] = $(`#${tableId}`).DataTable({
        responsive: false,
        pageLength: 10,
        order: [],
        dom: '<"d-flex flex-wrap justify-content-between align-items-center mb-2 gap-2"Bf>rt<"d-flex flex-wrap justify-content-between align-items-center mt-2"ip>',
        buttons: [
            { extend: 'excelHtml5', className: 'btn btn-sm btn-outline-success', text: '<i class="fa-solid fa-file-excel me-1"></i>Excel' },
            { extend: 'pdfHtml5', className: 'btn btn-sm btn-outline-danger', text: '<i class="fa-solid fa-file-pdf me-1"></i>PDF' },
            { extend: 'print', className: 'btn btn-sm btn-outline-secondary', text: '<i class="fa-solid fa-print me-1"></i>Print Tabel' }
        ],
        language: {
            search: 'Cari:',
            lengthMenu: 'Tampilkan _MENU_ baris',
            info: 'Menampilkan _START_ - _END_ dari _TOTAL_ data',
            infoEmpty: 'Tidak ada data',
            zeroRecords: 'Data tidak ditemukan',
            paginate: { first: 'Awal', last: 'Akhir', next: '&raquo;', previous: '&laquo;' }
        }
    });
}

// ============================================================================
// KOMPRESI GAMBAR CLIENT-SIDE (HTML5 CANVAS MAKS 1000PX, JPEG 70%) & STORAGE
// ============================================================================

/**
 * Mengompresi file gambar secara otomatis di browser menggunakan HTML5 Canvas
 * Maksimal lebar/tinggi 1000px dengan kualitas kompresi JPEG 0.7 (70%)
 */
function compressImageFile(file, maxDimension = 1000, quality = 0.7) {
    return new Promise((resolve, reject) => {
        if (!file || !file.type.startsWith('image/')) {
            return reject(new Error('File yang dipilih bukan gambar yang valid.'));
        }
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width > maxDimension || height > maxDimension) {
                    if (width > height) {
                        height = Math.round((height * maxDimension) / width);
                        width = maxDimension;
                    } else {
                        width = Math.round((width * maxDimension) / height);
                        height = maxDimension;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => {
                        if (!blob) return reject(new Error('Gagal mengompresi gambar.'));
                        const compressedFile = new File([blob], `mockup_${Date.now()}.jpg`, {
                            type: 'image/jpeg',
                            lastModified: Date.now()
                        });
                        resolve({
                            file: compressedFile,
                            width,
                            height,
                            originalSizeKB: (file.size / 1024).toFixed(1),
                            compressedSizeKB: (compressedFile.size / 1024).toFixed(1)
                        });
                    },
                    'image/jpeg',
                    quality
                );
            };
            img.onerror = () => reject(new Error('Gagal memuat gambar untuk kompresi.'));
        };
        reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    });
}

/**
 * Mengunggah gambar yang sudah dikompresi ke Supabase Storage bucket `konveksi-assets`
 */
async function uploadMockupToStorage(file, kodeSpk = 'SPK') {
    const hasilKompresi = await compressImageFile(file, 1000, 0.7);
    const cleanCode = kodeSpk.replace(/[^a-zA-Z0-9-_]/g, '_');
    const filePath = `mockups/${cleanCode}_${Date.now()}.jpg`;

    const { error: uploadError } = await db.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, hasilKompresi.file, {
            cacheControl: '3600',
            upsert: true,
            contentType: 'image/jpeg'
        });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = db.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(filePath);

    return {
        publicUrl: publicUrlData.publicUrl,
        meta: hasilKompresi
    };
}

// ============================================================================
// NAVIGASI SPA & SINKRONISASI DATA UTAMA
// ============================================================================

function navigateToSection(targetId) {
    document.querySelectorAll('.spa-section').forEach((sec) => sec.classList.add('d-none'));
    const targetEl = document.getElementById(targetId);
    if (targetEl) targetEl.classList.remove('d-none');

    document.querySelectorAll('.nav-module-link').forEach((link) => {
        link.classList.toggle('active', link.getAttribute('data-target') === targetId);
    });

    const headerMap = {
        'sec-dashboard': ['Dashboard Eksekutif', 'Pantauan real-time SPK, deadline produksi, piutang klien, dan upah tukang'],
        'sec-hulu': ['Modul Hulu: Pesanan Klien & Generator SPK', 'Kelola invoice pesanan induk, breakdown ukuran kelas/pondok, dan kalkulator BOM'],
        'sec-tengah': ['Modul Tengah: Lantai Produksi (WIP) & Makloon', 'Validasi hasil potong riil (Cutting) dan distribusi kuota pengerjaan ke tukang/vendor'],
        'sec-hilir': ['Modul Hilir: Quality Control (QC), Packing & Surat Jalan', 'Input hasil lolos QC vs reject per penjahit dan cetak Packing List / Surat Jalan'],
        'sec-payroll': ['Modul Penggajian Borongan (Piece-Rate Payroll)', 'Rekapitulasi upah tukang mingguan dan integrasi pengeluaran kas otomatis'],
        'sec-master-keuangan': ['Modul Gudang Bahan, Master Data & Kas Keuangan', 'Inventaris kain & aksesoris, matriks tarif 7 lini produk, SDM, dan arus kas']
    };

    if (headerMap[targetId]) {
        document.getElementById('pageHeaderTitle').textContent = headerMap[targetId][0];
        document.getElementById('pageHeaderSubtitle').textContent = headerMap[targetId][1];
    }

    document.getElementById('sidebarNav').classList.remove('show');
}

/**
 * Mengambil seluruh data tabel dari Supabase sekaligus dan merender semua modul
 */
async function refreshAllData() {
    showLoader('Menyinkronkan data dari Supabase...');
    const badge = document.getElementById('dbConnectionBadge');
    try {
        const [
            resBahan,
            resProduk,
            resPekerja,
            resPesanan,
            resSpk,
            resRincian,
            resLogUpah,
            resKeuangan
        ] = await Promise.all([
            db.from('master_bahan').select('*').order('kode_bahan', { ascending: true }),
            db.from('master_produk_tarif').select('*').order('kategori_produk', { ascending: true }),
            db.from('master_pekerja_vendor').select('*').order('nama', { ascending: true }),
            db.from('pesanan_induk').select('*').order('created_at', { ascending: false }),
            db.from('spk_item').select('*').order('created_at', { ascending: false }),
            db.from('spk_rincian_ukuran').select('*').order('id', { ascending: true }),
            db.from('log_produksi_upah').select('*').order('created_at', { ascending: false }),
            db.from('transaksi_keuangan').select('*').order('tanggal', { ascending: false })
        ]);

        const firstError = resBahan.error || resProduk.error || resPekerja.error || resPesanan.error || resSpk.error || resRincian.error || resLogUpah.error || resKeuangan.error;
        if (firstError) throw firstError;

        AppState.bahan = resBahan.data || [];
        AppState.produk = resProduk.data || [];
        AppState.pekerja = resPekerja.data || [];
        AppState.pesanan = resPesanan.data || [];
        AppState.spk = resSpk.data || [];
        AppState.rincianUkuran = resRincian.data || [];
        AppState.logUpah = resLogUpah.data || [];
        AppState.keuangan = resKeuangan.data || [];

        badge.className = 'badge bg-success w-100 py-2';
        badge.innerHTML = '<i class="fa-solid fa-check-circle me-1"></i> Terhubung ke Supabase';

        // Render Modul Tahap 2 (Dashboard & Master Data)
        renderDashboard();
        renderTableMasterBahan();
        renderTableMasterProduk();
        renderTableMasterPekerja();
        populateMasterDropdowns();

        // Render Modul Tahap 3 & 4 (apabila fungsi sudah dimuat)
        if (typeof renderModulHulu === 'function') renderModulHulu();
        if (typeof renderModulTengah === 'function') renderModulTengah();
        if (typeof renderModulHilir === 'function') renderModulHilir();
        if (typeof renderTablePayroll === 'function') renderTablePayroll();
        if (typeof renderTableTransaksiKeuangan === 'function') renderTableTransaksiKeuangan();
    } catch (err) {
        console.error('Supabase Sync Error:', err);
        badge.className = 'badge bg-danger w-100 py-2';
        badge.innerHTML = '<i class="fa-solid fa-triangle-exclamation me-1"></i> Koneksi Gagal';
        Swal.fire('Gagal Memuat Data', err.message || 'Periksa konfigurasi SUPABASE_URL dan SUPABASE_ANON_KEY di app.js', 'error');
    } finally {
        hideLoader();
    }
}

function populateMasterDropdowns() {
    // Dropdown Bahan di Modal SPK & Modal Mutasi Stok
    const optBahan = AppState.bahan.map(b =>
        `<option value="${b.id}">${b.kode_bahan} - ${b.nama_bahan} (Stok: ${formatAngka(b.stok_saat_ini)} ${b.satuan})</option>`
    ).join('');
    document.getElementById('spkBahanId').innerHTML = `<option value="">-- Pilih Bahan Utama --</option>` + optBahan;
    document.getElementById('mutasiBahanId').innerHTML = `<option value="">-- Pilih Bahan / Aksesoris --</option>` + optBahan;

    // Dropdown Produk di Modal SPK
    const optProduk = AppState.produk.map(p =>
        `<option value="${p.id}">[${p.kategori_produk}] ${p.nama_varian} (${p.estimasi_konsumsi_kain} ${p.satuan_kain}/pcs)</option>`
    ).join('');
    document.getElementById('spkProdukId').innerHTML = `<option value="">-- Pilih Varian Produk --</option>` + optProduk;

    // Dropdown Pekerja Aktif di Modal Distribusi & Filter Payroll
    const pekerjaAktif = AppState.pekerja.filter(p => p.status_aktif);
    document.getElementById('distPekerjaId').innerHTML = `<option value="">-- Pilih Tukang / Vendor --</option>` +
        pekerjaAktif.map(p => `<option value="${p.id}">${p.nama} (${p.spesialisasi} - ${p.tipe})</option>`).join('');

    document.getElementById('filterPayrollPekerja').innerHTML = `<option value="">-- Semua Pekerja & Vendor --</option>` +
        AppState.pekerja.map(p => `<option value="${p.id}">${p.nama} (${p.spesialisasi})</option>`).join('');
}

// ============================================================================
// MODUL 1: DASHBOARD EKSEKUTIF
// ============================================================================

function renderDashboard() {
    const spkAktif = AppState.spk.filter(s => s.status_tahapan !== 'Selesai');
    const totalPcsAktif = spkAktif.reduce((acc, s) => acc + (Number(s.total_qty_pesan) || 0), 0);

    // Hitung SPK Mendekati Deadline (<= H-3)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let countDeadlineNear = 0;

    spkAktif.forEach(s => {
        const pesanan = AppState.pesanan.find(p => p.id === s.pesanan_id);
        if (pesanan && pesanan.deadline_kirim) {
            const deadlineDate = new Date(pesanan.deadline_kirim);
            const diffDays = Math.ceil((deadlineDate - today) / (1000 * 60 * 60 * 24));
            if (diffDays <= 3) countDeadlineNear++;
        }
    });

    // Hitung Total Piutang Klien (Belum Lunas)
    const pesananBelumLunas = AppState.pesanan.filter(p => p.status_pembayaran !== 'Lunas');
    const totalPiutang = pesananBelumLunas.reduce((acc, p) => {
        const sisa = (Number(p.total_tagihan) || 0) - (Number(p.total_dibayar) || 0);
        return acc + (sisa > 0 ? sisa : 0);
    }, 0);

    // Hitung Estimasi Upah Tukang Belum Dibayar
    const upahBelumBayar = AppState.logUpah
        .filter(l => l.status_bayar_upah === 'Belum Dibayar')
        .reduce((acc, l) => acc + (Number(l.total_upah) || 0), 0);

    // Update KPI Cards
    document.getElementById('kpiSpkAktif').textContent = spkAktif.length;
    document.getElementById('kpiTotalPcsAktif').textContent = `${formatAngka(totalPcsAktif, 0)} Pcs sedang diproduksi`;
    document.getElementById('kpiSpkDeadline').textContent = countDeadlineNear;
    document.getElementById('kpiTotalPiutang').textContent = formatRupiah(totalPiutang);
    document.getElementById('kpiCountBelumLunas').textContent = `${pesananBelumLunas.length} Invoice belum lunas`;
    document.getElementById('kpiEstimasiUpah').textContent = formatRupiah(upahBelumBayar);

    // Render Tabel Pantauan Cepat SPK Berjalan
    const rowsHtml = AppState.spk.map(s => {
        const pesanan = AppState.pesanan.find(p => p.id === s.pesanan_id) || {};
        const produk = AppState.produk.find(pr => pr.id === s.produk_id) || {};
        const bahan = AppState.bahan.find(b => b.id === s.bahan_utama_id) || {};

        let badgeDeadline = `<span class="text-muted">${formatTanggalIndo(pesanan.deadline_kirim)}</span>`;
        if (pesanan.deadline_kirim && s.status_tahapan !== 'Selesai') {
            const diffDays = Math.ceil((new Date(pesanan.deadline_kirim) - today) / (1000 * 60 * 60 * 24));
            if (diffDays < 0) {
                badgeDeadline = `<span class="badge bg-danger">Terlambat ${Math.abs(diffDays)} Hari (${formatTanggalIndo(pesanan.deadline_kirim)})</span>`;
            } else if (diffDays <= 3) {
                badgeDeadline = `<span class="badge bg-warning text-dark">H-${diffDays} (${formatTanggalIndo(pesanan.deadline_kirim)})</span>`;
            }
        }

        return `
            <tr>
                <td class="fw-bold text-primary">${s.no_spk}</td>
                <td>
                    <div class="fw-semibold">${pesanan.instansi || '-'}</div>
                    <small class="text-muted">${pesanan.nama_klien || ''} (${pesanan.no_invoice || ''})</small>
                </td>
                <td>
                    <div class="fw-semibold">${produk.nama_varian || '-'}</div>
                    <small class="text-muted">${bahan.nama_bahan || '-'} - ${s.warna_kain} (${s.jenis_aplikasi})</small>
                </td>
                <td>${badgeDeadline}</td>
                <td>
                    <span class="fw-semibold">${s.total_qty_pesan} Pcs</span>
                    <small class="d-block text-muted">Potong: ${s.qty_hasil_potong || 0} | QC: ${s.qty_lolos_qc || 0}</small>
                </td>
                <td>${getBadgeTahapan(s.status_tahapan)}</td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" title="Update Tahapan WIP" onclick="openModalUpdateTahapan(${s.id})">
                            <i class="fa-solid fa-arrows-spin"></i>
                        </button>
                        <button class="btn btn-outline-dark" title="Cetak Lembar SPK" onclick="cetakDokumenSpk(${s.id})">
                            <i class="fa-solid fa-print"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    renderDataTable('tableDashboardSpk', rowsHtml);
}

// ============================================================================
// MODUL 6A: CRUD GUDANG BAHAN & MUTASI STOK (`master_bahan`)
// ============================================================================

function renderTableMasterBahan() {
    const rowsHtml = AppState.bahan.map(b => {
        const nilaiInventaris = (Number(b.stok_saat_ini) || 0) * (Number(b.harga_beli_terakhir) || 0);
        const stokClass = Number(b.stok_saat_ini) <= 15 ? 'text-danger fw-bold' : 'text-dark fw-semibold';
        return `
            <tr>
                <td class="fw-bold">${b.kode_bahan}</td>
                <td>${b.nama_bahan}</td>
                <td><span class="badge bg-secondary bg-opacity-10 text-dark border">${b.kategori}</span></td>
                <td class="${stokClass}">${formatAngka(b.stok_saat_ini)}</td>
                <td>${b.satuan}</td>
                <td>${formatRupiah(b.harga_beli_terakhir)}</td>
                <td class="fw-semibold text-primary">${formatRupiah(nilaiInventaris)}</td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" onclick="openModalBahan(${b.id})" title="Edit">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="hapusMasterBahan(${b.id})" title="Hapus">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    renderDataTable('tableMasterBahan', rowsHtml);
}

function openModalBahan(id = null) {
    const form = document.getElementById('formBahan');
    form.reset();
    document.getElementById('bahanId').value = '';

    if (id) {
        const item = AppState.bahan.find(b => b.id === id);
        if (!item) return;
        document.getElementById('modalBahanTitle').textContent = 'Edit Data Bahan / Aksesoris';
        document.getElementById('bahanId').value = item.id;
        document.getElementById('kodeBahan').value = item.kode_bahan;
        document.getElementById('namaBahan').value = item.nama_bahan;
        document.getElementById('kategoriBahan').value = item.kategori;
        document.getElementById('satuanBahan').value = item.satuan;
        document.getElementById('stokSaatIni').value = item.stok_saat_ini;
        document.getElementById('hargaBeliTerakhir').value = item.harga_beli_terakhir;
    } else {
        document.getElementById('modalBahanTitle').textContent = 'Tambah Bahan / Aksesoris Baru';
        const nextNum = String(AppState.bahan.length + 1).padStart(3, '0');
        document.getElementById('kodeBahan').value = `BHN-${nextNum}`;
    }

    new bootstrap.Modal(document.getElementById('modalBahan')).show();
}

async function simpanMasterBahan(e) {
    e.preventDefault();
    const id = document.getElementById('bahanId').value;
    const payload = {
        kode_bahan: document.getElementById('kodeBahan').value.trim(),
        nama_bahan: document.getElementById('namaBahan').value.trim(),
        kategori: document.getElementById('kategoriBahan').value,
        satuan: document.getElementById('satuanBahan').value,
        stok_saat_ini: Number(document.getElementById('stokSaatIni').value) || 0,
        harga_beli_terakhir: Number(document.getElementById('hargaBeliTerakhir').value) || 0
    };

    showLoader('Menyimpan data bahan...');
    try {
        let res;
        if (id) {
            res = await db.from('master_bahan').update(payload).eq('id', id);
        } else {
            res = await db.from('master_bahan').insert([payload]);
        }
        if (res.error) throw res.error;

        bootstrap.Modal.getInstance(document.getElementById('modalBahan')).hide();
        await refreshAllData();
        Swal.fire('Berhasil!', 'Data inventaris bahan berhasil disimpan.', 'success');
    } catch (err) {
        Swal.fire('Gagal Menyimpan', err.message, 'error');
    } finally {
        hideLoader();
    }
}

async function hapusMasterBahan(id) {
    const item = AppState.bahan.find(b => b.id === id);
    const konfirmasi = await Swal.fire({
        title: 'Hapus Bahan?',
        text: `Anda yakin ingin menghapus "${item ? item.nama_bahan : ''}" dari gudang?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        confirmButtonText: 'Ya, Hapus'
    });
    if (!konfirmasi.isConfirmed) return;

    showLoader('Menghapus bahan...');
    try {
        const { error } = await db.from('master_bahan').delete().eq('id', id);
        if (error) throw error;
        await refreshAllData();
        Swal.fire('Terhapus!', 'Data bahan berhasil dihapus.', 'success');
    } catch (err) {
        Swal.fire('Gagal Menghapus', 'Bahan ini mungkin sedang digunakan pada SPK aktif. Detail: ' + err.message, 'error');
    } finally {
        hideLoader();
    }
}

function openModalMutasiStok() {
    document.getElementById('formMutasiStok').reset();
    document.getElementById('wrapMutasiHarga').classList.remove('d-none');
    new bootstrap.Modal(document.getElementById('modalMutasiStok')).show();
}

async function prosesMutasiStok(e) {
    e.preventDefault();
    const bahanId = Number(document.getElementById('mutasiBahanId').value);
    const jenis = document.getElementById('mutasiJenis').value;
    const qty = Number(document.getElementById('mutasiQty').value) || 0;
    const hargaBaru = Number(document.getElementById('mutasiHargaSatuan').value) || 0;
    const catatKas = document.getElementById('mutasiCatatKas').checked;
    const ket = document.getElementById('mutasiKeterangan').value.trim();

    const bahan = AppState.bahan.find(b => b.id === bahanId);
    if (!bahan) return;

    let stokBaru = Number(bahan.stok_saat_ini) || 0;
    if (jenis === 'MASUK') {
        stokBaru += qty;
    } else {
        if (qty > stokBaru) {
            return Swal.fire('Stok Tidak Cukup!', `Stok ${bahan.nama_bahan} saat ini hanya ${stokBaru} ${bahan.satuan}.`, 'warning');
        }
        stokBaru -= qty;
    }

    const hargaPakai = hargaBaru > 0 ? hargaBaru : Number(bahan.harga_beli_terakhir);

    showLoader('Memproses mutasi stok gudang...');
    try {
        const { error: errUpdate } = await db.from('master_bahan').update({
            stok_saat_ini: stokBaru,
            harga_beli_terakhir: hargaPakai
        }).eq('id', bahanId);
        if (errUpdate) throw errUpdate;

        // Jika Stok Masuk (Pembelian) & dicentang catat ke Buku Kas
        if (jenis === 'MASUK' && catatKas) {
            const totalBelanja = qty * hargaPakai;
            if (totalBelanja > 0) {
                const { error: errKas } = await db.from('transaksi_keuangan').insert([{
                    tanggal: getTodayISO(),
                    jenis: 'Pengeluaran',
                    kategori: 'Beli Kain/Aksesoris',
                    nominal: totalBelanja,
                    referensi_id: bahanId,
                    keterangan: `Beli ${qty} ${bahan.satuan} ${bahan.nama_bahan}. ${ket}`
                }]);
                if (errKas) throw errKas;
            }
        }

        bootstrap.Modal.getInstance(document.getElementById('modalMutasiStok')).hide();
        await refreshAllData();
        Swal.fire('Mutasi Berhasil!', `Stok ${bahan.nama_bahan} kini menjadi ${formatAngka(stokBaru)} ${bahan.satuan}.`, 'success');
    } catch (err) {
        Swal.fire('Gagal Mutasi Stok', err.message, 'error');
    } finally {
        hideLoader();
    }
}

// ============================================================================
// MODUL 6B: CRUD MASTER PRODUK & MATRIKS TARIF BOM (`master_produk_tarif`)
// ============================================================================

function renderTableMasterProduk() {
    const rowsHtml = AppState.produk.map(p => {
        const totalUpahPcs =
            (Number(p.tarif_potong) || 0) +
            (Number(p.tarif_jahit) || 0) +
            (Number(p.tarif_obras_neci) || 0) +
            (Number(p.tarif_kancing) || 0) +
            (Number(p.tarif_finishing_pack) || 0);

        return `
            <tr>
                <td><span class="badge bg-primary bg-opacity-10 text-primary border border-primary">${p.kategori_produk}</span></td>
                <td class="fw-semibold">${p.nama_varian}</td>
                <td>${formatAngka(p.estimasi_konsumsi_kain, 3)} ${p.satuan_kain}/pcs</td>
                <td>${formatRupiah(p.tarif_potong)}</td>
                <td>${formatRupiah(p.tarif_jahit)}</td>
                <td>${formatRupiah(p.tarif_obras_neci)}</td>
                <td>${formatRupiah(p.tarif_kancing)}</td>
                <td>${formatRupiah(p.tarif_finishing_pack)}</td>
                <td class="fw-bold text-success">${formatRupiah(totalUpahPcs)}</td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" onclick="openModalProduk(${p.id})" title="Edit">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="hapusMasterProduk(${p.id})" title="Hapus">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    renderDataTable('tableMasterProduk', rowsHtml);
}

function openModalProduk(id = null) {
    const form = document.getElementById('formProduk');
    form.reset();
    document.getElementById('produkId').value = '';

    if (id) {
        const item = AppState.produk.find(p => p.id === id);
        if (!item) return;
        document.getElementById('modalProdukTitle').textContent = 'Edit Varian Produk & Tarif BOM';
        document.getElementById('produkId').value = item.id;
        document.getElementById('kategoriProduk').value = item.kategori_produk;
        document.getElementById('namaVarian').value = item.nama_varian;
        document.getElementById('estimasiKonsumsiKain').value = item.estimasi_konsumsi_kain;
        document.getElementById('satuanKain').value = item.satuan_kain;
        document.getElementById('tarifPotong').value = item.tarif_potong;
        document.getElementById('tarifJahit').value = item.tarif_jahit;
        document.getElementById('tarifObrasNeci').value = item.tarif_obras_neci;
        document.getElementById('tarifKancing').value = item.tarif_kancing;
        document.getElementById('tarifFinishingPack').value = item.tarif_finishing_pack;
    } else {
        document.getElementById('modalProdukTitle').textContent = 'Tambah Varian Produk & Tarif BOM';
    }

    new bootstrap.Modal(document.getElementById('modalProduk')).show();
}

async function simpanMasterProduk(e) {
    e.preventDefault();
    const id = document.getElementById('produkId').value;
    const payload = {
        kategori_produk: document.getElementById('kategoriProduk').value,
        nama_varian: document.getElementById('namaVarian').value.trim(),
        estimasi_konsumsi_kain: Number(document.getElementById('estimasiKonsumsiKain').value) || 0,
        satuan_kain: document.getElementById('satuanKain').value,
        tarif_potong: Number(document.getElementById('tarifPotong').value) || 0,
        tarif_jahit: Number(document.getElementById('tarifJahit').value) || 0,
        tarif_obras_neci: Number(document.getElementById('tarifObrasNeci').value) || 0,
        tarif_kancing: Number(document.getElementById('tarifKancing').value) || 0,
        tarif_finishing_pack: Number(document.getElementById('tarifFinishingPack').value) || 0
    };

    showLoader('Menyimpan produk & matriks tarif...');
    try {
        let res;
        if (id) {
            res = await db.from('master_produk_tarif').update(payload).eq('id', id);
        } else {
            res = await db.from('master_produk_tarif').insert([payload]);
        }
        if (res.error) throw res.error;

        bootstrap.Modal.getInstance(document.getElementById('modalProduk')).hide();
        await refreshAllData();
        Swal.fire('Berhasil!', 'Master produk dan tarif borongan berhasil disimpan.', 'success');
    } catch (err) {
        Swal.fire('Gagal Menyimpan', err.message, 'error');
    } finally {
        hideLoader();
    }
}

async function hapusMasterProduk(id) {
    const item = AppState.produk.find(p => p.id === id);
    const konfirmasi = await Swal.fire({
        title: 'Hapus Varian Produk?',
        text: `Hapus "${item ? item.nama_varian : ''}" dari daftar produk?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        confirmButtonText: 'Ya, Hapus'
    });
    if (!konfirmasi.isConfirmed) return;

    showLoader('Menghapus produk...');
    try {
        const { error } = await db.from('master_produk_tarif').delete().eq('id', id);
        if (error) throw error;
        await refreshAllData();
        Swal.fire('Terhapus!', 'Varian produk berhasil dihapus.', 'success');
    } catch (err) {
        Swal.fire('Gagal Menghapus', err.message, 'error');
    } finally {
        hideLoader();
    }
}

// ============================================================================
// MODUL 6C: CRUD MASTER PEKERJA & VENDOR MAKLOON (`master_pekerja_vendor`)
// ============================================================================

function renderTableMasterPekerja() {
    const rowsHtml = AppState.pekerja.map(p => {
        const badgeTipe = p.tipe === 'Tukang Internal'
            ? '<span class="badge bg-info text-dark">Tukang Internal</span>'
            : '<span class="badge bg-warning text-dark">Vendor Makloon</span>';
        const badgeStatus = p.status_aktif
            ? '<span class="badge bg-success">Aktif</span>'
            : '<span class="badge bg-secondary">Non-Aktif</span>';
        const waClean = (p.no_wa || '').replace(/^0/, '62').replace(/\D/g, '');
        const waLink = waClean
            ? `<a href="https://wa.me/${waClean}" target="_blank" class="text-decoration-none text-success fw-semibold"><i class="fa-brands fa-whatsapp me-1"></i>${p.no_wa}</a>`
            : '-';

        return `
            <tr>
                <td class="fw-bold">${p.nama}</td>
                <td>${badgeTipe}</td>
                <td><span class="fw-semibold">${p.spesialisasi}</span></td>
                <td>${waLink}</td>
                <td>${badgeStatus}</td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" onclick="openModalPekerja(${p.id})" title="Edit">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="hapusMasterPekerja(${p.id})" title="Hapus">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    renderDataTable('tableMasterPekerja', rowsHtml);
}

function openModalPekerja(id = null) {
    const form = document.getElementById('formPekerja');
    form.reset();
    document.getElementById('pekerjaId').value = '';

    if (id) {
        const item = AppState.pekerja.find(p => p.id === id);
        if (!item) return;
        document.getElementById('modalPekerjaTitle').textContent = 'Edit Data Tukang / Vendor';
        document.getElementById('pekerjaId').value = item.id;
        document.getElementById('namaPekerja').value = item.nama;
        document.getElementById('tipePekerja').value = item.tipe;
        document.getElementById('spesialisasiPekerja').value = item.spesialisasi;
        document.getElementById('noWaPekerja').value = item.no_wa || '';
        document.getElementById('statusAktifPekerja').value = String(item.status_aktif);
    } else {
        document.getElementById('modalPekerjaTitle').textContent = 'Tambah Tukang / Vendor Baru';
        document.getElementById('statusAktifPekerja').value = 'true';
    }

    new bootstrap.Modal(document.getElementById('modalPekerja')).show();
}

async function simpanMasterPekerja(e) {
    e.preventDefault();
    const id = document.getElementById('pekerjaId').value;
    const payload = {
        nama: document.getElementById('namaPekerja').value.trim(),
        tipe: document.getElementById('tipePekerja').value,
        spesialisasi: document.getElementById('spesialisasiPekerja').value,
        no_wa: document.getElementById('noWaPekerja').value.trim(),
        status_aktif: document.getElementById('statusAktifPekerja').value === 'true'
    };

    showLoader('Menyimpan data pekerja/vendor...');
    try {
        let res;
        if (id) {
            res = await db.from('master_pekerja_vendor').update(payload).eq('id', id);
        } else {
            res = await db.from('master_pekerja_vendor').insert([payload]);
        }
        if (res.error) throw res.error;

        bootstrap.Modal.getInstance(document.getElementById('modalPekerja')).hide();
        await refreshAllData();
        Swal.fire('Berhasil!', 'Data pekerja/vendor berhasil disimpan.', 'success');
    } catch (err) {
        Swal.fire('Gagal Menyimpan', err.message, 'error');
    } finally {
        hideLoader();
    }
}

async function hapusMasterPekerja(id) {
    const item = AppState.pekerja.find(p => p.id === id);
    const konfirmasi = await Swal.fire({
        title: 'Hapus Pekerja/Vendor?',
        text: `Hapus "${item ? item.nama : ''}" dari sistem?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        confirmButtonText: 'Ya, Hapus'
    });
    if (!konfirmasi.isConfirmed) return;

    showLoader('Menghapus pekerja...');
    try {
        const { error } = await db.from('master_pekerja_vendor').delete().eq('id', id);
        if (error) throw error;
        await refreshAllData();
        Swal.fire('Terhapus!', 'Data pekerja/vendor berhasil dihapus.', 'success');
    } catch (err) {
        Swal.fire('Gagal Menghapus', 'Pekerja ini memiliki riwayat produksi aktif. Nonaktifkan statusnya jika tidak lagi bekerja.', 'error');
    } finally {
        hideLoader();
    }
}

// ============================================================================
// EVENT LISTENERS INITIALIZATION (BAGIAN 1)
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Sidebar navigation handler
    document.querySelectorAll('.nav-module-link').forEach((link) => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = link.getAttribute('data-target');
            navigateToSection(target);
        });
    });

    // Responsive sidebar toggle
    document.getElementById('btnToggleSidebar').addEventListener('click', () => {
        document.getElementById('sidebarNav').classList.add('show');
    });
    document.getElementById('btnCloseSidebar').addEventListener('click', () => {
        document.getElementById('sidebarNav').classList.remove('show');
    });

    // Toggle input harga pada Modal Mutasi Stok
    document.getElementById('mutasiJenis').addEventListener('change', (e) => {
        const wrap = document.getElementById('wrapMutasiHarga');
        if (e.target.value === 'MASUK') {
            wrap.classList.remove('d-none');
        } else {
            wrap.classList.add('d-none');
        }
    });

    // Preview & info kompresi otomatis saat user memilih gambar mockup SPK
    document.getElementById('spkFileMockup').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const hasil = await compressImageFile(file, 1000, 0.7);
            document.getElementById('previewMockupImg').src = URL.createObjectURL(hasil.file);
            document.getElementById('infoKompresiMockup').innerHTML =
                `<span class="text-success fw-semibold"><i class="fa-solid fa-check me-1"></i>Siap unggah: ${hasil.width}x${hasil.height}px (${hasil.originalSizeKB} KB &rarr; ${hasil.compressedSizeKB} KB)</span>`;
        } catch (err) {
            Swal.fire('File Gambar Tidak Valid', err.message, 'warning');
        }
    });

    // Bind form submit untuk Master Data & Mutasi Gudang
    document.getElementById('formBahan').addEventListener('submit', simpanMasterBahan);
    document.getElementById('formMutasiStok').addEventListener('submit', prosesMutasiStok);
    document.getElementById('formProduk').addEventListener('submit', simpanMasterProduk);
    document.getElementById('formPekerja').addEventListener('submit', simpanMasterPekerja);

    // Load data awal dari Supabase
    refreshAllData();
});
