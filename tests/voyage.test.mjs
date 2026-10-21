import test from 'node:test';
import assert from 'node:assert/strict';
import { islandPoint, voyagePlan, createVoyage, createRouteVoyage } from '../dist/voyage.js';

function frameClock() {
  let sequence = 0;
  const callbacks = new Map();
  const cancelled = new Map();
  return {
    requestFrame(callback) {
      const id = sequence++;
      callbacks.set(id, callback);
      return id;
    },
    cancelFrame(id) {
      cancelled.set(id, callbacks.get(id));
      callbacks.delete(id);
    },
    tick(time) {
      const pending = [...callbacks.values()];
      callbacks.clear();
      pending.forEach(callback => callback(time));
    },
    fireCancelled(time) {
      cancelled.forEach(callback => callback?.(time));
      cancelled.clear();
    },
    get pending() { return callbacks.size; }
  };
}

function ship() {
  const clock = frameClock(), updates = [], arrivals = [];
  const voyage = createVoyage({
    requestFrame: clock.requestFrame,
    cancelFrame: clock.cancelFrame,
    onUpdate: (point, state) => updates.push({ point, ...state }),
    onArrive: point => arrivals.push(point)
  });
  return { clock, updates, arrivals, voyage };
}

test('the seven weekly positions are stable and returned by value', () => {
  assert.deepEqual(Array.from({ length: 7 }, (_, i) => islandPoint(i)), [
    { x: 115, y: 200 }, { x: 340, y: 155 }, { x: 545, y: 265 },
    { x: 790, y: 160 }, { x: 865, y: 415 }, { x: 600, y: 445 },
    { x: 325, y: 425 }
  ]);
  const point = islandPoint(0);
  point.x = -500;
  assert.equal(islandPoint(0).x, 115);
  assert.throws(() => islandPoint(7), RangeError);
});

test('curved routes use measured distance with faster average speed and larger wakes for farther trips', () => {
  const near = voyagePlan({ x: 100, y: 100 }, { x: 200, y: 100 });
  const far = voyagePlan({ x: 100, y: 100 }, { x: 900, y: 100 });
  assert.match(near.path, /^M 100 100 C .+, 200 100$/);
  assert.ok(near.distance > 100);
  assert.ok(far.distance > 800);
  assert.ok(far.speed > near.speed);
  assert.ok(far.wakeScale > near.wakeScale);
  assert.ok(far.duration > near.duration);
  assert.ok(near.duration >= 600 && far.duration <= 1900);
  assert.equal(far.speed, far.distance / (far.duration / 1000));
  assert.equal(voyagePlan({ x: 2, y: 3 }, { x: 2, y: 3 }).duration, 0);
  assert.throws(() => voyagePlan({ x: Infinity, y: 0 }, { x: 0, y: 0 }), TypeError);
});

test('a voyage follows its curve, varies wake size with speed and arrives exactly once', () => {
  const { voyage, clock, updates, arrivals } = ship();
  voyage.reset({ x: 100, y: 100 });
  const plan = voyage.moveTo({ x: 800, y: 100 });
  clock.tick(100);
  clock.tick(100 + plan.duration * 0.2);
  const early = updates.at(-1);
  assert.ok(early.moving);
  assert.ok(early.point.x > 100 && early.point.x < 800);
  assert.notEqual(early.point.y, 100);
  clock.tick(100 + plan.duration * 0.5);
  const middle = updates.at(-1);
  assert.ok(middle.speed > early.speed);
  assert.ok(middle.wakeScale > early.wakeScale);
  clock.tick(100 + plan.duration);
  assert.deepEqual(voyage.position, { x: 800, y: 100 });
  assert.deepEqual(arrivals, [{ x: 800, y: 100 }]);
  assert.equal(updates.at(-1).moving, false);
  assert.equal(updates.at(-1).wakeScale, 0);
  assert.equal(clock.pending, 0);
  clock.tick(10000);
  assert.equal(arrivals.length, 1);
});

test('rapid selection replans from the actual visible position and ignores stale frames', () => {
  const { voyage, clock, arrivals } = ship();
  const first = voyage.moveTo(islandPoint(4));
  clock.tick(0);
  clock.tick(first.duration * 0.4);
  const interruptedAt = voyage.position;
  const second = voyage.moveTo(islandPoint(1));
  assert.deepEqual(second.from, interruptedAt);
  assert.deepEqual(voyage.position, interruptedAt);
  clock.fireCancelled(10000);
  assert.deepEqual(voyage.position, interruptedAt);
  assert.equal(arrivals.length, 0);
  clock.tick(1000);
  clock.tick(1000 + second.duration);
  assert.deepEqual(voyage.position, islandPoint(1));
  assert.deepEqual(arrivals, [islandPoint(1)]);
});

