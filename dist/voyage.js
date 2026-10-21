const ISLANDS = [
  { x: 115, y: 200 }, { x: 340, y: 155 }, { x: 545, y: 265 },
  { x: 790, y: 160 }, { x: 865, y: 415 }, { x: 600, y: 445 },
  { x: 325, y: 425 }
];
const ARC_STEPS = 128;
const clone = point => ({ x: point.x, y: point.y });
const length = (from, to) => Math.hypot(to.x - from.x, to.y - from.y);
const round = value => Number(value.toFixed(3));

function validPoint(point) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new TypeError('航行坐标须为有限数值。');
  }
  return clone(point);
}

export function islandPoint(index) {
  if (!Number.isInteger(index) || index < 0 || index >= ISLANDS.length) {
    throw new RangeError('每周岛屿序号须在 0 到 6 之间。');
  }
  return clone(ISLANDS[index]);
}

function curvePoint(plan, t) {
  const s = 1 - t;
  return {
    x: s ** 3 * plan.from.x + 3 * s * s * t * plan.control1.x
      + 3 * s * t * t * plan.control2.x + t ** 3 * plan.to.x,
    y: s ** 3 * plan.from.y + 3 * s * s * t * plan.control1.y
      + 3 * s * t * t * plan.control2.y + t ** 3 * plan.to.y
  };
}

function curveHeading(plan, t) {
  const s = 1 - t;
  const x = 3 * s * s * (plan.control1.x - plan.from.x)
    + 6 * s * t * (plan.control2.x - plan.control1.x)
    + 3 * t * t * (plan.to.x - plan.control2.x);
  const y = 3 * s * s * (plan.control1.y - plan.from.y)
    + 6 * s * t * (plan.control2.y - plan.control1.y)
    + 3 * t * t * (plan.to.y - plan.control2.y);
  return Math.atan2(y, x) * 180 / Math.PI;
}

function arcTable(plan) {
  const table = [0];
  let previous = plan.from;
  for (let index = 1; index <= ARC_STEPS; index += 1) {
    const point = curvePoint(plan, index / ARC_STEPS);
    table.push(table[index - 1] + length(previous, point));
    previous = point;
  }
  return table;
}

function curveTime(table, fraction) {
  const distance = table[ARC_STEPS] * fraction;
  let low = 0, high = ARC_STEPS;
  while (high - low > 1) {
    const middle = Math.floor((high + low) / 2);
    if (table[middle] < distance) low = middle;
    else high = middle;
  }
  const segment = table[high] - table[low];
  return (low + (segment ? (distance - table[low]) / segment : 0)) / ARC_STEPS;
}

function wakeForSpeed(speed) {
  return speed > 0 ? Math.min(2.2, 0.55 + speed / 550) : 0;
}

export function voyagePlan(from, to) {
  from = validPoint(from);
  to = validPoint(to);
  const directDistance = length(from, to);
  const bend = Math.min(105, directDistance * 0.22);
  const normal = directDistance
    ? { x: -(to.y - from.y) / directDistance, y: (to.x - from.x) / directDistance }
    : { x: 0, y: 0 };
  return bezierPlan(from,to,{
    x: from.x + (to.x - from.x) * 0.32 + normal.x * bend,
    y: from.y + (to.y - from.y) * 0.32 + normal.y * bend
  },{
    x: from.x + (to.x - from.x) * 0.68 - normal.x * bend,
    y: from.y + (to.y - from.y) * 0.68 - normal.y * bend
  });
}

export function bezierPlan(from,to,control1,control2) {
  const plan = {
    from, to,
    control1, control2
  };
  plan.path = `M ${round(from.x)} ${round(from.y)} C ${round(plan.control1.x)} ${round(plan.control1.y)}, ${round(plan.control2.x)} ${round(plan.control2.y)}, ${round(to.x)} ${round(to.y)}`;
  plan.distance = arcTable(plan)[ARC_STEPS];
  plan.duration = plan.distance ? Math.min(1900, 600 + Math.sqrt(plan.distance) * 35) : 0;
  plan.speed = plan.duration ? plan.distance / (plan.duration / 1000) : 0;
  plan.wakeScale = wakeForSpeed(plan.speed);
  return plan;
}

export const samplePlan = (plan,t) => curvePoint(plan,t);

export function createVoyage({
  onUpdate = () => {},
  onArrive = () => {},
  requestFrame = globalThis.requestAnimationFrame?.bind(globalThis)
    ?? (callback => setTimeout(() => callback(performance.now()), 16)),
  cancelFrame = globalThis.cancelAnimationFrame?.bind(globalThis) ?? clearTimeout
} = {}) {
  let position = islandPoint(0);
  let heading = 0;
  let frame = null;
  let generation = 0;

  function stop() {
    generation += 1;
    if (frame !== null) cancelFrame(frame);
    frame = null;
  }

  function update(moving, speed = 0) {
    onUpdate(clone(position), { moving, speed, wakeScale: wakeForSpeed(speed), heading });
  }

  return {
    get position() { return clone(position); },
    reset(point) {
      const next = validPoint(point);
      stop();
      position = next;
      heading = 0;
      update(false);
    },
    cancel() {
      stop();
      update(false);
    },
    moveTo(point, { reducedMotion = false } = {}) {
      const plan = voyagePlan(position, point);
      stop();
      const current = generation;
      if (reducedMotion || !plan.distance) {
        position = clone(plan.to);
        if (plan.distance) heading = curveHeading(plan, 1);
        update(false);
        if (generation === current) onArrive(clone(position));
        return plan;
      }

      const table = arcTable(plan);
      let startedAt = null;
      heading = curveHeading(plan, 0);
      update(true);
      if (generation !== current) return plan;
      function tick(timestamp) {
        if (generation !== current) return;
        frame = null;
        startedAt ??= timestamp;
        const progress = Math.max(0, Math.min(1, (timestamp - startedAt) / plan.duration));
        const eased = progress * progress * (3 - 2 * progress);
        const curveT = curveTime(table, eased);
        position = progress === 1 ? clone(plan.to) : curvePoint(plan, curveT);
        heading = curveHeading(plan, curveT);
        update(progress < 1, progress < 1 ? plan.speed * 6 * progress * (1 - progress) : 0);
        if (generation !== current) return;
        if (progress === 1) onArrive(clone(position));
        else frame = requestFrame(tick);
      }
      frame = requestFrame(tick);
      return plan;
    }
  };
}

