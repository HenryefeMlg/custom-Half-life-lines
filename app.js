let mediaRecorder = null;
let audioChunks = [];
let selectedAudioFile = null;
let currentMode = 'audio';
let activeTextFile = 'titles';
let isLazyLoad = true;
let loadedTextCount = 0;
const TEXT_PAGE_SIZE = 15;
let virtualFiles = [];
let globalStream = null;

const hlTitlesData = [
    { key: "HLS_TITLE", val: "HALF-LIFE" },
    { key: "HLS_NAME", val: "Gordon Freeman" },
    { key: "HLS_INTRO_1", val: "Welcome to the Black Mesa Research Facility." },
    { key: "HLS_INTRO_2", val: "This automated train is provided for the comfort and convenience of..." },
    { key: "HLS_INTRO_3", val: "The time is 8:47 AM. Current topside temperature is 93 degrees." },
    { key: "HLS_STAGE", val: "Anomalous Materials Laboratory" },
    { key: "HLS_WARNING", val: "Danger: High Voltage Radiation Hazard Ahead." }
];

const hlSentencesData = [
    { key: "SCI_HEAL1", val: "Hold still, this will only hurt for a moment." },
    { key: "SCI_PAIN1", val: "Ah! Get away from me!" },
    { key: "HEV_DEAD", val: "Emergency! User death imminent." },
    { key: "HEV_MED4", val: "Medical power depleted." },
    { key: "BARNEY_HEAL", val: "Good thing I had my vest on, let's go doc." },
    { key: "GMAN_MOCK", val: "Wisely done, Mr. Freeman. I will see you up ahead." }
];

function getActiveTextData() {
    return activeTextFile === 'titles' ? hlTitlesData : hlSentencesData;
}

let projects = [];
try {
    projects = JSON.parse(localStorage.getItem('hl_projects')) || [];
} catch(e) {
    projects = [];
}
if (projects.length === 0) {
    projects.push({ id: 'proj_default', name: 'Otomatik Kaydetme 1', savedFiles: {}, editedTexts: {} });
}
let activeProjectId = localStorage.getItem('hl_active_project') || 'proj_default';

function switchMode(mode) {
    currentMode = mode;
    const tabAudio = document.getElementById('tab-audio-mode');
    const tabText = document.getElementById('tab-text-mode');
    const audioSpace = document.getElementById('audio-work-space');
    const textSpace = document.getElementById('text-work-space');

    if(tabAudio) tabAudio.classList.toggle('active', mode === 'audio');
    if(tabText) tabText.classList.toggle('active', mode === 'text');
    if(audioSpace) audioSpace.classList.toggle('active', mode === 'audio');
    if(textSpace) textSpace.classList.toggle('active', mode === 'text');

    const titleEl = document.getElementById('sidebar-title');
    if (titleEl) {
        if (mode === 'audio') {
            titleEl.innerText = "Ses Dosyaları";
            renderAudioTree();
        } else {
            titleEl.innerText = "Metin Dosyaları";
            renderTextSidebar();
            initTextWorkspace();
        }
    }
}

const folderSelect = document.getElementById('folder-select');
if(folderSelect) {
    folderSelect.onchange = function(e) {
        const files = e.target.files;
        virtualFiles = [];
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.name.endsWith('.wav')) {
                let relPath = file.webkitRelativePath;
                let soundIndex = relPath.indexOf('/sound/');
                if (soundIndex !== -1) {
                    relPath = relPath.substring(soundIndex + 7);
                } else {
                    relPath = relPath.substring(relPath.indexOf('/') + 1);
                }
                virtualFiles.push({
                    name: file.name,
                    relativePath: relPath,
                    fileObject: file
                });
            }
        }
        renderAudioTree();
    };
}

