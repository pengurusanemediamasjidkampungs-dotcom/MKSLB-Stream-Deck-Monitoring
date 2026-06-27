/**
 * ui-controller.js
 * ─────────────────────────────────────────────────────────────
 * Mengendalikan:
 *  - Butang klik (Scenes, Transition, Sources)
 *  - DOM updates (preview/program labels, status)
 *  - Keyboard shortcuts (Alt+Key)
 *  - Settings modal
 *  - Toast notifications
 * ─────────────────────────────────────────────────────────────
 */

import { obsController } from './obs-api.js';

/* ═══════════════════════════════════════════════════════════
   ⌨️  KEYBOARD SHORTCUT MAPPING
   Ubah suai di sini untuk tukar shortcut keys
   Format: 'KeyCode' (dengan Alt ditekan)
   Contoh: 'Digit1' = Alt+1, 'KeyT' = Alt+T
   Rujuk: https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code
═══════════════════════════════════════════════════════════ */
export const SHORTCUT_MAP = {
  // ── SCENES (Alt + key) ────────────────────────────────
  'F1':       { action: 'scene', value: 'POSTER' },
  'F2':       { action: 'scene', value: 'STARTING SOON' },
  'F3':       { action: 'scene', value: 'BREAKBUMPER' },
  'F4':       { action: 'scene', value: 'AZAN SOLAT' },

  // Alt + angka → Main scenes
  'Digit1':   { action: 'scene', value: 'MAIN VIEW' },        // Alt+1
  'Digit2':   { action: 'scene', value: 'IMAM VIEW' },        // Alt+2
  'Digit3':   { action: 'scene', value: 'SOLAT VIEW' },       // Alt+3
  'Digit4':   { action: 'scene', value: 'KHUTBAH VIEW' },     // Alt+4
  'Digit5':   { action: 'scene', value: 'WIDEANGLE VIEW' },   // Alt+5
  'Digit6':   { action: 'scene', value: 'KHATIB' },           // Alt+6
  'Digit7':   { action: 'scene', value: 'DUA 2 KHUTBAH' },    // Alt+7
  'Digit8':   { action: 'scene', value: 'INTRO TAKBIR' },     // Alt+8
  'Digit9':   { action: 'scene', value: 'WAKTU SOLAT' },      // Alt+9

  // ── TRANSITION ───────────────────────────────────────
  'KeyT':     { action: 'transition' },                       // Alt+T

  // ── SOURCES (toggle) ─────────────────────────────────
  'KeyF':     { action: 'source', value: 'MKSLB FRAME 3' },   // Alt+F
  'KeyL':     { action: 'source', value: 'LT' },              // Alt+L
  'KeyG':     { action: 'source', value: 'MKSLB LOGO GIF 5' },// Alt+G
  'KeyR':     { action: 'source', value: 'SCROLL 4 2' },      // Alt+R

  // ── SETTINGS ─────────────────────────────────────────
  'KeyS':     { action: 'settings' },                         // Alt+S
};

/* Catatan F1-F4: Gunakan key code 'F1','F2','F3','F4' sahaja (bukan Alt)
   kerana F-keys biasanya digunakan terus tanpa Alt modifier pada banyak sistem.
   Anda boleh tukar kepada 'Digit...' jika nak guna Alt+1,2,3,4 sebaliknya */

/* ═══════════════════════════════════════════════════════════
   UI Controller
═══════════════════════════════════════════════════════════ */
export class UIController {
  constructor() {
    // DOM references
    this.statusDot       = document.getElementById('statusDot');
    this.statusText      = document.getElementById('statusText');
    this.previewName     = document.getElementById('previewSceneName');
    this.programName     = document.getElementById('programSceneName');
    this.monitorBtn      = document.getElementById('monitorBtn');
    this.monitorBar      = document.getElementById('monitorBar');
    this.monitorPreview  = document.getElementById('monitorPreview');
    this.monitorProgram  = document.getElementById('monitorProgram');
    this.monitorPrevEmpty = document.getElementById('monitorPreviewEmpty');
    this.monitorProgEmpty = document.getElementById('monitorProgramEmpty');
    this.settingsBtn     = document.getElementById('settingsBtn');
    this.connectBtn      = document.getElementById('connectBtn');
    this.settingsModal   = document.getElementById('settingsModal');
    this.closeSettings   = document.getElementById('closeSettings');
    this.saveSettings    = document.getElementById('saveSettings');
    this.cancelSettings  = document.getElementById('cancelSettings');
    this.transitionBtn   = document.getElementById('transitionBtn');
    this.transCutBtn     = document.getElementById('transCut');
    this.transFadeBtn    = document.getElementById('transFade');
    this.toast           = document.getElementById('toast');

    this.sceneButtons  = [...document.querySelectorAll('.btn-scene')];
    this.sourceButtons = [...document.querySelectorAll('.btn-source')];

    // Source visibility state (local tracking)
    this.sourceState = {};
    this.sourceButtons.forEach(btn => {
      const name = btn.dataset.source;
      this.sourceState[name] = false;
    });

    this._toastTimer = null;
    this._connectToggleInProgress = false;
    this._monitoring = false;
    this._monitorInterval = null;
  }

