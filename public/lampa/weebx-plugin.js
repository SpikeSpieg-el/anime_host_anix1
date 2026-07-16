/**
 * Weeb-X Plugin for Lampa
 * 
 * Syncs watch history between Lampa (Android TV) and Weeb-X.com
 * 
 * Installation:
 *   In Lampa, go to Settings → Plugins → Add
 *   URL: https://weeb-x.com/lampa/weebx-plugin.js
 * 
 * Activation:
 *   1. Plugin will display a 6-digit PIN code on your TV
 *   2. Go to https://weeb-x.com/activate on your phone/PC
 *   3. Log in to your Weeb-X account and enter the PIN
 *   4. Device is now linked - history syncs automatically
 */
(function () {
    'use strict';

    var WEEBX_API = 'https://weeb-x.com/api/lampa';
    var STORAGE_KEY = 'weebx_token';
    var STORAGE_DEVICE = 'weebx_device_id';
    var current_card = null;
    var last_sync_time = 0;
    var SYNC_INTERVAL = 30000; // 30 seconds between syncs
    var auth_check_interval = null;

    // Generate a unique device ID
    function getDeviceId() {
        var deviceId = Lampa.Storage.get(STORAGE_DEVICE);
        if (!deviceId) {
            deviceId = 'lampa_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            Lampa.Storage.set(STORAGE_DEVICE, deviceId);
        }
        return deviceId;
    }

    // Check if we have a valid token
    function isLoggedIn() {
        return !!Lampa.Storage.get(STORAGE_KEY);
    }

    // Start the PIN-based activation flow
    function startActivation() {
        var deviceId = getDeviceId();

        fetch(WEEBX_API + '/activate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                device_id: deviceId,
                device_name: 'Lampa/' + (navigator.userAgent || 'Android TV')
            })
        })
        .then(function (res) { return res.json(); })
        .then(function (data) {
            if (data.success) {
                showActivationModal(data.pin, data.expires_at);
                pollActivationStatus(data.pin);
            } else {
                Lampa.Noty.show('Weeb-X: Ошибка получения PIN кода', { time: 5000 });
            }
        })
        .catch(function (err) {
            console.error('Weeb-X activation error:', err);
            Lampa.Noty.show('Weeb-X: Сетевая ошибка активации', { time: 5000 });
        });
    }

    // Show the activation modal with PIN
    function showActivationModal(pin, expiresAt) {
        var html = '<div style="text-align:center;padding:20px;">' +
            '<div style="font-size:14px;color:#ccc;margin-bottom:16px;">Weeb-X Синхронизация</div>' +
            '<div style="font-size:12px;color:#999;margin-bottom:20px;">Перейдите на сайт и введите код:</div>' +
            '<div style="font-size:48px;font-weight:bold;letter-spacing:8px;color:#ff6b00;margin:20px 0;">' + pin + '</div>' +
            '<div style="font-size:14px;color:#ccc;margin-bottom:8px;">Сайт активации:</div>' +
            '<div style="font-size:18px;color:#4fc3f7;margin-bottom:20px;">weeb-x.com/activate</div>' +
            '<div style="font-size:11px;color:#666;">Код действителен 10 минут</div>' +
            '</div>';

        Lampa.Modal.open({
            title: '',
            html: html,
            size: 'medium',
            onBack: function () {
                if (auth_check_interval) {
                    clearInterval(auth_check_interval);
                    auth_check_interval = null;
                }
                Lampa.Modal.close();
            }
        });
    }

    // Poll the activation status
    function pollActivationStatus(pin) {
        var pollCount = 0;
        var maxPolls = 60; // 5 minutes at 5s intervals

        if (auth_check_interval) {
            clearInterval(auth_check_interval);
        }

        auth_check_interval = setInterval(function () {
            pollCount++;
            if (pollCount > maxPolls) {
                clearInterval(auth_check_interval);
                auth_check_interval = null;
                Lampa.Noty.show('Weeb-X: Время ожидания истекло', { time: 5000 });
                Lampa.Modal.close();
                return;
            }

            fetch(WEEBX_API + '/activate?pin=' + pin)
                .then(function (res) { return res.json(); })
                .then(function (data) {
                    if (data.success && data.status === 'authorized' && data.token) {
                        clearInterval(auth_check_interval);
                        auth_check_interval = null;
                        Lampa.Storage.set(STORAGE_KEY, data.token);
                        Lampa.Modal.close();
                        Lampa.Noty.show('Weeb-X: Устройство успешно привязано!', { time: 4000 });
                    }
                })
                .catch(function (err) {
                    console.error('Weeb-X poll error:', err);
                });
        }, 5000);
    }

    // Logout / unlink device
    function logout() {
        Lampa.Storage.remove(STORAGE_KEY);
        Lampa.Noty.show('Weeb-X: Устройство отвязано', { time: 3000 });
    }

    // Send watch progress to Weeb-X
    function sendProgress(card, time, percent, duration) {
        if (!isLoggedIn() || !card) return;

        var now = Date.now();
        if (now - last_sync_time < SYNC_INTERVAL && percent < 95) return;
        last_sync_time = now;

        var token = Lampa.Storage.get(STORAGE_KEY);
        var animeId = card.id || card.shikimori_id || '';
        var title = card.title || card.name || card.russian || 'Unknown';
        var poster = card.poster || card.img || '';

        // Try to get episode info from Lampa player
        var episode = null;
        var episodesTotal = null;
        try {
            var video = Lampa.Player.video();
            if (video && video.episode) episode = video.episode;
            if (card.episodes) episodesTotal = parseInt(card.episodes) || null;
        } catch (e) {}

        // Calculate percent if not provided
        if (!percent && duration && time) {
            percent = Math.round((time / duration) * 100);
        }

        fetch(WEEBX_API + '/sync', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({
                anime_id: String(animeId),
                title: title,
                poster: poster,
                episode: episode,
                episodes_total: episodesTotal,
                time: time || 0,
                percent: percent || 0,
                shikimori_id: card.shikimori_id || null
            })
        }).then(function (res) {
            if (res.status === 401) {
                // Token expired or invalid
                Lampa.Storage.remove(STORAGE_KEY);
                Lampa.Noty.show('Weeb-X: Токен истёк, требуется повторная активация', { time: 5000 });
            }
        }).catch(function (err) {
            console.error('Weeb-X sync error:', err);
        });
    }

    function openSettingsModal() {
        if (isLoggedIn()) {
            Lampa.Modal.open({
                title: 'Weeb-X',
                html: '<div style="text-align:center;padding:30px 20px;">' +
                    '<div style="font-size:16px;color:#4caf50;margin-bottom:20px;">✓ Устройство привязано</div>' +
                    '<div style="font-size:13px;color:#999;margin-bottom:24px;">История просмотра синхронизируется с Weeb-X</div>' +
                    '<div style="background:#333;padding:14px 28px;border-radius:4px;display:inline-block;cursor:pointer;color:#ff5252;font-size:14px;" id="weebx-logout-btn">Отвязать устройство</div>' +
                    '</div>',
                size: 'medium',
                onBack: function () { Lampa.Modal.close(); }
            });

            setTimeout(function () {
                var logoutBtn = document.getElementById('weebx-logout-btn');
                if (logoutBtn) {
                    logoutBtn.addEventListener('click', function () {
                        logout();
                        Lampa.Modal.close();
                    });
                }
            }, 100);
        } else {
            startActivation();
        }
    }

    function init() {
        var settingsAdded = false;

        // 1. Add settings entry - try multiple API patterns
        // Pattern 1: Lampa.Settings.add (modern)
        try {
            if (Lampa.Settings && typeof Lampa.Settings.add === 'function') {
                Lampa.Settings.add({
                    title: 'Weeb-X Синхронизация',
                    type: 'button',
                    icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h20v14H2z"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>',
                    onValue: function () {
                        openSettingsModal();
                    }
                });
                settingsAdded = true;
            }
        } catch (e) {
            console.error('Weeb-X: Settings.add failed:', e);
        }

        // Pattern 2: Settings via params (alternative)
        if (!settingsAdded) {
            try {
                if (Lampa.Settings && typeof Lampa.Settings.params === 'function') {
                    Lampa.Settings.params({
                        weebx_sync: {
                            title: 'Weeb-X Синхронизация',
                            type: 'button',
                            icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h20v14H2z"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>',
                            onValue: function () {
                                openSettingsModal();
                            }
                        }
                    });
                    settingsAdded = true;
                }
            } catch (e) {
                console.error('Weeb-X: Settings.params failed:', e);
            }
        }

        // 2. Track player start
        try {
            Lampa.Player.listener.follow('start', function (e) {
                if (e.movie) {
                    current_card = e.movie;
                    console.log('Weeb-X: Started watching', current_card.title || current_card.name);
                }
            });
        } catch (e) {
            console.error('Weeb-X: Player listener failed:', e);
        }

        // 3. Track watch progress (timeline updates)
        try {
            Lampa.Timeline.listener.follow('update', function (e) {
                if (isLoggedIn() && current_card) {
                    sendProgress(current_card, e.time, e.percent, e.duration);
                }
            });
        } catch (e) {
            console.error('Weeb-X: Timeline listener failed:', e);
        }

        // 4. Track player stop/destroy
        try {
            Lampa.Player.listener.follow('destroy', function () {
                if (isLoggedIn() && current_card) {
                    try {
                        var video = Lampa.Player.video();
                        var time = video ? video.currentTime : 0;
                        var duration = video ? video.duration : 0;
                        var percent = duration ? Math.round((time / duration) * 100) : 0;
                        last_sync_time = 0;
                        sendProgress(current_card, time, percent, duration);
                    } catch (e) {}
                }
                current_card = null;
            });
        } catch (e) {
            console.error('Weeb-X: Player destroy listener failed:', e);
        }

        // 5. Pull history for timeline
        if (isLoggedIn()) {
            fetchHistoryForTimeline();
        }

        console.log('Weeb-X plugin initialized, settings added:', settingsAdded);
    }

    // Fetch history from Weeb-X and mark as watched in Lampa timeline
    function fetchHistoryForTimeline() {
        var token = Lampa.Storage.get(STORAGE_KEY);
        if (!token) return;

        fetch(WEEBX_API + '/history', {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + token
            }
        })
        .then(function (res) { return res.json(); })
        .then(function (data) {
            if (data.success && data.history) {
                data.history.forEach(function (item) {
                    try {
                        // Mark in Lampa's timeline if the API supports it
                        if (Lampa.Timeline && Lampa.Timeline.mark) {
                            Lampa.Timeline.mark({
                                id: item.anime_id,
                                episode: item.episode,
                                percent: 100,
                                time: 0
                            });
                        }
                    } catch (e) {
                        console.error('Weeb-X timeline mark error:', e);
                    }
                });
            }
        })
        .catch(function (err) {
            console.error('Weeb-X history fetch error:', err);
        });
    }

    // === REGISTRATION: Try multiple patterns for different Lampa versions ===

    // Pattern A: Modern Lampa.Plugins.install (Lampa 3.0+)
    try {
        if (Lampa.Plugins && typeof Lampa.Plugins.install === 'function') {
            var WeebXPlugin = {
                name: 'Weeb-X Синхронизация',
                version: '1.0.0',
                init: init
            };
            Lampa.Plugins.install(WeebXPlugin);
            console.log('Weeb-X: Registered via Lampa.Plugins.install');
            return;
        }
    } catch (e) {
        console.error('Weeb-X: Plugins.install failed:', e);
    }

    // Pattern B: window.appready check (older Lampa)
    if (typeof window.appready !== 'undefined' && window.appready) {
        init();
    } else {
        // Pattern C: Listen for app ready event
        try {
            Lampa.Listener.follow('app', function (e) {
                if (e.type === 'ready') {
                    init();
                }
            });
        } catch (e) {
            // Pattern D: Fallback - try after delay
            console.error('Weeb-X: Listener.follow failed, using timeout fallback:', e);
            setTimeout(function () {
                if (typeof Lampa !== 'undefined' && Lampa.Player) {
                    init();
                } else {
                    console.error('Weeb-X: Lampa not available after timeout');
                }
            }, 3000);
        }
    }
})();
