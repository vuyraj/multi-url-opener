console.log('popup.js loaded');

function loadCurrentUrl() {
    console.log('loadCurrentUrl called');
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
        console.log('tabs query result:', tabs);
        if (tabs && tabs[0] && tabs[0].url) {
            document.querySelector('.url-input').value = tabs[0].url;
            console.log('URL set to:', tabs[0].url);
        } else {
            console.log('No active tab found or URL not accessible');
        }
    });
}

function loadData() {
    console.log('loadData called');
    chrome.storage.local.get(['settings'], (result) => {
        console.log('storage result:', result);
        storage.settings = result.settings || { placeholder: '$lang', presets: {} };
        if (!storage.settings.presets) storage.settings.presets = {};
        renderPresets();
        loadCurrentUrl();
    });
}

function setupEventListeners() {
    console.log('setupEventListeners called');
    document.querySelector('.settings-btn').addEventListener('click', () => {
        console.log('settings-btn clicked');
        switchToSettings();
    });

    document.querySelector('.back-btn').addEventListener('click', () => {
        console.log('back-btn clicked');
        switchToMain();
    });

    document.querySelector('.add-btn').addEventListener('click', () => {
        console.log('add-btn clicked');
        openModal();
    });

    document.querySelector('.add-preset-btn').addEventListener('click', () => {
        openModal();
    });

    document.querySelector('.save-settings-btn').addEventListener('click', () => {
        chrome.storage.local.set({ settings: storage.settings });
        alert('Settings saved!');
    });
}

function switchToSettings() {
    document.querySelector('.main-view').classList.remove('active');
    document.querySelector('.settings-view').classList.add('active');
    document.querySelector('.placeholder-input').value = storage.settings.placeholder;
    renderSettingsPresets();
}

function switchToMain() {
    document.querySelector('.settings-view').classList.remove('active');
    document.querySelector('.main-view').classList.add('active');
    storage.settings.placeholder = document.querySelector('.placeholder-input').value.trim() || '$lang';
    chrome.storage.local.set({ settings: storage.settings });
}

function renderPresets() {
    console.log('renderPresets called, presets:', Object.keys(storage.settings.presets));
    const container = document.querySelector('.presets');
    container.innerHTML = '';
    for (const [key, preset] of Object.entries(storage.settings.presets)) {
        const div = document.createElement('div');
        div.className = 'preset';
        div.style.borderColor = preset.color;
        div.innerHTML = `<div>${preset.name}</div>`;
        div.addEventListener('click', (e) => {
            openPreset(preset);
        });
        container.appendChild(div);
    }
}

async function openPreset(preset) {
    const url = document.querySelector('.url-input').value.trim();
    const placeholder = storage.settings.placeholder;
    if (!url || !url.includes(placeholder)) {
        alert('Please enter a valid URL containing the placeholder.');
        return;
    }
    const tabs = [];
    for (const lang of preset.langs) {
        const newUrl = url.replaceAll(placeholder, lang);
        try {
            const tab = await chrome.tabs.create({ url: newUrl, active: false });
            tabs.push(tab.id);
        } catch (e) {
            console.error('Error creating tab:', e);
        }
    }
    if (tabs.length > 0) {
        try {
            const group = await chrome.tabs.group({ tabIds: tabs });
            await chrome.tabGroups.update(group, { title: preset.name, color: preset.color });
        } catch (e) {
            console.error('Error grouping tabs:', e);
        }
    }
}

function openModal(isEdit = false, key = null) {
    const modal = document.querySelector('.modal');
    const h3 = modal.querySelector('h3');
    const nameInput = modal.querySelector('.preset-name');
    const langsInput = modal.querySelector('.langs-input');
    const colorOptions = modal.querySelectorAll('.color-option');
    const error = modal.querySelector('.error');

    h3.textContent = isEdit ? 'Edit Preset' : 'Create Preset';
    nameInput.value = '';
    langsInput.value = '';
    colorOptions.forEach(opt => opt.classList.remove('selected'));
    error.textContent = '';

    if (isEdit) {
        const preset = storage.settings.presets[key];
        nameInput.value = preset.name;
        langsInput.value = preset.langs.join(', ');
    }

    modal.style.display = 'flex';

    modal.querySelector('.save-btn').onclick = () => {
        const name = nameInput.value.trim();
        const langs = langsInput.value.split(',').map(l => l.trim()).filter(l => l);
        let color;
        if (isEdit) {
            color = storage.settings.presets[key].color;
        } else {
            const colors = ['blue', 'green', 'red', 'purple', 'orange'];
            color = colors[Math.floor(Math.random() * colors.length)];
        }

        if (!name) {
            error.textContent = 'Preset name is required.';
            return;
        }
        if (langs.length === 0) {
            error.textContent = 'At least one language is required.';
            return;
        }
        if (!isEdit && storage.settings.presets[name]) {
            error.textContent = 'Preset name already exists.';
            return;
        }
        if (isEdit && key !== name && storage.settings.presets[name]) {
            error.textContent = 'Preset name already exists.';
            return;
        }

        if (isEdit) {
            delete storage.settings.presets[key];
        }
        storage.settings.presets[name] = { name, langs, color };
        chrome.storage.local.set({ settings: storage.settings });
        renderPresets();
        renderSettingsPresets();
        modal.style.display = 'none';
    };

    modal.querySelector('.cancel-btn').onclick = () => {
        modal.style.display = 'none';
    };
}

function renderSettingsPresets() {
    const container = document.querySelector('.settings-presets');
    container.innerHTML = '';
    for (const [key, preset] of Object.entries(storage.settings.presets)) {
        const div = document.createElement('div');
        div.className = 'settings-preset';
        div.style.borderColor = preset.color;
        div.innerHTML = `<div>${preset.name}</div><button class="edit-btn">✏️</button><button class="delete-btn">✕</button>`;
        div.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-btn')) {
                delete storage.settings.presets[key];
                chrome.storage.local.set({ settings: storage.settings });
                renderSettingsPresets();
                renderPresets();
            } else if (e.target.classList.contains('edit-btn')) {
                openModal(true, key);
            }
        });
        container.appendChild(div);
    }
}
let storage = { settings: { placeholder: '$lang', presets: {} } };

loadData();
setupEventListeners();
