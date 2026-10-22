'use strict';
let ws, piUUID, actionUUID;
let settings = { screen: '', modes: [], persist: true, scaling: 'default' };
let state = { screens: [], modes: [], current: null, original: null, screen: '' };

const EN = {
    Screen: 'Screen', Cycle: 'Cycle list', EmptyList: 'No resolution yet. Add some with “+”.',
    Options: 'Options', Apply: 'Apply mode', Permanent: 'Like Windows (permanent)',
    Temporary: 'Temporary (until reboot)', Scaling: 'Scaling', ScaleDefault: 'Let Windows decide',
    ScaleStretch: 'Stretch (full screen)', ScaleCenter: 'Center (black bars)',
    Original: 'Original resolution', Restore: 'Restore', SetOriginal: 'Save current',
    Hint: 'Short press: next mode. Long press: back to the original resolution.',
    Primary: 'primary', Current: 'Current', None: 'Not saved yet (saved before the first change)'
};
const FR = { Primary: 'principal', Current: 'Actuelle', None: 'Pas encore mémorisée (enregistrée avant le 1er changement)' };
let T = FR;

const $ = id => document.getElementById(id);
const label = m => `${m.w} × ${m.h} — ${m.hz} Hz`;
const same = (a, b) => a && b && a.w === b.w && a.h === b.h && a.hz === b.hz;

// Called by Stream Dock when the Property Inspector opens
function connectElgatoStreamDeckSocket(port, uuid, registerEvent, appInfo, actionInfo) {
    piUUID = uuid;
    try {
        const info = JSON.parse(actionInfo);
        actionUUID = info.action;
        settings = Object.assign(settings, info.payload && info.payload.settings || {});
    } catch { }
    try {
        const lang = JSON.parse(appInfo).application.language || 'fr';
        if (!lang.startsWith('fr')) translate();
    } catch { }

    ws = new WebSocket('ws://127.0.0.1:' + port);
    ws.onopen = () => {
        ws.send(JSON.stringify({ event: registerEvent, uuid }));
        toPlugin({ cmd: 'refresh' });
        render();
    };
    ws.onmessage = e => {
        const msg = JSON.parse(e.data);
        if (msg.event === 'didReceiveSettings') {
            settings = Object.assign(settings, msg.payload.settings || {});
            render();
        } else if (msg.event === 'sendToPropertyInspector') {
            const p = msg.payload || {};
            if (p.type === 'state') { state = p; render(); }
            else if (p.type === 'error') $('current').textContent = '⚠ ' + p.message;
        }
    };
}
const connectSocket = connectElgatoStreamDeckSocket;

function translate() {
    T = EN;
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const k = el.dataset.i18n;
        if (EN[k]) el.textContent = EN[k];
    });
}

function toPlugin(payload) {
    ws && ws.send(JSON.stringify({ event: 'sendToPlugin', action: actionUUID, context: piUUID, payload }));
}
function save() {
    ws && ws.send(JSON.stringify({ event: 'setSettings', context: piUUID, payload: settings }));
}

function render() {
    // screens
    const sel = $('screen');
    sel.innerHTML = '';
    state.screens.forEach((s, i) => {
        const o = document.createElement('option');
        o.value = s.primary && !settings.screen ? '' : s.name;
        const num = s.name.replace(/^\\\\\.\\/, '');
        o.textContent = `${num}${s.monitor ? ' — ' + s.monitor : ''}${s.primary ? ' (' + T.Primary + ')' : ''}`;
        o.selected = s.name === state.screen;
        sel.appendChild(o);
    });

    $('current').textContent = state.current ? `${T.Current} : ${label(state.current)}` : '…';
    $('original').textContent = state.original ? label(state.original) : T.None;

    // cycle list
    const ul = $('list');
    ul.innerHTML = '';
    settings.modes.forEach((m, i) => {
        const li = document.createElement('li');
        if (same(m, state.current)) li.className = 'active';
        li.innerHTML = `<span>${i + 1}. ${label(m)}</span>`;
        const mk = (txt, cls, fn, disabled) => {
            const b = document.createElement('button');
            b.textContent = txt; if (cls) b.className = cls; b.disabled = !!disabled;
            b.onclick = fn; li.appendChild(b);
        };
        mk('▲', '', () => move(i, -1), i === 0);
        mk('▼', '', () => move(i, 1), i === settings.modes.length - 1);
        mk('✕', 'del', () => { settings.modes.splice(i, 1); save(); render(); });
        ul.appendChild(li);
    });
    $('empty').style.display = settings.modes.length ? 'none' : 'block';

    // available modes, grouped by resolution
    const ms = $('modeSelect');
    const keep = ms.value;
    ms.innerHTML = '';
    const groups = new Map();
    state.modes.forEach(m => {
        const k = `${m.w} × ${m.h}`;
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(m);
    });
    for (const [k, list] of groups) {
        const g = document.createElement('optgroup');
        g.label = k;
        list.forEach(m => {
            const o = document.createElement('option');
            o.value = `${m.w}x${m.h}@${m.hz}`;
            o.textContent = label(m) + (same(m, state.current) ? '  ●' : '');
            g.appendChild(o);
        });
        ms.appendChild(g);
    }
    if (keep) ms.value = keep;

    $('persist').value = settings.persist === false ? '0' : '1';
    $('scaling').value = settings.scaling || 'default';
}

function move(i, d) {
    const j = i + d;
    if (j < 0 || j >= settings.modes.length) return;
    [settings.modes[i], settings.modes[j]] = [settings.modes[j], settings.modes[i]];
    save(); render();
}

$('addBtn').onclick = () => {
    const v = $('modeSelect').value;
    const m = /^(\d+)x(\d+)@(\d+)$/.exec(v);
    if (!m) return;
    const mode = { w: +m[1], h: +m[2], hz: +m[3] };
    if (settings.modes.some(x => same(x, mode))) return;
    settings.modes.push(mode);
    save(); render();
};
$('screen').onchange = e => {
    settings.screen = e.target.value;
    save();
    toPlugin({ cmd: 'refresh', screen: settings.screen });
};
$('persist').onchange = e => { settings.persist = e.target.value === '1'; save(); };
$('scaling').onchange = e => { settings.scaling = e.target.value; save(); };
$('restoreBtn').onclick = () => toPlugin({ cmd: 'restore' });
$('setOriginalBtn').onclick = () => toPlugin({ cmd: 'setOriginal' });
