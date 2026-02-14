const API_URL = "http://localhost:8000";

// Elements
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const processingOverlay = document.getElementById('processing-overlay');
const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');

const mixer = document.getElementById('mixer');
const mixerControls = document.getElementById('mixer-controls');
const keyBadge = document.getElementById('key-badge');
const keyText = keyBadge.querySelector('span');
const masterPlayBtn = document.getElementById('master-play');
const masterStopBtn = document.getElementById('master-stop');
const backBtn = document.getElementById('back-btn');
const historyContainer = document.getElementById('history-container');

// ... (Sticky Player Removed)

// State
let stemsData = {};
let players = {};
let isPlaying = false;
let soloTrack = null;
let currentTrackName = "";
let currentUploadController = null;
let pollInterval = null; // For progress polling

const stemOrder = ['drums', 'bass', 'vocals', 'other'];
const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200 MB

// Init
// Init
// Init
const translations = {
    en: {
        app_title: "Audio Extractor",
        subtitle: "Multitrack Studio",
        drop_text: "DROP AUDIO FILE",
        processing: "PROCESSING AUDIO...",
        initializing: "INITIALIZING...",
        cancel: "CANCEL",
        please_wait: "PLEASE WAIT",
        play_all: "PLAY ALL",
        pause_all: "PAUSE",
        stop: "STOP",
        recent_tracks: "Recent Tracks",
        no_history: "No history yet",
        delete_modal_title: "Delete File?",
        delete_modal_msg: "Are you sure you want to delete this track?",
        delete: "Delete",
        back_title: "Back to Upload",
        file_too_large: "File exceeds 200MB limit.",
        upload_aborted: "Upload aborted by user.",
        error_prefix: "Error: ",
        delete_success_msg: "File deleted successfully.",
        status_starting: "STARTING",
        status_calculating: "CALCULATING TIME...",
        status_remaining: "REMAINING",
        status_initializing: "INITIALIZING"
    },
    zh_tw: {
        app_title: "音訊提取器",
        subtitle: "多軌工作室",
        drop_text: "拖放音訊檔案",
        processing: "處理音訊中...",
        initializing: "初始化中...",
        cancel: "取消",
        please_wait: "請稍候",
        play_all: "全部播放",
        pause_all: "暫停",
        stop: "停止",
        recent_tracks: "最近的紀錄",
        no_history: "尚無紀錄",
        delete_modal_title: "刪除檔案？",
        delete_modal_msg: "確定要刪除此音軌嗎？此動作無法復原。",
        delete: "刪除",
        back_title: "返回上傳",
        file_too_large: "檔案超過 200MB 限制。",
        upload_aborted: "上傳已由使用者取消。",
        error_prefix: "錯誤: ",
        delete_success_msg: "檔案已刪除。",
        status_starting: "開始中",
        status_calculating: "計算時間中...",
        status_remaining: "剩餘",
        status_initializing: "初始化中"
    },
    zh_cn: {
        app_title: "音频提取器",
        subtitle: "多轨工作室",
        drop_text: "拖放音频文件",
        processing: "处理音频中...",
        initializing: "初始化中...",
        cancel: "取消",
        please_wait: "请稍候",
        play_all: "全部播放",
        pause_all: "暂停",
        stop: "停止",
        recent_tracks: "最近的记录",
        no_history: "尚无记录",
        delete_modal_title: "删除档案？",
        delete_modal_msg: "确定要删除此音轨吗？此操作无法撤销。",
        delete: "删除",
        back_title: "返回上传",
        file_too_large: "文件超过 200MB 限制。",
        upload_aborted: "上传已由用户取消。",
        error_prefix: "错误: ",
        delete_success_msg: "文件已删除。",
        status_starting: "开始中",
        status_calculating: "计算时间中...",
        status_remaining: "剩余",
        status_initializing: "初始化中"
    },
    ja: {
        app_title: "オーディオ抽出",
        subtitle: "マルチトラックスタジオ",
        drop_text: "ファイルをドロップ",
        processing: "処理中...",
        initializing: "初期化中...",
        cancel: "キャンセル",
        please_wait: "お待ちください",
        play_all: "すべて再生",
        pause_all: "一時停止",
        stop: "停止",
        recent_tracks: "最近の履歴",
        no_history: "履歴なし",
        delete_modal_title: "ファイルを削除？",
        delete_modal_msg: "このトラックを削除してもよろしいですか？",
        delete: "削除",
        back_title: "アップロードに戻る",
        file_too_large: "ファイルが200MBを超えています。",
        upload_aborted: "アップロードがキャンセルされました。",
        error_prefix: "エラー: ",
        delete_success_msg: "ファイルが削除されました。",
        status_starting: "開始中",
        status_calculating: "計算中...",
        status_remaining: "残り",
        status_initializing: "初期化中"
    },
    ko: {
        app_title: "오디오 추출기",
        subtitle: "멀티트랙 스튜디오",
        drop_text: "오디오 파일 드롭",
        processing: "오디오 처리 중...",
        initializing: "초기화 중...",
        cancel: "취소",
        please_wait: "기다려 주세요",
        play_all: "모두 재생",
        pause_all: "일시 정지",
        stop: "정지",
        recent_tracks: "최근 기록",
        no_history: "기록 없음",
        delete_modal_title: "파일 삭제?",
        delete_modal_msg: "이 트랙을 삭제하시겠습니까?",
        delete: "삭제",
        back_title: "업로드로 돌아가기",
        file_too_large: "파일이 200MB를 초과합니다.",
        upload_aborted: "업로드가 취소되었습니다.",
        error_prefix: "오류: ",
        delete_success_msg: "파일이 삭제되었습니다.",
        status_starting: "시작 중",
        status_calculating: "계산 중...",
        status_remaining: "남음",
        status_initializing: "초기화 중"
    },
    es: {
        app_title: "Extractor de Audio",
        subtitle: "Estudio Multipista",
        drop_text: "ARRASTRA ARCHIVO AQUÍ",
        processing: "PROCESANDO...",
        initializing: "INICIALIZANDO...",
        cancel: "CANCELAR",
        please_wait: "POR FAVOR ESPERE",
        play_all: "REPRODUCIR TODO",
        pause_all: "PAUSA",
        stop: "DETENER",
        recent_tracks: "Pistas Recientes",
        no_history: "Sin historial",
        delete_modal_title: "¿Eliminar Archivo?",
        delete_modal_msg: "¿Estás seguro de que deseas eliminar esta pista?",
        delete: "Eliminar",
        back_title: "Volver a Subir",
        file_too_large: "El archivo excede el límite de 200MB.",
        upload_aborted: "Subida cancelada por el usuario.",
        error_prefix: "Error: ",
        delete_success_msg: "Archivo eliminado.",
        status_starting: "INICIANDO",
        status_calculating: "CALCULANDO...",
        status_remaining: "RESTANTES",
        status_initializing: "INICIALIZANDO"
    },
    fr: {
        app_title: "Extracteur Audio",
        subtitle: "Studio Multipiste",
        drop_text: "DÉPOSER UN FICHIER AUDIO",
        processing: "TRAITEMENT EN COURS...",
        initializing: "INITIALISATION...",
        cancel: "ANNULER",
        please_wait: "VEUILLEZ PATIENTER",
        play_all: "TOUT LIRE",
        pause_all: "PAUSE",
        stop: "ARRÊTER",
        recent_tracks: "Pistes Récentes",
        no_history: "Aucun historique",
        delete_modal_title: "Supprimer le fichier ?",
        delete_modal_msg: "Êtes-vous sûr de vouloir supprimer cette piste ?",
        delete: "Supprimer",
        back_title: "Retour",
        file_too_large: "Le fichier dépasse 200 Mo.",
        upload_aborted: "Téléchargement annulé.",
        error_prefix: "Erreur : ",
        delete_success_msg: "Fichier supprimé.",
        status_starting: "DÉMARRAGE",
        status_calculating: "CALCUL...",
        status_remaining: "RESTANT",
        status_initializing: "INITIALISATION"
    },
    de: {
        app_title: "Audio Extractor",
        subtitle: "Mehrspur-Studio",
        drop_text: "AUDIODATEI HIER ABLEGEN",
        processing: "VERARBEITE AUDIO...",
        initializing: "INITIALISIERUNG...",
        cancel: "ABBRECHEN",
        please_wait: "BITTE WARTEN",
        play_all: "ALLE ABSPIELEN",
        pause_all: "PAUSE",
        stop: "STOPP",
        recent_tracks: "Letzte Titel",
        no_history: "Kein Verlauf",
        delete_modal_title: "Datei löschen?",
        delete_modal_msg: "Möchten Sie diesen Titel wirklich löschen?",
        delete: "Löschen",
        back_title: "Zurück",
        file_too_large: "Datei überschreitet 200 MB.",
        upload_aborted: "Upload abgebrochen.",
        error_prefix: "Fehler: ",
        delete_success_msg: "Datei gelöscht.",
        status_starting: "STARTEN",
        status_calculating: "BERECHNE...",
        status_remaining: "VERBLEIBEND",
        status_initializing: "INITIALISIERUNG"
    },
    ru: {
        app_title: "Аудио Экстрактор",
        subtitle: "Мультитрековая Студия",
        drop_text: "ПЕРЕТАЩИТЕ ФАЙЛ СЮДА",
        processing: "ОБРАБОТКА...",
        initializing: "ИНИЦИАЛИЗАЦИЯ...",
        cancel: "ОТМЕНА",
        please_wait: "ПОЖАЛУЙСТА, ПОДОЖДИТЕ",
        play_all: "ИГРАТЬ ВСЕ",
        pause_all: "ПАУЗА",
        stop: "СТОП",
        recent_tracks: "Недавние треки",
        no_history: "История пуста",
        delete_modal_title: "Удалить файл?",
        delete_modal_msg: "Вы уверены, что хотите удалить этот трек?",
        delete: "Удалить",
        back_title: "Назад",
        file_too_large: "Файл превышает 200 МБ.",
        upload_aborted: "Загрузка отменена.",
        error_prefix: "Ошибка: ",
        delete_success_msg: "Файл удален.",
        status_starting: "ЗАПУСК",
        status_calculating: "ВЫЧИСЛЕНИЕ...",
        status_remaining: "ОСТАЛОСЬ",
        status_initializing: "ИНИЦИАЛИЗАЦИЯ"
    }
};

