/*
 * DIAGNÓSTICO DO LOOP DE LOGIN — GEN DINO
 * ------------------------------------------------------------
 * Este arquivo NÃO altera o comportamento do jogo. Ele só observa
 * e imprime no console do navegador tudo que pode estar causando
 * o retorno para a tela de login:
 *   - todas as chamadas à API (/api/...) e o status de resposta
 *   - toda vez que o token de login é salvo/removido do localStorage
 *   - toda troca de tela dentro do jogo (ex: home -> auth)
 *   - mensagens recebidas via postMessage (comunicação com o app pai)
 *   - se a PÁGINA INTEIRA recarrega (isso é diferente de só trocar de tela)
 *   - erros de JavaScript não tratados
 *
 * COMO USAR:
 * 1. Coloque este arquivo em: public/gen-dino/js/debug-console.js
 * 2. No public/gen-dino/index.html, adicione a linha abaixo como o
 *    PRIMEIRO <script> dentro do <head>, ANTES de script.js/app.js:
 *
 *      <script src="js/debug-console.js"></script>
 *
 * 3. Publique/reinicie o site, abra o jogo, reproduza o problema.
 * 4. Abra o Console do navegador (F12 -> aba "Console").
 * 5. Quando o loop acontecer, rode no console:
 *
 *      copy(JSON.stringify(window.__dinoDebugLog, null, 2))
 *
 *    Isso copia todo o histórico para a área de transferência.
 *    Cole esse conteúdo de volta pra mim.
 *
 * (Pode remover este arquivo e a linha do index.html depois de
 * resolvido — ele é só uma ferramenta temporária de investigação.)
 * ------------------------------------------------------------
 */