test('cancel and reset stop pending motion, including frame handle zero', () => {
  const { voyage, clock, arrivals, updates } = ship();
  voyage.moveTo(islandPoint(6));
  assert.equal(clock.pending, 1);
  voyage.cancel();
  assert.equal(clock.pending, 0);
  clock.fireCancelled(10000);
  assert.deepEqual(voyage.position, islandPoint(0));
  assert.equal(updates.at(-1).moving, false);
  voyage.moveTo(islandPoint(4));
  clock.tick(10);
  clock.tick(500);
  voyage.reset(islandPoint(2));
  clock.fireCancelled(20000);
  assert.deepEqual(voyage.position, islandPoint(2));
  assert.equal(arrivals.length, 0);
  const exposed = voyage.position;
  exposed.x = 0;
  assert.deepEqual(voyage.position, islandPoint(2));
});

test('reduced motion and selecting the current point arrive immediately without animation', () => {
  const { voyage, clock, arrivals, updates } = ship();
  voyage.moveTo(islandPoint(5), { reducedMotion: true });
  assert.deepEqual(voyage.position, islandPoint(5));
  assert.equal(clock.pending, 0);
  assert.equal(updates.at(-1).moving, false);
  voyage.moveTo(islandPoint(5));
  assert.equal(arrivals.length, 2);
  assert.equal(clock.pending, 0);
});

function routeShip() {
  const clock = frameClock(), updates = [], arrivals = [];
  const points = Array.from({ length: 7 }, (_, index) => {
    const point = islandPoint(index);
    return { x: point.x + 74, y: point.y + 27 };
  });
  const voyage = createRouteVoyage({
    points,
    requestFrame: clock.requestFrame,
    cancelFrame: clock.cancelFrame,
    onUpdate: (point, state) => updates.push({ point, ...state }),
    onArrive: point => arrivals.push(point)
  });
  return { voyage, clock, updates, arrivals, points };
}

function progressForDistance(fraction) {
  let low = 0, high = 1;
  for (let index = 0; index < 50; index += 1) {
    const middle = (low + high) / 2;
    if (middle * middle * (3 - 2 * middle) < fraction) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}

const nearPoint = (actual, expected) => {
  assert.ok(Math.hypot(actual.x - expected.x, actual.y - expected.y) < 0.001);
};

test('cross-island trips pass every intermediate dock along the displayed curves', () => {
  const { voyage, clock, points, arrivals } = routeShip();
  const legs = points.slice(1).map((point, index) => voyagePlan(points[index], point));
  const plan = voyage.moveTo(6);
  assert.equal(plan.distance, legs.reduce((sum, leg) => sum + leg.distance, 0));
  assert.ok(plan.distance > voyagePlan(points[0], points[6]).distance * 2);
  clock.tick(0);
  let distance = 0;
  for (let index = 0; index < legs.length - 1; index += 1) {
    distance += legs[index].distance;
    clock.tick(plan.duration * progressForDistance(distance / plan.distance));
    nearPoint(voyage.position, points[index + 1]);
  }
  clock.tick(plan.duration);
  assert.deepEqual(voyage.position, points[6]);
  assert.deepEqual(arrivals, [points[6]]);
});

test('reverse routes retrace the original curve with the opposite heading', () => {
  const forward = routeShip(), reverse = routeShip();
  const a = forward.voyage.moveTo(1);
  forward.clock.tick(0);
  forward.clock.tick(a.duration * 0.25);
  reverse.voyage.reset(1);
  const b = reverse.voyage.moveTo(0);
  reverse.clock.tick(0);
  reverse.clock.tick(b.duration * 0.75);
  nearPoint(forward.voyage.position, reverse.voyage.position);
  assert.ok(Math.abs(Math.abs(forward.updates.at(-1).heading - reverse.updates.at(-1).heading) - 180) < 0.001);
  assert.equal(a.distance, b.distance);
});

test('changing destination mid-route preserves traveled distance and rejects cancelled frames', () => {
  const { voyage, clock, points, arrivals } = routeShip();
  const first = voyage.moveTo(5);
  clock.tick(0);
  clock.tick(first.duration * 0.4);
  const current = voyage.position;
  const second = voyage.moveTo(0);
  assert.deepEqual(second.from, current);
  assert.ok(Math.abs(second.distance - first.distance * (0.4 * 0.4 * (3 - 2 * 0.4))) < 0.001);
  clock.fireCancelled(10000);
  assert.deepEqual(voyage.position, current);
  clock.tick(1000);
  clock.tick(1001 + second.duration);
  assert.deepEqual(arrivals, [points[0]]);
  voyage.moveTo(6);
  voyage.cancel();
  assert.equal(clock.pending, 0);
  voyage.reset(2);
  clock.fireCancelled(20000);
  assert.deepEqual(voyage.position, points[2]);
  voyage.moveTo(4, { reducedMotion: true });
  assert.deepEqual(voyage.position, points[4]);
  assert.equal(clock.pending, 0);
  assert.equal(arrivals.length, 2);
});

