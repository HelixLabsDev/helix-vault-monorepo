import type { Point3D } from "./types";

export const noise3D = (x: number, y: number, z: number, t: number): number => {
  return (
    Math.sin(x * 0.1 + t * 0.15) *
    Math.cos(y * 0.1 + Math.sin(z * 0.1) + t * 0.1) *
    Math.sin(z * 0.1 + Math.sin(x * 0.1) + t * 0.2)
  );
};

export const normalizeVector = (vector: Point3D): Point3D => {
  const length =
    Math.sqrt(
      vector.x * vector.x + vector.y * vector.y + vector.z * vector.z
    ) || 0.001;
  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length,
  };
};

export const rotatePoint = (
  point: Point3D,
  rotX: number,
  rotY: number
): Point3D => {
  const cosX = Math.cos(rotX);
  const sinX = Math.sin(rotX);
  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);

  // Apply rotation around Y-axis
  const y1 = point.y;
  const z1 = point.z * cosX - point.x * sinX;
  const x1 = point.z * sinX + point.x * cosX;

  // Apply rotation around X-axis
  const y2 = y1 * cosY - z1 * sinY;
  const z2 = y1 * sinY + z1 * cosY;
  const x2 = x1;

  return { x: x2, y: y2, z: z2 };
};
