// PROTOTYPE: spotlight with a fixed aim point.
import { useLayoutEffect, useRef } from 'react'
import type { SpotLight } from 'three'
import type { V3 } from './geometry'

export function Spot({ position, target, ...rest }: { position: V3; target: V3 } & Record<string, unknown>) {
  const ref = useRef<SpotLight>(null)
  useLayoutEffect(() => {
    if (!ref.current) return
    ref.current.target.position.set(...target)
    ref.current.target.updateMatrixWorld()
  }, [target])
  return <spotLight ref={ref} position={position} {...rest} />
}
