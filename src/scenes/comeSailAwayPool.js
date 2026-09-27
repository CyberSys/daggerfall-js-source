// @ts-check
// CSA-B (2026-09-27): COME SAIL AWAY'S BOATS, DRAWN - what Unity draws of a
// built boat (systems/comeSailAwayBoat.js), drawn through the port's renderer:
//
// - every ACTIVE object's switched-on MeshRenderer over its MeshFilter's mesh,
//   each submesh in the Daggerfall texture its slot settled on
//   (systems/comeSailAwayModels.js), the textures out of the player's own
//   ARENA2 through the host's pipeline, as every model's are;
// - the classic models the helpers stand (the bed, a model helper's), through
//   the pipeline's own cache;
// - each sail's FixDeformations holder: its LateUpdate's timer, and on a bake
//   BakeMesh and RecalculateNormals (world/skinnedBake.js) written over the
//   holder's own mesh (renderer.updateMeshVertices), drawn at the holder -
//   nothing until the first bake, as the C#'s empty baked mesh is;
// - each billboard (the crew, the lanterns, the fire) as a flat facing the
//   camera, its centre on its object (a DaggerfallBillboard's quad is centred
//   on its GameObject; the port's batches stand on their base - rmbFlats
//   centredBase), sized by its record and its object's world scale, a lantern
//   whose SetLights made its _EmissionColor black drawn with no emission;
// - each lantern's light while it is on: SetLights switches the Light and DFU's
//   two behaviours on it, and those two decide it frame by frame as DFU's own
//   code does - DaggerfallLight sets it to IsCityLightsOn on the first frame it
//   runs and at each change of that flag after (Option_AutomateCityLights,
//   DFU's default true; the prefab's Animate and InteriorLight read false), and
//   DungeonLightHandler, every 0.4 s of game time it has run, sets it to
//   "within 51.5 m of the player on the ground plane" (2060 x GlobalScale).
//   The two Updates run in that order within a frame (Unity names no order
//   between them; the port declares this one).
//
// Not drawn here, and whose: the hull's WaterMask (CSA-F's, with the waves),
// the particle systems (CSA-F), the colliders the player stands on and the
// triggers the ray answers (CSA-C / CSA-D).
//
// deps = { renderer, pipeline: scenes/dataPipeline.js's { getTexture, uploadRecord, getGpuMesh, gpuMeshes, cpuModels,
//          textureFiles }, fetchFn (the vendored files' fetch), log }

import { loadComeSailAwayModels, rendererModel, rendererModelKey, bundleSlots } from '../systems/comeSailAwayModels.js';
import { spawnBoat, boatAssetNeeds, DUNGEON_LIGHT_HANDLER } from '../systems/comeSailAwayBoat.js';
import { resolveNodePointer } from '../world/prefabNode.js';
import { bakeSkinnedMesh, recalculateNormals, fixDeformationsTick } from '../world/skinnedBake.js';
import { billboardSize } from '../world/rmbFlats.js';
import { GLOBAL_SCALE } from '../world/meshReader.js';
import { multiply } from '../world/mat4.js';
import { mat4FromQuatPosScale } from '../world/quat.js';

/** DungeonLightHandler.CheckLight's reach: UnscaledBlockRange x MeshReader.GlobalScale. */
export const LANTERN_HANDLER_REACH = DUNGEON_LIGHT_HANDLER.unscaledBlockRange * GLOBAL_SCALE;
/** How many of the boats' lit lanterns reach the host's light list - the nearest, as camps.js hands its fires
 *  (the port's renderer holds sixteen lights, forty-eight on the lane; a galleon carries eighteen lanterns). */
export const CSA_LIGHTS_MAX = 8;

/** Each active object under `root` with its world matrix, depth first - the parent's matrix carried down once. */
export function* activeObjects(root) {
  if (!root?.activeSelf) return;
  const stack = [[root, root.localMatrix()]];
  while (stack.length) {
    const [n, m] = stack.pop();
    yield [n, m];
    for (let i = n.children.length - 1; i >= 0; i--) {
      const c = n.children[i];
      if (c.activeSelf) stack.push([c, multiply(m, c.localMatrix(), new Float32Array(16))]);
    }
  }
}

/** The world box of a classic model's vertices (Mesh.bounds - DFU's MeshReader meshes bound themselves). */
export function vertexBox(positions) {
  if (!positions?.length) return null;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) for (let d = 0; d < 3; d++) { const v = positions[i + d]; if (v < min[d]) min[d] = v; if (v > max[d]) max[d] = v; }
  return { min, max };
}

