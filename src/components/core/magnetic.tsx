'use client';

import React, { useRef, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

interface MagneticProps {
  children: React.ReactElement;
  intensity?: number;
  springOptions?: {
    stiffness?: number;
    damping?: number;
    mass?: number;
    bounce?: number;
  };
  actionArea?: 'global' | 'parent';
  range?: number;
  disabled?: boolean;
}

export function Magnetic({
  children,
  intensity = 0.3,
  springOptions = {},
  actionArea = 'parent',
  range = 200,
  disabled = false,
}: MagneticProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const { stiffness = 150, damping = 15, mass = 0.1, bounce = 0.2 } = springOptions;

  const x = useSpring(0, { stiffness, damping, mass, bounce });
  const y = useSpring(0, { stiffness, damping, mass, bounce });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || !ref.current) return;

    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const distanceX = e.clientX - centerX;
    const distanceY = e.clientY - centerY;
    const distance = Math.sqrt(distanceX ** 2 + distanceY ** 2);

    if (actionArea === 'parent' || distance < range) {
      x.set(distanceX * intensity);
      y.set(distanceY * intensity);
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
    setIsHovered(false);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ x, y }}
      className="inline-block"
    >
      {children}
    </motion.div>
  );
}
