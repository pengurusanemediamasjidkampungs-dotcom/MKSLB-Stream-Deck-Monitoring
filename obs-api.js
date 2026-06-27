/**
 * obs-api.js
 * ─────────────────────────────────────────────────────────────
 * Modul pengurusan sambungan OBS WebSocket v5 (obs-websocket-js 5.x)
 * Handles: Connect, Auth, Scene switching, Transition, Source toggles
 * ─────────────────────────────────────────────────────────────
 */

// Import OBSWebSocket dari CDN (dimuatkan dalam index.html via importmap atau CDN)
// Kita gunakan dynamic import dari skypack / esm.sh
let OBSWebSocket;

async function loadOBSLib() {
  if (OBSWebSocket) return;
  const mod = await import('https://esm.sh/obs-websocket-js@5.0.6');
  OBSWebSocket = mod.default;
}

// ─────────────────────────────────────────────────────────────
//  OBSController class
// ─────────────────────────────────────────────────────────────
export class OBSController {
  constructor() {
    this.obs           = null;
    this.connected     = false;
    this.studioMode    = false;
    this.previewScene  = null;
    this.programScene  = null;
    this.sceneItemCache = {};   // { sceneName: [ {id, sourceName, enabled} ] }

    // Callbacks yang akan diset oleh ui-controller
    this.onConnected    = null;
    this.onDisconnected = null;
    this.onError        = null;
    this.onPreviewChange  = null;
    this.onProgramChange  = null;
    this.onSourceToggled  = null;
  }

  /* ══════════════════════════════
     CONNECT
  ══════════════════════════════ */
  async connect(host = 'localhost', port = 4455, password = '') {
    await loadOBSLib();

    if (this.obs) {
      await this._disconnect();
    }

    this.obs = new OBSWebSocket();

    // Daftar event listeners
    this.obs.on('ConnectionClosed', () => this._handleDisconnect('Connection closed'));
    this.obs.on('ConnectionError',  (err) => this._handleDisconnect(err?.message || 'Connection error'));

    this.obs.on('CurrentPreviewSceneChanged', (data) => {
      this.previewScene = data.sceneName;
      if (this.onPreviewChange) this.onPreviewChange(data.sceneName);
    });

    this.obs.on('CurrentProgramSceneChanged', (data) => {
      this.programScene = data.sceneName;
      if (this.onProgramChange) this.onProgramChange(data.sceneName);
    });

    this.obs.on('SceneItemEnableStateChanged', (data) => {
      if (this.onSourceToggled) {
        this.onSourceToggled(data.sceneName, data.sceneItemId, data.sceneItemEnabled);
      }
    });

    try {
      const url = `ws://${host}:${port}`;
      await this.obs.connect(url, password || undefined);
      this.connected = true;

      // Dapatkan maklumat awal
      await this._fetchInitialState();

      if (this.onConnected) this.onConnected({
        previewScene: this.previewScene,
        programScene: this.programScene,
        studioMode:   this.studioMode,
      });
    } catch (err) {
      this.connected = false;
      throw new Error(`OBS connection failed: ${err.message || err}`);
    }
  }

  /* ══════════════════════════════
     DISCONNECT
  ══════════════════════════════ */
  async disconnect() {
    await this._disconnect();
  }

  async _disconnect() {
    if (this.obs) {
      try { await this.obs.disconnect(); } catch (_) { /* ignore */ }
      this.obs = null;
    }
    this.connected = false;
  }

  _handleDisconnect(reason) {
    this.connected = false;
    if (this.onDisconnected) this.onDisconnected(reason);
  }

  /* ══════════════════════════════
     INITIAL STATE
  ══════════════════════════════ */
  async _fetchInitialState() {
    // Check Studio Mode
    try {
      const { studioModeEnabled } = await this.obs.call('GetStudioModeEnabled');
      this.studioMode = studioModeEnabled;

      if (!this.studioMode) {
        // Hidupkan Studio Mode jika belum aktif
        await this.obs.call('SetStudioModeEnabled', { studioModeEnabled: true });
        this.studioMode = true;
      }
    } catch (_) { /* obs versi lama mungkin tak support */ }

    // Dapatkan current program scene
    try {
      const { currentProgramSceneName } = await this.obs.call('GetCurrentProgramScene');
      this.programScene = currentProgramSceneName;
    } catch (_) {}

    // Dapatkan current preview scene
    try {
      const { currentPreviewSceneName } = await this.obs.call('GetCurrentPreviewScene');
      this.previewScene = currentPreviewSceneName;
    } catch (_) {}
  }

