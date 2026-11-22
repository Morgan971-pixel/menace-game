import { useEffect, useRef } from 'react'
import { pushEscape } from './escapeStack'

/**
 * Handles Escape for as long as `active`, but only while this is the newest open layer.
 * The handler is read through a ref, so a new function each render does not move the layer.
 */
export function useEscape(handler: () => void, active = true): void {
  const latest = useRef(handler)
  useEffect(() => {
    latest.current = handler
  })
  useEffect(() => {
    if (!active) return
    return pushEscape(() => latest.current())
  }, [active])
}