  /* ══════════════════════════════
     INIT
  ══════════════════════════════ */
  init() {
    this._bindSceneButtons();
    this._bindSourceButtons();
    this._bindTransitionButtons();
    this._bindMonitorButton();
    this._bindSettingsModal();
    this._bindConnectButton();
    this._bindKeyboard();
    this._hookOBSCallbacks();

    // Sync settings dari localStorage ke modal
    this._loadSettingsToModal();
  }

  /* ══════════════════════════════
     OBS CALLBACKS
  ══════════════════════════════ */
  _hookOBSCallbacks() {
    obsController.onConnected = ({ previewScene, programScene }) => {
      this._setStatus('connected', '✅ Connected');
      this.showToast('✅ Berjaya disambungkan ke OBS!', 'ok');
      if (previewScene) this._updatePreview(previewScene);
      if (programScene) this._updateProgram(programScene);
      this.connectBtn.textContent = '⏏️';
      this.connectBtn.title = 'Disconnect';
    };

    obsController.onDisconnected = (reason) => {
      this._setStatus('disconnected', '❌ Disconnected');
      this.showToast(`⚠️ OBS terputus: ${reason}`, 'warn');
      this.connectBtn.textContent = '🔌';
      this.connectBtn.title = 'Connect';
      // Clear active states
      this.sceneButtons.forEach(b => b.classList.remove('is-preview', 'is-program'));
      this.previewName.textContent = '—';
      this.programName.textContent = '—';
      // Matikan monitoring jika aktif
      if (this._monitoring) this._stopMonitoring();
    };

    obsController.onError = (err) => {
      this.showToast(`❌ Ralat: ${err}`, 'error');
    };

    obsController.onPreviewChange = (name) => {
      this._updatePreview(name);
    };

    obsController.onProgramChange = (name) => {
      this._updateProgram(name);
    };

    obsController.onSourceToggled = (sceneName, itemId, enabled) => {
      // Update visual state jika source diubah dari OBS terus
      this.sourceButtons.forEach(btn => {
        const srcName = btn.dataset.source;
        if (this.sourceState[srcName] !== undefined) {
          // Kita tak ada mapping itemId→sourceName di sini, jadi ikut state semasa
        }
      });
    };
  }

  /* ══════════════════════════════
     SCENE BUTTONS
  ══════════════════════════════ */
  _bindSceneButtons() {
    this.sceneButtons.forEach(btn => {
      btn.addEventListener('click', () => this._handleSceneClick(btn.dataset.scene));
    });
  }

  async _handleSceneClick(sceneName) {
    if (!obsController.connected) {
      this.showToast('⚠️ Belum bersambung ke OBS', 'warn');
      return;
    }
    try {
      await obsController.setPreviewScene(sceneName);
      this._updatePreview(sceneName);
      this.showToast(`👁️ Preview: ${sceneName}`, 'ok');
    } catch (err) {
      this.showToast(`❌ Gagal tukar scene: ${err.message}`, 'error');
    }
  }

  /* ══════════════════════════════
     TRANSITION BUTTON
  ══════════════════════════════ */
  _bindTransitionButtons() {
    // Cut / Fade selector
    [this.transCutBtn, this.transFadeBtn].forEach(btn => {
      btn.addEventListener('click', async () => {
        [this.transCutBtn, this.transFadeBtn].forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const type = btn.dataset.type === 'cut' ? 'Cut' : 'Fade';
        if (obsController.connected) {
          try {
            await obsController.setTransitionType(type);
            this.showToast(`🔀 Transition ditukar: ${type}`, 'ok');
          } catch (err) {
            this.showToast(`⚠️ Gagal tukar transition: ${err.message}`, 'warn');
          }
        }
      });
    });

    // Main transition button
    this.transitionBtn.addEventListener('click', () => this._handleTransition());
  }

