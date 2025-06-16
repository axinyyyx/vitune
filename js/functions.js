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
        playerAlbum: $('#player-album'),
        playerImage: $('#player-image'),
        audioPlayer: $('#audio-player'),
        playPauseBtn: $('#play-pause-btn'),
        prevBtn: $('#prev-btn'),
        nextBtn: $('#next-btn'),
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
        downloadList: $('#download-list')
    };

    // State
    let state = {
        currentSongId: null,
        lastSearch: '',
        pageIndex: 1,
        resultsObjects: {},
        playQueue: [],
        isLooping: false,
        isPlaying: false
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
        loadHomeContent();
        bindEventListeners();
        handleDirectURL();
        setupAutoPlay();
        loadPlayQueue();
        elements.mpopup.find('.close').on('click', () => elements.mpopup.hide());
        elements.mpLink.on('click', () => elements.mpopup.show());
        $(window).on('click', (e) => {
            if (e.target === elements.mpopup[0]) elements.mpopup.hide();
        });
    }

    // Apply Settings
    function applySettings() {
        const settings = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}');
        $('body').removeClass('dark light font-poppins font-arial font-times font-small font-medium font-large transparent-on transparent-off');
        $('body').addClass(settings.theme || 'dark');
        $('body').addClass(`font-${settings.fontStyle || 'poppins'}`);
        $('body').addClass(`font-${settings.fontSize || 'medium'}`);
        $('body').addClass(`transparent-${settings.transparentEffect || 'off'}`);
        $('#audio-player, #mpopupBox .modal-content, #playlist-modal .bg-gray-800').toggleClass('bg-opacity-50', settings.transparentEffect === 'on');
        elements.progressBar.removeClass('bg-teal-500 bg-red-500 bg-blue-500 progress-bar-simple progress-bar-gradient');
        elements.progressBar.addClass(`bg-${settings.progressBarColor || 'teal'}-500`);
        elements.progressBar.addClass(`progress-bar-${settings.progressBarStyle || 'simple'}`);
    }

    // Event Listeners
    function bindEventListeners() {
        const debouncedSearch = debounce((query) => {
            if (query.length >= 2) {
                doViTuneSearch(query.trim());
            }
        }, 300);

        elements.searchBox.on('input', function() {
            const query = $(this).val().trim();
            elements.clearSearch.toggleClass('hidden', !query);
            debouncedSearch(query);
        });

        elements.clearSearch.on('click', clearSearch);
        elements.loadMoreBtn.on('click', nextPage);
        elements.tabButtons.on('click', function() {
            showTab($(this).data('tab'));
        });

        elements.playPauseBtn.on('click', togglePlayPause);
        elements.prevBtn.on('click', playPreviousSong);
        elements.nextBtn.on('click', playNextSong);
        elements.loopBtn.on('click', toggleLoop);
        elements.likeBtn.on('click', toggleLikeCurrentSong);
        elements.playlistBtn.on('click', showPlaylistModalCurrentSong);
        elements.closePlaylistModal.on('click', closePlaylistModal);
        elements.createPlaylistBtn.on('click', createPlaylist);
        elements.createPlaylistBtnModal.on('click', createPlaylist);
        elements.progressContainer.on('click', seekSong);

        elements.player.on('timeupdate', updateProgress);
        elements.player.on('error', () => {
            console.error('Playback error:', elements.audioSource.attr('src'));
            elements.status.text('Error loading song.');
            playNextSong();
        });

        $(document).on('ViTune:search', (e, query) => {
            doViTuneSearch(query);
        });

        window.addEventListener('hashchange', () => {
            doViTuneSearch(decodeURIComponent(window.location.hash.substring(1)));
        });
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
        showTab('home');
        window.location.hash = '';
    }

    function handleDirectURL() {
        const hash = window.location.hash.substring(1);
        if (hash) {
            elements.searchBox.val(decodeURIComponent(hash));
            doViTuneSearch(decodeURIComponent(hash), true);
            showTab('search');
        } else {
            doViTuneSearch('Honey Singh', true);
        }
    }

    async function doViTuneSearch(query, noScroll = false) {
        if (!query) return;
        query = query.trim().replace(/\s+/g, ' ');
        const encodedQuery = encodeURIComponent(query);
        window.location.hash = encodedQuery;
        elements.searchBox.val(query);
        elements.status.text('Searching...');
        elements.results.html('<span class="loader">Loading...</span>');

        let searchQuery = `${encodedQuery}&limit=40`;
        if (state.pageIndex > 1) {
            searchQuery += `&page=${state.pageIndex}`;
        } else {
            state.resultsObjects = {};
        }

        try {
            const response = await fetch(SEARCH_URL + searchQuery);
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
            elements.status.text(`Error: ${error.message}`);
            elements.results.html('<p class="text-center text-sm text-gray-400">Unable to fetch songs. Check your connection.</p>');
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
    function playAudio(audio_url, song_id) {
        const song = state.resultsObjects[song_id]?.track;
        if (!song) {
            console.error('Song not found:', song_id);
            return;
        }

        state.currentSongId = song_id;
        elements.audioSource.attr('src', audio_url);
        elements.playerName.text(song.name);
        elements.playerAlbum.text(song.album || 'Unknown Album');
        elements.playerImage.attr('src', song.image);
        elements.audioPlayer.removeClass('hidden');
        document.title = `${song.name} - ${song.album || 'Unknown Album'}`;

        const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY) || '[]');
        history.unshift(song);
        localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history.slice(0, 50)));

        elements.player[0].load();
        elements.player[0].play().then(() => {
            state.isPlaying = true;
            elements.playPauseBtn.find('i').removeClass('fa-play').addClass('fa-pause');
        }).catch(error => {
            console.error('Audio play error:', error);
            elements.status.text('Error playing song.');
        });

        updateLikeButton();
        savePlayQueue();
    }

    function togglePlayPause() {
        if (state.isPlaying) {
            elements.player[0].pause();
            elements.playPauseBtn.find('i').removeClass('fa-pause').addClass('fa-play');
        } else {
            elements.player[0].play();
            elements.playPauseBtn.find('i').removeClass('fa-play').addClass('fa-pause');
        }
        state.isPlaying = !state.isPlaying;
    }

    function playNextSong() {
        if (state.playQueue.length > 0) {
            const nextSong = state.playQueue.shift();
            playAudio(nextSong.url, nextSong.id);
            savePlayQueue();
        } else {
            const songContainers = $('.song-container[data-song-id]');
            const currentIndex = songContainers.index($(`[data-song-id="${state.currentSongId}"]`));
            if (currentIndex < songContainers.length - 1) {
                const nextSongId = songContainers.eq(currentIndex + 1).data('song-id');
                const nextSong = state.resultsObjects[nextSongId]?.track;
                if (nextSong) {
                    playAudio(nextSong.url, nextSongId);
                }
            } else if (state.isLooping) {
                const firstSongId = songContainers.first().data('song-id');
                const firstSong = state.resultsObjects[firstSongId]?.track;
                if (firstSong) {
                    playAudio(firstSong.url, firstSongId);
                }
            }
        }
    }

    function playPreviousSong() {
        const songContainers = $('.song-container[data-song-id]');
        const currentIndex = songContainers.index($(`[data-song-id="${state.currentSongId}"]`));
        if (currentIndex > 0) {
            const prevSongId = songContainers.eq(currentIndex - 1).data('song-id');
            const prevSong = state.resultsObjects[prevSongId]?.track;
            if (prevSong) {
                playAudio(prevSong.url, prevSongId);
            }
        }
    }

    function toggleLoop() {
        state.isLooping = !state.isLooping;
        elements.loopBtn.toggleClass('text-teal-300', state.isLooping);
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
    }

    // Queue Functions
    function addToPlayNext(song) {
        state.playQueue.unshift(song);
        savePlayQueue();
        elements.status.text('Added to Play Next');
    }

    function savePlayQueue() {
        localStorage.setItem(STORAGE_KEYS.PLAY_QUEUE, JSON.stringify(state.playQueue));
    }

    function loadPlayQueue() {
        state.playQueue = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAY_QUEUE) || '[]');
    }

    // Like Functions
    function toggleLikeCurrentSong() {
        if (!state.currentSongId) return;
        const likes = JSON.parse(localStorage.getItem(STORAGE_KEYS.LIKES) || '[]');
        const song = state.resultsObjects[state.currentSongId]?.track;
        if (!song) return;

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
        if (!state.currentSongId) return;
        const song = state.resultsObjects[state.currentSongId]?.track;
        if (!song) return;
        showPlaylistModal(song);
    }

    function showPlaylistModal(song) {
        const playlists = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYLISTS) || '{}');
        elements.playlistOptions.empty();
        Object.keys(playlists).forEach(name => {
            elements.playlistOptions.append(`
                <li>
                    <button class="add-to-playlist-btn w-full text-left px-2 py-1 text-sm text-white hover:bg-teal-500 rounded" data-name="${name}" data-song='${JSON.stringify(song).replace(/'/g, "\\'")}'>${name}</button>
                </li>
            `);
        });
        elements.playlistModal.removeClass('hidden');
        $('.add-to-playlist-btn').off('click').on('click', function() {
            const playlistName = $(this).data('name');
            const songData = JSON.parse($(this).attr('data-song'));
            addToPlaylist(playlistName, songData);
            closePlaylistModal();
        });
    }

    function closePlaylistModal() {
        elements.playlistModal.addClass('hidden');
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
        elements.status.text(`Playlist "${name}" created`);
    }

    function addToPlaylist(playlistName, song) {
        const playlists = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYLISTS) || '{}');
        if (!playlists[playlistName]) playlists[playlistName] = [];
        if (!playlists[playlistName].some(s => s.id === song.id)) {
            playlists[playlistName].push(song);
            localStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(playlists));
            elements.status.text(`Added to "${playlistName}"`);
            if ($('#playlists-tab').is(':visible')) {
                renderPlaylists();
            }
        }
    }

    // Download Functions
    function addDownload(songId) {
        const song = state.resultsObjects[songId]?.track;
        if (!song) {
            console.error('Song not found for download:', songId);
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
            elements.mpLink.css({ backgroundColor: '#007bff', borderColor: '#007bff' });
        }, 1000);

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
                localStorage.setItem(STORAGE_KEYS.OFFLINE, JSON.stringify(offlineSongs.slice(0, 50)));
            })
            .catch(error => {
                downloadItem.find('.track-status').text(`Error: ${error.message}`);
                console.error('Download error:', error);
            });
    }

    // Render Functions
    function generateSongCard(song) {
        return `
            <div class="song-container bg-gray-800 rounded-lg p-4 relative" data-song-id="${song.id}">
                <img src="${song.image}" alt="Song Image" class="w-full h-40 object-cover rounded-lg mb-2 cursor-pointer play-btn" data-song-id="${song.id}">
                <h3 class="text-sm font-bold truncate play-btn cursor-pointer" data-song-id="${song.id}">${song.name}</h3>
                <p class="text-xs text-gray-400 truncate">${song.album}</p>
                <p class="text-xs text-gray-400 truncate">${song.artist}</p>
                <p class="text-xs text-gray-400">${song.duration} | ${song.year}</p>
                <div class="three-dot-menu absolute top-2 right-2 z-20">
                    <button class="three-dot-btn text-white"><i class="fa fa-ellipsis-v"></i></button>
                    <div class="three-dot-dropdown hidden absolute right-0 mt-2 bg-gray-700 rounded-lg shadow-lg p-2 w-36 z-30">
                        <button class="like-btn block w-full text-left px-2 py-1 text-sm text-white hover:bg-teal-500 rounded" data-id="${song.id}"><i class="fa fa-heart mr-1"></i>${isLiked(song.id) ? 'Unlike' : 'Like'}</button>
                        <button class="playlist-btn block w-full text-left px-2 py-1 text-sm text-white hover:bg-teal-500 rounded" data-song='${JSON.stringify(song).replace(/'/g, "\\'")}')><i class="fa fa-plus mr-1"></i>Add to Playlist</button>
                        <button class="play-next-btn block w-full text-left px-2 py-1 text-sm text-white hover:bg-teal-500 rounded" data-song='${JSON.stringify(song).replace(/'/g, "\\'")}')><i class="fa fa-step-forward mr-1"></i>Play Next</button>
                        <button class="download-btn block w-full text-left px-2 py-1 text-sm text-white hover:bg-teal-500 rounded" data-id="${song.id}"><i class="fa fa-download mr-1"></i>Download</button>
                    </div>
                </div>
            </div>
        `;
    }

    function loadHomeContent() {
        const likes = JSON.parse(localStorage.getItem(STORAGE_KEYS.LIKES) || '[]');
        const offlineSongs = JSON.parse(localStorage.getItem(STORAGE_KEYS.OFFLINE) || '[]');
        const playlists = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYLISTS) || '{}');
        const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY) || '[]');

        elements.homeContent.html(`
            <h2 class="text-lg font-bold mb-3 text-center sm:text-left">Recently Played</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                ${history.length ? history.slice(0, 8).map(generateSongCard).join('') : '<p class="text-center text-sm text-gray-400">No recent songs.</p>'}
            </div>
            <h2 class="text-lg font-bold mb-3 text-center sm:text-left">Liked Songs</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                ${likes.length ? likes.slice(0, 8).map(generateSongCard).join('') : '<p class="text-center text-sm text-gray-400">No liked songs.</p>'}
            </div>
            <h2 class="text-lg font-bold mb-3 text-center sm:text-left">Offline Songs</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                ${offlineSongs.length ? offlineSongs.slice(0, 8).map(generateSongCard).join('') : '<p class="text-center text-sm text-gray-400">No offline songs.</p>'}
            </div>
            <h2 class="text-lg font-bold mb-3 text-center sm:text-left">Playlists</h2>
            <div class="space-y-4">
                ${Object.keys(playlists).length ? Object.keys(playlists).map(name => `
                    <div class="mb-4">
                        <div class="flex justify-between mb-2">
                            <h3 class="text-base font-bold truncate">${name}</h3>
                            <button class="text-red-500 hover:text-red-600 text-sm delete-playlist-btn" data-name="${name}"><i class="fa fa-trash"></i></button>
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            ${playlists[name].length ? playlists[name].slice(0, 8).map(generateSongCard).join('') : '<p class="text-center text-sm text-gray-400">Empty playlist.</p>'}
                        </div>
                    </div>
                `).join('') : '<p class="text-center text-sm text-gray-400">No playlists.</p>'}
            </div>
        `);
        bindCardEventListeners();
    }

    function renderLikes() {
        const likes = JSON.parse(localStorage.getItem(STORAGE_KEYS.LIKES) || '[]');
        elements.likesList.html(`
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                ${likes.length ? likes.map(generateSongCard).join('') : '<p class="text-center text-sm text-gray-400">No liked songs.</p>'}
            </div>
        `);
        bindCardEventListeners();
    }

    function renderPlaylists() {
        const playlists = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYLISTS) || '{}');
        elements.playlistsList.empty();
        if (!Object.keys(playlists).length) {
            elements.playlistsList.html('<p class="text-center text-sm text-gray-400">No playlists.</p>');
            return;
        }
        Object.keys(playlists).forEach(name => {
            elements.playlistsList.append(`
                <div class="mb-4">
                    <div class="flex justify-between mb-2">
                        <h3 class="text-base font-bold truncate">${name}</h3>
                        <button class="text-red-500 hover:text-red-600 text-sm delete-playlist-btn" data-name="${name}"><i class="fa fa-trash"></i></button>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        ${playlists[name].length ? playlists[name].map(generateSongCard).join('') : '<p class="text-center text-sm text-gray-400">Empty playlist.</p>'}
                    </div>
                </div>
            `);
        });
        bindCardEventListeners();
    }

    function renderOffline() {
        const offlineSongs = JSON.parse(localStorage.getItem(STORAGE_KEYS.OFFLINE) || '[]');
        elements.offlineList.html(`
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                ${offlineSongs.length ? offlineSongs.map(generateSongCard).join('') : '<p class="text-center text-sm text-gray-400">No offline songs.</p>'}
            </div>
        `);
        bindCardEventListeners();
    }

    // Event Binding for Cards
    function bindCardEventListeners() {
        $('.play-btn').off('click').on('click', function() {
            const songId = $(this).data('song-id');
            const song = state.resultsObjects[songId]?.track;
            if (song) {
                playAudio(song.url, songId);
            }
        });

        $('.three-dot-btn').off('click').on('click', function(e) {
            e.stopPropagation();
            const dropdown = $(this).siblings('.three-dot-dropdown');
            $('.three-dot-dropdown').not(dropdown).addClass('hidden');
            dropdown.toggleClass('hidden');
        });

        $('.like-btn').off('click').on('click', function() {
            const songId = $(this).data('id');
            const song = state.resultsObjects[songId]?.track;
            if (!song) return;
            const likes = JSON.parse(localStorage.getItem(STORAGE_KEYS.LIKES) || '[]');
            const index = likes.findIndex(s => s.id === songId);
            if (index === -1) {
                likes.push(song);
                elements.status.text('Song liked');
            } else {
                likes.splice(index, 1);
                elements.status.text('Song unliked');
            }
            localStorage.setItem(STORAGE_KEYS.LIKES, JSON.stringify(likes));
            $(this).find('i').toggleClass('fa-heart-o', index !== -1).toggleClass('fa-heart', index === -1);
            $(this).text(`${index === -1 ? 'Unlike' : 'Like'}`);
            if ($('#likes-tab').is(':visible')) {
                renderLikes();
            }
            updateLikeButton();
        });

        $('.playlist-btn').off('click').on('click', function() {
            const song = JSON.parse($(this).attr('data-song'));
            showPlaylistModal(song);
        });

        $('.play-next-btn').off('click').on('click', function() {
            const song = JSON.parse($(this).attr('data-song'));
            addToPlayNext(song);
        });

        $('.download-btn').off('click').on('click', function() {
            const songId = $(this).data('id');
            addDownload(songId);
        });

        $('.delete-playlist-btn').off('click').on('click', function() {
            const name = $(this).data('name');
            if (confirm(`Delete playlist "${name}"?`)) {
                const playlists = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYLISTS) || '{}');
                delete playlists[name];
                localStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(playlists));
                renderPlaylists();
                elements.status.text(`Playlist "${name}" deleted`);
            }
        });

        $(document).on('click', (e) => {
            if (!$(e.target).closest('.three-dot-menu').length) {
                $('.three-dot-dropdown').addClass('hidden');
            }
        });
    }

    // Tab Functions
    function showTab(tab) {
        $('.tab-content').addClass('hidden');
        $(`#${tab}-tab`).removeClass('hidden');
        elements.tabButtons.removeClass('bg-teal-500 text-white active').addClass('bg-gray-800 text-gray-400');
        $(`.tab-btn[data-tab="${tab}"]`).addClass('bg-teal-500 text-white active').removeClass('bg-gray-800 text-gray-400');
        if (tab === 'home') loadHomeContent();
        else if (tab === 'likes') renderLikes();
        else if (tab === 'playlists') renderPlaylists();
        else if (tab === 'offline') renderOffline();
        else if (tab === 'search') {
            if (state.lastSearch) doViTuneSearch(state.lastSearch, true);
        }
    }

    // Utility Functions
    function textAbstract(text, length) {
        if (!text) return '';
        if (text.length <= length) return text;
        text = text.substring(0, length);
        const last = text.lastIndexOf(' ');
        text = text.substring(0, last);
        return text + '...';
    }

    function formatDuration(seconds) {
        const measuredTime = new Date(null);
        measuredTime.setSeconds(parseInt(seconds));
        let time = measuredTime.toISOString().substr(11, 8);
        if (time.startsWith('00:0')) return time.slice(4);
        if (time.startsWith('00:')) return time.slice(3);
        return time;
    }

    // Auto Play Setup
    function setupAutoPlay() {
        elements.player.off('ended').on('ended', () => {
            console.log('Song ended:', state.currentSongId);
            playNextSong();
        });
    }

    init();
});