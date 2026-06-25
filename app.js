let allFiles = []; 
let zipStorage = {};       // Eski ZIP verileri
let sessionStorage = {};   // Bu oturumda kaydedilenler
let renderedCount = 0;

const clean = (p) => p ? p.replace(/\\/g, '/').toLowerCase() : '';

// --- AKILLI YOL EŞLEŞTİRİCİ (Fuzzy Matcher) ---
// Tarayıcıdaki yol ile ZIP içindeki yolun başındaki klasör isimleri farklı olsa bile eşleştirir.
function getStorageMatch(path) {
    const target = clean(path);
    for (let k in sessionStorage) { if (target.endsWith(k) || k.endsWith(target)) return { type: 'new', blob: sessionStorage[k], key: k }; }
    for (let k in zipStorage) { if (target.endsWith(k) || k.endsWith(target)) return { type: 'zip', blob: zipStorage[k], key: k }; }
    return null;
}

// 1. Orijinal Klasörü Yükle
document.getElementById('f-input').onchange = (e) => {
    allFiles = Array.from(e.target.files)
        .filter(f => f.name.toLowerCase().endsWith('.wav'))
        .map(f => ({ name: f.name, path: f.webkitRelativePath, file: f }));
    
    if(allFiles.length > 0) {
        document.getElementById('export-box').style.display = 'block';
        renderList(true);
    }
};

// 2. Eski ZIP'i Yükle
document.getElementById('z-input').onchange = async (e) => {
    if(allFiles.length === 0) return alert("Lütfen önce 1. Butondan Orijinal Klasörü seçin!");
    const zip = await JSZip.loadAsync(e.target.files[0]);
    let count = 0;
    for(let p in zip.files) {
        if(!zip.files[p].dir && p.toLowerCase().endsWith('.wav')) {
            zipStorage[clean(p)] = await zip.files[p].async("blob");
            count++;
        }
    }
    alert(`${count} adet ses ZIP içerisinden projeye tanındı.`);
    renderList(true);
};

// 3. Sıfırlama (İstediğin Google tarayıcı mesajı tam olarak bu)
function triggerReset() {
    if(confirm("Yeni bir proje başlatmak için sayfa yenilensin mi? (Kaydedilmemiş tüm sesler silinir)")) {
        window.location.reload();
    }
}

// 4. Liste Render (100'erli kasmayan sistem)
function renderList(reset = false) {
    const listEl = document.getElementById('list');
    const q = clean(document.getElementById('search').value);
    if(reset) { listEl.innerHTML = ''; renderedCount = 0; }

    const filtered = allFiles.filter(f => clean(f.path).includes(q));
    const batch = filtered.slice(renderedCount, renderedCount + 100);

    batch.forEach(f => {
        const div = document.createElement('div');
        div.className = 'file-item';
        
        const match = getStorageMatch(f.path);
        let badge = '';
        if(match?.type === 'new') badge = `<span class="badge b-new">YENİ KAYDEDİLDİ</span>`;
        else if(match?.type === 'zip') badge = `<span class="badge b-zip">ÖNCEDEN KAYDEDİLDİ</span>`;

        div.innerHTML = `<div><b>${f.name}</b></div>${badge}`;
        div.onclick = () => selectFile(f);
        listEl.appendChild(div);
    });

    renderedCount += 100;
    document.getElementById('btn-load-more').style.display = (renderedCount < filtered.length) ? 'block' : 'none';
}

// 5. Dosya Seçimi & Çift Oynatıcı
let activeFile = null;
function selectFile(f) {
    activeFile = f;
    document.getElementById('fname').innerText = f.name;
    document.getElementById('fpath').innerText = f.path;
    document.getElementById('player-container').style.display = 'grid';
    document.getElementById('recorder-box').style.display = 'block';

    // Orijinal ses
    document.getElementById('p-orig').src = URL.createObjectURL(f.file);

    // Kayıtlı ses var mı kontrolü
    const match = getStorageMatch(f.path);
    const recPlayer = document.getElementById('p-rec');
    const recCard = document.getElementById('rec-card');

    if(match) {
        recPlayer.src = URL.createObjectURL(match.blob);
        recCard.style.opacity = '1';
    } else {
        recPlayer.src = '';
        recCard.style.opacity = '0.25'; // Ses yoksa kutu sönük dursun
    }
}

// 6. Kayıt Motoru (Üzerine Yazma Onayı & Hold/Toggle Mekanizması)
let mediaRecorder, chunks = [], isRecording = false;
let sessionApprovedOverwritePath = null; // Hold modunda mouse'u bıraktığında onayı unutmaması için

