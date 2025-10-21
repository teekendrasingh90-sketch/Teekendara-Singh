import React, { useRef, useEffect } from 'react';

// NEW: Add sessionState to props
interface ParticleRingProps {
  isActive: boolean;
  micVolume: number;
  sessionState: 'inactive' | 'initializing' | 'listening' | 'speaking';
}

// FIX: Define the Particle type to resolve the "Cannot find name 'Particle'" error.
// The class implementation remains inside useEffect to capture variables from its scope.
type Particle = {
    theta: number;
    y_offset: number;
    radius: number;
    x: number;
    y: number;
    z: number;
    projectedScale: number;
    projectedX: number;
    projectedY: number;
    update(state: {
        rotation: number;
        time: number;
        micVolume: number;
        sessionState: 'inactive' | 'initializing' | 'listening' | 'speaking';
    }): void;
    project(canvasWidth: number, canvasHeight: number): void;
    draw(ctx: CanvasRenderingContext2D, isDarkMode: boolean): void;
};

const ParticleRing: React.FC<ParticleRingProps> = ({ isActive, micVolume, sessionState }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationStateRef = useRef({
    micVolume: micVolume,
    sessionState: sessionState,
    isActive: isActive,
    particles: [] as Particle[],
    rotation: 0,
    time: 0,
  });

  // Keep the ref updated with the latest prop values for use in the animation loop
  useEffect(() => {
    animationStateRef.current.micVolume = micVolume;
    animationStateRef.current.sessionState = sessionState;
    animationStateRef.current.isActive = isActive;
  }, [micVolume, sessionState, isActive]);


  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const numParticles = 300;
    const baseRingRadius = window.innerWidth > 768 ? 120 : 80;
    let perspective = 0; // Will be set on resize

    class Particle {
      theta: number; // Angle on the circle
      y_offset: number; // Y offset for wave effect
      radius: number;
      
      x: number = 0;
      y: number = 0;
      z: number = 0;

      projectedScale: number = 1;
      projectedX: number = 0;
      projectedY: number = 0;

      constructor(theta: number) {
        this.theta = theta;
        this.y_offset = Math.random() * 10 - 5;
        this.radius = Math.random() * 1.5 + 0.5;
      }

      update(state: typeof animationStateRef.current) {
        const { rotation, time, micVolume, sessionState } = state;

        // Base circular motion
        this.x = baseRingRadius * Math.cos(this.theta + rotation);
        this.z = baseRingRadius * Math.sin(this.theta + rotation);

        // Add dynamic vertical wave motion
        const waveFrequency = 4;
        const waveAmplitude = 20;
        let dynamicAmplitude = 0;

        if (sessionState === 'speaking') {
            // Rhythmic pulse for speaking
            dynamicAmplitude = (Math.sin(time * 5 + this.theta * 2) + 1) * 8;
        } else if (sessionState === 'listening') {
            // Sharp reaction to mic volume
            dynamicAmplitude = micVolume * 80 * (Math.sin(time * 20 + this.theta * 5) + 1);
        } else { // inactive or initializing
            // Slow, gentle breathing
            dynamicAmplitude = (Math.sin(time * 0.8 + this.theta) + 1) * 4;
        }

        this.y = Math.sin(this.theta * waveFrequency + time) * waveAmplitude + this.y_offset + dynamicAmplitude;
      }

      project(canvasWidth: number, canvasHeight: number) {
        this.projectedScale = perspective / (perspective + this.z);
        this.projectedX = this.x * this.projectedScale + canvasWidth / 2;
        this.projectedY = this.y * this.projectedScale + canvasHeight / 2;
      }

      draw(ctx: CanvasRenderingContext2D, isDarkMode: boolean) {
        this.project(canvas.width, canvas.height);
        
        if (this.projectedX < 0 || this.projectedX > canvas.width || this.projectedY < 0 || this.projectedY > canvas.height) {
            return;
        }
        
        const alpha = Math.max(0, this.projectedScale * 0.8);
        const radius = this.radius * this.projectedScale;
        
        ctx.beginPath();
        if (isDarkMode) {
            const hue = 180 + this.y * 2; // Color changes with vertical position
            ctx.fillStyle = `hsla(${hue}, 80%, 70%, ${alpha})`;
            ctx.shadowColor = `hsla(${hue}, 80%, 70%, 0.5)`;
            ctx.shadowBlur = 4;
        } else {
            ctx.fillStyle = `rgba(100, 116, 139, ${alpha * 0.7})`;
        }
        
        ctx.arc(this.projectedX, this.projectedY, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    const init = () => {
      animationStateRef.current.particles = [];
      for (let i = 0; i < numParticles; i++) {
        animationStateRef.current.particles.push(new Particle((i / numParticles) * Math.PI * 2));
      }
    };

    const animate = (timestamp: number) => {
        if (!ctx || !canvas) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const state = animationStateRef.current;
        const isDarkMode = document.documentElement.classList.contains('dark');

        // Update time and rotation
        state.time = timestamp * 0.001;
        const rotationSpeed = state.isActive ? 0.001 + state.micVolume * 0.005 : 0.0005;
        state.rotation -= rotationSpeed;

        // Sort particles by Z for 3D effect
        state.particles.sort((a, b) => b.z - a.z);

        // Update and draw each particle
        state.particles.forEach(p => {
            p.update(state);
            p.draw(ctx, isDarkMode);
        });

        // Reset shadow for other UI elements
        ctx.shadowBlur = 0;

        animationFrameId = requestAnimationFrame(animate);
    };

    const handleResize = () => {
        if (canvas && canvas.parentElement) {
            canvas.width = canvas.parentElement.offsetWidth;
            canvas.height = canvas.parentElement.offsetHeight;
            perspective = canvas.width * 0.8;
            init(); // Re-initialize on resize to adapt
        }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize();
    
    // Start animation
    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []); // Empty dependency array to run effect only once on mount

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
};

export default ParticleRing;