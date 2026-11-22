// Last line of defence: if anything in the app throws while rendering, show a paper panel
// instead of a white page, with a button that clears the save so a bad save can never brick the game.
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { clearSave } from '../state/persist'

interface State {
  failed: boolean
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('MENACE crashed:', error, info.componentStack)
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children
    return (
      <main className="crash">
        <section className="card crash__card" role="alert">
          <h2>Something went wrong</h2>
          <p>MENACE tripped over something. Clearing its memory and starting again will fix it.</p>
          <button
            className="btn btn--primary"
            onClick={() => {
              clearSave()
              window.location.reload()
            }}
          >
            Reset memory and reload
          </button>
        </section>
      </main>
    )
  }
}
