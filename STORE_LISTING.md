# Store listing: Resolution Switcher

Ready-to-paste texts and assets for the Ajazz / Mirabox Space store submission.

## Identity

| Field | Value |
|---|---|
| Plugin name | Resolution Switcher |
| Plugin UUID | `com.xamyp.resolutionswitcher` |
| Action UUID | `com.xamyp.resolutionswitcher.cycle` |
| Action name | Cycle resolution |
| Category | Resolution Switcher (store category suggestion: *Tools* / *System*) |
| Version | 1.0.0 |
| Author | Xamyp |
| Platform | Windows 10 / 11 |
| Minimum software version | 3.10.188.226 |
| Price | Free |
| License | MIT |
| Package to upload | `com.xamyp.resolutionswitcher.sdPlugin.zip` |

## Tagline (max. 60 characters)

> One key. Your resolutions. Your refresh rates.

## Short description (max. 150 characters)

> Switch your screen resolution and refresh rate with one key. Build your own cycle list from the modes Windows reports. Long press to restore.

## Full description

> **Resolution Switcher** puts your favorite display modes on a single key.
>
> Pick the resolutions and refresh rates you want from the list Windows reports for your screen, put them in the order you like, and press the key to go from one to the next. Hold the key to go back to your original resolution.
>
> Perfect for gamers who switch between a native 4K desktop and a lower resolution for competitive games, for streamers and content creators, and for anyone who changes display settings often.
>
> **Features**
> - Cycle through your own list of modes: each press switches to the next one.
> - Long press (0.7 s) restores the original resolution.
> - Only real modes: the list comes straight from Windows, so every entry is supported by your screen and GPU.
> - Live display on the key: current resolution, refresh rate and position in your list.
> - Works with any screen: primary screen by default, or pick another attached screen.
> - Same result as Windows Settings: modes survive fullscreen games and alt-tab. A temporary mode (reverted at reboot) is also available.
> - Scaling option for lower resolutions: driver default, stretch or center.
> - Lightweight and safe: native Windows API, no admin rights, no extra program, fully offline. Never delays Windows shutdown.
> - English and French interface.
>
> **How to use**
> 1. Drag *Cycle resolution* onto a key.
> 2. Choose a mode in the drop-down list and press **+**. Repeat for each mode you want.
> 3. Short press: next mode. Long press: back to the original.
>
> Requires Windows 10/11 and Stream Dock software 3.10.188.226 or newer.

## Keywords / tags

`resolution`, `refresh rate`, `display`, `monitor`, `screen`, `Hz`, `gaming`, `4K`, `144Hz`, `240Hz`, `windows`, `utility`

## Assets

| File | Size | Use |
|---|---|---|
| `store-assets/icon-512.png` | 512 × 512 | Store icon (high DPI) |
| `com.xamyp.resolutionswitcher.sdPlugin/static/plugin.png` | 256 × 256 | Plugin icon (manifest `Icon`) |
| `com.xamyp.resolutionswitcher.sdPlugin/static/category.png` (+ `@2x`) | 28 × 28 / 56 × 56 | Category icon, white monochrome |
| `com.xamyp.resolutionswitcher.sdPlugin/static/action.png` (+ `@2x`) | 20 × 20 / 40 × 40 | Action list icon, white monochrome |
| `com.xamyp.resolutionswitcher.sdPlugin/static/key.png` | 144 × 144 | Default key image |
| `store-assets/cover-1280x720.png` | 1280 × 720 | Cover / banner |
| `store-assets/key-preview-1..3.png` | 288 × 288 | Key previews (3840x2160 240 Hz, 2560x1440 240 Hz, 1920x1080 144 Hz) |

Recommended extra screenshots (to take on your own PC before submitting):
1. The settings panel with a cycle list of 3 modes.
2. The drop-down list open, showing modes grouped by resolution.
3. A photo of the device with the key showing the current mode.

## Permissions and privacy statement

> Resolution Switcher only reads and changes the display mode of your screens through the standard Windows display API. It does not need administrator rights, does not access the network, and does not collect or send any data. Settings are stored locally by the Stream Dock software.

## Release notes (1.0.0)

> First release: cycle through your own list of resolutions and refresh rates, long press to restore the original, live key display, multi-screen support, permanent or temporary apply mode, scaling option.

## Support

| | |
|---|---|
| Source code and issues | https://github.com/xamyp/resolution-switcher |
| Contact | *(add your support e-mail)* |

## Pre-submission checklist

- [ ] Replace the GitHub URL in `manifest.json` (`URL`) and in this file with the real repository.
- [ ] Add a support e-mail.
- [ ] Test on a clean Windows install: install, add 3 modes, cycle, long press, reboot, restart the software.
- [ ] Test with 2 screens (one key per screen).
- [ ] Test a full Windows shutdown and restart with the plugin running.
- [ ] Take the 3 recommended screenshots.
- [ ] Check that `plugin/log/` is not included in the uploaded zip.
- [ ] Bump `Version` in `manifest.json` and add an entry to `CHANGELOG.md` for every update.
