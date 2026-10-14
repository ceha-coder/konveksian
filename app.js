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

/**
 * ============================================================================
 * SISTEM MANAJEMEN OPERASIONAL KONVEKSI HULU KE HILIR (MTO)
 * FILE: app.js (BAGIAN 2: Modul Hulu, WIP/Makloon, QC/Packing & Cetak Dokumen)
 * Tempelkan kode ini tepat di bawah kode app.js Bagian 1
 * ============================================================================
 */

// ============================================================================
// MODUL 2: HULU - PESANAN INDUK KLIEN & GENERATOR SPK
// ============================================================================

function renderModulHulu() {
    renderTablePesananInduk();
    renderTableSpkHulu();
    populatePesananDropdown();
}

function populatePesananDropdown() {
    const selectEl = document.getElementById('spkPesananId');
    if (!selectEl) return;
    const opts = AppState.pesanan.map(p =>
        `<option value="${p.id}">${p.no_invoice} - ${p.instansi || p.nama_klien} (Deadline: ${formatTanggalIndo(p.deadline_kirim)})</option>`
    ).join('');
    selectEl.innerHTML = `<option value="">-- Pilih Invoice Pesanan Induk --</option>` + opts;
}

function renderTablePesananInduk() {
    const rowsHtml = AppState.pesanan.map(p => {
        const tagihan = Number(p.total_tagihan) || 0;
        const dibayar = Number(p.total_dibayar) || 0;
        const sisaPiutang = Math.max(0, tagihan - dibayar);

        const mapBayarBadge = {
            'Belum DP': 'bg-danger',
            'DP Masuk': 'bg-warning text-dark',
            'Lunas': 'bg-success'
        };
        const mapOrderBadge = {
            'Draft': 'bg-secondary',
            'Produksi': 'bg-primary',
            'Selesai': 'bg-info text-dark',
            'Dikirim': 'bg-success'
        };

        const jumlahSpk = AppState.spk.filter(s => s.pesanan_id === p.id).length;
        const waClean = (p.no_wa_klien || '').replace(/^0/, '62').replace(/\D/g, '');

        return `
            <tr>
                <td>
                    <div class="fw-bold text-primary">${p.no_invoice}</div>
                    <small class="badge bg-light text-dark border">${jumlahSpk} Item SPK</small>
                </td>
                <td>
                    <div class="fw-semibold">${p.instansi || '-'}</div>
                    <small class="text-muted">${p.nama_klien} ${waClean ? `| <a href="https://wa.me/${waClean}" target="_blank" class="text-success text-decoration-none"><i class="fa-brands fa-whatsapp"></i> ${p.no_wa_klien}</a>` : ''}</small>
                </td>
                <td>
                    <div class="small">Pesan: ${formatTanggalIndo(p.tanggal_pesan)}</div>
                    <div class="small fw-semibold text-danger">Kirim: ${formatTanggalIndo(p.deadline_kirim)}</div>
                </td>
                <td class="fw-semibold">${formatRupiah(tagihan)}</td>
                <td class="text-success fw-semibold">${formatRupiah(dibayar)}</td>
                <td class="${sisaPiutang > 0 ? 'text-danger fw-bold' : 'text-muted'}">${formatRupiah(sisaPiutang)}</td>
                <td><span class="badge ${mapBayarBadge[p.status_pembayaran] || 'bg-secondary'}">${p.status_pembayaran}</span></td>
                <td><span class="badge ${mapOrderBadge[p.status_order] || 'bg-secondary'}">${p.status_order}</span></td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-success" title="Buat SPK untuk Pesanan Ini" onclick="openModalSpk(null, ${p.id})">
                            <i class="fa-solid fa-file-circle-plus"></i>
                        </button>
                        <button class="btn btn-outline-primary" title="Edit Pesanan / Update Pembayaran" onclick="openModalPesanan(${p.id})">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="btn btn-outline-danger" title="Hapus Pesanan" onclick="hapusPesananInduk(${p.id})">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    renderDataTable('tablePesananInduk', rowsHtml);
}

function openModalPesanan(id = null) {
    const form = document.getElementById('formPesanan');
    form.reset();
    document.getElementById('pesananId').value = '';
    document.getElementById('pesananDibayarLama').value = '0';
    document.getElementById('catatKasOtomatis').checked = true;

    if (id) {
        const p = AppState.pesanan.find(item => item.id === id);
        if (!p) return;
        document.getElementById('modalPesananTitle').textContent = `Edit Pesanan Induk (${p.no_invoice})`;
        document.getElementById('pesananId').value = p.id;
        document.getElementById('pesananDibayarLama').value = p.total_dibayar || 0;
        document.getElementById('noInvoice').value = p.no_invoice;
        document.getElementById('namaKlien').value = p.nama_klien;
        document.getElementById('instansiKlien').value = p.instansi || '';
        document.getElementById('noWaKlien').value = p.no_wa_klien || '';
        document.getElementById('tanggalPesan').value = p.tanggal_pesan;
        document.getElementById('deadlineKirim').value = p.deadline_kirim;
        document.getElementById('totalTagihan').value = p.total_tagihan;
        document.getElementById('totalDibayar').value = p.total_dibayar;
        document.getElementById('statusOrder').value = p.status_order;
    } else {
        document.getElementById('modalPesananTitle').textContent = 'Tambah Pesanan Induk Klien Baru';
        const today = getTodayISO();
        const nextIdx = String(AppState.pesanan.length + 1).padStart(3, '0');
        const ym = today.slice(0, 7).replace('-', '');
        document.getElementById('noInvoice').value = `INV-${ym}-${nextIdx}`;
        document.getElementById('tanggalPesan').value = today;

        const nextTwoWeeks = new Date();
        nextTwoWeeks.setDate(nextTwoWeeks.getDate() + 14);
        document.getElementById('deadlineKirim').value = nextTwoWeeks.toISOString().split('T')[0];
        document.getElementById('statusOrder').value = 'Produksi';
    }

    new bootstrap.Modal(document.getElementById('modalPesanan')).show();
}

async function simpanPesananInduk(e) {
    e.preventDefault();
    const id = document.getElementById('pesananId').value;
    const dibayarLama = Number(document.getElementById('pesananDibayarLama').value) || 0;
    const totalTagihan = Number(document.getElementById('totalTagihan').value) || 0;
    const totalDibayar = Number(document.getElementById('totalDibayar').value) || 0;
    const catatKas = document.getElementById('catatKasOtomatis').checked;

    let statusPembayaran = 'Belum DP';
    if (totalDibayar > 0 && totalDibayar < totalTagihan) {
        statusPembayaran = 'DP Masuk';
    } else if (totalDibayar >= totalTagihan && totalTagihan > 0) {
        statusPembayaran = 'Lunas';
    }

    const payload = {
        no_invoice: document.getElementById('noInvoice').value.trim(),
        nama_klien: document.getElementById('namaKlien').value.trim(),
        instansi: document.getElementById('instansiKlien').value.trim(),
        no_wa_klien: document.getElementById('noWaKlien').value.trim(),
        tanggal_pesan: document.getElementById('tanggalPesan').value,
        deadline_kirim: document.getElementById('deadlineKirim').value,
        total_tagihan: totalTagihan,
        total_dibayar: totalDibayar,
        status_pembayaran: statusPembayaran,
        status_order: document.getElementById('statusOrder').value
    };

    showLoader('Menyimpan pesanan klien...');
    try {
        let savedOrderId = id ? Number(id) : null;
        if (id) {
            const { error } = await db.from('pesanan_induk').update(payload).eq('id', id);
            if (error) throw error;
        } else {
            const { data, error } = await db.from('pesanan_induk').insert([payload]).select().single();
            if (error) throw error;
            savedOrderId = data.id;
        }

        // Jika terdapat penambahan pembayaran DP/Pelunasan & checkbox aktif, catat ke transaksi_keuangan
        const selisihBayar = totalDibayar - dibayarLama;
        if (catatKas && selisihBayar > 0) {
            const kategoriKas = statusPembayaran === 'Lunas' ? 'Pelunasan Klien' : 'DP Klien';
            const { error: errKas } = await db.from('transaksi_keuangan').insert([{
                tanggal: getTodayISO(),
                jenis: 'Pemasukan',
                kategori: kategoriKas,
                nominal: selisihBayar,
                referensi_id: savedOrderId,
                keterangan: `${kategoriKas} Invoice ${payload.no_invoice} - ${payload.instansi || payload.nama_klien}`
            }]);
            if (errKas) throw errKas;
        }

        bootstrap.Modal.getInstance(document.getElementById('modalPesanan')).hide();
        await refreshAllData();
        Swal.fire('Berhasil!', 'Data pesanan klien berhasil disimpan.', 'success');
    } catch (err) {
        Swal.fire('Gagal Menyimpan Pesanan', err.message, 'error');
    } finally {
        hideLoader();
    }
}

async function hapusPesananInduk(id) {
    const pesanan = AppState.pesanan.find(p => p.id === id);
    const konfirmasi = await Swal.fire({
        title: 'Hapus Pesanan Induk?',
        text: `Menghapus "${pesanan ? pesanan.no_invoice : ''}" juga akan menghapus seluruh SPK di bawahnya.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        confirmButtonText: 'Ya, Hapus Semua'
    });
    if (!konfirmasi.isConfirmed) return;

    showLoader('Menghapus pesanan...');
    try {
        const { error } = await db.from('pesanan_induk').delete().eq('id', id);
        if (error) throw error;
        await refreshAllData();
        Swal.fire('Terhapus!', 'Pesanan induk berhasil dihapus.', 'success');
    } catch (err) {
        Swal.fire('Gagal Menghapus', err.message, 'error');
    } finally {
        hideLoader();
    }
}

// ============================================================================
// GENERATOR SPK, BUILDER RINCIAN UKURAN & KALKULATOR BOM OTOMATIS
// ============================================================================

