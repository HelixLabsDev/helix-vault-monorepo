import type { Vertex, AnimationConfig } from "./types";
import { noise3D, normalizeVector } from "./math";

export class VertexGenerator {
  private cachedVertices: Vertex[] | null = null;
  private lastCacheTime = -1;
  private config: AnimationConfig;

  constructor(config: AnimationConfig) {
    this.config = config;
  }

  generateVertices(time: number): Vertex[] {
    // Check if we can use the cache
    if (
      this.cachedVertices &&
      time - this.lastCacheTime < this.config.cacheLifetime
    ) {
      return this.cachedVertices;
    }

    const vertices: Vertex[] = [];
    const { resolution, majorRadius, minorRadius, complexity } =
      this.config.baseForm;

    // Base radius oscillation for breathing effect
    const breathingFactor = Math.sin(time * 0.2) * 5;
    const currentMajorRadius = majorRadius + breathingFactor;
    const currentMinorRadius = minorRadius + breathingFactor * 0.2;

    // Generate points on a torus with noise deformation
    for (let i = 0; i < resolution; i++) {
      const theta = (i / resolution) * Math.PI * 2;

      for (let j = 0; j < resolution; j++) {
        const phi = (j / resolution) * Math.PI * 2;

        // Base torus coordinates
        const baseX =
          (currentMajorRadius + currentMinorRadius * Math.cos(phi)) *
          Math.cos(theta);
        const baseY =
          (currentMajorRadius + currentMinorRadius * Math.cos(phi)) *
          Math.sin(theta);
        const baseZ = currentMinorRadius * Math.sin(phi);

        // Add noise deformation
        const noiseScale = 0.02 * complexity;
        const timeFactor = time * 0.2;
        const noise =
          15 *
            noise3D(
              baseX * noiseScale,
              baseY * noiseScale,
              baseZ * noiseScale,
              timeFactor
            ) +
          7 *
            noise3D(
              baseX * noiseScale * 2,
              baseY * noiseScale * 2,
              baseZ * noiseScale * 2,
              timeFactor * 1.3
            );

        // Calculate normal direction
        const normal = normalizeVector({
          x: baseX / currentMajorRadius,
          y: baseY / currentMajorRadius,
          z: baseZ / currentMinorRadius,
        });

        // Apply noise along normal direction
        const position = {
          x: baseX + normal.x * noise,
          y: baseY + normal.y * noise,
          z: baseZ + normal.z * noise,
        };

        // Create tangent vectors for hatching direction
        const tangent1 = {
          x: -Math.sin(theta),
          y: Math.cos(theta),
          z: 0,
        };

        const tangent2 = {
          x: -Math.cos(theta) * Math.sin(phi),
          y: -Math.sin(theta) * Math.sin(phi),
          z: Math.cos(phi),
        };

        // Pre-calculate hatching intensity
        const hatchingIntensity =
          0.3 +
          0.7 *
            Math.abs(
              noise3D(
                position.x * 0.03,
                position.y * 0.03,
                position.z * 0.03,
                time * 0.5
              )
            );

        vertices.push({
          position,
          normal,
          tangent1,
          tangent2,
          theta,
          phi,
          hatchingIntensity,
        });
      }
    }

    // Update cache
    this.cachedVertices = vertices;
    this.lastCacheTime = time;

    return vertices;
  }

  clearCache(): void {
    this.cachedVertices = null;
  }
}
