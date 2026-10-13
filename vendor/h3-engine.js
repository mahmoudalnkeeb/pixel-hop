// src/core/Events.js
var Events = class {
  constructor() {
    this._listeners = /* @__PURE__ */ new Map();
  }
  /**
   * @param {string} type
   * @param {Function} fn
   * @returns {() => void} Unsubscribe function.
   */
  on(type, fn) {
    if (!this._listeners.has(type)) this._listeners.set(type, []);
    this._listeners.get(type).push(fn);
    return () => this.off(type, fn);
  }
  /**
   * Like {@link Events#on}, but the listener removes itself after the first call.
   * @param {string} type
   * @param {Function} fn
   * @returns {() => void} Unsubscribe function.
   */
  once(type, fn) {
    const runOnce = (...args) => {
      this.off(type, runOnce);
      fn(...args);
    };
    runOnce.original = fn;
    return this.on(type, runOnce);
  }
  /**
   * Remove a listener. Also accepts the original function passed to {@link Events#once}.
   * @param {string} type
   * @param {Function} fn
   */
  off(type, fn) {
    const list = this._listeners.get(type);
    if (!list) return;
    const index = list.findIndex((listener) => listener === fn || listener.original === fn);
    if (index >= 0) list.splice(index, 1);
  }
  /**
   * Call every listener for `type`. Listeners added or removed during the emit
   * take effect on the next emit.
   * @param {string} type
   * @param {...any} args
   */
  emit(type, ...args) {
    const list = this._listeners.get(type);
    if (!list || list.length === 0) return;
    for (const fn of list.slice()) fn(...args);
  }
};