let currentLang = localStorage.getItem('audio_extractor_lang') || 'en';

// Custom Dropdown Logic
const langBtn = document.getElementById('lang-btn');
const langMenu = document.getElementById('lang-menu');
const langOptions = document.querySelectorAll('.lang-option');

if (langBtn && langMenu) {
    langBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        langMenu.classList.toggle('visible');
        langBtn.classList.toggle('active');
    });

    // Close on outside click
    window.addEventListener('click', () => {
        if (langMenu.classList.contains('visible')) {
            langMenu.classList.remove('visible');
            langBtn.classList.remove('active');
        }
    });

    langOptions.forEach(opt => {
        opt.addEventListener('click', (e) => {
            e.stopPropagation();
            const lang = opt.getAttribute('data-lang');
            changeLanguage(lang);
            langMenu.classList.remove('visible');
            langBtn.classList.remove('active');
        });
    });
}

function changeLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('audio_extractor_lang', lang);
    const t = translations[lang];
    if (!t) return;

    // Update Static Elements
    document.querySelector('h1').childNodes[0].nodeValue = t.app_title.split(' ')[0] + ' ';
    if (t.app_title.split(' ').length > 1) {
        document.querySelector('h1 span').innerText = t.app_title.split(' ').slice(1).join(' ');
    } else {
        document.querySelector('h1 span').innerText = '';
        document.querySelector('h1').childNodes[0].nodeValue = t.app_title;
    }


    document.querySelector('.drop-text').innerText = t.drop_text;
    document.querySelector('.pulse-text').innerText = t.processing;
    document.getElementById('progress-text').innerText = t.initializing;
    const cancelBtn = document.getElementById('cancel-upload-btn');
    if (cancelBtn && cancelBtn.innerText !== "CANCELLING...") cancelBtn.innerText = t.cancel;

    // Helper Text in Overlay
    // Note: This matches based on structure. Ideally use IDs, but doing direct DOM update for now.
    const waitText = document.querySelector('#processing-overlay p:last-child');
    if (waitText) waitText.innerText = t.please_wait;

    // Controls
    if (!isPlaying) {
        masterPlayBtn.innerHTML = `<i class="fa-solid fa-play"></i> ${t.play_all}`;
    } else {
        masterPlayBtn.innerHTML = `<i class="fa-solid fa-pause"></i> ${t.pause_all}`;
    }
    masterStopBtn.innerHTML = `<i class="fa-solid fa-stop"></i> ${t.stop}`;

    // History
    document.querySelector('.history-title').innerText = t.recent_tracks;
    if (document.querySelector('.empty-history')) {
        document.querySelector('.empty-history').innerText = t.no_history;
    }

    // Back Button
    backBtn.title = t.back_title;

    // Modal
    document.querySelector('.modal-title').innerText = t.delete_modal_title;
    // msg is dynamic, skipping for now or handled in showConfirmModal
    document.querySelector('#modal-cancel').innerText = t.cancel;
    document.querySelector('#modal-confirm').innerText = t.delete;

    // Update Dropdown Selection State
    if (typeof langOptions !== 'undefined') {
        langOptions.forEach(opt => {
            if (opt.getAttribute('data-lang') === lang) {
                opt.classList.add('selected');
            } else {
                opt.classList.remove('selected');
            }
        });
    }
}

