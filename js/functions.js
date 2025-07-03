$(document).ready(function() {
    // DOM Elements
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
        prevBtnMinimal: $('#prev-btn-minimal'),
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
        settingsLink: $('#settings-link'),
        tabContainer: $('#tab-container'),
        searchContainer: $('#search-container'),
        createPlaylistModal: $('#create-playlist-modal'),
        playlistNameInput: $('#playlist-name-input'),
        submitCreatePlaylist: $('#submit-create-playlist'),
        cancelCreatePlaylist: $('#cancel-create-playlist')
    };

    // State
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
        originalHistory: [],
        lastPlaybackTime: 0,
        userInteracted: false
    };

    const STORAGE_KEYS = {
        HISTORY: 'listening_history',
        LIKES: 'likes',
        PLAYLISTS: 'playlists',
        OFFLINE: 'offlineSongs',
        SETTINGS: 'settings',
        PLAY_QUEUE: 'play_queue',
        CURRENT_SONG: 'current_song',
        PLAYBACK_TIME: 'playback_time'
    };

    const SEARCH_URL = 'https://jiosaavn-api-privatecvc2.vercel.app/search/songs?query=';
    const API_TIMEOUT = 10000;
    const DEFAULT_PLAYLIST_IMAGE = 'img/58964258.png';
    const DEFAULT_SONG_IMAGE = 'https://via.placeholder.com/500';

    // Debounce Function
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

    // Initialize
    function init() {
        applySettings();
        cleanHistory();
        showTab('home');
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
        handleLoadMoreVisibility();
        addCreatePlaylistModal();
        ensureTabVisibility();
        ensureSearchBarVisibility();
        restorePlaybackState();
        setupVolumeListener();
        setupUserInteraction();
    }

    // Setup User Interaction Tracking
    function setupUserInteraction() {
        ['click', 'touchstart', 'keydown'].forEach(event => {
            document.addEventListener(event, () => {
                state.userInteracted = true;
                console.log('User interaction detected, enabling autoplay');
                if (!state.isPlaying && state.currentSongId) {
                    elements.player[0].play().catch(error => {
                        console.error('Post-interaction play error:', error);
                    });
                }
            }, { once: true });
        });
    }

    // Ensure Search Bar Visibility
    function ensureSearchBarVisibility() {
        elements.searchContainer.removeClass('hidden').css({
            display: 'block',
            position: 'sticky',
            top: '0',
            'z-index': '20',
            'background-color': '#1f2937'
        });
    }

    // Ensure Tab Visibility
    function ensureTabVisibility() {
        elements.tabContainer.removeClass('hidden').css({
            display: 'flex',
            position: 'sticky',
            top: '60px',
            'z-index': '10',
            'background-color': '#1f2937'
        });
    }

    // Add Playlist Creation Modal to DOM
    function addCreatePlaylistModal() {
        if (!elements.createPlaylistModal.length) {
            const modalHtml = `
                <div id="create-playlist-modal" class="fixed inset-0 bg-black bg-opacity-50 hidden flex items-center justify-center z-50">
                    <div class="bg-gray-800 rounded-lg p-6 w-full max-w-sm">
                        <div class="flex justify-between items-center mb-4">
                            <h2 class="text-lg font-semibold text-white">Create New Playlist</h2>
                        </div>
                        <input id="playlist-name-input" type="text" placeholder="Playlist Name" class="w-full bg-gray-700 text-white p-2 rounded mb-4 focus:outline-none focus:ring-2 focus:ring-teal-500">
                        <div class="flex justify-end space-x-2">
                            <button id="cancel-create-playlist" class="px-4 py-2 bg-teal-500 text-white rounded hover:bg-teal-600">Create</button>
                            <button id="submit-create-playlist" class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500">Close</button>
                        </div>
                    </div>
                </div>
            `;
            $('body').append(modalHtml);
            elements.createPlaylistModal = $('#create-playlist-modal');
            elements.playlistNameInput = $('#playlist-name-input');
            elements.submitCreatePlaylist = $('#submit-create-playlist');
            elements.cancelCreatePlaylist = $('#cancel-create-playlist');
            bindModalEventListeners();
        }
    }

    // Bind Modal Event Listeners
    function bindModalEventListeners() {
        elements.submitCreatePlaylist.off('click').on('click', () => {
            console.log('Close create playlist modal');
            elements.createPlaylistModal.addClass('hidden');
            elements.playlistNameInput.val('');
        });

        elements.cancelCreatePlaylist.off('click').on('click', () => {
            console.log('Create playlist');
            createPlaylist();
        });
    }

    // Restore Playback State
    function restorePlaybackState() {
        const savedSong = JSON.parse(localStorage.getItem(STORAGE_KEYS.CURRENT_SONG) || 'null');
        const savedTime = parseFloat(localStorage.getItem(STORAGE_KEYS.PLAYBACK_TIME) || '0');
        if (savedSong && savedSong.id) {
            state.currentSongId = savedSong.id;
            state.resultsObjects[savedSong.id] = { track: savedSong };
            state.lastPlaybackTime = savedTime;
            playAudio1(savedSong.url, savedSong.id, savedTime);
        }
    }

    // Save Playback State
    function savePlaybackState() {
        if (state.currentSongId && state.resultsObjects[state.currentSongId]) {
            localStorage.setItem(STORAGE_KEYS.CURRENT_SONG, JSON.stringify(state.resultsObjects[state.currentSongId].track));
            localStorage.setItem(STORAGE_KEYS.PLAYBACK_TIME, elements.player[0].currentTime.toString());
        }
    }

    // Setup Volume Listener
    function setupVolumeListener() {
        elements.player.on('volumechange', () => {
            const volume = elements.player[0].volume;
            console.log('Volume changed:', volume);
            if (volume === 0 && state.isPlaying) {
                elements.player[0].pause();
                state.isPlaying = false;
                updatePlayPauseButton();
                elements.status.text('Paused due to volume set to 0');
            }
        });
    }

    // Disable Pull-to-Refresh and Enable Scroll for Specific Containers
    function disablePullToRefresh() {
        const scrollableContainers = '#ViTune-results, #home-content, #playlists-list, #likes-list, #offline-list';
        $(scrollableContainers).css({
            'overscroll-behavior-y': 'contain',
            'overflow-y': 'auto',
            'max-height': 'calc(100vh - 220px)',
            'scrollbar-width': 'none',
            '-ms-overflow-style': 'none',
            'padding-bottom': '96px'
        });
        $(scrollableContainers).each(function() {
            this.style.setProperty('::-webkit-scrollbar', 'display: none', 'important');
        });
        $('body').css({
            'overscroll-behavior-y': 'none',
            overflow: 'hidden'
        });
        $('body').css('touch-action', 'auto');
        $(document).off('touchmove');
    }

    // Handle Load More Button Visibility
    function handleLoadMoreVisibility() {
        const container = elements.results[0];
        if (!container) return;
        $(container).off('scroll').on('scroll', () => {
            const scrollPosition = container.scrollTop + container.clientHeight;
            const threshold = container.scrollHeight - 50;
            if (scrollPosition >= threshold && state.lastSearch && Object.keys(state.resultsObjects).length >= 40) {
                elements.loadMoreBtn.removeClass('hidden');
            } else {
                elements.loadMoreBtn.addClass('hidden');
            }
            ensureSearchBarVisibility();
            ensureTabVisibility();
        });
    }

    // Disable Refresh and Zoom
    function disableRefreshAndZoom() {
        $(document).on('keydown', (e) => {
            if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
                e.preventDefault();
                elements.status.text('Refresh disabled.');
            }
        });
        window.onbeforeunload = (e) => {
            if (state.allowNavigation || (e.target.activeElement && e.target.activeElement.href && e.target.activeElement.href.includes('settings.html'))) {
                savePlaybackState();
                return;
            }
            e.preventDefault();
            savePlaybackState();
            e.returnValue = 'Changes you made may not be saved.';
        };
        $(document).on('gesturestart wheel', (e) => {
            if (e.ctrlKey || e.metaKey) e.preventDefault();
        });
    }

    // Clean Invalid History Entries
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
        state.originalHistory = [...validHistory];
    }

    // Apply Settings
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
            moodFilter: 'on',
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

    // Event Listeners
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
            ensureSearchBarVisibility();
            ensureTabVisibility();
        });

        elements.clearSearch.off('click').on('click', () => {
            console.log('Clear search clicked');
            clearSearch();
            showTab('search'); // Stay in search tab
        });

        elements.loadMoreBtn.off('click').on('click', () => {
            console.log('Load more clicked');
            nextPage();
            ensureSearchBarVisibility();
            ensureTabVisibility();
        });

        elements.tabButtons.off('click').on('click', function() {
            const tab = $(this).data('tab');
            console.log('Tab clicked:', tab);
            state.currentPlaylistView = null;
            showTab(tab);
            ensureSearchBarVisibility();
        });

        elements.playPauseBtn.off('click').on('click', (e) => {
            e.stopPropagation();
            console.log('Play/pause clicked');
            togglePlayPause();
        });

        const debouncedNext = debounce(() => {
            console.log('Next clicked (debounced)');
            playNextSong();
        }, 200);

        elements.nextBtnMinimal.off('click').on('click', (e) => {
            e.stopPropagation();
            console.log('Minimal next button clicked');
            debouncedNext();
        });

        elements.nextBtn.off('click').on('click', (e) => {
            e.stopPropagation();
            console.log('Detailed next button clicked');
            debouncedNext();
        });

        elements.prevBtnMinimal.off('click').on('click', (e) => {
            e.stopPropagation();
            console.log('Minimal previous button clicked');
            playPreviousSong();
        });

        elements.prevBtn.off('click').on('click', (e) => {
            e.stopPropagation();
            console.log('Detailed previous button clicked');
            playPreviousSong();
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
            showCreatePlaylistModal();
        });

        elements.createPlaylistBtnModal.off('click').on('click', () => {
            console.log('Create playlist modal clicked');
            showCreatePlaylistModal();
        });

        elements.progressContainer.off('click').on('click', (e) => {
            console.log('Progress bar clicked');
            seekSong(e);
        });

        elements.player.off('timeupdate error play pause').on({
            timeupdate: () => {
                updateProgress();
                savePlaybackState();
            },
            error: () => {
                console.error('Playback error:', elements.audioSource.attr('src'));
                elements.status.text('Error: Song unavailable. Skipping...');
                state.isTransitioning = false;
                playNextSong();
            },
            play: () => {
                state.isPlaying = true;
                updatePlayPauseButton();
            },
            pause: () => {
                state.isPlaying = false;
                updatePlayPauseButton();
            }
        });

        elements.settingsLink.off('click').on('click', (e) => {
            console.log('Settings link clicked');
            savePlaybackState();
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
                showTab('search');
            } else {
                showTab('home');
            }
            ensureSearchBarVisibility();
            ensureTabVisibility();
        }

        $(window).off('settings:updated storage').on('settings:updated storage', (e) => {
            if (e.type === 'storage' && e.key !== STORAGE_KEYS.SETTINGS) return;
            console.log('Settings updated');
            applySettings();
            updatePlayPauseButton();
        });

        // Ensure ended event is bound only once
        setupAutoPlay();
    }

    // Update Play/Pause Button
    function updatePlayPauseButton() {
        const icon = elements.playPauseBtn.find('i');
        icon.removeClass('fa-play fa-pause').addClass(state.isPlaying ? 'fa-pause' : 'fa-play');
        console.log('Play/pause button updated:', state.isPlaying);
    }

    // Show Create Playlist Modal
    function showCreatePlaylistModal() {
        elements.createPlaylistModal.removeClass('hidden');
        elements.playlistNameInput.val('').focus();
        console.log('Showing create playlist modal');
    }

    // Create Playlist
    function createPlaylist() {
        const name = elements.playlistNameInput.val().trim();
        elements.createPlaylistModal.addClass('hidden');
        elements.playlistNameInput.val('');

        if (!name) {
            elements.status.text('Please enter a valid playlist name');
            return;
        }

        const playlists = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYLISTS) || '{}');
        if (playlists[name]) {
            elements.status.text('Playlist already exists!');
            return;
        }

        playlists[name] = [];
        localStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(playlists));
        renderPlaylists();
        loadHomeContent();
        elements.status.text(`Playlist "${name}" created`);
        console.log('Playlist created:', name);
        if (!elements.playlistModal.hasClass('hidden') && state.currentSongId) {
            showPlaylistModal(state.resultsObjects[state.currentSongId].track);
        }
    }

    // Toggle Player View
    function togglePlayerView() {
        state.isDetailedView = !state.isDetailedView;
        console.log('Toggling player view:', state.isDetailedView);
        if (state.isDetailedView) {
            elements.playerMinimal.addClass('hidden');
            elements.playerDetailed.removeClass('hidden');
            console.log('Showing detailed view, hiding minimal view');
        } else {
            elements.playerMinimal.removeClass('hidden');
            elements.playerDetailed.addClass('hidden');
            console.log('Showing minimal view, hiding detailed');
        }
        updatePlayPauseButton();
    }

    // Toggle Loop
    function toggleLoop() {
        state.isLooping = !state.isLooping;
        elements.player[0].loop = state.isLooping;
        elements.loopBtn.toggleClass('text-teal-300', state.isLooping);
        elements.loopBtn.toggleClass('active', state.isLooping);
        console.log('Loop state:', state.isLooping);

        $('.loop-state-label').remove();
        const labelText = state.isLooping ? 'ON' : 'OFF';
        const label = $(`<span class="loop-state-label">${labelText}</span>`);
        elements.loopBtn.parent().css('position', 'relative').append(label);
        setTimeout(() => {
            label.fadeOut(1, () => label.remove());
        }, 2000);
    }

    // Search Functions
    function clearSearch() {
        elements.searchBox.val('');
        elements.clearSearch.addClass('hidden');
        elements.results.empty();
        elements.status.text('');
        elements.loadMoreBtn.addClass('hidden');
        state.lastSearch = '';
        state.pageIndex = 1;
        state.resultsObjects = {};
        ensureSearchBarVisibility();
    }

    function handleDirectURL() {
        const hash = decodeURIComponent(window.location.hash.substring(1)).replace(/\+/g, ' ');
        if (hash) {
            elements.searchBox.val(hash);
            doViTuneSearch(hash);
            showTab('search');
        } else {
            doViTuneSearch('AP%20Dhillon', true);
            showTab('home');
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
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const json = await response.json();
            console.log('API Response:', json);
            const settings = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}');
            const isMoodFilterOn = settings.moodFilter === 'on';
            const results = json.data?.results || json.results || [];

            if (!results.length) {
                elements.results.html(`
                    <div>
                        <p class="text-center text-sm text-gray-400">No results found. Try another query.</p>
                        <button id="loadmore" class="bg-teal-500 text-white rounded-full py-2 px-4 mt-4 text-sm hover:bg-teal-600 mx-auto block hidden transition duration-200">Load More</button>
                    </div>
                `);
                elements.status.text('');
                elements.loadMoreBtn.addClass('hidden');
                ensureSearchBarVisibility();
                return;
            }

            state.lastSearch = query;
            const bitrateIndex = settings.bitrate || '4';
            const songs = results
                .filter(track => track.downloadUrl && track.downloadUrl[bitrateIndex]?.link)
                .map(track => ({
                    id: track.id,
                    name: textAbstract(track.name, 25),
                    album: textAbstract(track.album?.name || '', 20),
                    artist: textAbstract(track.primaryArtists, 30),
                    duration: formatDuration(track.duration || 0),
                    image: track.image && track.image[2]?.link || track.image && track.image[1]?.link || DEFAULT_SONG_IMAGE,
                    url: track.downloadUrl[bitrateIndex].link,
                    quality: bitrateIndex === '4' ? '320' : bitrateIndex === '3' ? '160' : bitrateIndex === '2' ? '96' : '64',
                    mood: track.mood || 'unknown',
                    year: track.year || ''
                }))
                .filter(song => !isMoodFilterOn || song.mood !== 'sad');

            songs.forEach(song => {
                state.resultsObjects[song.id] = { track: song };
            });

            elements.results.html(`
                <div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                        ${songs.map(song => generateSongCard(song)).join('')}
                    </div>
                    <button id="loadmore" class="bg-teal-500 text-white rounded-full py-2 px-4 mt-4 text-sm hover:bg-teal-600 mx-auto block ${songs.length < 40 ? 'hidden' : ''} transition duration-200">Load More</button>
                </div>
            `);
            elements.loadMoreBtn = $('#loadmore');
            elements.loadMoreBtn.off('click').on('click', () => {
                console.log('Load more clicked');
                nextPage();
            });

            if (!noScroll) {
                elements.results[0].scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            elements.status.text('');
            bindCardEventListeners();
            handleLoadMoreVisibility();
        } catch (error) {
            clearTimeout(timeoutId);
            console.error('Search error:', error);
            elements.status.text(`Error: ${error.name === 'AbortError' ? 'Request timed out' : error.message}`);
            elements.results.html(`
                <div>
                    <p class="text-center text-sm text-gray-400">Unable to find songs.</p>
                    <button id="loadmore" class="bg-teal-500 text-white rounded-full py-2 px-4 mt-4 text-sm hover:bg-teal-600 mx-auto block hidden transition duration-200">Load More</button>
                </div>
            `);
            elements.loadMoreBtn = $('#loadmore');
            elements.loadMoreBtn.addClass('hidden');
        }
        ensureSearchBarVisibility();
        ensureTabVisibility();
    }

    function nextPage() {
        if (!state.lastSearch) return;
        state.pageIndex++;
        doViTuneSearch(state.lastSearch);
    }

   // Playback Functions
    async function playAudio(audioUrl, songId) {
        console.log('playAudio called:', { songId, audioUrl });
        state.isTransitioning = false;
        state.isTransitioning = true;

        const song = state.resultsObjects[songId]?.track;
        if (!song) {
            console.error('Song not found:', songId);
            elements.status.text('Error: Song not found.');
            state.isTransitioning = false;
            return;
        }

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

        try {
            elements.player[0].pause();
            elements.player[0].currentTime = 0;
            elements.audioSource.removeAttr('src');
            elements.player[0].load();
            console.log('Audio element reset');
        } catch (error) {
            console.error('Audio reset error:', error);
        }

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

        const settings = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}');
        if (settings.songCardTransparency === 'on') {
            $('.song-container, #ViTune-results').addClass('song-transparent');
        }

        let history = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY) || '[]');
        const existingIndex = history.findIndex(s => s.id === song.id);
        if (existingIndex !== -1) {
            history.splice(existingIndex, 1);
        }
        history.unshift(song);
        history = history.slice(0, 50);
        localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
        state.resultsObjects[song.id] = { track: song };
        state.originalHistory = [...history];

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

    
    // Playback Functions
    async function playAudio1(audioUrl, songId, startTime = null) {
        console.log('playAudio called:', { songId, audioUrl, startTime });
        if (state.isTransitioning) {
            console.log('Transition in progress, aborting playAudio');
            return;
        }

        state.isTransitioning = true;
        const song = state.resultsObjects[songId]?.track;
        if (!song) {
            console.error('Song not found:', songId);
            elements.status.text('Error: Song not found.');
            state.isTransitioning = false;
            return;
        }

        try {
            const response = await fetch(audioUrl, { method: 'HEAD', mode: 'cors' });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('Song unavailable:', audioUrl);
            elements.status.text('Error: Song unavailable. Skipping...');
            state.isTransitioning = false;
            playNextSong();
            return;
        }

        try {
            elements.player[0].pause();
            state.isPlaying = false;
            elements.player[0].currentTime = 0;
            elements.audioSource.removeAttr('src');
            elements.player[0].load();
            console.log('Audio element reset');
        } catch (error) {
            console.error('Audio reset error:', error);
        }

        state.currentSongId = songId;
        elements.audioSource.attr('src', audioUrl);
        elements.playerName.text(song.name);
        elements.playerNameD.text(song.name);
        elements.playerAlbum.text(song.album || 'Unknown Album');
        elements.playerImage.attr('src', song.image).on('error', () => {
            elements.playerImage.attr('src', DEFAULT_SONG_IMAGE);
        });
        elements.playerImageD.attr('src', song.image).on('error', () => {
            elements.playerImageD.attr('src', DEFAULT_SONG_IMAGE);
        });
        elements.audioPlayer.removeClass('hidden');
        document.title = `${song.name} - ${song.album || 'Unknown Album'}`;

        const settings = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}');
        if (settings.songCardTransparency === 'on') {
            $('.song-container, #ViTune-results').addClass('song-transparent');
        }

        let history = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY) || '[]');
        const existingIndex = history.findIndex(s => s.id === songId);
        if (existingIndex !== -1) {
            history.splice(existingIndex, 1);
        }
        history.unshift(song);
        history = history.slice(0, 50);
        localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
        state.originalHistory = [...history];

        try {
            elements.player[0].load();
            if (startTime !== null && !isNaN(startTime)) {
                elements.player[0].currentTime = startTime;
                console.log('Seeking to saved time:', startTime);
            }
            await elements.player[0].play();
            state.isPlaying = true;
            console.log('Playing song:', song.name);
        } catch (error) {
            console.error('Audio play error:', error);
            elements.status.text('Error playing song. Skipping...');
            playNextSong();
        } finally {
            state.isTransitioning = false;
            console.log('playAudio completed:', state.isPlaying);
        }

        updateLikeButton();
        updatePlayPauseButton();
        savePlayQueue();
        savePlaybackState();
        if ($('#home-tab').is(':visible')) {
            loadHomeContent();
        }
    }

    function togglePlayPause() {
        if (!state.currentSongId) {
            elements.status.text('No song selected.');
            return;
        }
        if (state.isPlaying) {
            elements.player[0].pause();
            state.isPlaying = false;
        } else {
            elements.player[0].play().then(() => {
                state.isPlaying = true;
            }).catch(error => {
                console.error('Toggle play error:', error);
                elements.status.text('Error: Unable to play.');
                state.isPlaying = false;
            });
        }
        updatePlayPauseButton();
        savePlaybackState();
        console.log('Play state:', state.isPlaying);
    }

    function getCurrentContext() {
        const settings = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}');
        const isMoodFilterOn = settings.moodFilter === 'on';
        let context = { type: 'unknown', songs: [], containerId: '' };

        if ($('#search-tab').is(':visible')) {
            let songs = Object.values(state.resultsObjects).map(obj => obj.track).filter(Boolean);
            if (isMoodFilterOn) {
                songs = songs.filter(song => song.mood !== 'sad');
            }
            context = {
                type: 'songs',
                songs: songs,
                containerId: '#ViTune-results'
            };
        } else if ($('#likes-tab').is(':visible')) {
            let likes = JSON.parse(localStorage.getItem(STORAGE_KEYS.LIKES) || '[]');
            likes.forEach(song => {
                state.resultsObjects[song.id] = { track: song };
            });
            if (isMoodFilterOn) {
                likes = likes.filter(song => song.mood !== 'sad');
            }
            context = {
                type: 'likes',
                songs: likes,
                containerId: '#likes-list'
            };
        } else if ($('#playlists-tab').is(':visible') && state.currentPlaylistView) {
            const playlists = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYLISTS) || '{}');
            let playlistSongs = playlists[state.currentPlaylistView] || [];
            playlistSongs.forEach(song => {
                state.resultsObjects[song.id] = { track: song };
            });
            if (isMoodFilterOn) {
                playlistSongs = playlistSongs.filter(song => song.mood !== 'sad');
            }
            context = {
                type: 'playlist',
                songs: playlistSongs,
                containerId: '#playlists-list'
            };
        } else if ($('#home-tab').is(':visible') && state.currentPlaylistView) {
            const playlists = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYLISTS) || '{}');
            let playlistSongs = playlists[state.currentPlaylistView] || [];
            playlistSongs.forEach(song => {
                state.resultsObjects[song.id] = { track: song };
            });
            if (isMoodFilterOn) {
                playlistSongs = playlistSongs.filter(song => song.mood !== 'sad');
            }
            context = {
                type: 'playlist',
                songs: playlistSongs,
                containerId: '#home-content'
            };
        } else if ($('#home-tab').is(':visible')) {
            let history = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY) || '[]');
            history.forEach(song => {
                state.resultsObjects[song.id] = { track: song };
            });
            if (isMoodFilterOn) {
                history = history.filter(song => song.mood !== 'sad');
            }
            context = {
                type: 'recent',
                songs: [...history],
                containerId: '#home-content .recent-played'
            };
        } else if ($('#offline-tab').is(':visible')) {
            let offline = JSON.parse(localStorage.getItem(STORAGE_KEYS.OFFLINE) || '[]');
            offline.forEach(song => {
                state.resultsObjects[song.id] = { track: song };
            });
            if (isMoodFilterOn) {
                offline = offline.filter(song => song.mood !== 'sad');
            }
            context = {
                type: 'offline',
                songs: offline,
                containerId: '#offline-list'
            };
        }
        console.log('getCurrentContext:', { type: context.type, songCount: context.songs.length });
        return context;
    }

    function playNextSong() {
        console.log('playNextSong called:', { isTransitioning: state.isTransitioning, currentSongId: state.currentSongId });
        if (state.isTransitioning) {
            console.log('Transition in progress, aborting playNextSong');
            return;
        }
        state.isTransitioning = true;

        // Check play queue first
        if (state.playQueue.length > 0) {
            const nextSong = state.playQueue.shift();
            console.log('Playing from queue:', nextSong.name);
            state.resultsObjects[nextSong.id] = { track: nextSong };
            playAudio(nextSong.url, nextSong.id);
            savePlayQueue();
            return;
        }

        const context = getCurrentContext();
        if (context.songs.length === 0) {
            console.log('No songs in context:', context.type);
            elements.status.text('No more songs to play.');
            state.isPlaying = false;
            updatePlayPauseButton();
            state.isTransitioning = false;
            return;
        }

        let currentIndex = context.songs.findIndex(song => song.id === state.currentSongId);
        console.log('Current index:', currentIndex);

        if (currentIndex === -1 && context.songs.length > 0) {
            // If current song not found in context, start from first song
            const nextSong = context.songs[0];
            console.log('Current song not found, playing first song:', nextSong.name);
            state.resultsObjects[nextSong.id] = { track: nextSong };
            playAudio(nextSong.url, nextSong.id);
            return;
        }

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
            updatePlayPauseButton();
            state.isTransitioning = false;
        }
    }

    function playPreviousSong() {
        console.log('playPreviousSong called:', { isTransitioning: state.isTransitioning, currentSongId: state.currentSongId });
        if (state.isTransitioning) {
            console.log('Transition in progress, aborting playPreviousSong');
            return;
        }
        state.isTransitioning = true;

        const currentTime = elements.player[0].currentTime;
        if (currentTime > 5) {
            // Restart current song if played more than 5 seconds
            elements.player[0].currentTime = 0;
            elements.player[0].play().then(() => {
                state.isPlaying = true;
                updatePlayPauseButton();
                state.isTransitioning = false;
                console.log('Restarting current song');
            }).catch(error => {
                console.error('Restart error:', error);
                elements.status.text('Error restarting song.');
                state.isTransitioning = false;
            });
            return;
        }

        const context = getCurrentContext();
        if (context.songs.length === 0) {
            console.log('No songs in context:', context.type);
            elements.status.text('No previous songs.');
            state.isTransitioning = false;
            return;
        }

        const currentIndex = context.songs.findIndex(song => song.id === state.currentSongId);
        if (currentIndex <= 0) {
            console.log('No previous song, restarting current');
            elements.player[0].currentTime = 0;
            elements.player[0].play().then(() => {
                state.isPlaying = true;
                updatePlayPauseButton();
                state.isTransitioning = false;
                console.log('Restarting current song (no previous)');
            }).catch(error => {
                console.error('Restart error:', error);
                elements.status.text('Error restarting song.');
                state.isTransitioning = false;
            });
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
        savePlaybackState();
        console.log('Seek to:', player.currentTime);
    }

    // Queue Functions
    function addToPlayNext(song) {
        const songData = state.resultsObjects[song.id]?.track || song;
        if (songData) {
            state.playQueue.unshift(songData);
            savePlayQueue();
            elements.status.text('Added to play next');
            console.log('Added to play next:', songData.name);
        } else {
            console.error('Song not found for play next:', song);
            elements.status.text('Error: Song not found.');
        }
    }

    function savePlayQueue() {
        localStorage.setItem(STORAGE_KEYS.PLAY_QUEUE, JSON.stringify(state.playQueue));
    }

    function loadPlayQueue() {
        state.playQueue = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAY_QUEUE) || '[]');
    }

    // Likes Functions
    function toggleLikeCurrentSong() {
        if (!state.currentSongId) {
            elements.status.text('No song selected.');
            return;
        }
        const song = state.resultsObjects[state.currentSongId]?.track;
        if (!song) return;

        let likes = JSON.parse(localStorage.getItem(STORAGE_KEYS.LIKES) || '[]');
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

    // Playlist Functions
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
        Object.keys(playlists).forEach(playlist => {
            const isInPlaylist = playlists[playlist].some(s => s.id === song.id);
            elements.playlistOptions.append(`
                <li>
                    <button class="${isInPlaylist ? 'remove-from-playlist-btn' : 'add-to-playlist-btn'} w-full text-left px-2 py-1 text-sm text-white hover:bg-gray-500 rounded transition duration-200" data-name="${playlist}" data-song-id="${song.id}" data-song='${JSON.stringify(song).replace(/'/g, "\\'")}'>${isInPlaylist ? '<i class="fa fa-minus mr-1"></i>Remove from' : '<i class="fa fa-plus mr-1"></i>Add to'} ${playlist}</button>
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
            if (!elements.playlistModal.hasClass('hidden')) {
                showPlaylistModal(song);
            }
        }
    }

    function removeFromPlaylist(playlistName, songId) {
        const playlists = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYLISTS) || '{}');
        if (playlists[playlistName]) {
            playlists[playlistName] = playlists[playlistName].filter(s => s.id !== songId);
            localStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(playlists));
            elements.status.text(`Removed from "${playlistName}"`);
            if ($('#playlists-tab').is(':visible') && state.currentPlaylistView === playlistName) {
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

    // Download Functions
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

    // Render Functions
    function generateSongCard(song) {
        return `
            <div class="song-container bg-gray-800 rounded-lg p-4 relative shadow-md hover:shadow-lg transition-all duration-200 play-btn" data-song-id="${song.id}">
                <img src="${song.image}" alt="Song Image" class="w-full h-40 object-cover rounded-lg mb-4 play-btn" data-song-id="${song.id}" onerror="this.src='${DEFAULT_SONG_IMAGE}'">
                <h3 class="text-sm font-semibold mb-1 truncate play-btn" data-song-id="${song.id}">${song.name}</h3>
                <p class="text-xs text-gray-400 truncate mb-1 play-btn" data-song-id="${song.id}">${song.album || '-'}</p>
                <p class="text-xs text-gray-400 truncate play-btn" data-song-id="${song.id}">${song.artist}</p>
                <p class="text-xs text-gray-500 play-btn" data-song-id="${song.id}">${song.duration} | ${song.year || '-'}</p>
                <div class="three-dot-menu absolute top-2 right-2 z-20">
                    <button class="three-dot-btn text-white hover:bg-gray-600 rounded-full p-1 transition duration-150"><i class="fa fa-ellipsis-v"></i></button>
                    <div class="three-dot-dropdown hidden absolute right-0 mt-2 bg-gray-600 rounded-lg shadow-lg p-2 w-36 z-30">
                        <button class="like-btn block w-full text-left px-2 py-1 text-sm text-white hover:bg-teal-500 rounded transition duration-200" data-id="${song.id}"><i class="fa fa-heart mr-1"></i>${isLiked(song.id) ? 'Unlike' : 'Like'}</button>
                        <button class="playlist-btn block w-full text-left px-2 py-1 text-sm text-white hover:bg-teal-500 rounded transition duration-200" data-song='${JSON.stringify(song).replace(/'/g, "\\'")}'>${'<i class="fa fa-plus mr-1"></i>Add to Playlist'}</button>
                        <button class="play-next-btn block w-full text-left px-2 py-1 text-sm text-white hover:bg-teal-500 rounded transition duration-200" data-song='${JSON.stringify(song).replace(/'/g, "\\'")}'>${'<i class="fa fa-step-forward mr-1"></i>Play Next'}</button>
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
                <img src="${image}" alt="${name} Playlist" class="w-full h-40 object-cover rounded-lg mb-4" onerror="this.src='${DEFAULT_SONG_IMAGE}'">
                <h3 class="text-sm font-semibold mb-1 truncate">${name}</h3>
                <p class="text-xs text-gray-400 truncate">${songs.length} song${songs.length !== 1 ? 's' : ''}</p>
            </div>
        `;
    }

    async function loadHomeContent() {
        const settings = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}');
        const isMoodFilterOn = settings.moodFilter === 'on';
        const likes = JSON.parse(localStorage.getItem(STORAGE_KEYS.LIKES) || '[]').filter(song => !isMoodFilterOn || song.mood !== 'sad');
        const offlineSongs = JSON.parse(localStorage.getItem(STORAGE_KEYS.OFFLINE) || '[]').filter(song => !isMoodFilterOn || song.mood !== 'sad');
        const playlists = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYLISTS) || '{}');
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
        history = validHistory.slice(0, 8).filter(song => !isMoodFilterOn || song.mood !== 'sad');
        state.originalHistory = [...validHistory];

        elements.homeContent.html(`
            <h2 class="text-lg font-semibold mb-3 text-center sm:text-left">Recently Played</h2>
            <div class="recent-played grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
                ${history.length ? history.map(song => generateSongCard(song)).join('') : '<p class="text-center text-sm text-gray-400">No recent songs.</p>'}
            </div>
            <h2 class="text-lg font-semibold mb-3 text-center sm:text-left">Liked Songs</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
                ${likes.length ? likes.slice(0, 8).map(song => generateSongCard(song)).join('') : '<p class="text-center text-sm text-gray-400">No liked songs.</p>'}
            </div>
            <h2 class="text-lg font-semibold mb-3 text-center sm:text-left">Offline Songs</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
                ${offlineSongs.length ? offlineSongs.slice(0, 8).map(song => generateSongCard(song)).join('') : '<p class="text-center text-sm text-gray-400">No offline songs.</p>'}
            </div>
            <h2 class="text-lg font-semibold mb-3 text-center sm:text-left">Playlists</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
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
        const settings = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}');
        const isMoodFilterOn = settings.moodFilter === 'on';
        const likes = JSON.parse(localStorage.getItem(STORAGE_KEYS.LIKES) || '[]').filter(song => !isMoodFilterOn || song.mood !== 'sad');
        likes.forEach(song => {
            state.resultsObjects[song.id] = { track: song };
        });
        elements.likesList.html(`
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                ${likes.length ? likes.map(song => generateSongCard(song)).join('') : '<p class="text-center text-sm text-gray-400">No liked songs.</p>'}
            </div>
        `);
        bindCardEventListeners();
        console.log('Likes rendered');
    }

    function renderPlaylists() {
        const settings = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}');
        const isMoodFilterOn = settings.moodFilter === 'on';
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
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
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
        const settings = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}');
        const isMoodFilterOn = settings.moodFilter === 'on';
        const playlists = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYLISTS) || '{}');
        const songs = (playlists[playlistName] || []).filter(song => !isMoodFilterOn || song.mood !== 'sad');
        songs.forEach(song => {
            state.resultsObjects[song.id] = { track: song };
        });
        $(containerId).html(`
            <div class="mb-4">
                <div class="flex justify-between mb-2">
                    <h3 class="text-base font-semibold truncate">${playlistName}</h3>
                    <button class="text-red-500 hover:text-red-400 text-sm delete-playlist-btn" data-name="${playlistName}"><i class="fa fa-trash"></i> Delete Playlist</button>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                    ${songs.length ? songs.map(song => `
                        <div class="song-container bg-gray-800 rounded-lg p-4 relative shadow-md hover:shadow-lg transition-all duration-200">
                            <img src="${song.image}" alt="Song Image" class="w-full h-40 object-cover rounded-lg mb-4 play-btn" data-song-id="${song.id}" onerror="this.src='${DEFAULT_SONG_IMAGE}'">
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
        const settings = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}');
        const isMoodFilterOn = settings.moodFilter === 'on';
        const offlineSongs = JSON.parse(localStorage.getItem(STORAGE_KEYS.OFFLINE) || '[]').filter(song => !isMoodFilterOn || song.mood !== 'sad');
        offlineSongs.forEach(song => {
            state.resultsObjects[song.id] = { track: song };
        });
        elements.offlineList.html(`
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                ${offlineSongs.length ? offlineSongs.map(song => generateSongCard(song)).join('') : '<p class="text-center text-sm text-gray-400">No songs.</p>'}
            </div>
        `);
        bindCardEventListeners();
        console.log('Offline songs rendered');
    }

    // Event Binding for Cards
    function bindCardEventListeners() {
        const debouncedPlay = debounce((songId) => {
            console.log('Play button clicked:', songId);
            const song = state.resultsObjects[songId]?.track;
            if (song) {
                if (state.currentSongId === songId) {
                    togglePlayPause();
                } else {
                    playAudio(song.url, songId);
                }
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
            let likes = JSON.parse(localStorage.getItem(STORAGE_KEYS.LIKES) || '[]');
            const index = likes.findIndex(s => s.id === songId);
            if (index === -1) {
                likes.push(song);
                elements.status.text('Song liked');
                $(this).html('<i class="fa fa-heart mr-1"></i>Unlike');
            } else {
                likes.splice(index, 1);
                elements.status.text('Song unliked');
                console.log('Unlike button clicked:', song.id);
                $(this).html('<i class="fa fa-heart-o mr-1"></i>Like');
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

    // Utility Functions
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
        ensureTabVisibility();
        ensureSearchBarVisibility();
        updatePlayPauseButton();
        console.log('Tab shown:', tabName);
    }

    function setupAutoPlay() {
        // Remove any existing 'ended' event listeners to prevent duplicates
        elements.player.off('ended').on('ended', () => {
            console.log('Song ended:', { isLooping: state.isLooping, currentSongId: state.currentSongId });
            if (!state.isLooping) {
                playNextSong();
            } else {
                elements.player[0].currentTime = 0;
                elements.player[0].play().then(() => {
                    state.isPlaying = true;
                    updatePlayPauseButton();
                    console.log('Looping current song');
                }).catch(error => {
                    console.error('Loop play error:', error);
                    elements.status.text('Error looping song.');
                });
            }
        });
    }

    // Start Application
    init();
});