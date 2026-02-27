/**
 * Journey realtime abstraction.
 * Placeholder hooks for client-only mode where no realtime backend is configured.
 */

export interface RealtimePayload {
  eventType: string;
  new: unknown;
  old: unknown;
  schema: string;
  table: string;
  commit_timestamp: string;
}

export const subscribeToJourney = (
  _journeyId: string,
  _callback: (payload: RealtimePayload) => void
) => {
  return () => {};
};

export const subscribeToJourneyStatus = (
  _journeyId: string,
  _callback: (payload: RealtimePayload) => void
) => {
  return () => {};
};

