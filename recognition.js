globalThis.VanKadra = (() => {
  const api = globalThis.faceapi;

  async function loadModel(base, model, name) {
    const url = file => new URL(file, base + '/');
    const get = async file => {
      const response = await fetch(url(file));
      if (!response.ok) throw new Error('Greška pri učitavanju modela: ' + file);
      return response;
    };
    const manifest = await (await get(name + '-weights_manifest.json')).json();
    const weights = await Promise.all(manifest.map(async ({ paths, weights: specs }) => {
      const shards = await Promise.all(paths.map(async file => new Uint8Array(await (await get(file)).arrayBuffer())));
      const joined = new Uint8Array(shards.reduce((length, shard) => length + shard.length, 0));
      let offset = 0;
      for (const shard of shards) {
        joined.set(shard, offset);
        offset += shard.length;
      }
      return api.tf.io.decodeWeights(joined.buffer, specs);
    }));
    model.loadFromWeightMap(Object.assign({}, ...weights));
  }

  async function loadModels(base) {
    await Promise.all([
      loadModel(base, api.nets.tinyFaceDetector, 'tiny_face_detector_model'),
      loadModel(base, api.nets.faceLandmark68TinyNet, 'face_landmark_68_tiny_model'),
      loadModel(base, api.nets.faceRecognitionNet, 'face_recognition_model')
    ]);
  }

  async function detect(input, size) {
    return api.detectAllFaces(input, new api.TinyFaceDetectorOptions({
      inputSize: size, scoreThreshold: 0.38
    })).withFaceLandmarks(true).withFaceDescriptors();
  }

  function matches(descriptor, references) {
    const distances = references.map(reference => api.euclideanDistance(descriptor, reference))
      .sort((left, right) => left - right);
    return distances[0] <= 0.46 || (distances[0] <= 0.50 && distances[1] <= 0.55);
  }

  return { loadModels, detect, matches };
})();
