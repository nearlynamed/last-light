import { add, cross, len, mul, MU, norm } from './math';
import type { V3 } from './math';

export interface Encounter {
  id: string;
  p: V3;
  v: V3;
  size: number;
  reflect: number;
  spawn: number;
}

// Specify a hyperbolic orbit by its closest approach, not by aiming at the planet.
// Energy and angular momentum give an inbound state in any orbital plane.
export function flybyState(direction: V3, plane: V3, radius: number, periapsis: number, excessSpeed: number): {p: V3; v: V3} {
  const radial = norm(direction);
  let tangent = cross(plane, radial);
  if (len(tangent) < .001) tangent = cross(Math.abs(radial[1]) > .9 ? [1, 0, 0] : [0, 1, 0], radial);
  tangent = norm(tangent);
  const momentum = periapsis * Math.sqrt(excessSpeed ** 2 + 2 * MU / periapsis);
  const sideways = momentum / radius;
  const inward = -Math.sqrt(Math.max(0, excessSpeed ** 2 + 2 * MU / radius - sideways ** 2));
  return {p: mul(radial, radius), v: add(mul(radial, inward), mul(tangent, sideways))};
}

export function createEncounters(): Encounter[] {
  // Four impactors among sixteen approaches. Arrival density rises through the watch.
  // Low excess speeds make gravity visibly bend the tracks around Aster.
  const stream: [number, V3, V3, number, number, number, number][] = [
    [-30, [1, .2, .8], [0, 1, .2], 9.1, 1.68, .028, 3.1],
    [-30, [-1, .5, .6], [.3, 1, .2], 5.4, 2.55, .022, 1.3],
    [-24, [.2, -.5, -1], [1, .3, 0], 5.8, 3.15, .026, 1.0],
    [-12, [.9, .6, -.5], [0, 1, -.4], 6.1, 2.18, .021, 1.5],
    [22, [-.8, .1, -1], [.2, 1, .3], 6.0, 2.80, .027, .8],
    [41, [-.7, -.5, .8], [0, 1, .5], 6.3, 1.82, .028, 1.2],
    [61, [.8, -.3, .7], [1, 0, -.4], 5.8, 2.08, .023, .9],
    [81, [.1, .9, -.7], [1, .2, 0], 6.2, 3.50, .029, 1.1],
    [100, [-1, .2, .3], [.2, 1, -.4], 6.1, 2.32, .026, .7],
    [117, [.7, -.7, -.4], [0, 1, .4], 6.2, 1.74, .031, 1.4],
    [133, [.6, .3, 1], [0, 1, -.3], 5.6, 2.65, .025, .85],
    [148, [-.5, .8, -.8], [1, 0, .5], 5.8, 2.12, .020, 1.3],
    [162, [-.8, -.4, -.4], [.2, 1, 0], 5.7, 3.05, .032, .8],
    [175, [.8, .2, -.7], [.4, 1, .2], 5.8, 1.86, .029, 1.1],
    [187, [-.3, -.7, 1], [1, .2, 0], 5.3, 2.42, .028, .9],
    [198, [1, .6, .1], [0, 1, .4], 5.4, 2.95, .024, 1.15],
  ];
  return stream.map(([spawn, direction, plane, radius, periapsis, speed, size], i) => ({
    id: `stream-${i}`, ...flybyState(direction, plane, radius, periapsis, speed),
    spawn, size, reflect: .85 + (i % 4) * .22,
  }));
}
