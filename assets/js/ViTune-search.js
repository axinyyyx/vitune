var results_container = document.querySelector("#ViTune-results");
var results_objects = {};
var lastSearch = '';
const searchUrl = "https://jiosaavn-api-privatecvc2.vercel.app/search/songs?query=";
var page_index = 1;

// Debounce for live search
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

function ViTuneSearch() {
    event.preventDefault();
    var query = document.querySelector("#ViTune-search-box").value.trim();
    query = encodeURIComponent(query);
    
    if (query === lastSearch) {
        doViTuneSearch(query);
    }
    if (query.length > 0) {
        window.location.hash = query;
    }
}

function nextPage() {
    var query = document.querySelector("#ViTune-search-box").value.trim();
    if (!query) { query = lastSearch; }
    query = encodeURIComponent(query);
    doViTuneSearch(query, 0, true);
}

async function doViTuneSearch(query, NotScroll, page) {
    window.location.hash = query;
    document.querySelector("#ViTune-search-box").value = decodeURIComponent(query);
    if (!query) return;
    
    results_container.innerHTML = `<span class="loader">Searching...</span>`;
    
    query += "&limit=40";
    if (page) {
        page_index++;
        query += "&page=" + page_index;
    } else {
        query += "&page=1";
        page_index = 1;
    }
    
    try {
        var response = await fetch(searchUrl + query);
        var json = await response.json();
        
        if (response.status !== 200) {
            results_container.innerHTML = `<span class="error">Error: ${json.message || 'Unknown API error'}</span>`;
            console.error('API error:', response.status, json);
            return;
        }
        
        json = json.data.results;
        var results = [];
        if (!json || json.length === 0) {
            results_container.innerHTML = "<p>No results found. Try another Library</p>";
            return;
        }
        
        lastSearch = decodeURIComponent(window.location.hash.substring(1));
        results_objects = {}; // Clear previous results
        
        for (let track of json) {
            let song_name = TextAbstract(track.name, 25);
            let album_name = TextAbstract(track.album.name, 20);
            if (album_name === song_name) {
                album_name = "";
            }
            
            var measuredTime = new Date(null);
            measuredTime.setSeconds(parseInt(track.duration));
            var play_time = measuredTime.toISOString().substr(11, 8);
            if (play_time.startsWith("00:0")) {
                play_time = play_time.slice(4);
            } else if (play_time.startsWith("00:")) {
                play_time = play_time.slice(3);
            }
            
            var song_id = track.id;
            var year = track.year;
            var song_image = track.image[1]?.link || 'https://i.pinimg.com/originals/ed/54/d2/ed54d2fa700d36d4f2671e1be84651df.jpg';
            var song_artist = TextAbstract(track.primaryArtists, 30);
            var bitrate = document.getElementById('ViTune-bitrate');
            var bitrate_i = bitrate.options[bitrate.selectedIndex].value;
            
            if (track.downloadUrl && track.downloadUrl[bitrate_i]) {
                var download_url = track.downloadUrl[bitrate_i].link;
                var quality = bitrate_i === "4" ? 320 : 160;
                
                results_objects[song_id] = { track: track };
                
                results.push(`
                    <div class="text-left song-container" style="margin-bottom:20px;border-radius:10px;background-color:#1c1c1c;padding:10px;" data-song-id="${song_id}">
                        <div class="row" style="margin:auto;">
                            <div class="col-auto" style="padding:0px;padding-right:10px;border-style:none;">
                                <img id="${song_id}-i" class="img-fluid d-inline" style="width:115px;border-radius:5px;height:115px;padding-right:10px;" src="${song_image}" loading="lazy"/>
                            </div>
                            <div class="col" style="border-style:none;padding:2px;">
                                <p class="float-right fit-content" style="margin:0px;color:#fff;padding-right:10px;">${year}</p>
                                <p id="${song_id}-n" class="fit-content" style="margin:0px;color:#fff;max-width:100%;">${song_name}</p>
                                <p id="${song_id}-a" class="fit-content" style="margin:0px;color:#fff;max-width:100%;">${album_name}<br/></p>
                                <p id="${song_id}-ar" class="fit-content" style="margin:0px;color:#fff;max-width:100%;">${song_artist}<br/></p>
                                <button class="btn btn-primary song-btn" type="button" style="margin:0 2px;" onclick='PlayAudio("${download_url}","${song_id}")'>▶</button>
                                <button class="btn btn-primary song-btn" type="button" style="margin:0 2px;" onclick='AddDownload("${song_id}")'>DL</button>
                                <p class="float-right fit-content" style="margin:0px;color:#fff;padding-right:10px;padding-top:15px;">${play_time}<br/></p>
                            </div>
                        </div>
                    </div>
                `);
            }
        }
        
        results_container.innerHTML = results.join(' ');
        if (!NotScroll) {
            document.getElementById("ViTune-results").scrollIntoView();
        }
        
        setupAutoPlay();
    } catch (error) {
        results_container.innerHTML = `<span class="error">Error: ${error.message}<br>Check if API is down</span>`;
        console.error('Search error:', error);
    }
}