// src/platform/Assets.js
var ASSET_TYPES = ["images", "audio", "json"];
var loadImage = (url) => new Promise((resolve2, reject) => {
  const img = new Image();
  img.onload = () => resolve2(img);
  img.onerror = () => reject(new Error(`Failed to load image "${url}"`));
  img.src = url;
});
var fetchOrThrow = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load "${url}": ${response.status}`);
  return response;
};
var Assets = class {
  /** @param {AssetsOptions} [options] */
  constructor({ audio, loaders = {} } = {}) {
    this.audio = audio;
    this.progress = 1;
    this._loaders = {
      images: loaders.images ?? loadImage,
      audio: loaders.audio ?? ((url) => this._loadSound(url)),
      json: loaders.json ?? (async (url) => (await fetchOrThrow(url)).json())
    };
    this._cache = { images: /* @__PURE__ */ new Map(), audio: /* @__PURE__ */ new Map(), json: /* @__PURE__ */ new Map() };
  }
  /**
   * Load everything in the manifest in parallel.
   * @param {AssetManifest} manifest
   * @param {(progress: number) => void} [onProgress] Called after each file with progress 0..1.
   * @returns {Promise<void>} Rejects with the failing URL if any file fails to load.
   * @example
   * await assets.load({ images: { hero: 'img/hero.png' }, audio: { jump: 'sfx/jump.wav' } });
   */
  async load(manifest, onProgress) {
    const jobs = ASSET_TYPES.flatMap(
      (type) => Object.entries(manifest[type] ?? {}).map(([key, url]) => ({ type, key, url }))
    );
    let finished = 0;
    this.progress = jobs.length === 0 ? 1 : 0;
    await Promise.all(
      jobs.map(async ({ type, key, url }) => {
        const cache = this._cache[type];
        if (!cache.has(key)) cache.set(key, await this._loaders[type](url));
        finished++;
        this.progress = finished / jobs.length;
        onProgress?.(this.progress);
      })
    );
  }
  /**
   * @param {string} key
   * @returns {HTMLImageElement}
   * @throws {Error} If the key hasn't been loaded.
   */
  image(key) {
    return this._get("images", key);
  }
  /**
   * @param {string} key
   * @returns {AudioBuffer}
   * @throws {Error} If the key hasn't been loaded.
   */
  sound(key) {
    return this._get("audio", key);
  }
  /**
   * @param {string} key
   * @returns {any} The parsed JSON.
   * @throws {Error} If the key hasn't been loaded.
   */
  json(key) {
    return this._get("json", key);
  }
  /**
   * @param {AssetType} type
   * @param {string} key
   * @returns {boolean}
   */
  has(type, key) {
    return this._cache[type].has(key);
  }
  _get(type, key) {
    const value = this._cache[type].get(key);
    if (value === void 0) throw new Error(`Asset "${key}" not loaded (${type})`);
    return value;
  }
  async _loadSound(url) {
    const buffer = await (await fetchOrThrow(url)).arrayBuffer();
    return this.audio ? this.audio.decode(buffer) : buffer;
  }
};

// src/platform/Audio.js
var SILENT = 1e-4;
var Audio = class {
  constructor() {
    this._ctx = null;
    this._master = null;
    this._buses = /* @__PURE__ */ new Map();
    this._volume = 1;
    this._muted = false;
    this.assets = null;
    this._unlock = () => this.unlock();
  }
  /** The AudioContext, or null if Web Audio is unavailable. @type {AudioContext | null} */
  get ctx() {
    if (!this._ctx) this._createContext();
    return this._ctx;
  }
  /** Unlock audio on the first pointer or key press. Called by {@link Game#start}. */
  attach() {
    window.addEventListener("pointerdown", this._unlock, { once: true });
    window.addEventListener("keydown", this._unlock, { once: true });
  }
  /** Resume a suspended context. Must run inside a user gesture to take effect. */
  unlock() {
    const ctx = this.ctx;
    if (ctx && ctx.state === "suspended") ctx.resume();
  }
  /**
   * @param {ArrayBuffer} buffer Encoded audio file contents.
   * @returns {Promise<AudioBuffer | null>} Null when Web Audio is unavailable.
   */
  decode(buffer) {
    const ctx = this.ctx;
    return ctx ? ctx.decodeAudioData(buffer) : Promise.resolve(null);
  }
  /** Master volume, 0..1. */
  get volume() {
    return this._volume;
  }
  set volume(value) {
    this._volume = value;
    this._applyVolume();
  }
  /** Silences all output without changing {@link Audio#volume}. */
  get muted() {
    return this._muted;
  }
  set muted(value) {
    this._muted = value;
    this._applyVolume();
  }
  /**
   * A named gain node feeding the master volume, created on first use. Use one
   * per group (music, sfx, ui) to set or fade the group's volume.
   * @param {string} name
   * @returns {GainNode | null} Null if Web Audio is unavailable.
   * @example
   * audio.bus('music').gain.value = 0.5;
   */
  bus(name) {
    const ctx = this.ctx;
    if (!ctx) return null;
    let gain = this._buses.get(name);
    if (!gain) {
      gain = ctx.createGain();
      gain.connect(this._master);
      this._buses.set(name, gain);
    }
    return gain;
  }
  /**
   * @param {string | AudioBuffer} sound Asset key or decoded buffer.
   * @param {PlayOptions} [options]
   * @returns {SoundHandle | null} Handle for {@link Audio#stop}, or null if audio is unavailable.
   * @throws {Error} If `sound` is a key that hasn't been loaded.
   */
  play(sound, { volume = 1, loop = false, rate = 1, loopStart, loopEnd, bus } = {}) {
    const ctx = this.ctx;
    if (!ctx) return null;
    const buffer = typeof sound === "string" ? this.assets?.sound(sound) : sound;
    if (!buffer) return null;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;
    if (loopStart !== void 0) source.loopStart = loopStart;
    if (loopEnd !== void 0) source.loopEnd = loopEnd;
    source.playbackRate.value = rate;
    const gain = this._gainNode(volume);
    source.connect(gain).connect(this._output(bus));
    source.start();
    return { source, gain };
  }
  /**
   * Stop a sound started with {@link Audio#play}. Ignores null and already-stopped handles.
   * @param {SoundHandle | null} handle
   */
  stop(handle) {
    try {
      handle?.source.stop();
    } catch {
      return;
    }
  }
  /**
   * Play a synthesized beep that fades out. Does nothing until audio is unlocked.
   * @param {ToneOptions} [options]
   * @example
   * audio.tone({ freq: 300, to: 600, duration: 0.1 }); // rising jump blip
   */
  tone({ freq = 440, to, duration = 0.1, type = "square", volume = 0.2, bus } = {}) {
    const ctx = this.ctx;
    if (ctx?.state !== "running") return;
    const now = ctx.currentTime;
    const end = now + duration;
    const oscillator = ctx.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, now);
    if (to !== void 0) oscillator.frequency.exponentialRampToValueAtTime(Math.max(to, 1), end);
    const gain = this._gainNode(volume);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(SILENT, end);
    oscillator.connect(gain).connect(this._output(bus));
    oscillator.start(now);
    oscillator.stop(end);
  }
  _createContext() {
    const AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!AudioContextClass) return;
    this._ctx = new AudioContextClass();
    this._master = this._ctx.createGain();
    this._master.connect(this._ctx.destination);
    this._applyVolume();
  }
  _output(busName) {
    return busName === void 0 ? this._master : this.bus(busName);
  }
  _gainNode(volume) {
    const gain = this._ctx.createGain();
    gain.gain.value = volume;
    return gain;
  }
  _applyVolume() {
    if (this._master) this._master.gain.value = this._muted ? 0 : this._volume;
  }
};

// src/platform/Input.js
var KEYS_THAT_SCROLL_THE_PAGE = /* @__PURE__ */ new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"]);
var hasAny = (set, keys) => {
  if (typeof keys === "string") return set.has(keys);
  for (let i = 0; i < keys.length; i++) if (set.has(keys[i])) return true;
  return false;
};
var Input = class {
  /** @param {InputOptions} [options] */
  constructor({ canvas, toLogical } = {}) {
    this.canvas = canvas;
    this.toLogical = toLogical;
    this._keysDown = /* @__PURE__ */ new Set();
    this._pressedSincePoll = /* @__PURE__ */ new Set();
    this._releasedSincePoll = /* @__PURE__ */ new Set();
    this._held = /* @__PURE__ */ new Set();
    this._pressed = /* @__PURE__ */ new Set();
    this._released = /* @__PURE__ */ new Set();
    this._rawPointer = { x: 0, y: 0, down: false, pressed: false, released: false };
    this._worldPoint = { x: 0, y: 0 };
    this.pointer = { x: 0, y: 0, worldX: 0, worldY: 0, down: false, justPressed: false, justReleased: false };
    this._listeners = this._createListeners();
  }
  /** Start listening to DOM events. Called by {@link Game#start}. */
  attach() {
    for (const [target, type, handler] of this._listeners) target?.addEventListener(type, handler);
  }
  detach() {
    for (const [target, type, handler] of this._listeners) target?.removeEventListener(type, handler);
  }
  /**
   * Feed a key press, as the keydown listener does. Useful in tests and for virtual controls.
   * @param {string} code
   * @param {boolean} [repeat=false] Repeats are ignored.
   */
  keyDown(code, repeat = false) {
    if (repeat || this._keysDown.has(code)) return;
    this._keysDown.add(code);
    this._pressedSincePoll.add(code);
  }
  /** @param {string} code */
  keyUp(code) {
    if (!this._keysDown.has(code)) return;
    this._keysDown.delete(code);
    this._releasedSincePoll.add(code);
  }
  pointerDown() {
    this._rawPointer.down = true;
    this._rawPointer.pressed = true;
  }
  pointerUp() {
    if (!this._rawPointer.down) return;
    this._rawPointer.down = false;
    this._rawPointer.released = true;
  }
  /**
   * @param {number} x Logical pixels.
   * @param {number} y
   */
  pointerMove(x, y) {
    this._rawPointer.x = x;
    this._rawPointer.y = y;
  }
  /** Release every key and the pointer. */
  reset() {
    for (const code of this._keysDown) this._releasedSincePoll.add(code);
    this._keysDown.clear();
    this.pointerUp();
  }
  /**
   * Take the per-step snapshot. The game calls this before each update.
   * @param {import('../render/Camera.js').Camera | null} [camera] Used for `pointer.worldX/worldY`; screen coordinates are used when omitted.
   */
  poll(camera) {
    this._snapshotKeys();
    this._snapshotPointer(camera);
  }
  /**
   * Held during this step. Includes keys tapped and released within the step.
   * @param {KeyQuery} keys
   * @returns {boolean}
   */
  isDown(keys) {
    return hasAny(this._held, keys);
  }
  /**
   * Pressed during this step. True for exactly one step per press.
   * @param {KeyQuery} keys
   * @returns {boolean}
   */
  justPressed(keys) {
    return hasAny(this._pressed, keys);
  }
  /**
   * @param {KeyQuery} keys
   * @returns {boolean}
   */
  justReleased(keys) {
    return hasAny(this._released, keys);
  }
  /**
   * `KeyboardEvent.code`s pressed this step. Read it each step instead of keeping it: the set is reused.
   * @type {ReadonlySet<string>}
   * @example
   * const [code] = input.pressedCodes; // the key to bind, if any
   */
  get pressedCodes() {
    return this._pressed;
  }
  /** @returns {boolean} True if any key was pressed this step. */
  anyPressed() {
    return this._pressed.size > 0;
  }
  /**
   * Direction from a pair of keys. Holding both gives 0.
   * @param {KeyQuery} negative
   * @param {KeyQuery} positive
   * @returns {-1 | 0 | 1}
   * @example
   * this.vel.x = input.axis(['ArrowLeft', 'KeyA'], ['ArrowRight', 'KeyD']) * SPEED;
   */
  axis(negative, positive) {
    return (
      /** @type {-1 | 0 | 1} */
      (this.isDown(positive) ? 1 : 0) - (this.isDown(negative) ? 1 : 0)
    );
  }
  _snapshotKeys() {
    const pressed = this._pressedSincePoll;
    this._pressedSincePoll = this._pressed;
    this._pressed = pressed;
    this._pressedSincePoll.clear();
    const released = this._releasedSincePoll;
    this._releasedSincePoll = this._released;
    this._released = released;
    this._releasedSincePoll.clear();
    this._held.clear();
    for (const code of this._keysDown) this._held.add(code);
    for (const code of this._pressed) this._held.add(code);
  }
  _snapshotPointer(camera) {
    const raw = this._rawPointer;
    const pointer = this.pointer;
    pointer.x = raw.x;
    pointer.y = raw.y;
    pointer.justPressed = raw.pressed;
    pointer.justReleased = raw.released;
    pointer.down = raw.down || raw.pressed;
    raw.pressed = false;
    raw.released = false;
    const world = camera ? camera.screenToWorld(raw.x, raw.y, this._worldPoint) : raw;
    pointer.worldX = world.x;
    pointer.worldY = world.y;
  }
  /** @returns {Array<[EventTarget | null | undefined, string, (e: any) => void]>} */
  _createListeners() {
    const win = typeof window === "undefined" ? null : window;
    const movePointer = (e) => this.toLogical?.(e.clientX, e.clientY, this._rawPointer);
    return [
      [
        win,
        "keydown",
        (e) => {
          if (KEYS_THAT_SCROLL_THE_PAGE.has(e.code)) e.preventDefault();
          this.keyDown(e.code, e.repeat);
        }
      ],
      [win, "keyup", (e) => this.keyUp(e.code)],
      [win, "blur", () => this.reset()],
      [
        this.canvas,
        "pointerdown",
        (e) => {
          if (!e.isPrimary) return;
          this.canvas.setPointerCapture?.(e.pointerId);
          movePointer(e);
          this.pointerDown();
        }
      ],
      [this.canvas, "pointermove", (e) => e.isPrimary && movePointer(e)],
      [
        this.canvas,
        "pointerup",
        (e) => {
          if (!e.isPrimary) return;
          movePointer(e);
          this.pointerUp();
        }
      ],
      [this.canvas, "pointercancel", () => this.pointerUp()]
    ];
  }
};

// src/render/Viewport.js
var resolveCanvas = (canvas) => {
  if (typeof canvas === "string") {
    const found = document.querySelector(canvas);
    if (!found) throw new Error(`Canvas "${canvas}" not found`);
    return found;
  }
  if (canvas) return canvas;
  const created = document.createElement("canvas");
  document.body.appendChild(created);
  return created;
};
var fitScale = (mode, width, height, dpr) => {
  if (mode === "none") return 1;
  const scale = Math.min(window.innerWidth / width, window.innerHeight / height);
  if (mode !== "pixel") return scale;
  const wholeDevicePixels = Math.max(1, Math.floor(scale * dpr));
  return wholeDevicePixels / dpr;
};
var Viewport = class {
  /**
   * @param {import('./Renderer.js').RendererOptions} options
   * @throws {Error} If `canvas` is a selector that matches nothing.
   */
  constructor({ canvas, width, height, scale = "fit" }) {
    this.canvas = resolveCanvas(canvas);
    this.width = width;
    this.height = height;
    this.scaleMode = scale;
    this.pixelScale = 1;
    this.baseScaleX = 1;
    this.baseScaleY = 1;
    this.onResize = null;
    this._onWindowResize = () => this.resize();
    this.canvas.style.touchAction = "none";
  }
  /** Start resizing with the window. */
  attach() {
    window.addEventListener("resize", this._onWindowResize);
  }
  detach() {
    window.removeEventListener("resize", this._onWindowResize);
  }
  /** Recompute the canvas size from the window size and devicePixelRatio. */
  resize() {
    const { width, height, canvas } = this;
    const dpr = window.devicePixelRatio || 1;
    const scale = fitScale(this.scaleMode, width, height, dpr);
    this.pixelScale = scale;
    canvas.width = Math.round(width * scale * dpr);
    canvas.height = Math.round(height * scale * dpr);
    canvas.style.width = `${width * scale}px`;
    canvas.style.height = `${height * scale}px`;
    this.baseScaleX = canvas.width / width;
    this.baseScaleY = canvas.height / height;
    this.onResize?.();
  }
  /**
   * Convert client coordinates (e.g. from a pointer event) to logical pixels.
   * @param {number} clientX
   * @param {number} clientY
   * @param {{ x: number, y: number }} [out] Object to write into instead of allocating.
   * @returns {{ x: number, y: number }}
   */
  toLogical(clientX, clientY, out = { x: 0, y: 0 }) {
    const bounds = this.canvas.getBoundingClientRect();
    out.x = (clientX - bounds.left) * this.width / bounds.width;
    out.y = (clientY - bounds.top) * this.height / bounds.height;
    return out;
  }
};

// src/render/Renderer.js
var NO_OPTIONS = {};
var notImplemented = (name) => {
  throw new Error(`Renderer backend does not implement ${name}()`);
};
var Renderer = class {
  /**
   * @param {RendererOptions} options
   * @throws {Error} If `canvas` is a selector that matches nothing.
   */
  constructor({ canvas, width, height, scale = "fit", background = "#000" }) {
    this.viewport = new Viewport({ canvas, width, height, scale });
    this.width = width;
    this.height = height;
    this.scaleMode = scale;
    this.background = background;
    this.onResize = null;
    this._imageRegion = { image: null, sx: 0, sy: 0, sw: 0, sh: 0, originX: 0, originY: 0 };
    this.viewport.onResize = () => {
      this._applyResize();
      this.onResize?.();
    };
  }
  /** @type {HTMLCanvasElement} */
  get canvas() {
    return this.viewport.canvas;
  }
  /** CSS pixels per logical pixel after the last resize. */
  get pixelScale() {
    return this.viewport.pixelScale;
  }
  /** Start resizing with the window. Called by {@link Game#start}. */
  attach() {
    this.viewport.attach();
  }
  detach() {
    this.viewport.detach();
  }
  /** Recompute the canvas size from the window size and devicePixelRatio. */
  resize() {
    this.viewport.resize();
  }
  /**
   * Convert client coordinates (e.g. from a pointer event) to logical pixels.
   * @param {number} clientX
   * @param {number} clientY
   * @param {{ x: number, y: number }} [out] Object to write into instead of allocating.
   * @returns {{ x: number, y: number }}
   */
  toLogical(clientX, clientY, out) {
    return this.viewport.toLogical(clientX, clientY, out);
  }
  /** Start a frame. Called by the game before any scene draws. */
  beginFrame() {
    this.clear();
  }
  /** Finish a frame. Called by the game after everything is drawn. Batching backends flush here. */
  endFrame() {
  }
  /**
   * Draw an image or a region of one, anchored at `x, y`.
   * @param {ImageLike} img
   * @param {number} x
   * @param {number} y
   * @param {DrawOptions} [options]
   */
  image(img, x, y, options = NO_OPTIONS) {
    const region = this._imageRegion;
    region.image = img;
    region.sx = options.sx ?? 0;
    region.sy = options.sy ?? 0;
    region.sw = options.sw ?? img.width;
    region.sh = options.sh ?? img.height;
    region.originX = 0;
    region.originY = 0;
    this.sprite(region, x, y, options);
  }
  /** React to a new canvas size (backing store already resized). */
  _applyResize() {
    notImplemented("_applyResize");
  }
  /**
   * Reset the transform and alpha, then fill the screen.
   * @param {string} [_color] Defaults to the game's background.
   */
  clear(_color) {
    notImplemented("clear");
  }
  /**
   * @param {number} _x
   * @param {number} _y
   * @param {number} _w
   * @param {number} _h
   * @param {string} _color
   */
  rect(_x, _y, _w, _h, _color) {
    notImplemented("rect");
  }
  /**
   * @param {number} _x
   * @param {number} _y
   * @param {number} _w
   * @param {number} _h
   * @param {string} _color
   * @param {number} [_lineWidth=1]
   */
  strokeRect(_x, _y, _w, _h, _color, _lineWidth) {
    notImplemented("strokeRect");
  }
  /**
   * @param {number} _x Center.
   * @param {number} _y Center.
   * @param {number} _radius
   * @param {string} _color
   */
  circle(_x, _y, _radius, _color) {
    notImplemented("circle");
  }
  /**
   * @param {number} _x Center.
   * @param {number} _y Center.
   * @param {number} _radius
   * @param {string} _color
   * @param {number} [_lineWidth=1]
   */
  strokeCircle(_x, _y, _radius, _color, _lineWidth) {
    notImplemented("strokeCircle");
  }
  /**
   * @param {number} _x1
   * @param {number} _y1
   * @param {number} _x2
   * @param {number} _y2
   * @param {string} _color
   * @param {number} [_lineWidth=1]
   */
  line(_x1, _y1, _x2, _y2, _color, _lineWidth) {
    notImplemented("line");
  }
  /**
   * Filled polygon.
   * @param {number[]} _points Flat coordinate list: `[x0, y0, x1, y1, ...]`.
   * @param {string} _color
   */
  poly(_points, _color) {
    notImplemented("poly");
  }
  /**
   * @param {string} _str
   * @param {number} _x
   * @param {number} _y Top of the text unless `baseline` says otherwise.
   * @param {TextOptions} [_options]
   */
  text(_str, _x, _y, _options) {
    notImplemented("text");
  }
  /**
   * Draw a sprite anchored at `x, y`. `originX`/`originY` in `options` override the sprite's own.
   * @param {SpriteRegion} _sprite
   * @param {number} _x
   * @param {number} _y
   * @param {DrawOptions} [_options] Source-rectangle options are ignored.
   */
  sprite(_sprite, _x, _y, _options) {
    notImplemented("sprite");
  }
  /** Save transform, alpha and styles. Pair every call with {@link Renderer#pop}. */
  push() {
    notImplemented("push");
  }
  pop() {
    notImplemented("pop");
  }
  /**
   * @param {number} _x
   * @param {number} _y
   */
  translate(_x, _y) {
    notImplemented("translate");
  }
  /** @param {number} _radians Clockwise, around the current origin. */
  rotate(_radians) {
    notImplemented("rotate");
  }
  /**
   * @param {number} _x
   * @param {number} [_y=x]
   */
  scale(_x, _y) {
    notImplemented("scale");
  }
  /**
   * Opacity (0..1) for subsequent draws. Persists until changed or restored by {@link Renderer#pop}.
   * @type {number}
   */
  get alpha() {
    return notImplemented("alpha");
  }
  set alpha(_value) {
    notImplemented("alpha");
  }
};

// src/render/canvas/CanvasRenderer.js
var NO_OPTIONS2 = {};
var FULL_CIRCLE = Math.PI * 2;
var CanvasRenderer = class extends Renderer {
  /**
   * @param {RendererOptions} options
   * @throws {Error} If `canvas` is a selector that matches nothing.
   */
  constructor(options) {
    super(options);
    this.ctx = this.canvas.getContext("2d");
    this.resize();
  }
  _applyResize() {
    this.ctx.imageSmoothingEnabled = this.scaleMode !== "pixel";
    this._resetTransform();
  }
  /** @param {string} [color] */
  clear(color = this.background) {
    this._resetTransform();
    this.ctx.globalAlpha = 1;
    this.rect(0, 0, this.width, this.height, color);
  }
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @param {string} color
   */
  rect(x, y, w, h, color) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w, h);
  }
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @param {string} color
   * @param {number} [lineWidth=1]
   */
  strokeRect(x, y, w, h, color, lineWidth = 1) {
    this._setStroke(color, lineWidth);
    this.ctx.strokeRect(x, y, w, h);
  }
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   * @param {string} color
   */
  circle(x, y, radius, color) {
    this.ctx.fillStyle = color;
    this._circlePath(x, y, radius);
    this.ctx.fill();
  }
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   * @param {string} color
   * @param {number} [lineWidth=1]
   */
  strokeCircle(x, y, radius, color, lineWidth = 1) {
    this._setStroke(color, lineWidth);
    this._circlePath(x, y, radius);
    this.ctx.stroke();
  }
  /**
   * @param {number} x1
   * @param {number} y1
   * @param {number} x2
   * @param {number} y2
   * @param {string} color
   * @param {number} [lineWidth=1]
   */
  line(x1, y1, x2, y2, color, lineWidth = 1) {
    const ctx = this.ctx;
    this._setStroke(color, lineWidth);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  /**
   * @param {number[]} points
   * @param {string} color
   */
  poly(points, color) {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
    ctx.closePath();
    ctx.fill();
  }
  /**
   * @param {string} str
   * @param {number} x
   * @param {number} y
   * @param {TextOptions} [options]
   */
  text(str, x, y, options = NO_OPTIONS2) {
    const ctx = this.ctx;
    ctx.font = options.font ?? "16px sans-serif";
    ctx.fillStyle = options.color ?? "#fff";
    ctx.textAlign = options.align ?? "left";
    ctx.textBaseline = options.baseline ?? "top";
    ctx.fillText(str, x, y);
  }
  /**
   * @param {SpriteRegion} sprite
   * @param {number} x
   * @param {number} y
   * @param {DrawOptions} [options]
   */
  sprite(sprite, x, y, options = NO_OPTIONS2) {
    const ctx = this.ctx;
    const w = options.w ?? sprite.sw;
    const h = options.h ?? sprite.sh;
    const anchorX = (options.originX ?? sprite.originX) * w;
    const anchorY = (options.originY ?? sprite.originY) * h;
    const { sx, sy, sw, sh } = sprite;
    const image = (
      /** @type {CanvasImageSource} */
      sprite.image
    );
    if (!needsTransform(options)) {
      ctx.drawImage(image, sx, sy, sw, sh, x - anchorX, y - anchorY, w, h);
      return;
    }
    ctx.save();
    ctx.translate(x, y);
    if (options.rotation) ctx.rotate(options.rotation);
    if (options.alpha !== void 0) ctx.globalAlpha *= options.alpha;
    ctx.translate(w / 2 - anchorX, h / 2 - anchorY);
    if (options.flipX || options.flipY) ctx.scale(options.flipX ? -1 : 1, options.flipY ? -1 : 1);
    ctx.drawImage(image, sx, sy, sw, sh, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
  push() {
    this.ctx.save();
  }
  pop() {
    this.ctx.restore();
  }
  /**
   * @param {number} x
   * @param {number} y
   */
  translate(x, y) {
    this.ctx.translate(x, y);
  }
  /** @param {number} radians */
  rotate(radians) {
    this.ctx.rotate(radians);
  }
  /**
   * @param {number} x
   * @param {number} [y=x]
   */
  scale(x, y = x) {
    this.ctx.scale(x, y);
  }
  get alpha() {
    return this.ctx.globalAlpha;
  }
  set alpha(value) {
    this.ctx.globalAlpha = value;
  }
  _resetTransform() {
    const { baseScaleX, baseScaleY } = this.viewport;
    this.ctx.setTransform(baseScaleX, 0, 0, baseScaleY, 0, 0);
  }
  _setStroke(color, lineWidth) {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
  }
  _circlePath(x, y, radius) {
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, FULL_CIRCLE);
  }
};
var needsTransform = (options) => Boolean(options.rotation || options.flipX || options.flipY || options.alpha !== void 0);

// src/util/Debug.js
var TEXT_COLOR = "#0f0";
var PANEL_COLOR = "rgba(0,0,0,0.6)";
var FONT = "10px monospace";
var LINE_HEIGHT = 12;
var CHAR_WIDTH = 6;
var TEXT_STYLE = { font: FONT, color: TEXT_COLOR };
var Debug = class {
  /**
   * @param {import('../core/Game.js').Game} game
   * @param {boolean} [enabled=false]
   */
  constructor(game, enabled = false) {
    this.game = game;
    this.enabled = enabled;
    this.toggleKey = "Backquote";
    this.hitboxColor = TEXT_COLOR;
    this.ignoreTags = /* @__PURE__ */ new Set();
    this._watches = /* @__PURE__ */ new Map();
    this._lines = [];
    this._shown = 0;
  }
  /**
   * Show a value as an extra stat line, read every frame while the overlay is on.
   * Watching an existing label replaces it. Watches belong to the game, so
   * remove scene-specific ones in the scene's `exit`.
   * @param {string} label
   * @param {() => unknown} read
   * @example
   * game.debug.watch('particles', () => this.count('fx'));
   */
  watch(label, read) {
    this._watches.set(label, read);
  }
  /** @param {string} label */
  unwatch(label) {
    this._watches.delete(label);
  }
  /**
   * Whether the overlay draws an entity.
   * @param {import('../gameplay/Entity.js').Entity} entity
   * @returns {boolean}
   */
  shows(entity) {
    if (!entity.debug || !entity.visible || entity.dead) return false;
    if (this.ignoreTags.size === 0) return true;
    for (const tag of this.ignoreTags) if (entity.tags.has(tag)) return false;
    return true;
  }
  /** Check the toggle key. Called by the game each step. */
  update() {
    if (this.game.input.justPressed(this.toggleKey)) this.enabled = !this.enabled;
  }
  /**
   * Draw the overlay on top of everything. Called by the game each frame. The stats
   * panel is sized in CSS pixels, so it keeps the same size at any logical resolution.
   * @param {import('../render/Renderer.js').Renderer} r
   */
  render(r) {
    if (!this.enabled) return;
    const scene = this.game.scenes.current;
    this._shown = 0;
    if (scene) this._drawEntities(r, scene);
    this._drawStats(r, scene);
  }
  _drawEntities(r, scene) {
    const lineWidth = 1 / scene.camera.zoom;
    r.push();
    scene.camera.apply(r);
    for (const entity of scene.entities) {
      if (!this.shows(entity)) continue;
      this._shown++;
      entity.drawDebug(r, this.hitboxColor, lineWidth);
    }
    r.pop();
  }
  _drawStats(r, scene) {
    const { fps, ups } = this.game.loop;
    const lines = this._lines;
    lines.length = 0;
    lines.push(
      `FPS ${fps}  UPS ${ups}`,
      `entities ${scene ? scene.entities.length : 0} (shown ${this._shown})`,
      `scene ${scene ? scene.key : "-"}`
    );
    for (const [label, read] of this._watches) lines.push(`${label} ${read()}`);
    const panelScale = 1 / r.pixelScale;
    r.push();
    if (panelScale !== 1) r.scale(panelScale, panelScale);
    let longest = 0;
    for (const line of lines) if (line.length > longest) longest = line.length;
    r.rect(4, 4, longest * CHAR_WIDTH + 8, lines.length * LINE_HEIGHT + 4, PANEL_COLOR);
    for (let i = 0; i < lines.length; i++) {
      r.text(lines[i], 8, 8 + i * LINE_HEIGHT, TEXT_STYLE);
    }
    r.pop();
  }
};

// src/core/Loop.js
var FLOAT_TOLERANCE = 1e-7;
var Loop = class {
  /** @param {LoopOptions} options */
  constructor({ update, render, step = 1 / 60, maxFrame = 0.25, raf, caf }) {
    this.update = update;
    this.render = render;
    this.step = step;
    this.maxFrame = maxFrame;
    this._requestFrame = raf ?? ((cb) => globalThis.requestAnimationFrame(cb));
    this._cancelFrame = caf ?? ((handle) => globalThis.cancelAnimationFrame(handle));
    this._onFrame = (now) => this.tick(now);
    this._handle = null;
    this._lastTime = -1;
    this._accumulator = 0;
    this.running = false;
    this.paused = false;
    this.fps = 0;
    this.ups = 0;
    this._statsTime = 0;
    this._framesThisSecond = 0;
    this._updatesThisSecond = 0;
  }
  start() {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this._lastTime = -1;
    this._accumulator = 0;
    this._handle = this._requestFrame(this._onFrame);
  }
  stop() {
    this.running = false;
    if (this._handle !== null) this._cancelFrame(this._handle);
    this._handle = null;
  }
  /** Keep scheduling frames but skip update and render. */
  pause() {
    this.paused = true;
  }
  /** Continue without catching up on the time spent paused. */
  resume() {
    this.paused = false;
    this._lastTime = -1;
  }
  /**
   * Advance one animation frame. Called by `raf`; call it directly to drive
   * the loop with a fake clock.
   * @param {number} nowMs Timestamp in milliseconds, as passed by `requestAnimationFrame`.
   */
  tick(nowMs) {
    if (!this.running) return;
    this._handle = this._requestFrame(this._onFrame);
    if (this.paused) return;
    const dt = this._frameDuration(nowMs / 1e3);
    this._accumulator += dt;
    while (this._accumulator >= this.step - FLOAT_TOLERANCE) {
      this.update(this.step);
      this._accumulator -= this.step;
      this._updatesThisSecond++;
    }
    this._accumulator = Math.max(this._accumulator, 0);
    this.render(this._accumulator / this.step);
    this._framesThisSecond++;
    this._trackStats(dt);
  }
  _frameDuration(now) {
    const elapsed = this._lastTime < 0 ? 0 : now - this._lastTime;
    this._lastTime = now;
    return Math.min(Math.max(elapsed, 0), this.maxFrame);
  }
  _trackStats(dt) {
    this._statsTime += dt;
    if (this._statsTime < 1) return;
    this.fps = this._framesThisSecond;
    this.ups = this._updatesThisSecond;
    this._framesThisSecond = 0;
    this._updatesThisSecond = 0;
    this._statsTime -= 1;
  }
};

// src/core/SceneManager.js
var isPromise = (value) => value != null && typeof value.then === "function";
var SceneManager = class {
  /** @param {import('./Game.js').Game} game */
  constructor(game) {
    this.game = game;
    this._registry = /* @__PURE__ */ new Map();
    this.stack = [];
    this._queue = [];
    this._requestId = 0;
    this.loading = false;
  }
  /**
   * @param {string} key
   * @param {SceneClass} SceneClass
   * @returns {this}
   */
  add(key, SceneClass) {
    this._registry.set(key, SceneClass);
    return this;
  }
  /** The top scene, or null when the stack is empty. @type {Scene | null} */
  get current() {
    return this.stack.at(-1) ?? null;
  }
  /**
   * Exit every scene on the stack and start a new instance of `key`.
   * @param {string} key
   * @param {any} [data] Passed to the new scene's `enter`.
   * @returns {Promise<void>} Settles once the scene has entered (after any async preload).
   * @throws {Error} If `key` is not registered.
   */
  switch(key, data) {
    return this._request("switch", key, data);
  }
  /**
   * Start `key` on top of the current scene, which keeps rendering but stops updating.
   * @param {string} key
   * @param {any} [data] Passed to the new scene's `enter`.
   * @returns {Promise<void>}
   * @throws {Error} If `key` is not registered.
   */
  push(key, data) {
    return this._request("push", key, data);
  }
  /**
   * Exit the top scene. The scene below receives `resume(data)`.
   * @param {any} [data]
   * @returns {Promise<void>}
   */
  pop(data) {
    return this._request("pop", null, data);
  }
  _request(op, key, data) {
    if (key !== null && !this._registry.has(key)) throw new Error(`Unknown scene "${key}"`);
    if (this.game._stepping) {
      this._queue.push({ op, key, data });
      return Promise.resolve();
    }
    return this._apply(op, key, data);
  }
  _flush() {
    while (this._queue.length > 0) {
      const { op, key, data } = this._queue.shift();
      this._apply(op, key, data);
    }
  }
  _apply(op, key, data) {
    const requestId = ++this._requestId;
    if (op === "pop") {
      this._popTop(data);
      return Promise.resolve();
    }
    if (op === "switch") this._exitAll();
    return this._open(key, data, requestId);
  }
  _popTop(data) {
    this.stack.pop()?.exit();
    this._syncContext();
    this.current?.resume(data);
  }
  _exitAll() {
    while (this.stack.length > 0) this.stack.pop().exit();
    this._syncContext();
  }
  _open(key, data, requestId) {
    const SceneClass = this._registry.get(key);
    const scene = new SceneClass(this.game);
    scene.key = key;
    const enter = () => {
      this.stack.push(scene);
      this._syncContext();
      scene.enter(data);
    };
    const preloading = scene.preload(this.game.assets, data);
    if (!isPromise(preloading)) {
      enter();
      return Promise.resolve();
    }
    this.loading = true;
    const isLatest = () => requestId === this._requestId;
    return preloading.then(
      () => {
        if (!isLatest()) return;
        this.loading = false;
        enter();
      },
      (error) => {
        if (isLatest()) this.loading = false;
        throw error;
      }
    );
  }
  _firstDrawnIndex() {
    for (let i = this.stack.length - 1; i > 0; i--) if (this.stack[i].opaque) return i;
    return 0;
  }
  _syncContext() {
    const ctx = this.game.ctx;
    ctx.scene = this.current;
    ctx.camera = this.current ? this.current.camera : null;
  }
};

// src/core/Game.js
var LOADING_BAR_COLOR = "#fff";
var createContext = (game) => ({
  game,
  input: game.input,
  assets: game.assets,
  renderer: game.renderer,
  audio: game.audio,
  events: game.events,
  scene: null,
  camera: null
});
var Game = class {
  /** @param {GameOptions} [options] */
  constructor({
    canvas,
    width = 640,
    height = 360,
    scale = "fit",
    background = "#000",
    renderer: RendererClass = CanvasRenderer,
    step = 1 / 60,
    debug = false
  } = {}) {
    this.width = width;
    this.height = height;
    this.paused = false;
    this._stepping = false;
    this.overlay = null;
    this.events = new Events();
    this.renderer = new RendererClass({ canvas, width, height, scale, background });
    this.audio = new Audio();
    this.assets = new Assets({ audio: this.audio });
    this.audio.assets = this.assets;
    this.input = new Input({
      canvas: this.renderer.canvas,
      toLogical: (x, y, out) => this.renderer.toLogical(x, y, out)
    });
    this.scenes = new SceneManager(this);
    this.debug = new Debug(this, debug);
    this.ctx = createContext(this);
    this.loop = new Loop({ step, update: (dt) => this._update(dt), render: (alpha) => this._render(alpha) });
    this.renderer.onResize = () => this.events.emit("resize", this.renderer);
    this._onVisibilityChange = () => this._pauseWhileHidden();
  }
  /**
   * Shorthand for `game.events.on`.
   * @param {string} type
   * @param {Function} fn
   * @returns {() => void} Unsubscribe function.
   */
  on(type, fn) {
    return this.events.on(type, fn);
  }
  /**
   * @param {string} type
   * @param {Function} fn
   */
  off(type, fn) {
    this.events.off(type, fn);
  }
  /**
   * @param {string} type
   * @param {...any} args
   */
  emit(type, ...args) {
    this.events.emit(type, ...args);
  }
  /**
   * Attach input, audio and resize listeners, start the loop and optionally switch to a scene.
   * @param {string} [key] Registered scene to start.
   * @param {any} [data] Passed to the scene's `enter`.
   * @returns {Promise<void>} Settles once the scene has entered.
   */
  start(key, data) {
    this.input.attach();
    this.audio.attach();
    this.renderer.attach();
    document.addEventListener("visibilitychange", this._onVisibilityChange);
    this.loop.start();
    return key ? this.scenes.switch(key, data) : Promise.resolve();
  }
  /** Freeze updates and rendering. The canvas keeps the last frame. */
  pause() {
    this.paused = true;
    this.loop.pause();
    this.events.emit("pause");
  }
  /** Continue after {@link Game#pause} without catching up on the paused time. */
  resume() {
    this.paused = false;
    this.loop.resume();
    this.events.emit("resume");
  }
  /** Stop the loop and detach all listeners. */
  stop() {
    this.loop.stop();
    this.input.detach();
    this.renderer.detach();
    document.removeEventListener("visibilitychange", this._onVisibilityChange);
    this.events.emit("stop");
  }
  _pauseWhileHidden() {
    if (document.hidden) {
      this.loop.pause();
      this.events.emit("hidden");
      return;
    }
    if (!this.paused) this.loop.resume();
    this.events.emit("visible");
  }
  _update(dt) {
    const scene = this.scenes.current;
    this.input.poll(scene ? scene.camera : null);
    this.debug.update();
    if (scene && !this.scenes.loading) this._stepScene(scene, dt);
    this.scenes._flush();
  }
  _stepScene(scene, dt) {
    this._stepping = true;
    try {
      scene._step(dt);
    } finally {
      this._stepping = false;
    }
  }
  _render(alpha) {
    const r = this.renderer;
    r.beginFrame();
    if (this.scenes.loading) this._renderLoading(r);
    else this._renderScenes(r, alpha);
    this.overlay?.(r, alpha);
    this.debug.render(r);
    r.endFrame();
  }
  _renderScenes(r, alpha) {
    const stack = this.scenes.stack;
    for (let i = this.scenes._firstDrawnIndex(); i < stack.length; i++) stack[i]._draw(r, alpha);
  }
  _renderLoading(r) {
    const barWidth = Math.round(this.width / 2);
    const x = Math.round((this.width - barWidth) / 2);
    const y = Math.round(this.height / 2);
    r.strokeRect(x, y - 4, barWidth, 8, LOADING_BAR_COLOR, 1);
    r.rect(x + 2, y - 2, (barWidth - 4) * this.assets.progress, 4, LOADING_BAR_COLOR);
  }
};

// src/util/array.js
var removeWhere = (list, shouldRemove) => {
  let kept = 0;
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (!shouldRemove(item)) list[kept++] = item;
  }
  list.length = kept;
  return list;
};

// src/gameplay/Timer.js
var FLOAT_TOLERANCE2 = 1e-9;
var Timer = class {
  constructor() {
    this._items = [];
  }
  /**
   * @param {number} seconds
   * @param {() => void} fn
   * @returns {TimerHandle}
   */
  after(seconds, fn) {
    return this._schedule(seconds, fn, false);
  }
  /**
   * Repeat every `seconds`. After a long step it fires once per missed interval.
   * @param {number} seconds
   * @param {() => void} fn
   * @returns {TimerHandle}
   * @throws {Error} If `seconds` isn't positive.
   */
  every(seconds, fn) {
    if (!(seconds > 0)) throw new Error("Timer.every needs a positive interval");
    return this._schedule(seconds, fn, true);
  }
  /**
   * Advance all timers. Timers created by callbacks start counting on the next call.
   * @param {number} dt Seconds.
   */
  update(dt) {
    const items = this._items;
    const countBeforeCallbacks = items.length;
    for (let i = 0; i < countBeforeCallbacks; i++) this._advance(items[i], dt);
    removeWhere(items, (item) => item.done);
  }
  /** Cancel every pending timer. */
  clear() {
    for (const item of this._items) item.done = true;
    this._items.length = 0;
  }
  /** Number of pending timers. @type {number} */
  get size() {
    return this._items.filter((item) => !item.done).length;
  }
  _schedule(seconds, fn, repeat) {
    const item = {
      interval: seconds,
      timeLeft: seconds,
      fn,
      repeat,
      done: false,
      cancel() {
        item.done = true;
      }
    };
    this._items.push(item);
    return item;
  }
  _advance(item, dt) {
    if (item.done) return;
    item.timeLeft -= dt;
    while (!item.done && item.timeLeft <= FLOAT_TOLERANCE2) {
      if (item.repeat) item.timeLeft += item.interval;
      else item.done = true;
      item.fn();
    }
  }
};

// src/gameplay/Ease.js
var BACK_OVERSHOOT = 1.70158;
var BOUNCE_STRENGTH = 7.5625;
var BOUNCE_DIVISOR = 2.75;
var bounceOut = (t) => {
  const n = BOUNCE_STRENGTH;
  const d = BOUNCE_DIVISOR;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t - 1.5 / d) ** 2 + 0.75;
  if (t < 2.5 / d) return n * (t - 2.25 / d) ** 2 + 0.9375;
  return n * (t - 2.625 / d) ** 2 + 0.984375;
};
var Ease = {
  linear: (t) => t,
  quadIn: (t) => t * t,
  quadOut: (t) => t * (2 - t),
  quadInOut: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  cubicIn: (t) => t ** 3,
  cubicOut: (t) => (t - 1) ** 3 + 1,
  cubicInOut: (t) => t < 0.5 ? 4 * t ** 3 : (t - 1) * (2 * t - 2) ** 2 + 1,
  sineInOut: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  backOut: (t) => 1 + (BACK_OVERSHOOT + 1) * (t - 1) ** 3 + BACK_OVERSHOOT * (t - 1) ** 2,
  elasticOut: (t) => t === 0 || t === 1 ? t : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * 2 * Math.PI / 3) + 1,
  bounceOut
};

// src/gameplay/Tween.js
var resolveEase = (ease) => {
  const fn = typeof ease === "function" ? ease : Ease[ease];
  if (!fn) throw new Error(`Unknown ease "${ease}"`);
  return fn;
};
var Tween = class {
  /**
   * @param {object} target
   * @param {Record<string, number>} props End values.
   * @param {number} duration Seconds.
   * @param {EaseInput} [ease='linear']
   * @param {TweenOptions} [options]
   * @throws {Error} If `ease` names an unknown easing.
   */
  constructor(target, props, duration, ease = "linear", { delay = 0, onUpdate, onComplete } = {}) {
    this.target = target;
    this.props = props;
    this.duration = duration;
    this.ease = resolveEase(ease);
    this.delay = delay;
    this.onUpdate = onUpdate;
    this.onComplete = onComplete;
    this.elapsed = 0;
    this.done = false;
    this._startValues = null;
    this._waiting = [];
  }
  /**
   * Advance by `dt`. The owning scene calls this.
   * @param {number} dt Seconds.
   * @returns {boolean} True when finished.
   */
  update(dt) {
    if (this.done) return true;
    const activeTime = this._consumeDelay(dt);
    if (activeTime === 0 && this.delay > 0) return false;
    this._startValues ?? (this._startValues = this._captureStartValues());
    this.elapsed += activeTime;
    const progress = this.duration > 0 ? Math.min(this.elapsed / this.duration, 1) : 1;
    this._applyProgress(this.ease(progress));
    this.onUpdate?.(progress);
    if (progress >= 1) this._finish(true);
    return this.done;
  }
  /** Stop at the current values. Skips `onComplete` but releases awaiting code. */
  cancel() {
    if (!this.done) this._finish(false);
  }
  /**
   * @template T
   * @param {() => T} [onFulfilled]
   * @param {(reason: any) => T} [onRejected]
   * @returns {Promise<T>}
   */
  then(onFulfilled, onRejected) {
    const finished = new Promise((resolve2) => {
      if (this.done) resolve2();
      else this._waiting.push(resolve2);
    });
    return finished.then(onFulfilled, onRejected);
  }
  _consumeDelay(dt) {
    if (this.delay <= 0) return dt;
    this.delay -= dt;
    if (this.delay > 0) return 0;
    const leftover = -this.delay;
    this.delay = 0;
    return leftover;
  }
  _captureStartValues() {
    const start = {};
    for (const key in this.props) start[key] = this.target[key];
    return start;
  }
  _applyProgress(eased) {
    for (const key in this.props) {
      const from = this._startValues[key];
      this.target[key] = from + (this.props[key] - from) * eased;
    }
  }
  _finish(completed) {
    this.done = true;
    if (completed) this.onComplete?.();
    for (const resolve2 of this._waiting) resolve2();
    this._waiting.length = 0;
  }
};

// src/util/Rect.js
var Rect = class {
  /**
   * @param {number} [x=0]
   * @param {number} [y=0]
   * @param {number} [w=0]
   * @param {number} [h=0]
   */
  constructor(x = 0, y = 0, w = 0, h = 0) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
  }
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @returns {this}
   */
  set(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    return this;
  }
  /** @type {number} */
  get right() {
    return this.x + this.w;
  }
  /** @type {number} */
  get bottom() {
    return this.y + this.h;
  }
  /** @type {number} */
  get cx() {
    return this.x + this.w / 2;
  }
  /** @type {number} */
  get cy() {
    return this.y + this.h / 2;
  }
  /**
   * Right and bottom edges are exclusive.
   * @param {number} px
   * @param {number} py
   * @returns {boolean}
   */
  contains(px, py) {
    return px >= this.x && px < this.right && py >= this.y && py < this.bottom;
  }
  /**
   * Touching edges don't count as intersecting.
   * @param {{ x: number, y: number, w: number, h: number }} other
   * @returns {boolean}
   */
  intersects(other) {
    return this.x < other.x + other.w && this.right > other.x && this.y < other.y + other.h && this.bottom > other.y;
  }
};

// src/render/Camera.js
var randomSigned = () => Math.random() * 2 - 1;
var Camera = class {
  /**
   * @param {number} viewW Logical screen width.
   * @param {number} viewH Logical screen height.
   */
  constructor(viewW, viewH) {
    this.viewW = viewW;
    this.viewH = viewH;
    this.x = viewW / 2;
    this.y = viewH / 2;
    this.zoom = 1;
    this.roundPixels = false;
    this.bounds = null;
    this.target = null;
    this.lerp = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.shakeScale = 1;
    this._shakeTimeLeft = 0;
    this._shakeDuration = 0;
    this._shakeIntensity = 0;
    this._view = new Rect();
    this._targetPoint = { x: 0, y: 0 };
  }
  /**
   * Track a target's center every update. Pass `null` to stop.
   * @param {FollowTarget | null} target
   * @param {FollowOptions} [options]
   */
  follow(target, { lerp: lerp2 = 1, offsetX = 0, offsetY = 0 } = {}) {
    this.target = target;
    this.lerp = lerp2;
    this.offsetX = offsetX;
    this.offsetY = offsetY;
  }
  /** Jump to the follow target immediately, skipping the lerp. */
  snap() {
    if (!this.target) return;
    const point = this._followPoint();
    this.x = point.x;
    this.y = point.y;
    this._keepInBounds();
  }
  /**
   * Never show anything outside this world rectangle. A world smaller than the view is centered.
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   */
  setBounds(x, y, w, h) {
    this.bounds = new Rect(x, y, w, h);
    this._keepInBounds();
  }
  clearBounds() {
    this.bounds = null;
  }
  /**
   * Random offset that fades out over `duration`. An overlapping shake keeps the stronger intensity.
   * @param {number} [intensity=4] Maximum offset in pixels, before {@link Camera#shakeScale}.
   * @param {number} [duration=0.3] Seconds.
   */
  shake(intensity = 4, duration = 0.3) {
    const scaled = intensity * this.shakeScale;
    const alreadyShaking = this._shakeTimeLeft > 0;
    this._shakeIntensity = alreadyShaking ? Math.max(scaled, this._shakeIntensity) : scaled;
    this._shakeDuration = duration;
    this._shakeTimeLeft = Math.max(this._shakeTimeLeft, duration);
  }
  /**
   * Follow, clamp to bounds and advance shake. Called by the owning scene each step.
   * @param {number} dt Seconds.
   */
  update(dt) {
    if (this.target) {
      const point = this._followPoint();
      this.x += (point.x - this.x) * this.lerp;
      this.y += (point.y - this.y) * this.lerp;
    }
    this._keepInBounds();
    this._updateShake(dt);
  }
  /**
   * Apply the camera transform to a renderer. The scene does this before drawing entities.
   * @param {import('./Renderer.js').Renderer} r
   */
  apply(r) {
    let offsetX = -(this.x + this.shakeX);
    let offsetY = -(this.y + this.shakeY);
    if (this.roundPixels) {
      offsetX = Math.round(offsetX * this.zoom) / this.zoom;
      offsetY = Math.round(offsetY * this.zoom) / this.zoom;
    }
    r.translate(this.viewW / 2, this.viewH / 2);
    if (this.zoom !== 1) r.scale(this.zoom, this.zoom);
    r.translate(offsetX, offsetY);
  }
  /**
   * Visible world rectangle, for culling. Returns the same object on every
   * read, so copy values you need to keep. Ignores shake.
   * @type {Rect}
   */
  get view() {
    const w = this.viewW / this.zoom;
    const h = this.viewH / this.zoom;
    return this._view.set(this.x - w / 2, this.y - h / 2, w, h);
  }
  /**
   * @param {number} screenX Logical pixels.
   * @param {number} screenY
   * @param {{ x: number, y: number }} [out] Object to write into instead of allocating.
   * @returns {{ x: number, y: number }}
   */
  screenToWorld(screenX, screenY, out = { x: 0, y: 0 }) {
    out.x = (screenX - this.viewW / 2) / this.zoom + this.x;
    out.y = (screenY - this.viewH / 2) / this.zoom + this.y;
    return out;
  }
  /**
   * @param {number} worldX
   * @param {number} worldY
   * @param {{ x: number, y: number }} [out] Object to write into instead of allocating.
   * @returns {{ x: number, y: number }}
   */
  worldToScreen(worldX, worldY, out = { x: 0, y: 0 }) {
    out.x = (worldX - this.x) * this.zoom + this.viewW / 2;
    out.y = (worldY - this.y) * this.zoom + this.viewH / 2;
    return out;
  }
  _followPoint() {
    const target = this.target;
    const point = this._targetPoint;
    point.x = target.pos.x + (target.w ?? 0) / 2 + this.offsetX;
    point.y = target.pos.y + (target.h ?? 0) / 2 + this.offsetY;
    return point;
  }
  _keepInBounds() {
    const bounds = this.bounds;
    if (!bounds) return;
    const halfW = this.viewW / 2 / this.zoom;
    const halfH = this.viewH / 2 / this.zoom;
    this.x = clampAxis(this.x, bounds.x, bounds.w, halfW);
    this.y = clampAxis(this.y, bounds.y, bounds.h, halfH);
  }
  _updateShake(dt) {
    if (this._shakeTimeLeft <= 0) return;
    this._shakeTimeLeft -= dt;
    if (this._shakeTimeLeft <= 0) {
      this.shakeX = 0;
      this.shakeY = 0;
      return;
    }
    const strength = this._shakeIntensity * (this._shakeTimeLeft / this._shakeDuration);
    this.shakeX = randomSigned() * strength;
    this.shakeY = randomSigned() * strength;
  }
};
var clampAxis = (center, start, size, halfView) => {
  if (size < halfView * 2) return start + size / 2;
  return Math.min(Math.max(center, start + halfView), start + size - halfView);
};

// src/core/Scene.js
var byZ = (a, b) => a.z - b.z;
var Scene = class {
  /** @param {Game} [game] Omit only in tests. */
  constructor(game) {
    this.game = game;
    this.ctx = game ? game.ctx : null;
    this.key = "";
    this.entities = [];
    this.camera = new Camera(game ? game.width : 0, game ? game.height : 0);
    this.timeScale = 1;
    this.opaque = false;
    this.timer = new Timer();
    this._tweens = [];
    this._pendingAdds = [];
    this._pendingRemoves = [];
    this._updating = false;
    this._sortDirty = false;
  }
  /**
   * Load assets before {@link Scene#enter}. Returning a promise shows the loading screen until it settles.
   * @param {Assets} _assets
   * @param {any} [_data] The same data `enter` will receive.
   * @returns {void | Promise<void>}
   */
  preload(_assets, _data) {
  }
  /**
   * Called once when the scene starts, with the data passed to `switch` or `push`.
   * @param {any} [_data]
   */
  enter(_data) {
  }
  /**
   * Called every fixed step after all entities have updated.
   * @param {number} _dt Seconds.
   * @param {GameContext} _ctx
   */
  update(_dt, _ctx) {
  }
  /**
   * Called every frame after entities draw. Draws in screen space (unaffected by the camera).
   * @param {Renderer} _r
   * @param {number} _alpha
   */
  render(_r, _alpha) {
  }
  /** Called when the scene is removed from the stack. */
  exit() {
  }
  /**
   * Called when a scene pushed on top of this one is popped.
   * @param {any} [_data] Data passed to `pop`.
   */
  resume(_data) {
  }
  /**
   * Add an entity. During an update step it joins at the end of the step.
   * @template {Entity} T
   * @param {T} entity
   * @returns {T} The same entity.
   */
  add(entity) {
    entity.dead = false;
    entity.scene = this;
    if (this._updating) this._pendingAdds.push(entity);
    else this._insert(entity);
    return entity;
  }
  /**
   * Remove an entity. Prefer {@link Entity#destroy}, which also marks it dead immediately.
   * @param {Entity} entity
   */
  remove(entity) {
    if (this._updating) this._pendingRemoves.push(entity);
    else this._extract(entity);
  }
  /** Destroy every entity. */
  clear() {
    for (const entity of this.entities.slice()) {
      entity.dead = true;
      this.remove(entity);
    }
  }
  /**
   * Live entities with a tag.
   * @param {string} tag
   * @param {Entity[]} [out] Array to refill instead of allocating a new one.
   * @returns {Entity[]}
   */
  find(tag, out = []) {
    out.length = 0;
    for (const entity of this.entities) if (isAliveWithTag(entity, tag)) out.push(entity);
    return out;
  }
  /**
   * @param {string} tag
   * @returns {Entity | undefined} The first live entity with the tag.
   */
  first(tag) {
    return this.entities.find((entity) => isAliveWithTag(entity, tag));
  }
  /**
   * Number of live entities with a tag. Excludes entities destroyed this step.
   * @param {string} tag
   * @returns {number}
   */
  count(tag) {
    let total = 0;
    for (const entity of this.entities) if (isAliveWithTag(entity, tag)) total++;
    return total;
  }
  /**
   * Animate numeric properties of `target` toward `props`. The tween belongs
   * to this scene and can be awaited.
   * @param {object} target
   * @param {Record<string, number>} props End values.
   * @param {number} duration Seconds.
   * @param {EaseInput} [ease='linear']
   * @param {TweenOptions} [opts]
   * @returns {Tween}
   * @example
   * await this.tween(logo.pos, { y: 40 }, 0.5, 'backOut', { delay: 0.2 });
   */
  tween(target, props, duration, ease = "linear", opts) {
    const tween = new Tween(target, props, duration, ease, opts);
    this._tweens.push(tween);
    return tween;
  }
  _step(realDt) {
    const dt = realDt * this.timeScale;
    this._updating = true;
    this._updateEntities(dt);
    this.timer.update(dt);
    removeWhere(this._tweens, (tween) => tween.update(dt));
    this.update(dt, this.ctx);
    this.camera.update(dt);
    this._updating = false;
    this._applyPendingChanges();
  }
  _updateEntities(dt) {
    const list = this.entities;
    for (let i = 0; i < list.length; i++) {
      const entity = list[i];
      if (entity.active && !entity.dead) entity.update(dt, this.ctx);
    }
  }
  _draw(r, alpha) {
    if (this._sortDirty) {
      this.entities.sort(byZ);
      this._sortDirty = false;
    }
    r.push();
    this.camera.apply(r);
    for (const entity of this.entities) if (entity.visible && !entity.dead) entity.render(r, alpha);
    r.pop();
    this.render(r, alpha);
  }
  _applyPendingChanges() {
    if (this._pendingRemoves.length > 0) {
      for (const entity of this._pendingRemoves) this._extract(entity);
      this._pendingRemoves.length = 0;
    }
    if (this._pendingAdds.length > 0) {
      for (const entity of this._pendingAdds.splice(0)) this._insert(entity);
    }
  }
  _insert(entity) {
    if (entity._live) return;
    if (entity.dead) {
      if (entity.scene === this) entity.scene = null;
      return;
    }
    entity._live = true;
    entity.scene = this;
    this.entities.push(entity);
    this._sortDirty = true;
    entity.onAdd?.(this);
  }
  _extract(entity) {
    if (!entity._live || entity.scene !== this) return;
    const index = this.entities.indexOf(entity);
    if (index >= 0) this.entities.splice(index, 1);
    entity._live = false;
    entity.scene = null;
    entity.onRemove?.(this);
  }
};
var isAliveWithTag = (entity, tag) => !entity.dead && entity.tags.has(tag);

// src/gameplay/Collision.js
var asBox = (shape) => shape.bounds !== void 0 ? shape.bounds : shape;
var scratchCircleA = { x: 0, y: 0, r: 0 };
var scratchCircleB = { x: 0, y: 0, r: 0 };
var asCircle = (shape, out) => {
  if (!shape.pos) return shape;
  out.x = shape.pos.x + shape.w / 2;
  out.y = shape.pos.y + shape.h / 2;
  out.r = shape.radius;
  return out;
};
var clamp = (value, min, max) => value < min ? min : value > max ? max : value;
var aabb = (a, b) => {
  const A = asBox(a);
  const B = asBox(b);
  return A.x < B.x + B.w && A.x + A.w > B.x && A.y < B.y + B.h && A.y + A.h > B.y;
};
var circle = (a, b) => {
  const A = asCircle(a, scratchCircleA);
  const B = asCircle(b, scratchCircleB);
  const dx = A.x - B.x;
  const dy = A.y - B.y;
  const reach = A.r + B.r;
  return dx * dx + dy * dy < reach * reach;
};
var circleRect = (c, rect) => {
  const C = asCircle(c, scratchCircleA);
  const R = asBox(rect);
  const dx = C.x - clamp(C.x, R.x, R.x + R.w);
  const dy = C.y - clamp(C.y, R.y, R.y + R.h);
  return dx * dx + dy * dy < C.r * C.r;
};
var overlaps = (a, b) => {
  const aIsCircle = a.shape === "circle";
  const bIsCircle = b.shape === "circle";
  if (aIsCircle && bIsCircle) return circle(a, b);
  if (aIsCircle) return circleRect(a, b);
  if (bIsCircle) return circleRect(b, a);
  return aabb(a, b);
};
var pointInRect = (px, py, rect) => {
  const R = asBox(rect);
  return px >= R.x && px < R.x + R.w && py >= R.y && py < R.y + R.h;
};
var resolve = (mover, obstacle, axis) => {
  const A = mover.bounds;
  const B = asBox(obstacle);
  const overlapX = Math.min(A.x + A.w - B.x, B.x + B.w - A.x);
  const overlapY = Math.min(A.y + A.h - B.y, B.y + B.h - A.y);
  if (overlapX <= 0 || overlapY <= 0) return null;
  const pushOnX = axis ? axis === "x" : overlapX < overlapY;
  if (pushOnX) {
    const comingFromLeft = A.x + A.w / 2 < B.x + B.w / 2;
    mover.pos.x += comingFromLeft ? -overlapX : overlapX;
    return comingFromLeft ? "left" : "right";
  }
  const comingFromAbove = A.y + A.h / 2 < B.y + B.h / 2;
  mover.pos.y += comingFromAbove ? -overlapY : overlapY;
  return comingFromAbove ? "top" : "bottom";
};
var canCollide = (entity, tag) => !entity.dead && entity.active && entity.tags.has(tag);
var check = (scene, tagA, tagB, onHit) => {
  const list = (
    /** @type {CollidingEntity[]} */
    scene.entities
  );
  const sameTag = tagA === tagB;
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (!canCollide(a, tagA)) continue;
    for (let j = sameTag ? i + 1 : 0; j < list.length; j++) {
      const b = list[j];
      if (b === a || !canCollide(b, tagB) || !overlaps(a, b)) continue;
      if (onHit) {
        onHit(a, b);
      } else {
        a.onCollide?.(b);
        b.onCollide?.(a);
      }
      if (a.dead) break;
    }
  }
};
var Collision = { aabb, circle, circleRect, overlaps, pointInRect, resolve, check };

// src/util/Vec2.js
var Vec2 = class _Vec2 {
  /**
   * @param {number} [x=0]
   * @param {number} [y=0]
   */
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
  /**
   * @param {number} radians
   * @param {number} [length=1]
   * @returns {Vec2}
   */
  static fromAngle(radians, length = 1) {
    return new _Vec2(Math.cos(radians) * length, Math.sin(radians) * length);
  }
  /**
   * @param {number} x
   * @param {number} y
   * @returns {this}
   */
  set(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }
  /**
   * @param {Point} other
   * @returns {this}
   */
  copy(other) {
    return this.set(other.x, other.y);
  }
  /** @returns {Vec2} A new vector with the same components. */
  clone() {
    return new _Vec2(this.x, this.y);
  }
  /**
   * @param {Point} other
   * @returns {this}
   */
  add(other) {
    return this.set(this.x + other.x, this.y + other.y);
  }
  /**
   * @param {Point} other
   * @returns {this}
   */
  sub(other) {
    return this.set(this.x - other.x, this.y - other.y);
  }
  /**
   * Add `other * scale`, e.g. `pos.addScaled(vel, dt)`.
   * @param {Point} other
   * @param {number} scale
   * @returns {this}
   */
  addScaled(other, scale) {
    return this.set(this.x + other.x * scale, this.y + other.y * scale);
  }
  /**
   * @param {number} factor
   * @returns {this}
   */
  scale(factor) {
    return this.set(this.x * factor, this.y * factor);
  }
  /** @returns {number} */
  len() {
    return Math.hypot(this.x, this.y);
  }
  /** @returns {number} Squared length; cheaper than `len()` for comparisons. */
  lenSq() {
    return this.x * this.x + this.y * this.y;
  }
  /** Scale to length 1. A zero vector stays zero. @returns {this} */
  normalize() {
    const length = this.len();
    return length > 0 ? this.scale(1 / length) : this;
  }
  /**
   * Shorten to `max` if longer; direction is kept.
   * @param {number} max
   * @returns {this}
   */
  limit(max) {
    const length = this.len();
    return length > max ? this.scale(max / length) : this;
  }
  /**
   * @param {number} radians Clockwise on screen, since +y points down.
   * @returns {this}
   */
  rotate(radians) {
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return this.set(this.x * cos - this.y * sin, this.x * sin + this.y * cos);
  }
  /**
   * @param {Point} other
   * @returns {number}
   */
  dot(other) {
    return this.x * other.x + this.y * other.y;
  }
  /**
   * @param {Point} other
   * @returns {number}
   */
  dist(other) {
    return Math.hypot(other.x - this.x, other.y - this.y);
  }
  /** @returns {number} Radians from the +x axis. */
  angle() {
    return Math.atan2(this.y, this.x);
  }
};

// src/gameplay/Entity.js
var Entity = class {
  /** @param {EntityOptions} [options] */
  constructor({ x = 0, y = 0, w = 0, h = 0, z = 0, tags = [], shape = "rect", radius } = {}) {
    this.pos = new Vec2(x, y);
    this.vel = new Vec2();
    this.w = w;
    this.h = h;
    this.rotation = 0;
    this.shape = shape;
    this.radius = radius ?? Math.min(w, h) / 2;
    this.visible = true;
    this.active = true;
    this.debug = true;
    this.tags = new Set(tags);
    this.dead = false;
    this.scene = null;
    this._z = z;
    this._live = false;
    this._bounds = new Rect();
  }
  /** Draw order; higher draws on top. Equal values draw in insertion order. */
  get z() {
    return this._z;
  }
  set z(value) {
    if (value === this._z) return;
    this._z = value;
    if (this.scene) this.scene._sortDirty = true;
  }
  /**
   * @param {string} tag
   * @returns {boolean}
   */
  has(tag) {
    return this.tags.has(tag);
  }
  /**
   * @param {string} tag
   * @returns {this}
   */
  tag(tag) {
    this.tags.add(tag);
    return this;
  }
  /**
   * @param {string} tag
   * @returns {this}
   */
  untag(tag) {
    this.tags.delete(tag);
    return this;
  }
  /** Hitbox in world space. Returns the same object on every read. @type {Rect} */
  get bounds() {
    return this._bounds.set(this.pos.x, this.pos.y, this.w, this.h);
  }
  /** Hitbox center x. @type {number} */
  get cx() {
    return this.pos.x + this.w / 2;
  }
  /** Hitbox center y. @type {number} */
  get cy() {
    return this.pos.y + this.h / 2;
  }
  /**
   * Called every fixed step while active.
   * @param {number} dt Seconds.
   * @param {import('../core/Game.js').GameContext} [_ctx]
   */
  update(dt, _ctx) {
    this.pos.addScaled(this.vel, dt);
  }
  /**
   * Called every frame while visible, in world space.
   * @param {import('../render/Renderer.js').Renderer} _r
   * @param {number} [_alpha]
   */
  render(_r, _alpha) {
  }
  /**
   * Draw this entity's debug info. Called by the debug overlay every frame
   * while enabled, in world space. The default strokes the hitbox in its
   * shape; override to add more and call `super.drawDebug` to keep the box.
   * @param {import('../render/Renderer.js').Renderer} r
   * @param {string} color
   * @param {number} lineWidth Already divided by the camera zoom.
   */
  drawDebug(r, color, lineWidth) {
    if (this.shape === "circle") r.strokeCircle(this.cx, this.cy, this.radius, color, lineWidth);
    else r.strokeRect(this.pos.x, this.pos.y, this.w, this.h, color, lineWidth);
  }
  /** Mark dead now; leave the scene at the end of the current step. Safe to call twice. */
  destroy() {
    if (this.dead) return;
    this.dead = true;
    this.scene?.remove(this);
  }
};

// src/render/Animation.js
var DEFAULT_FPS = 10;
var Animation = class {
  /**
   * @param {import('./SpriteSheet.js').SpriteSheet} sheet
   * @param {Record<string, AnimationDef>} defs
   */
  constructor(sheet, defs) {
    this.sheet = sheet;
    this.defs = defs;
    this.name = "";
    this.index = 0;
    this.time = 0;
    this.done = false;
    this.onComplete = null;
    const firstName = Object.keys(defs)[0];
    if (firstName) this.play(firstName);
  }
  /**
   * Switch animations. Safe to call every update: does nothing if `name` is already playing.
   * @param {string} name
   * @param {boolean} [restart=false] Start over even if `name` is already playing.
   * @returns {this}
   * @throws {Error} If `name` isn't defined.
   */
  play(name, restart = false) {
    if (!this.defs[name]) throw new Error(`Unknown animation "${name}"`);
    if (name === this.name && !restart) return this;
    this.name = name;
    this.index = 0;
    this.time = 0;
    this.done = false;
    return this;
  }
  /** @param {number} dt Seconds. */
  update(dt) {
    const def = this.defs[this.name];
    if (!def || this.done) return;
    const frameDuration = 1 / (def.fps ?? DEFAULT_FPS);
    this.time += dt;
    while (this.time >= frameDuration && !this.done) {
      this.time -= frameDuration;
      this._advance(def);
    }
  }
  /** Sheet frame index currently showing. @type {number} */
  get frame() {
    return this.defs[this.name].frames[this.index];
  }
  /** Sprite currently showing. @type {import('./Sprite.js').Sprite} */
  get current() {
    return this.sheet.frame(this.frame);
  }
  _advance(def) {
    const isLastFrame = this.index === def.frames.length - 1;
    if (!isLastFrame) {
      this.index++;
    } else if (def.loop ?? true) {
      this.index = 0;
    } else {
      this.done = true;
      this.time = 0;
      this.onComplete?.(this.name);
    }
  }
};

// src/render/Sprite.js
var Sprite = class {
  /**
   * @param {import('./Renderer.js').ImageLike} image
   * @param {SpriteOptions} [options]
   */
  constructor(image, { sx = 0, sy = 0, sw = image.width, sh = image.height, originX = 0, originY = 0 } = {}) {
    this.image = image;
    this.sx = sx;
    this.sy = sy;
    this.sw = sw;
    this.sh = sh;
    this.originX = originX;
    this.originY = originY;
  }
};

// src/render/SpriteSheet.js
var SpriteSheet = class {
  /**
   * @param {import('./Renderer.js').ImageLike} image
   * @param {SpriteSheetOptions} options
   */
  constructor(image, { frameW, frameH, margin = 0, spacing = 0, originX = 0, originY = 0 }) {
    this.image = image;
    this.frameW = frameW;
    this.frameH = frameH;
    this.frames = [];
    const lastY = image.height - margin - frameH;
    const lastX = image.width - margin - frameW;
    for (let y = margin; y <= lastY; y += frameH + spacing) {
      for (let x = margin; x <= lastX; x += frameW + spacing) {
        this.frames.push(new Sprite(image, { sx: x, sy: y, sw: frameW, sh: frameH, originX, originY }));
      }
    }
  }
  /**
   * @param {number} index
   * @returns {Sprite}
   * @throws {Error} If the frame doesn't exist.
   */
  frame(index) {
    const sprite = this.frames[index];
    if (!sprite) throw new Error(`SpriteSheet has no frame ${index} (has ${this.frames.length})`);
    return sprite;
  }
};

// src/util/math.js
var clamp2 = (value, min, max) => value < min ? min : value > max ? max : value;
var lerp = (from, to, t) => from + (to - from) * t;
var rand = (min = 0, max = 1) => min + Math.random() * (max - min);
var randInt = (min, max) => Math.floor(min + Math.random() * (max - min + 1));
var pick = (list) => list[Math.floor(Math.random() * list.length)];
var angle = (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1);
var dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
var approach = (value, target, step) => value < target ? Math.min(value + step, target) : Math.max(value - step, target);

// src/util/Pool.js
var Pool = class {
  /**
   * @param {() => T} factory Creates an object when the pool is empty.
   * @param {number} [size=0] Objects to create up front.
   * @param {(obj: T) => void} [reset] Called on each object as it is released.
   */
  constructor(factory, size = 0, reset) {
    this.factory = factory;
    this.reset = reset;
    this._free = Array.from({ length: size }, () => factory());
  }
  /** @returns {T} A recycled object, or a new one if none are free. */
  get() {
    return this._free.length > 0 ? this._free.pop() : this.factory();
  }
  /** @param {T} obj */
  release(obj) {
    this.reset?.(obj);
    this._free.push(obj);
  }
  /** Objects waiting to be reused. @type {number} */
  get available() {
    return this._free.length;
  }
};
export {
  Animation,
  Assets,
  Audio,
  Camera,
  CanvasRenderer,
  Collision,
  Debug,
  Ease,
  Entity,
  Events,
  Game,
  Input,
  Loop,
  Pool,
  Rect,
  Renderer,
  Scene,
  SceneManager,
  Sprite,
  SpriteSheet,
  Timer,
  Tween,
  Vec2,
  angle,
  approach,
  clamp2 as clamp,
  dist,
  lerp,
  pick,
  rand,
  randInt
};