// Travel on the very same adjacent-island curves that the chart draws.
export function createRouteVoyage({
  points,
  routes,
  onUpdate = () => {},
  onArrive = () => {},
  requestFrame = globalThis.requestAnimationFrame?.bind(globalThis)
    ?? (callback => setTimeout(() => callback(performance.now()), 16)),
  cancelFrame = globalThis.cancelAnimationFrame?.bind(globalThis) ?? clearTimeout
} = {}) {
  if (!Array.isArray(points) || points.length < 2) {
    throw new TypeError('航线至少需要两处停泊点。');
  }
  const docks = points.map(validPoint);
  const stops = [0];
  const segments=[];
  docks.slice(1).forEach((point,index)=>{
    const plans=routes?.[index]??[voyagePlan(docks[index],point)];
    let distance=stops[index];
    for(const plan of plans){segments.push({plan,table:arcTable(plan),start:distance});distance+=plan.distance;}
    stops.push(distance);
  });
  let distanceAlongRoute = 0;
  let position = clone(docks[0]);
  let heading = curveHeading(segments[0].plan, 0);
  let frame = null;
  let generation = 0;

  function validIndex(index) {
    if (!Number.isInteger(index) || index < 0 || index >= docks.length) {
      throw new RangeError('请选择航线中的停泊点。');
    }
    return index;
  }

  function sample(distance, direction) {
    let index = 0;
    while (index < segments.length - 1
      && (direction < 0 ? distance > segments[index+1].start : distance >= segments[index+1].start)) {
      index += 1;
    }
    const { plan, table } = segments[index];
    const fraction = plan.distance ? (distance - segments[index].start) / plan.distance : 0;
    const t = curveTime(table, Math.max(0, Math.min(1, fraction)));
    return {
      point: curvePoint(plan, t),
      heading: curveHeading(plan, t) + (direction < 0 ? 180 : 0)
    };
  }

  function stop() {
    generation += 1;
    if (frame !== null) cancelFrame(frame);
    frame = null;
  }

  function update(moving, speed = 0) {
    onUpdate(clone(position), { moving, speed, wakeScale: wakeForSpeed(speed), heading });
  }

  return {
    get position() { return clone(position); },
    reset(index) {
      validIndex(index);
      stop();
      distanceAlongRoute = stops[index];
      position = clone(docks[index]);
      heading = sample(distanceAlongRoute, 1).heading;
      update(false);
    },
    cancel() {
      stop();
      update(false);
    },
    moveTo(index, { reducedMotion = false } = {}) {
      validIndex(index);
      const fromDistance = distanceAlongRoute;
      const toDistance = stops[index];
      const direction = Math.sign(toDistance - fromDistance);
      const distance = Math.abs(toDistance - fromDistance);
      const duration = distance ? Math.min(1900, 600 + Math.sqrt(distance) * 35) : 0;
      const speed = duration ? distance / (duration / 1000) : 0;
      const plan = {
        from: clone(position), to: clone(docks[index]), fromDistance, toDistance,
        distance, duration, speed, wakeScale: wakeForSpeed(speed)
      };
      stop();
      const current = generation;
      if (reducedMotion || !distance) {
        distanceAlongRoute = toDistance;
        position = clone(docks[index]);
        if (distance) heading = sample(toDistance, direction).heading;
        update(false);
        if (generation === current) onArrive(clone(position));
        return plan;
      }

      let startedAt = null;
      heading = sample(fromDistance, direction).heading;
      update(true);
      if (generation !== current) return plan;
      function tick(timestamp) {
        if (generation !== current) return;
        frame = null;
        startedAt ??= timestamp;
        const progress = Math.max(0, Math.min(1, (timestamp - startedAt) / duration));
        const eased = progress * progress * (3 - 2 * progress);
        distanceAlongRoute = fromDistance + (toDistance - fromDistance) * eased;
        const currentSample = sample(distanceAlongRoute, direction);
        position = progress === 1 ? clone(docks[index]) : currentSample.point;
        heading = currentSample.heading;
        update(progress < 1, progress < 1 ? speed * 6 * progress * (1 - progress) : 0);
        if (generation !== current) return;
        if (progress === 1) onArrive(clone(position));
        else frame = requestFrame(tick);
      }
      frame = requestFrame(tick);
      return plan;
    }
  };
}

