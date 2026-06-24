let mediaRecorder = null;
let audioChunks = [];
let selectedAudioFile = null;
let currentMode = 'audio';
let activeTextFile = 'titles';
let virtualFiles = [];
let globalStream = null;
let projects = JSON.parse(localStorage.getItem('hl_projects')) || [{ id: 'proj_default', name: 'Ana Proje', savedFiles: {}, editedTexts: {} }];
let activeProjectId = localStorage.getItem('hl_active_project') || 'proj_default';
let allFiles = []; // Tüm dosyaları burada tutacağız (RAM'de, localStorage'da değil!)
let renderedCount = 0;
const BATCH_SIZE = 50; // Her seferde 50 tane çizecek

// Klasör seçildiğinde çalışan fonksiyon
folderSelect.onchange = function(e) {
    const files = e.target.files;
    allFiles = []; // Sıfırla
    renderedCount = 0;
    
    for (let i = 0; i < files.length; i++) {
        if (files[i].name.toLowerCase().endsWith('.wav')) {
            allFiles.push({
                name: files[i].name,
                relativePath: files[i].webkitRelativePath,
                fileObject: files[i]
            });
        }
    }
    document.getElementById('sidebar-list-container').innerHTML = ''; // Temizle
    renderList(true); // İlk 50'yi yükle
};

// Parça parça yükleyen fonksiyon
function renderList(clear = false) {
    const container = document.getElementById('sidebar-list-container');
    const searchTerm = document.getElementById('search-box').value.toLowerCase();
    
    if (clear) {
        container.innerHTML = '';
        renderedCount = 0;
    }

    // Filtrele
    const filtered = allFiles.filter(f => 
        f.name.toLowerCase().includes(searchTerm) || 
        f.relativePath.toLowerCase().includes(searchTerm)
    );

    // Render edilecek dilimi al
    const toRender = filtered.slice(renderedCount, renderedCount + BATCH_SIZE);
    
    if (toRender.length === 0 && renderedCount === 0) {
        container.innerHTML = '<div style="padding:10px; color:#8e8e93;">Dosya bulunamadı.</div>';
        return;
    }

    toRender.forEach(node => {
        const item = document.createElement('div');
        item.className = 'file-item';
        
        // Zaten kaydedilmiş mi kontrol et (Eski ZIP'ten yüklediysek)
        const isDone = projects.find(p => p.id === activeProjectId).savedFiles[node.relativePath];
        if (isDone) item.style.borderLeft = "4px solid #10ac84";

        item.innerHTML = `
            <span style="font-size:13px;">${isDone ? "✅ " : "🔊 "} <b>${node.name}</b></span>
            <small style="color:#666; font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${node.relativePath}</small>
        `;

        item.onclick = () => {
            selectedAudioFile = node;
            // ... (önceki seçme mantığı buraya)
        };
        container.appendChild(item);
    });

    renderedCount += BATCH_SIZE;
    
    // "Daha Fazla" butonunu gizle/göster
    document.getElementById('btn-load-more').style.display = 
        (renderedCount < filtered.length) ? 'block' : 'none';
}

// "Daha Fazla Yükle" butonu
document.getElementById('btn-load-more').onclick = () => renderList(false);

// Arama kutusu değişince listeyi temizleyip yeniden başlat
document.getElementById('search-box').oninput = () => renderList(true);

// 📂 ZIP YÜKLEME (ESKİ KAYITLARI GÖRMEK İÇİN)
document.getElementById('import-zip').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const zip = await JSZip.loadAsync(file);
    const currentProj = projects.find(p => p.id === activeProjectId);
    
    // Klasör içindeki sesleri tara
    const soundFolder = zip.folder("valve/sound");
    if (soundFolder) {
        soundFolder.forEach(async (relativePath, zipEntry) => {
            if (!zipEntry.dir && (relativePath.endsWith('.wav'))) {
                const blob = await zipEntry.async("blob");
                const reader = new FileReader();
                reader.onloadend = () => {
                    currentProj.savedFiles[relativePath] = reader.result;
                    saveToStorage();
                    renderAudioTree(); // Listeyi güncelle
                };
                reader.readAsDataURL(blob);
            }
        });
        alert("Eski kayıtlarınız yüklendi! ✅");
    }
};

// ... (Diğer fonksiyonlar aynı kalacak) ...

function renderAudioTree() {
    if (currentMode !== 'audio') return;
    const container = document.getElementById('sidebar-list-container');
    container.innerHTML = '';

    const currentProj = projects.find(p => p.id === activeProjectId);
    let groups = {};
    
    virtualFiles.forEach(f => {
        let parts = f.relativePath.split('/');
        let folderName = parts.length > 1 ? parts[0] : 'DİĞER';
        if (!groups[folderName]) groups[folderName] = [];
        groups[folderName].push(f);
    });

    for (let folder in groups) {
        const folderHeader = document.createElement('div');
        folderHeader.className = 'folder-item';
        folderHeader.innerText = '📁 ' + folder.toUpperCase();
        container.appendChild(folderHeader);

        groups[folder].forEach(node => {
            const item = document.createElement('div');
            item.className = 'file-item';
            
            // ✅ BURASI ÖNEMLİ: Zaten yapılmışsa işaretle
            const isDone = currentProj.savedFiles && currentProj.savedFiles[node.relativePath];
            if (isDone) item.style.borderLeft = "4px solid #10ac84";

            const span = document.createElement('span');
            span.innerText = (isDone ? "✅ " : "🔊 ") + node.name;
            item.appendChild(span);

            if (isDone) {
                const badge = document.createElement('span');
                badge.className = 'badge-saved';
                badge.innerText = 'TAMAMLANDI';
                item.appendChild(badge);
            }

            item.onclick = () => {
                selectedAudioFile = node;
                document.querySelectorAll('.file-item').forEach(el => el.classList.remove('active'));
                item.classList.add('active');
                document.getElementById('current-file').innerText = `Seçilen: ${node.relativePath}`;
                
                // Butonları güncelle
                document.getElementById('btn-play-original').disabled = false;
                document.getElementById('btn-play-custom').style.display = isDone ? 'inline-block' : 'none';
                document.getElementById('btn-start').disabled = false;
            };
            container.appendChild(item);
        });
    }
}

// 🛑 HAFIZA KONTROLLÜ KAYDETME
function saveToStorage() {
    try {
        localStorage.setItem('hl_projects', JSON.stringify(projects));
        localStorage.setItem('hl_active_project', activeProjectId);
    } catch(e) {
        alert("⚠️ HAFIZA DOLDU! Lütfen 'MODU ZIP OLARAK İNDİR' butonuna basıp çalışmalarını kaydet ve sonra tarayıcıdan temizle.");
    }
}

// ... (Geri kalan kod yapısı öncekiyle aynı olmalı, sadece `renderAudioTree` ve `saveToStorage` güncellendi) ...
