/*
 * GEN DINO mobile shell
 * This layer keeps the original runner intact and adds a local, virtual-coin
 * arcade experience around it. No payments or real-money wagering are used.
 */
(function () {
    'use strict';

    var STORAGE_KEY = 'gen-dino-mobile-profile-v1';
    var searchParams = new URLSearchParams(window.location.search);
    var urlToken = searchParams.get('token') || '';
    var urlRefParam = searchParams.get('ref') || searchParams.get('refCode') || searchParams.get('r') || '';
    if (urlRefParam) {
        try {
            window.localStorage.setItem('dino_ref_code', urlRefParam.trim().toUpperCase());
            window.localStorage.setItem('alliance_ref_code', urlRefParam.trim().toUpperCase());
        } catch (_) {}
    }
    var AUTH_TOKEN_KEY = 'pg_auth_token';
    var rejectedTokens = {};

    function isTokenExpired(t) {
        if (!t || typeof t !== 'string') return true;
        try {
            var parts = t.split('.');
            if (parts.length !== 3) return false;
            var payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
            if (payload && typeof payload.exp === 'number') {
                return Date.now() >= (payload.exp * 1000 - 15000);
            }
            return false;
        } catch (_) {
            return false;
        }
    }

    function getStoredToken() {
        var candidate = urlToken ||
            window.localStorage.getItem(AUTH_TOKEN_KEY) ||
            window.localStorage.getItem('paygateway_token') ||
            window.localStorage.getItem('token') ||
            window.sessionStorage.getItem(AUTH_TOKEN_KEY) ||
            window.sessionStorage.getItem('paygateway_token') ||
            window.sessionStorage.getItem('token') || '';

        if (candidate && (rejectedTokens[candidate] || isTokenExpired(candidate))) {
            try {
                if (urlToken === candidate) urlToken = '';
                window.localStorage.removeItem(AUTH_TOKEN_KEY);
                window.localStorage.removeItem('paygateway_token');
                window.localStorage.removeItem('token');
                window.sessionStorage.removeItem(AUTH_TOKEN_KEY);
            } catch (_) {}
            return '';
        }
        return candidate;
    }

    var authSyncState = {
        syncPromise: null,
        lastSyncTimestamp: 0,
        lastSyncedToken: '',
        currentSyncingToken: ''
    };

    if (urlToken && !isTokenExpired(urlToken)) {
        try {
            window.localStorage.setItem(AUTH_TOKEN_KEY, urlToken);
        } catch (e) {}
    }
    var IS_EMBEDDED = searchParams.get('embedded') === '1' || Boolean(urlToken) || window.parent !== window;
    var BASE_COIN_VALUE_CENTS = 100;
    var WITHDRAW_MIN_CENTS = 10000;
    var DEPOSIT_MIN_CENTS = 2000;
    var BET_MIN_CENTS = 100;
    var formatter = new Intl.NumberFormat('pt-BR');
    var currencyFormatter = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
    var profileDateFormatter = new Intl.DateTimeFormat('pt-BR', {
        month: 'short',
        year: '2-digit'
    });
    var state = {
        authMode: 'login',
        currentScreen: 'auth',
        profile: null,
        runner: null,
        runCoins: 0,
        runWinnings: 0,
        cashoutSettled: false,
        betCents: 500,
        currentBetCents: 0,
        lastBetCents: 0,
        depositCents: 2000,
        withdrawCents: WITHDRAW_MIN_CENTS,
        currentScore: 0,
        lastRewardMilestone: 0,
        resultShown: false,
        gamePatched: false,
        trackCoins: [],
        trackLastFrame: 0,
        nextCoinSpawnAt: 0,
        pendingLeaveDestination: 'home',
        resumeAfterLeaveDialog: false,
        returnToPauseAfterLeaveDialog: false,
        betModalReturnToResult: false,
        currentBetId: '',
        settling: false,
        activePixCorrelationId: '',
        activePixExpiresAt: 0,
        pixPollInterval: null,
        pixCountdownInterval: null,
        pixPaying: false,
        gameConfig: null,
        profileMode: 'player',
        influencerStats: null
    };

    function getDynamicGameModifiers() {
        var cfg = state.gameConfig || {};
        var isInfluencer = Boolean((state.profile && state.profile.isInfluencer) || (cfg && cfg.isInfluencer) || (cfg && cfg.influencerGlobalBoost));

        // Influencer Account Physics: Relaxed speed, minimal obstacles, large reaction window, generous coins
        if (isInfluencer) {
            return {
                speed: 4.5,
                maxSpeed: 7.0,
                acceleration: 0.00015,
                obstacleMultiplier: 0.45,
                gapCoefficient: 1.6,
                coinIntervalMs: 600,
                isCritical: false,
                isMaxWall: false,
                isInfluencer: true,
                totalProjected: 0
            };
        }

        // Emergency Retention Mode Check
        if (cfg.emergencyRetentionMode) {
            return {
                speed: 18.0,
                maxSpeed: 30.0,
                acceleration: 0.008,
                obstacleMultiplier: 6.0,
                gapCoefficient: 0.15,
                coinIntervalMs: 999999,
                isCritical: true,
                isMaxWall: true,
                isInfluencer: false,
                totalProjected: 999
            };
        }

        var baseObstacleMult = Math.max(0.5, Math.min(6.0, Number(cfg.obstacleMultiplier || 1.0)));
        var baseSpeed = Math.max(3.0, Math.min(30.0, Number(cfg.baseSpeed || 6.0)));
        var maxSpeed = Math.max(5.0, Math.min(50.0, Number(cfg.maxSpeed || 13.0)));
        var accel = Math.max(0.0001, Math.min(0.05, Number(cfg.acceleration || 0.001)));
        var reactionWindowMs = Math.max(50, Math.min(3000, Number(cfg.reactionWindowMs || 850)));
        var reactionFactor = Math.max(0.15, Math.min(3.5, reactionWindowMs / 850.0));
        var gameSpeedPercent = Number(cfg.gameSpeedPercent || 100);
        var speedPercentFactor = Math.max(0.3, Math.min(3.0, gameSpeedPercent / 100.0));
        var obstacleDensityPercent = Number(cfg.obstacleDensityPercent || 50);
        var densityFactor = Math.max(0.2, Math.min(3.0, obstacleDensityPercent / 50.0));

        var smartRtp = cfg.smartRtp !== false;
        var maxTarget = Number(cfg.smartRtpMaxTarget || 100.0);
        var hardThreshold = Number(cfg.smartRtpHardThreshold || 85.0);
        var midThreshold = Number(cfg.smartRtpMidThreshold || 60.0);
        var easyThreshold = Number(cfg.smartRtpEasyThreshold || 30.0);
        var rtpPercent = typeof cfg.rtpPercent === 'number' ? cfg.rtpPercent : 85.0;

        // Calculate player live cash + live run earnings (in BRL) with ultra precision
        var currentCash = ((state.profile && state.profile.cashBalance) || 0) / 100;
        var liveEarnings = (state.runCoins || 0) * 1.0;
        var currentBet = (state.currentBetCents || 0) / 100;
        var totalProjected = currentCash + liveEarnings;
        var effectiveMetric = Math.max(liveEarnings, totalProjected, liveEarnings + currentBet);

        var speedScale = 1.0;
        var obstacleMult = baseObstacleMult * densityFactor;
        var gapFactor = 1.0;
        var coinInterval = 1400;
        var maxObstacleLength = 2;

        // RTP Base Tier Modifiers
        if (rtpPercent >= 98.0) {
            // Ultra Fácil / Demo (98.5%)
            speedScale = 0.85;
            obstacleMult = Math.min(obstacleMult, 0.6);
            gapFactor = 1.4;
            coinInterval = 800;
            maxObstacleLength = 1;
        } else if (rtpPercent >= 94.0) {
            // Fácil / Promo (95%)
            speedScale = 0.92;
            obstacleMult = Math.min(obstacleMult, 0.8);
            gapFactor = 1.2;
            coinInterval = 1000;
            maxObstacleLength = 1;
        } else if (rtpPercent >= 80.0) {
            // Equilibrado / iGaming Standard (85-88%)
            speedScale = 1.0;
            gapFactor = 1.0;
            coinInterval = 1400;
            maxObstacleLength = 2;
        } else if (rtpPercent >= 65.0) {
            // Moderado (70%)
            speedScale = 1.1;
            obstacleMult = Math.max(obstacleMult, 1.25);
            gapFactor = 0.9;
            coinInterval = 1600;
            maxObstacleLength = 2;
        } else if (rtpPercent >= 40.0) {
            // Difícil (45%)
            speedScale = 1.25;
            obstacleMult = Math.max(obstacleMult, 1.8);
            gapFactor = 0.75;
            coinInterval = 2000;
            maxObstacleLength = 3;
        } else if (rtpPercent >= 15.0) {
            // Pesado (20%)
            speedScale = 1.45;
            obstacleMult = Math.max(obstacleMult, 2.5);
            gapFactor = 0.55;
            coinInterval = 2600;
            maxObstacleLength = 4;
        } else if (rtpPercent >= 1.0) {
            // Extremo (5%)
            speedScale = 1.75;
            obstacleMult = Math.max(obstacleMult, 4.0);
            gapFactor = 0.35;
            coinInterval = 4000;
            maxObstacleLength = 5;
        } else {
            // Impossível (0.1%)
            speedScale = 2.4;
            obstacleMult = Math.max(obstacleMult, 6.0);
            gapFactor = 0.18;
            coinInterval = 999999;
            maxObstacleLength = 6;
        }

        // Dynamic Ultra-Precise Smart RTP Escalation:
        // Allows smooth climbing towards R$ 100, but ramps up exponential difficulty the closer the player gets to R$ 100.
        if (smartRtp) {
            if (effectiveMetric >= maxTarget) {
                // At or exceeding R$ 100: Absolute Retention Wall (100% retention check)
                speedScale = Math.max(speedScale, 3.4);
                obstacleMult = Math.max(obstacleMult, 7.5);
                gapFactor = 0.12;
                coinInterval = 999999;
                maxObstacleLength = 6;
            } else if (effectiveMetric >= hardThreshold) {
                // Critical Near-100 Zone (R$ 85 to R$ 99.99)
                var progress = (effectiveMetric - hardThreshold) / Math.max(1, maxTarget - hardThreshold);
                var expFactor = Math.pow(progress, 1.5);

                if (effectiveMetric >= 97.0) {
                    // Ultra-Impossibility Horizon (R$ 97.00 - R$ 99.99)
                    var subRatio = (effectiveMetric - 97.0) / 3.0;
                    speedScale = Math.max(speedScale, 2.7 + subRatio * 0.6);
                    obstacleMult = Math.max(obstacleMult, 5.2 + subRatio * 2.0);
                    gapFactor = Math.min(gapFactor, Math.max(0.14, 0.20 - subRatio * 0.06));
                    coinInterval = Math.max(coinInterval, 12000 + subRatio * 20000);
                    maxObstacleLength = 5;
                } else if (effectiveMetric >= 92.0) {
                    // High-Tension Near-Miss Zone (R$ 92.00 - R$ 97.00)
                    var subRatio = (effectiveMetric - 92.0) / 5.0;
                    speedScale = Math.max(speedScale, 2.1 + subRatio * 0.6);
                    obstacleMult = Math.max(obstacleMult, 3.8 + subRatio * 1.4);
                    gapFactor = Math.min(gapFactor, Math.max(0.20, 0.32 - subRatio * 0.12));
                    coinInterval = Math.max(coinInterval, 6000 + subRatio * 6000);
                    maxObstacleLength = 4;
                } else {
                    // R$ 85.00 to R$ 92.00
                    speedScale = Math.max(speedScale, 1.55 + expFactor * 0.55);
                    obstacleMult = Math.max(obstacleMult, 2.6 + expFactor * 1.2);
                    gapFactor = Math.min(gapFactor, Math.max(0.30, 0.55 - expFactor * 0.25));
                    coinInterval = Math.max(coinInterval, 3000 + expFactor * 3000);
                    maxObstacleLength = 3;
                }
            } else if (effectiveMetric >= midThreshold) {
                // Warning Zone (R$ 60 - R$ 85)
                var midRatio = (effectiveMetric - midThreshold) / Math.max(1, hardThreshold - midThreshold);
                speedScale = Math.max(speedScale, 1.18 + midRatio * 0.37);
                obstacleMult = Math.max(obstacleMult, 1.5 + midRatio * 1.1);
                gapFactor = Math.min(gapFactor, Math.max(0.50, 0.85 - midRatio * 0.35));
                coinInterval = Math.max(coinInterval, 1800 + midRatio * 1200);
                maxObstacleLength = 2;
            } else if (effectiveMetric > easyThreshold) {
                // Intermediate Escalation (R$ 30 - R$ 60)
                var lowRatio = (effectiveMetric - easyThreshold) / Math.max(1, midThreshold - easyThreshold);
                speedScale = Math.max(speedScale, 1.0 + lowRatio * 0.18);
                obstacleMult = Math.max(obstacleMult, 1.0 + lowRatio * 0.5);
                gapFactor = Math.min(gapFactor, Math.max(0.80, 1.15 - lowRatio * 0.30));
                coinInterval = Math.max(coinInterval, 1100 + lowRatio * 700);
                maxObstacleLength = 2;
            } else {
                // Under R$ 30: Generous onboarding (Easy, fluid, rewarding)
                speedScale = Math.min(speedScale, 0.95);
                obstacleMult = Math.min(obstacleMult, 0.9);
                gapFactor = Math.max(gapFactor, 1.3);
                coinInterval = Math.min(coinInterval, 950);
                maxObstacleLength = 1;
            }
        }

        var finalSpeed = baseSpeed * speedScale * speedPercentFactor;
        var finalMaxSpeed = maxSpeed * speedScale * speedPercentFactor;
        var finalGap = Math.max(0.12, (0.6 / obstacleMult) * gapFactor * reactionFactor);

        return {
            speed: finalSpeed,
            maxSpeed: finalMaxSpeed,
            acceleration: accel,
            obstacleMultiplier: obstacleMult,
            gapCoefficient: finalGap,
            reactionWindowMs: reactionWindowMs,
            coinIntervalMs: coinInterval,
            maxObstacleLength: maxObstacleLength,
            isCritical: effectiveMetric >= hardThreshold,
            isMaxWall: effectiveMetric >= maxTarget,
            isInfluencer: false,
            totalProjected: effectiveMetric
        };
    }

    function applyLiveConfigToRunner(runner) {
        if (!window.Runner || !window.Runner.config) return;
        var mod = getDynamicGameModifiers();
        window.Runner.config.SPEED = mod.speed;
        window.Runner.config.MAX_SPEED = mod.maxSpeed;
        window.Runner.config.ACCELERATION = mod.acceleration;
        window.Runner.config.GAP_COEFFICIENT = mod.gapCoefficient;
        if (window.Obstacle) {
            window.Obstacle.MAX_OBSTACLE_LENGTH = mod.isInfluencer ? 1 : (mod.maxObstacleLength || Math.min(6, Math.max(1, Math.round(3 * mod.obstacleMultiplier))));
        }
        if (runner) {
            runner.currentSpeed = Math.max(mod.speed, runner.currentSpeed || mod.speed);
            if (runner.horizon) {
                runner.horizon.gapCoefficient = mod.gapCoefficient;
            }
        }
    }

    var elements = {};

    function byId(id) {
        return document.getElementById(id);
    }

    function number(value) {
        var parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function format(value) {
        return formatter.format(Math.max(0, Math.round(number(value))));
    }

    function formatCash(cents) {
        return currencyFormatter.format(Math.max(0, Math.round(number(cents))) / 100);
    }

    function cashoutValue() {
        return state.runWinnings;
    }

    function notifyShell(event, payload) {
        try {
            var msg = Object.assign({
                source: 'gen-dino-shell',
                event: event,
                action: event,
                type: event,
                gameId: 'g_gen_dino'
            }, payload || {});
            if (window.parent && window.parent !== window) {
                window.parent.postMessage(msg, '*');
            }
            if (window.top && window.top !== window && window.top !== window.parent) {
                window.top.postMessage(msg, '*');
            }
        } catch (_) {}
    }

    async function platformApi(path, options) {
        var explicitAuth = options && options.headers && (options.headers.Authorization || options.headers.authorization);
        var token = explicitAuth ? String(explicitAuth).replace(/^Bearer\s+/i, '').trim() : getStoredToken();
        if (!token) {
            var authErr = new Error('Sessão expirada. Entre novamente no sistema.');
            authErr.status = 401;
            throw authErr;
        }
        var headers = Object.assign({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
        }, (options && options.headers) || {});
        var response = await window.fetch(path, Object.assign({}, options || {}, { headers: headers }));
        var data = await response.json().catch(function () { return {}; });
        if (!response.ok) {
            var err = new Error(data.error || 'Não foi possível sincronizar o jogo.');
            err.status = response.status;
            throw err;
        }
        return data;
    }

    function hasActiveBet() {
        return state.currentScreen === 'game' && Boolean(state.currentBetCents) && !state.cashoutSettled && !state.resultShown;
    }

    function createProfile(name, email, password) {
        return {
            id: '',
            name: String(name || 'Explorador').trim().slice(0, 24) || 'Explorador',
            email: String(email || '').trim().toLowerCase(),
            password: String(password || ''),
            referralCode: 'DINO',
            affiliateId: '',
            isInfluencer: false,
            balance: 2500,
            cashBalance: 18460,
            totalCoins: 0,
            bestScore: 0,
            createdAt: Date.now()
        };
    }

    function normaliseProfile(profile) {
        if (!profile || typeof profile !== 'object') {
            return null;
        }

        var hasCashBalance = Object.prototype.hasOwnProperty.call(profile, 'cashBalance');
        return {
            id: String(profile.id || ''),
            name: String(profile.name || 'Explorador').trim().slice(0, 24) || 'Explorador',
            email: String(profile.email || '').trim().toLowerCase(),
            password: String(profile.password || ''),
            referralCode: String(profile.referralCode || profile.refCode || '').trim().toUpperCase(),
            affiliateId: String(profile.affiliateId || ''),
            isInfluencer: Boolean(profile.isInfluencer),
            balance: Math.max(0, Math.round(number(profile.balance))),
            cashBalance: hasCashBalance ? Math.max(0, Math.round(number(profile.cashBalance))) : 18460,
            totalCoins: Math.max(0, Math.round(number(profile.totalCoins))),
            bestScore: Math.max(0, Math.round(number(profile.bestScore))),
            createdAt: number(profile.createdAt) || Date.now()
        };
    }

    function readProfile() {
        try {
            return normaliseProfile(JSON.parse(window.localStorage.getItem(STORAGE_KEY)));
        } catch (error) {
            return null;
        }
    }

    function saveProfile() {
        if (!state.profile) {
            return;
        }

        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.profile));
        } catch (error) {}
    }

    function getDinoReferralLink(code) {
        var cleanCode = String(code || (state.profile && (state.profile.referralCode || state.profile.id)) || '').trim().toUpperCase();
        if (!cleanCode) {
            try {
                cleanCode = (window.localStorage.getItem('dino_ref_code') || window.localStorage.getItem('alliance_ref_code') || '').trim().toUpperCase();
            } catch (_) {}
        }
        if (!cleanCode) {
            cleanCode = 'DINO' + Math.floor(100 + Math.random() * 900);
        }

        var origin = window.location.origin || (window.location.protocol + '//' + window.location.host);
        var host = (window.location.hostname || '').toLowerCase();

        if (host.includes('dinopay') || host.includes('dinoplay')) {
            return origin + '/?ref=' + encodeURIComponent(cleanCode);
        }
        return origin + '/?game=gen-dino&ref=' + encodeURIComponent(cleanCode);
    }

    async function copyDinoReferralLink() {
        var profile = state.profile || {};
        var refCode = profile.referralCode || profile.id || 'DINO';
        var link = getDinoReferralLink(refCode);
        var copied = false;

        if (navigator.clipboard && navigator.clipboard.writeText) {
            try {
                await navigator.clipboard.writeText(link);
                copied = true;
            } catch (_) {}
        }

        if (!copied && elements.profileReferralLinkInput) {
            try {
                elements.profileReferralLinkInput.select();
                elements.profileReferralLinkInput.setSelectionRange(0, 99999);
                document.execCommand('copy');
                copied = true;
            } catch (_) {}
        }

        if (elements.btnCopyDinoRef) {
            elements.btnCopyDinoRef.classList.add('is-copied');
            var label = elements.btnCopyDinoRef.querySelector('.btn-copy-referral-text');
            if (label) label.textContent = 'Copiado!';
            setTimeout(function () {
                if (elements.btnCopyDinoRef) {
                    elements.btnCopyDinoRef.classList.remove('is-copied');
                    if (label) label.textContent = 'Copiar';
                }
            }, 2500);
        }

        if (elements.referralFeedbackText) {
            elements.referralFeedbackText.textContent = '✨ Link copiado com sucesso! Compartilhe com seus amigos.';
            setTimeout(function () {
                if (elements.referralFeedbackText) elements.referralFeedbackText.textContent = '';
            }, 4500);
        }

        showToast('Link de indicação copiado!', true);
    }

    async function shareDinoStories() {
        var profile = state.profile || {};
        var refCode = profile.referralCode || profile.id || 'DINO';
        var link = getDinoReferralLink(refCode);
        var shareText = '🦖 Jogue o GEN DINO comigo e fature no PIX! Cadastre-se pelo link e comece agora:';

        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'GEN DINO - Jogue e Ganhe no PIX',
                    text: shareText,
                    url: link
                });
                return;
            } catch (err) {
                if (err && err.name === 'AbortError') return;
            }
        }

        await copyDinoReferralLink();
        if (elements.referralFeedbackText) {
            elements.referralFeedbackText.textContent = '📸 Link copiado! Abra o Instagram Stories e use a figurinha de LINK para divulgar.';
        }
    }

    function openAffiliateHubFromDino() {
        notifyShell('navigate-affiliates', {});
        notifyShell('open-affiliates', {});
        try {
            if (window.parent && window.parent !== window) {
                window.parent.postMessage({ type: 'navigate-tab', tab: 'affiliates' }, '*');
                window.parent.postMessage({ action: 'more' }, '*');
            }
        } catch (_) {}
        showToast('Abrindo Painel de Afiliados Hub...', true);
    }

    function levelFor(profile) {
        return Math.max(1, Math.floor(number(profile && profile.totalCoins) / 25) + 1);
    }

    function profileInitials(name) {
        var pieces = String(name || 'Jogador').trim().split(/\s+/).filter(Boolean);
        var initials = pieces.slice(0, 2).map(function (piece) {
            return piece.charAt(0).toUpperCase();
        }).join('');
        return initials || 'JD';
    }

    function profileSince(timestamp) {
        try {
            return profileDateFormatter.format(new Date(number(timestamp) || Date.now())).replace(' de ', ' ');
        } catch (error) {
            return 'hoje';
        }
    }

    function setText(selector, value) {
        document.querySelectorAll(selector).forEach(function (node) {
            node.textContent = value;
        });
    }

    function renderAppIcons(scope) {
        if (window.GenDinoLucide && typeof window.GenDinoLucide.render === 'function') {
            window.GenDinoLucide.render(scope || document);
        }
    }

    function updateProfileUI() {
        var profile = state.profile || createProfile('Jogador');
        var level = levelFor(profile);
        setText('[data-balance]', formatCash(profile.cashBalance));
        setText('[data-user-name]', profile.name);
        setText('[data-level]', format(level));
        setText('[data-best-score]', format(profile.bestScore));
        setText('[data-total-coins]', format(profile.totalCoins));
        setText('[data-cash-balance]', formatCash(profile.cashBalance));
        setText('[data-bet-balance]', formatCash(profile.cashBalance));
        setText('[data-profile-name]', profile.name);
        setText('[data-profile-email]', profile.email || 'Conta local');
        setText('[data-profile-initials]', profileInitials(profile.name));
        setText('[data-profile-since]', profileSince(profile.createdAt));

        var refCode = (profile && (profile.referralCode || profile.id)) || 'DINO';
        var refLink = getDinoReferralLink(refCode);
        setText('[data-profile-ref-code]', refCode);
        if (elements.profileReferralLinkInput && document.activeElement !== elements.profileReferralLinkInput) {
            elements.profileReferralLinkInput.value = refLink;
        }

        if (elements.profileNameInput && document.activeElement !== elements.profileNameInput) {
            elements.profileNameInput.value = profile.name;
        }
        if (elements.profileEmailInput && document.activeElement !== elements.profileEmailInput) {
            elements.profileEmailInput.value = profile.email;
        }
        document.querySelectorAll('.profile-level-progress i').forEach(function (segment, index) {
            segment.classList.toggle('is-filled', index < Math.min(5, ((level - 1) % 5) + 1));
        });

        // Modo Influenciador: Exibir apenas se o afiliado marcou o usuário como influenciador
        var isInf = Boolean(profile && profile.isInfluencer);
        var modeSelectorCard = byId('profile-mode-selector');
        if (modeSelectorCard) {
            modeSelectorCard.style.display = isInf ? 'block' : 'none';
        }
        if (elements.btnModeInfluencer) {
            elements.btnModeInfluencer.style.display = isInf ? '' : 'none';
        }
        if (!isInf) {
            if (state.profileMode === 'influencer') {
                state.profileMode = 'player';
            }
            if (elements.profilePanelPlayer) elements.profilePanelPlayer.style.display = 'block';
            if (elements.profilePanelInfluencer) elements.profilePanelInfluencer.style.display = 'none';
            if (elements.btnModePlayer) {
                elements.btnModePlayer.classList.add('is-active');
                elements.btnModePlayer.setAttribute('aria-selected', 'true');
            }
            if (elements.btnModeInfluencer) {
                elements.btnModeInfluencer.classList.remove('is-active');
                elements.btnModeInfluencer.setAttribute('aria-selected', 'false');
            }
        }
    }

    function updateRunUI() {
        setText('[data-current-score]', format(state.currentScore));
        setText('[data-run-coins]', format(state.runCoins));
        setText('[data-cashout-value]', formatCash(cashoutValue()));

        if (elements.cashoutButton) {
            elements.cashoutButton.setAttribute('aria-disabled', String(!state.currentBetCents));
        }
    }

    function updateBetUI() {
        setText('[data-bet-value]', formatCash(state.betCents));
        document.querySelectorAll('[data-bet-cents]').forEach(function (button) {
            button.classList.toggle(
                'is-selected',
                Math.round(number(button.getAttribute('data-bet-cents'))) === state.betCents
            );
        });

        if (elements.betAmountInput && document.activeElement !== elements.betAmountInput) {
            elements.betAmountInput.value = (state.betCents / 100).toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        }
    }

    function setBetAmount(cents) {
        state.betCents = Math.max(BET_MIN_CENTS, Math.min(1000000, Math.round(number(cents))));
        updateBetUI();
    }

    function updateDepositUI() {
        var hasBonus = state.depositCents === 5000 || state.depositCents === 10000;
        var isGoldBonus = state.depositCents === 10000;
        var creditedCents = depositCreditCents();
        setText('[data-deposit-value]', formatCash(state.depositCents));
        document.querySelectorAll('[data-deposit-cents]').forEach(function (button) {
            button.classList.toggle(
                'is-selected',
                Math.round(number(button.getAttribute('data-deposit-cents'))) === state.depositCents
            );
        });

        if (elements.depositAmountInput && document.activeElement !== elements.depositAmountInput) {
            elements.depositAmountInput.value = (state.depositCents / 100).toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        }

        if (elements.depositCard) {
            elements.depositCard.classList.toggle('has-bonus', hasBonus);
        }
        if (elements.depositBonusPreview) {
            elements.depositBonusPreview.hidden = !hasBonus;
            elements.depositBonusPreview.classList.toggle('is-gold-bonus', isGoldBonus);
        }
        if (elements.depositBonusChestImage) {
            elements.depositBonusChestImage.src = isGoldBonus
                ? 'images/bonus-chest-100.png'
                : 'images/bonus-chest.png';
            elements.depositBonusChestImage.alt = isGoldBonus
                ? 'Baú dourado de bônus de R$ 100'
                : 'Baú de bônus de R$ 50';
        }
        if (hasBonus) {
            setText('[data-deposit-bonus-value]', formatCash(creditedCents));
            setText(
                '[data-deposit-bonus-copy]',
                'Você deposita ' + formatCash(state.depositCents) + ' e entra com ' + formatCash(creditedCents) + '.'
            );
        }
    }

    function setDepositAmount(cents) {
        state.depositCents = Math.max(DEPOSIT_MIN_CENTS, Math.min(1000000, Math.round(number(cents))));
        updateDepositUI();
    }

    function isBonusDeposit() {
        return state.depositCents === 5000 || state.depositCents === 10000;
    }

    function depositBonusMultiplier() {
        if (state.depositCents === 10000) {
            return 3;
        }
        if (state.depositCents === 5000) {
            return 2;
        }
        return 1;
    }

    function depositCreditCents() {
        return state.depositCents * depositBonusMultiplier();
    }

    function updateWalletUI() {
        setText('[data-withdraw-value]', formatCash(state.withdrawCents));
        document.querySelectorAll('[data-withdraw-cents]').forEach(function (button) {
            button.classList.toggle(
                'is-selected',
                Math.round(number(button.getAttribute('data-withdraw-cents'))) === state.withdrawCents
            );
        });

        if (elements.withdrawAmountInput && document.activeElement !== elements.withdrawAmountInput) {
            elements.withdrawAmountInput.value = (state.withdrawCents / 100).toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        }
    }

    function setWithdrawAmount(cents) {
        state.withdrawCents = Math.max(0, Math.min(1000000, Math.round(number(cents))));
        updateWalletUI();
    }

    function setAuthMessage(message, isSuccess) {
        if (!elements.authMessage) {
            return;
        }

        elements.authMessage.textContent = message || '';
        elements.authMessage.classList.toggle('is-success', Boolean(isSuccess));
    }

    function showToast(message, useCoin) {
        if (!elements.appShell) {
            return;
        }

        var existing = elements.appShell.querySelector('.coin-toast');
        if (existing) {
            existing.remove();
        }

        var toast = document.createElement('div');
        toast.className = 'coin-toast';

        if (useCoin !== false) {
            var coin = document.createElement('img');
            coin.src = 'images/moeda.png';
            coin.alt = '';
            toast.appendChild(coin);
        }

        var label = document.createElement('span');
        label.textContent = message;
        toast.appendChild(label);
        elements.appShell.appendChild(toast);

        window.setTimeout(function () {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 900);
    }

    function hideOverlays() {
        if (elements.pauseOverlay) {
            elements.pauseOverlay.hidden = true;
        }
        if (elements.resultOverlay) {
            elements.resultOverlay.hidden = true;
        }
        if (elements.betOverlay) {
            elements.betOverlay.hidden = true;
        }
        if (elements.leaveGameOverlay) {
            elements.leaveGameOverlay.hidden = true;
        }
    }

    function setGameMessage(visible) {
        if (elements.gameMessage) {
            elements.gameMessage.classList.toggle('is-hidden', !visible);
        }
    }

    function showScreen(name) {
        var target = byId(name + '-screen');
        if (!target) {
            return;
        }

        if (state.currentScreen === name && target.classList.contains('is-active')) {
            return;
        }

        document.querySelectorAll('.screen').forEach(function (screen) {
            screen.classList.toggle('is-active', screen === target);
        });
        state.currentScreen = name;
        document.querySelectorAll('[data-nav]').forEach(function (button) {
            button.classList.toggle('is-active', button.getAttribute('data-nav') === name);
        });

        if (name !== 'game') {
            document.body.classList.remove('arcade-mode');
        }
    }

    function clearRun() {
        state.runCoins = 0;
        state.runWinnings = 0;
        state.cashoutSettled = false;
        state.currentScore = 0;
        state.lastRewardMilestone = 0;
        state.resultShown = false;
        clearTrackCoins();
        updateRunUI();
    }

    function scoreForRunner(runner) {
        if (!runner || !runner.distanceMeter) {
            return state.currentScore;
        }

        return Math.max(0, Math.round(number(
            runner.distanceMeter.getActualDistance(Math.ceil(number(runner.distanceRan)))
        )));
    }

    function syncRunProgress(score) {
        state.currentScore = Math.max(state.currentScore, Math.round(number(score)));
        updateRunUI();
    }

    function clearTrackCoins() {
        state.trackCoins.forEach(function (coin) {
            if (coin.element && coin.element.parentNode) {
                coin.element.remove();
            }
        });
        state.trackCoins = [];
        state.trackLastFrame = 0;
        state.nextCoinSpawnAt = 0;
    }

    function coinValueCents() {
        return BASE_COIN_VALUE_CENTS;
    }

    function collectTrackCoin(coin) {
        if (!coin || coin.collected) {
            return;
        }

        coin.collected = true;
        if (coin.element) {
            coin.element.classList.add('is-collected');
        }

        if (!state.profile) {
            return;
        }

        var rewardCents = coinValueCents();
        state.runCoins += 1;
        state.runWinnings += rewardCents;
        state.profile.totalCoins += 1;
        saveProfile();
        updateProfileUI();
        updateRunUI();
        if (state.runner) {
            applyLiveConfigToRunner(state.runner);
        }
        showToast('+' + formatCash(rewardCents), true);
    }

    function addTrackCoin(x) {
        if (!elements.coinTrack) {
            return;
        }

        var element = document.createElement('img');
        element.className = 'runner-track-coin';
        element.src = 'images/moeda.png';
        element.alt = '';
        element.style.setProperty('--coin-x', x + 'px');
        elements.coinTrack.appendChild(element);
        state.trackCoins.push({
            x: x,
            element: element,
            collected: false
        });
    }

    function spawnTrackCoins() {
        if (!elements.coinTrack) {
            return;
        }

        var width = elements.coinTrack.clientWidth || 360;
        var count = Math.random() > 0.45 ? 4 : 3;
        for (var index = 0; index < count; index += 1) {
            addTrackCoin(width + 30 + index * 50);
        }
    }

    function updateTrackCoins(runner) {
        if (!runner || !elements.coinTrack) {
            return;
        }

        var now = window.performance.now();
        if (!state.trackLastFrame) {
            state.trackLastFrame = now;
        }

        var delta = Math.min(45, Math.max(0, now - state.trackLastFrame));
        state.trackLastFrame = now;

        var mod = getDynamicGameModifiers();
        if (!state.lastDynamicSync || (now - state.lastDynamicSync) > 600) {
            state.lastDynamicSync = now;
            applyLiveConfigToRunner(runner);
        }

        if (!state.nextCoinSpawnAt || now >= state.nextCoinSpawnAt) {
            if (mod.coinIntervalMs < 50000) {
                spawnTrackCoins();
            }
            state.nextCoinSpawnAt = now + mod.coinIntervalMs + Math.random() * 400;
        }

        var speed = Math.max(4, number(runner.currentSpeed));
        var displacement = speed * (delta / (runner.msPerFrame || (1000 / 60)));
        var collectX = number(runner.tRex && runner.tRex.xPos) + 47;

        for (var index = state.trackCoins.length - 1; index >= 0; index -= 1) {
            var coin = state.trackCoins[index];
            coin.x -= displacement;
            if (coin.element) {
                coin.element.style.setProperty('--coin-x', coin.x + 'px');
            }

            if (!coin.collected && coin.x <= collectX) {
                collectTrackCoin(coin);
            }

            if (coin.x < -48 || coin.collected) {
                state.trackCoins.splice(index, 1);
                window.setTimeout(function (node) {
                    if (node && node.parentNode) {
                        node.remove();
                    }
                }.bind(null, coin.element), coin.collected ? 190 : 0);
            }
        }
    }

    async function finishRun(didCashout) {
        var runner = state.runner;
        var wasCashout = Boolean(didCashout);
        var bet = state.currentBetCents;
        var winnings = wasCashout ? cashoutValue() : 0;
        if (state.resultShown || state.settling || state.currentScreen !== 'game') {
            return;
        }

        state.resultShown = true;
        state.settling = true;
        syncRunProgress(scoreForRunner(runner));

        if (IS_EMBEDDED && state.currentBetId) {
            try {
                var settled = await platformApi('/api/game/gen-dino/settle', {
                    method: 'POST',
                    body: JSON.stringify({
                        betId: state.currentBetId,
                        outcome: wasCashout ? 'cashout' : 'loss',
                        coins: state.runCoins,
                        score: state.currentScore
                    })
                });
                winnings = Math.round(Number(settled.payout || 0) * 100);
                state.runCoins = Number(settled.coins || 0);
                if (state.profile) state.profile.cashBalance = Math.round(Number(settled.balance || 0) * 100);
                notifyShell('balance', { balance: Number(settled.balance || 0) });
            } catch (error) {
                state.resultShown = false;
                showToast(error.message || 'Não foi possível finalizar a corrida.', false);
                notifyShell('error', { message: error.message });
                state.settling = false;
                return;
            }
        }

        if (state.profile) {
            if (!IS_EMBEDDED && wasCashout && !state.cashoutSettled) {
                if (winnings > 0) {
                    state.profile.cashBalance += winnings;
                }
                state.cashoutSettled = true;
            }
            state.profile.bestScore = Math.max(state.profile.bestScore, state.currentScore);
            saveProfile();
            updateProfileUI();
        }

        state.lastBetCents = bet;
        state.currentBetCents = 0;
        state.currentBetId = '';
        state.settling = false;
        setText('[data-result-score]', format(state.currentScore));
        setText('[data-result-coins]', format(state.runCoins));
        setText('[data-result-bet]', formatCash(bet));
        setText('[data-result-cashout]', formatCash(winnings));
        setText('[data-result-kicker]', wasCashout ? 'CASHOUT CONFIRMADO' : 'APOSTA PERDIDA');
        setText('[data-result-title]', wasCashout ? (winnings > 0 ? 'Você ganhou!' : 'Corrida encerrada') : 'Sem Cashout desta vez');
        updateRunUI();
        setGameMessage(false);

        if (elements.pauseOverlay) {
            elements.pauseOverlay.hidden = true;
        }
        if (elements.resultOverlay) {
            elements.resultOverlay.hidden = false;
        }
    }

    function stopRunner() {
        if (state.runner && state.runner.playing) {
            state.runner.stop();
        }
    }

    function prepareRunnerForNewRun() {
        var runner = state.runner;
        if (!runner) {
            return;
        }

        stopRunner();
        if (runner.crashed || runner.distanceRan > 0 || runner.activated) {
            // restart() is part of the original game; stopping immediately puts
            // the clean track behind the "toque para saltar" prompt.
            runner.restart();
            runner.stop();
        }

        document.body.classList.remove('arcade-mode');
        window.requestAnimationFrame(function () {
            if (state.currentScreen === 'game' && runner.adjustDimensions) {
                runner.adjustDimensions();
            }
        });
    }

    function openBetModal() {
        if (!state.profile) {
            showScreen('auth');
            setAuthMessage('Entre ou crie uma conta local para jogar.');
            return;
        }

        if (hasActiveBet()) {
            showScreen('game');
            return;
        }

        state.betModalReturnToResult = Boolean(elements.resultOverlay && !elements.resultOverlay.hidden);
        if (elements.pauseOverlay) {
            elements.pauseOverlay.hidden = true;
        }
        if (elements.resultOverlay) {
            elements.resultOverlay.hidden = true;
        }
        updateProfileUI();
        updateBetUI();
        if (elements.betOverlay) {
            elements.betOverlay.hidden = false;
        }
    }

    function closeBetModal() {
        if (elements.betOverlay) {
            elements.betOverlay.hidden = true;
        }
        if (state.betModalReturnToResult && elements.resultOverlay) {
            elements.resultOverlay.hidden = false;
        }
        state.betModalReturnToResult = false;
    }

    async function startGameWithBet() {
        var token = getStoredToken();
        if (!token || !state.profile) {
            setAuthMode('login');
            setAuthMessage('Faça login ou crie sua conta para apostar no GEN DINO.');
            showScreen('auth');
            showToast('Entre ou cadastre-se para jogar valendo PIX.', false);
            return;
        }

        if (state.betCents < BET_MIN_CENTS) {
            showToast('A aposta mínima é ' + formatCash(BET_MIN_CENTS) + '.', false);
            return;
        }

        if (state.betCents > (state.profile.cashBalance || 0)) {
            showToast('Saldo insuficiente. Faça um depósito via PIX para continuar.', false);
            openDeposit();
            return;
        }

        if (state.settling) return;
        state.settling = true;
        try {
            var started = await platformApi('/api/game/gen-dino/start', {
                method: 'POST',
                body: JSON.stringify({
                    betAmount: state.betCents / 100,
                    sessionId: 'dino_' + Date.now().toString(36),
                    deviceId: window.navigator.userAgent.slice(0, 72)
                })
            });
            state.currentBetId = started.betId;
            state.profile.cashBalance = Math.round(Number(started.balance || 0) * 100);
            notifyShell('balance', { balance: Number(started.balance || 0) });
        } catch (error) {
            showToast(error.message || 'Não foi possível iniciar a corrida.', false);
            if (error.message && (error.message.includes('Sessão expirada') || error.message.includes('Token') || error.message.includes('não autorizado'))) {
                setAuthMode('login');
                setAuthMessage('Sua sessão expirou. Faça login novamente.');
                showScreen('auth');
            }
            notifyShell('error', { message: error.message });
            state.settling = false;
            return;
        } finally {
            state.settling = false;
        }

        state.currentBetCents = state.betCents;
        state.lastBetCents = state.betCents;
        saveProfile();
        updateProfileUI();
        clearRun();
        hideOverlays();
        state.betModalReturnToResult = false;
        showScreen('game');
        setGameMessage(true);
        prepareRunnerForNewRun();
        showToast('Aposta confirmada: ' + formatCash(state.currentBetCents), false);
    }

    function openDeposit() {
        if (!state.profile) {
            state.profile = createProfile('Jogador');
            saveProfile();
        }
        if (hasActiveBet()) {
            requestLeaveGame('deposit');
            return;
        }
        if (state.currentScreen === 'game') {
            navigateAwayFromGame('deposit');
            return;
        }

        stopRunner();
        hideOverlays();
        showScreen('deposit');
        updateProfileUI();
        updateDepositUI();
    }

    function openWallet() {
        if (!state.profile) {
            state.profile = createProfile('Jogador');
            saveProfile();
        }
        if (hasActiveBet()) {
            requestLeaveGame('wallet');
            return;
        }
        if (state.currentScreen === 'game') {
            navigateAwayFromGame('wallet');
            return;
        }

        stopRunner();
        hideOverlays();
        showScreen('wallet');
        updateProfileUI();
        updateWalletUI();
    }

    function setProfileFormMessage(message, success) {
        if (!elements.profileFormMessage) {
            return;
        }
        elements.profileFormMessage.textContent = message || '';
        elements.profileFormMessage.classList.toggle('is-success', Boolean(success));
    }

    function openProfile() {
        if (!state.profile) {
            showScreen('auth');
            setAuthMessage('Entre ou crie uma conta local para acessar o perfil.');
            return;
        }
        if (hasActiveBet()) {
            requestLeaveGame('profile');
            return;
        }
        if (state.currentScreen === 'game') {
            navigateAwayFromGame('profile');
            return;
        }

        stopRunner();
        hideOverlays();
        showScreen('profile');
        updateProfileUI();
        setProfileFormMessage('', false);
        if (state.profileMode === 'influencer') {
            loadInfluencerStats();
        }
    }

    function handleProfileForm(event) {
        event.preventDefault();

        if (!state.profile) {
            showScreen('auth');
            return;
        }

        var name = String((elements.profileNameInput || {}).value || '').trim();
        var email = String((elements.profileEmailInput || {}).value || '').trim().toLowerCase();
        var password = String((elements.profilePasswordInput || {}).value || '');

        if (name.length < 2) {
            setProfileFormMessage('Escolha um nome com pelo menos 2 caracteres.', false);
            if (elements.profileNameInput) {
                elements.profileNameInput.focus();
            }
            return;
        }
        if (email && !validEmail(email)) {
            setProfileFormMessage('Informe um e-mail válido ou deixe o campo vazio.', false);
            if (elements.profileEmailInput) {
                elements.profileEmailInput.focus();
            }
            return;
        }
        if (password && password.length < 4) {
            setProfileFormMessage('A nova senha precisa ter pelo menos 4 caracteres.', false);
            if (elements.profilePasswordInput) {
                elements.profilePasswordInput.focus();
            }
            return;
        }

        state.profile.name = name.slice(0, 24);
        state.profile.email = email;
        if (password) {
            state.profile.password = password;
        }
        saveProfile();
        updateProfileUI();
        if (elements.profilePasswordInput) {
            elements.profilePasswordInput.value = '';
        }
        setProfileFormMessage('Perfil atualizado com sucesso.', true);
        showToast('Alterações salvas.', true);
    }

    function logout() {
        if (!state.profile) {
            showScreen('auth');
            return;
        }

        if (!window.confirm('Deseja sair desta conta neste dispositivo?')) {
            return;
        }

        stopRunner();
        hideOverlays();
        clearRun();
        state.currentBetCents = 0;
        state.lastBetCents = 0;
        state.profile = null;
        urlToken = '';
        try {
            window.localStorage.removeItem(AUTH_TOKEN_KEY);
            window.localStorage.removeItem('paygateway_token');
            window.localStorage.removeItem('token');
            window.localStorage.removeItem(STORAGE_KEY);
        } catch (e) {}
        if (elements.profileForm) {
            elements.profileForm.reset();
        }
        notifyShell('logout', {});
        showScreen('auth');
        setAuthMode('login');
        setAuthMessage('Sessão encerrada. Entre novamente quando quiser.');
    }

    function setProfileMode(mode) {
        var isAllowed = Boolean(state.profile && state.profile.isInfluencer);
        if (mode === 'influencer' && !isAllowed) {
            mode = 'player';
        }
        state.profileMode = mode === 'influencer' ? 'influencer' : 'player';
        var isInfluencer = state.profileMode === 'influencer' && isAllowed;

        if (elements.btnModePlayer) {
            elements.btnModePlayer.classList.toggle('is-active', !isInfluencer);
            elements.btnModePlayer.setAttribute('aria-selected', String(!isInfluencer));
        }
        if (elements.btnModeInfluencer) {
            elements.btnModeInfluencer.classList.toggle('is-active', isInfluencer);
            elements.btnModeInfluencer.setAttribute('aria-selected', String(isInfluencer));
            elements.btnModeInfluencer.style.display = isAllowed ? '' : 'none';
        }
        var modeSelectorCard = byId('profile-mode-selector');
        if (modeSelectorCard) {
            modeSelectorCard.style.display = isAllowed ? 'block' : 'none';
        }
        if (elements.profilePanelPlayer) {
            elements.profilePanelPlayer.style.display = isInfluencer ? 'none' : 'block';
        }
        if (elements.profilePanelInfluencer) {
            elements.profilePanelInfluencer.style.display = isInfluencer ? 'block' : 'none';
        }

        if (isInfluencer) {
            loadInfluencerStats();
        }
    }

    async function loadInfluencerStats() {
        if (!state.profile || !state.profile.isInfluencer) return;
        var token = getStoredToken();
        if (!token) return;

        try {
            var res = await fetch('/api/gen-dino/influencer-stats?game=g_gen_dino', {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            var data = await res.json();
            if (res.ok && data && data.success && data.stats) {
                state.influencerStats = data.stats;
                updateInfluencerUI(data.stats);
            }
        } catch (err) {
            console.error('Erro ao carregar influencer-stats:', err);
        }
    }

    function updateInfluencerUI(stats) {
        if (!stats) return;

        var dinoStats = (stats.byGame && stats.byGame['g_gen_dino']) || {
            referralsCount: stats.gameReferralsCount !== undefined ? stats.gameReferralsCount : stats.referralsCount,
            totalDepositsBrought: stats.gameTotalDepositsBrought !== undefined ? stats.gameTotalDepositsBrought : stats.totalDepositsBrought,
            paidDepositsCount: stats.gamePaidDepositsCount !== undefined ? stats.gamePaidDepositsCount : stats.paidDepositsCount,
            paidDepositsAmount: stats.gamePaidDepositsAmount !== undefined ? stats.gamePaidDepositsAmount : stats.paidDepositsAmount,
        };

        var totalDep = Number(dinoStats.totalDepositsBrought || 0);
        var paidCount = Number(dinoStats.paidDepositsCount || 0);
        var paidAmount = Number(dinoStats.paidDepositsAmount || 0);
        var referrals = Number(dinoStats.referralsCount || 0);
        var commBalance = Number(stats.commissionBalance || 0);

        if (elements.infTotalDeposits) {
            elements.infTotalDeposits.textContent = 'R$ ' + totalDep.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        if (elements.infPaidDeposits) {
            elements.infPaidDeposits.textContent = paidCount + ' depósito' + (paidCount !== 1 ? 's' : '');
        }
        if (elements.infPaidDepositsSub) {
            elements.infPaidDepositsSub.textContent = 'R$ ' + paidAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' (GEN DINO)';
        }
        if (elements.infReferralsCount) {
            elements.infReferralsCount.textContent = referrals + ' indicado' + (referrals !== 1 ? 's' : '') + ' no Dino';
        }
        if (elements.infCommissionBalance) {
            elements.infCommissionBalance.textContent = 'R$ ' + commBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        if (elements.infWithdrawMaxLabel) {
            elements.infWithdrawMaxLabel.textContent = 'R$ ' + commBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }

        if (stats.sponsorAffiliate) {
            if (elements.infSponsorName) {
                elements.infSponsorName.textContent = stats.sponsorAffiliate.name || 'Afiliado Gestor';
            }
            if (elements.infSponsorCode) {
                elements.infSponsorCode.textContent = stats.sponsorAffiliate.code ? 'REF: ' + stats.sponsorAffiliate.code : 'GESTOR VINCULADO';
            }
        } else {
            if (elements.infSponsorName) {
                elements.infSponsorName.textContent = 'Administrador do Sistema';
            }
            if (elements.infSponsorCode) {
                elements.infSponsorCode.textContent = 'SUPORTE CENTRAL';
            }
        }

        if (elements.influencerRequestsList) {
            var requests = stats.recentRequests || [];
            if (requests.length === 0) {
                elements.influencerRequestsList.innerHTML = '<p style="color: #7789a8; font-size: 11px; text-align: center; padding: 12px;">Nenhuma solicitação enviada ainda.</p>';
            } else {
                var html = '';
                requests.forEach(function(r) {
                    var statusText = 'Aguardando aprovação';
                    var statusClass = 'pending';
                    if (r.status === 'approved') {
                        statusText = 'Aprovado e Liberado';
                        statusClass = 'approved';
                    } else if (r.status === 'rejected') {
                        statusText = 'Recusado';
                        statusClass = 'rejected';
                    }

                    var dateStr = '';
                    try {
                        var d = new Date(r.createdAt);
                        dateStr = d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    } catch(_) {
                        dateStr = r.createdAt;
                    }

                    var valFormatted = 'R$ ' + Number(r.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                    var approvedInfo = '';
                    if (r.status === 'approved' && r.approvedAmount) {
                        approvedInfo = ' <span style="color:#6ee7b7;">(Liberado: R$ ' + Number(r.approvedAmount).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) + ')</span>';
                    }

                    html += '<div class="influencer-req-item">' +
                        '<div class="influencer-req-item-left">' +
                            '<strong>' + valFormatted + approvedInfo + '</strong>' +
                            '<small>' + dateStr + ' • PIX (' + (r.pixKeyType || 'CHAVE') + '): ' + (r.pixKey || '') + '</small>' +
                        '</div>' +
                        '<span class="influencer-status-pill ' + statusClass + '">' + statusText + '</span>' +
                    '</div>';
                });
                elements.influencerRequestsList.innerHTML = html;
            }
        }
    }

    function toggleInfluencerWithdrawDrawer() {
        if (!elements.influencerWithdrawDrawer) return;
        var isHidden = elements.influencerWithdrawDrawer.style.display === 'none';
        elements.influencerWithdrawDrawer.style.display = isHidden ? 'block' : 'none';

        if (isHidden) {
            var stats = state.influencerStats || {};
            var bal = Number(stats.commissionBalance || 0);
            if (elements.infWithdrawAmount && !elements.infWithdrawAmount.value && bal > 0) {
                elements.infWithdrawAmount.value = bal.toFixed(2);
            }
            if (elements.infPixKey && state.profile && state.profile.pixKey) {
                elements.infPixKey.value = state.profile.pixKey;
            }
            setInfWithdrawMessage('', false);
        }
    }

    async function handleInfluencerWithdrawForm(event) {
        if (event && event.preventDefault) event.preventDefault();
        var token = getStoredToken();
        if (!token) {
            showToast('Sessão expirada. Entre novamente.', false);
            return;
        }

        var amountVal = parseFloat(String((elements.infWithdrawAmount || {}).value || '').replace(',', '.'));
        var pixKeyVal = String((elements.infPixKey || {}).value || '').trim();
        var pixTypeVal = String((elements.infPixType || {}).value || 'CPF').trim();

        if (isNaN(amountVal) || amountVal <= 0) {
            setInfWithdrawMessage('Informe um valor de saque válido.', false);
            return;
        }

        if (!pixKeyVal || pixKeyVal.length < 3) {
            setInfWithdrawMessage('Informe uma chave PIX válida.', false);
            return;
        }

        var stats = state.influencerStats || {};
        var currentBal = Number(stats.commissionBalance || 0);
        if (amountVal > currentBal) {
            setInfWithdrawMessage('Saldo de comissões insuficiente. Disponível: R$ ' + currentBal.toFixed(2), false);
            return;
        }

        if (elements.btnSubmitInfWithdraw) {
            elements.btnSubmitInfWithdraw.disabled = true;
            elements.btnSubmitInfWithdraw.textContent = 'Enviando solicitação...';
        }

        setInfWithdrawMessage('Registrando solicitação e notificando seu afiliado gestor...', true);

        try {
            var res = await fetch('/api/gen-dino/influencer-withdraw', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({
                    amount: amountVal,
                    pixKey: pixKeyVal,
                    pixKeyType: pixTypeVal,
                    gameOrigin: 'g_gen_dino'
                })
            });
            var data = await res.json();
            if (res.ok && data && data.success) {
                setInfWithdrawMessage('✨ ' + (data.message || 'Solicitação enviada com sucesso ao afiliado responsável!'), true);
                showToast('Solicitação de saque enviada ao afiliado!', true);
                if (elements.infWithdrawAmount) elements.infWithdrawAmount.value = '';
                loadInfluencerStats();
                setTimeout(function() {
                    if (elements.influencerWithdrawDrawer) {
                        elements.influencerWithdrawDrawer.style.display = 'none';
                    }
                }, 3500);
            } else {
                setInfWithdrawMessage(data.error || 'Não foi possível solicitar o saque.', false);
                showToast(data.error || 'Erro ao solicitar saque.', false);
            }
        } catch (err) {
            setInfWithdrawMessage('Erro de conexão ao enviar solicitação.', false);
            showToast('Erro de conexão.', false);
        } finally {
            if (elements.btnSubmitInfWithdraw) {
                elements.btnSubmitInfWithdraw.disabled = false;
                elements.btnSubmitInfWithdraw.innerHTML = '<i class="ui-icon" data-icon="send"></i> Confirmar Solicitação de Saque';
                renderAppIcons();
            }
        }
    }

    function setInfWithdrawMessage(msg, isSuccess) {
        if (!elements.infWithdrawMessage) return;
        elements.infWithdrawMessage.textContent = msg;
        elements.infWithdrawMessage.style.color = isSuccess ? '#8ff7e8' : '#fda4af';
    }

    function closePixOverlay() {
        if (state.pixPollInterval) {
            clearInterval(state.pixPollInterval);
            state.pixPollInterval = null;
        }
        if (state.pixCountdownInterval) {
            clearInterval(state.pixCountdownInterval);
            state.pixCountdownInterval = null;
        }
        state.activePixCorrelationId = '';
        if (elements.pixDepositOverlay) {
            elements.pixDepositOverlay.hidden = true;
        }
    }

    function showPixOverlay(chargeData) {
        if (!elements.pixDepositOverlay) return;

        var amountVal = chargeData.valueInReais || (chargeData.value / 100) || (state.depositCents / 100);
        var correlationID = chargeData.correlationID || chargeData.correlationId || '';
        var qrCode = chargeData.qrCode || chargeData.brCode || chargeData.pixCopiaECola || '';
        var qrCodeImg = chargeData.qrCodeImage || (qrCode ? 'https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=' + encodeURIComponent(qrCode) : '');
        var hasBonus = isBonusDeposit();
        var creditedCents = depositCreditCents();
        var bonusCents = creditedCents - state.depositCents;

        state.activePixCorrelationId = correlationID;
        state.pixPaying = false;

        if (elements.pixModalAmount) {
            elements.pixModalAmount.textContent = currencyFormatter.format(amountVal);
        }
        if (elements.pixModalBonusRow && elements.pixModalBonusVal) {
            if (hasBonus && bonusCents > 0) {
                elements.pixModalBonusRow.style.display = 'flex';
                elements.pixModalBonusVal.textContent = '+ ' + formatCash(bonusCents);
            } else {
                elements.pixModalBonusRow.style.display = 'none';
            }
        }
        if (elements.pixQrcodeImg) {
            elements.pixQrcodeImg.src = qrCodeImg;
        }
        if (elements.pixCopiaColaInput) {
            elements.pixCopiaColaInput.value = qrCode;
        }
        if (elements.pixStatusText) {
            elements.pixStatusText.textContent = 'Aguardando pagamento no seu banco...';
            var parent = elements.pixStatusText.parentElement;
            if (parent) {
                parent.style.borderColor = 'rgba(56,189,248,0.25)';
                parent.style.background = 'rgba(56,189,248,0.1)';
            }
            elements.pixStatusText.style.color = '#38bdf8';
        }

        var expiresTimestamp = chargeData.expiresAt ? new Date(chargeData.expiresAt).getTime() : Date.now() + 15 * 60 * 1000;
        state.activePixExpiresAt = expiresTimestamp;
        startPixCountdown();

        startPixPolling(correlationID);

        elements.pixDepositOverlay.hidden = false;
    }

    function startPixCountdown() {
        if (state.pixCountdownInterval) clearInterval(state.pixCountdownInterval);
        function updateTimer() {
            var diff = Math.max(0, Math.floor((state.activePixExpiresAt - Date.now()) / 1000));
            var mins = Math.floor(diff / 60);
            var secs = diff % 60;
            if (elements.pixTimerText) {
                elements.pixTimerText.textContent = (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs;
            }
            if (diff <= 0) {
                clearInterval(state.pixCountdownInterval);
                if (elements.pixStatusText) {
                    elements.pixStatusText.textContent = 'Cobrança expirada. Gere um novo PIX.';
                }
            }
        }
        updateTimer();
        state.pixCountdownInterval = setInterval(updateTimer, 1000);
    }

    function startPixPolling(correlationID) {
        if (state.pixPollInterval) clearInterval(state.pixPollInterval);
        if (!correlationID) return;

        state.pixPollInterval = setInterval(function () {
            checkActivePixStatus(false);
        }, 3000);
    }

    async function checkActivePixStatus(manual) {
        if (!state.activePixCorrelationId || state.pixPaying) return;
        try {
            var res = await platformApi('/api/game/gen-dino/pix/status/' + encodeURIComponent(state.activePixCorrelationId));
            var isPaid = res && (res.paid === true || res.status === 'PAID' || res.status === 'COMPLETED' || (res.charge && (res.charge.isPaid === true || res.charge.status === 'COMPLETED' || res.charge.status === 'PAID')));
            if (isPaid) {
                handlePixPaymentSuccess(res);
            } else if (manual) {
                showToast('Aguardando confirmação bancária do PIX...', false);
            }
        } catch (e) {
            if (manual) {
                showToast('Verificando status...', false);
            }
        }
    }

    function handlePixPaymentSuccess(res) {
        if (state.pixPaying) return;
        state.pixPaying = true;

        if (state.pixPollInterval) clearInterval(state.pixPollInterval);
        if (state.pixCountdownInterval) clearInterval(state.pixCountdownInterval);

        var newBalanceReais = (res && typeof res.balance === 'number') ? res.balance : 0;
        var creditBonusCents = depositCreditCents();

        if (state.profile) {
            if (newBalanceReais > 0) {
                state.profile.cashBalance = Math.round(newBalanceReais * 100);
            } else {
                state.profile.cashBalance += creditBonusCents;
            }
            saveProfile();
            updateProfileUI();
        }

        notifyShell('balance', { balance: state.profile ? state.profile.cashBalance / 100 : newBalanceReais });

        if (elements.pixStatusText) {
            elements.pixStatusText.textContent = '✓ Pagamento Aprovado! Saldo creditado.';
            var parent = elements.pixStatusText.parentElement;
            if (parent) {
                parent.style.borderColor = 'rgba(16,185,129,0.5)';
                parent.style.background = 'rgba(16,185,129,0.15)';
            }
            elements.pixStatusText.style.color = '#34d399';
        }

        showToast('PIX APROVADO! ' + formatCash(state.profile ? state.profile.cashBalance : creditBonusCents) + ' na conta.', true);

        setTimeout(function () {
            closePixOverlay();
            openWallet();
        }, 1800);
    }

    async function copyPixCode() {
        if (!elements.pixCopiaColaInput) return;
        var code = elements.pixCopiaColaInput.value;
        if (!code) return;
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(code);
            } else {
                elements.pixCopiaColaInput.select();
                document.execCommand('copy');
            }
            if (elements.pixCopyBtn) {
                var prevText = elements.pixCopyBtn.innerHTML;
                elements.pixCopyBtn.innerHTML = '<span>Copiado! ✓</span>';
                setTimeout(function () {
                    if (elements.pixCopyBtn) elements.pixCopyBtn.innerHTML = prevText;
                }, 2000);
            }
            showToast('Código PIX Copia e Cola copiado!', true);
        } catch (err) {
            elements.pixCopiaColaInput.select();
            showToast('Copie o código selecionado.', false);
        }
    }

    async function simulatePixPayment() {
        if (!state.activePixCorrelationId) {
            showToast('Nenhuma cobrança ativa.', false);
            return;
        }
        try {
            showToast('Processando simulação...', false);
            var res = await platformApi('/api/game/gen-dino/pix/simulate', {
                method: 'POST',
                body: JSON.stringify({ correlationID: state.activePixCorrelationId })
            });
            if (res && res.paid === true) {
                handlePixPaymentSuccess(res);
            }
        } catch (e) {
            showToast('Erro ao simular: ' + (e.message || 'tente novamente'), false);
        }
    }

    async function continueDeposit() {
        if (!state.profile) {
            showScreen('auth');
            return;
        }

        var depositValueReais = state.depositCents / 100;
        if (depositValueReais < 20) {
            showToast('O depósito mínimo via PIX no GEN DINO é R$ 20,00.', false);
            return;
        }
        var continueBtn = document.querySelector('[data-action="deposit-continue"]');
        var originalBtnText = continueBtn ? continueBtn.innerHTML : '';

        if (continueBtn) {
            continueBtn.disabled = true;
            continueBtn.innerHTML = '<span>Gerando PIX Dotfy...</span>';
        }

        try {
            var payload = {
                amount: depositValueReais,
                customer: {
                    name: state.profile.name,
                    email: state.profile.email
                }
            };
            var res = await platformApi('/api/game/gen-dino/pix/create', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            if (res && res.success && res.data) {
                showPixOverlay(res.data);
            } else {
                showToast('Não foi possível gerar a cobrança PIX. Tente novamente.', false);
            }
        } catch (err) {
            console.error('Erro ao gerar PIX Gen Dino:', err);
            showToast(err.message || 'Erro ao comunicar com a API Dotfy.', false);
        } finally {
            if (continueBtn) {
                continueBtn.disabled = false;
                continueBtn.innerHTML = originalBtnText;
            }
        }
    }

    function focusWithdraw() {
        openWallet();
        if (elements.walletWithdrawCard) {
            window.setTimeout(function () {
                elements.walletWithdrawCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 40);
        }
    }

    function requestWithdrawal() {
        if (!state.profile) {
            showScreen('auth');
            return;
        }
        if (state.withdrawCents < WITHDRAW_MIN_CENTS) {
            showToast('O saque mínimo via PIX é ' + formatCash(WITHDRAW_MIN_CENTS) + '.', false);
            return;
        }
        if (state.withdrawCents > state.profile.cashBalance) {
            showToast('Saldo insuficiente para esse saque.', false);
            return;
        }

        state.profile.cashBalance -= state.withdrawCents;
        saveProfile();
        updateProfileUI();
        updateWalletUI();

        if (elements.walletWithdrawStatus) {
            elements.walletWithdrawStatus.hidden = false;
            elements.walletWithdrawStatus.textContent = 'Solicitação demonstrativa de ' + formatCash(state.withdrawCents) + ' criada. Conecte uma chave PIX para concluir o pagamento real.';
        }
        showToast('Saque solicitado: ' + formatCash(state.withdrawCents), true);
    }

    function navigateAwayFromGame(destination) {
        if (state.runner && state.runner.playing) {
            syncRunProgress(scoreForRunner(state.runner));
        }
        stopRunner();
        clearTrackCoins();
        hideOverlays();
        clearRun();
        setGameMessage(true);

        if (destination === 'deposit') {
            showScreen('deposit');
            updateProfileUI();
            updateDepositUI();
            return;
        }
        if (destination === 'wallet') {
            showScreen('wallet');
            updateProfileUI();
            updateWalletUI();
            return;
        }
        if (destination === 'profile') {
            showScreen('profile');
            updateProfileUI();
            setProfileFormMessage('', false);
            return;
        }

        showScreen('home');
        updateProfileUI();
    }

    function requestLeaveGame(destination) {
        if (!hasActiveBet()) {
            navigateAwayFromGame(destination || 'home');
            return;
        }

        var runner = state.runner;
        state.pendingLeaveDestination = destination || 'home';
        state.resumeAfterLeaveDialog = Boolean(runner && runner.playing && !runner.crashed);
        state.returnToPauseAfterLeaveDialog = Boolean(elements.pauseOverlay && !elements.pauseOverlay.hidden);
        if (state.resumeAfterLeaveDialog) {
            runner.stop();
        }
        if (elements.pauseOverlay) {
            elements.pauseOverlay.hidden = true;
        }
        setGameMessage(false);
        setText('[data-leave-bet]', formatCash(state.currentBetCents));
        if (elements.leaveGameOverlay) {
            elements.leaveGameOverlay.hidden = false;
        }
    }

    function cancelExitGame() {
        if (elements.leaveGameOverlay) {
            elements.leaveGameOverlay.hidden = true;
        }

        if (state.returnToPauseAfterLeaveDialog && elements.pauseOverlay) {
            elements.pauseOverlay.hidden = false;
        } else if (state.resumeAfterLeaveDialog && state.runner && !state.runner.crashed) {
            state.runner.play();
        }

        state.pendingLeaveDestination = 'home';
        state.resumeAfterLeaveDialog = false;
        state.returnToPauseAfterLeaveDialog = false;
        setGameMessage(false);
    }

    async function confirmExitGame() {
        var lostBet = state.currentBetCents;
        var destination = state.pendingLeaveDestination || 'home';
        if (IS_EMBEDDED && state.currentBetId && !state.settling) {
            state.settling = true;
            try {
                var settled = await platformApi('/api/game/gen-dino/settle', {
                    method: 'POST',
                    body: JSON.stringify({ betId: state.currentBetId, outcome: 'loss', coins: 0, score: state.currentScore })
                });
                if (state.profile) state.profile.cashBalance = Math.round(Number(settled.balance || 0) * 100);
                notifyShell('balance', { balance: Number(settled.balance || 0) });
            } catch (error) {
                showToast(error.message || 'Não foi possível encerrar a corrida.', false);
                state.settling = false;
                return;
            }
            state.settling = false;
        }
        state.lastBetCents = lostBet;
        state.currentBetCents = 0;
        state.currentBetId = '';
        state.pendingLeaveDestination = 'home';
        state.resumeAfterLeaveDialog = false;
        state.returnToPauseAfterLeaveDialog = false;
        navigateAwayFromGame(destination);
        showToast('Aposta encerrada: ' + formatCash(lostBet) + ' não foi recuperada.', false);
    }

    function returnHome() {
        if (hasActiveBet()) {
            requestLeaveGame('home');
            return;
        }
        navigateAwayFromGame('home');
    }

    function pauseGame() {
        var runner = state.runner;
        if (!runner || !runner.playing || runner.crashed) {
            showToast('Toque na pista para começar a corrida.', false);
            return;
        }

        runner.stop();
        setGameMessage(false);
        if (elements.pauseOverlay) {
            elements.pauseOverlay.hidden = false;
        }
    }

    function resumeGame() {
        var runner = state.runner;
        if (!runner || runner.crashed) {
            return;
        }

        if (elements.pauseOverlay) {
            elements.pauseOverlay.hidden = true;
        }
        setGameMessage(false);
        runner.play();
    }

    function retryGame() {
        openBetModal();
    }

    function cashoutGame() {
        var runner = state.runner;
        if (state.resultShown) {
            return;
        }
        if (!state.currentBetCents) {
            showToast('Defina uma aposta antes de iniciar a corrida.', false);
            return;
        }
        if (!runner || !runner.playing) {
            showToast('Toque na pista para começar a corrida.', false);
            return;
        }
        runner.stop();
        finishRun(true);
    }

    function setAuthMode(mode) {
        state.authMode = mode === 'register' ? 'register' : 'login';
        var isRegister = state.authMode === 'register';

        if (elements.authScreen) {
            elements.authScreen.classList.toggle('is-register', isRegister);
        }
        document.querySelectorAll('[data-auth-tab]').forEach(function (tab) {
            var active = tab.getAttribute('data-auth-tab') === state.authMode;
            tab.classList.toggle('is-active', active);
            tab.setAttribute('aria-selected', String(active));
        });

        if (elements.authSubmit) {
            elements.authSubmit.innerHTML = isRegister
                ? 'Criar conta <span>→</span>'
                : 'Entrar na conta <span>→</span>';
        }
        if (elements.authPassword) {
            elements.authPassword.autocomplete = isRegister ? 'new-password' : 'current-password';
        }
        setAuthMessage('');
    }

    function validEmail(value) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }

    async function handleAuth(event) {
        event.preventDefault();

        var email = String(elements.authEmail.value || '').trim().toLowerCase();
        var password = String(elements.authPassword.value || '');

        if (!validEmail(email)) {
            setAuthMessage('Informe um e-mail válido.');
            elements.authEmail.focus();
            return;
        }
        if (password.length < 4) {
            setAuthMessage('A senha deve ter pelo menos 4 caracteres.');
            elements.authPassword.focus();
            return;
        }

        if (state.authMode === 'register') {
            var name = String(elements.authName.value || '').trim();
            if (name.length < 2) {
                setAuthMessage('Escolha um nome com pelo menos 2 caracteres.');
                elements.authName.focus();
                return;
            }

            var refCode = searchParams.get('ref') || searchParams.get('refCode') || searchParams.get('r') || '';
            try {
                if (!refCode) {
                    refCode = window.localStorage.getItem('dino_ref_code') || window.localStorage.getItem('alliance_ref_code') || '';
                }
            } catch (e) {}

            setAuthMessage('Criando sua conta...');
            if (elements.authSubmit) elements.authSubmit.disabled = true;

            try {
                var regRes = await window.fetch('/api/auth/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Game-Origin': 'g_gen_dino',
                        'X-Game-Id': 'g_gen_dino'
                    },
                    body: JSON.stringify({
                        name: name,
                        email: email,
                        password: password,
                        phone: 'Não informado',
                        refCode: refCode,
                        registeredGame: 'g_gen_dino',
                        acquisitionGame: 'g_gen_dino',
                        game: 'g_gen_dino',
                        gameId: 'g_gen_dino',
                        trackingSource: 'gen_dino_screen'
                    })
                });
                var regData = await regRes.json().catch(function () { return {}; });
                if (!regRes.ok) {
                    throw new Error(regData.error || 'Erro ao criar conta no servidor.');
                }

                if (regData.token) {
                    urlToken = regData.token;
                    rejectedTokens = {};
                    authSyncState.lastSyncedToken = regData.token;
                    authSyncState.lastSyncTimestamp = Date.now();
                    try {
                        window.localStorage.setItem(AUTH_TOKEN_KEY, regData.token);
                        window.localStorage.setItem('paygateway_token', regData.token);
                        window.localStorage.setItem('token', regData.token);
                    } catch (e) {}
                }

                var userBalanceCents = Math.round(Number(regData.user && regData.user.balance || 0) * 100);
                state.profile = {
                    id: regData.user && regData.user.id,
                    name: (regData.user && regData.user.name) || name,
                    email: (regData.user && regData.user.email) || email,
                    password: '',
                    balance: 2500,
                    cashBalance: userBalanceCents,
                    totalCoins: 0,
                    bestScore: 0,
                    createdAt: Date.now()
                };
                saveProfile();
                updateProfileUI();
                elements.authForm.reset();
                showScreen('home');
                showToast('Conta criada com sucesso!', true);
                notifyShell('auth', { token: regData.token, user: regData.user });
                notifyShell('balance', { balance: Number(regData.user && regData.user.balance || 0) });
            } catch (err) {
                setAuthMessage(err.message || 'Erro ao criar conta.');
            } finally {
                if (elements.authSubmit) elements.authSubmit.disabled = false;
            }
            return;
        }

        // Login flow
        setAuthMessage('Entrando na conta...');
        if (elements.authSubmit) elements.authSubmit.disabled = true;

        try {
            var loginRes = await window.fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Game-Origin': 'g_gen_dino',
                    'X-Game-Id': 'g_gen_dino'
                },
                body: JSON.stringify({
                    email: email,
                    password: password,
                    game: 'g_gen_dino',
                    acquisitionGame: 'g_gen_dino'
                })
            });
            var loginData = await loginRes.json().catch(function () { return {}; });
            if (!loginRes.ok) {
                throw new Error(loginData.error || 'E-mail ou senha incorretos.');
            }

            if (loginData.token) {
                urlToken = loginData.token;
                rejectedTokens = {};
                authSyncState.lastSyncedToken = loginData.token;
                authSyncState.lastSyncTimestamp = Date.now();
                try {
                    window.localStorage.setItem(AUTH_TOKEN_KEY, loginData.token);
                    window.localStorage.setItem('paygateway_token', loginData.token);
                    window.localStorage.setItem('token', loginData.token);
                } catch (e) {}
            }

            var uBalanceCents = Math.round(Number(loginData.user && loginData.user.balance || 0) * 100);
            state.profile = {
                id: loginData.user && loginData.user.id,
                name: (loginData.user && loginData.user.name) || (loginData.user && loginData.user.email ? loginData.user.email.split('@')[0] : 'Jogador'),
                email: (loginData.user && loginData.user.email) || email,
                password: '',
                balance: 2500,
                cashBalance: uBalanceCents,
                totalCoins: 0,
                bestScore: 0,
                createdAt: Date.now()
            };
            saveProfile();
            updateProfileUI();
            elements.authForm.reset();
            showScreen('home');
            showToast('Bem-vindo, ' + state.profile.name + '!', true);
            notifyShell('auth', { token: loginData.token, user: loginData.user });
            notifyShell('balance', { balance: Number(loginData.user && loginData.user.balance || 0) });
        } catch (err) {
            setAuthMessage(err.message || 'E-mail ou senha incorretos.');
        } finally {
            if (elements.authSubmit) elements.authSubmit.disabled = false;
        }
    }

    function enterAsGuest() {
        state.profile = createProfile('Explorador', '', 'guest');
        saveProfile();
        updateProfileUI();
        elements.authForm.reset();
        showScreen('home');
    }

    function patchRunner(runner) {
        if (!runner || state.gamePatched) {
            return;
        }

        state.runner = runner;
        state.gamePatched = true;

        // The base project normally grows the game to the entire browser. The
        // mobile shell owns its dimensions, so arcade mode intentionally does
        // nothing here.
        runner.setArcadeMode = function () {};
        document.body.classList.remove('arcade-mode');

        var originalGameOver = runner.gameOver;
        runner.gameOver = function () {
            originalGameOver.call(runner);
            window.setTimeout(function () {
                if (state.currentScreen === 'game' && runner.crashed) {
                    finishRun();
                }
            }, 100);
        };
    }

    var locateRunnerAttempts = 0;
    var MAX_LOCATE_RUNNER_ATTEMPTS = 100;
    var locateRunnerTimer = null;

    function locateRunner() {
        if (state.gamePatched && state.runner) {
            return;
        }

        var runner = window.Runner && window.Runner.instance_;
        if (runner && runner.canvas && runner.distanceMeter && runner.tRex) {
            if (locateRunnerTimer) {
                window.clearTimeout(locateRunnerTimer);
                locateRunnerTimer = null;
            }
            patchRunner(runner);
            return;
        }

        // Fallback: if Runner class exists and DOM has wrapper, attempt instantiation if instance_ is missing
        if (!runner && typeof window.Runner === 'function' && document.querySelector('.interstitial-wrapper')) {
            try {
                if (!window.Runner.instance_) {
                    new window.Runner('.interstitial-wrapper');
                    runner = window.Runner.instance_;
                }
            } catch (e) {
                // Ignore fallback error
            }
        }

        locateRunnerAttempts++;
        if (locateRunnerAttempts > MAX_LOCATE_RUNNER_ATTEMPTS) {
            console.warn('GEN DINO: Runner não encontrado após limite de tentativas.');
            if (locateRunnerTimer) {
                window.clearTimeout(locateRunnerTimer);
                locateRunnerTimer = null;
            }
            return;
        }

        if (locateRunnerTimer) {
            window.clearTimeout(locateRunnerTimer);
        }
        locateRunnerTimer = window.setTimeout(locateRunner, 80);
    }

    var monitorRunActive = false;
    function monitorRun() {
        var runner = state.runner;
        if (state.currentScreen === 'game' && runner && runner.playing && !runner.crashed) {
            applyLiveConfigToRunner(runner);
            syncRunProgress(scoreForRunner(runner));
            updateTrackCoins(runner);
            setGameMessage(false);
        }
        window.requestAnimationFrame(monitorRun);
    }

    function blockRunnerOutsideTrack(event) {
        var target = event.target;
        var isInteractive = target && target.closest && target.closest('button, input, form, .bottom-nav, .game-header, .game-cashout-dock, .game-overlay');
        if (state.currentScreen !== 'game' || isInteractive) {
            event.stopImmediatePropagation();
        }
    }

    function bindActions() {
        document.querySelectorAll('[data-auth-tab]').forEach(function (tab) {
            tab.addEventListener('click', function () {
                setAuthMode(tab.getAttribute('data-auth-tab'));
            });
        });

        elements.authForm.addEventListener('submit', handleAuth);
        if (elements.guestButton) {
            elements.guestButton.addEventListener('click', enterAsGuest);
        }

        document.querySelectorAll('[data-action]').forEach(function (button) {
            button.addEventListener('click', function () {
                var action = button.getAttribute('data-action');
                if (action === 'play') {
                    openBetModal();
                } else if (action === 'bet-amount') {
                    setBetAmount(button.getAttribute('data-bet-cents'));
                } else if (action === 'confirm-bet') {
                    startGameWithBet();
                } else if (action === 'cancel-bet') {
                    closeBetModal();
                } else if (action === 'deposit') {
                    openDeposit();
                } else if (action === 'deposit-amount') {
                    setDepositAmount(button.getAttribute('data-deposit-cents'));
                } else if (action === 'deposit-continue') {
                    continueDeposit();
                } else if (action === 'withdraw-amount') {
                    setWithdrawAmount(button.getAttribute('data-withdraw-cents'));
                } else if (action === 'withdraw-continue') {
                    requestWithdrawal();
                } else if (action === 'focus-withdraw') {
                    focusWithdraw();
                } else if (action === 'back-home') {
                    returnHome();
                } else if (action === 'pause') {
                    pauseGame();
                } else if (action === 'resume') {
                    resumeGame();
                } else if (action === 'cancel-exit') {
                    cancelExitGame();
                } else if (action === 'confirm-exit') {
                    confirmExitGame();
                } else if (action === 'retry') {
                    retryGame();
                } else if (action === 'cashout') {
                    cashoutGame();
                } else if (action === 'wallet') {
                    openWallet();
                } else if (action === 'profile') {
                    openProfile();
                } else if (action === 'logout') {
                    logout();
                } else if (action === 'copy-dino-ref') {
                    copyDinoReferralLink();
                } else if (action === 'share-dino-stories') {
                    shareDinoStories();
                } else if (action === 'open-affiliate-hub') {
                    openAffiliateHubFromDino();
                } else if (action === 'close-pix-overlay') {
                    closePixOverlay();
                } else if (action === 'copy-pix') {
                    copyPixCode();
                } else if (action === 'check-pix-status') {
                    checkActivePixStatus(true);
                } else if (action === 'simulate-pix-payment') {
                    simulatePixPayment();
                } else if (action === 'set-profile-mode') {
                    setProfileMode(button.getAttribute('data-mode'));
                } else if (action === 'toggle-influencer-withdraw') {
                    toggleInfluencerWithdrawDrawer();
                } else if (action === 'inf-max-amount') {
                    var stats = state.influencerStats || {};
                    var bal = Number(stats.commissionBalance || 0);
                    if (elements.infWithdrawAmount) {
                        elements.infWithdrawAmount.value = bal > 0 ? bal.toFixed(2) : '0.00';
                    }
                } else if (action === 'favorite') {
                    var selected = button.classList.toggle('is-favorite');
                    button.setAttribute('aria-pressed', String(selected));
                    showToast(selected ? 'GEN DINO salvo nos favoritos.' : 'Removido dos favoritos.', false);
                }
            });
        });

        document.querySelectorAll('[data-nav="home"]').forEach(function (button) {
            button.addEventListener('click', returnHome);
        });
        document.querySelectorAll('[data-nav="deposit"]').forEach(function (button) {
            button.addEventListener('click', openDeposit);
        });
        document.querySelectorAll('[data-nav="wallet"]').forEach(function (button) {
            button.addEventListener('click', openWallet);
        });
        document.querySelectorAll('[data-nav="profile"]').forEach(function (button) {
            button.addEventListener('click', openProfile);
        });

        if (elements.profileForm) {
            elements.profileForm.addEventListener('submit', handleProfileForm);
        }

        if (elements.influencerWithdrawForm) {
            elements.influencerWithdrawForm.addEventListener('submit', handleInfluencerWithdrawForm);
        }

        if (elements.depositAmountInput) {
            elements.depositAmountInput.addEventListener('change', function () {
                var typedAmount = Number(
                    elements.depositAmountInput.value.replace(/\./g, '').replace(',', '.')
                );
                if (!Number.isFinite(typedAmount) || typedAmount < 20) {
                    setDepositAmount(DEPOSIT_MIN_CENTS);
                    showToast('O depósito mínimo via PIX no GEN DINO é R$ 20,00.', false);
                    return;
                }
                setDepositAmount(typedAmount * 100);
            });
        }

        if (elements.withdrawAmountInput) {
            elements.withdrawAmountInput.addEventListener('change', function () {
                var typedAmount = Number(
                    elements.withdrawAmountInput.value.replace(/\./g, '').replace(',', '.')
                );
                if (!Number.isFinite(typedAmount) || typedAmount < 1) {
                    setWithdrawAmount(0);
                    showToast('Informe um valor válido para o saque.', false);
                    return;
                }
                setWithdrawAmount(typedAmount * 100);
            });
        }

        if (elements.betAmountInput) {
            elements.betAmountInput.addEventListener('change', function () {
                var typedAmount = Number(
                    elements.betAmountInput.value.replace(/\./g, '').replace(',', '.')
                );
                if (!Number.isFinite(typedAmount) || typedAmount < 1) {
                    setBetAmount(BET_MIN_CENTS);
                    showToast('A aposta mínima é ' + formatCash(BET_MIN_CENTS) + '.', false);
                    return;
                }
                setBetAmount(typedAmount * 100);
            });
        }

        // The original game listens on the document. Capturing these events
        // keeps a login tap or a wallet click from accidentally starting a run.
        document.addEventListener('touchstart', blockRunnerOutsideTrack, true);
        document.addEventListener('mousedown', blockRunnerOutsideTrack, true);
        document.addEventListener('mouseup', blockRunnerOutsideTrack, true);
        document.addEventListener('keydown', blockRunnerOutsideTrack, true);

        if (elements.btnCopyDinoRef) {
            elements.btnCopyDinoRef.addEventListener('click', copyDinoReferralLink);
        }
        if (elements.btnShareDinoStories) {
            elements.btnShareDinoStories.addEventListener('click', shareDinoStories);
        }
        if (elements.btnViewAffiliateHub) {
            elements.btnViewAffiliateHub.addEventListener('click', openAffiliateHubFromDino);
        }
    }

    async function syncDatabaseProfile(explicitToken, force) {
        var token = explicitToken || getStoredToken();
        if (!token || rejectedTokens[token]) return false;

        var now = Date.now();
        if (!force && state.profile && authSyncState.lastSyncedToken === token && (now - authSyncState.lastSyncTimestamp < 30000)) {
            return true;
        }

        if (authSyncState.syncPromise && authSyncState.currentSyncingToken === token) {
            return authSyncState.syncPromise;
        }

        authSyncState.currentSyncingToken = token;
        authSyncState.syncPromise = (async function () {
            try {
                var data = await platformApi('/api/game/gen-dino/state', {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (data && data.user) {
                    delete rejectedTokens[token];
                    authSyncState.lastSyncTimestamp = Date.now();
                    authSyncState.lastSyncedToken = token;
                    if (data.config) {
                        state.gameConfig = Object.assign({}, data.config, {
                            isInfluencer: Boolean(data.user.isInfluencer)
                        });
                        applyLiveConfigToRunner(state.runner);
                    }
                    var prevCash = state.profile ? state.profile.cashBalance : null;
                    var newCash = Math.round(Number(data.user.balance || 0) * 100);
                    state.profile = {
                        id: data.user.id,
                        name: String(data.user.name || (data.user.email ? data.user.email.split('@')[0] : 'Jogador')),
                        email: String(data.user.email || ''),
                        password: '',
                        referralCode: String(data.user.referralCode || (state.profile && state.profile.referralCode) || data.user.id || '').trim().toUpperCase(),
                        affiliateId: String(data.user.affiliateId || (state.profile && state.profile.affiliateId) || ''),
                        balance: 2500,
                        cashBalance: newCash,
                        isInfluencer: Boolean(data.user.isInfluencer),
                        totalCoins: (state.profile && state.profile.totalCoins) || 0,
                        bestScore: (state.profile && state.profile.bestScore) || 0,
                        createdAt: (state.profile && state.profile.createdAt) || Date.now()
                    };
                    saveProfile();
                    updateProfileUI();

                    // CRITICAL: Never force-navigate to 'home' if the user is already in 'game' or another screen
                    if (state.currentScreen === 'auth' || !state.currentScreen) {
                        showScreen('home');
                    }

                    if (prevCash !== null && Math.abs(prevCash - newCash) > 0) {
                        notifyShell('balance', { balance: Number(data.user.balance || 0) });
                    }
                    applyLiveConfigToRunner(state.runner);
                    return true;
                }
            } catch (error) {
                console.warn('Gen Dino profile sync warning:', (error && error.message) || error);
                var isExplicit401 = Boolean(error && (error.status === 401 || error.status === 403));
                if (isExplicit401) {
                    rejectedTokens[token] = true;
                    if (urlToken === token) urlToken = '';
                    try {
                        window.localStorage.removeItem(AUTH_TOKEN_KEY);
                        window.localStorage.removeItem('paygateway_token');
                        window.localStorage.removeItem('token');
                        window.sessionStorage.removeItem(AUTH_TOKEN_KEY);
                    } catch (e) {}
                    authSyncState.lastSyncedToken = '';
                    // Never kick out to auth during active gameplay
                    if (state.currentScreen !== 'game') {
                        state.profile = null;
                        try {
                            window.localStorage.removeItem(STORAGE_KEY);
                        } catch (e) {}
                        showScreen('auth');
                        setAuthMode('login');
                        setAuthMessage('Sua sessão expirou. Faça login novamente.');
                    }
                }
            } finally {
                authSyncState.syncPromise = null;
                authSyncState.currentSyncingToken = '';
            }
            return false;
        })();

        return authSyncState.syncPromise;
    }

    async function initEmbeddedProfile() {
        var token = getStoredToken();
        var saved = readProfile();

        if (saved) {
            state.profile = saved;
            updateProfileUI();
            if (state.currentScreen === 'auth' || !state.currentScreen) {
                showScreen('home');
            }
        }

        if (token && !rejectedTokens[token]) {
            await syncDatabaseProfile(token, false);
            return;
        }

        if (!state.profile && !getStoredToken()) {
            showScreen('auth');
            setAuthMode('login');
        }
    }

    async function pollLiveGameConfig() {
        try {
            var token = getStoredToken();
            if (token && !rejectedTokens[token]) {
                var data = await platformApi('/api/game/gen-dino/state', {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (data && data.config) {
                    state.gameConfig = Object.assign({}, state.gameConfig || {}, data.config, {
                        isInfluencer: Boolean(data.user && data.user.isInfluencer)
                    });
                    applyLiveConfigToRunner(state.runner);
                }
                if (data && data.user && state.profile) {
                    var newCash = Math.round(Number(data.user.balance || 0) * 100);
                    if (state.profile.cashBalance !== newCash) {
                        state.profile.cashBalance = newCash;
                        saveProfile();
                        updateProfileUI();
                    }
                    state.profile.isInfluencer = Boolean(data.user.isInfluencer);
                }
            } else {
                var res = await window.fetch('/api/games/g_gen_dino/config');
                if (res.ok) {
                    var publicCfg = await res.json();
                    if (publicCfg) {
                        state.gameConfig = Object.assign({}, state.gameConfig || {}, publicCfg);
                        applyLiveConfigToRunner(state.runner);
                    }
                }
            }
        } catch (_) {}
    }

    window.addEventListener('message', function (event) {
        if (!event.data) return;
        if (event.data.source === 'gen-dino-parent' || event.data.type === 'set-session' || event.data.type === 'auth-token' || event.data.type === 'sync-user') {
            var incomingToken = event.data.token;
            if (incomingToken && !isTokenExpired(incomingToken) && !rejectedTokens[incomingToken]) {
                urlToken = incomingToken;
                try {
                    window.localStorage.setItem(AUTH_TOKEN_KEY, incomingToken);
                    window.localStorage.setItem('paygateway_token', incomingToken);
                    window.localStorage.setItem('token', incomingToken);
                } catch (e) {}
                if (authSyncState.lastSyncedToken !== incomingToken || !state.profile) {
                    syncDatabaseProfile(incomingToken, false);
                }
            }
            if (typeof event.data.balance === 'number') {
                var incomingCash = Math.round(event.data.balance * 100);
                if (state.profile && state.profile.cashBalance !== incomingCash) {
                    state.profile.cashBalance = incomingCash;
                    saveProfile();
                    updateProfileUI();
                    applyLiveConfigToRunner(state.runner);
                }
            }
            if (typeof event.data.isInfluencer === 'boolean') {
                var inflChanged = false;
                if (state.profile && state.profile.isInfluencer !== event.data.isInfluencer) {
                    state.profile.isInfluencer = event.data.isInfluencer;
                    saveProfile();
                    inflChanged = true;
                }
                if (state.gameConfig && state.gameConfig.isInfluencer !== event.data.isInfluencer) {
                    state.gameConfig.isInfluencer = event.data.isInfluencer;
                    inflChanged = true;
                }
                if (inflChanged) {
                    applyLiveConfigToRunner(state.runner);
                }
            }
            if (event.data.referralCode && typeof event.data.referralCode === 'string') {
                var incCode = event.data.referralCode.trim().toUpperCase();
                if (state.profile && state.profile.referralCode !== incCode) {
                    state.profile.referralCode = incCode;
                    saveProfile();
                    updateProfileUI();
                }
            }
        }

        // Live Real-Time Config Updates from Admin Panel
        if (event.data.type === 'config-update' || event.data.type === 'sync-config' || event.data.event === 'update_game_config' || event.data.config) {
            var incomingCfg = event.data.config || event.data;
            if (incomingCfg && typeof incomingCfg === 'object') {
                state.gameConfig = Object.assign({}, state.gameConfig || {}, incomingCfg);
                applyLiveConfigToRunner(state.runner);
            }
        }
    });

    var appInitStarted = false;
    var appInitialized = false;

    function init() {
        if (appInitStarted || appInitialized) {
            return;
        }
        appInitStarted = true;

        elements = {
            appShell: byId('app-shell'),
            authScreen: byId('auth-screen'),
            authForm: byId('auth-form'),
            authName: byId('auth-name'),
            authEmail: byId('auth-email'),
            authPassword: byId('auth-password'),
            authMessage: byId('auth-message'),
            authSubmit: byId('auth-submit'),
            guestButton: byId('guest-button'),
            pauseOverlay: byId('pause-overlay'),
            resultOverlay: byId('result-overlay'),
            betOverlay: byId('bet-overlay'),
            leaveGameOverlay: byId('leave-game-overlay'),
            gameMessage: byId('game-message'),
            coinTrack: byId('runner-coin-track'),
            cashoutButton: document.querySelector('.game-cashout-button'),
            betAmountInput: byId('bet-amount-input'),
            depositAmountInput: byId('deposit-amount-input'),
            depositCard: document.querySelector('.deposit-card'),
            depositBonusPreview: byId('deposit-bonus-preview'),
            depositBonusChestImage: byId('deposit-bonus-chest-image'),
            withdrawAmountInput: byId('withdraw-amount-input'),
            walletWithdrawCard: byId('wallet-withdraw-card'),
            walletWithdrawStatus: byId('wallet-withdraw-status'),
            profileForm: byId('profile-form'),
            profileNameInput: byId('profile-name-input'),
            profileEmailInput: byId('profile-email-input'),
            profilePasswordInput: byId('profile-password-input'),
            profileFormMessage: byId('profile-form-message'),
            profileRefCode: byId('profile-ref-code'),
            profileReferralLinkInput: byId('profile-referral-link-input'),
            btnCopyDinoRef: byId('btn-copy-dino-ref'),
            btnShareDinoStories: byId('btn-share-dino-stories'),
            btnViewAffiliateHub: byId('btn-view-affiliate-hub'),
            referralFeedbackText: byId('referral-feedback-text'),
            pixDepositOverlay: byId('pix-deposit-overlay'),
            pixModalAmount: byId('pix-modal-amount'),
            pixModalBonusRow: byId('pix-modal-bonus-row'),
            pixModalBonusVal: byId('pix-modal-bonus-val'),
            pixQrcodeImg: byId('pix-qrcode-img'),
            pixCopiaColaInput: byId('pix-copia-cola-input'),
            pixStatusText: byId('pix-status-text'),
            pixTimerText: byId('pix-timer-text'),
            pixCopyBtn: byId('pix-copy-btn'),
            btnModePlayer: byId('btn-mode-player'),
            btnModeInfluencer: byId('btn-mode-influencer'),
            profilePanelPlayer: byId('profile-panel-player'),
            profilePanelInfluencer: byId('profile-panel-influencer'),
            infSponsorName: byId('inf-sponsor-name'),
            infSponsorCode: byId('inf-sponsor-code'),
            infTotalDeposits: byId('inf-total-deposits'),
            infPaidDeposits: byId('inf-paid-deposits'),
            infPaidDepositsSub: byId('inf-paid-deposits-sub'),
            infReferralsCount: byId('inf-referrals-count'),
            infCommissionBalance: byId('inf-commission-balance'),
            btnOpenInfluencerWithdraw: byId('btn-open-influencer-withdraw'),
            influencerWithdrawDrawer: byId('influencer-withdraw-drawer'),
            influencerWithdrawForm: byId('influencer-withdraw-form'),
            infPixType: byId('inf-pix-type'),
            infPixKey: byId('inf-pix-key'),
            infWithdrawAmount: byId('inf-withdraw-amount'),
            infWithdrawMaxLabel: byId('inf-withdraw-max-label'),
            btnInfMaxAmount: byId('btn-inf-max-amount'),
            infWithdrawMessage: byId('inf-withdraw-message'),
            btnSubmitInfWithdraw: byId('btn-submit-inf-withdraw'),
            influencerRequestsList: byId('influencer-requests-list')
        };

        updateProfileUI();
        updateRunUI();
        updateBetUI();
        updateDepositUI();
        updateWalletUI();
        renderAppIcons();
        bindActions();
        locateRunner();
        if (!monitorRunActive) {
            monitorRunActive = true;
            monitorRun();
        }
        initEmbeddedProfile();

        if (!state.pollIntervalId) {
            state.pollIntervalId = window.setInterval(pollLiveGameConfig, 4000);
            window.addEventListener('focus', function () { pollLiveGameConfig(); });
            document.addEventListener('visibilitychange', function () {
                if (!document.hidden) pollLiveGameConfig();
            });
        }

        appInitialized = true;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
