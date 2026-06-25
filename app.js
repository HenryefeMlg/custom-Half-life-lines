let allFiles = []; 
let renderedCount = 0;
let recordedData = {}; 

// 1. Orijinal Dosyaları Yükleme (Yolları ile birlikte hafızaya alır)
document.getElementById('f-input').onchange = (e) => {
    allFiles = Array.from(e.target.files).filter(f => f.name.endsWith('.wav') || f.name.endsWith('.txt'))
    .map(f => ({
        name: f.name,
        path: f.webkitRelativePath, // "sound/gman/ses.wav" yolunu hafızada tutar
        fileObj: f
    }));
    render(true);
};

// 2. ZIP Yükleme ve Uyarı Sistemi
document.getElementById('z-input').onchange = async (e) => {
    // EĞER ORİJİNAL KLASÖR YÜKLENMEDİYSE UYARI VER VE DURDUR
    if (allFiles.length === 0) {
        alert("LÜTFEN DİKKAT!\nÖnce 1. adımdaki 'Orijinal Klasörü Seç' butonuna basarak oyunun orijinal ses klasörünü yüklemelisiniz.");
        e.target.value = ''; 
        return;
    }

    const zip = await JSZip.loadAsync(e.target.files[0]);
    for(let relPath in zip.files) {
        if (!zip.files[relPath].dir) {
            recordedData[relPath] = await zip.files[relPath].async("blob");
        }
    }
    render(true);
    alert("Eski projeniz başarıyla ZIP'ten aktarıldı. İlgili dosyalar 'Zaten Var' olarak işaretlendi.");
};

// 3. Arama ve Liste Render (Zaten Var ibaresi eklendi)
function render(reset) {
    const list = document.getElementById('list');
    const search = document.getElementById('search').value.toLowerCase();
    if(reset) { list.innerHTML = ''; renderedCount = 0; }
    
    const filtered = allFiles.filter(f => f.path.toLowerCase().includes(search));
    const batch = filtered.slice(renderedCount, renderedCount + 50);
    
    batch.forEach(f => {
        const div = document.createElement('div');
        const isDone = recordedData[f.path]; // Bu yol ZIP'te veya kaydettiklerimiz arasında var mı?
        
        div.className = 'file-item' + (isDone ? ' done' : '');
        div.innerHTML = `
            <span>${f.name}</span>
            ${isDone ? '<span class="done-text">ZATEN VAR</span>' : ''}
        `;
        div.onclick = () => selectFile(f);
        list.appendChild(div);
    });
    renderedCount += 50;
    document.getElementById('load-more').style.display = (renderedCount < filtered.length) ? 'block' : 'none';
}

// 4. Dosya Seçimi ve Dinleme Sistemi
let currentFile = null;
async function selectFile(f) {
    currentFile = f;
    document.getElementById('fname').innerText = f.name;
    document.getElementById('fpath').innerText = f.path; // Orijinal yolu göster
    
    const isText = f.name.endsWith('.txt');
    document.getElementById('editor').style.display = isText ? 'block' : 'none';
    document.getElementById('recorder-ui').style.display = !isText ? 'flex' : 'none';
    
    if(isText) {
        document.getElementById('editor').value = recordedData[f.path] || await f.fileObj.text();
    } else {
        // SES DİNLEME MANTIĞI:
        // Eğer önceden kaydettiysek veya ZIP'ten yüklediysek ONU dinlet.
        // Yoksa dosyanın ORİJİNAL HALİNİ dinlet.
        const audioPlayer = document.getElementById('audio-player');
        if (recordedData[f.path]) {
            audioPlayer.src = URL.createObjectURL(recordedData[f.path]);
        } else {
            audioPlayer.src = URL.createObjectURL(f.fileObj);
        }
    }
}

// 5. Kayıt ve ZIP İçine Yazma
let mediaRecorder, chunks = [];
document.getElementById('btn-start').onclick = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({audio:true});
    mediaRecorder = new MediaRecorder(stream);
    chunks = [];
    mediaRecorder.ondataavailable = e => chunks.push(e.data);
    mediaRecorder.onstop = () => {
        const newAudioBlob = new Blob(chunks, { type: 'audio/wav' });
        recordedData[currentFile.path] = newAudioBlob; // Dosyayı kendi orijinal yoluyla hafızaya al
        
        // Kaydedilen yeni sesi direkt oynatıcıya koy
        document.getElementById('audio-player').src = URL.createObjectURL(newAudioBlob);
        
        render(true); // Listeyi güncelle (Zaten Var yazısı eklensin)
    };
    mediaRecorder.start();
    document.getElementById('btn-start').style.display = 'none';
    document.getElementById('btn-stop').style.display = 'block';
};

document.getElementById('btn-stop').onclick = () => {
    mediaRecorder.stop();
    document.getElementById('btn-start').style.display = 'block';
    document.getElementById('btn-stop').style.display = 'none';
};

// JSZip dosya yollarını (path) algılayıp klasörleri otomatik oluşturur.
async function downloadZip() {
    if (Object.keys(recordedData).length === 0) {
        return alert("Henüz hiçbir ses kaydetmediniz veya metin düzenlemediniz.");
    }
    const zip = new JSZip();
    
    // Hafızadaki tüm kayıtları ZIP'in "içine yaz"
    for(let path in recordedData) {
        zip.file(path, recordedData[path]);
    }
    
    const blob = await zip.generateAsync({type:"blob"});
    const a = document.createElement('a'); 
    a.href = URL.createObjectURL(blob); 
    a.download = "hl_ses_modu.zip"; 
    a.click();
}

// Dinleyiciler ve Güvenlik
document.getElementById('search').oninput = () => render(true);
document.getElementById('load-more').onclick = () => render(false);
window.onbeforeunload = () => (Object.keys(recordedData).length > 0) ? true : null;

// Metin dosyası düzenlendiğinde direkt hafızaya kaydet
document.getElementById('editor').oninput = (e) => {
    if(currentFile && currentFile.name.endsWith('.txt')) {
        recordedData[currentFile.path] = e.target.value;
        render(true);
    }
};
