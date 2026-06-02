'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './AnimatedBackground.module.css';

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  color: string;
}

interface FloatingObject {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  size: number;
  type: 'circle' | 'square' | 'triangle';
  color: string;
  blur: number;
}

export default function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const particlesRef = useRef<Particle[]>([]);
  const objectsRef = useRef<FloatingObject[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const timeRef = useRef(0);

  // Initialize canvas and objects
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateDimensions = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setDimensions({ width, height });
      canvas.width = width;
      canvas.height = height;
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);

    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Initialize particles and objects
  useEffect(() => {
    if (dimensions.width === 0) return;

    // Create particles
    const particles: Particle[] = [];
    for (let i = 0; i < 75; i++) {
      particles.push({
        id: i,
        x: Math.random() * dimensions.width,
        y: Math.random() * dimensions.height,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
        radius: Math.random() * 2 + 1,
        opacity: Math.random() * 0.55 + 0.25,
        color: ['#5B7EB6', '#A37FBF', '#CEB2D8', '#86B2D9'][
          Math.floor(Math.random() * 4)
        ],
      });
    }
    particlesRef.current = particles;

    // Create floating objects
    const colors = [
      'rgba(170, 154, 236, 0.24)',
      'rgba(101, 148, 177, 0.22)',
      'rgba(221, 174, 211, 0.18)',
      'rgba(205, 227, 255, 0.18)',
    ];
    const types: Array<'circle' | 'square' | 'triangle'> = [
      'circle',
      'square',
      'triangle',
    ];

    const objects: FloatingObject[] = [];
    for (let i = 0; i < 12; i++) {
      objects.push({
        id: i,
        x: Math.random() * dimensions.width,
        y: Math.random() * dimensions.height,
        vx: (Math.random() - 0.5) * 0.08,
        vy: (Math.random() - 0.5) * 0.08,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.005,
        size: Math.random() * 150 + 60,
        type: types[Math.floor(Math.random() * types.length)],
        color: colors[Math.floor(Math.random() * colors.length)],
        blur: Math.random() * 15 + 8,
      });
    }
    objectsRef.current = objects;
  }, [dimensions]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      // Clear canvas with gradient
      const gradient = ctx.createLinearGradient(0, 0, dimensions.width, dimensions.height);
      gradient.addColorStop(0, 'rgba(240, 239, 255, 1)');
      gradient.addColorStop(0.5, 'rgba(235, 244, 255, 1)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 1)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);

      // Add palette-based radial glows
      const radial1 = ctx.createRadialGradient(
        dimensions.width * 0.18,
        dimensions.height * 0.18,
        0,
        dimensions.width * 0.18,
        dimensions.height * 0.18,
        dimensions.width * 0.4
      );
      radial1.addColorStop(0, 'rgba(170, 154, 236, 0.18)');
      radial1.addColorStop(1, 'rgba(221, 174, 211, 0)');
      ctx.fillStyle = radial1;
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);

      const radial2 = ctx.createRadialGradient(
        dimensions.width * 0.75,
        dimensions.height * 0.75,
        0,
        dimensions.width * 0.75,
        dimensions.height * 0.75,
        dimensions.width * 0.46
      );
      radial2.addColorStop(0, 'rgba(101, 148, 177, 0.12)');
      radial2.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = radial2;
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);

      timeRef.current += 0.016;

      // Draw and update floating objects
      objectsRef.current.forEach((obj) => {
        // Update position
        obj.x += obj.vx;
        obj.y += obj.vy;
        obj.rotation += obj.rotationSpeed;

        // Wrap around edges
        if (obj.x > dimensions.width + obj.size)
          obj.x = -obj.size;
        if (obj.x < -obj.size) obj.x = dimensions.width + obj.size;
        if (obj.y > dimensions.height + obj.size)
          obj.y = -obj.size;
        if (obj.y < -obj.size) obj.y = dimensions.height + obj.size;

        // Draw object
        ctx.save();
        ctx.globalAlpha = 0.8;
        ctx.filter = `blur(${obj.blur}px)`;
        ctx.translate(obj.x, obj.y);
        ctx.rotate(obj.rotation);
        ctx.fillStyle = obj.color;

        const size = obj.size;
        if (obj.type === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (obj.type === 'square') {
          ctx.fillRect(-size / 2, -size / 2, size, size);
        } else if (obj.type === 'triangle') {
          ctx.beginPath();
          ctx.moveTo(0, -size / 2);
          ctx.lineTo(size / 2, size / 2);
          ctx.lineTo(-size / 2, size / 2);
          ctx.closePath();
          ctx.fill();
        }

        ctx.restore();
      });

      // Draw and update particles
      particlesRef.current.forEach((particle) => {
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Wrap around without acceleration - smooth floating
        if (particle.x > dimensions.width) particle.x = 0;
        if (particle.x < 0) particle.x = dimensions.width;
        if (particle.y > dimensions.height) {
          particle.y = 0;
          particle.x = Math.random() * dimensions.width;
        }

        // Smooth pulsing effect - stays constant, just opacity changes
        particle.opacity += (Math.random() - 0.5) * 0.005;
        particle.opacity = Math.max(0.25, Math.min(0.75, particle.opacity));

        // Draw particle with glow effect
        ctx.fillStyle = particle.color;
        ctx.globalAlpha = particle.opacity * 0.22;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius + 2, 0, Math.PI * 2);
        ctx.fill();

        // Draw core particle
        ctx.globalAlpha = particle.opacity;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw soft connecting lines
      const connectionDistance = 110;
      ctx.strokeStyle = 'rgba(101, 148, 177, 0.12)';
      ctx.lineWidth = 1;
      for (let i = 0; i < particlesRef.current.length; i += 1) {
        const p1 = particlesRef.current[i];
        for (let j = i + 1; j < particlesRef.current.length; j += 1) {
          const p2 = particlesRef.current[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < connectionDistance) {
            ctx.globalAlpha = 0.08 * (1 - distance / connectionDistance);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }

      ctx.globalAlpha = 1;
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [dimensions]);

  return (
    <div className={styles.backgroundContainer}>
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}