function renderAudioTree() {
    if (currentMode !== 'audio') return;
    const container = document.getElementById('sidebar-list-container');
    if(!container) return;
    container.innerHTML = '';

    if (virtualFiles.length === 0) {
        container.innerHTML = '<span style="color:#8e8e93; font-size:13px;">Lütfen sol üstten orijinal "sound" klasörünü seçin.</span>';
        return;
    }

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
            if (selectedAudioFile && selectedAudioFile.relativePath === node.relativePath) item.classList.add('active');

            const span = document.createElement('span');
            span.innerText = "🔊 " + node.name;
            item.appendChild(span);

            if (currentProj && currentProj.savedFiles && currentProj.savedFiles[node.relativePath]) {
                const badge = document.createElement('span');
                badge.className = 'badge-saved';
                badge.innerText = 'Önceden Kaydedildi';
                item.appendChild(badge);
            }

            item.onclick = () => {
                selectedAudioFile = node;
                document.querySelectorAll('.file-item').forEach(el => el.classList.remove('active'));
                item.classList.add('active');
                
                const curFileEl = document.getElementById('current-file');
                const btnPlayOrig = document.getElementById('btn-play-original');
                const btnStart = document.getElementById('btn-start');
                const btnPlayCust = document.getElementById('btn-play-custom');

                if(curFileEl) curFileEl.innerText = `Seçilen: ${node.relativePath}`;
                if(btnPlayOrig) btnPlayOrig.disabled = false;
                if(btnStart) btnStart.disabled = false;
                
                if (btnPlayCust) {
                    if (currentProj && currentProj.savedFiles && currentProj.savedFiles[node.relativePath]) {
                        btnPlayCust.style.display = 'inline-block';
                    } else {
                        btnPlayCust.style.display = 'none';
                    }
                }
            };
            container.appendChild(item);
        });
    }
}

const btnPlayOriginal = document.getElementById('btn-play-original');
if(btnPlayOriginal) {
    btnPlayOriginal.onclick = () => {
        if (selectedAudioFile) {
            const url = URL.createObjectURL(selectedAudioFile.fileObject);
            const audio = new Audio(url);
            audio.play();
        }
    };
}

const btnPlayCustom = document.getElementById('btn-play-custom');
if(btnPlayCustom) {
    btnPlayCustom.onclick = () => {
        const currentProj = projects.find(p => p.id === activeProjectId);
        if (selectedAudioFile && currentProj && currentProj.savedFiles[selectedAudioFile.relativePath]) {
            const base64Data = currentProj.savedFiles[selectedAudioFile.relativePath];
            const audio = new Audio(base64Data);
            audio.play();
        }
    };
}

// 🎙️ SES BAŞLATICI
const btnStart = document.getElementById('btn-start');
if(btnStart) {
    btnStart.onclick = async () => {
        try {
            if (globalStream) {
                globalStream.getTracks().forEach(track => track.stop());
            }
            
            audioChunks = [];
            globalStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(globalStream);
            
            mediaRecorder.ondataavailable = event => {
                if (event.data && event.data.size > 0) {
                    audioChunks.push(event.data);
                }
            };
            
            mediaRecorder.onstop = () => {
                if (audioChunks.length === 0) {
                    alert("Ses verisi alınamadı, tekrar deneyin.");
                    resetRecordingUI();
                    return;
                }
                
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = function() {
                    try {
                        const base64String = reader.result;
                        const currentProj = projects.find(p => p.id === activeProjectId);
                        if (!currentProj.savedFiles) currentProj.savedFiles = {};
                        
                        currentProj.savedFiles[selectedAudioFile.relativePath] = base64String;
                        saveToStorage();
                        
                        document.getElementById('status').innerText = "Kayıt Başarıyla Yazıldı!";
                        if(document.getElementById('btn-play-custom')) document.getElementById('btn-play-custom').style.display = 'inline-block';
                    } catch(storageError) {
                        // HAFIZA DOLSA BİLE ARTIK KOD KİLİTLENMEYECEK
                        alert("UYARI: Tarayıcı hafızası tamamen doldu! Modu kaybetmemek için hemen aşağıdaki yeşil butondan MODU ZIP OLARAK İNDİRİN.");
                        document.getElementById('status').innerText = "Hafıza Dolu! Lütfen modu ZIP olarak indirin.";
                    }
                    resetRecordingUI();
                    renderAudioTree();
                }
            };

            mediaRecorder.start();
            if(document.getElementById('btn-start')) document.getElementById('btn-start').style.display = 'none';
            if(document.getElementById('btn-stop')) document.getElementById('btn-stop').style.display = 'inline-block';
            document.getElementById('status').innerText = "🎙️ Kayıt yapılıyor... Konuşun.";
        } catch (err) {
            alert("Mikrofon başlatılamadı: " + err);
        }
    };
}

