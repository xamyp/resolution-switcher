// Win32 display helpers (user32.dll via koffi, no child process, no admin rights).
'use strict';
const koffi = require('koffi');

const DISPLAY_DEVICEW = koffi.struct('DISPLAY_DEVICEW', {
    cb: 'uint32_t',
    DeviceName: koffi.array('char16_t', 32, 'String'),
    DeviceString: koffi.array('char16_t', 128, 'String'),
    StateFlags: 'uint32_t',
    DeviceID: koffi.array('char16_t', 128, 'String'),
    DeviceKey: koffi.array('char16_t', 128, 'String')
});

// DEVMODEW, "display" variant of the union (220 bytes)
const DEVMODEW = koffi.struct('DEVMODEW', {
    dmDeviceName: koffi.array('char16_t', 32, 'String'),
    dmSpecVersion: 'uint16_t',
    dmDriverVersion: 'uint16_t',
    dmSize: 'uint16_t',
    dmDriverExtra: 'uint16_t',
    dmFields: 'uint32_t',
    dmPositionX: 'int32_t',
    dmPositionY: 'int32_t',
    dmDisplayOrientation: 'uint32_t',
    dmDisplayFixedOutput: 'uint32_t',
    dmColor: 'int16_t',
    dmDuplex: 'int16_t',
    dmYResolution: 'int16_t',
    dmTTOption: 'int16_t',
    dmCollate: 'int16_t',
    dmFormName: koffi.array('char16_t', 32, 'String'),
    dmLogPixels: 'uint16_t',
    dmBitsPerPel: 'uint32_t',
    dmPelsWidth: 'uint32_t',
    dmPelsHeight: 'uint32_t',
    dmDisplayFlags: 'uint32_t',
    dmDisplayFrequency: 'uint32_t',
    dmICMMethod: 'uint32_t',
    dmICMIntent: 'uint32_t',
    dmMediaType: 'uint32_t',
    dmDitherType: 'uint32_t',
    dmReserved1: 'uint32_t',
    dmReserved2: 'uint32_t',
    dmPanningWidth: 'uint32_t',
    dmPanningHeight: 'uint32_t'
});

const DEVMODE_SIZE = koffi.sizeof(DEVMODEW);          // 220
const DISPLAY_DEVICE_SIZE = koffi.sizeof(DISPLAY_DEVICEW); // 840

const ENUM_CURRENT_SETTINGS = 0xFFFFFFFF;
const DISPLAY_DEVICE_ATTACHED_TO_DESKTOP = 0x1;
const DISPLAY_DEVICE_PRIMARY_DEVICE = 0x4;
const DM_INTERLACED = 0x2;

const DM_DISPLAYFIXEDOUTPUT = 0x20000000;
const DM_BITSPERPEL = 0x40000;
const DM_PELSWIDTH = 0x80000;
const DM_PELSHEIGHT = 0x100000;
const DM_DISPLAYFLAGS = 0x200000;
const DM_DISPLAYFREQUENCY = 0x400000;

const CDS_UPDATEREGISTRY = 0x1;
const CDS_TEST = 0x2;

const SCALING = { default: 0, stretch: 1, center: 2 }; // DMDFO_*

const RESULT_TEXT = {
    0: 'OK',
    1: 'Redémarrage nécessaire',
    [-1]: 'Le pilote a refusé le mode',
    [-2]: 'Mode non supporté',
    [-3]: 'Impossible d’enregistrer le réglage',
    [-4]: 'Paramètres invalides',
    [-5]: 'Paramètres invalides',
    [-6]: 'Mode non supporté (DualView)'
};

let api = null;
function load() {
    if (api) return api;
    const user32 = koffi.load('user32.dll');
    api = {
        EnumDisplayDevicesW: user32.func('bool __stdcall EnumDisplayDevicesW(const char16_t *lpDevice, uint32_t iDevNum, _Inout_ DISPLAY_DEVICEW *lpDisplayDevice, uint32_t dwFlags)'),
        EnumDisplaySettingsExW: user32.func('bool __stdcall EnumDisplaySettingsExW(const char16_t *lpszDeviceName, uint32_t iModeNum, _Inout_ DEVMODEW *lpDevMode, uint32_t dwFlags)'),
        ChangeDisplaySettingsExW: user32.func('int32_t __stdcall ChangeDisplaySettingsExW(const char16_t *lpszDeviceName, const DEVMODEW *lpDevMode, void *hwnd, uint32_t dwflags, void *lParam)')
    };
    return api;
}

