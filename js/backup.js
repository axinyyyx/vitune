const STORAGE_KEYS = {
    HISTORY: 'listening_history',
    LIKES: 'likes',
    PLAYLISTS: 'playlists',
    SETTINGS: 'settings',
    OFFLINE: 'offlineSongs',
    PLAY_QUEUE: 'play_queue',
    CURRENT_SONG: 'current_song'
};

function exportData() {
    try {
        const data = {
            listening_history: JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY) || '[]'),
            likes: JSON.parse(localStorage.getItem(STORAGE_KEYS.LIKES) || '[]'),
            playlists: JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYLISTS) || '{}'),
            settings: JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}'),
            offlineSongs: JSON.parse(localStorage.getItem(STORAGE_KEYS.OFFLINE) || '[]'),
            play_queue: JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAY_QUEUE) || '[]'),
            current_song: JSON.parse(localStorage.getItem(STORAGE_KEYS.CURRENT_SONG) || 'null')
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = $('<a>').css('display', 'none').attr({
            href: url,
            download: 'vitune.json'
        });
        $('body').append(a);
        a[0].click();
        window.URL.revokeObjectURL(url);
        a.remove();
        alert('Data exported successfully as vitune.json');
        console.log('Data exported:', Object.keys(data));
    } catch (error) {
        console.error('Export error:', error);
        alert('Error exporting data: ' + error.message);
    }
}

function importData(file) {
    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const data = JSON.parse(event.target.result);

            // Validate data structure
            if (!data || typeof data !== 'object') {
                throw new Error('Invalid data format');
            }

            // Validate keys and data types
            const expectedKeys = [
                { key: 'listening_history', type: 'array' },
                { key: 'likes', type: 'array' },
                { key: 'playlists', type: 'object' },
                { key: 'settings', type: 'object' },
                { key: 'offlineSongs', type: 'array' },
                { key: 'play_queue', type: 'array' },
                { key: 'current_song', type: ['object', 'null'] }
            ];

            for (const { key, type } of expectedKeys) {
                if (!(key in data)) {
                    throw new Error(`Missing key: ${key}`);
                }
                if (type === 'array' && !Array.isArray(data[key])) {
                    throw new Error(`Invalid type for ${key}: expected array`);
                } else if (type === 'object' && data[key] !== null && typeof data[key] !== 'object') {
                    throw new Error(`Invalid type for ${key}: expected object`);
                } else if (Array.isArray(type) && !type.includes(typeof data[key]) && !(data[key] === null && type.includes('null'))) {
                    throw new Error(`Invalid type for ${key}: expected ${type.join(' or ')}`);
                }
            }

            // Validate settings structure
            const defaultSettings = {
                theme: 'dark',
                songCardTransparency: 'off',
                transparentEffect: 'off',
                fontStyle: 'poppins',
                fontSize: 'medium',
                progressBarColor: 'teal',
                progressBarStyle: 'simple',
                bitrate: '4',
                moodFilter: 'on',
                accentColor: 'teal',
                animationSpeed: 'normal'
            };
            const validSettings = { ...defaultSettings, ...data.settings };
            data.settings = validSettings;

            // Save to localStorage
            localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(data.listening_history));
            localStorage.setItem(STORAGE_KEYS.LIKES, JSON.stringify(data.likes));
            localStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(data.playlists));
            localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(data.settings));
            localStorage.setItem(STORAGE_KEYS.OFFLINE, JSON.stringify(data.offlineSongs));
            localStorage.setItem(STORAGE_KEYS.PLAY_QUEUE, JSON.stringify(data.play_queue));
            localStorage.setItem(STORAGE_KEYS.CURRENT_SONG, JSON.stringify(data.current_song));

            $(window).trigger('settings:updated');
            alert('Data imported successfully. Page will reload.');
            location.reload();
        } catch (error) {
            console.error('Import error:', error);
            alert('Error importing data: ' + error.message);
        }
    };
    reader.onerror = function() {
        console.error('File read error:', reader.error);
        alert('Error reading file: ' + reader.error.message);
    };
    reader.readAsText(file);
}