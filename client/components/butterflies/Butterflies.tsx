"use client";

import { useEffect, useRef } from "react";

interface ButterflyData {
  theta: number;
  phi: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  swingRate: number;
}

interface ParticleData {
  x: number;
  y: number;
  vx: number;
  vy: number;
  opacity: number;
}

export default function Butterfly() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const container = canvas.parentElement;

    if (!container) return;

    const context = canvas.getContext("2d");

    if (!context) return;

    let animationFrame: number;

    let width = container.clientWidth;
    let height = container.clientHeight;

    const butterflies: ButterflyData[] = [];
    const particles: ParticleData[] = [];

    const DELTA_THETA = Math.PI / 50;
    const DELTA_PHI = Math.PI / 100;
    const THRESHOLD = 100;
    const DELTA_PARTICLE = 2;

    /*
     * Half the wingspan, and the right edge of the
     * strip the butterflies are allowed to use. The
     * strip stops short of <main> so nothing ever
     * flies behind the text.
     */
    const HALF_SPAN = 80;
    const TEXT_GAP = 24;

    let bandRight = 0;

    const getRandomValue = (min: number, max: number) => {
      return min + (max - min) * Math.random();
    };

    const resizeCanvas = () => {
      width = container.clientWidth;
      height = container.clientHeight;

      const dpr = window.devicePixelRatio || 1;

      canvas.width = width * dpr;
      canvas.height = height * dpr;

      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      const main = container.parentElement?.querySelector("main");

      if (main) {
        bandRight =
          main.getBoundingClientRect().left -
          container.getBoundingClientRect().left -
          TEXT_GAP;
      } else {
        bandRight = width * 0.25;
      }

      bandRight = Math.max(bandRight, HALF_SPAN * 2 + 20);
    };

    const createButterfly = (): ButterflyData => {
      return {
        theta: 0,
        phi: 0,

        x: getRandomValue(HALF_SPAN, bandRight - HALF_SPAN),

        y: height + THRESHOLD,

        vx: getRandomValue(-0.25, 0.25),
        vy: -3,

        swingRate: getRandomValue(0.5, 1),
      };
    };

    const createParticle = (butterfly: ButterflyData): ParticleData => {
      const theta = getRandomValue(0, Math.PI * 2);

      return {
        x: butterfly.x + getRandomValue(-50, 50),
        y: butterfly.y,

        vx: Math.cos(theta),
        vy: Math.sin(theta),

        opacity: 1,
      };
    };

    const createParticles = (butterfly: ButterflyData) => {
      for (let i = 0; i < DELTA_PARTICLE; i++) {
        particles.push(createParticle(butterfly));
      }
    };

    const renderParticle = (particle: ParticleData): boolean => {
      context.save();

      context.translate(particle.x, particle.y);

      context.scale(2 - particle.opacity, 2 - particle.opacity);

      context.beginPath();

      context.fillStyle = `hsla(
        104,
        42%,
        50%,
        ${particle.opacity}
      )`;

      context.arc(0, 0, 2, 0, Math.PI * 2, false);

      context.fill();

      context.restore();

      particle.x += particle.vx;
      particle.y += particle.vy;

      particle.vx *= 0.99;
      particle.vy *= 0.99;

      particle.opacity = Math.max(0, particle.opacity - 0.005);

      return particle.opacity > 0 && particle.x < bandRight;
    };

    const renderButterfly = (butterfly: ButterflyData): boolean => {
      context.save();

      context.translate(butterfly.x, butterfly.y);

      context.rotate(Math.atan2(butterfly.vx, -butterfly.vy));

      // Draw both wings
      for (let side = -1; side <= 1; side += 2) {
        context.save();

        context.scale(side, 1);

        const rate = Math.sin(butterfly.theta / 4);

        const gradient = context.createRadialGradient(0, 0, 0, 0, 0, 80);

        gradient.addColorStop(0, "hsl(104, 42%, 40%)");

        gradient.addColorStop(
          0.3,
          `hsl(
            104,
            42%,
            ${40 + 10 * rate}%
          )`,
        );

        gradient.addColorStop(
          0.5,
          `hsl(
            104,
            42%,
            ${40 + 20 * rate}%
          )`,
        );

        gradient.addColorStop(
          1,
          `hsl(
            104,
            42%,
            ${40 + 30 * rate}%
          )`,
        );

        context.lineWidth = 3;

        context.strokeStyle = "hsl(104, 42%, 80%)";

        context.fillStyle = gradient;

        // Bottom wing
        context.save();

        context.scale(0.8 + 0.2 * Math.cos(butterfly.theta + Math.PI / 10), 1);

        context.beginPath();

        context.moveTo(-3, 0);

        context.bezierCurveTo(-40, -10, -60, 20, -30, 40);

        context.bezierCurveTo(-20, 50, -10, 50, -3, -5);

        context.closePath();

        context.fill();
        context.stroke();

        context.restore();

        // Top wing
        context.save();

        context.scale(0.8 + 0.2 * Math.cos(butterfly.theta), 1);

        context.beginPath();

        context.moveTo(-3, -5);

        context.bezierCurveTo(-25, -60, -75, -55, -65, -35);

        context.bezierCurveTo(-55, -10, -65, 5, -3, 0);

        context.closePath();

        context.fill();
        context.stroke();

        context.restore();

        // Antenna
        context.lineWidth = 2;

        context.strokeStyle = "hsl(104, 42%, 80%)";

        context.beginPath();

        context.moveTo(-2, -10);

        context.bezierCurveTo(
          -5,
          -20,
          -3 - Math.sin(butterfly.theta),
          -30,
          -8 - Math.sin(butterfly.theta),
          -40,
        );

        context.stroke();

        context.restore();
      }

      // Butterfly body
      context.save();

      const bodyGradient = context.createLinearGradient(-3, 0, 3, 0);

      bodyGradient.addColorStop(0, "hsl(104, 42%, 40%)");

      bodyGradient.addColorStop(0.5, "hsl(104, 42%, 60%)");

      bodyGradient.addColorStop(1, "hsl(104, 42%, 40%)");

      context.fillStyle = bodyGradient;

      // Head
      context.beginPath();

      context.moveTo(0, -10);

      context.arc(0, -10, 3, 0, Math.PI * 2, false);

      context.fill();

      // Body
      context.beginPath();

      context.moveTo(3, -8);

      context.arc(0, -8, 3, 0, Math.PI, false);

      context.stroke();

      context.arcTo(0, 60, 3, -8, 2);

      context.fill();

      context.restore();

      context.restore();

      // Animate butterfly
      butterfly.theta += DELTA_THETA;
      butterfly.theta %= Math.PI * 4;

      butterfly.phi += DELTA_PHI;
      butterfly.phi %= Math.PI * 2;

      butterfly.x += butterfly.vx;
      butterfly.y += butterfly.vy;

      // Stay inside the left strip
      if (butterfly.x < HALF_SPAN) {
        butterfly.x = HALF_SPAN;
        butterfly.vx = Math.abs(butterfly.vx);
      }

      if (butterfly.x > bandRight - HALF_SPAN) {
        butterfly.x = bandRight - HALF_SPAN;
        butterfly.vx = -Math.abs(butterfly.vx);
      }

      createParticles(butterfly);

      return butterfly.y >= -THRESHOLD;
    };

    const animate = () => {
      animationFrame = requestAnimationFrame(animate);

      /*
       * Dark translucent layer.
       *
       * This is what creates the fading
       * particle trail instead of clearing
       * the canvas completely every frame.
       */
      context.save();

      // context.fillStyle = "hsla(62, 9%, 83%, 0.3)";
      context.fillStyle = "hsla(0, 0%, 100%, 0.3)";

      context.fillRect(0, 0, width, height);

      context.globalCompositeOperation = "lighter";

      // Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        if (!renderParticle(particles[i])) {
          particles.splice(i, 1);
        }
      }

      context.restore();

      // Butterflies
      for (let i = butterflies.length - 1; i >= 0; i--) {
        if (!renderButterfly(butterflies[i])) {
          butterflies.splice(i, 1);
        }
      }

      // Spawn another butterfly
      if (butterflies.length === 0 || Math.random() < 0.01) {
        butterflies.push(createButterfly());
      }
    };

    resizeCanvas();

    butterflies.push(createButterfly());

    animate();

    const resizeObserver = new ResizeObserver(resizeCanvas);

    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animationFrame);

      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden bg-white">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
