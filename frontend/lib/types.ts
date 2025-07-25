export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface Vertex {
  position: Point3D;
  normal: Point3D;
  tangent1: Point3D;
  tangent2: Point3D;
  theta: number;
  phi: number;
  hatchingIntensity: number;
}

export interface ProjectedVertex {
  x: number;
  y: number;
  z: number;
  vertex: Vertex;
}

export interface AnimationConfig {
  timeStep: number;
  baseForm: {
    majorRadius: number;
    minorRadius: number;
    complexity: number;
    resolution: number;
  };
  cacheLifetime: number;
  colors: {
    primary: string;
    accent: string;
  };
}
