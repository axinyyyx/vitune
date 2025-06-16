document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const elements = {
        searchBox: document.getElementById('search-box'),
        clearSearch: document.getElementById('clear-search'),
        results: document.getElementById('results'),
        status: document.getElementById('status'),
        player: document.getElementById('player'),
        audioSource: document.getElementById('audio-source'),
        playerName: document.getElementById('player-name'),
        playerAlbum: document.getElementById('player-album'),
        playerImage: document.getElementById('player-image'),
        audioPlayer: document.getElementById('audio-player'),
        playPauseBtn: document.getElementById('play-pause-btn'),
        playPauseBtnExpanded: document.getElementById('play-pause-btn-expanded'),
        prevBtn: document.getElementById('prev-btn'),
        nextBtn: document.getElementById('next-btn-expanded'),
        lyricsBtn: document.getElementById('lyrics-btn'),
        loopBtn: document.getElementById('loop-btn'),
        likeBtn: document.getElementById('like-btn'),
        playlistBtn: document.getElementById('playlist-btn'),
        progressBar: document.getElementById('progress-bar'),
        progressContainer: document.getElementById('progress-container'),
        currentTime: document.getElementById('current-time'),
        duration: document.getElementById('duration'),
        lyricsModal: document.getElementById('lyricsModal'),
        lyricsContent: document.getElementById('lyrics-content'),
        likedSongsList: document.getElementById('liked-songs-list'),
        playlistsList: document.getElementById('playlists-list'),
        offlineList: document.getElementById('offline-list'),
        featuredSong: document.getElementById('featured-song'),
        suggestions: document.getElementById('suggestions'),
        suggestionBar: document.getElementById('suggestion-bar'),
        playerNameExpanded: document.getElementById('player-name-expanded'),
        playerAlbumExpanded: document.getElementById('player-album-expanded'),
        playerImageExpanded: document.getElementById('player-image-expanded'),
        homeContent: document.getElementById('home-content')
    };

    // Check for missing elements
    for (const [key, value] of Object.entries(elements)) {
        if (!value) console.warn(`Element with ID '${key}' not found`);
    }

    let currentSongIndex = -1;
    let songs = [];
    let queue = [];
    let lyricsInterval = null;
    let isLooping = false;
    const CACHE_NAME = 'vitune-cache-v3';
    const HISTORY_KEY = 'listening_history';
    const LIKED_SONGS_KEY = 'likedSongs';
    const API_BASE_URL = 'https://jiosaavn-api-privatecvc2.vercel.app/search/songs';

    // Audio Context for Equalizer Visualization
    let audioContext = null;
    let analyser = null;
    let canvas = null;
    let canvasCtx = null;

    // Mock lyrics data
    const mockLyrics = {
        default: [
            "This is a sample lyric line 1",
            "This is a sample lyric line 2",
            "Feel the rhythm, feel the rhyme",
            "Get on up, it's music time",
            "This is a sample lyric line 5",
            "Keep on dancing through the night"
        ]
    };

    // Initialize
    initializePlayer();
    loadHomeContent();
    loadSuggestions();
    applySettings();
    handleUrlSearch();

    // Handle URL hash changes
    window.addEventListener('hashchange', handleUrlSearch);

    function handleUrlSearch() {
        const hash = window.location.hash;
        const searchRegex = /^#(?:search|homesing)\?(.+)/;
        const match = hash.match(searchRegex);
        if (match) {
            const query = decodeURIComponent(match[1]);
            elements.searchBox.value = query;
            elements.clearSearch.classList.remove('hidden');
            searchSongs(query, false, true); // Auto-play first song for URL-based searches
            showTab('search');
        } else {
            showTab('home');
        }
    }

    // Live Search with Debounce
    let searchTimeout;
    if (elements.searchBox) {
        elements.searchBox.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            const query = elements.searchBox.value.trim();
            elements.clearSearch.classList.toggle('hidden', !query);
            if (query.length >= 2) {
                searchTimeout = setTimeout(() => {
                    searchSongs(query, false, false); // No auto-play for manual searches
                    showTab('search');
                }, 300);
            }
        });
    }

    if (elements.clearSearch) {
        elements.clearSearch.addEventListener('click', () => {
            elements.searchBox.value = '';
            elements.clearSearch.classList.add('hidden');
            elements.results.innerHTML = '';
            elements.status.textContent = '';
            window.location.hash = '';
            showTab('home');
        });
    }

    function initializePlayer() {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            const source = audioContext.createMediaElementSource(elements.player);
            source.connect(analyser);
            analyser.connect(audioContext.destination);
            analyser.fftSize = 256;

            canvas = document.createElement('canvas');
            canvas.className = 'visualizer w-full h-16 mt-2';
            const expanded = document.querySelector('.audio-player-content .expanded');
            if (expanded) expanded.appendChild(canvas);
            canvasCtx = canvas.getContext('2d');
            canvas.width = 300;
            canvas.height = 64;
            renderVisualizer();
        } catch (error) {
            console.error('AudioContext initialization failed:', error);
            showStatus('Audio visualizer initialization failed.', 3000);
        }
    }

    function renderVisualizer() {
        if (!analyser || !canvasCtx) return;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        const barWidth = canvas.width / bufferLength;

        function draw() {
            analyser.getByteFrequencyData(dataArray);
            canvasCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

            for (let i = 0; i < bufferLength; i++) {
                const barHeight = dataArray[i] / 2;
                canvasCtx.fillStyle = `hsl(${i * 2}, 70%, 50%)`;
                canvasCtx.fillRect(i * barWidth, canvas.height - barHeight, barWidth, barHeight);
            }
            requestAnimationFrame(draw);
        }
        draw();
    }

    function formatDuration(seconds) {
        seconds = parseInt(seconds, 10);
        const minutes = Math.floor(seconds / 60);
        seconds = seconds % 60;
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    }

    function showStatus(message, duration = 3000) {
        if (elements.status) {
            elements.status.innerHTML = message;
            if (duration) {
                setTimeout(() => elements.status.innerHTML = '', duration);
            }
        }
    }

    async function searchSongs(query, isFeatured = false, autoPlay = false) {
        if (!elements.status) return;
        elements.status.innerHTML = '<span class="spinner"></span> Searching...';
        if (!isFeatured && elements.results) {
            elements.results.innerHTML = '<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">' + Array(4).fill('<div class="song-card skeleton h-64 rounded-xl"></div>').join('') + '</div>';
        }

        try {
            const response = await fetch(`${API_BASE_URL}?query=${encodeURIComponent(query)}&limit=20&page=1`, {
                headers: { 'Accept': 'application/json' }
            });
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            const data = await response.json();
            if (!data.data?.results?.length) {
                showStatus('No results found');
                if (elements.results) elements.results.innerHTML = '';
                return;
            }
            songs = data.data.results.map(track => ({
                id: track.id,
                full_name: track.name,
                album: track.album.name,
                artist: track.primaryArtists,
                duration: formatDuration(track.duration),
                image_url: track.image[2]?.link || track.image[1]?.link || 'https://via.placeholder.com/150',
                download_url: track.downloadUrl[4]?.link || track.downloadUrl[3]?.link || track.downloadUrl[2]?.link || '',
                year: track.year
            })).filter(song => song.download_url);
            if (isFeatured) {
                const randomSong = songs[Math.floor(Math.random() * songs.length)];
                renderFeaturedSong(randomSong);
            } else {
                renderResults(songs);
                if (autoPlay && songs.length > 0) {
                    await playSong(0);
                }
            }
            elements.status.textContent = '';
        } catch (error) {
            showStatus('Failed to fetch songs. Please try again.');
            console.error('Search error:', error);
            if (elements.results) elements.results.innerHTML = '';
        }
    }

    function loadSuggestions() {
        const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        let suggestions = history.slice(0, 4);
        if (suggestions.length < 4) {
            const queries = ['pop hits', 'rock classics', 'bollywood top', 'chill vibes', 'trending songs'];
            const randomQuery = queries[Math.floor(Math.random() * queries.length)];
            searchSongs(randomQuery, true);
            suggestions = suggestions.concat(songs.slice(0, 4 - suggestions.length));
        }
        renderStaticSuggestions(suggestions);
    }

    function loadHomeContent() {
        if (!elements.homeContent) return;
        const likedSongs = JSON.parse(localStorage.getItem(LIKED_SONGS_KEY) || '[]');
        const offlineSongs = JSON.parse(localStorage.getItem('offlineSongs') || '[]');
        const playlists = JSON.parse(localStorage.getItem('playlists') || '{}');
        const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');

        elements.homeContent.innerHTML = `
            <h2 class="text-xl font-semibold mb-4">Recently Played</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                ${history.slice(0, 4).map((song, index) => `
                    <div class="song-card bg-gray-800 bg-opacity-30 backdrop-blur-md rounded-xl p-4 shadow-lg">
                        <img src="${song.image_url}" alt="Song Image" class="w-full h-40 object-cover rounded-lg mb-4">
                        <h3 class="text-base font-bold truncate">${song.full_name}</h3>
                        <p class="text-sm text-gray-400 truncate">${song.artist}</p>
                        <button class="mt-2 bg-teal-500 text-white rounded-full py-1.5 px-3 w-full hover:bg-teal-600 text-sm" onclick="playSong(${index})"><i class="fa fa-play mr-1"></i>Play</button>
                    </div>
                `).join('')}
            </div>
            <h2 class="text-xl font-semibold mb-4">Liked Songs</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                ${likedSongs.slice(0, 4).map((song, index) => `
                    <div class="song-card bg-gray-800 bg-opacity-30 backdrop-blur-md rounded-xl p-4 shadow-lg">
                        <img src="${song.image_url}" alt="Song Image" class="w-full h-40 object-cover rounded-lg mb-4">
                        <h3 class="text-base font-bold truncate">${song.full_name}</h3>
                        <p class="text-sm text-gray-400 truncate">${song.artist}</p>
                        <button class="mt-2 bg-teal-500 text-white rounded-full py-1.5 px-3 w-full hover:bg-teal-600 text-sm" onclick="playLikedSong(${index})"><i class="fa fa-play mr-1"></i>Play</button>
                    </div>
                `).join('')}
            </div>
            <h2 class="text-xl font-semibold mb-4">Offline Songs</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                ${offlineSongs.slice(0, 4).map((song, index) => `
                    <div class="song-card bg-gray-800 bg-opacity-30 backdrop-blur-md rounded-xl p-4 shadow-lg">
                        <img src="${song.image_url}" alt="Song Image" class="w-full h-40 object-cover rounded-lg mb-4">
                        <h3 class="text-base font-bold truncate">${song.full_name}</h3>
                        <p class="text-sm text-gray-400 truncate">${song.artist}</p>
                        <button class="mt-2 bg-teal-500 text-white rounded-full py-1.5 px-3 w-full hover:bg-teal-600 text-sm" onclick="playOffline(${index})"><i class="fa fa-play mr-1"></i>Play</button>
                    </div>
                `).join('')}
            </div>
            <h2 class="text-xl font-semibold mb-4">Playlists</h2>
            <div class="space-y-4">
                ${Object.keys(playlists).map(name => `
                    <div>
                        <h3 class="text-lg font-bold truncate">${name}</h3>
                        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
                            ${playlists[name].slice(0, 4).map((song, index) => `
                                <div class="song-card bg-gray-800 bg-opacity-30 backdrop-blur-md rounded-xl p-4 shadow-lg">
                                    <img src="${song.image_url}" alt="Song Image" class="w-full h-40 object-cover rounded-lg mb-4">
                                    <h3 class="text-base font-bold truncate">${song.full_name}</h3>
                                    <p class="text-sm text-gray-400 truncate">${song.artist}</p>
                                    <button class="mt-2 bg-teal-500 text-white rounded-full py-1.5 px-3 w-full hover:bg-teal-600 text-sm" onclick="playPlaylistSong('${name}', ${index})"><i class="fa fa-play mr-1"></i>Play</button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function renderFeaturedSong(song) {
        if (!elements.featuredSong) return;
        elements.featuredSong.innerHTML = `
            <div class="text-center">
                <img src="${song.image_url}" alt="Song Image" class="w-full h-56 object-cover rounded-lg mb-4">
                <h3 class="text-lg font-bold truncate">${song.full_name}</h3>
                <p class="text-sm text-gray-400 truncate">${song.album}</p>
                <p class="text-sm text-gray-400 truncate">${song.artist}</p>
                <p class="text-sm text-gray-400">${song.duration} | ${song.year}</p>
                <div class="mt-4 space-x-2">
                    <button class="bg-teal-500 text-white rounded-full py-1.5 px-3 hover:bg-teal-600 text-sm" onclick="playSong(0)"><i class="fa fa-play mr-1"></i>Play</button>
                    <button class="bg-blue-500 text-white rounded-full py-1.5 px-3 hover:bg-blue-600 text-sm" onclick="playNextSong('${song.id}', '${song.full_name}', '${song.album}', '${song.artist}', '${song.image_url}', '${song.download_url}', '${song.duration}', '${song.year}')"><i class="fa fa-step-forward mr-1"></i>Play Next</button>
                    <button class="bg-red-500 text-white rounded-full py-1.5 px-3 hover:bg-red-600 like-btn text-sm" data-id="${song.id}" onclick="toggleLike('${song.id}', '${song.full_name}', '${song.album}', '${song.artist}', '${song.image_url}', '${song.download_url}', '${song.duration}', '${song.year}', this)"><i class="fa fa-heart mr-1"></i><span>Like</span></button>
                    <button class="bg-purple-500 text-white rounded-full py-1.5 px-3 hover:bg-purple-600 text-sm" onclick="downloadSong('${song.id}', '${song.full_name}', '${song.download_url}')"><i class="fa fa-download mr-1"></i>Download</button>
                </div>
            </div>
        `;
        updateLikeButton(song.id, elements.featuredSong.querySelector(`.like-btn[data-id="${song.id}"]`));
    }

    function renderStaticSuggestions(suggestions) {
        if (!elements.suggestions || !elements.suggestionBar) return;
        elements.suggestions.innerHTML = '';
        elements.suggestionBar.innerHTML = '';
        suggestions.forEach((song, index) => {
            const card = document.createElement('div');
            card.className = 'song-card bg-gray-800 bg-opacity-30 backdrop-blur-md rounded-xl p-4 shadow-lg';
            card.innerHTML = `
                <img src="${song.image_url}" alt="Song Image" class="w-full h-40 object-cover rounded-lg mb-4">
                <h3 class="text-base font-bold truncate">${song.full_name}</h3>
                <p class="text-sm text-gray-400 truncate">${song.artist}</p>
                <button class="mt-2 bg-teal-500 text-white rounded-full py-1.5 px-3 w-full hover:bg-teal-600 text-sm" onclick="playSong(${index})"><i class="fa fa-play mr-1"></i>Play</button>
            `;
            elements.suggestions.appendChild(card);

            const barCard = document.createElement('div');
            barCard.className = 'song-card bg-gray-800 bg-opacity-30 backdrop-blur-md rounded-xl p-3 shadow-lg w-32 flex-shrink-0';
            barCard.innerHTML = `
                <img src="${song.image_url}" alt="Song Image" class="w-full h-20 object-cover rounded-lg mb-2">
                <h3 class="text-sm font-bold truncate">${song.full_name}</h3>
                <p class="text-xs text-gray-400 truncate">${song.artist}</p>
                <button class="mt-2 bg-teal-500 text-white rounded-full py-1 px-2 w-full hover:bg-teal-600 text-xs" onclick="playSong(${index})"><i class="fa fa-play mr-1"></i>Play</button>
            `;
            elements.suggestionBar.appendChild(barCard);
        });
        if (suggestions.length === 0) {
            elements.suggestions.innerHTML = '<p>No suggestions available.</p>';
            elements.suggestionBar.innerHTML = '<p>No suggestions available.</p>';
        }
    }

    function renderResults(songs) {
        if (!elements.results) return;
        elements.results.innerHTML = '';
        songs.forEach((song, index) => {
            const div = document.createElement('div');
            div.className = 'song-card bg-gray-800 bg-opacity-30 backdrop-blur-md rounded-xl p-4 shadow-lg';
            div.innerHTML = `
                <img src="${song.image_url}" alt="Song Image" class="w-full h-40 object-cover rounded-lg mb-4">
                <h3 class="text-base font-bold truncate">${song.full_name}</h3>
                <p class="text-sm text-gray-400 truncate">${song.album}</p>
                <p class="text-sm text-gray-400 truncate">${song.artist}</p>
                <p class="text-sm text-gray-400">${song.duration} | ${song.year}</p>
                <div class="mt-2 space-y-2">
                    <button class="bg-teal-500 text-white rounded-full py-1.5 px-3 w-full hover:bg-teal-600 text-sm" onclick="playSong(${index})"><i class="fa fa-play mr-1"></i>Play</button>
                    <button class="bg-blue-500 text-white rounded-full py-1.5 px-3 w-full hover:bg-blue-600 text-sm" onclick="playNextSong('${song.id}', '${song.full_name}', '${song.album}', '${song.artist}', '${song.image_url}', '${song.download_url}', '${song.duration}', '${song.year}')"><i class="fa fa-step-forward mr-1"></i>Play Next</button>
                    <button class="bg-red-500 text-white rounded-full py-1.5 px-3 w-full hover:bg-red-600 like-btn text-sm" data-id="${song.id}" onclick="toggleLike('${song.id}', '${song.full_name}', '${song.album}', '${song.artist}', '${song.image_url}', '${song.download_url}', '${song.duration}', '${song.year}', this)"><i class="fa fa-heart mr-1"></i><span>Like</span></button>
                    <button class="bg-yellow-500 text-white rounded-full py-1.5 px-3 w-full hover:bg-yellow-600 text-sm" onclick="showPlaylistModal('${song.id}', '${song.full_name}', '${song.album}', '${song.artist}', '${song.image_url}', '${song.download_url}', '${song.duration}', '${song.year}')"><i class="fa fa-plus mr-1"></i>Add to Playlist</button>
                </div>
            `;
            elements.results.appendChild(div);
            updateLikeButton(song.id, div.querySelector(`.like-btn[data-id="${song.id}"]`));
        });
    }

    async function downloadSong(songId, songName, downloadUrl) {
        if (!downloadUrl) {
            showStatus('No download URL available for this song.', 3000);
            return;
        }
        showStatus('<span class="spinner"></span> Downloading...');
        try {
            const response = await fetch(downloadUrl);
            if (!response.ok) throw new Error(`Download failed: ${response.status}`);
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${songName.replace(/[^a-zA-Z0-9]/g, '_')}.mp3`;
            a.click();
            URL.revokeObjectURL(url);
            showStatus('Download complete!', 2000);
            await cacheSong({ id: songId, full_name: songName, download_url: downloadUrl });
        } catch (error) {
            showStatus('Failed to download song.', 3000);
            console.error('Download error:', error);
        }
    }

    async function cacheSong(song) {
        try {
            const cache = await caches.open(CACHE_NAME);
            const response = await fetch(song.download_url);
            if (response.ok) {
                await cache.put(song.download_url, response.clone());
                const offlineSongs = JSON.parse(localStorage.getItem('offlineSongs') || '[]');
                if (!offlineSongs.some(s => s.id === song.id)) {
                    offlineSongs.push(song);
                    localStorage.setItem('offlineSongs', JSON.stringify(offlineSongs));
                    renderOffline();
                }
            }
        } catch (error) {
            console.error('Cache error:', error);
        }
    }

    window.togglePlayer = () => {
        const audioPlayerContent = document.querySelector('.audio-player-content');
        if (!audioPlayerContent) return;
        audioPlayerContent.classList.toggle('expanded');
        audioPlayerContent.querySelector('.expanded').classList.toggle('hidden');
        audioPlayerContent.querySelector('.compact').classList.toggle('hidden');
        if (audioPlayerContent.classList.contains('expanded')) {
            elements.playPauseBtnExpanded.innerHTML = elements.playPauseBtn.innerHTML;
        }
    };

    window.playSong = async (index) => {
        if (index < 0 || index >= songs.length) {
            showStatus('Invalid song index.', 3000);
            return;
        }
        const song = songs[index];
        if (!song.download_url) {
            showStatus('No playable URL available for this song.', 3000);
            return;
        }
        currentSongIndex = index;
        updateHistory(song);

        try {
            const cache = await caches.open(CACHE_NAME);
            const cachedResponse = await cache.match(song.download_url);
            let srcUrl = song.download_url;

            if (cachedResponse) {
                const blob = await cachedResponse.blob();
                srcUrl = URL.createObjectURL(blob);
            } else {
                const testResponse = await fetch(song.download_url, { method: 'HEAD' });
                if (!testResponse.ok) throw new Error(`Invalid URL: ${testResponse.status}`);
                await cacheSong(song);
            }

            elements.audioSource.src = srcUrl;
            elements.playerName.textContent = song.full_name;
            elements.playerNameExpanded.textContent = song.full_name;
            elements.playerAlbum.textContent = song.album;
            elements.playerAlbumExpanded.textContent = song.album;
            elements.playerImage.src = song.image_url;
            elements.playerImageExpanded.src = song.image_url;
            elements.audioPlayer.classList.remove('hidden');

            elements.player.load();
            const playPromise = elements.player.play();
            if (playPromise !== undefined) {
                await playPromise;
                elements.playPauseBtn.innerHTML = '<i class="fa fa-pause"></i>';
                elements.playPauseBtnExpanded.innerHTML = '<i class="fa fa-pause"></i>';
                updateProgress();
                updateLikeButton(song.id, elements.likeBtn);
            }
        } catch (error) {
            showStatus('Error playing song. Please try again.', 3000);
            console.error('Play song error:', error);
            elements.audioPlayer.classList.add('hidden');
        }
    };

    window.playNextSong = (id, full_name, album, artist, image_url, download_url, duration, year) => {
        const song = { id, full_name, album, artist, image_url, download_url, duration, year };
        queue.splice(currentSongIndex + 1, 0, song);
        showStatus(`${full_name} added to play next!`, 1000);
    };

    function updateHistory(song) {
        let history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        history = history.filter(s => s.id !== song.id);
        history.unshift(song);
        if (history.length > 50) history.pop();
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
        loadSuggestions();
    }

    [elements.playPauseBtn, elements.playPauseBtnExpanded].forEach(btn => {
        if (btn) {
            btn.addEventListener('click', async () => {
                if (elements.player.paused) {
                    try {
                        await elements.player.play();
                        elements.playPauseBtn.innerHTML = '<i class="fa fa-pause"></i>';
                        elements.playPauseBtnExpanded.innerHTML = '<i class="fa fa-pause"></i>';
                    } catch (error) {
                        showStatus('Failed to resume playback.', 3000);
                        console.error('Play error:', error);
                    }
                } else {
                    elements.player.pause();
                    elements.playPauseBtn.innerHTML = '<i class="fa fa-play"></i>';
                    elements.playPauseBtnExpanded.innerHTML = '<i class="fa fa-play"></i>';
                }
            });
        }
    });

    if (elements.prevBtn) {
        elements.prevBtn.addEventListener('click', () => {
            if (currentSongIndex > 0) {
                playSong(currentSongIndex - 1);
            } else {
                showStatus('No previous song available.', 2000);
            }
        });
    }

    if (elements.nextBtn) {
        elements.nextBtn.addEventListener('click', () => {
            if (queue.length > currentSongIndex + 1) {
                currentSongIndex++;
                songs[currentSongIndex] = queue[currentSongIndex];
                playSong(currentSongIndex);
            } else if (currentSongIndex < songs.length - 1) {
                playSong(currentSongIndex + 1);
            } else {
                showStatus('No next song available.', 2000);
            }
        });
    }

    if (elements.player) {
        elements.player.addEventListener('ended', () => {
            if (isLooping) {
                playSong(currentSongIndex);
            } else if (queue.length > currentSongIndex + 1) {
                currentSongIndex++;
                songs[currentSongIndex] = queue[currentSongIndex];
                playSong(currentSongIndex);
            } else if (currentSongIndex < songs.length - 1) {
                playSong(currentSongIndex + 1);
            } else {
                elements.playPauseBtn.innerHTML = '<i class="fa fa-play"></i>';
                elements.playPauseBtnExpanded.innerHTML = '<i class="fa fa-play"></i>';
                elements.audioPlayer.classList.add('hidden');
            }
        });
    }

    if (elements.loopBtn) {
        elements.loopBtn.addEventListener('click', () => {
            isLooping = !isLooping;
            elements.player.loop = isLooping;
            elements.loopBtn.classList.toggle('active', isLooping);
            showStatus(isLooping ? 'Loop enabled' : 'Loop disabled', 1000);
        });
    }

    window.toggleLike = (id, full_name, album, artist, image_url, download_url, duration, year, element) => {
        const likedSongs = JSON.parse(localStorage.getItem(LIKED_SONGS_KEY) || '[]');
        const isLiked = likedSongs.some(song => song.id === id);
        if (isLiked) {
            const updatedLikedSongs = likedSongs.filter(song => song.id !== id);
            localStorage.setItem(LIKED_SONGS_KEY, JSON.stringify(updatedLikedSongs));
            showStatus('Removed from Liked Songs!', 1000);
            element.querySelector('span').textContent = 'Like';
            updateLikeButton(id, element);
        } else {
            likedSongs.push({ id, full_name, album, artist, image_url, download_url, duration, year });
            localStorage.setItem(LIKED_SONGS_KEY, JSON.stringify(likedSongs));
            showStatus('Added to Liked Songs!', 1000);
            element.querySelector('span').textContent = 'Unlike';
            updateLikeButton(id, element);
        }
        if (!document.getElementById('liked-songs-tab').classList.contains('hidden')) renderLikedSongs();
    };

    function updateLikeButton(songId, btn) {
        const likedSongs = JSON.parse(localStorage.getItem(LIKED_SONGS_KEY) || '[]');
        const isLiked = likedSongs.some(f => f.id === songId);
        btn.classList.toggle('liked', isLiked);
        btn.classList.toggle('bg-teal-500', !isLiked);
        btn.classList.toggle('bg-red-500', isLiked);
        btn.querySelector('span').textContent = isLiked ? 'Unlike' : 'Like';
    }

    if (elements.likeBtn) {
        elements.likeBtn.addEventListener('click', () => {
            const song = songs[currentSongIndex];
            if (!song) return;
            toggleLike(song.id, song.full_name, song.album, song.artist, song.image_url, song.download_url, song.duration, song.year, elements.likeBtn);
        });
    }

    if (elements.playlistBtn) {
        elements.playlistBtn.addEventListener('click', () => {
            const song = songs[currentSongIndex];
            if (!song) return;
            showPlaylistModal(song.id, song.full_name, song.album, song.artist, song.image_url, song.download_url, song.duration, song.year);
        });
    }

    function updateProgress() {
        const update = () => {
            const current = elements.player.currentTime;
            const durationTime = elements.player.duration || 0;
            const percentage = durationTime ? (current / durationTime) * 100 : 0;
            elements.progressBar.style.width = `${percentage}%`;
            elements.currentTime.textContent = formatTime(current);
            elements.duration.textContent = formatTime(durationTime);
        };
        elements.player.addEventListener('timeupdate', update);
        return update;
    }

    if (elements.progressContainer) {
        elements.progressContainer.addEventListener('click', (e) => {
            const width = elements.progressContainer.offsetWidth;
            const clickX = e.offsetX;
            const percentage = clickX / width;
            elements.player.currentTime = percentage * elements.player.duration;
        });
    }

    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        seconds = Math.floor(seconds % 60);
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    }

    if (elements.lyricsBtn) {
        elements.lyricsBtn.addEventListener('click', () => {
            const song = songs[currentSongIndex];
            if (!song) return;
            fetchLyrics(song.full_name, song.artist);
            elements.lyricsModal.classList.remove('hidden');
        });
    }

    window.closeLyrics = () => {
        elements.lyricsModal.classList.add('hidden');
        if (lyricsInterval) {
            clearInterval(lyricsInterval);
        }
    };

    function fetchLyrics(title, artist) {
        elements.lyricsContent.innerHTML = '<p>Loading lyrics...</p>';
        setTimeout(() => {
            const lines = mockLyrics.default;
            displayLyrics(lines);
            startLyricsSync(lines);
        }, 1000);
    }

    function displayLyrics(lines) {
        elements.lyricsContent.innerHTML = '';
        const wrapper = document.createElement('div');
        wrapper.className = 'lyrics-wrapper';
        wrapper.style.transform = 'translateY(0)';
        lines.forEach((line, index) => {
            const p = document.createElement('p');
            p.className = 'lyric-line';
            p.textContent = line || '[Empty Line]';
            p.dataset.index = index;
            wrapper.appendChild(p);
        });
        elements.lyricsContent.appendChild(wrapper);
    }

    function startLyricsSync(lines) {
        if (lyricsInterval) clearInterval(lyricsInterval);
        const lineDuration = (elements.player.duration || 180) / Math.max(lines.length, 1);
        let currentLine = 0;
        lyricsInterval = setInterval(() => {
            const currentTime = elements.player.currentTime;
            currentLine = Math.floor(currentTime / lineDuration);
            const lyricLines = document.querySelectorAll('.lyric-line');
            lyricLines.forEach(line => {
                line.classList.remove('active');
                line.style.opacity = '0.5';
                line.style.transform = 'scale(1)';
            });
            const activeLine = document.querySelector(`.lyric-line[data-index="${currentLine}"]`);
            if (activeLine) {
                activeLine.classList.add('active');
                activeLine.style.opacity = '1';
                activeLine.style.transform = 'scale(1.05)';
                const offset = activeLine.offsetTop - elements.lyricsContent.offsetHeight / 2 + activeLine.offsetHeight / 2;
                document.querySelector('.lyrics-wrapper').style.transform = `translateY(${-offset}px)`;
            }
            if (elements.player.paused || elements.player.ended) {
                clearInterval(lyricsInterval);
            }
        }, 100);
    }

    if (elements.lyricsModal) {
        elements.lyricsModal.addEventListener('click', (e) => {
            if (e.target === elements.lyricsModal) {
                closeLyrics();
            }
        });
    }

    function renderLikedSongs() {
        if (!elements.likedSongsList) return;
        elements.likedSongsList.innerHTML = '';
        const likedSongs = JSON.parse(localStorage.getItem(LIKED_SONGS_KEY) || '[]');
        likedSongs.forEach((song, index) => {
            const div = document.createElement('div');
            div.className = 'song-card bg-gray-800 bg-opacity-30 backdrop-blur-md rounded-xl p-4 shadow-lg';
            div.innerHTML = `
                <img src="${song.image_url}" alt="Song Image" class="w-full h-40 object-cover rounded-lg mb-4">
                <h3 class="text-base font-bold truncate">${song.full_name}</h3>
                <p class="text-sm text-gray-400 truncate">${song.album}</p>
                <p class="text-sm text-gray-400 truncate">${song.artist}</p>
                <p class="text-sm text-gray-400">${song.duration} | ${song.year}</p>
                <div class="mt-2 space-y-2">
                    <button class="bg-teal-500 text-white rounded-full py-1.5 px-3 w-full hover:bg-teal-600 text-sm" onclick="playLikedSong(${index})"><i class="fa fa-play mr-1"></i>Play</button>
                    <button class="bg-blue-500 text-white rounded-full py-1.5 px-3 w-full hover:bg-blue-600 text-sm" onclick="playNextSong('${song.id}', '${song.full_name}', '${song.album}', '${song.artist}', '${song.image_url}', '${song.download_url}', '${song.duration}', '${song.year}')"><i class="fa fa-step-forward mr-1"></i>Play Next</button>
                    <button class="bg-red-500 text-white rounded-full py-1.5 px-3 w-full hover:bg-red-600 like-btn text-sm" data-id="${song.id}" onclick="toggleLike('${song.id}', '${song.full_name}', '${song.album}', '${song.artist}', '${song.image_url}', '${song.download_url}', '${song.duration}', '${song.year}', this)"><i class="fa fa-heart mr-1"></i><span>Unlike</span></button>
                </div>
            `;
            elements.likedSongsList.appendChild(div);
            updateLikeButton(song.id, div.querySelector(`.like-btn[data-id="${song.id}"]`));
        });
    }

    window.playLikedSong = (index) => {
        songs = JSON.parse(localStorage.getItem(LIKED_SONGS_KEY) || '[]');
        playSong(index);
    };

    window.createPlaylist = () => {
        const name = prompt('Enter playlist name:');
        if (!name) return;
        const playlists = JSON.parse(localStorage.getItem('playlists') || '{}');
        playlists[name] = playlists[name] || [];
        localStorage.setItem('playlists', JSON.stringify(playlists));
        renderPlaylists();
    };

    window.showPlaylistModal = (id, full_name, album, artist, image_url, download_url, duration, year) => {
        const playlists = JSON.parse(localStorage.getItem('playlists') || '{}');
        const playlistOptions = document.getElementById('playlist-options');
        playlistOptions.innerHTML = '';
        Object.keys(playlists).forEach(name => {
            const li = document.createElement('li');
            li.className = 'bg-gray-700 bg-opacity-50 rounded-lg p-2 cursor-pointer hover:bg-teal-500 text-sm';
            li.textContent = name;
            li.onclick = () => addToPlaylist(name, id, full_name, album, artist, image_url, download_url, duration, year);
            playlistOptions.appendChild(li);
        });
        document.getElementById('playlistModal').classList.remove('hidden');
    };

    window.addToPlaylist = (name, id, full_name, album, artist, image_url, download_url, duration, year) => {
        const playlists = JSON.parse(localStorage.getItem('playlists') || '{}');
        const song = { id, full_name, album, artist, image_url, download_url, duration, year };
        if (!playlists[name].some(s => s.id === id)) {
            playlists[name].push(song);
            localStorage.setItem('playlists', JSON.stringify(playlists));
            showStatus(`Added ${full_name} to ${name}!`, 1000);
        } else {
            showStatus(`${full_name} is already in ${name}!`, 1000);
        }
        document.getElementById('playlistModal').classList.add('hidden');
        if (!document.getElementById('playlists-tab').classList.contains('hidden')) renderPlaylists();
    };

    function parseDuration(duration) {
        const [minutes, seconds] = duration.split(':').map(Number);
        return minutes * 60 + seconds;
    }

    function renderPlaylists(sortBy = 'name') {
        if (!elements.playlistsList) return;
        elements.playlistsList.innerHTML = '';
        const playlists = JSON.parse(localStorage.getItem('playlists') || '{}');
        const playlistNames = Object.keys(playlists);
        if (sortBy === 'name') {
            playlistNames.sort();
        } else if (sortBy === 'duration') {
            playlistNames.sort((a, b) => {
                const totalDurationA = playlists[a].reduce((sum, song) => sum + parseDuration(song.duration), 0);
                const totalDurationB = playlists[b].reduce((sum, song) => sum + parseDuration(song.duration), 0);
                return totalDurationB - totalDurationA;
            });
        }

        playlistNames.forEach(name => {
            const div = document.createElement('div');
            div.className = 'mb-6';
            div.innerHTML = `
                <div class="flex items-center justify-between">
                    <h3 class="text-lg font-bold truncate">${name}</h3>
                    <div class="flex space-x-2">
                        <button class="text-red-500 hover:text-red-600 text-sm" onclick="deletePlaylist('${name}')"><i class="fa fa-trash"></i></button>
                        <select class="bg-gray-700 bg-opacity-50 text-white rounded-lg py-1 px-2 text-sm" onchange="renderPlaylists(this.value)">
                            <option value="name">Sort by Name</option>
                            <option value="duration">Sort by Duration</option>
                            <option value="date">Sort by Date</option>
                        </select>
                    </div>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                    ${playlists[name].map((song, index) => `
                        <div class="song-card bg-gray-800 bg-opacity-30 backdrop-blur-md rounded-xl p-4 shadow-lg">
                            <img src="${song.image_url}" alt="Song Image" class="w-full h-40 object-cover rounded-lg mb-4">
                            <h3 class="text-base font-bold truncate">${song.full_name}</h3>
                            <p class="text-sm text-gray-400 truncate">${song.album}</p>
                            <p class="text-sm text-gray-400 truncate">${song.artist}</p>
                            <p class="text-sm text-gray-400">${song.duration} | ${song.year}</p>
                            <div class="mt-2 space-y-2">
                                <button class="bg-teal-500 text-white rounded-full py-1.5 px-3 w-full hover:bg-teal-600 text-sm" onclick="playPlaylistSong('${name}', ${index})"><i class="fa fa-play mr-1"></i>Play</button>
                                <button class="bg-blue-500 text-white rounded-full py-1.5 px-3 w-full hover:bg-blue-600 text-sm" onclick="playNextSong('${song.id}', '${song.full_name}', '${song.album}', '${song.artist}', '${song.image_url}', '${song.download_url}', '${song.duration}', '${song.year}')"><i class="fa fa-step-forward mr-1"></i>Play Next</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
            elements.playlistsList.appendChild(div);
        });
    }

    window.deletePlaylist = (name) => {
        if (confirm(`Delete ${name} playlist?`)) {
            const playlists = JSON.parse(localStorage.getItem('playlists') || '{}');
            delete playlists[name];
            localStorage.setItem('playlists', JSON.stringify(playlists));
            renderPlaylists();
        }
    };

    window.playPlaylistSong = (name, index) => {
        songs = JSON.parse(localStorage.getItem('playlists') || '{}')[name];
        playSong(index);
    };

    function renderOffline() {
        if (!elements.offlineList) return;
        elements.offlineList.innerHTML = '';
        const offlineSongs = JSON.parse(localStorage.getItem('offlineSongs') || '[]');
        offlineSongs.forEach((song, index) => {
            const div = document.createElement('div');
            div.className = 'song-card bg-gray-800 bg-opacity-30 backdrop-blur-md rounded-xl p-4 shadow-lg';
            div.innerHTML = `
                <img src="${song.image_url}" alt="Song Image" class="w-full h-40 object-cover rounded-lg mb-4">
                <h3 class="text-base font-bold truncate">${song.full_name}</h3>
                <p class="text-sm text-gray-400 truncate">${song.album}</p>
                <p class="text-sm text-gray-400 truncate">${song.artist}</p>
                <p class="text-sm text-gray-400">${song.duration} | ${song.year}</p>
                <button class="mt-2 bg-teal-500 text-white rounded-full py-1.5 px-3 w-full hover:bg-teal-600 text-sm" onclick="playOffline(${index})"><i class="fa fa-play mr-1"></i>Play</button>
            `;
            elements.offlineList.appendChild(div);
        });
    }

    window.playOffline = async (index) => {
        const offlineSongs = JSON.parse(localStorage.getItem('offlineSongs') || '[]');
        songs = offlineSongs;
        await playSong(index);
    };

    window.showTab = (tab) => {
        ['home-tab', 'search-tab', 'suggestions-tab', 'liked-songs-tab', 'playlists-tab', 'offline-tab'].forEach(id => {
            const tabElement = document.getElementById(id);
            if (tabElement) tabElement.classList.add('hidden');
        });
        const activeTab = document.getElementById(`${tab}-tab`);
        if (activeTab) activeTab.classList.remove('hidden');
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('bg-teal-500');
            btn.classList.add('bg-gray-800', 'bg-opacity-50');
        });
        const activeBtn = document.querySelector(`.tab-btn[onclick*="${tab}"]`);
        if (activeBtn) {
            activeBtn.classList.add('bg-teal-500');
            activeBtn.classList.remove('bg-gray-800', 'bg-opacity-50');
        }
        if (tab === 'liked-songs') renderLikedSongs();
        if (tab === 'playlists') renderPlaylists();
        if (tab === 'offline') renderOffline();
        if (tab === 'suggestions') loadSuggestions();
        if (tab === 'home') loadHomeContent();
    };

    window.saveSettings = () => {
        const settings = {
            isDark: document.getElementById('theme-toggle')?.checked ?? true,
            buttonSize: document.getElementById('button-size')?.value ?? 'small',
            fontStyle: document.getElementById('font-style')?.value ?? 'poppins',
            progressStyle: document.getElementById('progress-style')?.value ?? 'simple',
            progressColor: document.getElementById('progress-color')?.value ?? 'teal'
        };
        localStorage.setItem('settings', JSON.stringify(settings));
        applySettings();
        if (!document.getElementById('suggestions-tab').classList.contains('hidden') || !document.getElementById('home-tab').classList.contains('hidden')) {
            loadSuggestions();
        }
    };

    window.applySettings = () => {
        const settings = JSON.parse(localStorage.getItem('settings') || '{}');
        const isDark = settings.isDark !== false;
        document.body.classList.toggle('light', !isDark);
        document.body.classList.remove('font-poppins', 'font-inter');
        document.body.classList.add(`font-${settings.fontStyle || 'poppins'}`);
        document.body.classList.remove('button-small', 'button-medium');
        document.body.classList.add(`button-${settings.buttonSize || 'small'}`);
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) themeToggle.checked = isDark;
        const buttonSize = document.getElementById('button-size');
        if (buttonSize) buttonSize.value = settings.buttonSize || 'small';
        const fontStyle = document.getElementById('font-style');
        if (fontStyle) fontStyle.value = settings.fontStyle || 'poppins';
        const progressStyle = document.getElementById('progress-style');
        if (progressStyle) progressStyle.value = settings.progressStyle || 'simple';
        const progressColor = document.getElementById('progress-color');
        if (progressColor) progressColor.value = settings.progressColor || 'teal';
        elements.progressContainer.classList.remove('simple', 'dots', 'wavy', 'color-teal', 'color-red', 'color-purple');
        elements.progressContainer.classList.add(settings.progressStyle || 'simple', `color-${settings.progressColor || 'teal'}`);
        elements.progressBar.classList.remove('bg-teal-500', 'bg-red-500', 'bg-purple-500');
        elements.progressBar.classList.add(`bg-${settings.progressColor || 'teal'}-500`);
    };
});