// Initial Load
changeLanguage(currentLang);
loadHistory();

// --- Event Listeners ---
// Drag & Drop
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', (e) => {
    e.preventDefault(); dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
        handleFile(e.target.files[0]);
        fileInput.value = ''; // Reset to allow re-selection of same file
    }
});

// Back Button
backBtn.addEventListener('click', () => {
    stopAll();

    // Check if there is a pending upload running in background
    if (currentUploadController) {
        // Do NOT abort. Restore the processing UI instead.
        mixer.classList.remove('visible');
        mixerControls.classList.remove('visible');
        keyBadge.classList.remove('visible');
        // Back button should be hidden during processing
        backBtn.classList.remove('visible');

        // Restore Overlay
        dropZone.style.display = 'flex';
        processingOverlay.classList.add('active');

    } else {
        // Normal Back Behavior
        mixer.classList.remove('visible');
        mixerControls.classList.remove('visible');
        keyBadge.classList.remove('visible');
        backBtn.classList.remove('visible');
        dropZone.style.display = 'flex'; // Restore drop zone
        processingOverlay.classList.remove('active');
    }
});

// --- Core Logic ---

function generateUUID() { // Simple UUID generator
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function updateProgressUI(percent, status, startTime) {
    percent = Math.max(0, Math.min(100, percent));
    progressBar.style.width = `${percent}%`;

    let timeText = "";
    if (percent > 0 && percent < 100 && startTime) {
        const elapsed = (Date.now() - startTime) / 1000;
        const totalEstimated = (elapsed / percent) * 100;
        const remaining = totalEstimated - elapsed;

        if (remaining > 0 && isFinite(remaining)) {
            const minutes = Math.floor(remaining / 60);
            const seconds = Math.floor(remaining % 60);
            timeText = ` | ${minutes}M ${seconds}S REMAINING`;
        } else {
            timeText = ` | CALCULATING TIME...`;
        }
    }

    progressText.innerText = `${status.toUpperCase()}... ${Math.round(percent)}%${timeText}`;
}

async function startProgressPolling(taskId) {
    const startTime = Date.now();
    progressContainer.style.display = 'block';
    updateProgressUI(0, "STARTING", null);

    pollInterval = setInterval(async () => {
        try {
            const res = await fetch(`${API_URL}/progress/${taskId}`);
            if (res.ok) {
                const data = await res.json(); // { progress: int, status: str }
                updateProgressUI(data.progress, data.status, startTime);
            }
        } catch (e) {
            console.error("Polling error", e);
        }
    }, 1000);
}

function stopProgressPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
    progressContainer.style.display = 'none';
    progressBar.style.width = '0%';
    progressText.innerText = 'INITIALIZING...';
}

