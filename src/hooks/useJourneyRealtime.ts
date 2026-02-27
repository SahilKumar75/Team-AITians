/**
 * useJourneyRealtime Hook
 * Provides real-time updates for patient journey tracking
 */

import { useEffect, useState, useCallback } from 'react'
import { 
  subscribeToJourney, 
  subscribeToJourneyStatus,
  RealtimePayload 
} from '@/lib/journey-realtime'

interface JourneyCheckpoint {
  id: string
  status: string
  queuePosition?: number
  estimatedWaitMinutes?: number
  departmentId: string
  [key: string]: any
}

interface Journey {
  id: string
  status: string
  progressPercent: number
  currentCheckpointId?: string
  [key: string]: any
}

interface UseJourneyRealtimeOptions {
  onCheckpointUpdate?: (checkpoint: JourneyCheckpoint) => void
  onStatusUpdate?: (journey: Journey) => void
  onError?: (error: Error) => void
  enabled?: boolean
}

export function useJourneyRealtime(
  journeyId: string | undefined | null,
  options: UseJourneyRealtimeOptions = {}
) {
  const [isConnected, setIsConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [error, setError] = useState<Error | null>(null)

  const {
    onCheckpointUpdate,
    onStatusUpdate,
    onError,
    enabled = true
  } = options

  // Handle checkpoint updates
  const handleCheckpointChange = useCallback((payload: RealtimePayload) => {
    try {
      setLastUpdate(new Date())
      
      if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
        const checkpoint = payload.new as JourneyCheckpoint
        onCheckpointUpdate?.(checkpoint)
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Checkpoint update failed')
      setError(error)
      onError?.(error)
    }
  }, [onCheckpointUpdate, onError])

  // Handle journey status updates
  const handleStatusChange = useCallback((payload: RealtimePayload) => {
    try {
      setLastUpdate(new Date())
      
      if (payload.eventType === 'UPDATE') {
        const journey = payload.new as Journey
        onStatusUpdate?.(journey)
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Status update failed')
      setError(error)
      onError?.(error)
    }
  }, [onStatusUpdate, onError])

  useEffect(() => {
    if (!journeyId || !enabled) {
      setIsConnected(false)
      return
    }

    setIsConnected(true)
    setError(null)

    // Subscribe to checkpoint changes
    const unsubscribeCheckpoints = subscribeToJourney(
      journeyId,
      handleCheckpointChange
    )

    // Subscribe to journey status changes
    const unsubscribeStatus = subscribeToJourneyStatus(
      journeyId,
      handleStatusChange
    )

    // Cleanup on unmount
    return () => {
      unsubscribeCheckpoints()
      unsubscribeStatus()
      setIsConnected(false)
    }
  }, [journeyId, enabled, handleCheckpointChange, handleStatusChange])

  return {
    isConnected,
    lastUpdate,
    error
  }
}

/**
 * useHospitalQueue Hook
 * For hospital admin dashboard - monitors all active journeys
 */
export function useHospitalQueue(hospitalId: string | undefined | null) {
  const [activeJourneys, setActiveJourneys] = useState<Journey[]>([])
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    if (!hospitalId) return

    setIsConnected(true)

    // TODO: Implement hospital-wide journey subscription when realtime transport is added.

    return () => {
      setIsConnected(false)
    }
  }, [hospitalId])

  return {
    activeJourneys,
    isConnected
  }
}
