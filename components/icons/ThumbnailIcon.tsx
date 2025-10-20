
import React from 'react';

interface ThumbnailIconProps {
  className?: string;
}

const ThumbnailIcon: React.FC<ThumbnailIconProps> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className || "h-8 w-8 mb-2 text-cyan-400"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6.75h-7.5a2.25 2.25 0 00-2.25 2.25v7.5a2.25 2.25 0 002.25 2.25h7.5a2.25 2.25 0 002.25-2.25v-7.5a2.25 2.25 0 00-2.25-2.25z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25l1.06 2.164 2.38 .346-1.72 1.678.406 2.37-2.126-1.118-2.126 1.118.406-2.37-1.72-1.678 2.38-.346L12 8.25z" />
    </svg>
);

export default ThumbnailIcon;
