import motion from "./ranma-deer-motion.json";

type Point = [number, number];

/** Angles are generated and checked by scripts/ranma-deer-motion.py.
 * Interpolate angles, never joint positions: every bone keeps its length. */
export function deerLegPath(progress: number, index: number): string {
  const position = Math.max(0, Math.min(1, progress)) * (motion.angles.length - 1);
  const frame = Math.min(motion.angles.length - 2, Math.floor(position));
  const blend = position - frame;
  const rotation = (Math.sin(progress * Math.PI * 2) * motion.rock * Math.PI) / 180;
  const [x, y] = motion.roots[index];
  const points: Point[] = [
    [
      x * Math.cos(rotation) - (y + 68) * Math.sin(rotation),
      x * Math.sin(rotation) +
        (y + 68) * Math.cos(rotation) -
        68 -
        motion.bob * Math.sin(progress * Math.PI * 2) ** 2,
    ],
  ];
  for (let bone = 0; bone < 3; bone++) {
    const a = motion.angles[frame][index][bone];
    const angle = a + (motion.angles[frame + 1][index][bone] - a) * blend;
    const length = motion.lengths[index][bone];
    const previous = points[bone];
    points.push([previous[0] + length * Math.cos(angle), previous[1] + length * Math.sin(angle)]);
  }
  // Taper from shoulder/thigh to the carpal/hock joint and fetlock.
  // A continuous outline avoids ball joints and separate capsule-shaped bones.
  const mix = (a: Point, b: Point, t: number): Point => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
  ];
  const outline = [
    points[0],
    points[1],
    mix(points[1], points[2], 0.8),
    points[2],
    mix(points[2], points[3], 0.18),
    points[3],
  ];
  const widths = index % 2 === 0 ? [10, 6.2, 2.8, 4.1, 2.4, 2.2] : [12, 6.5, 2.9, 4.2, 2.4, 2.2];
  const sides = [-1, 1].map((side) =>
    outline.map((point, joint): Point => {
      const before = outline[Math.max(0, joint - 1)];
      const after = outline[Math.min(outline.length - 1, joint + 1)];
      const dx = after[0] - before[0],
        dy = after[1] - before[1];
      const length = Math.hypot(dx, dy);
      return [
        point[0] + (side * widths[joint] * dy) / length,
        point[1] - (side * widths[joint] * dx) / length,
      ];
    }),
  );
  const p = (point: Point) => `${point[0].toFixed(4)} ${point[1].toFixed(4)}`;
  const toward = (a: Point, b: Point): Point => [
    a[0] + (b[0] - a[0]) * 0.06,
    a[1] + (b[1] - a[1]) * 0.06,
  ];
  const [left, right] = sides;
  const hoof = points[3];
  const edge = (side: Point[]) =>
    side
      .slice(1, -1)
      .map(
        (joint, i) => `L${p(toward(joint, side[i]))} Q${p(joint)} ${p(toward(joint, side[i + 2]))}`,
      )
      .join(" ") + ` L${p(side[side.length - 1])}`;
  return `M${p(left[0])} ${edge(left)}
    L${hoof[0] - 3.5} ${hoof[1] + 5} H${hoof[0] + 7}
    Q${hoof[0] + 6} ${hoof[1] + 2} ${p(right[right.length - 1])}
    ${edge([...right].toReversed())}Z`;
}
