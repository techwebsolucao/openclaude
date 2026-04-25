/**
 * Synchronous state machine for the query lifecycle, compatible with
 * React's `useSyncExternalStore`.
 *
 * Three states (+1 transitional):
 *   idle        → no query, safe to dequeue and process
 *   dispatching → an item was dequeued, async chain hasn't reached onQuery yet
 *   running     → onQuery called tryStart(), query is executing
 *   settling    → query ended, post-turn work in progress (context status, etc.)
 *
 * Transitions:
 *   idle → dispatching  (reserve)
 *   dispatching → running  (tryStart)
 *   idle → running  (tryStart, for direct user submissions)
 *   running → idle  (end / forceEnd)
 *   running → settling  (endAndSettle)
 *   settling → idle  (completeSettle)
 *   dispatching → idle  (cancelReservation, when processQueueIfReady fails)
 *
 * `isActive` returns true for both dispatching and running, preventing
 * re-entry from the queue processor during the async gap.
 *
 * Usage with React:
 *   const queryGuard = useRef(new QueryGuard()).current
 *   const isQueryActive = useSyncExternalStore(
 *     queryGuard.subscribe,
 *     queryGuard.getSnapshot,
 *   )
 */
import { createSignal } from './signal.js'

export class QueryGuard {
  private _status: 'idle' | 'dispatching' | 'running' | 'settling' = 'idle'
  private _generation = 0
  private _changed = createSignal()

  /**
   * Reserve the guard for queue processing. Transitions idle → dispatching.
   * Returns false if not idle (another query or dispatch in progress).
   */
  reserve(): boolean {
    if (this._status !== 'idle') return false
    this._status = 'dispatching'
    this._notify()
    return true
  }

  /**
   * Cancel a reservation when processQueueIfReady had nothing to process.
   * Transitions dispatching → idle.
   */
  cancelReservation(): void {
    if (this._status !== 'dispatching') return
    this._status = 'idle'
    this._notify()
  }

  /**
   * Start a query. Returns the generation number on success,
   * or null if a query is already running (concurrent guard).
   * Accepts transitions from both idle (direct user submit)
   * and dispatching (queue processor path).
   */
  tryStart(): number | null {
    if (this._status === 'running') return null
    this._status = 'running'
    ++this._generation
    this._notify()
    return this._generation
  }

  /**
   * End a query and enter settling phase. Returns true if this generation
   * is still current (caller should perform post-turn cleanup). The guard
   * stays active (isActive=true) so the queue processor won't fire until
   * completeSettle() is called.
   */
  endAndSettle(generation: number): boolean {
    if (this._generation !== generation) return false
    if (this._status !== 'running') return false
    this._status = 'settling'
    // Intentionally do NOT notify — isActive is still true,
    // so subscribers see no change yet.
    return true
  }

  /**
   * Finish the settling phase, transitioning to idle.
   * This triggers subscriber notifications, allowing the queue processor
   * to run AFTER all post-turn work is complete.
   */
  completeSettle(): void {
    if (this._status !== 'settling') return
    this._status = 'idle'
    this._notify()
  }

  /**
   * End a query. Returns true if this generation is still current
   * (meaning the caller should perform cleanup). Returns false if a
   * newer query has started (stale finally block from a cancelled query).
   */
  end(generation: number): boolean {
    if (this._generation !== generation) return false
    if (this._status !== 'running') return false
    this._status = 'idle'
    this._notify()
    return true
  }

  /**
   * Force-end the current query regardless of generation.
   * Used by onCancel where any running query should be terminated.
   * Increments generation so stale finally blocks from the cancelled
   * query's promise rejection will see a mismatch and skip cleanup.
   */
  forceEnd(): void {
    if (this._status === 'idle') return
    this._status = 'idle'
    ++this._generation
    this._notify()
  }

  /**
   * Is the guard active (dispatching, running, or settling)?
   * Always synchronous — not subject to React state batching delays.
   */
  get isActive(): boolean {
    return this._status !== 'idle'
  }

  get generation(): number {
    return this._generation
  }

  // --
  // useSyncExternalStore interface

  /** Subscribe to state changes. Stable reference — safe as useEffect dep. */
  subscribe = this._changed.subscribe

  /** Snapshot for useSyncExternalStore. Returns current status. */
  getSnapshot = (): 'idle' | 'dispatching' | 'running' | 'settling' => {
    return this._status
  }

  private _notify(): void {
    this._changed.emit()
  }
}
