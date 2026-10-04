// @ts-check
// LW2 (2026-10-04, bible/06-Systems/Living-World.md): THE RESIDENT'S BODY - a living-world townsperson on the street.
// DFU's walker (mobilePerson.js MobilePerson, verbatim) both chooses its steps and wears them; a resident's steps are
// its day's (systems/livingWorld/livingTown.js lays it where its day says it is, every frame), so this keeps the
// walker's BODY and nothing of its feet: the same billboard - MoveAnims records 0-4 on the mirrored 8-way wheel at 4
// fps, the idle record 5 (the watch's 15) at 1 fps, the frame and timer reset at each change of state (AUDIT 26
// F021's law) - worn on a yaw of its own instead of the grid's four, and the same talk fields the street's activation
// reads (`nameNPC`, `personFaceRecordId`, `guard`, `facingYaw`). It is a MobilePerson, so every seam that takes a
// walker - the talk ray, the pickpocket, the watch's conversion, the trample - takes it unchanged.
import { MobilePerson, MOVE_RECORDS, MOVE_FLIPS, PERSON_MOVE_FPS, PERSON_IDLE_FPS, PERSON_IDLE_RECORD, PERSON_GUARD_IDLE_RECORD } from './mobilePerson.js';
import { mobileOrientation } from './mobileUnit.js';

export class ResidentWalker extends MobilePerson {
  /**
   * @param {any} nav - the town's CityNavigation (the walker's own seams read it; the resident never seeks on it)
   * @param {{ archive: number, guard?: boolean, frameCount: (record: number, archive: number) => number, collider?: any, groundY?: (x: number, z: number) => number }} opts
   */
  constructor(nav, opts) {
    super(nav, opts);
    /** Whether the day has it walking this frame (livingTown.js sets it). */
    this.moving = false;
    /** The way it faces, a world yaw (0 is +z). */
    this.yaw = 0;
    /** The living world's resident this body is, or null while it stands in the pool (livingTown.js). @type {any} */
    this.living = null;
    this.state = 'idle';
    this.moveCount = 1;   // the anti-skate rule is the pool's: a resident is placed where it is, never mid-tile
  }

  /** The facing the watch's conversion and a guard's spawn read (G1). */
  get facingYaw() { return this.yaw; }

  /** Nothing on the grid to claim: a resident walks the path its day laid, through the others as DFU's walkers pass. */
  release() {}

  /**
   * One frame of the billboard. The position is the living town's; `wantsToStop` the street's politeness gate (the
   * walker's own, mobilePerson.js personWantsToStop), which stands it to face the player - the town holds its clock
   * back while it does (livingTown.js).
   * @param {number} dt @param {number[]} cameraPos @param {boolean} [wantsToStop]
   * @returns {{ record: number, frame: number, flip: boolean }}
   */
  update(dt, cameraPos, wantsToStop = false) {
    const st = this.moving && !wantsToStop ? 'move' : 'idle';
    if (st !== this.state) { this.state = st; this.frame = 0; this._timer = 0; }
    const fps = st === 'idle' ? PERSON_IDLE_FPS : PERSON_MOVE_FPS;
    this._timer += dt;
    while (this._timer >= 1 / fps) { this._timer -= 1 / fps; this.frame++; }
    if (st === 'idle') {
      const rec = this.guard ? PERSON_GUARD_IDLE_RECORD : PERSON_IDLE_RECORD;
      const n = Math.max(1, this.frameCount(rec, this.archive));
      return this._frameOut(rec, this.frame % n, false);
    }
    const o = mobileOrientation(this.yaw, this.pos, cameraPos);
    const rec = MOVE_RECORDS[o];
    const n = Math.max(1, this.frameCount(rec, this.archive));
    return this._frameOut(rec, this.frame % n, MOVE_FLIPS[o]);
  }
}
