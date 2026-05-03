// Global storage object for settings
let storage = { settings: { placeholder: '$lang', presets: {} } };

// Transform URL to editor format
function transformUrl(url) {
    try {
        const urlObj = new URL(url);
        urlObj.pathname = '/editor.html' + urlObj.pathname;
        urlObj.search = ''; // remove query parameters
        return urlObj.toString();
    } catch (e) {
        console.error('Error transforming URL:', e);
        return url;
    }
}

// Load current active tab's URL into the input field
function loadCurrentUrl() {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
        if (tabs && tabs[0] && tabs[0].url) {
            document.querySelector('.url-input').value = tabs[0].url;
        }
    });
}

// Open editor URL in new tab
function openEditor() {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
        if (tabs && tabs[0] && tabs[0].url) {
            const originalUrl = tabs[0].url;
            const transformedUrl = transformUrl(originalUrl);
            chrome.tabs.create({ url: transformedUrl });
        }
    });
}

const BRAND_DOMAIN_MAP = {
    ita: 'https://www.ita-airways.com',
    lh: 'https://www.lufthansa.com',
    lx: 'https://www.swiss.com',
    bel: 'https://www.brusselsairlines.com',
    aua: 'https://www.austrian.com'
};

function getBrand(segments) {
    const contentIndex = segments.indexOf('content');
    return contentIndex >= 0 && segments[contentIndex + 1]
        ? segments[contentIndex + 1].toLowerCase()
        : null;
}

function isGcFormat(segments) {
    const contentIndex = segments.indexOf('content');
    return contentIndex >= 0 && segments[contentIndex + 2]?.toLowerCase() === 'gc';
}

function isMarketsFormat(segments) {
    const contentIndex = segments.indexOf('content');
    return contentIndex >= 0 && segments[contentIndex + 2]?.toLowerCase() === 'markets';
}

function extractLanguage(segments) {
    const contentIndex = segments.indexOf('content');
    if (isGcFormat(segments)) {
        return segments[contentIndex + 3]?.toLowerCase() || null;
    }
    if (isMarketsFormat(segments)) {
        return segments[contentIndex + 4]?.toLowerCase() || null;
    }
    return null;
}

function extractCountry(segments) {
    const contentIndex = segments.indexOf('content');
    if (isMarketsFormat(segments)) {
        return segments[contentIndex + 3]?.toLowerCase() || null;
    }
    return 'xx';
}

function extractPagePath(segments) {
    const contentIndex = segments.indexOf('content');
    let startIndex = null;
    if (isGcFormat(segments)) {
        startIndex = contentIndex + 4;
    } else if (isMarketsFormat(segments)) {
        startIndex = contentIndex + 5;
    }
    if (startIndex === null || startIndex >= segments.length) {
        return null;
    }
    const cleanedSegments = segments.slice(startIndex).map((segment) => segment.replace(/\.html$/i, ''));
    return cleanedSegments.filter(Boolean).join('/');
}

function getMappedDomain(brand) {
    return BRAND_DOMAIN_MAP[brand] || null;
}

function buildLiveUrl(domain, country, language, pagePath) {
    const normalizedCountry = country || 'xx';
    const normalizedLanguage = language || '';
    const trimmedPath = pagePath.replace(/\/+$|^\/+/, '');
    return `${domain}/${normalizedCountry}/${normalizedLanguage}/${trimmedPath}`;
}

function transformLiveUrl(url) {
    try {
        const parsed = new URL(url);
        const segments = parsed.pathname.replace(/\/+$|^\/+/, '').split('/').filter(Boolean);

        const brand = getBrand(segments);
        const mappedDomain = getMappedDomain(brand);
        const language = extractLanguage(segments);
        const country = extractCountry(segments);
        const pagePath = extractPagePath(segments);

        if (!mappedDomain || !language || !pagePath) {
            alert('Unsupported or invalid URL format');
            return null;
        }

        return buildLiveUrl(mappedDomain, country, language, pagePath);
    } catch (error) {
        console.error('Error transforming live URL:', error);
        alert('Unsupported or invalid URL format');
        return null;
    }
}

function openLiveUrl() {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
        if (!tabs || !tabs[0] || !tabs[0].url) {
            alert('Unable to detect the current page URL.');
            return;
        }
        const transformedUrl = transformLiveUrl(tabs[0].url);
        if (transformedUrl) {
            window.open(transformedUrl, '_blank');
        }
    });
}

