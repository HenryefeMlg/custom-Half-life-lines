let allFiles = []; 
let projects = { savedFiles: {}, editedTexts: { titles: "", sentences: "" } };
let currentTab = 'audio';
let renderedCount = 0;
const BATCH_SIZE = 50;

// 1. Klasör Seçme (Txt'leri dışla, sadece gerekli olanları al)
document.getElementById('folder-select').onchange = (e) => {
    allFiles = Array.from(e.target.files).filter(f => 
        f.name.toLowerCase().endsWith('.wav') || 
        f.name.toLowerCase().includes('titles') || 
        f.name.toLowerCase().includes('sentences')
    );
    renderList(true);
};

// 2. Render ve Sekme Yönetimi
function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.toggle('active', t.innerText.toLowerCase().includes(tab)));
    renderList(true);
}

function renderList(reset = false) {
    const container = document.getElementById('sidebar-list-container');
    const search = document.getElementById('search-box').value.toLowerCase();
    if (reset) { container.innerHTML = ''; renderedCount = 0; }

    const filtered = allFiles.filter(f => {
        if (currentTab === 'audio') return f.name.endsWith('.wav') && f.name.toLowerCase().includes(search);
        return f.name.toLowerCase().includes(currentTab) && f.name.toLowerCase().includes(search);
    });

    const batch = filtered.slice(renderedCount, renderedCount + BATCH_SIZE);
    batch.forEach(node => {
        const item = document.createElement('div');
        item.className = 'file-item' + (projects.savedFiles[node.name] ? ' done' : '');
        item.innerHTML = `<div>${node.name}</div>`;
        item.onclick = () => selectFile(node);
        container.appendChild(item);
    });

    renderedCount += BATCH_SIZE;
    document.getElementById('btn-load-more').style.display = (renderedCount < filtered.length) ? 'block' : 'none';
}

// 3. Dosya Seçme / Editör / Kayıt
function selectFile(node) {
    document.getElementById('current-title').innerText = node.name;
    document.getElementById('audio-controls').style.display = node.name.endsWith('.wav') ? 'block' : 'none';
    document.getElementById('editor').style.display = node.name.includes('.txt') ? 'block' : 'none';
}

// 4. ZIP İşlemleri
document.getElementById('btn-download-mod').onclick = async () => {
    const zip = new JSZip();
    for (let name in projects.savedFiles) zip.file(name, projects.savedFiles[name]);
    zip.file("titles.txt", projects.editedTexts.titles);
    zip.file("sentences.txt", projects.editedTexts.sentences);
    const blob = await zip.generateAsync({type:"blob"});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = "mod_paketi.zip"; a.click();
};

document.getElementById('import-zip').onchange = async (e) => {
    const zip = await JSZip.loadAsync(e.target.files[0]);
    for (let path in zip.files) {
        if (path.endsWith('.wav')) projects.savedFiles[path] = await zip.files[path].async("blob");
        if (path.includes('titles')) projects.editedTexts.titles = await zip.files[path].async("string");
        if (path.includes('sentences')) projects.editedTexts.sentences = await zip.files[path].async("string");
    }
    alert("ZIP yüklendi!");
    renderList(true);
};

// 5. Güvenlik
window.addEventListener('beforeunload', (e) => {
    if (Object.keys(projects.savedFiles).length > 0) { e.preventDefault(); e.returnValue = ''; }
});

document.getElementById('search-box').oninput = () => renderList(true);
document.getElementById('btn-load-more').onclick = () => renderList(false);