// 🛑 DURDURUCU
const btnStop = document.getElementById('btn-stop');
if(btnStop) {
    btnStop.onclick = () => {
        document.getElementById('status').innerText = "Kayıt tamamlanıyor...";

        if (mediaRecorder && mediaRecorder.state === "recording") {
            mediaRecorder.requestData();
            mediaRecorder.stop();
        }
        if (globalStream) {
            globalStream.getTracks().forEach(track => track.stop());
            globalStream = null;
        }
    };
}

function resetRecordingUI() {
    if(document.getElementById('btn-start')) document.getElementById('btn-start').style.display = 'inline-block';
    if(document.getElementById('btn-stop')) document.getElementById('btn-stop').style.display = 'none';
}

function renderTextSidebar() {
    const container = document.getElementById('sidebar-list-container');
    if(!container) return;
    container.innerHTML = `
        <div class="file-item ${activeTextFile === 'titles' ? 'active' : ''}" onclick="selectTextFile('titles')">
            <span>📄 titles.txt (Ekran Yazıları)</span>
        </div>
        <div class="file-item ${activeTextFile === 'sentences' ? 'active' : ''}" onclick="selectTextFile('sentences')">
            <span>📄 sentences.txt (Telsiz Cümleleri)</span>
        </div>
    `;
}

function selectTextFile(type) {
    activeTextFile = type;
    renderTextSidebar();
    initTextWorkspace();
}

function initTextWorkspace() {
    const box = document.getElementById('text-items-box');
    if(!box) return;
    box.innerHTML = '';
    loadedTextCount = 0;
    isLazyLoad = true;
    if(document.getElementById('load-indicator')) {
        document.getElementById('load-indicator').innerText = "Lazy Load";
        document.getElementById('load-indicator').style.color = "#00ffcc";
    }

    loadMoreTexts();

    box.onscroll = () => {
        if (!isLazyLoad) return;
        if (box.scrollTop + box.clientHeight >= box.scrollHeight - 20) {
            loadMoreTexts();
        }
    };
}

function loadMoreTexts() {
    const data = getActiveTextData();
    if (loadedTextCount >= data.length) return;
    
    const box = document.getElementById('text-items-box');
    if(!box) return;
    const oldTrigger = document.getElementById('lazy-trigger-msg');
    if(oldTrigger) oldTrigger.remove();

    const targetEnd = Math.min(loadedTextCount + TEXT_PAGE_SIZE, data.length);
    const currentProj = projects.find(p => p.id === activeProjectId);

    for (let i = loadedTextCount; i < targetEnd; i++) {
        const item = data[i];
        const row = document.createElement('div');
        row.className = 'text-row';

        const keyDiv = document.createElement('div');
        keyDiv.className = 'text-key';
        keyDiv.innerText = item.key;

        const input = document.createElement('input');
        input.className = 'text-val';
        input.value = (currentProj && currentProj.editedTexts && currentProj.editedTexts[item.key]) ? currentProj.editedTexts[item.key] : item.val;
        
        input.onchange = (e) => {
            if(!currentProj.editedTexts) currentProj.editedTexts = {};
            currentProj.editedTexts[item.key] = e.target.value;
            saveToStorage();
        };

        row.appendChild(keyDiv);
        row.appendChild(input);
        box.appendChild(row);
    }

    loadedTextCount = targetEnd;

    if (loadedTextCount < data.length && isLazyLoad) {
        const trigger = document.createElement('div');
        trigger.id = 'lazy-trigger-msg';
        trigger.className = 'loading-trigger';
        trigger.innerText = "Aşağı kaydırdıkça yeni satırlar yükleniyor...";
        box.appendChild(trigger);
    }
}

