let allFiles = []; 
let zipData = {};       // Eski ZIP'ten gelenler
let newlyRecorded = {}; // Bu oturumda yeni kaydedilenler
let renderedCount = 0;
const RECORD_LIMIT = 50;

// 1. Orijinal Klasör Yükleme
document.getElementById('f-input').onchange = (e) => {
    const files = Array.from(e.target.files);
    allFiles = files.filter(f => f.name.toLowerCase().endsWith('.wav'))
        .map(f => ({
            name: f.name,
            path: f.webkitRelativePath, // "sound/weapons/glock.wav" vb.
            fileObj: f
        }));
    
    if(allFiles.length > 0) {
        document.getElementById('export-ui').style.display = 'block';
        alert(`${allFiles.length} adet ses dosyası başarıyla tarandı.`);
    }
    render(true);
};

// 2. ZIP Yükleme
document.getElementById('z-input').onchange = async (e) => {
    if (allFiles.length === 0) {
        alert("HATA: Lütfen önce 1. Adımdaki 'Orijinal Klasörü' yükleyin!");
        e.target.value = ''; return;
    }
    const zip = await JSZip.loadAsync(e.target.files[0]);
    for(let path in zip.files) {
        if (!zip.files[path].dir && path.toLowerCase().endsWith('.wav')) {
            zipData[path] = await zip.files[path].async("blob");
        }
    }
    render(true);
    alert("ZIP dosyası aktarıldı. Dosyalar 'ZATEN VAR (ZIP)' olarak işaretlendi.");
};

// 3. Arama ve Listeleme (100'er 100'er yükler, kasmayı engeller)
function render(reset) {
    const list = document.getElementById('list');
    const search = document.getElementById('search').value.toLowerCase();
    if(reset) { list.innerHTML = ''; renderedCount = 0; }
    
    const filtered = allFiles.filter(f => f.path.toLowerCase().includes(search));
    const batch = filtered.slice(renderedCount, renderedCount + 100);
    
    batch.forEach(f => {
        const div = document.createElement('div');
        div.className = 'file-item';
        
        let statusHtml = '';
        if (newlyRecorded[f.path]) {
            statusHtml = `<span class="status-badge badge-new">✅ YENİ KAYDEDİLDİ</span>`;
        } else if (zipData[f.path]) {
            statusHtml = `<span class="status-badge badge-zip">📦 ZATEN VAR (ZIP)</span>`;
        }

        div.innerHTML = `<div>${f.name}</div>${statusHtml}`;
        div.onclick = () => selectFile(f, div);
        list.appendChild(div);
    });
    renderedCount += 100;
    document.getElementById('btn-load-more').style.display = (renderedCount < filtered.length) ? 'block' : 'none';
}

// 4. Dosya Seçimi ve Oynatıcılar
let currentFile = null;
function selectFile(f, divElement) {
    currentFile = f;
    document.getElementById('fname').innerText = f.name;
    document.getElementById('fpath').innerText = f.path;
    document.getElementById('audio-players').style.display = 'flex';
    document.getElementById('recorder-ui').style.display = 'block';

    // Seçili dosyayı belirginleştir
    document.querySelectorAll('.file-item').forEach(el => el.style.borderLeft = 'none');
    divElement.style.borderLeft = '3px solid var(--primary)';

    // 1. Orijinal Sesi oynatıcıya yükle
    document.getElementById('audio-original').src = URL.createObjectURL(f.fileObj);
    
    // 2. Varsa kendi sesini yükle (Öncelik yeni kaydın, sonra zip'in)
    const recordedBlob = newlyRecorded[f.path] || zipData[f.path];
    const recAudio = document.getElementById('audio-recorded');
    if (recordedBlob) {
        recAudio.src = URL.createObjectURL(recordedBlob);
    } else {
        recAudio.src = ''; // Kayıt yoksa boşalt
    }
}

// 5. Ses Kaydetme Mantığı (Toggle, Hold, Delay)
let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let countdownTimer;

const recBtn = document.getElementById('record-btn');
const recStatus = document.getElementById('rec-status');

// A: Gecikme Sayacı ile Başlatma
async function triggerStart() {
    const delay = parseInt(document.getElementById('rec-delay').value);
    if(delay > 0) {
        let timeLeft = delay;
        recBtn.innerText = `⏳ ${timeLeft}...`;
        recBtn.style.background = '#f39c12';
        recStatus.innerText = "Kayıt hazırlanıyor...";
        
        countdownTimer = setInterval(() => {
            timeLeft--;
            if(timeLeft > 0) {
                recBtn.innerText = `⏳ ${timeLeft}...`;
            } else {
                clearInterval(countdownTimer);
                startMic();
            }
        }, 1000);
    } else {
        startMic();
    }
}