(function () {
    'use strict';

    window.__dinoDebugLog = window.__dinoDebugLog || [];

    function nowIso() {
        return new Date().toISOString().split('T')[1].replace('Z', '');
    }

    function safeStringify(obj, max) {
        try {
            var s = JSON.stringify(obj);
            return s && s.length > (max || 300) ? s.slice(0, max || 300) + '…' : s;
        } catch (e) {
            return String(obj);
        }
    }

    function dlog(tag, data, style) {
        var entry = { hora: nowIso(), tag: tag, data: data };
        window.__dinoDebugLog.push(entry);
        if (window.__dinoDebugLog.length > 800) window.__dinoDebugLog.shift();
        try {
            console.log('%c[DINO-DEBUG ' + entry.hora + '] ' + tag, style || 'color:#0af', data || '');
        } catch (e) {}
    }

    // 1. Marca claramente cada carregamento/recarregamento da página inteira
    (function logPageLoad() {
        var navType = 'desconhecido';
        try {
            if (performance.getEntriesByType) {
                var navEntries = performance.getEntriesByType('navigation');
                if (navEntries && navEntries[0]) navType = navEntries[0].type;
            } else if (performance.navigation) {
                navType = ['navigate', 'reload', 'back_forward', 'reserved'][performance.navigation.type] || 'desconhecido';
            }
        } catch (e) {}
        console.log(
            '%c[DINO-DEBUG] ══════ PÁGINA (RE)CARREGADA — tipo: ' + navType + ' — ' + window.location.href + ' ══════',
            'background:#111;color:#0f0;font-weight:bold;padding:3px 8px'
        );
        dlog('PAGE_LOAD', { tipoNavegacao: navType, url: window.location.href });
    })();

    window.addEventListener('beforeunload', function () {
        console.log('%c[DINO-DEBUG] ⚠️ A PÁGINA VAI RECARREGAR OU FECHAR AGORA (beforeunload)', 'background:#222;color:#fa0;font-weight:bold;padding:3px 8px');
        dlog('BEFORE_UNLOAD', {});
    });

    // 2. Observa todas as chamadas fetch (API)
    var _origFetch = window.fetch;
    window.fetch = function (input, init) {
        var url = typeof input === 'string' ? input : (input && input.url) || '';
        var method = (init && init.method) || 'GET';
        var hasAuthHeader = !!(init && init.headers && (init.headers.Authorization || init.headers.authorization));
        var start = Date.now();
        dlog('FETCH →', { method: method, url: url, comToken: hasAuthHeader });
        return _origFetch.apply(this, arguments).then(function (res) {
            var ms = Date.now() - start;
            try {
                res.clone().text().then(function (bodyText) {
                    var preview = bodyText ? bodyText.slice(0, 250) : '';
                    if (res.status === 401) {
                        console.warn(
                            '%c[DINO-DEBUG] 🔴 401 NÃO AUTORIZADO em ' + url + ' (' + ms + 'ms)',
                            'background:#900;color:#fff;font-weight:bold;padding:3px 8px',
                            preview
                        );
                    }
                    dlog(res.ok ? 'FETCH ✓ ' + res.status : 'FETCH ✗ ' + res.status, { method: method, url: url, ms: ms, corpo: preview });
                }).catch(function () {});
            } catch (e) {}
            return res;
        }).catch(function (err) {
            dlog('FETCH ERRO DE REDE', { method: method, url: url, erro: String(err), ms: Date.now() - start });
            return Promise.reject(err);
        });
    };

    // 3. Observa leitura/escrita/remoção do token de login no localStorage
    var WATCHED_KEYS = ['pg_auth_token', 'paygateway_token', 'token', 'gen-dino-mobile-profile-v1'];
    var _origSetItem = Storage.prototype.setItem;
    var _origRemoveItem = Storage.prototype.removeItem;
    Storage.prototype.setItem = function (key, value) {
        if (WATCHED_KEYS.indexOf(key) !== -1) {
            dlog('localStorage.setItem("' + key + '")', {
                valorInicio: String(value).slice(0, 24) + '…',
                origem: (new Error().stack || '').split('\n').slice(1, 4).join(' | ')
            });
        }
        return _origSetItem.call(this, key, value);
    };
    Storage.prototype.removeItem = function (key) {
        if (WATCHED_KEYS.indexOf(key) !== -1) {
            console.warn('%c[DINO-DEBUG] ⚠️ localStorage.removeItem("' + key + '")', 'color:#f80;font-weight:bold');
            dlog('localStorage.removeItem("' + key + '") ⚠️', {
                origem: (new Error().stack || '').split('\n').slice(1, 4).join(' | ')
            });
        }
        return _origRemoveItem.call(this, key);
    };

    // 4. Observa troca de telas dentro do jogo (ex: home -> auth)
    function watchScreens() {
        var shell = document.getElementById('app-shell');
        if (!shell) return;
        var lastActive = null;
        var observer = new MutationObserver(function () {
            var activeEl = shell.querySelector('.screen.is-active');
            var id = activeEl ? activeEl.id : null;
            if (id !== lastActive) {
                var info = {
                    de: lastActive,
                    para: id,
                    tokens: {
                        pg_auth_token: !!localStorage.getItem('pg_auth_token'),
                        paygateway_token: !!localStorage.getItem('paygateway_token'),
                        token: !!localStorage.getItem('token')
                    }
                };
                if (id === 'auth-screen' && lastActive && lastActive !== 'auth-screen') {
                    console.error(
                        '%c[DINO-DEBUG] 🔴🔴🔴 VOLTOU PARA A TELA DE LOGIN (' + lastActive + ' → auth-screen) 🔴🔴🔴',
                        'background:#900;color:#fff;font-weight:bold;padding:4px 10px;font-size:13px'
                    );
                }
                dlog('TROCA_DE_TELA', info);
                lastActive = id;
            }
        });
        observer.observe(shell, { subtree: true, attributes: true, attributeFilter: ['class'] });
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', watchScreens, { once: true });
    } else {
        watchScreens();
    }

    // 5. Observa mensagens recebidas de fora do iframe (comunicação com o app pai)
    window.addEventListener('message', function (ev) {
        dlog('postMessage recebido', { origin: ev.origin, dados: safeStringify(ev.data) });
    });

    // 6. Observa quando a aba fica em segundo plano / volta a ficar visível
    document.addEventListener('visibilitychange', function () {
        dlog('visibilitychange', { oculto: document.hidden });
    });

    // 7. Captura erros de JS e promises rejeitadas sem tratamento
    window.addEventListener('error', function (e) {
        dlog('ERRO_JS', { mensagem: e.message, arquivo: e.filename, linha: e.lineno });
    });
    window.addEventListener('unhandledrejection', function (e) {
        dlog('PROMISE_REJEITADA', { motivo: String(e.reason) });
    });

    // Função utilitária para ver/exportar o histórico completo a qualquer momento
    window.__dinoDebugDump = function () {
        console.log(JSON.stringify(window.__dinoDebugLog, null, 2));
        return window.__dinoDebugLog;
    };

    console.log(
        '%c[DINO-DEBUG] Script de diagnóstico ativo. Reproduza o problema e depois rode no console:\ncopy(JSON.stringify(window.__dinoDebugLog, null, 2))\n(isso copia o histórico completo para colar de volta)',
        'color:#0af;font-weight:bold'
    );
})();
