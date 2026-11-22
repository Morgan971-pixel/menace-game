import { inspector } from '../state/inspector'

/** Opens the box inspector at box 1: the keyboard way in (arrow keys then move through the cabinet). */
export function InspectButton() {
  return (
    <button className="btn btn--small" onClick={() => inspector.getState().open(0)} aria-haspopup="dialog">
      Inspect boxes
    </button>
  )
}
