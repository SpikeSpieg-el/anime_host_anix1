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
    var SYNC_INTERVAL = 30000;
    var auth_check_interval = null;
    var network = new Lampa.Reguest();

    var ICON_SVG = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" xmlns="http://www.w3.org/2000/svg"><path d="M2 3h20v14H2z"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>';

    function getDeviceId() {
        var deviceId = Lampa.Storage.get(STORAGE_DEVICE);
        if (!deviceId) {
            deviceId = 'lampa_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            Lampa.Storage.set(STORAGE_DEVICE, deviceId);
        }
        return deviceId;
    }

    function isLoggedIn() {
        return !!Lampa.Storage.get(STORAGE_KEY);
    }

    function updateAuthLabel() {
        var label = isLoggedIn() ? 'Привязано' : 'Авторизоваться';
        $('div[data-name="weebx_auth"]').find('.settings-param__name').text(label);
    }

    function startActivation() {
        var deviceId = getDeviceId();

        network.clear();
        network.timeout(15000);

        network.silent(WEEBX_API + '/activate', function (data) {
            if (data.success) {
                showActivationModal(data.pin, data.expires_at);
                pollActivationStatus(data.pin);
            } else {
                Lampa.Noty.show('Weeb-X: Ошибка получения PIN кода', { time: 5000 });
            }
        }, function (err) {
            console.error('Weeb-X activation error:', err);
            Lampa.Noty.show('Weeb-X: Сетевая ошибка активации', { time: 5000 });
        }, {
            device_id: deviceId,
            device_name: 'Lampa/' + (navigator.userAgent || 'Android TV')
        }, {
            type: 'post',
            headers: { 'Content-Type': 'application/json' }
        });
    }

    function showActivationModal(pin, expiresAt) {
        var html = $('<div style="text-align:center;padding:20px;">' +
            '<div style="font-size:14px;color:#ccc;margin-bottom:16px;">Weeb-X Синхронизация</div>' +
            '<div style="font-size:12px;color:#999;margin-bottom:20px;">Перейдите на сайт и введите код:</div>' +
            '<div style="font-size:48px;font-weight:bold;letter-spacing:8px;color:#ff6b00;margin:20px 0;">' + pin + '</div>' +
            '<div style="font-size:14px;color:#ccc;margin-bottom:8px;">Сайт активации:</div>' +
            '<div style="font-size:18px;color:#4fc3f7;margin-bottom:20px;">weeb-x.com/activate</div>' +
            '<div style="font-size:11px;color:#666;">Код действителен 10 минут</div>' +
            '</div>');

        Lampa.Modal.open({
            title: '',
            html: html,
            align: 'center',
            onBack: function () {
                if (auth_check_interval) {
                    clearInterval(auth_check_interval);
                    auth_check_interval = null;
                }
                Lampa.Modal.close();
                Lampa.Controller.toggle('settings_component');
            }
        });
    }

    function pollActivationStatus(pin) {
        var pollCount = 0;
        var maxPolls = 60;

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
                Lampa.Controller.toggle('settings_component');
                return;
            }

            network.silent(WEEBX_API + '/activate?pin=' + pin, function (data) {
                if (data.success && data.status === 'authorized' && data.token) {
                    clearInterval(auth_check_interval);
                    auth_check_interval = null;
                    Lampa.Storage.set(STORAGE_KEY, data.token);
                    Lampa.Modal.close();
                    Lampa.Noty.show('Weeb-X: Устройство успешно привязано!', { time: 4000 });
                    updateAuthLabel();
                    Lampa.Controller.toggle('settings_component');
                    fetchHistoryForTimeline();
                }
            }, function (err) {
                console.error('Weeb-X poll error:', err);
            }, false, { type: 'get' });
        }, 5000);
    }

    function logout() {
        Lampa.Storage.remove(STORAGE_KEY);
        Lampa.Noty.show('Weeb-X: Устройство отвязано', { time: 3000 });
        updateAuthLabel();
    }

    function sendProgress(card, time, percent, duration) {
        if (!isLoggedIn() || !card) return;

        var now = Date.now();
        if (now - last_sync_time < SYNC_INTERVAL && percent < 95) return;
        last_sync_time = now;

        var token = Lampa.Storage.get(STORAGE_KEY);
        var animeId = card.id || card.shikimori_id || '';
        var title = card.title || card.name || card.russian || 'Unknown';
        var poster = card.poster || card.img || '';

        var episode = null;
        var episodesTotal = null;
        try {
            var video = Lampa.Player.video();
            if (video && video.episode) episode = video.episode;
            if (card.episodes) episodesTotal = parseInt(card.episodes) || null;
        } catch (e) {}

        if (!percent && duration && time) {
            percent = Math.round((time / duration) * 100);
        }

        network.silent(WEEBX_API + '/sync', function (data) {
            // success - no action needed
        }, function (err) {
            console.error('Weeb-X sync error:', err);
            if (err && err.status === 401) {
                Lampa.Storage.remove(STORAGE_KEY);
                Lampa.Noty.show('Weeb-X: Токен истёк, требуется повторная активация', { time: 5000 });
            }
        }, {
            anime_id: String(animeId),
            title: title,
            poster: poster,
            episode: episode,
            episodes_total: episodesTotal,
            time: time || 0,
            percent: percent || 0,
            shikimori_id: card.shikimori_id || null
        }, {
            type: 'post',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            }
        });
    }

    function fetchHistoryForTimeline() {
        var token = Lampa.Storage.get(STORAGE_KEY);
        if (!token) return;

        network.silent(WEEBX_API + '/history', function (data) {
            if (data.success && data.history) {
                data.history.forEach(function (item) {
                    try {
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
        }, function (err) {
            console.error('Weeb-X history fetch error:', err);
        }, false, {
            type: 'get',
            headers: { 'Authorization': 'Bearer ' + token }
        });
    }

    function startPlugin() {
        var manifest = {
            type: 'video',
            version: '1.0.0',
            name: 'Weeb-X',
            description: 'Синхронизация истории просмотра с Weeb-X.com',
            component: 'weebx'
        };

        Lampa.Manifest.plugins = manifest;

        // === Settings ===
        if (!window.lampa_settings.weebx) {
            Lampa.SettingsApi.addComponent({
                component: 'weebx',
                icon: ICON_SVG,
                name: 'Weeb-X'
            });
        }

        // Section: Account
        Lampa.SettingsApi.addParam({
            component: 'weebx',
            param: {
                type: 'title'
            },
            field: {
                name: 'Аккаунт'
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'weebx',
            param: {
                type: 'button',
                name: 'weebx_auth'
            },
            field: {
                name: isLoggedIn() ? 'Привязано' : 'Авторизоваться',
                description: 'Привязка устройства к аккаунту Weeb-X через PIN код'
            },
            onChange: function () {
                if (isLoggedIn()) {
                    Lampa.Select.show({
                        title: 'Отвязать устройство?',
                        items: [
                            { title: 'Да', confirm: true },
                            { title: 'Нет' }
                        ],
                        onSelect: function (a) {
                            if (a.confirm) {
                                logout();
                            }
                            Lampa.Controller.toggle('settings_component');
                        },
                        onBack: function () {
                            Lampa.Controller.toggle('settings_component');
                        }
                    });
                } else {
                    Lampa.Controller.toContent();
                    startActivation();
                }
            }
        });

        // Section: Sync
        Lampa.SettingsApi.addParam({
            component: 'weebx',
            param: {
                type: 'title'
            },
            field: {
                name: 'Синхронизация'
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'weebx',
            param: {
                type: 'button',
                name: 'weebx_sync_now'
            },
            field: {
                name: 'Синхронизировать сейчас',
                description: 'Загрузить историю просмотра с Weeb-X'
            },
            onChange: function () {
                if (isLoggedIn()) {
                    fetchHistoryForTimeline();
                    Lampa.Noty.show('Weeb-X: Синхронизация запущена', { time: 3000 });
                } else {
                    Lampa.Noty.show('Weeb-X: Сначала авторизуйтесь', { time: 3000 });
                }
                Lampa.Controller.toggle('settings_component');
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'weebx',
            param: {
                name: 'weebx_auto_sync',
                type: 'trigger',
                default: true
            },
            field: {
                name: 'Автосинхронизация',
                description: 'Автоматически отправлять прогресс просмотра на Weeb-X'
            }
        });

        // === Player listeners ===
        Lampa.Player.listener.follow('start', function (e) {
            if (e.movie) {
                current_card = e.movie;
                console.log('Weeb-X: Started watching', current_card.title || current_card.name);
            }
        });

        Lampa.Timeline.listener.follow('update', function (e) {
            if (isLoggedIn() && current_card) {
                var autoSync = Lampa.Storage.get('weebx_auto_sync', true);
                if (autoSync !== false) {
                    sendProgress(current_card, e.time, e.percent, e.duration);
                }
            }
        });

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

        // Initial history pull
        if (isLoggedIn()) {
            fetchHistoryForTimeline();
        }

        console.log('Weeb-X plugin started');
    }

    if (!window.weebx_ready) {
        window.weebx_ready = true;

        if (window.appready) {
            startPlugin();
        } else {
            Lampa.Listener.follow('app', function (e) {
                if (e.type === 'ready') {
                    startPlugin();
                }
            });
        }
    }
})();
