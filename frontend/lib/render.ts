/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  Vertex,
  ProjectedVertex,
  AnimationConfig,
  Point3D,
} from "./types";
import { rotatePoint } from "./math";

export class HatchingRenderer {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private centerX: number;
  private centerY: number;
  private config: AnimationConfig;

  constructor(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    config: AnimationConfig
  ) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.centerX = width / 2;
    this.centerY = height / 2;
    this.config = config;
  }

  private project(
    point: Point3D,
    time: number
  ): { x: number; y: number; z: number } {
    const rotX = time * 0.05;
    const rotY = time * 0.075;
    const rotated = rotatePoint(point, rotX, rotY);

    const scale = 1.5;
    return {
      x: this.centerX + rotated.x * scale,
      y: this.centerY + rotated.y * scale,
      z: rotated.z,
    };
  }

  private calculateVisibility(projectedVertices: ProjectedVertex[]): boolean[] {
    const bufferSize = 200;
    const zBuffer = Array(bufferSize)
      .fill(null)
      .map(() => Array(bufferSize).fill(Number.NEGATIVE_INFINITY));
    const visible = Array(projectedVertices.length).fill(false);

    const toBufferCoords = (x: number, y: number) => ({
      bx: Math.floor((x / this.width) * bufferSize),
      by: Math.floor((y / this.height) * bufferSize),
    });

    projectedVertices.forEach((vertex, index) => {
      const { bx, by } = toBufferCoords(vertex.x, vertex.y);

      if (bx >= 0 && bx < bufferSize && by >= 0 && by < bufferSize) {
        if (vertex.z > zBuffer[by][bx]) {
          zBuffer[by][bx] = vertex.z;
          visible[index] = true;
        }
      }
    });

    return visible;
  }

  private groupVerticesByPhi(
    vertices: Vertex[],
    projectedVertices: ProjectedVertex[],
    isVisible: boolean[]
  ) {
    const phiGroups: {
      [key: string]: Array<{ vertex: Vertex; projectedPos: ProjectedVertex }>;
    } = {};
    const phiPrecision = 0.2;

    vertices.forEach((vertex, index) => {
      if (!isVisible[index]) return;

      const phiKey = Math.round(vertex.phi / phiPrecision) * phiPrecision;
      if (!phiGroups[phiKey]) {
        phiGroups[phiKey] = [];
      }

      phiGroups[phiKey].push({
        vertex,
        projectedPos: projectedVertices[index],
      });
    });

    return phiGroups;
  }

  private groupVerticesByTheta(
    vertices: Vertex[],
    projectedVertices: ProjectedVertex[],
    isVisible: boolean[]
  ) {
    const thetaGroups: {
      [key: string]: Array<{ vertex: Vertex; projectedPos: ProjectedVertex }>;
    } = {};
    const thetaPrecision = 0.15;

    vertices.forEach((vertex, index) => {
      if (!isVisible[index]) return;

      const thetaKey =
        Math.round(vertex.theta / thetaPrecision) * thetaPrecision;
      if (!thetaGroups[thetaKey]) {
        thetaGroups[thetaKey] = [];
      }

      thetaGroups[thetaKey].push({
        vertex,
        projectedPos: projectedVertices[index],
      });
    });

    return thetaGroups;
  }

  private drawPrimaryHatching(phiGroups: any, time: number): void {
    Object.values(phiGroups).forEach((group: any) => {
      if (group.length < 2) return;

      group.sort((a: any, b: any) => a.vertex.theta - b.vertex.theta);

      const midPoint = group[Math.floor(group.length / 2)];
      const normalZ = midPoint.vertex.normal.z;
      const intensity = midPoint.vertex.hatchingIntensity;

      const baseLightness = Math.abs(normalZ) * 0.7 + 0.3;
      const baseOpacity = 0.1 + baseLightness * 0.5;
      const opacity = baseOpacity * intensity;
      const lineWidth = 1.3 + intensity * 0.7;

      this.ctx.beginPath();
      const start = group[0].projectedPos;
      this.ctx.moveTo(start.x, start.y);

      for (let i = 1; i < group.length; i++) {
        const point = group[i].projectedPos;
        const variation = 0.5 * Math.sin(time + group[i].vertex.theta * 10);
        this.ctx.lineTo(point.x + variation, point.y + variation);
      }

      this.ctx.strokeStyle = `rgba(156, 64, 255, ${opacity})`;
      this.ctx.lineWidth = lineWidth;
      this.ctx.stroke();
    });
  }

  private drawCrossHatching(thetaGroups: any, time: number): void {
    Object.values(thetaGroups).forEach((group: any) => {
      if (group.length < 2) return;

      group.sort((a: any, b: any) => a.vertex.phi - b.vertex.phi);

      const midPoint = group[Math.floor(group.length / 2)];
      const normalX = midPoint.vertex.normal.x;
      const normalY = midPoint.vertex.normal.y;
      const lightAngle = Math.atan2(normalY, normalX);
      const intensity =
        0.3 + 0.7 * Math.abs(Math.sin(lightAngle + time * 0.02));

      const lineWidth = 0.2 + intensity * 0.6;
      const opacity =
        (0.1 + intensity * 0.4) * midPoint.vertex.hatchingIntensity;

      this.ctx.beginPath();
      const start = group[0].projectedPos;
      this.ctx.moveTo(start.x, start.y);

      for (let i = 1; i < group.length; i++) {
        const point = group[i].projectedPos;
        const variation = 0.3 * Math.cos(time * 1.2 + group[i].vertex.phi * 8);
        this.ctx.lineTo(point.x + variation, point.y + variation);
      }

      this.ctx.strokeStyle = `rgba(156, 64, 255, ${opacity})`;
      this.ctx.lineWidth = lineWidth;
      this.ctx.stroke();
    });
  }

  private drawAccentHatches(
    vertices: Vertex[],
    projectedVertices: ProjectedVertex[],
    isVisible: boolean[],
    time: number
  ): void {
    const accentThreshold = 1.7;

    projectedVertices.forEach((pVertex, index) => {
      if (!isVisible[index]) return;

      const vertex = pVertex.vertex;
      if (vertex.hatchingIntensity <= accentThreshold) return;

      const mixFactor = Math.sin(
        time * 0.1 + vertex.theta * 2 + vertex.phi * 1
      );
      const tangentX =
        (vertex.tangent1.x * (1 + mixFactor)) / 2 +
        (vertex.tangent2.x * (1 - mixFactor)) / 2;
      const tangentY =
        (vertex.tangent1.y * (1 + mixFactor)) / 2 +
        (vertex.tangent2.y * (1 - mixFactor)) / 2;
      const tangentZ =
        (vertex.tangent1.z * (1 + mixFactor)) / 2 +
        (vertex.tangent2.z * (1 - mixFactor)) / 2;

      const length = 3 + 5 * vertex.hatchingIntensity;

      const startPos = {
        x: vertex.position.x - tangentX * length,
        y: vertex.position.y - tangentY * length,
        z: vertex.position.z - tangentZ * length,
      };

      const endPos = {
        x: vertex.position.x + tangentX * length,
        y: vertex.position.y + tangentY * length,
        z: vertex.position.z + tangentZ * length,
      };

      const projectedStart = this.project(startPos, time);
      const projectedEnd = this.project(endPos, time);

      this.ctx.beginPath();
      this.ctx.moveTo(projectedStart.x, projectedStart.y);
      this.ctx.lineTo(projectedEnd.x, projectedEnd.y);

      const pulse =
        0.5 + 0.5 * Math.sin(time * 0.25 + vertex.theta * 3 + vertex.phi * 2);
      const accentOpacity = 0.1 + 0.5 * pulse * vertex.hatchingIntensity;
      const accentWidth = 0.3 + 0.6 * pulse;

      this.ctx.strokeStyle = `rgba(156, 64, 255, ${accentOpacity})`;
      this.ctx.lineWidth = accentWidth;
      this.ctx.stroke();
    });
  }

  render(vertices: Vertex[], time: number): void {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Project vertices to 2D
    const projectedVertices: ProjectedVertex[] = vertices.map((v) => ({
      ...this.project(v.position, time),
      vertex: v,
    }));

    // Determine visibility
    const isVisible = this.calculateVisibility(projectedVertices);

    // Group vertices for hatching
    const phiGroups = this.groupVerticesByPhi(
      vertices,
      projectedVertices,
      isVisible
    );
    const thetaGroups = this.groupVerticesByTheta(
      vertices,
      projectedVertices,
      isVisible
    );

    // Draw hatching layers
    this.drawPrimaryHatching(phiGroups, time);
    this.drawCrossHatching(thetaGroups, time);
    this.drawAccentHatches(vertices, projectedVertices, isVisible, time);
  }
}