const cancelUploadBtn = document.getElementById('cancel-upload-btn');
let currentTaskId = null; // Track current task ID for cancellation

// Button Listener
if (cancelUploadBtn) {
    cancelUploadBtn.addEventListener('click', async (e) => {
        e.stopPropagation(); // Stop bubbling to dropZone
        e.preventDefault();
        if (currentUploadController) {
            currentUploadController.abort(); // Abort client-side upload/fetch
        }
        if (currentTaskId) {
            // Abort server-side processing
            try {
                cancelUploadBtn.innerText = "CANCELLING...";
                await fetch(`${API_URL}/cancel/${currentTaskId}`, { method: 'POST' });
            } catch (e) {
                console.error("Cancel API failed", e);
            }
        }
        stopProgressPolling();

        // Reset UI immediately
        processingOverlay.classList.remove('active');
        dropZone.style.display = 'flex';
        cancelUploadBtn.innerText = "CANCEL";
        currentTaskId = null;
        currentUploadController = null;
    });
}

async function handleFile(file) {
    // 1. Check File Size
    if (file.size > MAX_FILE_SIZE) {
        alert("The file exceeds the 200MB limit.");
        return;
    }

    // Abort previous if exists
    if (currentUploadController) {
        currentUploadController.abort();
    }
    stopProgressPolling(); // Stop previous polling

    // Reset UI
    startProcessingUI();
    if (cancelUploadBtn) cancelUploadBtn.innerText = "CANCEL";

    // Create new controller
    currentUploadController = new AbortController();
    const signal = currentUploadController.signal;

    const formData = new FormData();
    formData.append('file', file);

    // Generate Task ID
    const taskId = generateUUID();
    currentTaskId = taskId; // Set global task ID

    try {
        // Start Polling
        startProgressPolling(taskId);

        const res = await fetch(`${API_URL}/separate?task_id=${taskId}`, {
            method: 'POST',
            body: formData,
            signal: signal
        });

        if (!res.ok) {
            // Check for 499 (Cancelled)
            if (res.status === 499) {
                console.log("Task cancelled server-side");
                // UI is usually reset by the cancel button handler, but ensure it here too
                processingOverlay.classList.remove('active');
                return;
            }

            let errorMsg = 'Processing failed';
            try {
                const errData = await res.json();
                errorMsg = errData.detail || errorMsg;
            } catch (e) { }
            throw new Error(errorMsg);
        }

        const data = await res.json();

        // Save to History
        // Use ID (Folder Name) if available, fallback to sanitization
        const trackId = data.id || file.name.replace(/\.[^/.]+$/, "");
        saveToHistory(trackId, data.key || 'Unknown', data.stems);

        // Render
        loadTrackUI(trackId, data.key, data.stems);

    } catch (err) {
        if (err.name === 'AbortError') {
            console.log('Upload aborted by user action');
        } else {
            console.error(err);
            // Don't show alert if it was a manual cancellation race
            if (!currentTaskId) return;

            alert("Error: " + err.message);
            processingOverlay.classList.remove('active');
        }
    } finally {
        stopProgressPolling();

        if (currentUploadController && currentUploadController.signal === signal) {
            currentUploadController = null;
        }
        currentTaskId = null;
    }
}

