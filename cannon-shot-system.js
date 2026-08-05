/**
 * Sistema modular de disparo do Cañón.
 * Fases da torre: Mira → Recuo+Disparo → Impacto → assenta recuo (ângulo permanece).
 */
(function (global) {
  'use strict';

  const TIMING = {
    RESOLVE_MS: 150,
    AIM_MS: 120,
    RECOIL_MS: 60,
    TRAVEL_MS: 120,
    IMPACT_MS: 180,
    RETURN_MS: 220,
    FLASH_MS: 55,
    VIBE_MS: 40,
    RECOIL_PX: 8,
  };

  function easeOutCubic(t) {
    const u = Math.max(0, Math.min(1, t));
    return 1 - Math.pow(1 - u, 3);
  }

  function easeOutBack(t, overshoot) {
    const u = Math.max(0, Math.min(1, t));
    const s = overshoot != null ? overshoot : 1.45;
    return 1 + (s + 1) * Math.pow(u - 1, 3) + s * Math.pow(u - 1, 2);
  }

  function easeOutExpo(t) {
    const u = Math.max(0, Math.min(1, t));
    return u >= 1 ? 1 : 1 - Math.pow(2, -10 * u);
  }

  function easeInOutQuad(t) {
    const u = Math.max(0, Math.min(1, t));
    return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
  }

  function lerpAngle(from, to, t) {
    const u = Math.max(0, Math.min(1, t));
    let d = to - from;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return from + d * u;
  }

  function seqFactory() {
    return {
      active: false,
      cherryId: 0,
      startTime: 0,
      aimFromAngle: 0,
      aimAngle: 0,
      aimPoint: null,
      lockedOrigin: null,
      lockedTarget: null,
      laserProgress: 0,
      laserStarted: false,
      scored: false,
      shot: null,
    };
  }

  function resetSeq(s) {
    s.active = false;
    s.cherryId = 0;
    s.startTime = 0;
    s.aimFromAngle = 0;
    s.aimAngle = 0;
    s.aimPoint = null;
    s.lockedOrigin = null;
    s.lockedTarget = null;
    s.laserProgress = 0;
    s.laserStarted = false;
    s.scored = false;
    s.shot = null;
  }

  class SeqPool {
    constructor(size) {
      this.pool = [];
      this.active = [];
      for (let i = 0; i < size; i++) this.pool.push(seqFactory());
    }

    get() {
      const s = this.pool.pop() || seqFactory();
      this.active.push(s);
      s.active = true;
      return s;
    }

    release(s) {
      resetSeq(s);
      const i = this.active.indexOf(s);
      if (i >= 0) {
        this.active[i] = this.active[this.active.length - 1];
        this.active.pop();
      }
      this.pool.push(s);
    }

    releaseAll() {
      while (this.active.length) this.release(this.active[0]);
    }
  }

  class CannonShotSystem {
    constructor(engine) {
      this.engine = engine;
      this.sequences = [];
      this.seqPool = new SeqPool(10);
      this.cannon = {
        displayAngle: -Math.PI / 2,
        restAngle: -Math.PI / 2,
        recoil: 0,
        flashUntil: 0,
        shakeUntil: 0,
      };
    }

    _seqEnd() {
      return this._travelEnd() + TIMING.RETURN_MS;
    }

    _travelEnd() {
      return TIMING.AIM_MS + TIMING.TRAVEL_MS;
    }

    _impactEnd() {
      return this._travelEnd() + TIMING.IMPACT_MS;
    }

    reset() {
      for (let i = this.sequences.length - 1; i >= 0; i--) {
        this._finishSequence(this.sequences[i], i);
      }
      this.sequences.length = 0;
      this.seqPool.releaseAll();
      this.cannon.displayAngle = -Math.PI / 2;
      this.cannon.restAngle = -Math.PI / 2;
      this.cannon.recoil = 0;
      this.cannon.flashUntil = 0;
      this.cannon.shakeUntil = 0;
      if (this.engine?.cannon) this.engine.cannon.flameUntil = 0;
    }

    beginResolve(cherry, now) {
      cherry.resolveUntil = now + TIMING.RESOLVE_MS;
      cherry.sequenceStarted = false;
      cherry.popScale = 1;
    }

    _recoilAt(elapsed) {
      const aimEnd = TIMING.AIM_MS;
      const recoilEnd = aimEnd + TIMING.RECOIL_MS;
      const travelEnd = this._travelEnd();
      const settleEnd = this._seqEnd();
      const peak = TIMING.RECOIL_PX;

      if (elapsed < aimEnd) return 0;

      if (elapsed < recoilEnd) {
        return easeOutBack((elapsed - aimEnd) / TIMING.RECOIL_MS) * peak;
      }

      if (elapsed < travelEnd) {
        return peak;
      }

      if (elapsed < settleEnd) {
        const retT = (elapsed - travelEnd) / TIMING.RETURN_MS;
        return peak * (1 - easeOutExpo(retT));
      }

      return 0;
    }

    _refreshAim(seq) {
      const eng = this.engine;
      const cherry = this._findCherry(seq.cherryId);
      if (!cherry) return;
      const aim = eng.getCherryAimPoint(cherry);
      seq.aimPoint = aim;
      seq.aimAngle = Math.atan2(aim.y - eng.cannon.y, aim.x - eng.cannon.x);
    }

    _applyCannonForSeq(seq, elapsed, ownsCannon) {
      if (!ownsCannon) return;

      this._refreshAim(seq);

      const aimEnd = TIMING.AIM_MS;

      if (elapsed < aimEnd) {
        const t = easeOutCubic(elapsed / TIMING.AIM_MS);
        this.cannon.displayAngle = lerpAngle(seq.aimFromAngle, seq.aimAngle, t);
      } else {
        this.cannon.displayAngle = seq.aimAngle;
      }

      this.cannon.recoil = this._recoilAt(elapsed);
    }

    update(time) {
      const eng = this.engine;
      const cherries = eng.cherryPool.active;

      for (let i = 0; i < cherries.length; i++) {
        const c = cherries[i];
        if (c.state !== 'resolved' || c.sequenceStarted) continue;
        if (time >= c.resolveUntil) this._startSequence(c, time);
      }

      const seqEnd = this._seqEnd();
      let cannonOwner = null;
      for (let i = 0; i < this.sequences.length; i++) {
        if (time - this.sequences[i].startTime < seqEnd) {
          cannonOwner = this.sequences[i];
          break;
        }
      }

      for (let i = this.sequences.length - 1; i >= 0; i--) {
        const seq = this.sequences[i];
        const elapsed = time - seq.startTime;
        let cherry = this._findCherry(seq.cherryId);
        const ownsCannon = seq === cannonOwner;

        if (elapsed >= seqEnd) {
          this._finishSequence(seq, i);
          continue;
        }

        if (!cherry && elapsed >= TIMING.AIM_MS && !seq.scored) {
          this._finishSequence(seq, i);
          continue;
        }

        this._applyCannonForSeq(seq, elapsed, ownsCannon);

        const aimEnd = TIMING.AIM_MS;
        const travelEnd = this._travelEnd();
        const impactEnd = this._impactEnd();

        if (elapsed >= aimEnd && !seq.laserStarted) {
          this._activateLaser(seq, cherry, time);
        }

        if (elapsed >= aimEnd && elapsed < travelEnd) {
          const travelT = Math.min(1, (elapsed - aimEnd) / TIMING.TRAVEL_MS);
          seq.laserProgress = easeInOutQuad(travelT);
          this._updateLaserPosition(seq, cherry, ownsCannon, time);
        } else if (elapsed >= travelEnd && seq.shot?.active) {
          seq.laserProgress = 1;
          this._updateLaserPosition(seq, cherry, ownsCannon, time);
        }

        if (elapsed >= travelEnd && elapsed < impactEnd) {
          if (!seq.scored && cherry) {
            seq.scored = true;
            const hit = this._cherryTarget(seq, cherry);
            eng._spawnExplosion(hit.x, hit.y);
            eng.score += 10;
            eng.hits++;
            if (eng.onCorrect) eng.onCorrect();
            cherry.state = 'popping';
            cherry.popStart = time;
          }
          const popT = Math.min(1, (elapsed - travelEnd) / TIMING.IMPACT_MS);
          if (cherry) cherry.popScale = this._popScale(popT);
          if (seq.shot?.active) {
            eng.shotPool.release(seq.shot);
            seq.shot = null;
          }
          if (cherry && popT >= 0.85) {
            this._releaseCherry(cherry);
            cherry = null;
          }
        } else if (elapsed >= impactEnd && cherry) {
          this._releaseCherry(cherry);
        }
      }

      if (!cannonOwner) {
        this.cannon.recoil *= 0.88;
      }
    }

    _popScale(t) {
      if (t < 0.2) return 1 + 0.12 * (t / 0.2);
      if (t < 0.45) return 1.12 + 0.08 * Math.sin((t - 0.2) / 0.25 * Math.PI);
      return Math.max(0, 1.2 * (1 - (t - 0.45) / 0.55));
    }

    _startSequence(cherry, time) {
      if (cherry.sequenceStarted) return;
      for (let i = 0; i < this.sequences.length; i++) {
        if (this.sequences[i].cherryId === cherry.id) return;
      }
      cherry.sequenceStarted = true;
      const eng = this.engine;
      const seq = this.seqPool.get();
      seq.cherryId = cherry.id;
      seq.startTime = time;
      seq.aimFromAngle = this.cannon.displayAngle;
      const aim = eng.getCherryAimPoint(cherry);
      seq.aimPoint = aim;
      seq.aimAngle = Math.atan2(aim.y - eng.cannon.y, aim.x - eng.cannon.x);
      seq.lockedOrigin = null;
      seq.lockedTarget = null;
      seq.laserProgress = 0;
      seq.laserStarted = false;
      seq.scored = false;
      seq.shot = null;
      this.sequences.push(seq);
    }

    _cherryTarget(seq, cherry) {
      if (cherry) return this.engine.getCherryAimPoint(cherry);
      return seq.aimPoint || null;
    }

    _activateLaser(seq, cherry, time) {
      if (!cherry || seq.laserStarted) return;
      seq.laserStarted = true;
      const eng = this.engine;
      if (!seq.shot) seq.shot = eng.shotPool.get();
      if (!seq.shot) return;

      this._refreshAim(seq);
      this.cannon.displayAngle = seq.aimAngle;

      const target = seq.aimPoint;
      const muzzle = eng._muzzlePosAt(this.cannon.displayAngle, this.cannon.recoil);
      seq.lockedOrigin = { x: muzzle.x, y: muzzle.y };
      seq.lockedTarget = { x: target.x, y: target.y };

      const shot = seq.shot;
      shot.sx = muzzle.x;
      shot.sy = muzzle.y;
      shot.tx = target.x;
      shot.ty = target.y;
      shot.x = muzzle.x;
      shot.y = muzzle.y;
      shot.targetId = cherry.id;
      shot.progress = 0;
      shot.trail.length = 0;
      shot.active = true;
      this.cannon.flashUntil = time + TIMING.FLASH_MS;
      this.cannon.shakeUntil = time + TIMING.VIBE_MS;
      const rocketDef = global.RocketSpriteRegistry?.[this.engine.cosmetics?.shipId]
        ?? global.RocketSpriteRegistry?.ship_chocolate;
      this.engine.cannon.flameUntil = time + (rocketDef?.flameBurstMs ?? 80);
    }

    _updateLaserPosition(seq, cherry, ownsCannon, time) {
      const shot = seq.shot;
      if (!shot?.active || !seq.lockedTarget || !seq.lockedOrigin) return;

      const eng = this.engine;
      const muzzle = eng._muzzlePosAt(this.cannon.displayAngle, this.cannon.recoil);
      const p = seq.laserProgress;
      const ox = seq.lockedOrigin.x;
      const oy = seq.lockedOrigin.y;
      const tx = seq.lockedTarget.x;
      const ty = seq.lockedTarget.y;

      shot.sx = muzzle.x;
      shot.sy = muzzle.y;
      shot.x = ox + (tx - ox) * p;
      shot.y = oy + (ty - oy) * p;
      shot.tx = tx;
      shot.ty = ty;

      if (p > 0) {
        const last = shot.trail.length ? shot.trail[shot.trail.length - 1] : null;
        if (!last || Math.abs(shot.x - last.x) > 0.5 || Math.abs(shot.y - last.y) > 0.5) {
          shot.trail.push({ x: shot.x, y: shot.y, t: time });
          while (shot.trail.length > 16) shot.trail.shift();
        }
      }
      shot.progress = p;
    }

    _releaseCherry(cherry) {
      if (!cherry || cherry._released) return;
      cherry._released = true;
      this.engine.cherryPool.release(cherry);
    }

    _finishSequence(seq, index) {
      const cherry = this._findCherry(seq.cherryId);
      this._releaseCherry(cherry);
      if (seq.shot) {
        this.engine.shotPool.release(seq.shot);
        seq.shot = null;
      }
      this.cannon.displayAngle = seq.aimAngle;
      this.cannon.restAngle = seq.aimAngle;
      this.cannon.recoil = this._recoilAt(this._seqEnd());
      this.sequences.splice(index, 1);
      this.seqPool.release(seq);
    }

    _findCherry(id) {
      const cherries = this.engine.cherryPool.active;
      for (let i = 0; i < cherries.length; i++) {
        if (cherries[i].id === id) return cherries[i];
      }
      return null;
    }

    getCannonAngle() {
      return this.cannon.displayAngle;
    }

    getRecoil() {
      return this.cannon.recoil;
    }

    getFlashUntil() {
      return this.cannon.flashUntil;
    }

    getShakeOffset(time) {
      if (time >= this.cannon.shakeUntil) return { x: 0, y: 0 };
      const left = this.cannon.shakeUntil - time;
      const amp = 2 * (left / TIMING.VIBE_MS);
      return {
        x: Math.sin(time * 0.09) * amp,
        y: Math.cos(time * 0.12) * amp * 0.65,
      };
    }
  }

  global.CannonShotSystem = CannonShotSystem;
  global.CannonShotTiming = TIMING;
})(typeof window !== 'undefined' ? window : globalThis);
