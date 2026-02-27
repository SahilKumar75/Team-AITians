"use client"

import * as React from "react"
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion"

interface CardFlipProps {
  className?: string
  width?: string
  height?: string
  children: React.ReactNode
}

export function CardFlip({ 
  className = "", 
  width = "100%", 
  height = "auto",
  children
}: CardFlipProps) {
  const [isFlipped, setIsFlipped] = React.useState(false)
  const [isHovering, setIsHovering] = React.useState(false)
  const hoverTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  const handleMouseEnter = () => {
    setIsHovering(true)
    
    // Clear any existing timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
    }
    
    // Flip after hovering for 500ms
    hoverTimeoutRef.current = setTimeout(() => {
      setIsFlipped(true)
    }, 500)
  }

  const handleMouseLeave = () => {
    setIsHovering(false)
    
    // Clear timeout if mouse leaves before flip
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
    }
    
    // Flip back to front
    setIsFlipped(false)
  }

  const handleClick = () => {
    // Manual toggle - cancel auto-flip behavior
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
    }
    setIsFlipped(!isFlipped)
  }

  React.useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
    }
  }, [])

  return (
    <div 
      className={`relative ${className}`} 
      style={{ 
        width, 
        height: height === "auto" ? undefined : height,
        perspective: "1000px" 
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <motion.div
        className="relative w-full h-full"
        style={{ 
          transformStyle: "preserve-3d",
          willChange: "transform"
        }}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ 
          duration: 0.6, 
          type: "spring", 
          stiffness: 100,
          damping: 20
        }}
      >
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child as React.ReactElement<any>, {
              isFlipped,
              onFlip: handleClick
            })
          }
          return child
        })}
      </motion.div>
    </div>
  )
}

interface CardFlipSideProps {
  children: React.ReactNode | ((props: { isFlipped?: boolean; onFlip?: () => void }) => React.ReactNode)
  className?: string
  isFlipped?: boolean
  onFlip?: () => void
}

export function CardFlipFront({ children, className = "", isFlipped, onFlip }: CardFlipSideProps) {
  return (
    <div
      className={`absolute inset-0 w-full h-full ${className}`}
      style={{ 
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden"
      }}
    >
      {typeof children === "function" ? children({ isFlipped, onFlip }) : children}
    </div>
  )
}

export function CardFlipBack({ children, className = "", isFlipped, onFlip }: CardFlipSideProps) {
  return (
    <div
      className={`absolute inset-0 w-full h-full ${className}`}
      style={{ 
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        transform: "rotateY(180deg)"
      }}
    >
      {typeof children === "function" ? children({ isFlipped, onFlip }) : children}
    </div>
  )
}
