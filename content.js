(() => {
  const records = new Map();
  const visible = new Set();
  const mediaSelector = '#movie_player video.html5-main-video';
  const sample = document.createElement('canvas');
  const ctx = sample.getContext('2d', { willReadFrequently: true });
  const trackingCanvas = document.createElement('canvas');
  const trackingContext = trackingCanvas.getContext('2d', { willReadFrequently: true });
  const masks = document.createElement('div');
  masks.setAttribute('aria-hidden', 'true');
  masks.style.cssText = 'all:initial!important;position:fixed!important;inset:0!important;z-index:2147483647!important;pointer-events:none!important;display:block!important';
  const shadow = masks.attachShadow({ mode: 'closed' });
  const style = new CSSStyleSheet();
  style.replaceSync('.mask{position:absolute;box-sizing:border-box;pointer-events:none;background:rgba(22,28,35,.10);border-radius:50%;clip-path:ellipse(50% 50% at center);contain:paint}');
  const fallback = document.createElement('div');
  fallback.hidden = true;
  fallback.style.cssText = 'position:absolute;pointer-events:none;background:rgba(9,12,16,.84);backdrop-filter:blur(52px)';
  shadow.append(fallback);
  shadow.adoptedStyleSheets = [style];
  let options = { ...maskDefaults };
  let modelPromise;
  let generation = 0;
  let lastFrame = 0;
  let scheduledStart = true;
  let frameRequest = 0;
  let busy = false;
  let confirmedVideo = null;
  let tabStatus = 'Čekam potvrdu kanala';

  function currentVideo() {
    return location.pathname === '/watch' ? new URL(location.href).searchParams.get('v') : null;
  }

  function supported() {
    return confirmedVideo !== null && confirmedVideo === currentVideo();
  }

  document.addEventListener('nepomenik:channel', ({ detail }) => {
    if (detail?.id !== currentVideo()) return;
    const video = detail.supported === true ? detail.id : null;
    if (!video) tabStatus = 'Samo @ParlamentSrbija';
    if (video === confirmedVideo) return;
    confirmedVideo = video;
    if (video) tabStatus = 'Čekam video kadar';
    apply(options);
  });

  function checkChannel() {
    if (!currentVideo()) tabStatus = 'Otvori snimak @ParlamentSrbija';
    document.dispatchEvent(new Event('nepomenik:check-channel'));
  }

  document.addEventListener('yt-navigate-start', () => {
    confirmedVideo = null;
    tabStatus = 'Čekam potvrdu kanala';
    apply(options);
  });
  document.addEventListener('yt-navigate-finish', checkChannel);
  setInterval(checkChannel, 1000);
  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.type === 'nepomenik:status') respond({ text: tabStatus });
  });

  function references() {
    if (!modelPromise) {
      const url = name => chrome.runtime.getURL(name);
      modelPromise = Promise.all([
        VanKadra.loadModels(url('vendor/models')),
        fetch(url('reference.json')).then(response => {
          if (!response.ok) throw new Error('Referentni podaci nisu dostupni.');
          return response.json();
        })
      ]).then(([, vectors]) => vectors).catch(error => {
        modelPromise = undefined;
        throw error;
      });
    }
    return modelPromise;
  }

  function isVideo(media) {
    return media.tagName === 'VIDEO';
  }

  function clear(record) {
    record.boxes = [];
    record.tracks = [];
    record.nodes.forEach(node => node.remove());
    record.nodes = [];
  }

  function start() {
    if (!frameRequest && !scheduledStart && options.enabled && supported() && visible.size && !document.hidden) {
      frameRequest = requestAnimationFrame(tick);
    }
  }

  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) visible.add(entry.target);
      else {
        visible.delete(entry.target);
        const record = records.get(entry.target);
        if (record) {
          record.nodes.forEach(node => { node.hidden = true; });
          if (isVideo(entry.target)) {
            clear(record);
            record.key = '';
          }
        }
      }
    }
    start();
  });

  function add(media) {
    if (records.has(media)) return;
    const record = { boxes: [], tracks: [], nodes: [], key: '', frame: -1, attempt: 0, blocked: false,
      lastTracked: -1, maskTime: -1, lastFaceTime: -Infinity, misses: 0, revision: 0 };
    records.set(media, record);
    observer.observe(media);
  }

  function visit(node, callback) {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.matches(mediaSelector)) callback(node);
    node.querySelectorAll(mediaSelector).forEach(callback);
  }

  const dom = new MutationObserver(mutations => {
    for (const { addedNodes, removedNodes } of mutations) {
      addedNodes.forEach(node => visit(node, add));
      removedNodes.forEach(node => visit(node, media => {
        if (media.isConnected) return;
        observer.unobserve(media);
        visible.delete(media);
        const record = records.get(media);
        if (record) clear(record);
        records.delete(media);
      }));
    }
  });

  function dimensions(media) {
    return isVideo(media) ? [media.videoWidth, media.videoHeight] : [media.naturalWidth, media.naturalHeight];
  }

  function positionOffset(position, space) {
    const keywords = { left: 0, top: 0, center: 0.5, right: 1, bottom: 1 };
    if (position in keywords) return keywords[position] * space;
    if (position.endsWith('%')) return parseFloat(position) / 100 * space;
    if (position.endsWith('px')) return parseFloat(position);
    return space / 2;
  }

  function speakerFromNeleceni(media) {
    const host = media.closest('#movie_player')?.querySelector('#neleceni-overlay');
    if (!host || host.hidden) return null;
    const pill = host.shadowRoot?.querySelector('.pill');
    const label = pill?.querySelector('.text')?.textContent ?? '';
    const name = label.split('·')[1]?.normalize('NFD').replace(/\p{M}/gu, '')
      .toLowerCase().trim().replace(/\s+/g, ' ');
    if (!name) return null;
    if (/\b(?:aleksandar vucic|vucic aleksandar)\b/.test(name) ||
        /(?:^|\s)(?:александар вучић|вучић александар)(?:$|\s)/.test(name)) {
      return pill.classList.contains('muted') ? true : null;
    }
    return false;
  }

  function render() {
    fallback.hidden = true;
    const fullscreen = document.fullscreenElement;
    if (fullscreen?.tagName === 'VIDEO') { masks.remove(); return; }
    const host = fullscreen || document.documentElement;
    if (masks.parentNode !== host) host.append(masks);
    const origin = masks.getBoundingClientRect();
    for (const media of visible) {
      const record = records.get(media);
      if (!record?.key) continue;
      if (media.closest('.ad-showing, .ad-interrupting') || record.key !== mediaKey(media) || media.seeking) {
        record.lastFaceTime = -Infinity;
        clear(record);
        continue;
      }
      if (Math.abs(media.currentTime - record.maskTime) > 0.28) clear(record);
      const rect = media.getBoundingClientRect();
      const css = getComputedStyle(media);
      const inset = name => (parseFloat(css['padding' + name]) || 0) +
        (parseFloat(css['border' + name + 'Width']) || 0);
      const clipLeft = rect.left + inset('Left');
      const clipTop = rect.top + inset('Top');
      const width = rect.width - inset('Left') - inset('Right');
      const height = rect.height - inset('Top') - inset('Bottom');
      const [sourceWidth, sourceHeight] = dimensions(media);
      if (!width || !height || !sourceWidth || !sourceHeight ||
          css.visibility !== 'visible' || css.opacity === '0' || (fullscreen && !host.contains(media))) {
        record.nodes.forEach(node => { node.hidden = true; });
        continue;
      }

      let paintedWidth = width;
      let paintedHeight = height;
      if (css.objectFit !== 'fill') {
        const contain = Math.min(width / sourceWidth, height / sourceHeight);
        const scales = { contain, cover: Math.max(width / sourceWidth, height / sourceHeight),
          none: 1, 'scale-down': Math.min(1, contain) };
        const scale = scales[css.objectFit] ?? contain;
        paintedWidth = sourceWidth * scale;
        paintedHeight = sourceHeight * scale;
      }
      const [horizontal = '50%', vertical = '50%'] = css.objectPosition.split(/\s+/);
      const x = clipLeft + positionOffset(horizontal, width - paintedWidth);
      const y = clipTop + positionOffset(vertical, height - paintedHeight);
      if (!record.boxes.length) {
        const speaker = speakerFromNeleceni(media);
        const sinceFace = media.currentTime - record.lastFaceTime;
        if (speaker === true || (speaker === null && sinceFace >= 0 && sinceFace < 2.5)) {
          const left = Math.max(clipLeft, x);
          const top = Math.max(clipTop, y);
          const right = Math.min(clipLeft + width, x + paintedWidth);
          const bottom = Math.min(clipTop + height, y + paintedHeight);
          if (right > left && bottom > top) {
            fallback.style.left = (left - origin.left) + 'px';
            fallback.style.top = (top - origin.top) + 'px';
            fallback.style.width = (right - left) + 'px';
            fallback.style.height = (bottom - top) + 'px';
            fallback.hidden = false;
            tabStatus = 'Ceo video je prekriven';
          }
        }
      }
      record.boxes.forEach((box, index) => {
        let node = record.nodes[index];
        if (!node) {
          node = document.createElement('div');
          node.className = 'mask';
          shadow.append(node);
          record.nodes.push(node);
        }
        const left = Math.max(clipLeft, x + paintedWidth * box.x);
        const top = Math.max(clipTop, y + paintedHeight * box.y);
        const right = Math.min(clipLeft + width, x + paintedWidth * (box.x + box.w));
        const bottom = Math.min(clipTop + height, y + paintedHeight * (box.y + box.h));
        node.hidden = right <= left || bottom <= top;
        node.style.left = (left - origin.left) + 'px';
        node.style.top = (top - origin.top) + 'px';
        node.style.width = (right - left) + 'px';
        node.style.height = (bottom - top) + 'px';
        node.style.backdropFilter = 'blur(' + Math.min(80,
          Math.max(options.strength, Math.min(right - left, bottom - top) * options.strength / 135)) + 'px)';
      });
      for (const node of record.nodes.splice(record.boxes.length)) node.remove();
    }
  }

  function mediaKey(media) {
    return media.currentSrc || media.src || (isVideo(media) && media.srcObject ? 'stream' : '');
  }

  function padded(box) {
    return { x: box.x - box.w * 0.22, y: box.y - box.h * 0.27, w: box.w * 1.44, h: box.h * 1.49 };
  }

  function trackingFrame(input, width, height) {
    const scale = Math.min(1, 240 / Math.max(width, height));
    trackingCanvas.width = Math.max(1, Math.round(width * scale));
    trackingCanvas.height = Math.max(1, Math.round(height * scale));
    trackingContext.drawImage(input, 0, 0, trackingCanvas.width, trackingCanvas.height);
    return trackingContext.getImageData(0, 0, trackingCanvas.width, trackingCanvas.height);
  }

  function follow(media, record, now) {
    if (!record.tracks.length || now - record.lastTracked < 65 || media.seeking ||
        media.readyState < 2 || media.currentTime === record.maskTime ||
        media.closest('.ad-showing, .ad-interrupting')) return;
    record.lastTracked = now;
    try {
      const frame = trackingFrame(media, media.videoWidth, media.videoHeight);
      record.tracks = record.tracks.map(track => faceTracking.find(frame, track, media.currentTime)).filter(Boolean);
      if (record.tracks.length) {
        record.boxes = record.tracks.map(track => padded(track.box));
        record.maskTime = media.currentTime;
        tabStatus = 'Pratim prepoznato lice';
      } else {
        clear(record);
        tabStatus = 'Tražim lice u novom kadru';
      }
    } catch {
      clear(record);
    }
  }

  async function scan(media, record, key, token) {
    const target = await references();
    if (token !== generation || !supported() || !visible.has(media) || mediaKey(media) !== key) return;
    const video = isVideo(media);
    const [width, height] = dimensions(media);
    if (!width || !height || (video && (media.seeking || media.readyState < 2))) return;
    const currentTime = media.currentTime;
    const revision = record.revision;
    const scale = Math.min(1, 720 / Math.max(width, height));
    sample.width = Math.max(1, Math.round(width * scale));
    sample.height = Math.max(1, Math.round(height * scale));

    try {
      ctx.drawImage(media, 0, 0, sample.width, sample.height);
      ctx.getImageData(0, 0, 1, 1);
    } catch (error) {
      if (error.name !== 'SecurityError') throw error;
      record.blocked = true;
      tabStatus = 'Chrome blokira čitanje kadra';
      return;
    }

    const originalFrame = trackingFrame(sample, sample.width, sample.height);
    const inputSize = media.paused || record.misses % 3 === 2 ? 608 : 416;
    const faces = await VanKadra.detect(sample, inputSize);
    if (token !== generation || revision !== record.revision || !supported() ||
        !visible.has(media) || mediaKey(media) !== key || media.seeking ||
        media.closest('.ad-showing, .ad-interrupting')) return;
    record.frame = currentTime;
    const matches = faces.filter(face => VanKadra.matches(face.descriptor, target));
    if (!matches.length) {
      record.misses++;
      tabStatus = record.tracks.length ? 'Pratim prepoznato lice' : faces.length ?
        'Kadar se čita · lice nije prepoznato' : 'Kadar se čita · lice nije detektovano';
      return;
    }

    record.misses = 0;
    const boxes = matches.map(({ detection }) => {
      const { x, y, width, height } = detection.box;
      return { x: x / sample.width, y: y / sample.height,
        w: width / sample.width, h: height / sample.height };
    });
    const tracks = boxes.map(box => faceTracking.seed(originalFrame, box, currentTime)).filter(Boolean);
    const delay = Math.abs(media.currentTime - currentTime);
    if (delay > 1.5) return;
    if (delay > 0.11) {
      const frame = trackingFrame(media, media.videoWidth, media.videoHeight);
      const updated = tracks.map(track => faceTracking.find(frame, track, media.currentTime)).filter(Boolean);
      if (!updated.length) return;
      record.tracks = updated;
      record.boxes = updated.map(track => padded(track.box));
    } else {
      record.tracks = tracks;
      record.boxes = boxes.map(padded);
    }
    record.maskTime = media.currentTime;
    record.lastFaceTime = media.currentTime;
    tabStatus = 'Lice prepoznato';
    render();
  }

  function next(now) {
    const candidates = [];
    for (const media of visible) {
      const video = isVideo(media);
      const key = mediaKey(media);
      const record = records.get(media);
      if (!key || !record || !dimensions(media).every(value => value >= 64)) continue;
      const rect = media.getBoundingClientRect();
      if (rect.width < 64 || rect.height < 64) continue;
      if (key !== record.key) {
        clear(record);
        Object.assign(record, { key, frame: -1, attempt: 0, blocked: false, lastFaceTime: -Infinity, misses: 0 });
      }
      if (media.closest('.ad-showing, .ad-interrupting')) continue;
      if (record.blocked || (video && (media.seeking || media.readyState < 2))) continue;
      if (video ? now - record.attempt > 195 && Math.abs(media.currentTime - record.frame) >= 0.06 :
        record.frame === -1 && (!record.attempt || now - record.attempt > 3500)) {
        candidates.push({ media, record, key, priority: record.attempt + (video ? 0 : 250) });
      }
    }
    candidates.sort((a, b) => a.priority - b.priority);
    return candidates[0];
  }

  function tick(now) {
    frameRequest = 0;
    if (!options.enabled || document.hidden || !visible.size) {
      fallback.hidden = true;
      return;
    }
    if (!supported()) {
      masks.remove();
      return;
    }
    if (now - lastFrame >= 32 && visible.size) {
      lastFrame = now;
      for (const media of visible) {
        const record = records.get(media);
        if (record?.key && record.key === mediaKey(media)) follow(media, record, now);
      }
      render();
      const candidate = busy ? null : next(now);
      if (candidate) {
        busy = true;
        const { media, record, key } = candidate;
        record.attempt = now;
        const token = generation;
        scan(media, record, key, token).catch(error => {
          if (token !== generation) return;
          if (tabStatus !== 'Greška pri analizi kadra') console.warn('[nepomenik]', error);
          tabStatus = 'Greška pri analizi kadra';
          record.attempt = performance.now() + 3600;
        }).finally(() => { busy = false; });
      }
    }
    frameRequest = requestAnimationFrame(tick);
  }

  function apply(nextOptions) {
    generation++;
    options = nextOptions;
    if (frameRequest) cancelAnimationFrame(frameRequest);
    frameRequest = 0;
    for (const [media, record] of records) {
      if (!options.enabled || !supported()) {
        clear(record);
        record.key = '';
      }
    }
    if (!options.enabled || !supported()) masks.remove();
    scheduledStart = false;
    start();
  }

  document.addEventListener('visibilitychange', () => apply(options));
  function resetAfterSeek(event) {
    const record = records.get(event.target);
    if (record) {
      clear(record);
      fallback.hidden = true;
      record.frame = -1;
      record.lastFaceTime = -Infinity;
      record.attempt = 0;
      record.revision++;
    }
  }
  document.addEventListener('seeking', resetAfterSeek, true);
  document.addEventListener('seeked', resetAfterSeek, true);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const nextOptions = { ...options };
    for (const key of Object.keys(maskDefaults)) {
      if (changes[key]) nextOptions[key] = changes[key].newValue ?? maskDefaults[key];
    }
    apply(nextOptions);
  });
  document.querySelectorAll(mediaSelector).forEach(add);
  dom.observe(document, { subtree: true, childList: true });
  chrome.storage.local.get(maskDefaults).then(apply);
  checkChannel();
})();
