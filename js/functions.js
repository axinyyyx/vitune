$(document).ready(function() {
    // DOM Elements
    const elements = {
        searchBox: $('#search-box'),
        clearSearch: $('#clear-search'),
        results: $('#results'),
        status: $('#status'),
        player: $('#player'),
        audioSource: $('#audio-source'),
        playerName: $('#player-name'),
        playerAlbum: $('#player-album'),
        playerImage: $('#player-image'),
        audioPlayer: $('#audio-player'),
        playPauseBtn: $('#play-pause-btn'),
        playPauseBtnExpanded: $('#play-pause-btn-expanded'),
        prevBtn: $('#prev-btn'),
        nextBtn: $('#next-btn'),
        nextBtnExpanded: $('#next-btn-expanded'),
        loopBtn: $('#loop-btn'),
        likeBtn: $('#like-btn'),
        playlistBtn: $('#playlist-btn'),
        progressBar: $('#progress-bar'),
        progressContainer: $('#progress-container'),
        currentTime: $('#current-time'),
        duration: $('#duration'),
        likesList: $('#likes-list'),
        playlistsList: $('#playlists-list'),
        offlineList: $('#offline-list'),
        aiSuggestionBar: $('#ai-suggestion-bar'),
        playerNameExpanded: $('#player-name-expanded'),
        playerAlbumExpanded: $('#player-album-expanded'),
        playerImageExpanded: $('#player-image-expanded'),
        homeContent: $('#home-content'),
        playlistModal: $('#playlist-modal'),
        playlistOptions: $('#playlist-options'),
        closePlaylistModal: $('#close-playlist-modal'),
        createPlaylistBtn: $('#create-playlist-btn'),
        tabButtons: $('.tab-btn'),
        togglePlayerBtn: $('.toggle-player-btn'),
        audioPlayerContent: $('.audio-player-content'),
        bitrateSelect: $('#ViTune-bitrate'),
        loadMoreBtn: $('#loadmore'),
        downloadModal: $('#mpopupBox'),
        downloadList: $('#download-list'),
        closeDownloadModal: $('#close-download-modal'),
        downloadLink: $('#mpopupLink')
    };

    // State Variables
    let state = {
        currentSongIndex: -1,
        songs: [],
        queue: [],
        isLooping: false,
        isPlaying: false,
        currentSong: null,
        lastSearch: '',
        pageIndex: 1,
        resultsObjects: {}
    };

    const STORAGE_KEYS = {
        HISTORY: 'listening_history',
        LIKES: 'likes',
        PLAYLISTS: 'playlists',
        OFFLINE: 'offlineSongs',
        SETTINGS: 'settings'
    };

    const JIOSAAVN_API = 'https://jiosaavn-api-privatecvc2.vercel.app/search/songs';

    // Fallback Song
    const fallbackSong = {
        id: 'fallback1',
        full_name: 'ViTune - Fallback Song',
        title: 'Fallback Song',
        album: 'Unknown Album',
        artist: 'Unknown Artist',
        duration: '3:00',
        image: 'img/58964258.png',
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        year: '2025',
        language: 'english'
    };

    // Initialize Application
    function init() {
        applySettings();
        loadAISuggestions();
        loadHomeContent();
        bindEventListeners();
        handleDirectURL();
        setupAutoPlay();
    }

    // Bind Event Listeners
    function bindEventListeners() {
        // Search Input
        let searchTimeout;
        elements.searchBox.on('input', function() {
            clearTimeout(searchTimeout);
            const query = $(this).val().trim();
            elements.clearSearch.toggleClass('hidden', !query);
            if (query.length >= 2) {
                searchTimeout = setTimeout(() => {
                    doViTuneSearch(query);
                    showTab('search');
                }, 300);
            } else {
                elements.results.empty();
                elements.status.text('');
                showTab('home');
            }
        });

        // Clear Search
        elements.clearSearch.on('click', clearSearch);

        // Bitrate Change
        elements.bitrateSelect.on('change', function() {
            if (state.lastSearch) {
                doViTuneSearch(state.lastSearch);
            }
        });

        // Load More
        elements.loadMoreBtn.on('click', nextPage);

        // Tab Buttons
        elements.tabButtons.on('click', function() {
            const tab = $(this).data('tab');
            showTab(tab);
        });

        // Audio Player Controls
        elements.playPauseBtn.add(elements.playPauseBtnExpanded).on('click', togglePlayPause);
        elements.prevBtn.on('click', playPreviousSong);
        elements.nextBtn.add(elements.nextBtnExpanded).on('click', playNextSong);
        elements.loopBtn.on('click', toggleLoop);
        elements.likeBtn.on('click', toggleLikeCurrentSong);
        elements.playlistBtn.on('click', showPlaylistModalCurrentSong);
        elements.togglePlayerBtn.on('click', togglePlayer);
        elements.audioPlayerContent.find('.compact').on('click', togglePlayer);
        elements.closePlaylistModal.on('click', closePlaylistModal);
        elements.createPlaylistBtn.on('click', createPlaylist);
        elements.closeDownloadModal.on('click', () => elements.downloadModal.addClass('hidden'));
        elements.downloadLink.on('click', () => elements.downloadModal.removeClass('hidden'));

        // Progress Bar
        elements.progressContainer.on('click', seekSong);

        // Audio Events
        elements.player.on('timeupdate', updateProgress);
        elements.player.on('ended', handleSongEnd);
        elements.player.on('error', () => {
            elements.status.text('Error loading song.');
            setTimeout(() => elements.status.text(''), 2000);
        });

        // Settings Changes
        $('#theme-toggle, #transparent-toggle, #mood-toggle, #theme-style, #font-size, #font-style, #progress-style, #progress-color').on('change', saveSettings);
    }

    // Search Functions
    function clearSearch() {
        elements.searchBox.val('');
        elements.clearSearch.addClass('hidden');
        elements.results.empty();
        elements.status.text('');
        showTab('home');
        state.lastSearch = '';
        state.pageIndex = 1;
        state.resultsObjects = {};
        loadAISuggestions();
    }

    function handleDirectURL() {
        const hash = window.location.hash.substring(1);
        if (hash) {
            doViTuneSearch(decodeURIComponent(hash), true);
            showTab('search');
        }
    }

    async function doViTuneSearch(query, autoPlayFirst = false) {
        elements.status.html('<span class="spinner"></span> Searching...');
        elements.results.html(generateSkeletonCards(4));
        state.lastSearch = query;
        state.pageIndex = 1;

        try {
            let url = `${JIOSAAVN_API}?query=${encodeURIComponent(query)}&limit=40&page=${state.pageIndex}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`API request failed: ${response.status}`);
            const data = await response.json();
            const results = data.data?.results || [];

            state.songs = results
                .filter(song => song.downloadUrl && song.downloadUrl[elements.bitrateSelect.val()])
                .map(song => {
                    const bitrateIndex = elements.bitrateSelect.val();
                    let duration = parseInt(song.duration);
                    let measuredTime = new Date(null);
                    measuredTime.setSeconds(duration);
                    let playTime = measuredTime.toISOString().substr(11, 8);
                    if (playTime.startsWith('00:0')) playTime = playTime.slice(4);
                    else if (playTime.startsWith('00:')) playTime = playTime.slice(3);

                    return {
                        id: song.id,
                        full_name: song.name,
                        title: song.name,
                        album: song.album?.name || 'Unknown Album',
                        artist: song.primaryArtists || 'Unknown Artist',
                        duration: playTime,
                        image: song.image[1]?.link || 'img/58964258.png',
                        url: song.downloadUrl[bitrateIndex]?.link || '',
                        year: song.year || 'Unknown',
                        language: song.language || 'english'
                    };
                });

            state.resultsObjects = {};
            results.forEach(song => {
                state.resultsObjects[song.id] = { track: song };
            });

            setTimeout(() => {
                elements.status.text('');
                if (state.songs.length === 0) {
                    elements.results.html('<p class="text-sm text-gray-400">No results found. Try a different query.</p>');
                    state.songs = [fallbackSong];
                    return;
                }
                renderResults();
                if (autoPlayFirst && state.songs.length > 0) {
                    playSong(0);
                }
                loadAISuggestions();
            }, 500);
        } catch (error) {
            console.error('Search error:', error);
            elements.status.text('Failed to fetch songs. Using fallback song.');
            state.songs = [fallbackSong];
            renderResults();
            setTimeout(() => elements.status.text(''), 2000);
        }
    }

    function nextPage() {
        if (!state.lastSearch) return;
        state.pageIndex++;
        elements.status.html('<span class="spinner"></span> Loading more...');

        fetch(`${JIOSAAVN_API}?query=${encodeURIComponent(state.lastSearch)}&limit=40&page=${state.pageIndex}`)
            .then(response => {
                if (!response.ok) throw new Error(`API request failed: ${response.status}`);
                return response.json();
            })
            .then(data => {
                const results = data.data?.results || [];
                const newSongs = results
                    .filter(song => song.downloadUrl && song.downloadUrl[elements.bitrateSelect.val()])
                    .map(song => {
                        const bitrateIndex = elements.bitrateSelect.val();
                        let duration = parseInt(song.duration);
                        let measuredTime = new Date(null);
                        measuredTime.setSeconds(duration);
                        let playTime = measuredTime.toISOString().substr(11, 8);
                        if (playTime.startsWith('00:0')) playTime = playTime.slice(4);
                        else if (playTime.startsWith('00:')) playTime = playTime.slice(3);

                        return {
                            id: song.id,
                            full_name: song.name,
                            title: song.name,
                            album: song.album?.name || 'Unknown Album',
                            artist: song.primaryArtists || 'Unknown Artist',
                            duration: playTime,
                            image: song.image[1]?.link || 'img/58964258.png',
                            url: song.downloadUrl[bitrateIndex]?.link || '',
                            year: song.year || 'Unknown',
                            language: song.language || 'english'
                        };
                    });

                results.forEach(song => {
                    state.resultsObjects[song.id] = { track: song };
                });

                state.songs = [...state.songs, ...newSongs];
                elements.status.text('');
                renderResults();
            })
            .catch(error => {
                console.error('Load more error:', error);
                elements.status.text('Failed to load more songs.');
                setTimeout(() => elements.status.text(''), 2000);
            });
    }

    // Render Functions
    function generateSkeletonCards(count) {
        return `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">${Array(count).fill(`
            <div class="song-card skeleton h-64 rounded-xl">
                <img src="img/58964258.png" alt="Song Image" class="w-full h-40 object-cover rounded-lg mb-4">
                <div class="h-4 bg-gray-700 rounded mb-2"></div>
                <div class="h-3 bg-gray-700 rounded"></div>
            </div>
        `).join('')}</div>`;
    }

    async function loadAISuggestions() {
        const settings = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}');
        const moodOff = settings.moodOff || false;
        const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY) || '[]');
        let suggestions = [];

        if (history.length > 0 && !moodOff) {
            const lastSong = history[0];
            try {
                const response = await fetch(`${JIOSAAVN_API}?query=${encodeURIComponent(lastSong.artist)}&limit=4`);
                if (response.ok) {
                    const data = await response.json();
                    suggestions = (data.data?.results || [])
                        .filter(song => song.downloadUrl && song.downloadUrl[elements.bitrateSelect.val()])
                        .map(song => {
                            const bitrateIndex = elements.bitrateSelect.val();
                            let duration = parseInt(song.duration);
                            let measuredTime = new Date(null);
                            measuredTime.setSeconds(duration);
                            let playTime = measuredTime.toISOString().substr(11, 8);
                            if (playTime.startsWith('00:0')) playTime = playTime.slice(4);
                            else if (playTime.startsWith('00:')) playTime = playTime.slice(3);

                            return {
                                id: song.id,
                                full_name: song.name,
                                title: song.name,
                                album: song.album?.name || 'Unknown Album',
                                artist: song.primaryArtists || 'Unknown Artist',
                                duration: playTime,
                                image: song.image[1]?.link || 'img/58964258.png',
                                url: song.downloadUrl[bitrateIndex]?.link || '',
                                year: song.year || 'Unknown',
                                language: song.language || 'english'
                            };
                        });
                }
            } catch (error) {
                console.error('AI suggestions error:', error);
            }
        }

        if (suggestions.length < 4) {
            try {
                const response = await fetch(`${JIOSAAVN_API}?query=trending&limit=4`);
                if (response.ok) {
                    const data = await response.json();
                    const additional = (data.data?.results || [])
                        .filter(song => song.downloadUrl && song.downloadUrl[elements.bitrateSelect.val()])
                        .map(song => {
                            const bitrateIndex = elements.bitrateSelect.val();
                            let duration = parseInt(song.duration);
                            let measuredTime = new Date(null);
                            measuredTime.setSeconds(duration);
                            let playTime = measuredTime.toISOString().substr(11, 8);
                            if (playTime.startsWith('00:0')) playTime = playTime.slice(4);
                            else if (playTime.startsWith('00:')) playTime = playTime.slice(3);

                            return {
                                id: song.id,
                                full_name: song.name,
                                title: song.name,
                                album: song.album?.name || 'Unknown Album',
                                artist: song.primaryArtists || 'Unknown Artist',
                                duration: playTime,
                                image: song.image[1]?.link || 'img/58964258.png',
                                url: song.downloadUrl[bitrateIndex]?.link || '',
                                year: song.year || 'Unknown',
                                language: song.language || 'english'
                            };
                        });
                    suggestions = [...new Set([...suggestions, ...additional])].slice(0, 4);
                }
            } catch (error) {
                console.error('Trending songs error:', error);
                suggestions.push(fallbackSong);
            }
        }

        state.songs = suggestions.length ? suggestions : [fallbackSong];
        renderAISuggestionBar();
    }

    function renderAISuggestionBar() {
        elements.aiSuggestionBar.empty();
        if (!state.songs.length) {
            elements.aiSuggestionBar.html('<p class="text-sm text-gray-400">No recommendations available.</p>');
            return;
        }
        const html = `
            <div class="flex space-x-4 overflow-x-auto no-scrollbar">
                ${state.songs.map((song, index) => `
                    <div class="song-card bg-gray-800 bg-opacity-30 backdrop-blur-md rounded-xl p-3 shadow-lg w-32 flex-shrink-0">
                        <img src="${song.image}" alt="Song Image" class="w-full h-20 object-cover rounded-lg mb-2">
                        <h3 class="text-sm font-bold truncate">${song.full_name}</h3>
                        <p class="text-xs text-gray-400 truncate">${song.artist}</p>
                        <button class="mt-2 bg-teal-500 text-white rounded-full py-1 px-2 w-full hover:bg-teal-600 text-xs play-song-btn" data-index="${index}"><i class="fa fa-play mr-1"></i>Play</button>
                    </div>
                `).join('')}
            </div>
        `;
        elements.aiSuggestionBar.html(html);
        elements.aiSuggestionBar.find('.play-song-btn').on('click', function() {
            playSong($(this).data('index'));
        });
    }

    function renderResults() {
        elements.results.empty();
        if (!state.songs.length) {
            elements.results.html('<p class="text-sm text-gray-400">No results found.</p>');
            return;
        }
        const html = generateSongCards(state.songs);
        elements.results.html(html);
        bindCardEventListeners(elements.results);
    }

    function loadHomeContent() {
        const likes = JSON.parse(localStorage.getItem(STORAGE_KEYS.LIKES) || '[]');
        const offlineSongs = JSON.parse(localStorage.getItem(STORAGE_KEYS.OFFLINE) || '[]');
        const playlists = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYLISTS) || '{}');
        const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY) || '[]');

        const html = `
            <h2 class="text-lg font-bold mb-4">Recently Played</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                ${history.length ? generateSongCards(history.slice(0, 4), 'play-recent-btn') : '<p class="text-sm text-gray-500">No recently played songs.</p>'}
            </div>
            <h2 class="text-lg font-bold mb-4">Liked Songs</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                ${likes.length ? generateSongCards(likes.slice(0, 8), 'play-like-btn-song') : '<p class="text-sm text-gray-500">No liked songs yet.</p>'}
            </div>
            <h2 class="text-lg font-bold mb-4">Offline Songs</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                ${offlineSongs.length ? generateSongCards(offlineSongs.slice(0, 4), 'play-offline-btn') : '<p class="text-sm text-gray-500">No offline songs.</p>'}
            </div>
            <h2 class="text-lg font-bold mb-4">Playlists</h2>
            <div class="space-y-4">
                ${Object.keys(playlists).length ? Object.keys(playlists).map(name => `
                    <div>
                        <div class="flex items-center mb-4">
                            <h3 class="text-base font-bold truncate">${name}</h3>
                            <button class="text-red-500 hover:text-red-600 ml-2 text-sm delete-playlist-btn" data-name="${name}"><i class="fa fa-trash"></i></button>
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            ${playlists[name].length ? generateSongCards(playlists[name].slice(0, 4), 'play-playlist-btn', name) : '<p class="text-sm text-gray-500">Empty playlist.</p>'}
                        </div>
                    </div>
                `).join('') : '<p class="text-sm text-gray-600">No playlists yet.</p>'}
            </div>
        `;
        elements.homeContent.html(html);
        bindHomeEventListeners();
    }

    function generateSongCards(songs, playBtnClass = 'play-song-btn', playlistName = null) {
        return `
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                ${songs.map((song, index) => `
                    <div class="song-card bg-gray-800 bg-opacity-30 backdrop-blur-md rounded-xl p-4 shadow-lg">
                        <img src="${song.image}" alt="Song Image" class="w-full h-40 object-cover rounded-lg mb-4">
                        <h3 class="text-sm font-bold truncate">${song.full_name}</h3>
                        <p class="text-xs text-gray-400 truncate">${song.album}</p>
                        <p class="text-xs text-gray-400 truncate">${song.artist}</p>
                        <p class="text-xs text-gray-400">${song.duration} | ${song.year}</p>
                        <div class="mt-2 space-y-2">
                            <button class="bg-teal-500 text-white rounded-full py-1.5 px-3 w-full hover:bg-teal-600 text-sm ${playBtnClass}" data-index="${index}" ${playlistName ? `data-playlist="${playlistName}"` : ''}><i class="fa fa-play mr-1"></i>Play</button>
                            <button class="bg-blue-500 text-white rounded-full py-1.5 px-3 w-full hover:bg-blue-600 text-sm play-next-btn" data-song='${JSON.stringify(song)}'><i class="fa fa-step-forward mr-1"></i>Play Next</button>
                            <button class="bg-red-500 text-white rounded-full py-1.5 px-3 w-full hover:bg-red-600 like-btn text-sm" data-id="${song.id}"><i class="fa fa-heart mr-1"></i><span>${isLiked(song.id) ? 'Unlike' : 'Like'}</span></button>
                            <button class="bg-yellow-500 text-white rounded-full py-1.5 px-3 w-full hover:bg-yellow-600 text-sm playlist-btn" data-song='${JSON.stringify(song)}'><i class="fa fa-plus mr-1"></i>Add to Playlist</button>
                            <button class="bg-purple-500 text-white rounded-full py-1.5 px-3 w-full hover:bg-purple-600 text-sm download-btn" data-id="${song.id}"><i class="fa fa-download mr-1"></i>Download</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function renderLikes() {
        elements.likesList.empty();
        const likes = JSON.parse(localStorage.getItem(STORAGE_KEYS.LIKES) || '[]');
        if (!likes.length) {
            elements.likesList.html('<p class="text-sm text-gray-500">No liked songs yet.</p>');
            return;
        }
        const html = generateSongCards(likes, 'play-like-btn');
        elements.likesList.html(html);
        bindCardEventListeners(elements.likesList);
    }

    function renderPlaylists() {
        elements.playlistsList.empty();
        const playlists = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYLISTS) || '{}');
        if (!Object.keys(playlists).length) {
            elements.playlistsList.html('<p class="text-sm text-gray-500">No playlists yet.</p>');
            return;
        }
        const html = `
            ${Object.keys(playlists).map(name => `
                <div class="mb-6">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-base font-bold truncate">${name}</h3>
                        <button class="text-red-500 hover:text-red-600 text-sm delete-playlist-btn" data-name="${name}"><i class="fa fa-trash"></i></button>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        ${playlists[name].length ? generateSongCards(playlists[name], 'play-playlist-btn', name) : '<p class="text-sm text-gray-500">Empty playlist.</p>'}
                    </div>
                </div>
            `).join('')}
        `;
        elements.playlistsList.html(html);
        bindPlaylistEventListeners();
    }

    function renderOffline() {
        elements.offlineList.empty();
        const offlineSongs = JSON.parse(localStorage.getItem(STORAGE_KEYS.OFFLINE) || '[]');
        if (!offlineSongs.length) {
            elements.offlineList.html('<p class="text-sm text-gray-500">No offline songs.</p>');
            return;
        }
        const html = generateSongCards(offlineSongs, 'play-offline-btn');
        elements.offlineList.html(html);
        bindCardEventListeners(elements.offlineList);
    }

    // Event Binding for Cards
    function bindCardEventListeners($container) {
        $container.find('.play-song-btn').on('click', function() {
            playSong($(this).data('index'));
        });
        $container.find('.play-like-btn').on('click', function() {
            playLike($(this).data('index'));
        });
        $container.find('.play-offline-btn').on('click', function() {
            playOffline($(this).data('index'));
        });
        $container.find('.play-playlist-btn').on('click', function() {
            const playlist = $(this).data('playlist');
            const index = $(this).data('index');
            playPlaylistSong(playlist, index);
        });
        $container.find('.play-next-btn').on('click', function() {
            const song = JSON.parse($(this).data('song'));
            queueSong(song);
        });
        $container.find('.like-btn').on('click', function() {
            const songId = $(this).data('id');
            toggleLike(songId, $(this));
        });
        $container.find('.playlist-btn').on('click', function() {
            const song = JSON.parse($(this).data('song'));
            showPlaylistModal(song);
        });
        $container.find('.download-btn').on('click', function() {
            const songId = $(this).data('id');
            addDownload(songId);
        });
    }

    function bindHomeEventListeners() {
        bindCardEventListeners(elements.homeContent);
        elements.homeContent.find('.delete-playlist-btn').on('click', function() {
            deletePlaylist($(this).data('name'));
        });
    }

    function bindPlaylistEventListeners() {
        bindCardEventListeners(elements.playlistsList);
        elements.playlistsList.find('.delete-playlist-btn').on('click', function() {
            deletePlaylist($(this).data('name'));
        });
    }

    // Playback Functions
    async function playSong(index) {
        if (index < 0 || index >= state.songs.length) return;
        const song = state.songs[index];
        state.currentSongIndex = index;
        state.currentSong = song;
        updateHistory(song);
        await cacheSong(song);
        elements.audioSource.attr('src', song.url);
        document.title = `${song.full_name} - ${song.album}`;
        elements.playerName.text(song.full_name);
        elements.playerNameExpanded.text(song.full_name);
        elements.playerAlbum.text(song.album);
        elements.playerAlbumExpanded.text(song.album);
        elements.playerImage.attr('src', song.image);
        elements.playerImageExpanded.attr('src', song.image);
        elements.audioPlayer.removeClass('hidden');
        elements.player[0].load();
        try {
            await elements.player[0].play();
            state.isPlaying = true;
            updatePlayPauseButtons();
            updateLikeButton();
            if (!elements.audioPlayerContent.hasClass('expanded')) {
                togglePlayer();
            }
        } catch (error) {
            elements.status.text('Failed to play song.');
            console.error('Playback error:', error);
            setTimeout(() => elements.status.text(''), 2000);
        }
        loadAISuggestions();
    }

    function togglePlayPause() {
        if (state.isPlaying) {
            elements.player[0].pause();
            state.isPlaying = false;
        } else {
            elements.player[0].play().then(() => {
                state.isPlaying = true;
            }).catch(error => {
                elements.status.text('Failed to play song.');
                console.error('Playback error:', error);
                setTimeout(() => elements.status.text(''), 2000);
            });
        }
        updatePlayPauseButtons();
    }

    function updatePlayPauseButtons() {
        const icon = state.isPlaying ? 'fa-pause' : 'fa-play';
        elements.playPauseBtn.html(`<i class="fa ${icon}"></i>`);
        elements.playPauseBtnExpanded.html(`<i class="fa ${icon}"></i>`);
    }

    function playPreviousSong() {
        if (state.currentSongIndex > 0) {
            playSong(state.currentSongIndex - 1);
        }
    }

    function playNextSong() {
        if (state.queue.length > state.currentSongIndex + 1) {
            state.currentSongIndex++;
            state.songs[state.currentSongIndex] = state.queue[state.currentSongIndex];
            playSong(state.currentSongIndex);
        } else if (state.currentSongIndex < state.songs.length - 1) {
            playSong(state.currentSongIndex + 1);
        }
    }

    function queueSong(song) {
        state.queue.splice(state.currentSongIndex + 1, 0, song);
        elements.status.text(`${song.full_name} added to play next!`);
        setTimeout(() => elements.status.text(''), 2000);
    }

    function handleSongEnd() {
        if (state.isLooping) {
            playSong(state.currentSongIndex);
        } else if (state.queue.length > state.currentSongIndex + 1) {
            playNextSong();
        } else if (state.currentSongIndex < state.songs.length - 1) {
            playSong(state.currentSongIndex + 1);
        } else {
            state.isPlaying = false;
            updatePlayPauseButtons();
        }
    }

    function toggleLoop() {
        state.isLooping = !state.isLooping;
        elements.player[0].loop = state.isLooping;
        elements.loopBtn.toggleClass('active', state.isLooping);
        elements.status.text(state.isLooping ? 'Loop enabled' : 'Loop disabled');
        setTimeout(() => elements.status.text(''), 2000);
    }

    function updateProgress() {
        const current = elements.player[0].currentTime;
        const duration = elements.player[0].duration || 0;
        const percentage = duration ? (current / duration) * 100 : 0;
        elements.progressBar.css('width', percentage + '%');
        elements.currentTime.text(formatTime(current));
        elements.duration.text(formatTime(duration));
    }

    function seekSong(e) {
        const width = elements.progressContainer.width();
        const clickX = e.offsetX;
        const percentage = clickX / width;
        elements.player[0].currentTime = percentage * elements.player[0].duration;
    }

    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        seconds = Math.floor(seconds % 60);
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    }

    // History and Caching
    function updateHistory(song) {
        let history = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY) || '[]');
        history = history.filter(s => s.id !== song.id);
        history.unshift(song);
        if (history.length > 50) history.pop();
        localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
        if ($('#home-tab').is(':visible')) loadHomeContent();
    }

    async function cacheSong(song) {
        try {
            const offlineSongs = JSON.parse(localStorage.getItem(STORAGE_KEYS.OFFLINE) || '[]');
            if (!offlineSongs.some(s => s.id === song.id)) {
                offlineSongs.push(song);
                localStorage.setItem(STORAGE_KEYS.OFFLINE, JSON.stringify(offlineSongs));
            }
        } catch (error) {
            console.error('Cache error:', error);
        }
    }

    // Like Functions
    function isLiked(songId) {
        const likes = JSON.parse(localStorage.getItem(STORAGE_KEYS.LIKES) || '[]');
        return likes.some(f => f.id === songId);
    }

    function toggleLike(songId, $btn) {
        const likes = JSON.parse(localStorage.getItem(STORAGE_KEYS.LIKES) || '[]');
        const song = state.songs.find(s => s.id === songId) || state.resultsObjects[songId]?.track;
        if (!song) return;

        const isLikedSong = likes.some(f => f.id === songId);
        if (isLikedSong) {
            const updatedLikes = likes.filter(f => f.id !== songId);
            localStorage.setItem(STORAGE_KEYS.LIKES, JSON.stringify(updatedLikes));
            $btn.find('span').text('Like');
            $btn.removeClass('text-red-500 liked').addClass('text-teal-500');
            elements.status.text('Unliked!');
        } else {
            const songData = {
                id: song.id,
                full_name: song.name || song.full_name,
                title: song.name || song.title,
                album: song.album?.name || song.album || 'Unknown Album',
                artist: song.primaryArtists || song.artist || 'Unknown Artist',
                duration: song.duration || state.songs.find(s => s.id === songId)?.duration || '3:00',
                image: song.image[1]?.link || song.image || 'img/58964258.png',
                url: song.downloadUrl?.[elements.bitrateSelect.val()]?.link || song.url || '',
                year: song.year || 'Unknown',
                language: song.language || 'english'
            };
            likes.push(songData);
            localStorage.setItem(STORAGE_KEYS.LIKES, JSON.stringify(likes));
            $btn.find('span').text('Unlike');
            $btn.removeClass('text-teal-500').addClass('text-red-500 liked');
            elements.status.text('Liked!');
        }
        setTimeout(() => elements.status.text(''), 2000);
        if ($('#likes-tab').is(':visible')) renderLikes();
        updateLikeButton();
    }

    function toggleLikeCurrentSong() {
        if (!state.currentSong) return;
        toggleLike(state.currentSong.id, elements.likeBtn);
    }

    function updateLikeButton() {
        if (!state.currentSong) return;
        const isLikedSong = isLiked(state.currentSong.id);
        elements.likeBtn.toggleClass('liked', isLikedSong)
                       .toggleClass('text-teal-500', !isLikedSong)
                       .toggleClass('text-red-500', isLikedSong);
        elements.likeBtn.find('span').text(isLikedSong ? 'Unlike' : 'Like');
    }

    // Playlist Functions
    function createPlaylist() {
        const name = prompt('Enter playlist name:');
        if (!name) return;
        const playlists = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYLISTS) || '{}');
        playlists[name] = playlists[name] || [];
        localStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(playlists));
        renderPlaylists();
        elements.status.text(`Playlist "${name}" created!`);
        setTimeout(() => elements.status.text(''), 2000);
    }

    function showPlaylistModal(song) {
        const playlists = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYLISTS) || '{}');
        elements.playlistOptions.empty();
        if (!Object.keys(playlists).length) {
            elements.playlistOptions.html('<p class="text-sm text-gray-500">No playlists available.</p>');
        } else {
            Object.keys(playlists).forEach(name => {
                const html = `
                    <li class="bg-gray-700 bg-opacity-50 rounded-lg p-2 cursor-pointer hover:bg-teal-500 text-sm add-to-playlist-btn" data-playlist="${name}" data-song='${JSON.stringify(song)}'>${name}</li>
                `;
                elements.playlistOptions.append(html);
            });
            elements.playlistOptions.find('.add-to-playlist-btn').on('click', function() {
                const playlist = $(this).data('playlist');
                const songData = JSON.parse($(this).data('song'));
                addToPlaylist(playlist, songData);
            });
        }
        elements.playlistModal.removeClass('hidden');
    }

    function showPlaylistModalCurrentSong() {
        if (!state.currentSong) return;
        showPlaylistModal(state.currentSong);
    }

    function closePlaylistModal() {
        elements.playlistModal.addClass('hidden');
    }

    function addToPlaylist(name, song) {
        const playlists = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYLISTS) || '{}');
        if (!playlists[name].some(s => s.id === song.id)) {
            playlists[name].push(song);
            localStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(playlists));
            elements.status.text(`Added ${song.full_name} to ${name}!`);
        } else {
            elements.status.text(`${song.full_name} is already in ${name}!`);
        }
        closePlaylistModal();
        setTimeout(() => elements.status.text(''), 2000);
        if ($('#playlists-tab').is(':visible')) renderPlaylists();
    }

    function deletePlaylist(name) {
        if (!confirm(`Delete ${name} playlist?`)) return;
        const playlists = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYLISTS) || '{}');
        delete playlists[name];
        localStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(playlists));
        renderPlaylists();
        elements.status.text(`Playlist ${name} deleted!`);
        setTimeout(() => elements.status.text(''), 2000);
    }

    function playPlaylistSong(playlistName, index) {
        const playlists = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYLISTS) || '{}');
        state.songs = playlists[playlistName] || [];
        playSong(index);
    }

    // Download Functions
    function addDownload(id) {
        console.log('Initiating download for song ID:', id);
        const song = state.resultsObjects[id]?.track || state.songs.find(s => s.id === id);
        if (!song) {
            elements.status.text('Song not found for download.');
            setTimeout(() => elements.status.text(''), 2000);
            return;
        }

        const downloadItem = $(`
            <li track_tag="${id}" class="no-bullets">
                <img class="track-img" src="${song.image[1]?.link || 'img/58964258.png'}" alt="Song Image">
                <div class="track-info">
                    <span class="track-name">${song.name || id}</span> - 
                    <span class="track-album">${song.album?.name || 'Unknown Album'}</span><br>
                    <span class="track-size">Size: Downloading...</span>
                    <span class="track-status">Starting...</span>
                </div>
            </li>
        `);
        elements.downloadList.append(downloadItem);

        elements.downloadLink.css({ backgroundColor: '#22c55e', borderColor: '#22c55e' }).removeClass('hidden');
        setTimeout(() => {
            elements.downloadLink.css({ backgroundColor: '#14b8a6', borderColor: '#14b8a6' });
        }, 1000);

        const bitrateIndex = elements.bitrateSelect.val();
        const downloadUrl = song.downloadUrl?.[bitrateIndex]?.link;
        if (!downloadUrl) {
            downloadItem.find('.track-status').text('Error: Download URL not found').css('color', '#ef4444');
            console.error('Download URL not found for song ID:', id);
            return;
        }

        fetch(downloadUrl)
            .then(response => {
                if (!response.ok) throw new Error(`Download fetch error: ${response.status}`);
                return response.blob();
            })
            .then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = $('<a>').css('display', 'none').attr({ href: url, download: `${song.name || id}.mp3` });
                $('body').append(a);
                a[0].click();
                window.URL.revokeObjectURL(url);
                a.remove();
                downloadItem.find('.track-status').text('Downloaded').css('color', '#22c55e');
                downloadItem.find('.track-size').text(`Size: ${(blob.size / (1024 * 1024)).toFixed(2)} MB`);
                console.log('Download completed for song ID:', id);
            })
            .catch(error => {
                downloadItem.find('.track-status').text(`Error: ${error.message}`).css('color', '#ef4444');
                console.error('Download error:', error);
            });
    }

    // Auto-Play Setup
    function setupAutoPlay() {
        elements.player.off('ended').on('ended', autoPlayHandler);
        console.log('Auto-play listener set up at', new Date().toLocaleTimeString());
    }

    function autoPlayHandler() {
        console.log('Auto-play triggered at', new Date().toLocaleTimeString());
        if (state.currentSongIndex === -1) {
            console.error('No current song index set');
            return;
        }
        playNextSong();
    }

    // Other Playback Functions
    function playLike(index) {
        state.songs = JSON.parse(localStorage.getItem(STORAGE_KEYS.LIKES) || '[]');
        playSong(index);
    }

    function playRecent(index) {
        state.songs = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY) || '[]');
        playSong(index);
    }

    function playOffline(index) {
        state.songs = JSON.parse(localStorage.getItem(STORAGE_KEYS.OFFLINE) || '[]');
        playSong(index);
    }

    // Tab Management
    function showTab(tab) {
        $('.tab-content').addClass('hidden');
        $(`#${tab}-tab`).removeClass('hidden');
        elements.tabButtons.removeClass('active bg-teal-500').addClass('bg-gray-800');
        $(`.tab-btn[data-tab="${tab}"]`).addClass('active bg-teal-500').removeClass('bg-gray-800');
        switch (tab) {
            case 'likes':
                renderLikes();
                break;
            case 'playlists':
                renderPlaylists();
                break;
            case 'offline':
                renderOffline();
                break;
            case 'home':
                loadHomeContent();
                break;
            case 'search':
                if (state.lastSearch) {
                    doViTuneSearch(state.lastSearch);
                }
                break;
        }
    }

    // Settings Management
    function applySettings() {
        const settings = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}');
        const isDark = settings.isDark !== false;
        const themeStyle = settings.themeStyle || 'dark';
        const isTransparent = settings.isTransparent !== false;
        $('body').removeClass('dark light blue green')
                .addClass(themeStyle)
                .toggleClass('transparent', isTransparent)
                .removeClass('font-poppins font-inter font-roboto font-montserrat')
                .addClass(`font-${settings.fontStyle || 'poppins'}`)
                .removeClass('font-small font-medium font-large')
                .addClass(`font-${settings.fontSize || 'medium'}`);
        $('#theme-toggle').prop('checked', isDark);
        $('#theme-style').val(themeStyle);
        $('#transparent-toggle').prop('checked', isTransparent);
        $('#mood-toggle').prop('checked', settings.moodOff || false);
        $('#font-size').val(settings.fontSize || 'medium');
        $('#font-style').val(settings.fontStyle || 'poppins');
        $('#progress-style').val(settings.progressStyle || 'simple');
        $('#progress-color').val(settings.progressColor || 'teal');
        elements.progressContainer.removeClass('simple dots wavy color-teal color-red color-purple color-blue')
                                 .addClass(settings.progressStyle || 'simple')
                                 .addClass(`color-${settings.progressColor || 'teal'}`);
        if (window.location.pathname.includes('settings.html')) {
            $('body').trigger('settingsApplied');
        }
    }

    window.saveSettings = function() {
        const settings = {
            isDark: $('#theme-toggle').is(':checked'),
            themeStyle: $('#theme-style').val(),
            isTransparent: $('#transparent-toggle').is(':checked'),
            moodOff: $('#mood-toggle').is(':checked'),
            fontSize: $('#font-size').val(),
            fontStyle: $('#font-style').val(),
            progressStyle: $('#progress-style').val(),
            progressColor: $('#progress-color').val()
        };
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
        applySettings();
        loadAISuggestions();
        elements.status.text('Settings saved!');
        setTimeout(() => elements.status.text(''), 2000);
    };

    // Audio Player Toggle
    function togglePlayer() {
        elements.audioPlayerContent.toggleClass('expanded');
        elements.audioPlayerContent.find('.expanded').toggleClass('hidden');
        elements.audioPlayerContent.find('.compact').toggleClass('hidden');
        if (elements.audioPlayerContent.hasClass('expanded')) {
            elements.playPauseBtnExpanded.html(elements.playPauseBtn.html());
        }
    }

    // Initialize
    init();
});