  async _handleTransition() {
    if (!obsController.connected) {
      this.showToast('⚠️ Belum bersambung ke OBS', 'warn');
      return;
    }
    try {
      this.transitionBtn.classList.add('btn-firing');
      await obsController.triggerTransition();
      this.showToast('▶▶ TRANSITION dihantar!', 'ok');
    } catch (err) {
      this.showToast(`❌ Transition gagal: ${err.message}`, 'error');
    } finally {
      setTimeout(() => this.transitionBtn.classList.remove('btn-firing'), 300);
    }
  }

  /* ══════════════════════════════
     SOURCE BUTTONS
  ══════════════════════════════ */
  _bindSourceButtons() {
    this.sourceButtons.forEach(btn => {
      btn.addEventListener('click', () => this._handleSourceToggle(btn.dataset.source, btn));
    });
  }

  async _handleSourceToggle(sourceName, btn) {
    if (!obsController.connected) {
      this.showToast('⚠️ Belum bersambung ke OBS', 'warn');
      return;
    }
    try {
      const newState = await obsController.toggleSource(sourceName);
      this.sourceState[sourceName] = newState;
      this._updateSourceBtn(btn, newState);
      this.showToast(
        newState ? `✅ ${sourceName}: ON` : `⬜ ${sourceName}: OFF`,
        newState ? 'ok' : 'warn'
      );
    } catch (err) {
      this.showToast(`❌ ${err.message}`, 'error');
    }
  }

  _updateSourceBtn(btn, enabled) {
    btn.classList.toggle('source-on', enabled);
  }

  /* ══════════════════════════════
      MONITOR BUTTON (Screenshot)
   ══════════════════════════════ */
  _bindMonitorButton() {
    this.monitorBtn.addEventListener('click', () => this._toggleMonitoring());
  }

  _toggleMonitoring() {
    this._monitoring = !this._monitoring;
    if (this._monitoring) {
      this._startMonitoring();
    } else {
      this._stopMonitoring();
    }
  }

  _startMonitoring() {
    if (!obsController.connected) {
      this.showToast('⚠️ Sambung ke OBS dahulu untuk monitoring', 'warn');
      this._monitoring = false;
      return;
    }
    this.monitorBtn.style.outline = '2px solid var(--accent-preview)';
    this.monitorBar.hidden = false;
    document.querySelector('.main-layout').classList.add('with-monitor');
    this._pollScreenshots();
    this._monitorInterval = setInterval(() => this._pollScreenshots(), 1500);
    this.showToast('📺 Monitoring dihidupkan', 'ok');
  }

  _stopMonitoring() {
    this.monitorBtn.style.outline = '';
    this.monitorBar.hidden = true;
    document.querySelector('.main-layout')?.classList.remove('with-monitor');
    if (this._monitorInterval) {
      clearInterval(this._monitorInterval);
      this._monitorInterval = null;
    }
    this.monitorPreview.src = '';
    this.monitorProgram.src = '';
    this.monitorPrevEmpty.hidden = false;
    this.monitorProgEmpty.hidden = false;
    this.showToast('📺 Monitoring dimatikan', 'warn');
  }

  async _pollScreenshots() {
    if (!obsController.connected) {
      this._stopMonitoring();
      return;
    }
    try {
      const previewName = obsController.previewScene;
      const programName = obsController.programScene;

      if (previewName) {
        const data = await obsController.getScreenshot(previewName);
        this.monitorPreview.src = `data:image/png;base64,${data}`;
        this.monitorPrevEmpty.hidden = true;
      }
      if (programName) {
        const data = await obsController.getScreenshot(programName);
        this.monitorProgram.src = `data:image/png;base64,${data}`;
        this.monitorProgEmpty.hidden = true;
      }
    } catch (_) {
      // Poll akan gagal jika OBS disconnect — biar cycle seterusnya handle
    }
  }

  /* ══════════════════════════════
      CONNECT BUTTON
   ══════════════════════════════ */
  _bindConnectButton() {
    this.connectBtn.addEventListener('click', async () => {
      if (this._connectToggleInProgress) return;
      this._connectToggleInProgress = true;

      if (obsController.connected) {
        await obsController.disconnect();
      } else {
        await this._connectFromStorage();
      }
      this._connectToggleInProgress = false;
    });
  }

  async _connectFromStorage() {
    const host     = localStorage.getItem('obs_host') || 'localhost';
    const port     = localStorage.getItem('obs_port') || '4455';
    const password = localStorage.getItem('obs_password') || '';

    this._setStatus('connecting', '⏳ Menyambung...');
    this.showToast(`⏳ Menyambung ke OBS (${host}:${port})…`, 'warn');

    try {
      await obsController.connect(host, parseInt(port), password);
    } catch (err) {
      this._setStatus('disconnected', '❌ Gagal sambung');
      this.showToast(`❌ ${err.message}`, 'error');
    }
  }

