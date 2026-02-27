import React from 'react';

interface StarOfLifeProps {
  className?: string;
}

export const StarOfLife: React.FC<StarOfLifeProps> = ({ className }) => {
  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Emergency Medical Services Star of Life - 6 pointed asterisk */}
      
      {/* Vertical bar (top to bottom) */}
      <rect x="80" y="10" width="40" height="180" fill="currentColor" />
      
      {/* Diagonal bar (top-left to bottom-right) - rotated 60 degrees */}
      <rect
        x="80"
        y="10"
        width="40"
        height="180"
        fill="currentColor"
        transform="rotate(60 100 100)"
      />
      
      {/* Diagonal bar (top-right to bottom-left) - rotated -60 degrees */}
      <rect
        x="80"
        y="10"
        width="40"
        height="180"
        fill="currentColor"
        transform="rotate(-60 100 100)"
      />
    </svg>
  );
};