function restoreTrack(snapshot) {
    // Do NOT abort pending upload. Allow it to run in background.
    // if (currentUploadController) ... removed

    stopAll();
    startProcessingUI();
    setTimeout(() => {
        loadTrackUI(snapshot.name, snapshot.key, snapshot.stems);
    }, 300);
}

function loadTrackUI(name, key, stems) {
    currentTrackName = name;
    stemsData = stems;

    // Reset Audio Globals to prevent silence bugs
    soloTrack = null;
    isPlaying = false;
    if (masterPlayBtn) masterPlayBtn.innerHTML = '<i class="fa-solid fa-play"></i> PLAY ALL';

    if (key) {
        keyText.innerText = key;
        keyBadge.classList.add('visible');
    }

    initMixer(stems).then(() => {
        processingOverlay.classList.remove('active');
        dropZone.style.display = 'none';
        mixer.classList.add('visible');
        mixerControls.classList.add('visible');
        backBtn.classList.add('visible');
    });
}

function startProcessingUI() {
    mixer.innerHTML = '';
    mixer.classList.remove('visible');
    mixerControls.classList.remove('visible');
    keyBadge.classList.remove('visible');
    backBtn.classList.remove('visible');
    dropZone.style.display = 'flex';
    processingOverlay.classList.add('active');
}

// --- History Logic ---

function saveToHistory(name, key, stems) {
    const item = { name, key, stems, timestamp: Date.now() };
    let history = JSON.parse(localStorage.getItem('audio_extractor_history') || '[]');
    // history = history.filter(h => h.name !== name); // User requested to allow duplicates
    history.unshift(item);
    if (history.length > 10) history.pop();
    localStorage.setItem('audio_extractor_history', JSON.stringify(history));
    loadHistory();
}

function loadHistory() {
    const history = JSON.parse(localStorage.getItem('audio_extractor_history') || '[]');
    historyContainer.innerHTML = '';

    if (history.length === 0) {
        historyContainer.innerHTML = '<div class="empty-history">No history yet</div>';
        return;
    }

    history.forEach(item => {
        const el = document.createElement('div');
        el.className = 'history-item';
        el.innerHTML = `
            <div class="h-name">${item.name}</div>
            <div class="h-key">${item.key || '?'}</div>
        `;
        el.onclick = () => restoreTrack(item);
        historyContainer.appendChild(el);
    });
}