const btnLoadAllText = document.getElementById('btn-load-all-text');
if(btnLoadAllText) {
    btnLoadAllText.onclick = () => {
        isLazyLoad = false;
        if(document.getElementById('load-indicator')) {
            document.getElementById('load-indicator').innerText = "Hepsini Yükle";
            document.getElementById('load-indicator').style.color = "#ff9f43";
        }
        
        const box = document.getElementById('text-items-box');
        if(!box) return;
        const oldTrigger = document.getElementById('lazy-trigger-msg');
        if(oldTrigger) oldTrigger.remove();

        const data = getActiveTextData();
        const currentProj = projects.find(p => p.id === activeProjectId);
        
        for (let i = loadedTextCount; i < data.length; i++) {
            const item = data[i];
            const row = document.createElement('div');
            row.className = 'text-row';

            const keyDiv = document.createElement('div');
            keyDiv.className = 'text-key';
            keyDiv.innerText = item.key;

            const input = document.createElement('input');
            input.className = 'text-val';
            input.value = (currentProj && currentProj.editedTexts && currentProj.editedTexts[item.key]) ? currentProj.editedTexts[item.key] : item.val;
            
            input.onchange = (e) => {
                if(!currentProj.editedTexts) currentProj.editedTexts = {};
                currentProj.editedTexts[item.key] = e.target.value;
                saveToStorage();
            };

            row.appendChild(keyDiv);
            row.appendChild(input);
            box.appendChild(row);
        }
        loadedTextCount = data.length;
    };
}

function renderProjects() {
    const listEl = document.getElementById('project-list');
    if(!listEl) return;
    listEl.innerHTML = '';
    projects.forEach(proj => {
        const card = document.createElement('div');
        card.className = `project-card ${proj.id === activeProjectId ? 'active' : ''}`;
        
        const input = document.createElement('input');
        input.value = proj.name;
        input.onchange = (e) => {
            proj.name = e.target.value;
            saveToStorage();
        };

        card.onclick = (e) => {
            if (e.target !== input) {
                activeProjectId = proj.id;
                saveToStorage();
                renderProjects();
                switchMode(currentMode);
            }
        };

        card.appendChild(input);
        listEl.appendChild(card);
    });
}

function saveToStorage() {
    try {
        localStorage.setItem('hl_projects', JSON.stringify(projects));
        localStorage.setItem('hl_active_project', activeProjectId);
    } catch(e) {
        throw e; // Üstteki try-catch bloğuna hatayı fırlat ki arayüzü kurtarabilsin
    }
}

const btnNewProject = document.getElementById('btn-new-project');
if(btnNewProject) {
    btnNewProject.onclick = () => {
        const idx = projects.length + 1;
        const newProj = { id: 'proj_' + Date.now(), name: `Otomatik Kaydetme ${idx}`, savedFiles: {}, editedTexts: {} };
        projects.push(newProj);
        activeProjectId = newProj.id;
        try {
            saveToStorage();
        } catch(e) {}
        renderProjects();
        switchMode(currentMode);
    };
}

const btnDownloadMod = document.getElementById('btn-download-mod');
if(btnDownloadMod) {
    btnDownloadMod.onclick = async () => {
        const currentProj = projects.find(p => p.id === activeProjectId);
        if (!currentProj) return alert("Aktif proje bulunamadı!");

        const zip = new JSZip();
        const valveFolder = zip.folder("valve");
        const soundFolder = valveFolder.folder("sound");

        if (currentProj.savedFiles) {
            for (let relPath in currentProj.savedFiles) {
                const base64Data = currentProj.savedFiles[relPath];
                const response = await fetch(base64Data);
                const blob = await response.blob();
                soundFolder.file(relPath, blob);
            }
        }

        let titlesContent = "";
        hlTitlesData.forEach(item => {
            let finalVal = (currentProj.editedTexts && currentProj.editedTexts[item.key]) ? currentProj.editedTexts[item.key] : item.val;
            titlesContent += `${item.key}\n{\n"${finalVal}"\n}\n\n`;
        });
        valveFolder.file("titles.txt", titlesContent);

        let sentencesContent = "";
        hlSentencesData.forEach(item => {
            let finalVal = (currentProj.editedTexts && currentProj.editedTexts[item.key]) ? currentProj.editedTexts[item.key] : item.val;
            sentencesContent += `${item.key} ${finalVal}\n`;
        });
        valveFolder.file("sentences.txt", sentencesContent);

        zip.generateAsync({ type: "blob" }).then(function(content) {
            const link = document.createElement("a");
            link.href = URL.createObjectURL(content);
            link.download = currentProj.name.replace(/\s+/g, '_') + "_Mod_Paketi.zip";
            link.click();
        });
    };
}

renderProjects();
switchMode('audio');