/**
 * DaggerfallLight.Update and DungeonLightHandler.Update for one lantern, one frame.
 * @param {any} light - the Light record (its `node` the light's object)
 * @param {{ dt:number, cityLightsOn:boolean, playerPosition:number[] }} f
 */
export function lanternLightUpdate(light, { dt, cityLightsOn, playerPosition }) {
  const n = light.node;
  if (!n.activeInHierarchy) return;
  const dl = n.getComponent('DaggerfallLight');
  if (dl?.enabled) {
    if (dl.lastCityLightsFlag == null) dl.lastCityLightsFlag = !cityLightsOn;   // ReadyCheck: "force first update to set lights"
    if (!dl.InteriorLight && dl.lastCityLightsFlag !== cityLightsOn) { light.enabled = cityLightsOn; dl.lastCityLightsFlag = cityLightsOn; }
  }
  const h = n.getComponent('DungeonLightHandler');
  if (h?.enabled) {
    h.timer = Math.fround(h.timer + Math.fround(dt));
    if (h.timer > Math.fround(h.UpdateInSeconds)) {
      const p = n.position;
      light.enabled = !(Math.hypot(p[0] - playerPosition[0], p[2] - playerPosition[2]) > LANTERN_HANDLER_REACH);
      h.timer = 0;
    }
  }
}

