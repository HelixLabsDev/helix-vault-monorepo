/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { HatchingRenderer } from "@/lib/render";
import { AnimationConfig } from "@/lib/types";
import { VertexGenerator } from "@/lib/vertex";
import { useRef, useEffect, useCallback } from "react";

const DEFAULT_CONFIG: AnimationConfig = {
  timeStep: 0.01,
  baseForm: {
    majorRadius: 90,
    minorRadius: 50,
    complexity: 0.8,
    resolution: 36,
  },
  cacheLifetime: 0.1,
  colors: {
    primary: "rgba(156, 64, 255, 0.8)",
    accent: "rgba(156, 64, 255, 0.4)",
  },
};

interface OscillatingHatchingProps {
  width?: number;
  height?: number;
  config?: Partial<AnimationConfig>;
  className?: string;
}

const OscillatingHatching = ({
  width = 400,
  height = 400,
  config = {},
  className = "",
}: OscillatingHatchingProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const vertexGeneratorRef = useRef<VertexGenerator | null>(null);
  const rendererRef = useRef<HatchingRenderer | null>(null);

  const mergedConfig: AnimationConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    baseForm: { ...DEFAULT_CONFIG.baseForm, ...config.baseForm },
    colors: { ...DEFAULT_CONFIG.colors, ...config.colors },
  };

  const cleanup = useCallback(() => {
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }

    if (vertexGeneratorRef.current) {
      vertexGeneratorRef.current.clearCache();
    }

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, width, height);
      }
    }
  }, [width, height]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Initialize generators and renderers
    vertexGeneratorRef.current = new VertexGenerator(mergedConfig);
    rendererRef.current = new HatchingRenderer(
      ctx,
      width,
      height,
      mergedConfig
    );

    let time = 50;

    const animate = () => {
      if (!vertexGeneratorRef.current || !rendererRef.current) return;

      time += mergedConfig.timeStep;

      // Generate vertices for current time
      const vertices = vertexGeneratorRef.current.generateVertices(time);

      // Render the hatching
      rendererRef.current.render(vertices, time);

      requestRef.current = requestAnimationFrame(animate);
    };

    // Start animation
    animate();

    return cleanup;
  }, [width, height, cleanup]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={className}
      style={{ display: "block" }}
    />
  );
};

export default OscillatingHatching;
