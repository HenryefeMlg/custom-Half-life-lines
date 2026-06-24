let allFiles = []; 
let recordedBlobs = {}; 
let filteredFiles = [];
let renderedCount = 0;
const BATCH_SIZE = 50;

// 1. Klasör Seçme
document.getElementById('folder-select').onchange = (e) => {
    allFiles = Array.from(e.target.files)
        .filter(f => f.name.toLowerCase().endsWith('.wav'))
        .map(f => ({ name: f.name, relativePath: f.webkitRelativePath, file: f }));
    renderList(true);
};

// 2. Render ve Arama (Lazy Loading)
function renderList(reset = false) {
    const container = document.getElementById('sidebar-list-container');
    const search = document.getElementById('search-box').value.toLowerCase();
    
    if (reset) {
        renderedCount = 0;
        container.innerHTML = '';
        filteredFiles = allFiles.filter(f => f.relativePath.toLowerCase().includes(search));
    }

    const batch = filteredFiles.slice(renderedCount, renderedCount + BATCH_SIZE);
    
    batch.forEach(node => {
        const item = document.createElement('div');
        item.className = 'file-item' + (recordedBlobs[node.relativePath] ? ' done' : '');
        item.innerHTML = `<div><b>${node.name}</b></div><small style="font-size:11px;">${node.relativePath}</small>`;
        item.onclick = () => selectFile(node);
        container.appendChild(item);
    });

    renderedCount += BATCH_SIZE;
    document.getElementById('btn-load-more').style.display = (renderedCount < filteredFiles.length) ? 'block' : 'none';
}

// 3. Dosya Seçme ve Kayıt
let selectedNode = null;
let mediaRecorder;
let audioChunks = [];

function selectFile(node) {
    selectedNode = node;
    document.getElementById('current-file').innerText = node.relativePath;
    document.getElementById('btn-start').disabled = false;
}

document.getElementById('btn-start').onclick = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunks, { type: 'audio/wav' });
        recordedBlobs[selectedNode.relativePath] = blob;
        renderList(true); 
    };
    mediaRecorder.start();
    document.getElementById('btn-start').style.display = 'none';
    document.getElementById('btn-stop').style.display = 'block';
};

document.getElementById('btn-stop').onclick = () => {
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
    document.getElementById('btn-start').style.display = 'block';
    document.getElementById('btn-stop').style.display = 'none';
};

// 4. ZIP İşlemleri
document.getElementById('btn-download-mod').onclick = async () => {
    if(Object.keys(recordedBlobs).length === 0) return alert("Henüz bir ses kaydetmedin!");
    const zip = new JSZip();
    for (let path in recordedBlobs) {
        zip.file(path, recordedBlobs[path]);
    }
    const content = await zip.generateAsync({type:"blob"});
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = "mod_sesleri.zip";
    a.click();
};

document.getElementById('import-zip').onchange = async (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const zip = await JSZip.loadAsync(file);
    for (let path in zip.files) {
        if (!zip.files[path].dir) {
            recordedBlobs[path] = await zip.files[path].async("blob");
        }
    }
    renderList(true);
    alert("ZIP içeriği yüklendi!");
};

// 5. Arama ve Kontroller
document.getElementById('search-box').oninput = () => renderList(true);
document.getElementById('btn-load-more').onclick = () => renderList(false);

// 6. GÜVENLİK: Çıkış Uyarısı
window.addEventListener('beforeunload', function (e) {
    if (Object.keys(recordedBlobs).length > 0) {
        e.preventDefault();
        e.returnValue = ''; 
    }
});
