// One Escape closes one thing. Dialogs push a handler when they open and pop it when they close;
// a single capture listener on the document hands Escape to the newest layer only and stops it
// there, so a Machine menu opened over a training run does not also stop the run.

export interface EscapeStack {
  /** Adds a layer on top. Returns its pop function (safe to call twice). */
  push(handler: () => void): () => void
}

export function createEscapeStack(target: EventTarget): EscapeStack {
  const layers: { handler: () => void }[] = []
  const onKey = (e: Event) => {
    if ((e as KeyboardEvent).key !== 'Escape') return
    const top = layers[layers.length - 1]
    if (top === undefined) return
    e.preventDefault()
    e.stopImmediatePropagation()
    top.handler()
  }
  return {
    push(handler) {
      const layer = { handler }
      if (layers.length === 0) target.addEventListener('keydown', onKey, true)
      layers.push(layer)
      return () => {
        const i = layers.indexOf(layer)
        if (i === -1) return
        layers.splice(i, 1)
        if (layers.length === 0) target.removeEventListener('keydown', onKey, true)
      }
    },
  }
}

let shared: EscapeStack | null = null

/** The app's stack, on the document. */
export function pushEscape(handler: () => void): () => void {
  shared ??= createEscapeStack(document)
  return shared.push(handler)
}
