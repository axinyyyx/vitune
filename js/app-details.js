$(document).ready(function() {
    const APP_DETAILS_URL = './app-details.json'; // Try relative path first
    const GITHUB_API_URL = 'https://api.github.com/repos/axinyyyx/vitune/releases/latest';
    const CURRENT_VERSION = '1.0.0'; // Current app version (update if local app is 1.1.R.2)

    // Elements for settings.html
    const settingsElements = {
        updateNotification: $('#update-notification'),
        updateMessage: $('#update-message'),
        apkDownload: $('#apk-download'),
        browserDownload: $('#browser-download')
    };

    // Elements for app-details.html
    const detailsElements = {
        appOverview: $('#app-overview'),
        appError: $('#app-error'),
        retryLoad: $('#retry-load'),
        appName: $('#app-name'),
        appDescription: $('#app-description'),
        appVersion: $('#app-version'),
        appUpdated: $('#app-updated'),
        appRelease: $('#app-release'),
        appIcon: $('#app-icon'),
        screenshots: $('#screenshots'),
        features: $('#features'),
        developerName: $('#developer-name'),
        developerIcon: $('#developer-icon'),
        developerContacts: $('#developer-contacts'),
        apkDownload: $('#apk-download'),
        browserDownload: $('#browser-download')
    };

    // Fetch app details from app-details.json
    function loadAppDetails(url = APP_DETAILS_URL) {
        $.ajax({
            url: url,
            dataType: 'json',
            cache: false, // Prevent caching issues
            success: function(data) {
                console.log('App details loaded:', data);
                if (settingsElements.updateNotification.length) {
                    checkForUpdates(data); // For settings.html
                }
                if (detailsElements.appName.length) {
                    populateAppDetails(data); // For app-details.html
                    detailsElements.appError.addClass('hidden');
                }
            },
            error: function(xhr, status, error) {
                console.error('Error loading app-details.json:', { url, status, error, statusCode: xhr.status });
                if (detailsElements.appDescription.length) {
                    detailsElements.appError.removeClass('hidden').html(`Unable to load app details (Error ${xhr.status}). Please ensure app-details.json is in the root directory or check your server configuration. <button id="retry-load" class="text-teal-500 hover:underline focus:outline-none">Retry</button>.`);
                    detailsElements.appName.text('ViTune');
                    detailsElements.appDescription.text('Unable to load app details. Please check your connection or try again later.');
                    detailsElements.appVersion.text('Unknown');
                    detailsElements.appUpdated.text('Unknown');
                    detailsElements.appRelease.text('Unknown');
                    detailsElements.screenshots.html('<p class="text-sm text-gray-400">No screenshots available.</p>');
                    detailsElements.features.html('<li class="text-sm text-gray-400">Unable to load features.</li>');
                }
            }
        });
    }

    // Populate app details for app-details.html
    function populateAppDetails(data) {
        detailsElements.appName.text(data.name || 'ViTune');
        detailsElements.appDescription.text(data.description || 'A modern music streaming app.');
        detailsElements.appVersion.text(data.version || 'Unknown');
        detailsElements.appUpdated.text(data.lastUpdated || 'Unknown');
        detailsElements.appRelease.text(data.releaseDate || 'Unknown');
        detailsElements.appIcon.attr('src', data.icon || 'img/logo.png').on('error', function() {
            $(this).attr('src', 'img/logo.png'); // Fallback if icon fails
        });
        detailsElements.developerName.text(data.developer?.name || 'Rishabh Kumar');
        detailsElements.developerIcon.attr('src', data.developer?.icon || 'https://avatars.githubusercontent.com/u/164033987?v=4');
        detailsElements.apkDownload.attr('href', data.apkUrl || '#');
        detailsElements.browserDownload.attr('href', data.browserUrl || '#');

        // Populate screenshots
        const screenshots = data.screenshots || [];
        detailsElements.screenshots.empty();
        if (screenshots.length) {
            screenshots.forEach((src, index) => {
                detailsElements.screenshots.append(`
                    <img src="${src}" alt="Screenshot ${index + 1}" class="w-48 h-96 object-cover rounded-lg shadow-md snap-center">
                `);
            });
        } else {
            detailsElements.screenshots.append('<p class="text-sm text-gray-400">No screenshots available.</p>');
        }

        // Populate features
        const features = data.features || [];
        detailsElements.features.empty();
        if (features.length) {
            features.forEach(feature => {
                detailsElements.features.append(`
                    <li class="flex items-start">
                        <i class="fas fa-check text-teal-500 mr-2 mt-1"></i>
                        <span>${feature}</span>
                    </li>
                `);
            });
        } else {
            detailsElements.features.append('<li class="text-sm text-gray-400">No features listed.</li>');
        }

        // Populate developer contacts
        const contacts = data.developer?.contacts || [];
        detailsElements.developerContacts.empty();
        if (contacts.length) {
            contacts.forEach(contact => {
                detailsElements.developerContacts.append(`
                    <a href="${contact.url}" target="_blank" class="text-teal-500 hover:text-teal-300 transition-all duration-200">
                        <i class="fab fa-${contact.icon} text-lg"></i>
                    </a>
                `);
            });
        } else {
            detailsElements.developerContacts.append('<p class="text-sm text-gray-400">No contact information available.</p>');
        }
    }

    // Check for updates via GitHub API for settings.html
    function checkForUpdates(appData) {
        $.ajax({
            url: GITHUB_API_URL,
            method: 'GET',
            cache: false,
            success: function(response) {
                console.log('GitHub API response:', response);
                const latestVersion = response.tag_name ? response.tag_name.replace(/^v/, '') : null;
                if (latestVersion && compareVersions(latestVersion, CURRENT_VERSION) > 0) {
                    settingsElements.updateMessage.text(`A new version (${latestVersion}) is available! Update now to enjoy the latest features.`);
                    settingsElements.updateNotification.removeClass('hidden');
                    const apkAsset = response.assets.find(asset => asset.name.endsWith('.apk'));
                    const browserAsset = response.assets.find(asset => asset.name.endsWith('.zip') || asset.name.endsWith('.tar.gz'));
                    settingsElements.apkDownload.attr('href', apkAsset ? apkAsset.browser_download_url : appData.apkUrl || '#');
                    settingsElements.browserDownload.attr('href', browserAsset ? browserAsset.browser_download_url : appData.browserUrl || '#');
                } else {
                    settingsElements.updateNotification.addClass('hidden');
                }
            },
            error: function(xhr, status, error) {
                console.error('Error checking for updates:', { status, error, statusCode: xhr.status });
                settingsElements.updateNotification.addClass('hidden');
            }
        });
    }

    // Compare version numbers (e.g., "1.2.3" vs "1.1.R.2")
    function compareVersions(v1, v2) {
        // Normalize versions by splitting on non-numeric characters
        const v1Parts = v1.split(/[^0-9]/).filter(Boolean).map(Number);
        const v2Parts = v2.split(/[^0-9]/).filter(Boolean).map(Number);
        for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
            const part1 = v1Parts[i] || 0;
            const part2 = v2Parts[i] || 0;
            if (part1 > part2) return 1;
            if (part1 < part2) return -1;
        }
        // If numeric parts are equal, check for additional qualifiers (e.g., R.2)
        if (v1.includes('R') && !v2.includes('R')) return 1;
        if (!v1.includes('R') && v2.includes('R')) return -1;
        return 0;
    }

    // Retry loading app details
    if (detailsElements.retryLoad.length) {
        $(document).on('click', '#retry-load', function() {
            detailsElements.appError.addClass('hidden');
            // Try alternative paths if default fails
            const alternativeUrls = [
                APP_DETAILS_URL,
                '/app-details.json',
                './app-details.json'
            ];
            let currentIndex = alternativeUrls.indexOf(APP_DETAILS_URL) + 1;
            if (currentIndex >= alternativeUrls.length) currentIndex = 0;
            loadAppDetails(alternativeUrls[currentIndex]);
        });
    }

    // Initialize
    loadAppDetails();
});