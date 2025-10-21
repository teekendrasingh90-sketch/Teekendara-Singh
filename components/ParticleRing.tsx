import React, { useRef, useEffect } from 'react';

interface ParticleRingProps {
  isActive: boolean;
  micVolume: number;
  sessionState: 'inactive' | 'initializing' | 'listening' | 'speaking';
}

// Re-purposing ParticleRing component for a new "Aurora Core" animation
const ParticleRing: React.FC<ParticleRingProps> = ({ isActive, micVolume, sessionState }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationStateRef = useRef({
    micVolume: micVolume,
    smoothedMicVolume: 0, // Added for fluid animation
    sessionState: sessionState,
    isActive: isActive,
    time: 0,
    waves: [] as any[], // Using 'any' for the simple wave objects
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

    const createWaves = (isDarkMode: boolean) => {
        const waveCount = 5;
        const newWaves = [];
        for (let i = 0; i < waveCount; i++) {
            newWaves.push({
                // Wave properties
                amplitude: 15 + Math.random() * 20,
                frequency: 0.01 + Math.random() * 0.01,
                speed: 0.005 + Math.random() * 0.005,
                offset: Math.random() * 100,
                noise: Math.random() * 0.1 + 0.95,
                lineWidth: Math.random() * 1.5 + 0.5,
                // Color based on theme
                color: isDarkMode
                    ? `hsla(${180 + i * 30 + Math.random() * 20}, 80%, 70%, ${0.3 + Math.random() * 0.3})`
                    : `hsla(220, 50%, 60%, ${0.1 + Math.random() * 0.1})`,
            });
        }
        animationStateRef.current.waves = newWaves;
    }

    const animate = (timestamp: number) => {
        if (!ctx || !canvas) return;
        
        const state = animationStateRef.current;
        const width = canvas.width;
        const height = canvas.height;
        const centerX = width / 2;
        const centerY = height / 2;
        const baseRadius = Math.min(width, height) * 0.2;

        ctx.clearRect(0, 0, width, height);

        // Update time
        state.time = timestamp * 0.001;
        const isDarkMode = document.documentElement.classList.contains('dark');
        
        // --- Smooth the mic volume for a more fluid visual response ---
        const LERP_FACTOR = 0.1; // Easing factor: lower is smoother
        state.smoothedMicVolume += (state.micVolume - state.smoothedMicVolume) * LERP_FACTOR;

        // --- State-based behavior ---
        let corePulse = Math.sin(state.time * 2) * 5;
        let activityLevel = 0.1; // Base activity for idle state

        if (state.sessionState === 'listening') {
            // Use the smoothed value to prevent jerky movements
            activityLevel = 0.1 + state.smoothedMicVolume * 2.5;
            corePulse = state.smoothedMicVolume * 40;
        } else if (state.sessionState === 'speaking') {
            activityLevel = 0.5 + (Math.sin(state.time * 8) + 1) / 2 * 0.6; // Rhythmic pulse
            corePulse = 10 + (Math.sin(state.time * 8) + 1) * 10;
        } else if (state.sessionState === 'initializing') {
            activityLevel = 1.5; // Quick burst
            corePulse = 30;
        }

        // Draw Central Core
        const coreGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, baseRadius + corePulse);
        if (isDarkMode) {
            coreGradient.addColorStop(0, `hsla(180, 80%, 90%, 0.6)`);
            coreGradient.addColorStop(0.5, `hsla(190, 80%, 70%, 0.3)`);
            coreGradient.addColorStop(1, `hsla(220, 80%, 60%, 0)`);
            ctx.shadowColor = 'hsla(190, 100%, 80%, 0.8)';
            ctx.shadowBlur = 20;
        } else {
            coreGradient.addColorStop(0, 'rgba(100, 116, 139, 0.4)');
            coreGradient.addColorStop(1, 'rgba(148, 163, 184, 0)');
            ctx.shadowBlur = 0;
        }

        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius + corePulse, 0, Math.PI * 2);
        ctx.fillStyle = coreGradient;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Draw Waves
        if (isDarkMode) {
            // Use 'lighter' for glowing effect in dark mode
            ctx.globalCompositeOperation = 'lighter';
        }

        state.waves.forEach(wave => {
            ctx.beginPath();
            ctx.strokeStyle = wave.color;
            ctx.lineWidth = wave.lineWidth * (1 + activityLevel * 0.5);
            
            for (let angle = 0; angle < Math.PI * 2; angle += 0.05) {
                const xoff = Math.cos(angle) * wave.noise + state.time * 0.1;
                const yoff = Math.sin(angle) * wave.noise + state.time * 0.1;

                // A simple noise function might be too complex, let's use sin waves for pseudo-randomness
                const noiseFactor = Math.sin(xoff * 5) + Math.sin(yoff * 3);

                const r = baseRadius + wave.amplitude * activityLevel + noiseFactor * 15 * activityLevel;
                const x = centerX + r * Math.cos(angle + state.time * wave.speed + wave.offset);
                const y = centerY + r * Math.sin(angle + state.time * wave.speed + wave.offset);

                if (angle === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.closePath();
            ctx.stroke();
        });
        
        ctx.globalCompositeOperation = 'source-over'; // Reset composite operation

        animationFrameId = requestAnimationFrame(animate);
    };

    const handleResize = () => {
        if (canvas && canvas.parentElement) {
            canvas.width = canvas.parentElement.offsetWidth;
            canvas.height = canvas.parentElement.offsetHeight;
            const isDarkMode = document.documentElement.classList.contains('dark');
            createWaves(isDarkMode); // Re-create waves with potentially new colors on resize/theme change
        }
    };
    
    // Also handle theme changes
    const observer = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                handleResize();
            }
        }
    });

    observer.observe(document.documentElement, { attributes: true });

    window.addEventListener('resize', handleResize);
    handleResize();
    
    // Start animation
    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
    };
  }, []); // Empty dependency array to run effect only once on mount

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
};

export default ParticleRing;