  /* ══════════════════════════════
     SETTINGS MODAL
  ══════════════════════════════ */
  _bindSettingsModal() {
    this.settingsBtn.addEventListener('click', () => this._openSettings());
    this.closeSettings.addEventListener('click', () => this._closeSettings());
    this.cancelSettings.addEventListener('click', () => this._closeSettings());

    this.saveSettings.addEventListener('click', async () => {
      const host     = document.getElementById('obsHost').value.trim() || 'localhost';
      const port     = document.getElementById('obsPort').value.trim() || '4455';
      const password = document.getElementById('obsPassword').value;

      localStorage.setItem('obs_host',     host);
      localStorage.setItem('obs_port',     port);
      localStorage.setItem('obs_password', password);

      this._closeSettings();

      // Putuskan & sambung semula
      if (obsController.connected) await obsController.disconnect();
      await this._connectFromStorage();
    });

    // Tutup modal jika klik luar
    this.settingsModal.addEventListener('click', (e) => {
      if (e.target === this.settingsModal) this._closeSettings();
    });
  }

  _loadSettingsToModal() {
    document.getElementById('obsHost').value     = localStorage.getItem('obs_host') || 'localhost';
    document.getElementById('obsPort').value     = localStorage.getItem('obs_port') || '4455';
    document.getElementById('obsPassword').value = localStorage.getItem('obs_password') || '';
  }

  _openSettings() {
    this._loadSettingsToModal();
    this.settingsModal.hidden = false;
  }
  _closeSettings() {
    this.settingsModal.hidden = true;
  }

  /* ══════════════════════════════
     KEYBOARD SHORTCUTS
  ══════════════════════════════ */
  _bindKeyboard() {
    document.addEventListener('keydown', (e) => {
      // Jangan proses jika dalam input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const useAlt = e.altKey;
      const code   = e.code;       // e.g. 'KeyT', 'Digit1', 'F1'

      // F-keys tidak memerlukan Alt (F1-F4 langsung)
      const isFKey = /^F\d+$/.test(code);

      if (!useAlt && !isFKey) return;

      const binding = SHORTCUT_MAP[code];
      if (!binding) return;

      // Prevent default browser action (cth: Alt+F biasanya buka menu)
      e.preventDefault();

      switch (binding.action) {
        case 'scene':
          this._handleSceneClick(binding.value);
          this._flashSceneBtn(binding.value);
          break;

        case 'transition':
          this._handleTransition();
          this._flashBtn(this.transitionBtn);
          break;

        case 'source': {
          const btn = this.sourceButtons.find(b => b.dataset.source === binding.value);
          if (btn) {
            this._handleSourceToggle(binding.value, btn);
            this._flashBtn(btn);
          }
          break;
        }

        case 'settings':
          this._openSettings();
          break;
      }
    });
  }

  /* ══════════════════════════════
     DOM HELPERS
  ══════════════════════════════ */
  _updatePreview(sceneName) {
    this.previewName.textContent = sceneName;
    this.sceneButtons.forEach(btn => {
      btn.classList.remove('is-preview');
      if (btn.dataset.scene === sceneName) btn.classList.add('is-preview');
    });
  }

  _updateProgram(sceneName) {
    this.programName.textContent = sceneName;
    this.sceneButtons.forEach(btn => {
      btn.classList.remove('is-program');
      if (btn.dataset.scene === sceneName) btn.classList.add('is-program');
    });
  }

  _setStatus(state, text) {
    this.statusDot.className  = `status-dot ${state}`;
    this.statusText.textContent = text;
  }

  _flashBtn(btn) {
    btn.style.outline = '2px solid var(--accent-trans)';
    setTimeout(() => btn.style.outline = '', 300);
  }

  _flashSceneBtn(sceneName) {
    const btn = this.sceneButtons.find(b => b.dataset.scene === sceneName);
    if (btn) this._flashBtn(btn);
  }

  /* ══════════════════════════════
     TOAST
  ══════════════════════════════ */
  showToast(message, type = 'ok') {
    const t = this.toast;
    if (this._toastTimer) clearTimeout(this._toastTimer);

    t.textContent = message;
    t.className   = `toast toast-${type}`;
    t.hidden      = false;

    // Force reflow for animation
    void t.offsetWidth;
    t.classList.add('show');

    this._toastTimer = setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => { t.hidden = true; }, 300);
    }, 2500);
  }
}

export const uiController = new UIController();