// Load settings from Chrome storage
function loadData() {
    chrome.storage.local.get(['settings'], (result) => {
        storage.settings = result.settings || { placeholder: '$lang', presets: {} };
        if (!storage.settings.presets) storage.settings.presets = {};
        renderPresets();
        loadCurrentUrl();
    });
}

function updateColorPreview(select) {
    const preview = document.querySelector('.color-preview');
    if (!preview) return;
    const color = select.value;
    preview.style.backgroundColor = color;
}

// Set up event listeners for buttons
function setupEventListeners() {
    document.querySelector('.settings-btn').addEventListener('click', switchToSettings);
    document.querySelector('.back-btn').addEventListener('click', switchToMain);
    document.querySelector('.add-btn').addEventListener('click', () => openModal());
    document.querySelector('#editorBtn').addEventListener('click', openEditor);
    document.querySelector('#liveBtn').addEventListener('click', openLiveUrl);
    document.querySelector('.add-preset-btn').addEventListener('click', () => openModal());
    document.querySelector('.save-settings-btn').addEventListener('click', () => {
        chrome.storage.local.set({ settings: storage.settings }, () => {
            if (chrome.runtime.lastError) {
                console.error('Error saving settings:', chrome.runtime.lastError);
                document.querySelector('#notification').textContent = 'Error saving settings.';
                document.querySelector('#notification').style.color = '#ff4444';
            } else {
                document.querySelector('#notification').textContent = 'Settings saved!';
                document.querySelector('#notification').style.color = '#28a745';
            }
            document.querySelector('#notification').style.display = 'block';
            setTimeout(() => {
                document.querySelector('#notification').style.display = 'none';
            }, 3000);
        });
    });
}

// Switch to settings view
function switchToSettings() {
    document.querySelector('.main-view').classList.remove('active');
    document.querySelector('.settings-view').classList.add('active');
    document.querySelector('.placeholder-input').value = storage.settings.placeholder;
    renderSettingsPresets();
}

// Switch back to main view and save placeholder
function switchToMain() {
    document.querySelector('.settings-view').classList.remove('active');
    document.querySelector('.main-view').classList.add('active');
    const placeholder = document.querySelector('.placeholder-input').value.trim();
    storage.settings.placeholder = placeholder || '$lang';
    chrome.storage.local.set({ settings: storage.settings });
}

// Render presets in main view
function renderPresets() {
    const container = document.querySelector('.presets');
    container.innerHTML = '';
    for (const [key, preset] of Object.entries(storage.settings.presets)) {
        const div = document.createElement('div');
        div.className = 'preset';
        div.style.borderColor = preset.color;
        div.innerHTML = `<div>${preset.name}</div>`;
        div.addEventListener('click', () => openPreset(preset));
        container.appendChild(div);
    }
}

// Open tabs for a preset and group them
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

// Open modal for creating/editing presets
function openModal(isEdit = false, key = null) {
    const modal = document.querySelector('.modal');
    const h3 = modal.querySelector('h3');
    const nameInput = modal.querySelector('.preset-name');
    const langsInput = modal.querySelector('.langs-input');
    const colorSelect = modal.querySelector('.color-select');
    const error = modal.querySelector('.error');

    h3.textContent = isEdit ? 'Edit Preset' : 'Create Preset';
    nameInput.value = '';
    langsInput.value = '';
    colorSelect.value = 'blue'; // Default
    error.textContent = '';

    // Pre-fill for edit
    if (isEdit) {
        const preset = storage.settings.presets[key];
        nameInput.value = preset.name;
        langsInput.value = preset.langs.join(', ');
        colorSelect.value = preset.color;
    }

    modal.style.display = 'flex';
    updateColorPreview(colorSelect);

    colorSelect.addEventListener('change', () => {
        updateColorPreview(colorSelect);
    });

    modal.querySelector('.save-btn').onclick = () => {
        const name = nameInput.value.trim();
        const langs = langsInput.value.split(',').map(l => l.trim()).filter(l => l);
        const color = colorSelect.value;

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

// Render presets in settings view
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

// Initialize on load
loadData();
setupEventListeners();