function TextAbstract(text, length) {
    if (!text) return "";
    if (text.length <= length) return text;
    text = text.substring(0, length);
    let last = text.lastIndexOf(" ");
    text = text.substring(0, last);
    return text + "...";
}

function setupAutoPlay() {
    const audioPlayer = document.getElementById('player');
    audioPlayer.removeEventListener('ended', autoPlayHandler);
    audioPlayer.addEventListener('ended', autoPlayHandler);
    console.log('Auto-play listener set up at', new Date().toLocaleTimeString());
}

function autoPlayHandler() {
    console.log('Auto-play triggered at', new Date().toLocaleTimeString());
    if (!currentSongId) {
        console.error('No current song ID set');
        return;
    }
    
    const songContainers = Array.from(document.querySelectorAll('.song-container[data-song-id]'));
    const currentIndex = songContainers.findIndex(container => container.getAttribute('data-song-id') === currentSongId);
    
    if (currentIndex === -1) {
        console.error('Current song ID not found in DOM:', currentSongId);
        return;
    }
    
    const nextIndex = currentIndex + 1;
    if (nextIndex < songContainers.length) {
        const nextSongId = songContainers[nextIndex].getAttribute('data-song-id');
        const bitrate = document.getElementById('ViTune-bitrate');
        const bitrate_i = bitrate.options[bitrate.selectedIndex].value;
        const nextSongUrl = results_objects[nextSongId]?.track?.downloadUrl?.[bitrate_i]?.link;
        
        if (nextSongUrl) {
            console.log(`Playing next song: ${nextSongId} with URL: ${nextSongUrl}`);
            PlayAudio(nextSongUrl, nextSongId);
        } else {
            console.error('Next song URL not found for ID:', nextSongId);
        }
    } else {
        console.log('No more songs to play');
    }
}

// Initialize
if (window.location.hash) {
    doViTuneSearch(window.location.hash.substring(1));
} else {
    doViTuneSearch('Honey Singh', 1);
}

addEventListener('hashchange', () => {
    doViTuneSearch(window.location.hash.substring(1));
});

// Bitrate change handler
$('#ViTune-bitrate').on('change', function() {
    doViTuneSearch(lastSearch);
});

// Load more
document.getElementById("loadmore").addEventListener('click', nextPage);

// Live search
const debouncedSearch = debounce((query) => {
    if (query.length >= 2) {
        doViTuneSearch(encodeURIComponent(query.trim()));
    }
}, 300);

document.getElementById('ViTune-search-box').addEventListener('input', (e) => {
    debouncedSearch(e.target.value);
});

document.addEventListener('DOMContentLoaded', setupAutoPlay);