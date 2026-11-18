globalThis.faceTracking = (() => {
  const grid = 12;

  function pixels({ data, width, height }, box) {
    const result = new Float32Array(grid * grid);
    let mean = 0;
    for (let row = 0; row < grid; row++) {
      const y = Math.floor((box.y + box.h * (0.16 + row * 0.68 / (grid - 1))) * height);
      if (y < 0 || y >= height) return null;
      for (let col = 0; col < grid; col++) {
        const x = Math.floor((box.x + box.w * (0.16 + col * 0.68 / (grid - 1))) * width);
        if (x < 0 || x >= width) return null;
        const index = (y * width + x) * 4;
        const luma = 0.30 * data[index] + 0.59 * data[index + 1] + 0.11 * data[index + 2];
        result[row * grid + col] = luma;
        mean += luma;
      }
    }
    mean /= result.length;
    let energy = 0;
    for (let i = 0; i < result.length; i++) {
      result[i] -= mean;
      energy += result[i] ** 2;
    }
    if (energy < result.length * 64) return null;
    const norm = Math.sqrt(energy);
    for (let i = 0; i < result.length; i++) result[i] /= norm;
    return result;
  }

  function seed(frame, box, time) {
    const template = pixels(frame, box);
    return template ? { template, box, time, lastTime: time } : null;
  }

  function find(frame, track, time) {
    const elapsed = time - track.time;
    if (elapsed < -0.08 || elapsed > 4) return null;
    const { box, template } = track;
    let best = null;
    let score = 0.77;
    for (const scale of [1, 0.94, 1.06]) {
      const w = box.w * scale;
      const h = box.h * scale;
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const candidate = {
            x: box.x + (box.w - w) / 2 + dx * Math.max(1 / frame.width, box.w * 0.075),
            y: box.y + (box.h - h) / 2 + dy * Math.max(1 / frame.height, box.h * 0.075),
            w, h
          };
          const values = pixels(frame, candidate);
          if (!values) continue;
          let similarity = 0;
          for (let i = 0; i < template.length; i++) similarity += template[i] * values[i];
          if (similarity > score) {
            best = candidate;
            score = similarity;
          }
        }
      }
    }
    return best ? { ...track, box: best, lastTime: time } : null;
  }

  return { seed, find };
})();