const recBtn = document.getElementById('record-btn');
const modeEl = document.getElementById('rec-mode');

modeEl.onchange = () => {
    document.getElementById('rec-hint').innerText = modeEl.value === 'hold' 
        ? "Kaydetmek için butona basılı tutun." : "Başlatmak için tıklayın, bitirmek için tekrar tıklayın.";
};

function tryTriggerRecord() {
    if(!activeFile) return;
    const existing = getStorageMatch(activeFile.path);

    // EĞER SES ZATEN VARSA VE BU DOSYA İÇİN DAHA ÖNCE ONAY VERMEDİYSEK:
    if(existing && sessionApprovedOverwritePath !== activeFile.path) {
        if(confirm(`"${activeFile.name}" dosyasının zaten bir kaydı var. Üzerine yazmak istiyor musunuz?`)) {
            sessionApprovedOverwritePath = activeFile.path;
            if(modeEl.value === 'hold') {
                alert("Üzerine yazma onaylandı. Şimdi butona basılı tutarak kaydınızı yapabilirsiniz.");
                return; // Basılı tutacağı bir sonraki hamleyi bekler
            } else {
                startMic(); return; // Toggle modunda direkt başlar
            }
        } else {
            return; // İptal bastı
        }
    }
    startMic();
}

async function startMic() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({audio:true});
        mediaRecorder = new MediaRecorder(stream);
        chunks = [];
        mediaRecorder.ondataavailable = e => chunks.push(e.data);
        mediaRecorder.onstop = () => saveRecording();
        
        mediaRecorder.start();
        isRecording = true;
        recBtn.innerText = "🔴 KAYDEDİLİYOR... (BİTİR)";
        recBtn.style.background = "var(--green)";
        recBtn.style.color = "#000";
    } catch(err) { alert("Mikrofon izni alınamadı!"); }
}

function stopMic() {
    if(mediaRecorder && isRecording) {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(t => t.stop()); // Mikrofonu donanımsal kapat
    }
    isRecording = false;
    recBtn.innerText = "🎙️ KAYDA BAŞLA";
    recBtn.style.background = "var(--red)";
    recBtn.style.color = "#fff";
}

function saveRecording() {
    const blob = new Blob(chunks, {type: 'audio/wav'});
    const cleanP = clean(activeFile.path);
    
    sessionStorage[cleanP] = blob;
    sessionApprovedOverwritePath = null; // Sıfırla ki bir sonraki denemesinde tekrar sorsun

    document.getElementById('p-rec').src = URL.createObjectURL(blob);
    document.getElementById('rec-card').style.opacity = '1';
    renderList(true); // Yan listede "YENİ KAYDEDİLDİ" yazısı belirsin

    if(Object.keys(sessionStorage).length >= 50) {
        alert("⚠️ 50 Ses limitine ulaştınız. Tarayıcı şişmesin diye lütfen ZIP indirip yedekleyin.");
    }
}

// Fare Kontrolleri
recBtn.onmousedown = () => { if(modeEl.value === 'hold') tryTriggerRecord(); };
recBtn.onmouseup = () => { if(modeEl.value === 'hold' && isRecording) stopMic(); };
recBtn.onmouseleave = () => { if(modeEl.value === 'hold' && isRecording) stopMic(); };
recBtn.onclick = () => {
    if(modeEl.value === 'toggle') {
        if(!isRecording) tryTriggerRecord(); else stopMic();
    }
};

// 7. Çıktı Alma (Klasör Yapısını Koruyarak ZIP Üzerine Yazma)
async function exportMod(type) {
    if(Object.keys(sessionStorage).length === 0 && type === 'new') return alert("Hiç yeni ses kaydetmediniz!");
    
    const zip = new JSZip();
    
    if(type === 'merge') {
        for(let k in zipStorage) zip.file(k, zipStorage[k]);
        for(let k in sessionStorage) zip.file(k, sessionStorage[k]); // Klasör yoksa JSZip açar, varsa üstüne yazar.
    } else {
        for(let k in sessionStorage) zip.file(k, sessionStorage[k]);
    }

    const content = await zip.generateAsync({type:"blob"});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(content);
    a.download = type === 'merge' ? "HalfLife_Tam_Ses_Modu.zip" : "Yeni_Kayitlar_Yama.zip";
    a.click();
}

document.getElementById('search').oninput = () => renderList(true);
document.getElementById('btn-load-more').onclick = () => renderList(false);
window.onbeforeunload = () => Object.keys(sessionStorage).length > 0 ? true : null;