// --- Mixer & Player Logic ---

async function initMixer(stems) {
    mixer.innerHTML = '';
    players = {};
    const icons = {
        drums: '<i class="fa-solid fa-drum"></i>',
        bass: '<i class="fa-solid fa-guitar"></i>',
        vocals: '<i class="fa-solid fa-microphone-lines"></i>',
        other: '<i class="fa-solid fa-music"></i>'
    };

    for (let name of stemOrder) {
        if (!stems[name]) continue;

        const channel = document.createElement('div');
        channel.className = 'channel';
        channel.id = `ch-${name}`;
        channel.innerHTML = `
            <div class="track-info">
                <span class="track-icon">${icons[name]}</span>
                <span class="track-name">${name}</span>
            </div>
            <div class="waveform-wrapper" id="wave-${name}"></div>
            <div class="controls">
                <button class="mini-btn mute" onclick="toggleMute('${name}')">M</button>
                <button class="mini-btn solo" onclick="toggleSolo('${name}')">S</button>
                <a href="${stems[name].download}" class="mini-btn download-btn"><i class="fa-solid fa-download"></i></a>
            </div>
        `;
        mixer.appendChild(channel);

        // Mixers (Wavesurfer) 
        players[name] = WaveSurfer.create({
            container: `#wave-${name}`,
            waveColor: '#333',
            progressColor: '#FFC107',
            cursorColor: '#fff',
            barWidth: 2, barGap: 1, barRadius: 2,
            height: 80, // Optimal Height
            barHeight: 2, // Standard Boost (2x) - Clean & Professional
            normalize: false, // Keep disabled to avoid ghost noise
            interact: true, // Enable User Seeking
            autoScroll: true,
            autoCenter: true,
        });

        players[name].load(stems[name].playback);

        // Force state to ensure sound works
        players[name].on('ready', () => {
            players[name].setVolume(1);
            players[name].setMuted(false);
        });

        // Force pointer cursor for better UX
        const waveContainer = document.querySelector(`#wave-${name}`);
        if (waveContainer) waveContainer.style.cursor = 'pointer';

        // Synchronized Seeking
        players[name].on('interaction', (newTime) => {
            // newTime is in seconds (v7) or progress? v7 interaction returns raw event usually, or time.
            // Actually 'interaction' event in v7 passes (newTime: number) which is seconds.
            const duration = players[name].getDuration();
            const progress = newTime / duration;

            for (let key in players) {
                if (key !== name) {
                    players[key].seekTo(progress);
                }
            }
        });

        // Loop Sync
        players[name].on('finish', () => {
            // Infinite Loop: When finishes, restart all from 0
            if (isPlaying) {
                Object.values(players).forEach(p => {
                    p.seekTo(0);
                    p.play();
                });
            }
        });
    }
}

// --- Mixer Controls (Existing) ---

masterPlayBtn.addEventListener('click', () => {
    if (isPlaying) Object.values(players).forEach(p => p.pause());
    else {
        // Resume AudioContext just in case
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                // Try to resume global context if accessible, or just rely on Wavesurfer
            }
        } catch (e) { }

        Object.values(players).forEach(p => p.play());
    }
    isPlaying = !isPlaying;
    masterPlayBtn.innerHTML = isPlaying
        ? '<i class="fa-solid fa-pause"></i> PAUSE'
        : '<i class="fa-solid fa-play"></i> PLAY ALL';
});


masterStopBtn.addEventListener('click', stopAll);

function stopAll() {
    try {
        if (players && Object.keys(players).length > 0) {
            Object.values(players).forEach(p => {
                if (p && typeof p.stop === 'function') {
                    p.stop();
                }
            });
        }
    } catch (e) {
        console.error("Error stopping players:", e);
    }
    isPlaying = false;
    if (masterPlayBtn) masterPlayBtn.innerHTML = '<i class="fa-solid fa-play"></i> PLAY ALL';
}

window.toggleMute = (name) => {
    // Strict Solo Mode: Cannot unmute others if a Solo is active
    if (soloTrack && soloTrack !== name) {
        return;
    }

    const p = players[name];
    p.setMuted(!p.getMuted());
    document.querySelector(`#ch-${name} .mute`).classList.toggle('active', p.getMuted());
    document.getElementById(`ch-${name}`).classList.toggle('muted', p.getMuted());

    // If we just unmuted the current Solo track, should it cancel Solo?
    // User logic implies strict exclusive solo.
    // Actually, if I mute the Solo track, it becomes silent. That's fine.

    // If I unmute a track while NO solo is active, standard behavior.

    // Special Case: If we are in Solo mode, and I Mute the Solo track, 
    // it effectively silences everything.
};