/** Screens attached to the desktop: [{ name: '\\\\.\\DISPLAY1', adapter, monitor, primary }] */
function listScreens() {
    const { EnumDisplayDevicesW } = load();
    const screens = [];
    for (let i = 0; i < 16; i++) {
        const dd = { cb: DISPLAY_DEVICE_SIZE };
        if (!EnumDisplayDevicesW(null, i, dd, 0)) break;
        if (!(dd.StateFlags & DISPLAY_DEVICE_ATTACHED_TO_DESKTOP)) continue;
        const mon = { cb: DISPLAY_DEVICE_SIZE };
        const hasMon = EnumDisplayDevicesW(dd.DeviceName, 0, mon, 0);
        screens.push({
            name: dd.DeviceName,
            adapter: dd.DeviceString,
            monitor: hasMon ? mon.DeviceString : '',
            primary: !!(dd.StateFlags & DISPLAY_DEVICE_PRIMARY_DEVICE)
        });
    }
    return screens;
}

/** '' or unknown name => primary screen */
function resolveScreen(name) {
    const screens = listScreens();
    return screens.find(s => name && s.name === name)
        || screens.find(s => s.primary)
        || screens[0]
        || null;
}

function readMode(device, index) {
    const { EnumDisplaySettingsExW } = load();
    const dm = { dmSize: DEVMODE_SIZE };
    return EnumDisplaySettingsExW(device, index, dm, 0) ? dm : null;
}

function getCurrent(device) {
    const dm = readMode(device, ENUM_CURRENT_SETTINGS);
    return dm ? { w: dm.dmPelsWidth, h: dm.dmPelsHeight, hz: dm.dmDisplayFrequency } : null;
}

/** All distinct modes (32 bits, non interlaced), sorted big -> small */
function listModes(device) {
    const seen = new Map();
    for (let i = 0; i < 5000; i++) {
        const dm = readMode(device, i);
        if (!dm) break;
        if (dm.dmBitsPerPel !== 32 || (dm.dmDisplayFlags & DM_INTERLACED)) continue;
        const key = `${dm.dmPelsWidth}x${dm.dmPelsHeight}@${dm.dmDisplayFrequency}`;
        if (!seen.has(key)) seen.set(key, { w: dm.dmPelsWidth, h: dm.dmPelsHeight, hz: dm.dmDisplayFrequency, dm });
    }
    return [...seen.values()].sort((a, b) => b.w - a.w || b.h - a.h || b.hz - a.hz);
}

/**
 * Apply a mode. persist=true behaves like Windows Settings (saved, survives
 * fullscreen games / alt-tab); persist=false is temporary until reboot.
 */
function applyMode(device, mode, { persist = true, scaling = 'default' } = {}) {
    const { ChangeDisplaySettingsExW } = load();
    const found = listModes(device).find(m => m.w === mode.w && m.h === mode.h && m.hz === mode.hz);
    if (!found) return { ok: false, code: -2, message: 'Mode introuvable sur cet écran' };

    const dm = { ...found.dm, dmSize: DEVMODE_SIZE, dmDriverExtra: 0 };
    dm.dmFields = DM_BITSPERPEL | DM_PELSWIDTH | DM_PELSHEIGHT | DM_DISPLAYFREQUENCY | DM_DISPLAYFLAGS;
    if (scaling in SCALING && scaling !== 'default') {
        dm.dmFields |= DM_DISPLAYFIXEDOUTPUT;
        dm.dmDisplayFixedOutput = SCALING[scaling];
    }

    const test = ChangeDisplaySettingsExW(device, dm, null, CDS_TEST, null);
    if (test !== 0) return { ok: false, code: test, message: RESULT_TEXT[test] || `Erreur ${test}` };

    const code = ChangeDisplaySettingsExW(device, dm, null, persist ? CDS_UPDATEREGISTRY : 0, null);
    return { ok: code === 0, code, message: RESULT_TEXT[code] || `Erreur ${code}` };
}

module.exports = { listScreens, resolveScreen, getCurrent, listModes, applyMode, DEVMODE_SIZE, DISPLAY_DEVICE_SIZE };
