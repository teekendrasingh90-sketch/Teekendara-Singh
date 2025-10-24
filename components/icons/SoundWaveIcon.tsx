
import React from 'react';

const SoundWaveIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className || "h-5 w-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10v4M7 8v8M11 5v14M15 8v8M19 10v4" />
    </svg>
);

export default SoundWaveIcon;