export function createComeSailAwayPool({ renderer = null, pipeline = null, fetchFn = null, log = console } = {}) {
  /** @type {any} */ let models = null;
  let modelsLoading = null, modelsFailed = false;
  /** @type {any[]} */ const boats = [];
  const meshes = new Map();      // rendererModelKey -> gpu mesh | null
  const meshLoads = new Map();   // in flight
  const bakes = new Map();       // FixDeformations script -> { gpu, positions, normals, loading }
  const flats = new Map();       // billboard object -> batch
  const warned = new Set();
  const warnOnce = (k, ...a) => { if (warned.has(k)) return; warned.add(k); log?.warn?.(...a); };

  async function ensureModels() {
    if (models || modelsFailed) return models;
    modelsLoading ??= loadComeSailAwayModels(fetchFn ?? globalThis.fetch, undefined, log).then((m) => { models = m; modelsFailed = !m; return m; });
    return modelsLoading;
  }

  const billboardSizeOf = (archive, record) => {
    const t = pipeline?.textureFiles?.get(archive);
    if (!t || t.vendor || !(t.recordCount > record)) return null;
    const s = billboardSize(t, record);
    return [s.w, s.h];
  };
  const modelBoundsOf = (id) => vertexBox(pipeline?.cpuModels?.get(id)?.positions);

  /** The ARENA2 a hull reads before it is built: its flats' archives and records, its classic models. */
  async function prepare(hull) {
    const need = boatAssetNeeds({ models }, hull);
    for (const [a, r] of need.flats) {
      try { const t = await pipeline.getTexture(a); if (t?.recordCount > r) pipeline.uploadRecord(a, r); }
      catch (e) { warnOnce(`flat:${a}`, `[come-sail-away] TEXTURE.${a} will not load - the boats' flats of it stand invisible`, e); }
    }
    for (const id of need.models) {
      try { await pipeline.getGpuMesh(id); } catch (e) { warnOnce(`model:${id}`, `[come-sail-away] model ${id} will not load`, e); }
    }
  }

  /**
   * SpawnBoat, with what it reads loaded first. `player` is the PlayerObject's pose at the moment (Unity space).
   * @returns {Promise<any>} the boat, or null when the mod's models are not there
   */
  async function spawn(boat, player) {
    if (!(await ensureModels())) return null;
    await prepare(boat.hull);
    spawnBoat(boat, { models, player: () => player, billboardSize: billboardSizeOf, modelBounds: modelBoundsOf });
    boats.push(boat);
    return boat;
  }
  /** Object.Destroy(boat.GameObject): its meshes, bakes and flats go with it. */
  function remove(boat) {
    const i = boats.indexOf(boat);
    if (i < 0) return;
    boats.splice(i, 1);
    for (const n of boat.GameObject.walk()) {
      const b = flats.get(n); if (b) { renderer?.destroyBillboardBatch?.(b); flats.delete(n); }
      for (const c of n.components) if (c.type === 'FixDeformations') { const k = bakes.get(c); if (k?.gpu) renderer?.destroyMesh?.(k.gpu); bakes.delete(c); }
    }
  }

  /** A renderer's drawn model, uploaded once with its textures; null this frame while it loads. */
  function meshFor(key, build) {
    if (meshes.has(key)) return meshes.get(key);
    if (!meshLoads.has(key) && renderer?.createMesh) {
      meshLoads.set(key, (async () => {
        const model = build();
        if (!model) { meshes.set(key, null); return; }
        for (const sm of model.subMeshes) {
          try { await pipeline.getTexture(sm.textureArchive); pipeline.uploadRecord(sm.textureArchive, sm.textureRecord, { opaque: true }); }
          catch (e) { warnOnce(`tex:${sm.textureArchive}`, `[come-sail-away] TEXTURE.${sm.textureArchive} will not load - the boats' faces in it draw nothing`, e); }
        }
        meshes.set(key, renderer.createMesh(model));
      })().catch((e) => { meshes.set(key, null); warnOnce(`mesh:${key}`, '[come-sail-away] a boat mesh failed to build', e); }).finally(() => meshLoads.delete(key)));
    }
    return null;
  }

  /** FixDeformations.LateUpdate over one holder: the timer, and on its frame the bake written to the GPU. */
  function lateUpdateHolder(script, holder, dt) {
    if (!fixDeformationsTick(script, dt)) return;
    const skinnedNode = holder.parent;
    const smr = script.skinnedMeshRenderer;
    const g = models.geometry(smr.m_Mesh?.mesh);
    if (!g?.bindPoses) return;
    const bones = smr.m_Bones.map((b) => resolveNodePointer(skinnedNode, b));
    const boneWorld = bones.map((b) => (b ? b.worldMatrix() : null));
    let k = bakes.get(script);
    if (!k) { k = { gpu: null, positions: new Float32Array(g.vertexCount * 3), normals: new Float32Array(g.vertexCount * 3), loading: false }; bakes.set(script, k); }
    bakeSkinnedMesh(g, boneWorld, g.bindPoses, { position: skinnedNode.position, rotation: skinnedNode.rotation }, k.positions);
    recalculateNormals(k.positions, g.indices, g.subMeshes, k.normals);
    script.bakedMesh = k;
    if (k.gpu) { renderer.updateMeshVertices(k.gpu, k.positions, k.normals); return; }
    if (k.loading || !renderer?.createMesh) return;
    k.loading = true;
    const model = rendererModel({ ...g, positions: k.positions, normals: k.normals }, script.meshRenderer.materials);
    if (!model) return;
    (async () => {
      for (const sm of model.subMeshes) {
        try { await pipeline.getTexture(sm.textureArchive); pipeline.uploadRecord(sm.textureArchive, sm.textureRecord, { opaque: true }); } catch { /* the face draws nothing */ }
      }
      if (!bakes.has(script)) return;   // the boat went while the textures loaded
      k.gpu = renderer.createMesh({ ...model, positions: k.positions.slice(), normals: k.normals.slice() });
      renderer.updateMeshVertices(k.gpu, k.positions, k.normals);   // the newest bake, if one ran while it loaded
    })().catch((e) => warnOnce('bake', '[come-sail-away] a sail bake failed to upload', e));
  }

  /**
   * One frame, after the boats moved: the holders' LateUpdate, the lanterns' two behaviours, the flats' batches.
   * @param {number} gameDt - Time.deltaTime (zero while paused, scaled with the world)
   * @param {{ minuteOfDay?:number, cityLightsOn?:boolean, playerPosition?:number[] }} [world]
   */
  function frame(gameDt, world = {}) {
    const playerPosition = world.playerPosition ?? [0, 0, 0];
    for (const boat of boats) {
      for (const [n] of activeObjects(boat.GameObject)) {
        for (const c of n.components) {
          if (c.type === 'FixDeformations') lateUpdateHolder(c, n, gameDt);
        }
      }
      for (const l of boat.Lights) lanternLightUpdate(l, { dt: gameDt, cityLightsOn: !!world.cityLightsOn, playerPosition });
    }
    syncFlats();
  }

  /** The billboards: a batch per active, drawn flat, its centre on its object. */
  function syncFlats() {
    const seen = new Set();
    for (const boat of boats) {
      for (const [n, m] of activeObjects(boat.GameObject)) {
        const bb = n.getComponent('DaggerfallBillboard');
        if (!bb) continue;
        const r = n.getComponent('MeshRenderer');
        if (!r || r.m_Enabled === false) continue;
        const [w, h] = bb.Summary.Size;
        if (!(w > 0 && h > 0)) continue;
        let b = flats.get(n);
        if (!b) {
          if (!renderer?.createBillboardBatch) continue;
          b = renderer.createBillboardBatch(bb.Summary.Archive, bb.Summary.Record, { w, h }, [[0, 0, 0]], { dynamic: true });
          b.origin = [0, 0, 0];
          flats.set(n, b);
        }
        const s = n.lossyScale;
        b.size = { w: w * Math.abs(s[0]), h: h * Math.abs(s[1]) };
        b.origin[0] = m[12]; b.origin[1] = m[13] - b.size.h / 2; b.origin[2] = m[14];
        b.emissionOff = !!(r.emissionColor && r.emissionColor[0] === 0 && r.emissionColor[1] === 0 && r.emissionColor[2] === 0);
        seen.add(n);
      }
    }
    for (const [n, b] of flats) if (!seen.has(n)) { renderer?.destroyBillboardBatch?.(b); flats.delete(n); }
  }
  const batches = () => [...flats.values()];

  /** The boats' meshes, in the host's world pass. */
  function draw(r = renderer, texRemap = null) {
    if (!models || !r?.drawMesh) return 0;
    let n = 0;
    for (const boat of boats) {
      for (const [node, m] of activeObjects(boat.GameObject)) {
        const mr = node.getComponent('MeshRenderer');
        if (!mr || mr.m_Enabled === false || mr.materials?.[0]?.billboard) continue;
        let gpu = null;
        if (mr.classicModel != null) gpu = pipeline?.gpuMeshes?.get(mr.classicModel) ?? null;
        else {
          const mf = node.getComponent('MeshFilter');
          if (mf?.baked) { const fix = node.getComponent('FixDeformations'); gpu = bakes.get(fix)?.gpu ?? null; }
          else if (mf?.m_Mesh?.mesh) {
            const slots = mr.materials ?? bundleSlots(mr);
            const key = rendererModelKey(mf.m_Mesh.mesh, slots);
            gpu = meshFor(key, () => rendererModel(models.geometry(mf.m_Mesh.mesh), slots));
          }
        }
        if (gpu) { r.drawMesh(gpu, m, texRemap); n++; }
      }
    }
    return n;
  }

  /** The lit lanterns for the host's light list: the nearest CSA_LIGHTS_MAX to the eye. */
  function lights(eye = null) {
    const out = [];
    for (const boat of boats) {
      for (const l of boat.Lights) {
        if (!l.enabled || !l.node.activeInHierarchy) continue;
        const p = l.node.position;
        out.push({ x: p[0], y: p[1], z: p[2], range: l.range, color: [l.color[0] * l.intensity, l.color[1] * l.intensity, l.color[2] * l.intensity], _d: eye ? Math.hypot(p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]) : 0 });
      }
    }
    out.sort((a, b) => a._d - b._d);
    return out.slice(0, CSA_LIGHTS_MAX).map(({ _d, ...l }) => l);
  }

  /** FloatingOrigin moved the world: every boat's root follows (CSA-C restates OnPositionUpdate's boat arm whole). */
  function offsetAll(offset) {
    for (const boat of boats) {
      const p = boat.GameObject.localPosition;
      boat.GameObject.localPosition = [p[0] + offset[0], p[1] + offset[1], p[2] + offset[2]];
    }
  }
  function destroyAll() { for (const b of [...boats]) remove(b); }

  return {
    ensureModels, spawn, remove, frame, batches, draw, lights, offsetAll, destroyAll,
    get boats() { return boats; },
    get models() { return models; },
    /** A probe's reading: what stands, and how much of it is drawn. */
    stat: () => boats.map((b) => ({ hull: b.hull, variant: b.variant, position: b.GameObject.position.map((v) => +v.toFixed(2)), meshes: [...meshes.values()].filter(Boolean).length, bakes: [...bakes.values()].filter((k) => k.gpu).length, flats: flats.size, lights: b.Lights.filter((l) => l.enabled).length })),
  };
}

/** A boat's root pose as SetBoatPositionAndDirection leaves it (CSA-C): position and a heading about Y. */
export function boatRootMatrix(position, yawRadians) {
  return mat4FromQuatPosScale([0, Math.sin(yawRadians / 2), 0, Math.cos(yawRadians / 2)], position, [1, 1, 1]);
}