// B: Mikrofonu Aç ve Kayda Başla
async function startMic() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({audio: true});
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
        mediaRecorder.onstop = () => processRecording();
        
        mediaRecorder.start();
        isRecording = true;
        recBtn.innerText = "🛑 KAYDI BİTİR";
        recBtn.style.background = "var(--success)";
        recStatus.innerText = "🔴 Şu an kaydediliyor... Konuşun!";
    } catch (err) {
        alert("Mikrofon izni reddedildi veya mikrofon bulunamadı!");
        resetBtnUI();
    }
}

// C: Kaydı Durdurma
function stopMic() {
    if(countdownTimer) clearInterval(countdownTimer);
    if(mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(t => t.stop()); // Mikrofon ışığını söndür
    }
    isRecording = false;
    resetBtnUI();
}

function resetBtnUI() {
    recBtn.innerText = "🎙️ KAYDET";
    recBtn.style.background = "var(--danger)";
    recStatus.innerText = "Kaydetmek için butona basın.";
}

// D: Kaydı İşleme ve Hafızaya Alma
function processRecording() {
    if (!currentFile) return;
    const blob = new Blob(audioChunks, { type: 'audio/wav' });
    newlyRecorded[currentFile.path] = blob; // Dosyayı ORİJİNAL YOLU ile kaydet (klasörü otomatik anlar)
    
    // Kayıt oynatıcıyı güncelle
    document.getElementById('audio-recorded').src = URL.createObjectURL(blob);
    render(true); // Listeyi güncelle (Yeşil etiket çıksın)
    checkLimit();
}

// Buton Olayları (Mouse Down / Up / Click)
recBtn.onmousedown = () => { if(document.getElementById('rec-mode').value === 'hold') triggerStart(); };
recBtn.onmouseup = () => { if(document.getElementById('rec-mode').value === 'hold') stopMic(); };
recBtn.onmouseleave = () => { if(document.getElementById('rec-mode').value === 'hold' && isRecording) stopMic(); };

recBtn.onclick = () => {
    if(document.getElementById('rec-mode').value === 'toggle') {
        if(!isRecording) triggerStart();
        else stopMic();
    }
};

// 6. İndirme (ZIP Oluşturma ve Klasörleme Mantığı)
async function downloadZip(type) {
    if (Object.keys(newlyRecorded).length === 0 && type === 'new') {
        return alert("Henüz hiç yeni ses kaydetmediniz!");
    }
    
    const zip = new JSZip();
    
    // Seçenek 1: Her şeyi birleştir (Eski ZIP verileri + Yeni Kayıtlar ÜZERİNE YAZAR)
    if (type === 'merge') {
        for(let path in zipData) zip.file(path, zipData[path]); 
        for(let path in newlyRecorded) zip.file(path, newlyRecorded[path]); // Klasör yoksa JSZip otomatik oluşturur.
    } 
    // Seçenek 2: Sadece Yeni Kayıtlar
    else if (type === 'new') {
        for(let path in newlyRecorded) zip.file(path, newlyRecorded[path]);
    }

    recStatus.innerText = "ZIP hazırlanıyor, lütfen bekleyin...";
    const blob = await zip.generateAsync({type:"blob"});
    const a = document.createElement('a'); 
    a.href = URL.createObjectURL(blob); 
    a.download = (type === 'merge') ? "Tum_Mod_Sesleri.zip" : "Yeni_Eklenen_Sesler.zip"; 
    a.click();
    recStatus.innerText = "ZIP indirildi!";
}

// 7. Limit Koruması
function checkLimit() {
    const currentCount = Object.keys(newlyRecorded).length;
    if(currentCount >= RECORD_LIMIT) {
        alert(`⚠️ LİMİTE ULAŞTINIZ! (${RECORD_LIMIT} Yeni Kayıt)\nTarayıcı belleğinin dolmasını ve çökmesini engellemek için lütfen:\n1. 'SADECE Yeni Eklenenleri İndir' butonuna basıp ZIP'i alın.\n2. Sağ tıklayıp önceki mod ZIP'inizin içine atın (veya 1. seçenekle hepsini birleşik indirin).\n3. 'Yeni Proje Başlat' diyerek sıfırlayıp devam edin.`);
    }
}

// 8. Yeni Proje (Her şeyi sıfırlama)
function startNewProject() {
    if(confirm("Tüm kaydedilmemiş veriler silinecek! Yeni bir projeye başlamak istediğinize emin misiniz?")) {
        zipData = {};
        newlyRecorded = {};
        allFiles = [];
        document.getElementById('list').innerHTML = '';
        document.getElementById('audio-players').style.display = 'none';
        document.getElementById('recorder-ui').style.display = 'none';
        document.getElementById('export-ui').style.display = 'none';
        document.getElementById('fname').innerText = "Sıfırlandı. Orijinal Klasörü Seçin.";
        document.getElementById('fpath').innerText = "";
    }
}

// Event Listeners
document.getElementById('search').oninput = () => render(true);
document.getElementById('btn-load-more').onclick = () => render(false);
window.onbeforeunload = () => (Object.keys(newlyRecorded).length > 0) ? true : null;
