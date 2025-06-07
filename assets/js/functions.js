var currentSongId = null;

function PlayAudio(audio_url, song_id) {
    var audio = document.getElementById('player');
    var source = document.getElementById('audioSource');
    source.src = audio_url;
    var name = document.getElementById(song_id + "-n")?.textContent || 'Unknown Song';
    var album = document.getElementById(song_id + "-a")?.textContent || 'Unknown Album';
    var image = document.getElementById(song_id + "-i")?.getAttribute("src") || 'https://i.pinimg.com/originals/ed/54/d2/ed54d2fa700d36d4f2671e1be84651df.jpg';
    
    currentSongId = song_id; // Store current song ID for auto-play
    console.log('Playing song ID:', song_id, 'URL:', audio_url);
    
    document.title = name + " - " + album;
    document.getElementById("player-name").innerHTML = name;
    document.getElementById("player-album").innerHTML = album;
    document.getElementById("player-image").setAttribute("src", image);

    var promise = audio.load();
    if (promise) {
        promise.catch(function(error) { console.error('Audio load error:', error); });
    }
    audio.play().catch(function(error) { console.error('Audio play error:', error); });
}

function AddDownload(id) {
    console.log('Initiating download for song ID:', id);
    
    var download_list = document.getElementById("download-list");
    var download_item = document.createElement("li");
    
    download_item.innerHTML = `
        <div class="col">
            <img class="track-img" src="${results_objects[id]?.track?.image[2]?.link || 'https://i.pinimg.com/originals/ed/54/d2/ed54d2fa700d36d4f2671e1be84651df.jpg'}" width="50px">
            <div style="display: inline;">
                <span class="track-name">${results_objects[id]?.track?.name || id}</span> - 
                <span class="track-album">${results_objects[id]?.track?.album?.name || 'Unknown Album'}</span>
                <br>
                <span class="track-size">Size: Downloading...</span>
                <span class="track-status" style="color:green">Starting...</span>
            </div>
        </div>
        <hr>
    `;
    
    download_item.setAttribute("track_tag", id);
    download_item.className = "no-bullets";
    download_list.appendChild(download_item);
    
    var download_status_span = document.querySelector('[track_tag="' + id + '"] .track-status');
    var download_name = document.querySelector('[track_tag="' + id + '"] .track-name');
    var download_album = document.querySelector('[track_tag="' + id + '"] .track-album');
    var download_img = document.querySelector('[track_tag="' + id + '"] .track-img');
    var download_size = document.querySelector('[track_tag="' + id + '"] .track-size');
    
    download_name.innerHTML = results_objects[id]?.track?.name || id;
    download_album.innerHTML = results_objects[id]?.track?.album?.name || 'Unknown Album';
    download_img.setAttribute("src", results_objects[id]?.track?.image[2]?.link || 'https://i.pinimg.com/originals/ed/54/d2/ed54d2fa700d36d4f2671e1be84651df.jpg');
    
    var float_tap = document.getElementById('mpopupLink');
    if (float_tap) {
        float_tap.style.backgroundColor = "green";
        float_tap.style.borderColor = "green";
        setTimeout(function() {
            float_tap.style.backgroundColor = "#007bff";
            float_tap.style.borderColor = "#007bff";
        }, 1000);
    }
    
    // Use the downloadUrl from results_objects
    var bitrate = document.getElementById('ViTune-bitrate');
    var bitrate_i = bitrate.options[bitrate.selectedIndex].value;
    var download_url = results_objects[id]?.track?.downloadUrl?.[bitrate_i]?.link;
    
    if (!download_url) {
        download_status_span.innerHTML = "Error: Download URL not found";
        console.error('Download URL not found for song ID:', id);
        return;
    }
    
    console.log('Downloading from URL:', download_url);
    fetch(download_url)
    .then(response => {
        if (!response.ok) {
            throw new Error(`Download fetch error: ${response.status}`);
        }
        return response.blob();
    })
    .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `${results_objects[id]?.track?.name || id}.mp3`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        download_status_span.innerHTML = "Downloaded";
        download_size.innerHTML = "Size: " + (blob.size / (1024 * 1024)).toFixed(2) + " MB";
        console.log('Download completed for song ID:', id);
    })
    .catch(error => {
        download_status_span.innerHTML = `Error: ${error.message}`;
        console.error('Download error:', error);
    });
}