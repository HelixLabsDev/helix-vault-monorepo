"use client";

import { useEffect, useRef } from "react";

// Themes: power of softness, water's way, universal truth
// Visualization: Bars that yield and flow like water, demonstrating how gentleness overcomes the rigid

const VerticalBarsNoise = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef(0);
  const animationFrameId = useRef<number | null>(null);

  // Simple noise function
  const noise = (x: number, y: number, t: number) => {
    const n =
      Math.sin(x * 0.01 + t) * Math.cos(y * 0.01 + t) +
      Math.sin(x * 0.015 - t) * Math.cos(y * 0.005 + t);
    return (n + 1) / 2;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 550;
    canvas.height = 550;

    const numLines = 50;
    const lineSpacing = canvas.height / numLines;

    const animate = () => {
      timeRef.current += 0.0005; // Reduced from 0.001 to 0.0005

      // Clear canvas with transparency
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw lines and noise-based bars
      for (let i = 0; i < numLines; i++) {
        const y = i * lineSpacing + lineSpacing / 2;

        // Draw horizontal line with your primary color but very subtle
        ctx.beginPath();
        ctx.strokeStyle = "rgba(255, 218, 51, 0.1)";
        ctx.lineWidth = 1;
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();

        // Draw bars based on noise
        for (let x = 0; x < canvas.width; x += 8) {
          const noiseVal = noise(x, y, timeRef.current);

          if (noiseVal > 0.5) {
            const barWidth = 3 + noiseVal * 10;
            const barHeight = 2 + noiseVal * 3;
            const animatedX =
              x + Math.sin(timeRef.current + y * 0.0375) * 20 * noiseVal; // Halved wave frequency for smoother movement

            // Use your primary color #FFDA33 with varying opacity
            // use this code #9c40ff to rgb(156, 64, 255)

            const opacity = 0.3 + noiseVal * 0.7;
            ctx.fillStyle = `rgba(156, 64, 255, ${opacity})`;
            ctx.fillRect(
              animatedX - barWidth / 2,
              y - barHeight / 2,
              barWidth,
              barHeight
            );
          }
        }
      }

      animationFrameId.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }

      if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }

      timeRef.current = 0;
    };
  }, []);

  return (
    <div className="h-[400px] overflow-hidden flex items-center justify-center">
      <canvas ref={canvasRef} className="block" />
    </div>
  );
};

export default VerticalBarsNoise;