  /* ══════════════════════════════
     SET PREVIEW SCENE
     (Studio Mode: tukar Preview sahaja, bukan Live)
  ══════════════════════════════ */
  async setPreviewScene(sceneName) {
    this._requireConnection();
    await this.obs.call('SetCurrentPreviewScene', { sceneName });
    this.previewScene = sceneName;
  }

  /* ══════════════════════════════
     TRIGGER TRANSITION
     (Hantar Preview → Program / Live)
  ══════════════════════════════ */
  async triggerTransition() {
    this._requireConnection();
    await this.obs.call('TriggerStudioModeTransition');
  }

  /* ══════════════════════════════
      SET TRANSITION TYPE
      (Cut / Fade)
   ══════════════════════════════ */
  async setTransitionType(transitionName) {
    this._requireConnection();
    // Nama transition dalam OBS mesti sama persis: "Cut" atau "Fade"
    await this.obs.call('SetCurrentSceneTransition', { transitionName });
  }

  /* ══════════════════════════════
      GET SCENE SCREENSHOT
      (Untuk live monitoring)
   ══════════════════════════════ */
  async getScreenshot(sceneName, width = 480, height = 270) {
    this._requireConnection();
    const { imageData } = await this.obs.call('GetSourceScreenshot', {
      sourceName: sceneName,
      imageFormat: 'png',
      imageWidth: width,
      imageHeight: height,
    });
    return imageData;
  }

  /* ══════════════════════════════
     GET SCENE ITEMS
     Dapatkan senarai items dalam scene
  ══════════════════════════════ */
  async getSceneItems(sceneName) {
    this._requireConnection();
    const { sceneItems } = await this.obs.call('GetSceneItemList', { sceneName });
    this.sceneItemCache[sceneName] = sceneItems;
    return sceneItems;
  }

  /* ══════════════════════════════
     TOGGLE SOURCE VISIBILITY
     (SetSceneItemEnabled)
     sourceName: nama source seperti "LT", "MKSLB LOGO GIF 5"
     sceneName: nama scene aktif (preview) — kalau null, guna programScene
  ══════════════════════════════ */
  async toggleSource(sourceName, sceneName = null) {
    this._requireConnection();

    const targetScene = sceneName || this.programScene;
    if (!targetScene) throw new Error('No active scene to toggle source in');

    // Cari sceneItemId untuk source ini
    const sceneItemId = await this._getSceneItemId(targetScene, sourceName);
    if (sceneItemId === null) {
      throw new Error(`Source "${sourceName}" not found in scene "${targetScene}"`);
    }

    // Dapatkan status semasa
    const { sceneItemEnabled } = await this.obs.call('GetSceneItemEnabled', {
      sceneName: targetScene,
      sceneItemId,
    });

    // Toggle
    const newEnabled = !sceneItemEnabled;
    await this.obs.call('SetSceneItemEnabled', {
      sceneName: targetScene,
      sceneItemId,
      sceneItemEnabled: newEnabled,
    });

    return newEnabled; // return status baru
  }

  /* ══════════════════════════════
     SET SOURCE VISIBILITY
     (Tetapkan ON atau OFF secara eksplisit)
  ══════════════════════════════ */
  async setSourceEnabled(sourceName, enabled, sceneName = null) {
    this._requireConnection();

    const targetScene = sceneName || this.programScene;
    const sceneItemId = await this._getSceneItemId(targetScene, sourceName);
    if (sceneItemId === null) throw new Error(`Source "${sourceName}" not found`);

    await this.obs.call('SetSceneItemEnabled', {
      sceneName: targetScene,
      sceneItemId,
      sceneItemEnabled: enabled,
    });
    return enabled;
  }

  /* ══════════════════════════════
     HELPER: Cari sceneItemId
  ══════════════════════════════ */
  async _getSceneItemId(sceneName, sourceName) {
    try {
      // Cara paling tepat: GetSceneItemId (OBS WS v5)
      const { sceneItemId } = await this.obs.call('GetSceneItemId', {
        sceneName,
        sourceName,
      });
      return sceneItemId;
    } catch (_) {
      // Fallback: scan dari GetSceneItemList
      const items = await this.getSceneItems(sceneName);
      const found = items.find(i => i.sourceName === sourceName);
      return found ? found.sceneItemId : null;
    }
  }

  /* ══════════════════════════════
     HELPER: Pastikan tersambung
  ══════════════════════════════ */
  _requireConnection() {
    if (!this.connected || !this.obs) {
      throw new Error('Tidak bersambung ke OBS. Sila sambung dahulu.');
    }
  }
}

// Export singleton
export const obsController = new OBSController();