window.toggleSolo = (name) => {
    // Resume AC if needed (e.g. user clicks Solo before Play)
    if (players[name] && players[name].backend && players[name].backend.ac && players[name].backend.ac.state === 'suspended') {
        players[name].backend.ac.resume();
    }

    const btn = document.querySelector(`#ch-${name} .solo`);
    if (soloTrack === name) {
        // Un-solo
        soloTrack = null;
        btn.classList.remove('active');
        Object.values(players).forEach(p => {
            p.setMuted(false);
            p.setVolume(1); // Restore volume
        });
        document.querySelectorAll('.channel').forEach(c => c.classList.remove('muted'));
        document.querySelectorAll('.mute').forEach(b => b.classList.remove('active'));
    } else {
        // Solo
        soloTrack = name;
        document.querySelectorAll('.solo').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        for (let key in players) {
            if (key === name) {
                players[key].setMuted(false);
                players[key].setVolume(1); // Force full volume
                document.getElementById(`ch-${key}`).classList.remove('muted');
            } else {
                players[key].setMuted(true);
                document.getElementById(`ch-${key}`).classList.add('muted');
            }
        }
    }
};

window.addEventListener('resize', () => {
    // Optional resize logic
});

// --- Delete Logic ---

const trashBtn = document.getElementById('trash-btn');
if (trashBtn) {
    trashBtn.addEventListener('click', () => {
        if (currentTrackName) deleteTrack(currentTrackName);
    });
}

async function deleteTrack(name) {
    showConfirmModal(
        `Are you sure you want to delete "${name}"? This cannot be undone.`,
        async () => {
            // On Confirm
            try {
                const res = await fetch(`${API_URL}/delete/${encodeURIComponent(name)}`, {
                    method: 'DELETE'
                });

                // If 404, file is already gone (or never existed). Treat as success to clean up stale history.
                if (!res.ok && res.status !== 404) {
                    const err = await res.json();
                    throw new Error(err.detail || "Delete failed");
                }

                // Success (or 404): Remove from History
                let history = JSON.parse(localStorage.getItem('audio_extractor_history') || '[]');
                history = history.filter(h => h.name !== name);
                localStorage.setItem('audio_extractor_history', JSON.stringify(history));
                loadHistory(); // Refresh UI

                // If current track, reset UI
                if (currentTrackName === name) {
                    stopAll();
                    startProcessingUI(); // Go back to drop zone
                }
            } catch (e) {
                console.error(e);
                alert("Error deleting file: " + e.message);
            }
        }
    );
}

// Custom Modal Logic
function showConfirmModal(message, onConfirm) {
    const overlay = document.getElementById('modal-overlay');
    const msgEl = document.getElementById('modal-msg');
    const cancelBtn = document.getElementById('modal-cancel');
    const confirmBtn = document.getElementById('modal-confirm');

    // Set Content
    msgEl.innerText = message;

    // Show
    overlay.classList.add('active');

    // Button Handlers
    const close = () => {
        overlay.classList.remove('active');
        // Remove listeners to avoid dupes/leaks
        cancelBtn.onclick = null;
        confirmBtn.onclick = null;
    };

    cancelBtn.onclick = close;

    confirmBtn.onclick = () => {
        close();
        onConfirm();
    };
}

// Update loadHistory to add Right-Click (ContextMenu)
function loadHistory() {
    const history = JSON.parse(localStorage.getItem('audio_extractor_history') || '[]');
    historyContainer.innerHTML = '';

    if (history.length === 0) {
        historyContainer.innerHTML = '<div class="empty-history">No history yet</div>';
        return;
    }

    history.forEach(item => {
        const el = document.createElement('div');
        el.className = 'history-item';
        el.innerHTML = `
            <div class="h-name">${item.name}</div>
            <div class="h-key">${item.key || '?'}</div>
        `;
        el.onclick = () => restoreTrack(item);

        // Right Click to Delete
        el.oncontextmenu = (e) => {
            e.preventDefault();
            deleteTrack(item.name);
        };

        historyContainer.appendChild(el);
    });
}
