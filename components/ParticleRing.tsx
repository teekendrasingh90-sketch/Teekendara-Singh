
import React, { useRef, useEffect } from 'react';

interface ParticleRingProps {
  isActive: boolean;
  micVolume: number;
}

const ParticleRing: React.FC<ParticleRingProps> = ({ isActive, micVolume }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const micVolumeRef = useRef(micVolume);

  // Keep the ref updated with the latest prop value for use in the animation loop
  useEffect(() => {
    micVolumeRef.current = micVolume;
  }, [micVolume]);


  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];
    const numParticles = 400;
    // Reduced radius to make the animation smaller and more centered
    const baseRingRadius = window.innerWidth > 768 ? 100 : 70;
    const depth = 200;
    
    class Particle {
      theta: number;
      radius: number;
      x: number = 0;
      y: number = 0;
      z: number = 0;
      projectedScale: number = 1;
      projectedX: number = 0;
      projectedY: number = 0;

      constructor(theta: number) {
        this.theta = theta;
        this.z = (Math.random() - 0.5) * depth;
        this.radius = Math.random() * 1.5 + 0.5;
      }

      project(rotation: number, canvasWidth: number, canvasHeight: number, ringRadius: number) {
        this.x = ringRadius * Math.cos(this.theta + rotation);
        this.y = ringRadius * Math.sin(this.theta + rotation);
        
        this.projectedScale = (canvasWidth / 2) / ((canvasWidth / 2) + this.z);
        this.projectedX = this.x * this.projectedScale + canvasWidth / 2;
        this.projectedY = this.y * this.projectedScale + canvasHeight / 2;
      }

      draw(ctx: CanvasRenderingContext2D) {
        ctx.beginPath();
        const alpha = Math.max(0, (1 - this.z / (depth / 2)) * 0.5 + 0.1);
        ctx.fillStyle = `rgba(156, 163, 175, ${alpha})`;
        const radius = this.radius * this.projectedScale;
        if (radius > 0 && this.projectedX > 0 && this.projectedX < canvas.width && this.projectedY > 0 && this.projectedY < canvas.height) {
            ctx.arc(this.projectedX, this.projectedY, radius, 0, Math.PI * 2);
            ctx.fill();
        }
      }
    }
    
    const init = () => {
      particles = [];
      for (let i = 0; i < numParticles; i++) {
        particles.push(new Particle((i / numParticles) * Math.PI * 2));
      }
    };

    let rotation = 0;
    const animate = () => {
        if (!ctx || !canvas) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Use the ref to get the current mic volume inside the animation loop
        const currentMicVolume = micVolumeRef.current;
        const currentRingRadius = baseRingRadius + currentMicVolume * 60; // Expand with volume
        // Reduced rotation speed for a calmer effect
        const rotationSpeed = isActive ? 0.002 + currentMicVolume * 0.005 : 0.001;
        rotation -= rotationSpeed;

        particles.sort((a, b) => b.z - a.z);
        particles.forEach(p => {
            p.project(rotation, canvas.width, canvas.height, currentRingRadius);
            p.draw(ctx);
        });

        animationFrameId = requestAnimationFrame(animate);
    };

    const handleResize = () => {
        if (canvas && canvas.parentElement) {
            canvas.width = canvas.parentElement.offsetWidth;
            canvas.height = canvas.parentElement.offsetHeight;
        }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize();
    init();
    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [isActive]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
};

export default ParticleRing;
