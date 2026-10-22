'use strict';
/*
 * Resolution Switcher – Stream Dock / Ajazz AKP03E plugin
 * Each key press switches the screen to the next mode of the user's list.
 * Long press (0.7 s) restores the original resolution.
 */
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const display = require('./display');

// ---------- tiny logger (never throws) ----------
const LOG_DIR = path.join(__dirname, 'log');
const LOG_FILE = path.join(LOG_DIR, 'plugin.log');
function log(...args) {
    try {
        fs.mkdirSync(LOG_DIR, { recursive: true });
        try { if (fs.statSync(LOG_FILE).size > 512 * 1024) fs.renameSync(LOG_FILE, LOG_FILE + '.old'); } catch { }
        const line = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
        fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${line}\n`);
    } catch { }
}
process.on('uncaughtException', e => log('uncaughtException', String(e && e.stack || e)));
process.on('unhandledRejection', e => log('unhandledRejection', String(e && e.stack || e)));

// ---------- Stream Dock connection ----------
// argv: -port <port> -pluginUUID <uuid> -registerEvent <event> -info <json>
const argv = process.argv;
const PORT = argv[argv.indexOf('-port') + 1];
const PLUGIN_UUID = argv[argv.indexOf('-pluginUUID') + 1];
const REGISTER_EVENT = argv[argv.indexOf('-registerEvent') + 1];

const ACTION_UUID = 'com.xamyp.resolutionswitcher.cycle';
const LONG_PRESS_MS = 700;
const POLL_MS = 2000;

const DEFAULT_SETTINGS = { screen: '', modes: [], persist: true, scaling: 'default' };

const contexts = new Map(); // context -> { settings, lastKey, pressTimer, longDone }
let globalSettings = { originals: {} };
let busy = false;

const ws = new WebSocket('ws://127.0.0.1:' + PORT);
const send = obj => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj)); };

ws.on('open', () => {
    send({ event: REGISTER_EVENT, uuid: PLUGIN_UUID });
    send({ event: 'getGlobalSettings', context: PLUGIN_UUID });
    log('connected');
});
// Stream Dock quits (or Windows shuts down): leave immediately, nothing to clean up.
ws.on('close', () => process.exit(0));
ws.on('error', e => { log('ws error', String(e)); process.exit(0); });
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));

ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    const { event, context, payload = {} } = msg;
    try {
        switch (event) {
            case 'didReceiveGlobalSettings':
                globalSettings = Object.assign({ originals: {} }, payload.settings || {});
                break;
            case 'willAppear':
                contexts.set(context, { settings: withDefaults(payload.settings), lastKey: '' });
                refreshKey(context, true);
                break;
            case 'willDisappear':
                clearTimeout(contexts.get(context)?.pressTimer);
                contexts.delete(context);
                break;
            case 'didReceiveSettings': {
                const c = contexts.get(context);
                if (c) { c.settings = withDefaults(payload.settings); refreshKey(context, true); }
                break;
            }
            case 'keyDown': onKeyDown(context); break;
            case 'keyUp': onKeyUp(context); break;
            case 'propertyInspectorDidAppear': sendState(context, msg.action); break;
            case 'sendToPlugin': onPiMessage(context, msg.action, payload); break;
        }
    } catch (e) {
        log('handler error', event, String(e && e.stack || e));
    }
});

function withDefaults(s) {
    const out = Object.assign({}, DEFAULT_SETTINGS, s || {});
    out.modes = Array.isArray(out.modes) ? out.modes.filter(m => m && m.w && m.h && m.hz) : [];
    return out;
}

const sameMode = (a, b) => a && b && a.w === b.w && a.h === b.h && a.hz === b.hz;
const label = m => `${m.w}x${m.h} @ ${m.hz} Hz`;

// ---------- key presses ----------
function onKeyDown(context) {
    const c = contexts.get(context);
    if (!c) return;
    c.longDone = false;
    clearTimeout(c.pressTimer);
    c.pressTimer = setTimeout(() => { c.longDone = true; restoreOriginal(context); }, LONG_PRESS_MS);
}

function onKeyUp(context) {
    const c = contexts.get(context);
    if (!c) return;
    clearTimeout(c.pressTimer);
    if (!c.longDone) cycle(context);
}

function cycle(context) {
    const c = contexts.get(context);
    const { modes } = c.settings;
    if (!modes.length) { send({ event: 'showAlert', context }); return; }
    const screen = display.resolveScreen(c.settings.screen);
    if (!screen) { send({ event: 'showAlert', context }); return; }
    const current = display.getCurrent(screen.name);
    const idx = modes.findIndex(m => sameMode(m, current));
    const next = modes[(idx + 1) % modes.length]; // not in list -> first mode
    apply(context, screen.name, next);
}

function restoreOriginal(context) {
    const c = contexts.get(context);
    const screen = display.resolveScreen(c.settings.screen);
    const original = screen && globalSettings.originals[screen.name];
    if (!original) { send({ event: 'showAlert', context }); return; }
    apply(context, screen.name, original, true);
}

function apply(context, screenName, mode, isRestore = false) {
    if (busy) return;
    const c = contexts.get(context);
    const current = display.getCurrent(screenName);
    if (sameMode(current, mode)) { refreshKey(context, true); return; }

    // Remember the original mode once, before the very first change on this screen.
    if (!isRestore && current && !globalSettings.originals[screenName]) {
        globalSettings.originals[screenName] = current;
        send({ event: 'setGlobalSettings', context: PLUGIN_UUID, payload: globalSettings });
    }

    busy = true;
    try {
        const res = display.applyMode(screenName, mode, { persist: c.settings.persist, scaling: c.settings.scaling });
        log(isRestore ? 'restore' : 'apply', screenName, label(mode), res);
        if (!res.ok) send({ event: 'showAlert', context });
    } finally {
        busy = false;
    }
    refreshAll(true);
}

// ---------- key image ----------
function keySvg(mode, index, count) {
    const res = mode ? `${mode.w}x${mode.h}` : '---';
    const hz = mode ? `${mode.hz} Hz` : '';
    const fs1 = Math.min(30, Math.floor(132 / (res.length * 0.6)));
    let dots = '';
    if (count > 1 && count <= 8) {
        const gap = 14, start = 72 - ((count - 1) * gap) / 2;
        for (let i = 0; i < count; i++) {
            const on = i === index;
            dots += `<circle cx="${start + i * gap}" cy="122" r="${on ? 5 : 4}" fill="${on ? 'rgb(0,200,255)' : 'none'}" stroke="rgb(0,200,255)" stroke-width="2"/>`;
        }
    }
    return `<svg width="144" height="144" xmlns="http://www.w3.org/2000/svg">`
        + `<rect width="144" height="144" fill="rgb(18,18,24)"/>`
        + `<text x="72" y="54" font-family="Arial" font-weight="bold" font-size="${fs1}" fill="white" text-anchor="middle">${res}</text>`
        + `<text x="72" y="98" font-family="Arial" font-weight="bold" font-size="36" fill="rgb(0,200,255)" text-anchor="middle">${hz}</text>`
        + dots + `</svg>`;
}

function refreshKey(context, force = false) {
    const c = contexts.get(context);
    if (!c) return;
    let current = null;
    try {
        const screen = display.resolveScreen(c.settings.screen);
        current = screen && display.getCurrent(screen.name);
    } catch (e) { log('read error', String(e)); }
    const idx = c.settings.modes.findIndex(m => sameMode(m, current));
    const key = `${current ? label(current) : '-'}|${idx}|${c.settings.modes.length}`;
    if (!force && key === c.lastKey) return;
    c.lastKey = key;
    const svg = keySvg(current, idx, c.settings.modes.length);
    send({ event: 'setImage', context, payload: { target: 0, image: 'data:image/svg+xml;charset=utf8,' + svg } });
}

function refreshAll(force = false) {
    for (const ctx of contexts.keys()) refreshKey(ctx, force);
}
// Catches changes made elsewhere (Windows Settings, a game, another key)
setInterval(() => refreshAll(false), POLL_MS).unref();

// ---------- Property Inspector ----------
function sendState(context, action, screenOverride) {
    const c = contexts.get(context);
    const settings = c ? c.settings : withDefaults();
    let payload;
    try {
        const screens = display.listScreens();
        const screen = display.resolveScreen(screenOverride !== undefined ? screenOverride : settings.screen);
        payload = {
            type: 'state',
            screens,
            screen: screen ? screen.name : '',
            modes: screen ? display.listModes(screen.name).map(({ w, h, hz }) => ({ w, h, hz })) : [],
            current: screen ? display.getCurrent(screen.name) : null,
            original: screen ? (globalSettings.originals[screen.name] || null) : null
        };
    } catch (e) {
        log('state error', String(e && e.stack || e));
        payload = { type: 'error', message: String(e && e.message || e) };
    }
    send({ event: 'sendToPropertyInspector', action: action || ACTION_UUID, context, payload });
}

function onPiMessage(context, action, payload) {
    switch (payload.cmd) {
        case 'refresh':
            sendState(context, action, payload.screen);
            break;
        case 'restore':
            restoreOriginal(context);
            setTimeout(() => sendState(context, action), 300);
            break;
        case 'setOriginal': {
            const c = contexts.get(context);
            const screen = display.resolveScreen(c ? c.settings.screen : '');
            if (screen) {
                globalSettings.originals[screen.name] = display.getCurrent(screen.name);
                send({ event: 'setGlobalSettings', context: PLUGIN_UUID, payload: globalSettings });
            }
            sendState(context, action);
            break;
        }
    }
}
