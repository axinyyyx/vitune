
$(document).ready(function() {
    // DOM Elements (unchanged)
    const elements = {
        searchBox: $('#ViTune-search-box'),
        clearSearch: $('#clear-search'),
        results: $('#ViTune-results'),
        status: $('#status'),
        player: $('#player'),
        audioSource: $('#audio-source'),
        playerName: $('#player-name'),
        playerNameD: $('#player-name-detailed'),
        playerAlbum: $('#player-album'),
        playerImage: $('#player-image'),
        playerImageD: $('#player-image-detailed'),
        audioPlayer: $('#audio-player'),
        playerMinimal: $('#player-minimal'),
        playerDetailed: $('#player-detailed'),
        playPauseBtn: $('#play-pause-btn'),
        prevBtn: $('#prev-btn'),
        nextBtn: $('#next-btn'),
        nextBtnMinimal: $('#next-btn-minimal'),
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
        homeContent: $('#home-content'),
        playlistModal: $('#playlist-modal'),
        playlistOptions: $('#playlist-options'),
        closePlaylistModal: $('#close-playlist-modal'),
        createPlaylistBtn: $('#create-playlist-btn'),
        createPlaylistBtnModal: $('#create-playlist-btn-modal'),
        tabButtons: $('.tab-btn'),
        loadMoreBtn: $('#loadmore'),
        mpopup: $('#mpopupBox'),
        mpLink: $('#mpopupLink'),
        downloadList: $('#download-list'),
        settingsLink: $('#settings-link')
    };

    // State (add originalHistory for recent context)
    let state = {
        currentSongId: null,
        lastSearch: '',
        pageIndex: 1,
        resultsObjects: {},
        playQueue: [],
        isLooping: false,
        isPlaying: false,
        isDetailedView: false,
        allowNavigation: false,
        currentPlaylistView: null,
        isTransitioning: false,
        originalHistory: [] // Store original history order for recent context
    };

    const STORAGE_KEYS = {
        HISTORY: 'listening_history',
        LIKES: 'likes',
        PLAYLISTS: 'playlists',
        OFFLINE: 'offlineSongs',
        SETTINGS: 'settings',
        PLAY_QUEUE: 'play_queue'
    };

    const SEARCH_URL = 'https://jiosaavn-api-privatecvc2.vercel.app/search/songs?query=';
    const API_TIMEOUT = 10000;
    const DEFAULT_PLAYLIST_IMAGE = 'img/58964258.png';

    // Debounce Function (unchanged)
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Initialize (unchanged)
    function init() {
        applySettings();
        cleanHistory();
        loadHomeContent();
        bindEventListeners();
        handleDirectURL();
        setupAutoPlay();
        loadPlayQueue();
        elements.mpopup.find('.close').off('click').on('click', () => elements.mpopup.addClass('hidden'));
        elements.mpLink.off('click').on('click', () => {
            console.log('Download popup toggled');
            elements.mpopup.toggleClass('hidden');
        });
        $(window).off('click').on('click', (e) => {
            if (e.target === elements.mpopup[0]) elements.mpopup.addClass('hidden');
        });
        disableRefreshAndZoom();
        disablePullToRefresh();
    }

    // Disable Pull-to-Refresh (unchanged)
    function disablePullToRefresh() {
        const scrollableContainers = '#ViTune-results, #home-content, #playlists-list, #likes-list, #offline-list, #settings-content';
        $(scrollableContainers).css({
            'overscroll-behavior-y': 'contain',
            'overflow-y': 'auto',
            'max-height': '100vh',
            'scrollbar-width': 'none',
            '-ms-overflow-style': 'none'
        });
        $(scrollableContainers).each(function() {
            this.style.setProperty('::-webkit-scrollbar', 'display: none', 'important');
        });
        $('body').css('overscroll-behavior-y', 'none');
        $('body').css('touch-action', 'auto');
        $(document).off('touchmove');
    }

    // Disable Refresh and Zoom (unchanged)
    function disableRefreshAndZoom() {
        $(document).on('keydown', (e) => {
            if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
                e.preventDefault();
                elements.status.text('Refresh disabled.');
            }
        });
        window.onbeforeunload = (e) => {
            if (state.allowNavigation || (e.target && e.target.activeElement && e.target.activeElement.href && e.target.activeElement.href.includes('settings.html'))) {
                return;
            }
            e.preventDefault();
            e.returnValue = 'Changes you made may not be saved.';
        };
        $(document).on('gesturestart wheel', (e) => {
            if (e.ctrlKey || e.metaKey) e.preventDefault();
        });
    }

    // Clean Invalid History Entries (unchanged)
    async function cleanHistory() {
        let history = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY) || '[]');
        const validHistory = [];
        for (const song of history) {
            try {
                const response = await fetch(song.url, { method: 'HEAD', mode: 'cors' });
                if (response.ok) {
                    validHistory.push(song);
                    state.resultsObjects[song.id] = { track: song };
                }
            } catch {
                // Skip invalid URLs
            }
        }
        localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(validHistory.slice(0, 50)));
        state.originalHistory = [...validHistory]; // Initialize originalHistory
    }

    // Apply Settings (unchanged)
    function applySettings() {
        const defaultSettings = {
            theme: 'dark',
            songCardTransparency: 'off',
            transparentEffect: 'off',
            fontStyle: 'poppins',
            fontSize: 'medium',
            progressBarColor: 'teal',
            progressBarStyle: 'simple',
            bitrate: '4',
            moodFilter: 'off',
            accentColor: 'teal',
            animationSpeed: 'normal'
        };
        const settings = { ...defaultSettings, ...JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}') };
        $('body').removeClass('dark light-mode font-poppins font-roboto font-open-sans font-lato font-montserrat font-arial font-times font-xsmall font-small font-medium font-large font-xlarge transparent-on transparent-off animation-fast animation-normal animation-slow');
        $('body').addClass(settings.theme);
        $('body').addClass(`font-${settings.fontStyle}`);
        $('body').addClass(`font-${settings.fontSize}`);
        $('body').addClass(`transparent-${settings.transparentEffect}`);
        $('body').addClass(`animation-${settings.animationSpeed}`);
        $('#audio-player, #mpopupBox .modal-content, #playlist-modal .bg-gray-800').css('background-color', settings.transparentEffect === 'on' ? 'rgba(31, 41, 55, 0.5)' : 'rgba(31, 41, 55, 1)');
        elements.progressBar.removeClass('progress-bar-teal progress-bar-red progress-bar-blue progress-bar-purple progress-bar-pink progress-bar-simple progress-bar-gradient progress-bar-wave');
        elements.progressBar.addClass(`progress-bar-${settings.progressBarColor}`);
        elements.progressBar.addClass(`progress-bar-${settings.progressBarStyle}`);
        $('.float-button, .tab-btn.active, #loadmore, #create-playlist-btn, #create-playlist-btn-modal, .control-btn, .three-dot-btn, .add-to-playlist-btn, .remove-from-playlist-btn, a:not(.delete-playlist-btn)').removeClass('accent-teal accent-purple accent-pink bg-teal-500 bg-purple-500 bg-pink-500 text-teal-500 text-purple-500 text-pink-500 hover:bg-teal-600 hover:bg-purple-600 hover:bg-pink-600 hover:text-teal-300 hover:text-purple-300 hover:text-pink-300');
        $('.float-button, .tab-btn.active, #loadmore, #create-playlist-btn, #create-playlist-btn-modal').addClass(`bg-${settings.accentColor}-500 hover:bg-${settings.accentColor}-600`);
        $('.control-btn, .three-dot-btn, .add-to-playlist-btn, .remove-from-playlist-btn, a:not(.delete-playlist-btn)').addClass(`text-${settings.accentColor}-500 hover:text-${settings.accentColor}-300 accent-${settings.accentColor}`);
        if (settings.songCardTransparency === 'on' && state.currentSongId) {
            $('.song-container, #ViTune-results').addClass('song-transparent');
        } else {
            $('.song-container, #ViTune-results').removeClass('song-transparent');
        }
    }

    // Event Listeners (unchanged)
    function bindEventListeners() {
        const debouncedSearch = debounce((query) => {
            if (query.length >= 2) {
                console.log('Search triggered:', query);
                doViTuneSearch(query.trim());
            }
        }, 300);

        elements.searchBox.off('input').on('input', function() {
            const query = $(this).val().trim();
            elements.clearSearch.toggleClass('hidden', !query);
            debouncedSearch(query);
        });

        elements.clearSearch.off('click').on('click', () => {
            console.log('Clear search clicked');
            clearSearch();
        });

        elements.loadMoreBtn.off('click').on('click', () => {
            console.log('Load more clicked');
            nextPage();
        });

        elements.tabButtons.off('click').on('click', function() {
            const tab = $(this).data('tab');
            console.log('Tab clicked:', tab);
            state.currentPlaylistView = null;
            showTab(tab);
        });

        elements.playPauseBtn.off('click').on('click', (e) => {
            e.stopPropagation();
            console.log('Play/pause clicked');
            togglePlayPause();
        });

        const debouncedNext = debounce(() => {
            console.log('Next clicked (debounced)');
            playNextSong();
        }, 300);

        elements.nextBtnMinimal.off('click').on('click', (e) => {
            e.stopPropagation();
            debouncedNext();
        });

        elements.nextBtn.off('click').on('click', (e) => {
            e.stopPropagation();
            debouncedNext();
        });

        elements.playerMinimal.off('click').on('click', (e) => {
            if (!$(e.target).closest('.control-btn').length) {
                console.log('Minimal player clicked, current state:', state.isDetailedView);
                togglePlayerView();
            }
        });

        elements.playerDetailed.off('click').on('click', (e) => {
            if (!$(e.target).closest('.control-btn, #progress-container').length) {
                console.log('Detailed player clicked, current state:', state.isDetailedView);
                togglePlayerView();
            }
        });

        elements.prevBtn.off('click').on('click', (e) => {
            e.stopPropagation();
            console.log('Previous clicked');
            playPreviousSong();
        });

        elements.loopBtn.off('click').on('click', (e) => {
            e.stopPropagation();
            console.log('Loop clicked');
            toggleLoop();
        });

        elements.likeBtn.off('click').on('click', (e) => {
            e.stopPropagation();
            console.log('Like clicked');
            toggleLikeCurrentSong();
        });

        elements.playlistBtn.off('click').on('click', (e) => {
            e.stopPropagation();
            console.log('Playlist button clicked');
            showPlaylistModalCurrentSong();
        });

        elements.closePlaylistModal.off('click').on('click', () => {
            console.log('Close playlist modal clicked');
            closePlaylistModal();
        });

        elements.createPlaylistBtn.off('click').on('click', () => {
            console.log('Create playlist clicked');
            createPlaylist();
        });

        elements.createPlaylistBtnModal.off('click').on('click', () => {
            console.log('Create playlist modal clicked');
            createPlaylist();
        });

        elements.progressContainer.off('click').on('click', (e) => {
            console.log('Progress bar clicked');
            seekSong(e);
        });

        elements.player.off('timeupdate error').on({
            timeupdate: updateProgress,
            error: () => {
                console.error('Playback error:', elements.audioSource.attr('src'));
                elements.status.text('Error: Song unavailable. Skipping...');
                state.isTransitioning = false;
                playNextSong();
            }
        });

        elements.settingsLink.off('click').on('click', (e) => {
            console.log('Settings link clicked');
            state.allowNavigation = true;
            setTimeout(() => {
                state.allowNavigation = false;
            }, 100);
        });

        $(document).off('ViTune:search').on('ViTune:search', (e, query) => {
            console.log('Custom search event:', query);
            doViTuneSearch(query);
        });

        window.removeEventListener('hashchange', handleHashChange);
        window.addEventListener('hashchange', handleHashChange);

        function handleHashChange() {
            const query = decodeURIComponent(window.location.hash.substring(1)).replace(/\+/g, ' ');
            if (query) {
                console.log('Hash changed:', query);
                elements.searchBox.val(query);
                doViTuneSearch(query);
            }
        }

        $(window).off('settings:updated storage').on('settings:updated storage', (e) => {
            if (e.type === 'storage' && e.key !== STORAGE_KEYS.SETTINGS) return;
            console.log('Settings updated');
            applySettings();
        });
    }

    // Toggle Player View (unchanged)
    function togglePlayerView() {
        state.isDetailedView = !state.isDetailedView;
        console.log('Toggling player view, new state:', state.isDetailedView);
        if (state.isDetailedView) {
            elements.playerMinimal.addClass('hidden');
            elements.playerDetailed.removeClass('hidden');
            console.log('Showing detailed view, hiding minimal view');
        } else {
            elements.playerMinimal.removeClass('hidden');
            elements.playerDetailed.addClass('hidden');
            console.log('Showing minimal view, hiding detailed view');
        }
    }

    // Toggle Loop (unchanged)
    function toggleLoop() {
        state.isLooping = !state.isLooping;
        elements.player[0].loop = state.isLooping;
        elements.loopBtn.toggleClass('text-teal-300', state.isLooping);
        elements.loopBtn.toggleClass('active', state.isLooping);
        console.log('Loop state:', state.isLooping, 'Audio loop attribute:', elements.player[0].loop);

        $('.loop-state-label').remove();
        const labelText = state.isLooping ? 'ON' : 'OFF';
        const label = $(`<span class="loop-state-label">${labelText}</span>`);
        elements.loopBtn.parent().css('position', 'relative').append(label);
        setTimeout(() => {
            label.fadeOut(500, () => label.remove());
        }, 2000);
    }

    // Search Functions (unchanged)
    function clearSearch() {
        elements.searchBox.val('');
        elements.clearSearch.addClass('hidden');
        elements.results.empty();
        elements.status.text('');
        elements.loadMoreBtn.addClass('hidden');
        state.lastSearch = '';
        state.pageIndex = 1;
        state.resultsObjects = {};
        showTab('home');
        window.location.hash = '';
    }

    function handleDirectURL() {
        const hash = decodeURIComponent(window.location.hash.substring(1)).replace(/\+/g, ' ');
        if (hash) {
            const query = hash;
            elements.searchBox.val(query);
            doViTuneSearch(query, true);
            showTab('search');
        } else {
            doViTuneSearch('Honey Singh', true);
        }
    }

    async function doViTuneSearch(query, noScroll = false) {
        if (!query) return;
        showTab('search');
        query = query.trim().replace(/\s+/g, ' ');
        const encodedQuery = encodeURIComponent(query);
        window.location.hash = query;
        elements.searchBox.val(query);
        elements.status.text('Searching...');
        elements.results.html('<span class="loader"></span>');

        let searchQuery = `${encodedQuery}&limit=40`;
        if (state.pageIndex > 1) {
            searchQuery += `&page=${state.pageIndex}`;
        } else {
            state.resultsObjects = {};
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

        try {
            const response = await fetch(SEARCH_URL + searchQuery, { signal: controller.signal });
            clearTimeout(timeoutId);
            const json = await response.json();
            if (!response.ok) {
                throw new Error(json.message || 'Unknown API error');
            }

            const results = json.data.results;
            if (!results || !results.length) {
                elements.results.html('<p class="text-center text-sm text-gray-400">No results found. Try another query.</p>');
                elements.status.text('');
                elements.loadMoreBtn.addClass('hidden');
                return;
            }

            state.lastSearch = query;
            const settings = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}');
            const bitrateIndex = settings.bitrate || '4';
            const songs = results
                .filter(track => track.downloadUrl && track.downloadUrl[bitrateIndex]?.link)
                .map(track => {
                    let song_name = textAbstract(track.name, 25);
                    let album_name = textAbstract(track.album?.name, 20);
                    if (album_name === song_name) album_name = '';
                    const measuredTime = new Date(null);
                    measuredTime.setSeconds(parseInt(track.duration));
                    let play_time = measuredTime.toISOString().substr(11, 8);
                    if (play_time.startsWith('00:0')) play_time = play_time.slice(4);
                    else if (play_time.startsWith('00:')) play_time = play_time.slice(3);

                    const song = {
                        id: track.id,
                        name: song_name,
                        album: album_name,
                        artist: textAbstract(track.primaryArtists, 30),
                        duration: play_time,
                        image: track.image?.[1]?.link || 'https://i.pinimg.com/originals/ed/54/d2/ed54d2fa700d36d4f2671e1be84651df.jpg',
                        url: track.downloadUrl[bitrateIndex].link,
                        year: track.year,
                        quality: bitrateIndex === '4' ? 320 : bitrateIndex === '3' ? 160 : bitrateIndex === '2' ? 96 : 48
                    };
                    state.resultsObjects[song.id] = { track: song };
                    return song;
                });

            elements.results.empty();
            if (songs.length) {
                elements.results.html(songs.map(song => generateSongCard(song)).join(''));
                elements.loadMoreBtn.toggleClass('hidden', songs.length < 40);
                if (!noScroll) {
                    elements.results[0].scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            } else {
                elements.results.html('<p class="text-center text-sm text-gray-400">No results found. Try another query.</p>');
                elements.loadMoreBtn.addClass('hidden');
            }
            elements.status.text('');
            bindCardEventListeners();
        } catch (error) {
            clearTimeout(timeoutId);
            elements.status.text(`Error: ${error.name === 'AbortError' ? 'Request timed out' : error.message}`);
            elements.results.html('<p class="text-center text-sm text-gray-400">Unable to fetch songs.</p>');
            elements.loadMoreBtn.addClass('hidden');
            console.error('Search error:', error);
        }
    }

    function nextPage() {
        if (!state.lastSearch) return;
        state.pageIndex++;
        doViTuneSearch(state.lastSearch, true);
    }

    // Playback Functions
    async function playAudio(audioUrl, songId) {
        console.log('playAudio called:', { songId, audioUrl });
        state.isTransitioning = false; // Force reset to prevent lock
        state.isTransitioning = true;

        const song = state.resultsObjects[songId]?.track;
        if (!song) {
            console.error('Song not found:', songId);
            elements.status.text('Error: Song not found.');
            state.isTransitioning = false;
            return;
        }

        // Validate URL
        try {
            const response = await fetch(audioUrl, { method: 'HEAD', mode: 'cors' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
        } catch (error) {
            console.error('Song unavailable:', { audioUrl, error });
            elements.status.text('Error: Song unavailable. Skipping...');
            state.isTransitioning = false;
            playNextSong();
            return;
        }

        // Reset audio element
        try {
            elements.player[0].pause();
            elements.player[0].currentTime = 0;
            elements.audioSource.removeAttr('src');
            elements.player[0].load();
            console.log('Audio element reset');
        } catch (error) {
            console.error('Audio reset error:', error);
        }

        // Update state and UI
        state.currentSongId = songId;
        state.isPlaying = false;
        elements.audioSource.attr('src', audioUrl);
        elements.playerName.text(song.name);
        elements.playerNameD.text(song.name);
        elements.playerAlbum.text(song.album || 'Unknown Album');
        elements.playerImage.attr('src', song.image);
        elements.playerImageD.attr('src', song.image);
        elements.audioPlayer.removeClass('hidden');
        document.title = `${song.name} - ${song.album || 'Unknown Album'}`;

        // Apply song card transparency
        const settings = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}');
        if (settings.songCardTransparency === 'on') {
            $('.song-container, #ViTune-results').addClass('song-transparent');
        }

        // Update history
        let history = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY) || '[]');
        const existingIndex = history.findIndex(s => s.id === song.id);
        if (existingIndex !== -1) {
            history.splice(existingIndex, 1);
        }
        history.unshift(song);
        history = history.slice(0, 50);
        localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
        state.resultsObjects[song.id] = { track: song };
        state.originalHistory = [...history]; // Update originalHistory

        // Play audio
        try {
            await elements.player[0].load();
            await elements.player[0].play();
            state.isPlaying = true;
            elements.playPauseBtn.find('i').removeClass('fa-play').addClass('fa-pause');
            console.log('Playing song:', song.name);
        } catch (error) {
            console.error('Audio play error:', error);
            elements.status.text('Error playing song. Skipping...');
            playNextSong();
        } finally {
            state.isTransitioning = false;
            console.log('playAudio completed, isTransitioning:', state.isTransitioning);
        }

        updateLikeButton();
        savePlayQueue();
        if ($('#home-tab').is(':visible')) {
            loadHomeContent();
        }
    }

    function togglePlayPause() {
        if (state.isPlaying) {
            elements.player[0].pause();
            elements.playPauseBtn.find('i').removeClass('fa-pause').addClass('fa-play');
            state.isPlaying = false;
        } else {
            elements.player[0].play().then(() => {
                elements.playPauseBtn.find('i').removeClass('fa-play').addClass('fa-pause');
                state.isPlaying = true;
            }).catch(() => {
                elements.status.text('Error: Unable to play.');
            });
        }
        console.log('Play state:', state.isPlaying);
    }

    function getCurrentContext() {
        let context = { type: 'unknown', songs: [], container: '' };
        if ($('#search-tab').is(':visible')) {
            context = {
                type: 'search',
                songs: Object.values(state.resultsObjects).map(obj => obj.track).filter(song => song),
                container: '#ViTune-results'
            };
        } else if ($('#likes-tab').is(':visible')) {
            const likes = JSON.parse(localStorage.getItem(STORAGE_KEYS.LIKES) || '[]');
            likes.forEach(song => {
                state.resultsObjects[song.id] = { track: song };
            });
            context = {
                type: 'likes',
                songs: likes,
                container: '#likes-list'
            };
        } else if ($('#playlists-tab').is(':visible') && state.currentPlaylistView) {
            const playlists = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYLISTS) || '{}');
            const playlistSongs = playlists[state.currentPlaylistView] || [];
            playlistSongs.forEach(song => {
                state.resultsObjects[song.id] = { track: song };
            });
            context = {
                type: 'playlist',
                songs: playlistSongs,
                container: '#playlists-list'
            };
        } else if ($('#home-tab').is(':visible') && state.currentPlaylistView) {
            const playlists = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYLISTS) || '{}');
            const playlistSongs = playlists[state.currentPlaylistView] || [];
            playlistSongs.forEach(song => {
                state.resultsObjects[song.id] = { track: song };
            });
            context = {
                type: 'playlist',
                songs: playlistSongs,
                container: '#home-content'
            };
        } else if ($('#home-tab').is(':visible')) {
            const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY) || '[]');
            history.forEach(song => {
                state.resultsObjects[song.id] = { track: song };
            });
            context = {
                type: 'recent',
                songs: [...state.originalHistory], // Use original history order
                container: '#home-content .recent-played'
            };
        } else if ($('#offline-tab').is(':visible')) {
            const offline = JSON.parse(localStorage.getItem(STORAGE_KEYS.OFFLINE) || '[]');
            offline.forEach(song => {
                state.resultsObjects[song.id] = { track: song };
            });
            context = {
                type: 'offline',
                songs: offline,
                container: '#offline-list'
            };
        }
        console.log('getCurrentContext:', { type: context.type, songCount: context.songs.length });
        return context;
    }

    function playNextSong() {
        console.log('playNextSong called:', { isTransitioning: state.isTransitioning, currentSongId: state.currentSongId });
        state.isTransitioning = false; // Force reset
        state.isTransitioning = true;

        // Check play queue
        if (state.playQueue.length > 0) {
            const nextSong = state.playQueue.shift();
            console.log('Playing from queue:', nextSong.name);
            state.resultsObjects[nextSong.id] = { track: nextSong };
            playAudio(nextSong.url, nextSong.id);
            savePlayQueue();
            return;
        }

        // Get context
        const context = getCurrentContext();
        if (context.songs.length === 0) {
            console.log('No songs in context:', context.type);
            elements.status.text('No more songs to play.');
            state.isPlaying = false;
            elements.playPauseBtn.find('i').removeClass('fa-pause').addClass('fa-play');
            state.isTransitioning = false;
            return;
        }

        // Find current song index
        let currentIndex = context.songs.findIndex(song => song.id === state.currentSongId);
        console.log('Current index:', currentIndex);

        // If not found, start from first
        if (currentIndex === -1) {
            currentIndex = -1;
            console.log('Current song not found, starting from first');
        }

        // Find next song
        let nextSong = null;
        if (currentIndex + 1 < context.songs.length) {
            nextSong = context.songs[currentIndex + 1];
            console.log('Next song:', nextSong.name);
        } else if (state.isLooping && context.songs.length > 0) {
            nextSong = context.songs[0];
            console.log('Looping to first song:', nextSong.name);
        }

        if (nextSong) {
            state.resultsObjects[nextSong.id] = { track: nextSong };
            playAudio(nextSong.url, nextSong.id);
        } else {
            console.log('No next song, stopping');
            elements.status.text('End of playlist.');
            state.isPlaying = false;
            elements.playPauseBtn.find('i').removeClass('fa-pause').addClass('fa-play');
            state.isTransitioning = false;
        }
    }

    function playPreviousSong() {
        console.log('playPreviousSong called');
        state.isTransitioning = false;
        state.isTransitioning = true;

        const context = getCurrentContext();
        if (context.songs.length === 0) {
            console.log('No songs in context:', context.type);
            elements.status.text('No previous songs.');
            state.isTransitioning = false;
            return;
        }

        const currentIndex = context.songs.findIndex(song => song.id === state.currentSongId);
        if (currentIndex <= 0) {
            console.log('No previous song');
            elements.status.text('No previous song.');
            state.isTransitioning = false;
            return;
        }

        const prevSong = context.songs[currentIndex - 1];
        console.log('Playing previous song:', prevSong.name);
        state.resultsObjects[prevSong.id] = { track: prevSong };
        playAudio(prevSong.url, prevSong.id);
    }

    function updateProgress() {
        const player = elements.player[0];
        if (!player.duration) return;
        const progress = (player.currentTime / player.duration) * 100;
        elements.progressBar.css('width', `${progress}%`);
        elements.currentTime.text(formatDuration(player.currentTime));
        elements.duration.text(formatDuration(player.duration));
    }

    function seekSong(e) {
        const player = elements.player[0];
        const offset = e.offsetX / elements.progressContainer.width();
        player.currentTime = offset * player.duration;
        console.log('Seek to:', player.currentTime);
    }

    // Queue Functions (unchanged)
    function addToPlayNext(song) {
        const songData = state.resultsObjects[song.id]?.track || song;
        if (songData) {
            state.playQueue.unshift(songData);
            savePlayQueue();
            elements.status.text('Added to Play Next');
            console.log('Added to play next:', songData.name);
        }
    }

    function savePlayQueue() {
        localStorage.setItem(STORAGE_KEYS.PLAY_QUEUE, JSON.stringify(state.playQueue));
    }

    function loadPlayQueue() {
        state.playQueue = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAY_QUEUE) || '[]');
    }

    // Like Functions (unchanged)
    function toggleLikeCurrentSong() {
        if (!state.currentSongId) {
            elements.status.text('No song selected.');
            return;
        }
        const song = state.resultsObjects[state.currentSongId]?.track;
        if (!song) return;

        const likes = JSON.parse(localStorage.getItem(STORAGE_KEYS.LIKES) || '[]');
        const index = likes.findIndex(s => s.id === song.id);
        if (index === -1) {
            likes.push(song);
            elements.status.text('Song liked');
        } else {
            likes.splice(index, 1);
            elements.status.text('Song unliked');
        }
        localStorage.setItem(STORAGE_KEYS.LIKES, JSON.stringify(likes));
        updateLikeButton();
        if ($('#likes-tab').is(':visible')) {
            renderLikes();
        }
        console.log('Like toggled for:', song.name);
    }

    function updateLikeButton() {
        const likes = JSON.parse(localStorage.getItem(STORAGE_KEYS.LIKES) || '[]');
        const isLiked = likes.some(s => s.id === state.currentSongId);
        elements.likeBtn.find('i').toggleClass('fa-heart-o', !isLiked).toggleClass('fa-heart', isLiked);
    }

    function isLiked(songId) {
        const likes = JSON.parse(localStorage.getItem(STORAGE_KEYS.LIKES) || '[]');
        return likes.some(s => s.id === songId);
    }

    // Playlist Functions (unchanged)
    function showPlaylistModalCurrentSong() {
        if (!state.currentSongId) {
            elements.status.text('No song selected.');
            return;
        }
        const song = state.resultsObjects[state.currentSongId]?.track;
        if (!song) return;
        showPlaylistModal(song);
        console.log('Showing playlist modal for:', song.name);
    }

    function showPlaylistModal(song) {
        const playlists = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYLISTS) || '{}');
        elements.playlistOptions.empty();
        Object.keys(playlists).forEach(name => {
            const isInPlaylist = playlists[name].some(s => s.id === song.id);
            elements.playlistOptions.append(`
                <li>
                    <button class="${isInPlaylist ? 'remove-from-playlist-btn' : 'add-to-playlist-btn'} w-full text-left px-2 py-1 text-sm text-white hover:bg-teal-500 rounded transition duration-200" data-name="${name}" data-song-id="${song.id}" data-song='${JSON.stringify(song).replace(/'/g, "\\'")}'>${isInPlaylist ? '<i class="fa fa-minus mr-1"></i>Remove from' : '<i class="fa fa-plus mr-1"></i>Add to'} ${name}</button>
                </li>
            `);
        });
        elements.playlistModal.removeClass('hidden');
        $('.add-to-playlist-btn').off('click').on('click', function() {
            const playlistName = $(this).data('name');
            const songData = JSON.parse($(this).attr('data-song'));
            addToPlaylist(playlistName, songData);
            closePlaylistModal();
            console.log('Added to playlist:', playlistName);
        });
        $('.remove-from-playlist-btn').off('click').on('click', function() {
            const playlistName = $(this).data('name');
            const songId = $(this).data('song-id');
            removeFromPlaylist(playlistName, songId);
            closePlaylistModal();
            console.log('Removed from playlist:', playlistName);
        });
    }

    function closePlaylistModal() {
        elements.playlistModal.addClass('hidden');
        console.log('Playlist modal closed');
    }

    function createPlaylist() {
        const name = prompt('Enter playlist name:');
        if (!name || name.trim() === '') return;
        const playlists = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYLISTS) || '{}');
        if (playlists[name]) {
            alert('Playlist already exists!');
            return;
        }
        playlists[name] = [];
        localStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(playlists));
        renderPlaylists();
        loadHomeContent();
        elements.status.text(`Playlist "${name}" created`);
        console.log('Playlist created:', name);
    }

    function addToPlaylist(playlistName, song) {
        const playlists = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYLISTS) || '{}');
        if (!playlists[playlistName]) playlists[playlistName] = [];
        if (!playlists[playlistName].some(s => s.id === song.id)) {
            playlists[playlistName].unshift(song);
            localStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(playlists));
            elements.status.text(`Added to "${playlistName}"`);
            if ($('#playlists-tab').is(':visible')) {
                renderPlaylists();
            }
            if ($('#home-tab').is(':visible')) {
                loadHomeContent();
            }
            console.log('Song added to playlist:', song.name, playlistName);
        }
    }

    function removeFromPlaylist(playlistName, songId) {
        const playlists = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYLISTS) || '{}');
        if (playlists[playlistName]) {
            playlists[playlistName] = playlists[playlistName].filter(s => s.id !== songId);
            localStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(playlists));
            elements.status.text(`Removed from "${playlistName}"`);
            if ($('#playlists-tab').is(':visible' && state.currentPlaylistView === playlistName)) {
                renderPlaylistSongs(playlistName);
            } else if ($('#playlists-tab').is(':visible')) {
                renderPlaylists();
            }
            if ($('#home-tab').is(':visible')) {
                loadHomeContent();
            }
            console.log('Song removed from playlist:', songId, playlistName);
        }
    }

    // Download Functions (unchanged)
    function addDownload(songId) {
        const song = state.resultsObjects[songId]?.track;
        if (!song) {
            console.error('Song not found for download:', songId);
            elements.status.text('Error: Song not found.');
            return;
        }

        const downloadItem = $(`
            <li class="no-bullets" track_tag="${songId}">
                <div class="flex items-center space-x-2">
                    <img class="track-img" src="${song.image}" width="50px" height="50px">
                    <div>
                        <span class="track-name">${song.name}</span> - 
                        <span class="track-album">${song.album || 'Unknown Album'}</span><br>
                        <span class="track-size">Size: Downloading...</span>
                        <span class="track-status text-green-500">Starting...</span>
                    </div>
                </div>
                <hr class="my-2">
            </li>
        `);

        elements.downloadList.append(downloadItem);
        elements.mpLink.css({ backgroundColor: 'green', borderColor: 'green' });
        setTimeout(() => {
            elements.mpLink.css({ backgroundColor: '#1f2937', borderColor: 'transparent' });
        }, 2000);

        fetch(song.url)
            .then(response => {
                if (!response.ok) throw new Error(`Download fetch error: ${response.status}`);
                return response.blob();
            })
            .then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = $('<a>').css('display', 'none').attr({ href: url, download: `${song.name}.mp3` });
                $('body').append(a);
                a[0].click();
                window.URL.revokeObjectURL(url);
                a.remove();
                downloadItem.find('.track-status').text('Downloaded');
                downloadItem.find('.track-size').text(`Size: ${(blob.size / (1024 * 1024)).toFixed(2)} MB`);
                const offlineSongs = JSON.parse(localStorage.getItem(STORAGE_KEYS.OFFLINE) || '[]');
                offlineSongs.unshift(song);
                localStorage.setItem(STORAGE_KEYS.OFFLINE, JSON.stringify(offlineSongs.slice(0, 100)));
                console.log('Downloaded:', song.name);
            })
            .catch(error => {
                downloadItem.find('.track-status').text(`Error: ${error.message}`);
                elements.status.text('Download failed.');
                console.error('Download error:', error);
            });
    }

    // Render Functions (unchanged)
    function generateSongCard(song) {
        return `
            <div class="song-container bg-gray-800 rounded-lg p-4 relative shadow-md hover:shadow-lg transition-all duration-200 play-btn" data-song-id="${song.id}">
                <img src="${song.image}" alt="Song Image" class="w-full h-40 object-cover rounded-lg mb-4 play-btn" data-song-id="${song.id}">
                <h3 class="text-sm font-semibold mb-1 truncate play-btn" data-song-id="${song.id}">${song.name}</h3>
                <p class="text-xs text-gray-400 truncate mb-1 play-btn" data-song-id="${song.id}">${song.album || '-'}</p>
                <p class="text-xs text-gray-400 truncate play-btn" data-song-id="${song.id}">${song.artist}</p>
                <p class="text-xs text-gray-500 play-btn" data-song-id="${song.id}">${song.duration} | ${song.year || '-'}</p>
                <div class="three-dot-menu absolute top-2 right-2 z-20">
                    <button class="three-dot-btn text-white hover:bg-gray-600 rounded-full p-1 transition duration-150"><i class="fa fa-ellipsis-v"></i></button>
                    <div class="three-dot-dropdown hidden absolute right-0 mt-2 bg-gray-600 rounded-lg shadow-lg p-2 w-36 z-30">
                        <button class="like-btn block w-full text-left px-2 py-1 text-sm text-white hover:bg-teal-500 rounded transition duration-200" data-id="${song.id}"><i class="fa fa-heart mr-1"></i>${isLiked(song.id) ? 'Unlike' : 'Like'}</button>
                        <button class="playlist-btn block w-full text-left px-2 py-1 text-sm text-white hover:bg-teal-500 rounded transition duration-200" data-song='${JSON.stringify(song).replace(/'/g, "\\'")}'><i class="fa fa-plus mr-1"></i>Add to Playlist</button>
                        <button class="play-next-btn block w-full text-left px-2 py-1 text-sm text-white hover:bg-teal-500 rounded transition duration-200" data-song='${JSON.stringify(song).replace(/'/g, "\\'")}'><i class="fa fa-step-forward mr-1"></i>Play Next</button>
                        <button class="download-btn block w-full text-left px-2 py-1 text-sm text-white hover:bg-teal-500 rounded transition duration-200" data-id="${song.id}"><i class="fa fa-download mr-1"></i>Download</button>
                    </div>
                </div>
            </div>
        `;
    }

    function generatePlaylistCard(name, songs) {
        const image = songs.length ? songs[0].image : DEFAULT_PLAYLIST_IMAGE;
        return `
            <div class="song-container bg-gray-800 rounded-lg p-4 relative shadow-md hover:shadow-lg transition-all duration-200 playlist-card cursor-pointer" data-playlist-name="${name}">
                <img src="${image}" alt="${name} Playlist" class="w-full h-40 object-cover rounded-lg mb-4">
                <h3 class="text-sm font-semibold mb-1 truncate">${name}</h3>
                <p class="text-xs text-gray-400 truncate">${songs.length} song${songs.length !== 1 ? 's' : ''}</p>
            </div>
        `;
    }

    async function loadHomeContent() {
        const likes = JSON.parse(localStorage.getItem(STORAGE_KEYS.LIKES) || '[]');
        const offlineSongs = JSON.parse(localStorage.getItem(STORAGE_KEYS.OFFLINE) || '[]');
        const playlists = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYLISTS) || '{}');
        let history = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY) || '[]');

        // Validate history URLs
        const validHistory = [];
        for (const song of history) {
            try {
                const response = await fetch(song.url, { method: 'HEAD', mode: 'cors' });
                if (response.ok) {
                    validHistory.push(song);
                    state.resultsObjects[song.id] = { track: song };
                }
            } catch {
                // Skip invalid URLs
            }
        }
        history = validHistory.slice(0, 8);
        state.originalHistory = [...validHistory]; // Update originalHistory

        elements.homeContent.html(`
            <h2 class="text-lg font-semibold mb-3 text-center sm:text-left">Recently Played</h2>
            <div class="recent-played grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                ${history.length ? history.map(generateSongCard).join('') : '<p class="text-center text-sm text-gray-400">No recent songs.</p>'}
            </div>
            <h2 class="text-lg font-semibold mb-3 text-center sm:text-left">Liked Songs</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                ${likes.length ? likes.slice(0, 8).map(generateSongCard).join('') : '<p class="text-center text-sm text-gray-400">No liked songs.</p>'}
            </div>
            <h2 class="text-lg font-semibold mb-3 text-center sm:text-left">Offline Songs</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                ${offlineSongs.length ? offlineSongs.slice(0, 8).map(generateSongCard).join('') : '<p class="text-center text-sm text-gray-400">No offline songs.</p>'}
            </div>
            <h2 class="text-lg font-semibold mb-3 text-center sm:text-left">Playlists</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                ${Object.keys(playlists).length ? Object.keys(playlists).map(name => generatePlaylistCard(name, playlists[name])).join('') : '<p class="text-center text-sm text-gray-400">No playlists.</p>'}
            </div>
        `);

        $('.playlist-card').off('click').on('click', function(e) {
            e.stopPropagation();
            const playlistName = $(this).data('playlist-name');
            console.log('Playlist card clicked:', playlistName);
            state.currentPlaylistView = playlistName;
            renderPlaylistSongs(playlistName, '#home-content');
        });

        bindCardEventListeners();
        console.log('Home content loaded');
    }

    function renderLikes() {
        const likes = JSON.parse(localStorage.getItem(STORAGE_KEYS.LIKES) || '[]');
        likes.forEach(song => {
            state.resultsObjects[song.id] = { track: song };
        });
        elements.likesList.html(`
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                ${likes.length ? likes.map(generateSongCard).join('') : '<p class="text-center text-sm text-gray-400">No liked songs.</p>'}
            </div>
        `);
        bindCardEventListeners();
        console.log('Likes rendered');
    }

    function renderPlaylists() {
        const playlists = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYLISTS) || '{}');
        if (state.currentPlaylistView) {
            renderPlaylistSongs(state.currentPlaylistView);
            return;
        }

        elements.playlistsList.empty();
        if (!Object.keys(playlists).length) {
            elements.playlistsList.html('<p class="text-center text-sm text-gray-400">No playlists.</p>');
            return;
        }

        elements.playlistsList.html(`
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                ${Object.keys(playlists).map(name => generatePlaylistCard(name, playlists[name])).join('')}
            </div>
        `);

        $('.playlist-card').off('click').on('click', function(e) {
            e.stopPropagation();
            const playlistName = $(this).data('playlist-name');
            console.log('Playlist card clicked:', playlistName);
            state.currentPlaylistView = playlistName;
            renderPlaylistSongs(playlistName);
        });

        bindCardEventListeners();
        console.log('Playlists rendered');
    }

    function renderPlaylistSongs(playlistName, containerId = '#playlists-list') {
        const playlists = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYLISTS) || '{}');
        const songs = playlists[playlistName] || [];
        songs.forEach(song => {
            state.resultsObjects[song.id] = { track: song };
        });
        $(containerId).html(`
            <div class="mb-4">
                <div class="flex justify-between mb-2">
                    <h3 class="text-base font-semibold truncate">${playlistName}</h3>
                    <button class="text-red-500 hover:text-red-400 text-sm delete-playlist-btn" data-name="${playlistName}"><i class="fa fa-trash"></i> Delete Playlist</button>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    ${songs.length ? songs.map(song => `
                        <div class="song-container bg-gray-800 rounded-lg p-4 relative shadow-md hover:shadow-lg transition-all duration-200">
                            <img src="${song.image}" alt="Song Image" class="w-full h-40 object-cover rounded-lg mb-4 play-btn" data-song-id="${song.id}">
                            <h3 class="text-sm font-semibold mb-1 truncate play-btn" data-song-id="${song.id}">${song.name}</h3>
                            <p class="text-xs text-gray-400 truncate mb-1 play-btn" data-song-id="${song.id}">${song.album || '-'}</p>
                            <p class="text-xs text-gray-400 truncate play-btn" data-song-id="${song.id}">${song.artist}</p>
                            <p class="text-xs text-gray-500 play-btn" data-song-id="${song.id}">${song.duration} | ${song.year || '-'}</p>
                            <button class="remove-from-playlist-btn absolute top-2 right-2 text-red-500 hover:text-red-400 text-sm" data-name="${playlistName}" data-song-id="${song.id}"><i class="fa fa-minus-circle"></i></button>
                        </div>
                    `).join('') : '<p class="text-center text-sm text-gray-400">No songs in this playlist.</p>'}
                </div>
            </div>
        `);

        $('.remove-from-playlist-btn').off('click').on('click', function(e) {
            e.stopPropagation();
            const playlistName = $(this).data('name');
            const songId = $(this).data('song-id');
            console.log('Remove from playlist clicked:', songId, playlistName);
            removeFromPlaylist(playlistName, songId);
        });

        $('.delete-playlist-btn').off('click').on('click', function(e) {
            e.stopPropagation();
            const playlistName = $(this).data('name');
            console.log('Delete playlist clicked:', playlistName);
            if (confirm(`Delete playlist "${playlistName}"?`)) {
                const playlists = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYLISTS) || '{}');
                delete playlists[playlistName];
                localStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(playlists));
                state.currentPlaylistView = null;
                if (containerId === '#playlists-list') {
                    renderPlaylists();
                } else {
                    loadHomeContent();
                }
                elements.status.text(`Playlist "${playlistName}" deleted`);
            }
        });

        bindCardEventListeners();
        console.log('Playlist songs rendered:', playlistName);
    }

    function renderOffline() {
        const offlineSongs = JSON.parse(localStorage.getItem(STORAGE_KEYS.OFFLINE) || '[]');
        offlineSongs.forEach(song => {
            state.resultsObjects[song.id] = { track: song };
        });
        elements.offlineList.html(`
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                ${offlineSongs.length ? offlineSongs.map(generateSongCard).join('') : '<p class="text-center text-sm text-gray-400">No songs.</p>'}
            </div>
        `);
        bindCardEventListeners();
        console.log('Offline songs rendered');
    }

    // Event Binding for Cards (unchanged)
    function bindCardEventListeners() {
        const debouncedPlay = debounce((songId) => {
            console.log('Play button clicked:', songId);
            const song = state.resultsObjects[songId]?.track;
            if (song) {
                playAudio(song.url, songId);
            } else {
                console.error('Song not found for play:', songId);
                elements.status.text('Error: Song not found.');
            }
        }, 200);

        $('.play-btn').off('click').on('click', function(e) {
            e.stopPropagation();
            const songId = $(this).data('song-id');
            debouncedPlay(songId);
        });

        $('.three-dot-btn').off('click').on('click', function(e) {
            e.stopPropagation();
            console.log('Three-dot menu clicked');
            const dropdown = $(this).siblings('.three-dot-dropdown');
            $('.three-dot-dropdown').not(dropdown).addClass('hidden');
            dropdown.toggleClass('hidden');
        });

        $('.like-btn').off('click').on('click', function(e) {
            e.stopPropagation();
            const songId = $(this).data('id');
            console.log('Like button clicked:', songId);
            const song = state.resultsObjects[songId]?.track;
            if (!song) {
                elements.status.text('Error: Song not found.');
                return;
            }
            const likes = JSON.parse(localStorage.getItem(STORAGE_KEYS.LIKES) || '[]');
            const index = likes.findIndex(s => s.id === songId);
            if (index === -1) {
                likes.push(song);
                elements.status.text('Song liked');
                $(this).html('<i class="fa fa-heart mr-1"></i>Unlike');
            } else {
                likes.splice(index, 1);
                elements.status.text('Song unliked');
                $(this).html('<i class="fa fa-heart mr-1"></i>Like');
            }
            localStorage.setItem(STORAGE_KEYS.LIKES, JSON.stringify(likes));
            if ($('#likes-tab').is(':visible')) {
                renderLikes();
            }
            if (songId === state.currentSongId) {
                updateLikeButton();
            }
        });

        $('.playlist-btn').off('click').on('click', function(e) {
            e.stopPropagation();
            const song = JSON.parse($(this).attr('data-song'));
            console.log('Playlist button clicked:', song.name);
            showPlaylistModal(song);
            $(this).parents('.three-dot-dropdown').addClass('hidden');
        });

        $('.play-next-btn').off('click').on('click', function(e) {
            e.stopPropagation();
            const song = JSON.parse($(this).attr('data-song'));
            console.log('Play next button clicked:', song.name);
            addToPlayNext(song);
            $(this).parents('.three-dot-dropdown').addClass('hidden');
        });

        $('.download-btn').off('click').on('click', function(e) {
            e.stopPropagation();
            const songId = $(this).data('id');
            console.log('Download button clicked:', songId);
            addDownload(songId);
            $(this).parents('.three-dot-dropdown').addClass('hidden');
        });

        $('.delete-playlist-btn').off('click').on('click', function(e) {
            e.stopPropagation();
            const playlistName = $(this).data('name');
            console.log('Delete playlist clicked:', playlistName);
            if (confirm(`Delete playlist "${playlistName}"?`)) {
                const playlists = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYLISTS) || '{}');
                delete playlists[playlistName];
                localStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(playlists));
                state.currentPlaylistView = null;
                renderPlaylists();
                loadHomeContent();
                elements.status.text(`Playlist "${playlistName}" deleted`);
            }
        });

        $(document).off('click').on('click', (e) => {
            if (!$(e.target).closest('.three-dot-menu').length) {
                $('.three-dot-dropdown').addClass('hidden');
            }
        });
    }

    // Utility Functions (unchanged)
    function textAbstract(text, length) {
        if (!text) return '';
        text = $('<div/>').html(text).text();
        if (text.length <= length) return text;
        return text.substring(0, length).trim() + '...';
    }

    function formatDuration(seconds) {
        const min = Math.floor(seconds / 60);
        const sec = Math.floor(seconds % 60);
        return `${min}:${sec < 10 ? '0' : ''}${sec}`;
    }

    function showTab(tabName) {
        $('.tab-content').addClass('hidden');
        $(`#${tabName}-tab`).removeClass('hidden');
        elements.tabButtons.removeClass('bg-teal-500 text-white').addClass('bg-gray-800 text-gray-400');
        $(`.tab-btn[data-tab="${tabName}"]`).removeClass('bg-gray-800 text-gray-400').addClass('bg-teal-500 text-white');
        if (tabName === 'likes') renderLikes();
        else if (tabName === 'playlists') {
            state.currentPlaylistView = null;
            renderPlaylists();
        } else if (tabName === 'offline') renderOffline();
        else if (tabName === 'home') loadHomeContent();
        console.log('Tab shown:', tabName);
    }

    function setupAutoPlay() {
        elements.player.off('ended').on('ended', () => {
            console.log('Song ended:', { isLooping: state.isLooping });
            if (!state.isLooping) {
                playNextSong();
            }
        });
    }

    // Start Application
    init();
});
