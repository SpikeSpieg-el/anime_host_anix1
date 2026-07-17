/**
 * Weeb-X Plugin for Lampa
 * 
 * Bidirectional sync of watch history and bookmarks between Lampa (Android TV) and Weeb-X.com
 * 
 * Installation:
 *   In Lampa, go to Settings → Plugins → Add
 *   URL: https://weeb-x.com/lampa/weebx-plugin.js
 * 
 * Activation:
 *   1. Plugin will display a 6-digit PIN code on your TV
 *   2. Go to https://weeb-x.com/activate on your phone/PC
 *   3. Log in to your Weeb-X account and enter the PIN
 *   4. Device is now linked - history and bookmarks sync automatically
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
    var is_syncing = false;

    var ICON_SVG = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" xmlns="http://www.w3.org/2000/svg"><path d="M2 3h20v14H2z"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>';

    function log() {
        var args = Array.prototype.slice.call(arguments);
        args.unshift('[Weeb-X]');
        console.log.apply(console, args);
    }

    function logError() {
        var args = Array.prototype.slice.call(arguments);
        args.unshift('[Weeb-X ERROR]');
        console.error.apply(console, args);
    }

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

    function getToken() {
        return Lampa.Storage.get(STORAGE_KEY);
    }

    function authHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + getToken()
        };
    }

    function updateAuthLabel() {
        var label = isLoggedIn() ? 'Привязано' : 'Авторизоваться';
        $('div[data-name="weebx_auth"]').find('.settings-param__name').text(label);
    }

    // ================================================================
    // ACTIVATION
    // ================================================================

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
            logError('activation error:', err);
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
                    // Do full bidirectional sync after activation
                    fullSync();
                }
            }, function (err) {
                logError('poll error:', err);
            }, false, { type: 'get' });
        }, 5000);
    }

    function logout() {
        Lampa.Storage.remove(STORAGE_KEY);
        Lampa.Noty.show('Weeb-X: Устройство отвязано', { time: 3000 });
        updateAuthLabel();
    }

    // ================================================================
    // PROGRESS SYNC (Lampa → Website)
    // ================================================================

    function sendProgress(card, time, percent, duration) {
        if (!isLoggedIn() || !card) return;

        var now = Date.now();
        if (now - last_sync_time < SYNC_INTERVAL && percent < 95) return;
        last_sync_time = now;

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

        log('Sending progress:', title, 'ep:' + episode, percent + '%');

        network.silent(WEEBX_API + '/sync', function (data) {
            log('Progress synced successfully:', title);
        }, function (err) {
            logError('sync error:', err);
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
            headers: authHeaders()
        });
    }

    // ================================================================
    // HISTORY SYNC (Website → Lampa Timeline)
    // ================================================================

    function pullHistoryFromWebsite() {
        if (!isLoggedIn()) return Promise.resolve([]);

        return new Promise(function (resolve) {
            log('Pulling history from website...');

            network.silent(WEEBX_API + '/history', function (data) {
                if (data.success && data.history && data.history.length > 0) {
                    log('Received ' + data.history.length + ' history items from website');

                    data.history.forEach(function (item) {
                        try {
                            var cardData = {
                                id: item.anime_id,
                                title: item.title,
                                name: item.title,
                                poster: item.poster,
                                img: item.poster,
                                type: 'anime'
                            };

                            // Add to Lampa native history category so it shows "watched" icon/checkmark
                            if (Lampa.Favorite && Lampa.Favorite.add && Lampa.Favorite.check) {
                                var favStatus = Lampa.Favorite.check(cardData);
                                if (!favStatus.history) {
                                    Lampa.Favorite.add('history', cardData);
                                }
                            }

                            // Update Lampa timeline progress using all possible hashes so it renders beautifully on cards
                            if (Lampa.Timeline && Lampa.Timeline.update) {
                                var percent = 100;
                                var time = 0;
                                var duration = 0;

                                // 1. Hash of Anime ID (standard for some plugins)
                                Lampa.Timeline.update({
                                    hash: Lampa.Utils.hash(String(item.anime_id)),
                                    percent: percent,
                                    time: time,
                                    duration: duration,
                                    received: true
                                });

                                // 2. Hash of Anime Title
                                Lampa.Timeline.update({
                                    hash: Lampa.Utils.hash(item.title),
                                    percent: percent,
                                    time: time,
                                    duration: duration,
                                    received: true
                                });

                                // 3. Season & Episode hash (Lampa standard for serials)
                                if (item.episode) {
                                    Lampa.Timeline.update({
                                        hash: Lampa.Utils.hash(['1', item.episode, item.title].join('')),
                                        percent: percent,
                                        time: time,
                                        duration: duration,
                                        received: true
                                    });
                                }
                            }
                        } catch (e) {
                            logError('timeline mark error:', e);
                        }
                    });

                    resolve(data.history);
                } else {
                    log('No history items from website');
                    resolve([]);
                }
            }, function (err) {
                logError('history fetch error:', err);
                resolve([]);
            }, false, {
                type: 'get',
                headers: authHeaders()
            });
        });
    }

    // ================================================================
    // BOOKMARK SYNC: Website → Lampa
    // ================================================================

    function pullBookmarksFromWebsite() {
        if (!isLoggedIn()) return Promise.resolve(0);

        return new Promise(function (resolve) {
            log('Pulling bookmarks from website...');

            network.silent(WEEBX_API + '/bookmarks', function (data) {
                if (data.success && data.bookmarks && data.bookmarks.length > 0) {
                    log('Received ' + data.bookmarks.length + ' bookmarks from website');

                    var added = 0;
                    data.bookmarks.forEach(function (item) {
                        try {
                            var cardData = {
                                id: item.anime_id,
                                title: item.title || (item.anime_data ? item.anime_data.title : 'Unknown'),
                                name: item.title || (item.anime_data ? item.anime_data.title : 'Unknown'),
                                poster: item.poster || (item.anime_data ? item.anime_data.poster : ''),
                                img: item.poster || (item.anime_data ? item.anime_data.poster : ''),
                                type: 'anime'
                            };

                            // Add to Lampa favorites if not already there
                            if (Lampa.Favorite && Lampa.Favorite.add && Lampa.Favorite.check) {
                                var favStatus = Lampa.Favorite.check(cardData);
                                if (!favStatus.like) {
                                    Lampa.Favorite.add('like', cardData);
                                    added++;
                                }
                            }
                        } catch (e) {
                            logError('bookmark add error:', e);
                        }
                    });

                    log('Added ' + added + ' bookmarks to Lampa favorites');
                    resolve(added);
                } else {
                    log('No bookmarks from website');
                    resolve(0);
                }
            }, function (err) {
                logError('bookmarks fetch error:', err);
                resolve(0);
            }, false, {
                type: 'get',
                headers: authHeaders()
            });
        });
    }

    // ================================================================
    // BOOKMARK SYNC: Lampa → Website
    // ================================================================

    function pushLampaBookmarksToWebsite() {
        if (!isLoggedIn()) return Promise.resolve(0);

        return new Promise(function (resolve) {
            log('Pushing Lampa bookmarks to website...');

            var lampaFavorites = [];
            try {
                if (Lampa.Favorite && Lampa.Favorite.get) {
                    lampaFavorites = Lampa.Favorite.get({ type: 'like' }) || [];
                }
            } catch (e) {
                logError('Failed to get Lampa favorites:', e);
            }

            if (lampaFavorites.length === 0) {
                log('No Lampa bookmarks to push');
                resolve(0);
                return;
            }

            log('Found ' + lampaFavorites.length + ' Lampa bookmarks to push');
            var pushed = 0;
            var remaining = lampaFavorites.length;

            lampaFavorites.forEach(function (card) {
                var animeId = card.id || card.shikimori_id || '';
                var title = card.title || card.name || card.russian || 'Unknown';
                var poster = card.poster || card.img || '';
                var episodesTotal = null;
                try { if (card.episodes) episodesTotal = parseInt(card.episodes) || null; } catch (e) {}

                network.silent(WEEBX_API + '/bookmarks', function (data) {
                    pushed++;
                    remaining--;
                    if (remaining === 0) {
                        log('Pushed ' + pushed + ' bookmarks to website');
                        resolve(pushed);
                    }
                }, function (err) {
                    logError('bookmark push error for ' + title + ':', err);
                    remaining--;
                    if (remaining === 0) {
                        log('Pushed ' + pushed + ' bookmarks to website (with errors)');
                        resolve(pushed);
                    }
                }, {
                    anime_id: String(animeId),
                    title: title,
                    poster: poster,
                    episodes_total: episodesTotal,
                    shikimori_id: card.shikimori_id || null
                }, {
                    type: 'post',
                    headers: authHeaders()
                });
            });
        });
    }

    // ================================================================
    // FULL BIDIRECTIONAL SYNC
    // ================================================================

    function fullSync() {
        if (!isLoggedIn()) {
            Lampa.Noty.show('Weeb-X: Сначала авторизуйтесь', { time: 3000 });
            return;
        }
        if (is_syncing) {
            Lampa.Noty.show('Weeb-X: Синхронизация уже идёт...', { time: 3000 });
            return;
        }

        is_syncing = true;
        Lampa.Noty.show('Weeb-X: Полная синхронизация...', { time: 3000 });
        log('=== Starting full bidirectional sync ===');

        var historyCount = 0, bookmarksPulled = 0, bookmarksPushed = 0;

        // Step 1: Pull history from website → mark in Lampa timeline
        pullHistoryFromWebsite().then(function (history) {
            historyCount = history.length;

            // Step 2: Pull bookmarks from website → add to Lampa favorites
            return pullBookmarksFromWebsite();
        }).then(function (pulled) {
            bookmarksPulled = pulled;

            // Step 3: Push Lampa bookmarks → website
            return pushLampaBookmarksToWebsite();
        }).then(function (pushed) {
            bookmarksPushed = pushed;

            is_syncing = false;
            var msg = 'Weeb-X: Синхронизация завершена! История: ' + historyCount +
                ', Закладки получено: ' + bookmarksPulled +
                ', отправлено: ' + bookmarksPushed;
            log('=== ' + msg + ' ===');
            Lampa.Noty.show(msg, { time: 6000 });
        }).catch(function (err) {
            is_syncing = false;
            logError('Full sync error:', err);
            Lampa.Noty.show('Weeb-X: Ошибка синхронизации', { time: 5000 });
        });
    }

    // ================================================================
    // SINGLE BOOKMARK SYNC (real-time, when user adds/removes in Lampa)
    // ================================================================

    function sendBookmarkToWebsite(card) {
        if (!isLoggedIn() || !card) return;

        var animeId = card.id || card.shikimori_id || '';
        var title = card.title || card.name || card.russian || 'Unknown';
        var poster = card.poster || card.img || '';
        var episodesTotal = null;
        try { if (card.episodes) episodesTotal = parseInt(card.episodes) || null; } catch (e) {}

        log('Sending bookmark to website:', title);

        network.silent(WEEBX_API + '/bookmarks', function (data) {
            log('Bookmark saved to website:', title);
        }, function (err) {
            logError('bookmark send error:', err);
        }, {
            anime_id: String(animeId),
            title: title,
            poster: poster,
            episodes_total: episodesTotal,
            shikimori_id: card.shikimori_id || null
        }, {
            type: 'post',
            headers: authHeaders()
        });
    }

    function removeBookmarkFromWebsite(card) {
        if (!isLoggedIn() || !card) return;

        var animeId = String(card.id || card.shikimori_id || '');
        if (!animeId) return;

        log('Removing bookmark from website:', card.title || card.name);

        network.silent(WEEBX_API + '/bookmarks?anime_id=' + encodeURIComponent(animeId), function (data) {
            log('Bookmark removed from website:', card.title || card.name);
        }, function (err) {
            logError('bookmark remove error:', err);
        }, false, {
            type: 'delete',
            headers: authHeaders()
        });
    }

    // ================================================================
    // PLUGIN START
    // ================================================================

    function startPlugin() {
        var manifest = {
            type: 'video',
            version: '2.0.0',
            name: 'Weeb-X',
            description: 'Двусторонняя синхронизация истории и закладок с Weeb-X.com',
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
            param: { type: 'title' },
            field: { name: 'Аккаунт' }
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
                            if (a.confirm) logout();
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
            param: { type: 'title' },
            field: { name: 'Синхронизация' }
        });

        Lampa.SettingsApi.addParam({
            component: 'weebx',
            param: {
                type: 'button',
                name: 'weebx_sync_now'
            },
            field: {
                name: 'Полная синхронизация',
                description: 'Двусторонняя синхронизация: история + закладки (Lampa ↔ Weeb-X)'
            },
            onChange: function () {
                fullSync();
                Lampa.Controller.toggle('settings_component');
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'weebx',
            param: {
                type: 'button',
                name: 'weebx_pull_history'
            },
            field: {
                name: 'Загрузить историю с сайта',
                description: 'Получить историю просмотра с Weeb-X и отметить в Lampa'
            },
            onChange: function () {
                if (isLoggedIn()) {
                    pullHistoryFromWebsite().then(function (count) {
                        Lampa.Noty.show('Weeb-X: Получено ' + count.length + ' записей истории', { time: 4000 });
                    });
                } else {
                    Lampa.Noty.show('Weeb-X: Сначала авторизуйтесь', { time: 3000 });
                }
                Lampa.Controller.toggle('settings_component');
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'weebx',
            param: {
                type: 'button',
                name: 'weebx_pull_bookmarks'
            },
            field: {
                name: 'Загрузить закладки с сайта',
                description: 'Получить закладки с Weeb-X и добавить в Lampa'
            },
            onChange: function () {
                if (isLoggedIn()) {
                    pullBookmarksFromWebsite().then(function (count) {
                        Lampa.Noty.show('Weeb-X: Добавлено ' + count + ' закладок', { time: 4000 });
                    });
                } else {
                    Lampa.Noty.show('Weeb-X: Сначала авторизуйтесь', { time: 3000 });
                }
                Lampa.Controller.toggle('settings_component');
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'weebx',
            param: {
                type: 'button',
                name: 'weebx_push_bookmarks'
            },
            field: {
                name: 'Отправить закладки на сайт',
                description: 'Загрузить закладки из Lampa на Weeb-X'
            },
            onChange: function () {
                if (isLoggedIn()) {
                    pushLampaBookmarksToWebsite().then(function (count) {
                        Lampa.Noty.show('Weeb-X: Отправлено ' + count + ' закладок', { time: 4000 });
                    });
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
                description: 'Автоматически отправлять прогресс просмотра и закладки на Weeb-X'
            }
        });

        // === Player listeners (progress sync) ===
        Lampa.Player.listener.follow('start', function (e) {
            if (e.movie) {
                current_card = e.movie;
                log('Started watching:', current_card.title || current_card.name);
            }
        });

        Lampa.Timeline.listener.follow('update', function (e) {
            if (isLoggedIn() && current_card && e.data) {
                var autoSync = Lampa.Storage.get('weebx_auto_sync', true);
                if (autoSync !== false) {
                    sendProgress(current_card, e.data.time, e.data.percent, e.data.duration);
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

        // === Favorite/Bookmark listeners (real-time bookmark sync) ===
        if (Lampa.Favorite && Lampa.Favorite.listener) {
            Lampa.Favorite.listener.follow(function (e) {
                if (!isLoggedIn() || !e.data || !e.data.card) return;

                var autoSync = Lampa.Storage.get('weebx_auto_sync', true);
                if (autoSync === false) return;

                var card = e.data.card;

                if (e.type === 'add' && e.data.where === 'like') {
                    log('Favorite added in Lampa:', card.title || card.name);
                    sendBookmarkToWebsite(card);
                } else if (e.type === 'remove' && e.data.where === 'like') {
                    log('Favorite removed in Lampa:', card.title || card.name);
                    removeBookmarkFromWebsite(card);
                }
            });
        } else {
            log('Lampa.Favorite.listener not available - real-time bookmark sync disabled');
        }

        // Initial full sync on plugin start if logged in
        if (isLoggedIn()) {
            log('Logged in, performing initial sync...');
            setTimeout(function () {
                pullHistoryFromWebsite();
                pullBookmarksFromWebsite();
            }, 2000);
        }

        log('Plugin v2.0.0 started');
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