function renderTableSpkHulu() {
    const rowsHtml = AppState.spk.map(s => {
        const pesanan = AppState.pesanan.find(p => p.id === s.pesanan_id) || {};
        const produk = AppState.produk.find(pr => pr.id === s.produk_id) || {};
        const bahan = AppState.bahan.find(b => b.id === s.bahan_utama_id) || {};

        const qtyPesan = Number(s.total_qty_pesan) || 0;
        const estKonsumsi = Number(produk.estimasi_konsumsi_kain) || 0;
        const totalKebutuhanKain = qtyPesan * estKonsumsi;

        const imgThumb = s.url_mockup
            ? `<img src="${s.url_mockup}" class="spk-thumb" alt="Mockup" onclick="Swal.fire({imageUrl: '${s.url_mockup}', imageAlt: '${s.no_spk}', showConfirmButton: false})">`
            : `<div class="spk-thumb d-flex align-items-center justify-content-center bg-light text-muted small"><i class="fa-regular fa-image"></i></div>`;

        return `
            <tr>
                <td>${imgThumb}</td>
                <td>
                    <div class="fw-bold text-primary">${s.no_spk}</div>
                    <small class="text-muted">${pesanan.no_invoice || '-'} (${pesanan.instansi || pesanan.nama_klien || '-'})</small>
                </td>
                <td>
                    <div class="fw-semibold">${produk.nama_varian || '-'}</div>
                    <span class="badge bg-light text-dark border">${produk.kategori_produk || ''}</span>
                    <span class="badge bg-info bg-opacity-10 text-dark border">${s.jenis_aplikasi}</span>
                </td>
                <td>
                    <div class="fw-semibold">${bahan.nama_bahan || '-'}</div>
                    <small class="text-muted">Warna: ${s.warna_kain}</small>
                </td>
                <td class="fw-bold">${formatAngka(qtyPesan, 0)} Pcs</td>
                <td>
                    <span class="fw-semibold text-primary">${formatAngka(totalKebutuhanKain, 2)} ${produk.satuan_kain || ''}</span>
                    <small class="d-block text-muted">(@ ${estKonsumsi} ${produk.satuan_kain || ''}/pcs)</small>
                </td>
                <td>${getBadgeTahapan(s.status_tahapan)}</td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-dark" title="Cetak Lembar SPK Produksi" onclick="cetakDokumenSpk(${s.id})">
                            <i class="fa-solid fa-print"></i>
                        </button>
                        <button class="btn btn-outline-primary" title="Edit SPK & Rincian Ukuran" onclick="openModalSpk(${s.id})">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="btn btn-outline-danger" title="Hapus SPK" onclick="hapusSpk(${s.id})">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    renderDataTable('tableSpkHulu', rowsHtml);
}

/**
 * Menambahkan baris input dinamis pada tabel Rincian Ukuran di dalam Modal SPK
 */
function tambahBarisUkuran(data = {}) {
    const tbody = document.getElementById('tbodyRincianUkuran');
    const tr = document.createElement('tr');
    tr.className = 'baris-rincian-ukuran';

    const ukuranVal = data.label_ukuran || 'L';
    const genderVal = data.kategori_gender || 'Unisex';
    const grupVal = data.keterangan_grup || '';
    const qtyVal = data.qty_pesan !== undefined ? data.qty_pesan : 12;
    const potRiilVal = data.qty_potong_riil || 0;
    const selesaiVal = data.qty_selesai || 0;

    tr.innerHTML = `
        <td>
            <input type="text" class="form-control form-control-sm inp-ukuran fw-bold" list="listStandarUkuran" value="${ukuranVal}" placeholder="S/M/L/XL/No" required>
            <datalist id="listStandarUkuran">
                <option value="S"><option value="M"><option value="L"><option value="XL"><option value="XXL"><option value="3XL">
                <option value="No. 6"><option value="No. 8"><option value="No. 10"><option value="No. 12"><option value="No. 14"><option value="All Size">
            </datalist>
        </td>
        <td>
            <select class="form-select form-select-sm inp-gender">
                <option value="Unisex" ${genderVal === 'Unisex' ? 'selected' : ''}>Unisex</option>
                <option value="Putra" ${genderVal === 'Putra' ? 'selected' : ''}>Putra</option>
                <option value="Putri" ${genderVal === 'Putri' ? 'selected' : ''}>Putri</option>
            </select>
        </td>
        <td>
            <input type="text" class="form-control form-control-sm inp-grup" value="${grupVal}" placeholder="Contoh: Kelas 7A / Kamar Al-Faruq">
        </td>
        <td>
            <input type="number" min="1" class="form-control form-control-sm inp-qty-pesan fw-bold text-end" value="${qtyVal}" oninput="hitungKalkulatorBOM()" required>
            <input type="hidden" class="inp-qty-potong-hidden" value="${potRiilVal}">
            <input type="hidden" class="inp-qty-selesai-hidden" value="${selesaiVal}">
        </td>
        <td class="text-center">
            <button type="button" class="btn btn-sm btn-outline-danger" onclick="hapusBarisUkuran(this)" title="Hapus Baris">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </td>
    `;
    tbody.appendChild(tr);
    hitungKalkulatorBOM();
}

function hapusBarisUkuran(btnEl) {
    const tbody = document.getElementById('tbodyRincianUkuran');
    if (tbody.querySelectorAll('tr').length <= 1) {
        return Swal.fire('Minimal 1 Baris Ukuran', 'SPK harus memiliki minimal 1 baris rincian ukuran.', 'info');
    }
    btnEl.closest('tr').remove();
    hitungKalkulatorBOM();
}

/**
 * Kalkulator BOM Otomatis: Menghitung total Qty dari builder ukuran,
 * mengalikan dengan estimasi konsumsi kain produk, dan membandingkan dengan stok gudang.
 */
function hitungKalkulatorBOM() {
    const qtyInputs = document.querySelectorAll('#tbodyRincianUkuran .inp-qty-pesan');
    let totalQty = 0;
    qtyInputs.forEach(inp => {
        totalQty += Number(inp.value) || 0;
    });

    document.getElementById('displayTotalQtyPesan').textContent = `${formatAngka(totalQty, 0)} Pcs`;

    const produkId = Number(document.getElementById('spkProdukId').value);
    const bahanId = Number(document.getElementById('spkBahanId').value);

    const produk = AppState.produk.find(p => p.id === produkId);
    const bahan = AppState.bahan.find(b => b.id === bahanId);

    const badgeEl = document.getElementById('bomStatusCukup');
    const estEl = document.getElementById('bomEstimasiKain');
    const stokEl = document.getElementById('bomStokGudang');

    if (!produk || !bahan) {
        estEl.textContent = '0';
        stokEl.textContent = bahan ? `${formatAngka(bahan.stok_saat_ini)} ${bahan.satuan}` : '0';
        badgeEl.className = 'badge bg-secondary';
        badgeEl.textContent = 'Pilih produk & bahan';
        return { totalQty, estimasiKebutuhan: 0, stokCukup: false };
    }

    const estimasiKebutuhan = totalQty * (Number(produk.estimasi_konsumsi_kain) || 0);
    const stokTersedia = Number(bahan.stok_saat_ini) || 0;

    estEl.textContent = `${formatAngka(estimasiKebutuhan, 2)} ${produk.satuan_kain}`;
    stokEl.textContent = `${formatAngka(stokTersedia, 2)} ${bahan.satuan}`;

    if (stokTersedia >= estimasiKebutuhan) {
        badgeEl.className = 'badge bg-success';
        badgeEl.innerHTML = `<i class="fa-solid fa-check me-1"></i>Stok Gudang Cukup`;
    } else {
        const kurang = estimasiKebutuhan - stokTersedia;
        badgeEl.className = 'badge bg-danger';
        badgeEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation me-1"></i>Stok Kurang ${formatAngka(kurang, 2)} ${produk.satuan_kain}`;
    }

    return { totalQty, estimasiKebutuhan, stokCukup: stokTersedia >= estimasiKebutuhan };
}

function openModalSpk(spkId = null, defaultPesananId = null) {
    const form = document.getElementById('formSpk');
    form.reset();
    document.getElementById('spkId').value = '';
    document.getElementById('spkUrlMockup').value = '';
    document.getElementById('previewMockupImg').src = 'https://placehold.co/100x100?text=Mockup';
    document.getElementById('infoKompresiMockup').textContent = 'Otomatis dikompresi maks 1000px (JPEG 70%) sebelum diunggah ke Supabase Storage.';
    document.getElementById('tbodyRincianUkuran').innerHTML = '';
    document.getElementById('potongStokOtomatis').checked = false;

    populatePesananDropdown();
    populateMasterDropdowns();

    if (spkId) {
        const s = AppState.spk.find(item => item.id === spkId);
        if (!s) return;
        document.getElementById('modalSpkTitle').innerHTML = `<i class="fa-solid fa-scroll me-2"></i>Edit SPK (${s.no_spk})`;
        document.getElementById('spkId').value = s.id;
        document.getElementById('spkUrlMockup').value = s.url_mockup || '';
        document.getElementById('noSpk').value = s.no_spk;
        document.getElementById('spkPesananId').value = s.pesanan_id;
        document.getElementById('spkProdukId').value = s.produk_id;
        document.getElementById('spkBahanId').value = s.bahan_utama_id;
        document.getElementById('spkWarnaKain').value = s.warna_kain;
        document.getElementById('spkJenisAplikasi').value = s.jenis_aplikasi;
        document.getElementById('spkStatusTahapan').value = s.status_tahapan;
        document.getElementById('spkCatatanProduksi').value = s.catatan_produksi || '';

        if (s.url_mockup) {
            document.getElementById('previewMockupImg').src = s.url_mockup;
        }

        const rincianList = AppState.rincianUkuran.filter(r => r.spk_id === s.id);
        if (rincianList.length > 0) {
            rincianList.forEach(r => tambahBarisUkuran(r));
        } else {
            tambahBarisUkuran({ label_ukuran: 'All Size', kategori_gender: 'Unisex', qty_pesan: s.total_qty_pesan || 10 });
        }
    } else {
        document.getElementById('modalSpkTitle').innerHTML = `<i class="fa-solid fa-scroll me-2"></i>Buat Surat Perintah Kerja (SPK) Baru`;
        const nextNum = String(AppState.spk.length + 1).padStart(3, '0');
        const ym = getTodayISO().slice(2, 7).replace('-', '');
        document.getElementById('noSpk').value = `SPK-${ym}-${nextNum}`;
        if (defaultPesananId) {
            document.getElementById('spkPesananId').value = defaultPesananId;
        }
        // Default 4 baris ukuran S, M, L, XL
        ['S', 'M', 'L', 'XL'].forEach(sz => {
            tambahBarisUkuran({ label_ukuran: sz, kategori_gender: 'Unisex', keterangan_grup: '', qty_pesan: 25 });
        });
    }

    hitungKalkulatorBOM();
    new bootstrap.Modal(document.getElementById('modalSpk')).show();
}

async function simpanSpk(e) {
    e.preventDefault();
    const spkId = document.getElementById('spkId').value;
    const noSpk = document.getElementById('noSpk').value.trim();
    const pesananId = Number(document.getElementById('spkPesananId').value);
    const produkId = Number(document.getElementById('spkProdukId').value);
    const bahanId = Number(document.getElementById('spkBahanId').value);

    // Kumpulkan rincian ukuran dari builder baris dinamis
    const rowsEl = document.querySelectorAll('#tbodyRincianUkuran .baris-rincian-ukuran');
    const rincianPayload = [];
    let totalQtyPesan = 0;

    rowsEl.forEach(tr => {
        const ukuran = tr.querySelector('.inp-ukuran').value.trim();
        const gender = tr.querySelector('.inp-gender').value;
        const grup = tr.querySelector('.inp-grup').value.trim();
        const qty = Number(tr.querySelector('.inp-qty-pesan').value) || 0;
        const potRiil = Number(tr.querySelector('.inp-qty-potong-hidden').value) || 0;
        const selesai = Number(tr.querySelector('.inp-qty-selesai-hidden').value) || 0;

        if (ukuran && qty > 0) {
            totalQtyPesan += qty;
            rincianPayload.push({
                label_ukuran: ukuran,
                kategori_gender: gender,
                keterangan_grup: grup,
                qty_pesan: qty,
                qty_potong_riil: potRiil,
                qty_selesai: selesai
            });
        }
    });

    if (rincianPayload.length === 0 || totalQtyPesan <= 0) {
        return Swal.fire('Rincian Ukuran Kosong', 'Masukkan minimal satu rincian ukuran dengan Qty lebih dari 0.', 'warning');
    }

    const hasilBOM = hitungKalkulatorBOM();
    const potongStok = document.getElementById('potongStokOtomatis').checked;

    showLoader('Menyimpan SPK & mengunggah mockup...');
    try {
        let urlMockup = document.getElementById('spkUrlMockup').value;
        const fileInput = document.getElementById('spkFileMockup');
        if (fileInput.files && fileInput.files[0]) {
            const uploaded = await uploadMockupToStorage(fileInput.files[0], noSpk);
            urlMockup = uploaded.publicUrl;
        }

        const spkData = {
            pesanan_id: pesananId,
            no_spk: noSpk,
            produk_id: produkId,
            bahan_utama_id: bahanId,
            warna_kain: document.getElementById('spkWarnaKain').value.trim(),
            jenis_aplikasi: document.getElementById('spkJenisAplikasi').value,
            url_mockup: urlMockup,
            total_qty_pesan: totalQtyPesan,
            status_tahapan: document.getElementById('spkStatusTahapan').value,
            catatan_produksi: document.getElementById('spkCatatanProduksi').value.trim()
        };

        let targetSpkId = spkId ? Number(spkId) : null;
        if (spkId) {
            const { error } = await db.from('spk_item').update(spkData).eq('id', spkId);
            if (error) throw error;
            // Hapus rincian ukuran lama lalu insert ulang agar sinkron
            await db.from('spk_rincian_ukuran').delete().eq('spk_id', targetSpkId);
        } else {
            const { data, error } = await db.from('spk_item').insert([spkData]).select().single();
            if (error) throw error;
            targetSpkId = data.id;
        }

        // Insert rincian ukuran baru
        const rowsToInsert = rincianPayload.map(r => ({ ...r, spk_id: targetSpkId }));
        const { error: errRincian } = await db.from('spk_rincian_ukuran').insert(rowsToInsert);
        if (errRincian) throw errRincian;

        // Jika opsi potong stok otomatis dicentang, kurangi stok bahan utama di gudang
        if (potongStok && hasilBOM.estimasiKebutuhan > 0) {
            const bahan = AppState.bahan.find(b => b.id === bahanId);
            if (bahan) {
                const sisaStok = Math.max(0, (Number(bahan.stok_saat_ini) || 0) - hasilBOM.estimasiKebutuhan);
                await db.from('master_bahan').update({ stok_saat_ini: sisaStok }).eq('id', bahanId);
            }
        }

        bootstrap.Modal.getInstance(document.getElementById('modalSpk')).hide();
        await refreshAllData();
        Swal.fire('SPK Tersimpan!', `SPK ${noSpk} (${totalQtyPesan} Pcs) berhasil disimpan.`, 'success');
    } catch (err) {
        Swal.fire('Gagal Menyimpan SPK', err.message, 'error');
    } finally {
        hideLoader();
    }
}

async function hapusSpk(id) {
    const s = AppState.spk.find(item => item.id === id);
    const konfirmasi = await Swal.fire({
        title: 'Hapus SPK Ini?',
        text: `Menghapus SPK "${s ? s.no_spk : ''}" juga akan menghapus rincian ukuran dan log upah terkait.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        confirmButtonText: 'Ya, Hapus'
    });
    if (!konfirmasi.isConfirmed) return;

    showLoader('Menghapus SPK...');
    try {
        const { error } = await db.from('spk_item').delete().eq('id', id);
        if (error) throw error;
        await refreshAllData();
        Swal.fire('Terhapus!', 'Data SPK berhasil dihapus.', 'success');
    } catch (err) {
        Swal.fire('Gagal Menghapus SPK', err.message, 'error');
    } finally {
        hideLoader();
    }
}

// ============================================================================
// MODUL 3: TENGAH - LANTAI PRODUKSI (WIP), VALIDASI CUTTING & DISTRIBUSI MAKLOON
// ============================================================================

function renderModulTengah() {
    renderTableWipProduksi();
    renderTableLogDistribusi();
}

function renderTableWipProduksi() {
    const rowsHtml = AppState.spk.map(s => {
        const pesanan = AppState.pesanan.find(p => p.id === s.pesanan_id) || {};
        const produk = AppState.produk.find(pr => pr.id === s.produk_id) || {};

        const qtyPotong = Number(s.qty_hasil_potong) || 0;
        const badgePotong = qtyPotong > 0
            ? `<span class="badge bg-success fs-6">${formatAngka(qtyPotong, 0)} Pcs</span>`
            : `<span class="badge bg-danger bg-opacity-10 text-danger border border-danger">Belum Input Cutting</span>`;

        // Hitung distribusi jahit sebagai indikator cepat
        const totalDiserahkanJahit = AppState.logUpah
            .filter(l => l.spk_id === s.id && l.tahapan === 'Jahit')
            .reduce((acc, l) => acc + (Number(l.qty_diserahkan) || 0), 0);

        return `
            <tr>
                <td class="fw-bold text-primary">${s.no_spk}</td>
                <td>
                    <div class="fw-semibold">${pesanan.instansi || pesanan.nama_klien || '-'}</div>
                    <small class="text-muted">${produk.nama_varian || '-'} (${s.warna_kain})</small>
                </td>
                <td><span class="badge bg-light text-dark border">${s.jenis_aplikasi}</span></td>
                <td class="fw-semibold">${formatAngka(s.total_qty_pesan, 0)} Pcs</td>
                <td>
                    ${badgePotong}
                    ${qtyPotong > 0 ? `<small class="d-block text-muted mt-1">Distribusi Jahit: ${totalDiserahkanJahit}/${qtyPotong} Pcs</small>` : ''}
                </td>
                <td>${getBadgeTahapan(s.status_tahapan)}</td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-primary" onclick="openModalUpdateTahapan(${s.id})">
                            <i class="fa-solid fa-arrows-spin me-1"></i> Update Tahapan / Cutting
                        </button>
                        <button class="btn btn-outline-success" onclick="openModalDistribusiTukang(${s.id})">
                            <i class="fa-solid fa-share-nodes me-1"></i> Bagi ke Tukang
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    renderDataTable('tableWipProduksi', rowsHtml);
}

/**
 * Membuka Modal Update Tahapan WIP & Validasi Hasil Potong (Cutting)
 */
function openModalUpdateTahapan(spkId) {
    const s = AppState.spk.find(item => item.id === spkId);
    if (!s) return;

    document.getElementById('updSpkId').value = s.id;
    document.getElementById('updNoSpkReadonly').value = s.no_spk;
    document.getElementById('updTahapanSekarang').value = s.status_tahapan;
    document.getElementById('updTahapanBaru').value = s.status_tahapan;
    document.getElementById('updQtyPesanReadonly').value = s.total_qty_pesan;
    document.getElementById('updQtyHasilPotong').value = s.qty_hasil_potong || 0;

    // Render tabel rincian ukuran untuk input hasil potong riil per size
    const rincian = AppState.rincianUkuran.filter(r => r.spk_id === s.id);
    const tbody = document.getElementById('tbodyPotongRiil');
    tbody.innerHTML = rincian.map(r => {
        const potDefault = r.qty_potong_riil > 0 ? r.qty_potong_riil : r.qty_pesan;
        const selDefault = r.qty_selesai > 0 ? r.qty_selesai : 0;
        return `
            <tr data-rincian-id="${r.id}">
                <td class="fw-semibold">${r.label_ukuran} <span class="badge bg-light text-dark border">${r.kategori_gender}</span></td>
                <td>${r.keterangan_grup || '-'}</td>
                <td>${r.qty_pesan} Pcs</td>
                <td>
                    <input type="number" min="0" class="form-control form-control-sm inp-potong-size fw-bold" value="${potDefault}" oninput="sinkronTotalPotongDariRincian()">
                </td>
                <td>
                    <input type="number" min="0" class="form-control form-control-sm inp-selesai-size" value="${selDefault}">
                </td>
            </tr>
        `;
    }).join('');

    // Jika qty_hasil_potong di SPK masih 0 tetapi ada rincian, bantu hitung otomatis
    if ((Number(s.qty_hasil_potong) || 0) === 0 && rincian.length > 0) {
        sinkronTotalPotongDariRincian();
    }

    new bootstrap.Modal(document.getElementById('modalUpdateTahapan')).show();
}

function sinkronTotalPotongDariRincian() {
    let totalPotong = 0;
    document.querySelectorAll('#tbodyPotongRiil .inp-potong-size').forEach(inp => {
        totalPotong += Number(inp.value) || 0;
    });
    document.getElementById('updQtyHasilPotong').value = totalPotong;
}

async function simpanUpdateTahapan(e) {
    e.preventDefault();
    const spkId = Number(document.getElementById('updSpkId').value);
    const tahapanBaru = document.getElementById('updTahapanBaru').value;
    const qtyHasilPotong = Number(document.getElementById('updQtyHasilPotong').value) || 0;

    // VALIDASI WAJIB CUTTING: Jika pindah dari Antri Potong ke Cutting atau tahapan setelahnya, qty_hasil_potong wajib > 0
    if (tahapanBaru !== 'Antri Potong' && qtyHasilPotong <= 0) {
        return Swal.fire(
            'Validasi Cutting Wajib!',
            'Saat tahapan berpindah ke Cutting atau tahapan selanjutnya, Anda wajib mengisi Qty Hasil Potong Riil (> 0 Pcs) sebagai batas kuota WIP.',
            'warning'
        );
    }

    showLoader('Memperbarui tahapan produksi & data cutting...');
    try {
        const { error: errSpk } = await db.from('spk_item').update({
            status_tahapan: tahapanBaru,
            qty_hasil_potong: qtyHasilPotong
        }).eq('id', spkId);
        if (errSpk) throw errSpk;

        // Update rincian ukuran per baris
        const trList = document.querySelectorAll('#tbodyPotongRiil tr[data-rincian-id]');
        for (const tr of trList) {
            const rincianId = Number(tr.getAttribute('data-rincian-id'));
            const qtyPot = Number(tr.querySelector('.inp-potong-size').value) || 0;
            const qtySel = Number(tr.querySelector('.inp-selesai-size').value) || 0;
            await db.from('spk_rincian_ukuran').update({
                qty_potong_riil: qtyPot,
                qty_selesai: qtySel
            }).eq('id', rincianId);
        }

        bootstrap.Modal.getInstance(document.getElementById('modalUpdateTahapan')).hide();
        await refreshAllData();
        Swal.fire('Tahapan Diperbarui!', `Status SPK berhasil diubah ke "${tahapanBaru}" dengan Qty Hasil Potong ${qtyHasilPotong} Pcs.`, 'success');
    } catch (err) {
        Swal.fire('Gagal Update Tahapan', err.message, 'error');
    } finally {
        hideLoader();
    }
}

// ============================================================================
// KONTROL DISTRIBUSI TUKANG & SURAT JALAN MAKLOON (`log_produksi_upah`)
// ============================================================================

function renderTableLogDistribusi() {
    const rowsHtml = AppState.logUpah.map(l => {
        const spk = AppState.spk.find(s => s.id === l.spk_id) || {};
        const pekerja = AppState.pekerja.find(p => p.id === l.pekerja_id) || {};

        return `
            <tr>
                <td>${formatTanggalIndo(l.tanggal_mulai)}</td>
                <td class="fw-bold text-primary">${spk.no_spk || '-'}</td>
                <td>
                    <div class="fw-semibold">${pekerja.nama || '-'}</div>
                    <small class="text-muted">${pekerja.tipe || ''}</small>
                </td>
                <td><span class="badge bg-dark">${l.tahapan}</span></td>
                <td class="fw-bold">${formatAngka(l.qty_diserahkan, 0)} Pcs</td>
                <td class="text-success fw-semibold">${formatAngka(l.qty_selesai_bagus, 0)} Pcs</td>
                <td class="text-danger">${formatAngka(l.qty_reject, 0)} Pcs</td>
                <td>${formatRupiah(l.tarif_per_pcs)}</td>
                <td class="fw-bold text-primary">${formatRupiah(l.total_upah)}</td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-dark" title="Cetak Surat Jalan Makloon / SPK Tukang" onclick="cetakSuratMakloon(${l.id})">
                            <i class="fa-solid fa-print"></i>
                        </button>
                        <button class="btn btn-outline-primary" title="Input Hasil QC Setoran" onclick="openModalInputQc(${l.id})">
                            <i class="fa-solid fa-clipboard-check"></i>
                        </button>
                        <button class="btn btn-outline-danger" title="Hapus Distribusi" onclick="hapusLogDistribusi(${l.id})">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    renderDataTable('tableLogDistribusi', rowsHtml);
}

function openModalDistribusiTukang(defaultSpkId = null) {
    const form = document.getElementById('formDistribusiTukang');
    form.reset();

    // Populate dropdown SPK aktif
    const spkAktif = AppState.spk.filter(s => s.status_tahapan !== 'Selesai');
    const selectSpk = document.getElementById('distSpkId');
    selectSpk.innerHTML = `<option value="">-- Pilih SPK Aktif --</option>` + spkAktif.map(s => {
        const produk = AppState.produk.find(p => p.id === s.produk_id) || {};
        return `<option value="${s.id}">${s.no_spk} - ${produk.nama_varian || ''} (Potong: ${s.qty_hasil_potong || 0} Pcs)</option>`;
    }).join('');

    populateMasterDropdowns();
    document.getElementById('distTanggalMulai').value = getTodayISO();

    if (defaultSpkId) {
        selectSpk.value = defaultSpkId;
    }

    onChangeDistribusiSpk();
    new bootstrap.Modal(document.getElementById('modalDistribusiTukang')).show();
}

/**
 * Menghitung sisa kuota distribusi pengerjaan pada SPK & tahapan terpilih,
 * serta mengisi tarif standar otomatis dari `master_produk_tarif`.
 */
function onChangeDistribusiSpk() {
    const spkId = Number(document.getElementById('distSpkId').value);
    const tahapan = document.getElementById('distTahapan').value;

    const spk = AppState.spk.find(s => s.id === spkId);
    if (!spk) {
        document.getElementById('distBatasQtyPotong').textContent = '0';
        document.getElementById('distSisaKuotaTahapan').textContent = '0';
        document.getElementById('distTarifPerPcs').value = 0;
        return { batasKuota: 0, sisaKuota: 0 };
    }

    const produk = AppState.produk.find(p => p.id === spk.produk_id) || {};

    // Otomatis isi tarif per pcs sesuai matriks produk
    const mapTarif = {
        'Potong': produk.tarif_potong || 0,
        'Sablon': 0,
        'Bordir': 0,
        'Jahit': produk.tarif_jahit || 0,
        'Obras': produk.tarif_obras_neci || 0,
        'Kancing': produk.tarif_kancing || 0,
        'Finishing': produk.tarif_finishing_pack || 0
    };
    document.getElementById('distTarifPerPcs').value = mapTarif[tahapan] || 0;

    // Untuk tahapan 'Potong', batas kuota bisa menggunakan qty_hasil_potong (jika sudah ada) atau total_qty_pesan.
    // Untuk seluruh tahapan setelah potong (Sablon, Bordir, Jahit, Obras, Kancing, Finishing), WAJIB menggunakan qty_hasil_potong.
    const batasKuota = tahapan === 'Potong'
        ? (Number(spk.qty_hasil_potong) > 0 ? Number(spk.qty_hasil_potong) : Number(spk.total_qty_pesan))
        : (Number(spk.qty_hasil_potong) || 0);

    const sudahDibagikan = AppState.logUpah
        .filter(l => l.spk_id === spkId && l.tahapan === tahapan)
        .reduce((acc, l) => acc + (Number(l.qty_diserahkan) || 0), 0);

    const sisaKuota = Math.max(0, batasKuota - sudahDibagikan);

    document.getElementById('distBatasQtyPotong').textContent = formatAngka(batasKuota, 0);
    document.getElementById('distSisaKuotaTahapan').textContent = formatAngka(sisaKuota, 0);
    document.getElementById('distQtyDiserahkan').value = sisaKuota > 0 ? sisaKuota : '';

    return { batasKuota, sudahDibagikan, sisaKuota };
}

async function simpanDistribusiTukang(e) {
    e.preventDefault();
    const spkId = Number(document.getElementById('distSpkId').value);
    const tahapan = document.getElementById('distTahapan').value;
    const pekerjaId = Number(document.getElementById('distPekerjaId').value);
    const qtyDiserahkan = Number(document.getElementById('distQtyDiserahkan').value) || 0;
    const tarifPerPcs = Number(document.getElementById('distTarifPerPcs').value) || 0;
    const tanggalMulai = document.getElementById('distTanggalMulai').value;

    const spk = AppState.spk.find(s => s.id === spkId);
    if (!spk) return;

    // Validasi wajib sudah cutting untuk tahapan pasca potong
    if (tahapan !== 'Potong' && (Number(spk.qty_hasil_potong) || 0) <= 0) {
        return Swal.fire(
            'Belum Ada Hasil Cutting!',
            `SPK ${spk.no_spk} belum memiliki angka Qty Hasil Potong. Silakan input hasil potong terlebih dahulu di tombol Update Tahapan / Cutting.`,
            'error'
        );
    }

    const kuota = onChangeDistribusiSpk();
    if (qtyDiserahkan > kuota.sisaKuota) {
        return Swal.fire(
            'Melebihi Kuota Hasil Potong!',
            `Total kuantitas tahapan "${tahapan}" yang dibagikan ke tukang tidak boleh melebihi Qty Hasil Potong (${kuota.batasKuota} Pcs). Sisa kuota yang belum dibagikan saat ini hanya ${kuota.sisaKuota} Pcs.`,
            'error'
        );
    }

    showLoader('Menyimpan distribusi pekerjaan tukang/vendor...');
    try {
        const { error } = await db.from('log_produksi_upah').insert([{
            spk_id: spkId,
            pekerja_id: pekerjaId,
            tahapan: tahapan,
            tanggal_mulai: tanggalMulai,
            qty_diserahkan: qtyDiserahkan,
            qty_selesai_bagus: 0,
            qty_reject: 0,
            tarif_per_pcs: tarifPerPcs,
            status_bayar_upah: 'Belum Dibayar'
        }]);
        if (error) throw error;

        bootstrap.Modal.getInstance(document.getElementById('modalDistribusiTukang')).hide();
        await refreshAllData();
        Swal.fire('Berhasil Dibagikan!', `Sebanyak ${qtyDiserahkan} Pcs pekerjaan ${tahapan} berhasil diserahkan.`, 'success');
    } catch (err) {
        Swal.fire('Gagal Menyimpan Distribusi', err.message, 'error');
    } finally {
        hideLoader();
    }
}

async function hapusLogDistribusi(logId) {
    const konfirmasi = await Swal.fire({
        title: 'Hapus Log Pekerjaan?',
        text: 'Data pembagian kerja & perhitungan upah pada baris ini akan dihapus.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        confirmButtonText: 'Ya, Hapus'
    });
    if (!konfirmasi.isConfirmed) return;

    showLoader('Menghapus log distribusi...');
    try {
        const { error } = await db.from('log_produksi_upah').delete().eq('id', logId);
        if (error) throw error;
        await refreshAllData();
        Swal.fire('Terhapus!', 'Log distribusi pekerjaan berhasil dihapus.', 'success');
    } catch (err) {
        Swal.fire('Gagal Menghapus', err.message, 'error');
    } finally {
        hideLoader();
    }
}

// ============================================================================
// MODUL 4: HILIR - QUALITY CONTROL (QC), PACKING & SURAT JALAN
// ============================================================================

function renderModulHilir() {
    renderTableQcTukang();
    renderTablePackingSpk();
}

function renderTableQcTukang() {
    const rowsHtml = AppState.logUpah.map(l => {
        const spk = AppState.spk.find(s => s.id === l.spk_id) || {};
        const pekerja = AppState.pekerja.find(p => p.id === l.pekerja_id) || {};

        const belumSetor = (Number(l.qty_selesai_bagus) + Number(l.qty_reject)) === 0;
        const badgeBayar = l.status_bayar_upah === 'Sudah Dibayar'
            ? '<span class="badge bg-success">Sudah Dibayar</span>'
            : '<span class="badge bg-warning text-dark">Belum Dibayar</span>';

        return `
            <tr>
                <td class="fw-bold text-primary">${spk.no_spk || '-'}</td>
                <td>
                    <div class="fw-semibold">${pekerja.nama || '-'}</div>
                    <small class="text-muted">${pekerja.spesialisasi || ''} (${pekerja.tipe || ''})</small>
                </td>
                <td><span class="badge bg-secondary">${l.tahapan}</span></td>
                <td class="fw-semibold">${formatAngka(l.qty_diserahkan, 0)} Pcs</td>
                <td class="text-success fw-bold">${formatAngka(l.qty_selesai_bagus, 0)} Pcs</td>
                <td class="text-danger fw-bold">${formatAngka(l.qty_reject, 0)} Pcs</td>
                <td>${l.tanggal_selesai ? formatTanggalIndo(l.tanggal_selesai) : '<span class="badge bg-light text-muted border">Proses WIP</span>'}</td>
                <td>${badgeBayar}</td>
                <td>
                    <button class="btn btn-sm ${belumSetor ? 'btn-primary' : 'btn-outline-primary'}" onclick="openModalInputQc(${l.id})">
                        <i class="fa-solid fa-clipboard-check me-1"></i> ${belumSetor ? 'Input QC' : 'Revisi QC'}
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    renderDataTable('tableQcTukang', rowsHtml);
}

function openModalInputQc(logId) {
    const l = AppState.logUpah.find(item => item.id === logId);
    if (!l) return;

    const spk = AppState.spk.find(s => s.id === l.spk_id) || {};
    const pekerja = AppState.pekerja.find(p => p.id === l.pekerja_id) || {};

    document.getElementById('qcLogId').value = l.id;
    document.getElementById('qcSpkId').value = l.spk_id;
    document.getElementById('qcTarifHidden').value = l.tarif_per_pcs || 0;

    document.getElementById('qcInfoSpkPekerja').innerHTML = `
        <div><strong>No. SPK:</strong> ${spk.no_spk || '-'} | <strong>Tahapan:</strong> ${l.tahapan}</div>
        <div><strong>Pekerja/Vendor:</strong> ${pekerja.nama || '-'} | <strong>Tarif:</strong> ${formatRupiah(l.tarif_per_pcs)} / Pcs</div>
    `;

    document.getElementById('qcQtyDiserahkan').value = l.qty_diserahkan;
    document.getElementById('qcQtySelesaiBagus').value = l.qty_selesai_bagus > 0 ? l.qty_selesai_bagus : l.qty_diserahkan;
    document.getElementById('qcQtyReject').value = l.qty_reject || 0;
    document.getElementById('qcTanggalSelesai').value = l.tanggal_selesai || getTodayISO();

    hitungPreviewUpahQc();
    new bootstrap.Modal(document.getElementById('modalInputQc')).show();
}

function hitungPreviewUpahQc() {
    const qtyBagus = Number(document.getElementById('qcQtySelesaiBagus').value) || 0;
    const tarif = Number(document.getElementById('qcTarifHidden').value) || 0;
    document.getElementById('qcEstimasiUpah').value = formatRupiah(qtyBagus * tarif);
}

async function simpanInputQc(e) {
    e.preventDefault();
    const logId = Number(document.getElementById('qcLogId').value);
    const spkId = Number(document.getElementById('qcSpkId').value);
    const qtyDiserahkan = Number(document.getElementById('qcQtyDiserahkan').value) || 0;
    const qtyBagus = Number(document.getElementById('qcQtySelesaiBagus').value) || 0;
    const qtyReject = Number(document.getElementById('qcQtyReject').value) || 0;
    const tglSelesai = document.getElementById('qcTanggalSelesai').value;
    const tarif = Number(document.getElementById('qcTarifHidden').value) || 0;

    if (qtyBagus + qtyReject > qtyDiserahkan) {
        return Swal.fire(
            'Jumlah Melebihi Kuota!',
            `Total Qty Bagus (${qtyBagus}) + Qty Reject (${qtyReject}) tidak boleh melebihi Qty Diserahkan (${qtyDiserahkan} Pcs).`,
            'warning'
        );
    }

    showLoader('Menyimpan hasil pemeriksaan QC & menghitung upah...');
    try {
        const { error: errLog } = await db.from('log_produksi_upah').update({
            qty_selesai_bagus: qtyBagus,
            qty_reject: qtyReject,
            tanggal_selesai: tglSelesai,
            total_upah: qtyBagus * tarif
        }).eq('id', logId);
        if (errLog) throw errLog;

        // Ambil ulang seluruh log pada SPK ini untuk menyinkronkan angka qty_lolos_qc dan qty_reject di tabel spk_item
        const { data: logsSpk, error: errFetch } = await db
            .from('log_produksi_upah')
            .select('*')
            .eq('spk_id', spkId);

        if (!errFetch && logsSpk) {
            // Prioritaskan akumulasi QC dari tahapan 'Finishing', jika belum ada gunakan 'Jahit', atau tahapan yang sedang diinput
            let targetLogs = logsSpk.filter(x => x.tahapan === 'Finishing' && (x.qty_selesai_bagus > 0 || x.qty_reject > 0));
            if (targetLogs.length === 0) {
                targetLogs = logsSpk.filter(x => x.tahapan === 'Jahit' && (x.qty_selesai_bagus > 0 || x.qty_reject > 0));
            }
            if (targetLogs.length === 0) {
                const currentLog = logsSpk.find(x => x.id === logId);
                if (currentLog) {
                    targetLogs = logsSpk.filter(x => x.tahapan === currentLog.tahapan);
                }
            }

            const totalLolosSpk = targetLogs.reduce((acc, x) => acc + (Number(x.qty_selesai_bagus) || 0), 0);
            const totalRejectSpk = logsSpk.reduce((acc, x) => acc + (Number(x.qty_reject) || 0), 0);

            await db.from('spk_item').update({
                qty_lolos_qc: totalLolosSpk,
                qty_reject: totalRejectSpk
            }).eq('id', spkId);
        }

        bootstrap.Modal.getInstance(document.getElementById('modalInputQc')).hide();
        await refreshAllData();
        Swal.fire('Hasil QC Tersimpan!', `Barang lolos QC: ${qtyBagus} Pcs | Reject: ${qtyReject} Pcs. Hak upah otomatis tercatat.`, 'success');
    } catch (err) {
        Swal.fire('Gagal Menyimpan QC', err.message, 'error');
    } finally {
        hideLoader();
    }
}

function renderTablePackingSpk() {
    const rowsHtml = AppState.spk.map(s => {
        const pesanan = AppState.pesanan.find(p => p.id === s.pesanan_id) || {};
        const produk = AppState.produk.find(pr => pr.id === s.produk_id) || {};

        return `
            <tr>
                <td class="fw-bold text-primary">${s.no_spk}</td>
                <td>
                    <div class="fw-semibold">${pesanan.instansi || '-'}</div>
                    <small class="text-muted">${pesanan.nama_klien || ''} (${pesanan.no_invoice || ''})</small>
                </td>
                <td>${produk.nama_varian || '-'}</td>
                <td>${formatAngka(s.total_qty_pesan, 0)} Pcs</td>
                <td class="fw-semibold">${formatAngka(s.qty_hasil_potong, 0)} Pcs</td>
                <td class="text-success fw-bold">${formatAngka(s.qty_lolos_qc, 0)} Pcs</td>
                <td class="text-danger fw-bold">${formatAngka(s.qty_reject, 0)} Pcs</td>
                <td>${getBadgeTahapan(s.status_tahapan)}</td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-success" onclick="cetakPackingSuratJalan(${s.id})">
                            <i class="fa-solid fa-truck-ramp-box me-1"></i> Cetak Packing List & Surat Jalan
                        </button>
                        <button class="btn btn-outline-primary" title="Update Rincian Selesai per Ukuran" onclick="openModalUpdateTahapan(${s.id})">
                            <i class="fa-solid fa-list-check"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    renderDataTable('tablePackingSpk', rowsHtml);
}

// ============================================================================
// FITUR CETAK (PRINT-FRIENDLY): LEMBAR SPK, SURAT MAKLOON & SURAT JALAN KLIEN
// ============================================================================

/**
 * 1. Cetak Lembar SPK Produksi Lengkap (Mockup, BOM Bahan, Breakdown Ukuran, Paraf Divisi)
 */
function cetakDokumenSpk(spkId) {
    const s = AppState.spk.find(item => item.id === spkId);
    if (!s) return;

    const pesanan = AppState.pesanan.find(p => p.id === s.pesanan_id) || {};
    const produk = AppState.produk.find(pr => pr.id === s.produk_id) || {};
    const bahan = AppState.bahan.find(b => b.id === s.bahan_utama_id) || {};
    const rincian = AppState.rincianUkuran.filter(r => r.spk_id === s.id);

    const estKain = (Number(s.total_qty_pesan) || 0) * (Number(produk.estimasi_konsumsi_kain) || 0);

    const rincianRows = rincian.map((r, idx) => `
        <tr>
            <td class="text-center">${idx + 1}</td>
            <td class="fw-bold">${r.label_ukuran}</td>
            <td>${r.kategori_gender}</td>
            <td>${r.keterangan_grup || '-'}</td>
            <td class="text-end fw-bold">${r.qty_pesan} Pcs</td>
            <td class="text-end">${r.qty_potong_riil > 0 ? r.qty_potong_riil + ' Pcs' : '.......'}</td>
            <td></td>
        </tr>
    `).join('');

    const html = `
        <div class="print-box">
            <div class="d-flex justify-content-between align-items-center border-bottom border-dark pb-2 mb-3">
                <div>
                    <h4 class="fw-bold mb-0">SURAT PERINTAH KERJA (SPK) KONVEKSI</h4>
                    <small>Dokumen Kontrol Lantai Produksi Hulu ke Hilir (MTO)</small>
                </div>
                <div class="text-end">
                    <h5 class="fw-bold mb-0">NO. SPK: ${s.no_spk}</h5>
                    <small>No. Invoice: ${pesanan.no_invoice || '-'} | Tgl Pesan: ${formatTanggalIndo(pesanan.tanggal_pesan)}</small>
                </div>
            </div>

            <div class="row mb-3">
                <div class="col-8">
                    <table class="table table-sm table-borderless mb-0">
                        <tr><td style="width:32%"><strong>Klien / Instansi</strong></td><td>: ${pesanan.instansi || '-'} (${pesanan.nama_klien || '-'})</td></tr>
                        <tr><td><strong>Lini & Varian Produk</strong></td><td>: [${produk.kategori_produk || '-'}] <strong>${produk.nama_varian || '-'}</strong></td></tr>
                        <tr><td><strong>Bahan Utama & Warna</strong></td><td>: ${bahan.nama_bahan || '-'} (${bahan.kode_bahan || ''}) — <strong>Warna: ${s.warna_kain}</strong></td></tr>
                        <tr><td><strong>Aplikasi Sablon/Bordir</strong></td><td>: ${s.jenis_aplikasi}</td></tr>
                        <tr><td><strong>Estimasi BOM Kain</strong></td><td>: ${formatAngka(estKain, 2)} ${produk.satuan_kain || ''} (@ ${produk.estimasi_konsumsi_kain || 0} ${produk.satuan_kain || ''}/pcs)</td></tr>
                        <tr><td><strong>DEADLINE KIRIM</strong></td><td>: <strong class="text-decoration-underline">${formatTanggalIndo(pesanan.deadline_kirim)}</strong></td></tr>
                    </table>
                </div>
                <div class="col-4 text-center">
                    <div class="border border-dark p-2">
                        <div class="small fw-bold mb-1">DESAIN MOCKUP / SAMPEL</div>
                        ${s.url_mockup
                            ? `<img src="${s.url_mockup}" style="max-height:145px; max-width:100%; object-fit:contain;" alt="Mockup">`
                            : `<div class="py-4 text-muted small">Tidak ada gambar mockup</div>`
                        }
                    </div>
                </div>
            </div>

            <h6 class="fw-bold mb-2">RINCIAN UKURAN (SIZE BREAKDOWN) & KELOMPOK KELAS/PONDOK</h6>
            <table class="table table-sm print-table mb-3">
                <thead>
                    <tr class="table-light">
                        <th style="width:6%" class="text-center">No</th>
                        <th style="width:16%">Ukuran</th>
                        <th style="width:14%">Gender</th>
                        <th style="width:28%">Kelompok Kelas / Kamar Pondok</th>
                        <th style="width:12%" class="text-end">Qty Pesan</th>
                        <th style="width:12%" class="text-end">Hasil Cutting</th>
                        <th style="width:12%">Cek QC</th>
                    </tr>
                </thead>
                <tbody>
                    ${rincianRows}
                </tbody>
                <tfoot>
                    <tr class="fw-bold">
                        <td colspan="4" class="text-end">TOTAL KUANTITAS SPK</td>
                        <td class="text-end">${s.total_qty_pesan} Pcs</td>
                        <td class="text-end">${s.qty_hasil_potong > 0 ? s.qty_hasil_potong + ' Pcs' : '.......'}</td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>

            <div class="border border-dark p-2 mb-3">
                <strong>Catatan Spesifikasi Jahit / Bordir / Sablon:</strong><br>
                <span>${s.catatan_produksi || 'Sesuai standar sampel & mockup yang disetujui.'}</span>
            </div>

            <h6 class="fw-bold mb-2">KOLOM PARAF & KONTROL SERAH TERIMA DIVISI PRODUKSI</h6>
            <table class="table table-sm print-table text-center mb-0">
                <thead>
                    <tr>
                        <th>1. Cutting (Potong)</th>
                        <th>2. Sablon / Bordir</th>
                        <th>3. Sewing (Jahit)</th>
                        <th>4. Kancing / Obras</th>
                        <th>5. QC & Trimming</th>
                        <th>6. Steam & Packing</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="height:75px;">
                        <td class="align-bottom small">Tgl: ........ / Qty: ....</td>
                        <td class="align-bottom small">Tgl: ........ / Qty: ....</td>
                        <td class="align-bottom small">Tgl: ........ / Qty: ....</td>
                        <td class="align-bottom small">Tgl: ........ / Qty: ....</td>
                        <td class="align-bottom small">Tgl: ........ / Qty: ....</td>
                        <td class="align-bottom small">Tgl: ........ / Qty: ....</td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;

    const printArea = document.getElementById('printArea');
    printArea.innerHTML = html;
    window.print();
}

/**
 * 2. Cetak Surat Perintah / Surat Jalan Subkontraktor Makloon & Tukang
 */
function cetakSuratMakloon(logId) {
    const l = AppState.logUpah.find(item => item.id === logId);
    if (!l) return;

    const spk = AppState.spk.find(s => s.id === l.spk_id) || {};
    const produk = AppState.produk.find(p => p.id === spk.produk_id) || {};
    const bahan = AppState.bahan.find(b => b.id === spk.bahan_utama_id) || {};
    const pekerja = AppState.pekerja.find(p => p.id === l.pekerja_id) || {};

    const html = `
        <div class="print-box">
            <div class="d-flex justify-content-between align-items-center border-bottom border-dark pb-2 mb-3">
                <div>
                    <h5 class="fw-bold mb-0">SURAT JALAN MAKLOON / DISTRIBUSI PEKERJAAN TUKANG</h5>
                    <small>Bukti Penyerahan Komponen WIP Konveksi</small>
                </div>
                <div class="text-end">
                    <h6 class="fw-bold mb-0">NO. SPK: ${spk.no_spk || '-'}</h6>
                    <small>Tanggal Mulai: ${formatTanggalIndo(l.tanggal_mulai)}</small>
                </div>
            </div>

            <div class="row mb-3">
                <div class="col-6">
                    <strong>Penerima Pekerjaan (Tukang / Vendor):</strong><br>
                    Nama: <strong>${pekerja.nama || '-'}</strong> (${pekerja.tipe || '-'})<br>
                    Spesialisasi: ${pekerja.spesialisasi || '-'} | WA: ${pekerja.no_wa || '-'}
                </div>
                <div class="col-6">
                    <strong>Spesifikasi Komponen Produk:</strong><br>
                    Produk: <strong>${produk.nama_varian || '-'}</strong><br>
                    Bahan & Warna: ${bahan.nama_bahan || '-'} (${spk.warna_kain || '-'})
                </div>
            </div>

            <table class="table table-sm print-table mb-3">
                <thead>
                    <tr>
                        <th>Tahapan Pengerjaan</th>
                        <th>Aplikasi & Instruksi</th>
                        <th class="text-end">Qty Diserahkan</th>
                        <th class="text-end">Tarif Upah / Pcs</th>
                        <th class="text-end">Estimasi Total Upah</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td class="fw-bold">${l.tahapan}</td>
                        <td>${spk.jenis_aplikasi || '-'} — ${spk.catatan_produksi || 'Sesuai standar sampel'}</td>
                        <td class="text-end fw-bold">${l.qty_diserahkan} Pcs</td>
                        <td class="text-end">${formatRupiah(l.tarif_per_pcs)}</td>
                        <td class="text-end fw-bold">${formatRupiah(l.qty_diserahkan * l.tarif_per_pcs)}</td>
                    </tr>
                </tbody>
            </table>

            <div class="row text-center mt-4">
                <div class="col-4">
                    <div>Diserahkan Oleh (Admin WIP),</div>
                    <div style="height:60px;"></div>
                    <div>( ______________________ )</div>
                </div>
                <div class="col-4">
                    <div>Diperiksa Oleh (QC),</div>
                    <div style="height:60px;"></div>
                    <div>( ______________________ )</div>
                </div>
                <div class="col-4">
                    <div>Diterima Tukang / Vendor,</div>
                    <div style="height:60px;"></div>
                    <div>( <strong>${pekerja.nama || '________________'}</strong> )</div>
                </div>
            </div>
        </div>
    `;

    const printArea = document.getElementById('printArea');
    printArea.innerHTML = html;
    window.print();
}

/**
 * 3. Cetak Daftar Packing (Packing List per Kelas/Kamar) & Surat Jalan Pengiriman Klien
 */
function cetakPackingSuratJalan(spkId) {
    const s = AppState.spk.find(item => item.id === spkId);
    if (!s) return;

    const pesanan = AppState.pesanan.find(p => p.id === s.pesanan_id) || {};
    const produk = AppState.produk.find(pr => pr.id === s.produk_id) || {};
    const bahan = AppState.bahan.find(b => b.id === s.bahan_utama_id) || {};
    const rincian = AppState.rincianUkuran.filter(r => r.spk_id === s.id);

    let totalPesan = 0;
    let totalKirim = 0;

    const rowsPacking = rincian.map((r, idx) => {
        const qtyPesan = Number(r.qty_pesan) || 0;
        const qtyKirim = Number(r.qty_selesai) > 0
            ? Number(r.qty_selesai)
            : (Number(r.qty_potong_riil) > 0 ? Number(r.qty_potong_riil) : qtyPesan);

        totalPesan += qtyPesan;
        totalKirim += qtyKirim;

        return `
            <tr>
                <td class="text-center">${idx + 1}</td>
                <td class="fw-bold">${r.keterangan_grup || 'Umum / Reguler'}</td>
                <td class="fw-bold">${r.label_ukuran}</td>
                <td>${r.kategori_gender}</td>
                <td class="text-end">${qtyPesan} Pcs</td>
                <td class="text-end fw-bold">${qtyKirim} Pcs</td>
                <td></td>
            </tr>
        `;
    }).join('');

    const html = `
        <div class="print-box">
            <div class="d-flex justify-content-between align-items-center border-bottom border-dark pb-2 mb-3">
                <div>
                    <h4 class="fw-bold mb-0">SURAT JALAN & DAFTAR PACKING (PACKING LIST)</h4>
                    <small>Bukti Pengiriman Barang Jadi Konveksi</small>
                </div>
                <div class="text-end">
                    <h5 class="fw-bold mb-0">NO. SJ: SJ/${s.no_spk}</h5>
                    <small>No. Invoice: ${pesanan.no_invoice || '-'} | Tanggal Cetak: ${formatTanggalIndo(getTodayISO())}</small>
                </div>
            </div>

            <div class="row mb-3">
                <div class="col-6">
                    <strong>Kepada Yth. Penerima:</strong><br>
                    Instansi / Sekolah / Pondok: <strong>${pesanan.instansi || '-'}</strong><br>
                    PIC Penerima: ${pesanan.nama_klien || '-'} (WA: ${pesanan.no_wa_klien || '-'})
                </div>
                <div class="col-6">
                    <strong>Detail Barang Jadi:</strong><br>
                    Produk: <strong>[${produk.kategori_produk || '-'}] ${produk.nama_varian || '-'}</strong><br>
                    Bahan & Warna: ${bahan.nama_bahan || '-'} — ${s.warna_kain} (${s.jenis_aplikasi})
                </div>
            </div>

            <h6 class="fw-bold mb-2">DAFTAR RINCIAN PACKING PER KELOMPOK KELAS / KAMAR & UKURAN</h6>
            <table class="table table-sm print-table mb-3">
                <thead>
                    <tr class="table-light">
                        <th style="width:6%" class="text-center">No</th>
                        <th style="width:30%">Kelompok Kelas / Kamar Pondok</th>
                        <th style="width:14%">Ukuran</th>
                        <th style="width:14%">Gender</th>
                        <th style="width:12%" class="text-end">Qty Pesan</th>
                        <th style="width:12%" class="text-end">Qty Dikirim</th>
                        <th style="width:12%">Cek Penerima</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsPacking}
                </tbody>
                <tfoot>
                    <tr class="fw-bold">
                        <td colspan="4" class="text-end">TOTAL BARANG DITERIMA</td>
                        <td class="text-end">${totalPesan} Pcs</td>
                        <td class="text-end">${s.qty_lolos_qc > 0 ? s.qty_lolos_qc : totalKirim} Pcs</td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>

            <p class="small mb-4">
                Barang tersebut di atas telah diperiksa melalui proses Quality Control (QC), di-steam, dan dikemas dengan baik sesuai daftar rincian ukuran.
            </p>

            <div class="row text-center">
                <div class="col-4">
                    <div>Hormat Kami (Bag. Packing/Gudang),</div>
                    <div style="height:65px;"></div>
                    <div>( ______________________ )</div>
                </div>
                <div class="col-4">
                    <div>Pengirim / Kurir Ekspedisi,</div>
                    <div style="height:65px;"></div>
                    <div>( ______________________ )</div>
                </div>
                <div class="col-4">
                    <div>Penerima Klien (${pesanan.instansi || 'Instansi'}),</div>
                    <div style="height:65px;"></div>
                    <div>( <strong>${pesanan.nama_klien || '________________'}</strong> )</div>
                </div>
            </div>
        </div>
    `;

    const printArea = document.getElementById('printArea');
    printArea.innerHTML = html;
    window.print();
}

// ============================================================================
// REGISTRASI EVENT LISTENER TAHAP 3 (HULU, TENGAH & HILIR)
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    const formPesanan = document.getElementById('formPesanan');
    if (formPesanan) formPesanan.addEventListener('submit', simpanPesananInduk);

    const formSpk = document.getElementById('formSpk');
    if (formSpk) formSpk.addEventListener('submit', simpanSpk);

    const formUpdateTahapan = document.getElementById('formUpdateTahapan');
    if (formUpdateTahapan) formUpdateTahapan.addEventListener('submit', simpanUpdateTahapan);

    const formDistribusiTukang = document.getElementById('formDistribusiTukang');
    if (formDistribusiTukang) formDistribusiTukang.addEventListener('submit', simpanDistribusiTukang);

    const formInputQc = document.getElementById('formInputQc');
    if (formInputQc) formInputQc.addEventListener('submit', simpanInputQc);
});

/**
 * ============================================================================
 * SISTEM MANAJEMEN OPERASIONAL KONVEKSI HULU KE HILIR (MTO)
 * FILE: app.js (BAGIAN 3: Modul Penggajian Borongan & Buku Kas Keuangan)
 * Tempelkan kode ini tepat di bawah kode app.js Bagian 2
 * ============================================================================
 */

// ============================================================================
// MODUL 5: PENGGAJIAN BORONGAN (PIECE-RATE PAYROLL) & INTEGRASI KAS
// ============================================================================

/**
 * Mengambil daftar log_produksi_upah yang sudah difilter berdasarkan
 * Pekerja/Vendor, Status Bayar, dan Rentang Tanggal Mulai.
 */
function getFilteredPayrollLogs() {
    const pekerjaId = document.getElementById('filterPayrollPekerja').value;
    const statusBayar = document.getElementById('filterPayrollStatus').value;
    const startDate = document.getElementById('filterPayrollStart').value;
    const endDate = document.getElementById('filterPayrollEnd').value;

    return AppState.logUpah.filter(l => {
        if (pekerjaId && String(l.pekerja_id) !== String(pekerjaId)) return false;
        if (statusBayar && l.status_bayar_upah !== statusBayar) return false;
        if (startDate && l.tanggal_mulai < startDate) return false;
        if (endDate && l.tanggal_mulai > endDate) return false;
        return true;
    });
}

function resetFilterPayroll() {
    document.getElementById('filterPayrollPekerja').value = '';
    document.getElementById('filterPayrollStatus').value = 'Belum Dibayar';
    document.getElementById('filterPayrollStart').value = '';
    document.getElementById('filterPayrollEnd').value = '';
    renderTablePayroll();
}

function renderTablePayroll() {
    const filteredLogs = getFilteredPayrollLogs();

    // Hitung total upah yang berstatus 'Belum Dibayar' di dalam hasil filter
    const logsBelumBayar = filteredLogs.filter(l => l.status_bayar_upah === 'Belum Dibayar');
    const totalNominalBelumBayar = logsBelumBayar.reduce((acc, l) => acc + (Number(l.total_upah) || 0), 0);

    document.getElementById('summaryTotalUpahBelumBayar').textContent = formatRupiah(totalNominalBelumBayar);
    document.getElementById('summaryTotalItemBelumBayar').textContent = logsBelumBayar.length;

    const rowsHtml = filteredLogs.map(l => {
        const pekerja = AppState.pekerja.find(p => p.id === l.pekerja_id) || {};
        const spk = AppState.spk.find(s => s.id === l.spk_id) || {};
        const produk = AppState.produk.find(pr => pr.id === spk.produk_id) || {};

        const qtyBagus = Number(l.qty_selesai_bagus) || 0;
        const totalUpah = Number(l.total_upah) || 0;
        const isUnpaid = l.status_bayar_upah === 'Belum Dibayar';

        const badgeTipe = pekerja.tipe === 'Vendor Makloon'
            ? '<span class="badge bg-warning text-dark">Vendor Makloon</span>'
            : '<span class="badge bg-info text-dark">Tukang Internal</span>';

        const badgeStatus = isUnpaid
            ? '<span class="badge bg-danger">Belum Dibayar</span>'
            : '<span class="badge bg-success">Sudah Dibayar</span>';

        const infoTanggal = `
            <div class="small">Mulai: ${formatTanggalIndo(l.tanggal_mulai)}</div>
            <div class="small text-muted">Selesai: ${l.tanggal_selesai ? formatTanggalIndo(l.tanggal_selesai) : 'Belum QC'}</div>
        `;

        let tombolAksi = '';
        if (isUnpaid) {
            if (qtyBagus > 0 && totalUpah > 0) {
                tombolAksi = `
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-success" onclick="bayarUpahSatuBaris(${l.id})" title="Bayar Upah Pekerjaan Ini">
                            <i class="fa-solid fa-money-bill-wave me-1"></i> Bayar
                        </button>
                        <button class="btn btn-outline-dark" onclick="cetakSlipUpahPekerja(${l.id})" title="Cetak Slip Upah">
                            <i class="fa-solid fa-print"></i>
                        </button>
                    </div>
                `;
            } else {
                tombolAksi = `
                    <button class="btn btn-sm btn-outline-primary" onclick="openModalInputQc(${l.id})" title="Input QC terlebih dahulu agar upah terhitung">
                        <i class="fa-solid fa-clipboard-check me-1"></i> Input QC Dulu
                    </button>
                `;
            }
        } else {
            tombolAksi = `
                <button class="btn btn-sm btn-outline-dark" onclick="cetakSlipUpahPekerja(${l.id})" title="Cetak Bukti Slip Upah">
                    <i class="fa-solid fa-print me-1"></i> Slip Lunas
                </button>
            `;
        }

        return `
            <tr>
                <td>${infoTanggal}</td>
                <td class="fw-bold">${pekerja.nama || '-'}</td>
                <td>${badgeTipe}</td>
                <td>
                    <div class="fw-bold text-primary">${spk.no_spk || '-'}</div>
                    <small class="text-muted">${produk.nama_varian || '-'}</small>
                </td>
                <td><span class="badge bg-secondary">${l.tahapan}</span></td>
                <td>
                    <span class="fw-bold text-success">${formatAngka(qtyBagus, 0)} Pcs</span>
                    <small class="d-block text-muted">dari ${formatAngka(l.qty_diserahkan, 0)} Pcs</small>
                </td>
                <td>${formatRupiah(l.tarif_per_pcs)}</td>
                <td class="fw-bold ${totalUpah > 0 ? 'text-dark' : 'text-muted'}">${formatRupiah(totalUpah)}</td>
                <td>${badgeStatus}</td>
                <td>${tombolAksi}</td>
            </tr>
        `;
    }).join('');

    renderDataTable('tablePayroll', rowsHtml);
}

/**
 * Memproses pembayaran upah untuk 1 baris log_produksi_upah sekaligus mencatat pengeluaran kas
 */
async function bayarUpahSatuBaris(logId) {
    const l = AppState.logUpah.find(item => item.id === logId);
    if (!l) return;

    const pekerja = AppState.pekerja.find(p => p.id === l.pekerja_id) || {};
    const spk = AppState.spk.find(s => s.id === l.spk_id) || {};
    const totalUpah = Number(l.total_upah) || 0;

    if (totalUpah <= 0 || Number(l.qty_selesai_bagus) <= 0) {
        return Swal.fire(
            'Upah Masih Rp 0',
            'Pastikan hasil pemeriksaan QC (Qty Lolos Bagus) sudah diinput dan tarif per pcs lebih dari Rp 0.',
            'warning'
        );
    }

    const kategoriKas = pekerja.tipe === 'Vendor Makloon' ? 'Bayar Makloon' : 'Bayar Upah Tukang';

    const konfirmasi = await Swal.fire({
        title: 'Proses Pembayaran Upah?',
        html: `
            <div class="text-start small bg-light p-3 rounded border">
                <div><strong>Penerima:</strong> ${pekerja.nama || '-'} (${pekerja.tipe || '-'})</div>
                <div><strong>No. SPK & Tahapan:</strong> ${spk.no_spk || '-'} (${l.tahapan})</div>
                <div><strong>Hasil Lolos QC:</strong> ${l.qty_selesai_bagus} Pcs &times; ${formatRupiah(l.tarif_per_pcs)}</div>
                <hr class="my-2">
                <div class="fs-6"><strong>Total Dibayarkan:</strong> <span class="text-success fw-bold">${formatRupiah(totalUpah)}</span></div>
                <div class="text-muted mt-1">Otomatis tercatat di Buku Kas sebagai Pengeluaran (<strong>${kategoriKas}</strong>).</div>
            </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#198754',
        confirmButtonText: 'Ya, Bayar & Catat Kas',
        cancelButtonText: 'Batal'
    });

    if (!konfirmasi.isConfirmed) return;

    showLoader('Memproses pembayaran upah & mencatat arus kas...');
    try {
        const { error: errUpd } = await db
            .from('log_produksi_upah')
            .update({ status_bayar_upah: 'Sudah Dibayar' })
            .eq('id', logId);
        if (errUpd) throw errUpd;

        const { error: errKas } = await db
            .from('transaksi_keuangan')
            .insert([{
                tanggal: getTodayISO(),
                jenis: 'Pengeluaran',
                kategori: kategoriKas,
                nominal: totalUpah,
                referensi_id: logId,
                keterangan: `${kategoriKas}: ${pekerja.nama} - SPK ${spk.no_spk || ''} (${l.tahapan}: ${l.qty_selesai_bagus} pcs)`
            }]);
        if (errKas) throw errKas;

        await refreshAllData();
        Swal.fire('Pembayaran Berhasil!', `Upah sebesar ${formatRupiah(totalUpah)} untuk ${pekerja.nama} telah lunas dan tercatat di Buku Kas.`, 'success');
    } catch (err) {
        Swal.fire('Gagal Memproses Pembayaran', err.message, 'error');
    } finally {
        hideLoader();
    }
}

/**
 * Memproses pembayaran massal (Gajian Mingguan / Rekap Sabtu) untuk seluruh baris
 * yang sesuai filter saat ini, berstatus 'Belum Dibayar', dan sudah memiliki Qty Lolos QC > 0.
 */
async function prosesBayarUpahTerfilter() {
    const filteredLogs = getFilteredPayrollLogs();
    const siapBayar = filteredLogs.filter(l =>
        l.status_bayar_upah === 'Belum Dibayar' &&
        (Number(l.qty_selesai_bagus) || 0) > 0 &&
        (Number(l.total_upah) || 0) > 0
    );

    if (siapBayar.length === 0) {
        return Swal.fire(
            'Tidak Ada Tagihan Siap Bayar',
            'Tidak ditemukan pekerjaan berstatus "Belum Dibayar" yang sudah lolos QC (Total Upah > Rp 0) pada filter ini.',
            'info'
        );
    }

    // Pisahkan akumulasi antara Tukang Internal vs Vendor Makloon agar pencatatan Buku Kas rapi
    let totalUpahTukang = 0;
    let totalTagihanMakloon = 0;
    const namaPekerjaSet = new Set();

    siapBayar.forEach(l => {
        const pekerja = AppState.pekerja.find(p => p.id === l.pekerja_id) || {};
        const nominal = Number(l.total_upah) || 0;
        if (pekerja.nama) namaPekerjaSet.add(pekerja.nama);

        if (pekerja.tipe === 'Vendor Makloon') {
            totalTagihanMakloon += nominal;
        } else {
            totalUpahTukang += nominal;
        }
    });

    const grandTotal = totalUpahTukang + totalTagihanMakloon;
    const daftarNama = Array.from(namaPekerjaSet).join(', ');

    const konfirmasi = await Swal.fire({
        title: 'Proses Gajian / Bayar Terfilter?',
        html: `
            <div class="text-start small bg-light p-3 rounded border">
                <div><strong>Jumlah Item Pekerjaan:</strong> ${siapBayar.length} pekerjaan selesai QC</div>
                <div><strong>Penerima:</strong> ${daftarNama}</div>
                <hr class="my-2">
                <div>Upah Tukang Internal: <strong>${formatRupiah(totalUpahTukang)}</strong></div>
                <div>Tagihan Vendor Makloon: <strong>${formatRupiah(totalTagihanMakloon)}</strong></div>
                <div class="fs-6 mt-1"><strong>Total Pengeluaran Kas:</strong> <span class="text-danger fw-bold">${formatRupiah(grandTotal)}</span></div>
            </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#198754',
        confirmButtonText: 'Ya, Lunasi Semua & Catat Kas',
        cancelButtonText: 'Batal'
    });

    if (!konfirmasi.isConfirmed) return;

    showLoader('Memproses pelunasan upah kolektif & pembukuan kas...');
    try {
        const idsToUpdate = siapBayar.map(l => l.id);
        const { error: errUpd } = await db
            .from('log_produksi_upah')
            .update({ status_bayar_upah: 'Sudah Dibayar' })
            .in('id', idsToUpdate);
        if (errUpd) throw errUpd;

        const kasPayloads = [];
        const today = getTodayISO();

        if (totalUpahTukang > 0) {
            kasPayloads.push({
                tanggal: today,
                jenis: 'Pengeluaran',
                kategori: 'Bayar Upah Tukang',
                nominal: totalUpahTukang,
                keterangan: `Rekap Gajian Borongan (${siapBayar.length} item pekerjaan) - Penerima: ${daftarNama}`
            });
        }

        if (totalTagihanMakloon > 0) {
            kasPayloads.push({
                tanggal: today,
                jenis: 'Pengeluaran',
                kategori: 'Bayar Makloon',
                nominal: totalTagihanMakloon,
                keterangan: `Pelunasan Rekap Vendor Makloon - Penerima: ${daftarNama}`
            });
        }

        if (kasPayloads.length > 0) {
            const { error: errKas } = await db.from('transaksi_keuangan').insert(kasPayloads);
            if (errKas) throw errKas;
        }

        await refreshAllData();
        Swal.fire(
            'Gajian Borongan Selesai!',
            `Sebanyak ${siapBayar.length} pekerjaan senilai total ${formatRupiah(grandTotal)} berhasil dilunasi dan tercatat di Buku Kas.`,
            'success'
        );
    } catch (err) {
        Swal.fire('Gagal Memproses Gajian Kolektif', err.message, 'error');
    } finally {
        hideLoader();
    }
}

/**
 * Cetak Slip Gaji / Bukti Pembayaran Upah Borongan Tukang & Makloon
 */
function cetakSlipUpahPekerja(logId) {
    const l = AppState.logUpah.find(item => item.id === logId);
    if (!l) return;

    const pekerja = AppState.pekerja.find(p => p.id === l.pekerja_id) || {};
    const spk = AppState.spk.find(s => s.id === l.spk_id) || {};
    const produk = AppState.produk.find(pr => pr.id === spk.produk_id) || {};

    const html = `
        <div class="print-box">
            <div class="d-flex justify-content-between align-items-center border-bottom border-dark pb-2 mb-3">
                <div>
                    <h5 class="fw-bold mb-0">SLIP UPAH BORONGAN &amp; BUKTI SETORAN QC</h5>
                    <small>Sistem Manajemen Operasional Konveksi MTO</small>
                </div>
                <div class="text-end">
                    <h6 class="fw-bold mb-0">STATUS: ${l.status_bayar_upah.toUpperCase()}</h6>
                    <small>Tgl Cetak: ${formatTanggalIndo(getTodayISO())}</small>
                </div>
            </div>

            <div class="row mb-3">
                <div class="col-6">
                    <strong>Nama Pekerja / Vendor:</strong> ${pekerja.nama || '-'}<br>
                    <strong>Kategori SDM:</strong> ${pekerja.tipe || '-'} (${pekerja.spesialisasi || '-'})<br>
                    <strong>No. WhatsApp:</strong> ${pekerja.no_wa || '-'}
                </div>
                <div class="col-6">
                    <strong>No. SPK:</strong> ${spk.no_spk || '-'}<br>
                    <strong>Produk:</strong> ${produk.nama_varian || '-'}<br>
                    <strong>Tgl Mulai - Selesai:</strong> ${formatTanggalIndo(l.tanggal_mulai)} s/d ${formatTanggalIndo(l.tanggal_selesai)}
                </div>
            </div>

            <table class="table table-sm print-table mb-3">
                <thead>
                    <tr>
                        <th>Tahapan</th>
                        <th class="text-end">Qty Diserahkan</th>
                        <th class="text-end">Qty Lolos QC (Bagus)</th>
                        <th class="text-end">Qty Reject</th>
                        <th class="text-end">Tarif / Pcs</th>
                        <th class="text-end">Total Hak Upah</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td class="fw-bold">${l.tahapan}</td>
                        <td class="text-end">${l.qty_diserahkan} Pcs</td>
                        <td class="text-end fw-bold">${l.qty_selesai_bagus} Pcs</td>
                        <td class="text-end">${l.qty_reject} Pcs</td>
                        <td class="text-end">${formatRupiah(l.tarif_per_pcs)}</td>
                        <td class="text-end fw-bold">${formatRupiah(l.total_upah)}</td>
                    </tr>
                </tbody>
            </table>

            <div class="row text-center mt-4">
                <div class="col-6">
                    <div>Dibayarkan Oleh (Bag. Keuangan),</div>
                    <div style="height:55px;"></div>
                    <div>( ______________________ )</div>
                </div>
                <div class="col-6">
                    <div>Diterima Oleh,</div>
                    <div style="height:55px;"></div>
                    <div>( <strong>${pekerja.nama || '________________'}</strong> )</div>
                </div>
            </div>
        </div>
    `;

    const printArea = document.getElementById('printArea');
    printArea.innerHTML = html;
    window.print();
}

// ============================================================================
// MODUL 6D: BUKU KAS & ARUS KEUANGAN (`transaksi_keuangan`)
// ============================================================================

function renderTableTransaksiKeuangan() {
    let totalMasuk = 0;
    let totalKeluar = 0;

    const rowsHtml = AppState.keuangan.map(k => {
        const nominal = Number(k.nominal) || 0;
        const isMasuk = k.jenis === 'Pemasukan';

        if (isMasuk) {
            totalMasuk += nominal;
        } else {
            totalKeluar += nominal;
        }

        const badgeJenis = isMasuk
            ? '<span class="badge bg-success"><i class="fa-solid fa-arrow-trend-up me-1"></i>Pemasukan</span>'
            : '<span class="badge bg-danger"><i class="fa-solid fa-arrow-trend-down me-1"></i>Pengeluaran</span>';

        return `
            <tr>
                <td>${formatTanggalIndo(k.tanggal)}</td>
                <td>${badgeJenis}</td>
                <td><span class="badge bg-light text-dark border fw-semibold">${k.kategori}</span></td>
                <td class="fw-bold ${isMasuk ? 'text-success' : 'text-danger'}">
                    ${isMasuk ? '+' : '-'} ${formatRupiah(nominal)}
                </td>
                <td>${k.keterangan || '-'}</td>
                <td>
                    <button class="btn btn-sm btn-outline-danger" onclick="hapusTransaksiKas(${k.id})" title="Hapus Transaksi">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    const saldoAkhir = totalMasuk - totalKeluar;

    document.getElementById('kpiKasMasuk').textContent = formatRupiah(totalMasuk);
    document.getElementById('kpiKasKeluar').textContent = formatRupiah(totalKeluar);
    document.getElementById('kpiSaldoAkhir').textContent = formatRupiah(saldoAkhir);

    renderDataTable('tableTransaksiKeuangan', rowsHtml);
}

function sesuaikanKategoriKasByJenis() {
    const jenis = document.getElementById('kasJenis').value;
    const selectKat = document.getElementById('kasKategori');

    if (jenis === 'Pemasukan') {
        selectKat.innerHTML = `
            <option value="DP Klien">DP Klien</option>
            <option value="Pelunasan Klien">Pelunasan Klien</option>
        `;
    } else {
        selectKat.innerHTML = `
            <option value="Operasional">Operasional (Listrik, Benang, Jarum, Transport, dll)</option>
            <option value="Beli Kain/Aksesoris">Beli Kain/Aksesoris</option>
            <option value="Bayar Upah Tukang">Bayar Upah Tukang</option>
            <option value="Bayar Makloon">Bayar Makloon</option>
        `;
    }
}

function openModalTransaksiKas() {
    const form = document.getElementById('formTransaksiKas');
    form.reset();
    document.getElementById('kasTanggal').value = getTodayISO();
    document.getElementById('kasJenis').value = 'Pengeluaran';
    sesuaikanKategoriKasByJenis();
    new bootstrap.Modal(document.getElementById('modalTransaksiKas')).show();
}

async function simpanTransaksiKas(e) {
    e.preventDefault();
    const payload = {
        tanggal: document.getElementById('kasTanggal').value,
        jenis: document.getElementById('kasJenis').value,
        kategori: document.getElementById('kasKategori').value,
        nominal: Number(document.getElementById('kasNominal').value) || 0,
        keterangan: document.getElementById('kasKeterangan').value.trim()
    };

    if (payload.nominal <= 0) {
        return Swal.fire('Nominal Tidak Valid', 'Masukkan nominal transaksi lebih dari Rp 0.', 'warning');
    }

    showLoader('Menyimpan transaksi buku kas...');
    try {
        const { error } = await db.from('transaksi_keuangan').insert([payload]);
        if (error) throw error;

        bootstrap.Modal.getInstance(document.getElementById('modalTransaksiKas')).hide();
        await refreshAllData();
        Swal.fire('Berhasil!', 'Transaksi berhasil dicatat ke dalam Buku Kas Keuangan.', 'success');
    } catch (err) {
        Swal.fire('Gagal Menyimpan Kas', err.message, 'error');
    } finally {
        hideLoader();
    }
}

async function hapusTransaksiKas(id) {
    const item = AppState.keuangan.find(k => k.id === id);
    const konfirmasi = await Swal.fire({
        title: 'Hapus Catatan Kas?',
        text: `Hapus transaksi "${item ? item.kategori : ''} - ${item ? formatRupiah(item.nominal) : ''}" dari Buku Kas?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        confirmButtonText: 'Ya, Hapus'
    });
    if (!konfirmasi.isConfirmed) return;

    showLoader('Menghapus transaksi kas...');
    try {
        const { error } = await db.from('transaksi_keuangan').delete().eq('id', id);
        if (error) throw error;
        await refreshAllData();
        Swal.fire('Terhapus!', 'Catatan transaksi kas berhasil dihapus.', 'success');
    } catch (err) {
        Swal.fire('Gagal Menghapus', err.message, 'error');
    } finally {
        hideLoader();
    }
}

// ============================================================================
// REGISTRASI EVENT LISTENER TAHAP 4 (PAYROLL & BUKU KAS KEUANGAN)
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    const formKas = document.getElementById('formTransaksiKas');
    if (formKas) formKas.addEventListener('submit', simpanTransaksiKas);

    const selectKasJenis = document.getElementById('kasJenis');
    if (selectKasJenis) selectKasJenis.addEventListener('change', sesuaikanKategoriKasByJenis);
});
