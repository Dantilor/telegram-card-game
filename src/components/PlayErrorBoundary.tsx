import { Component, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

type Props = { children: ReactNode }
type State = { hasError: boolean }

export class PlayErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="play-page" style={{ padding: '1rem', minHeight: '40vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
          <p className="play-page__message">Не удалось загрузить игру.</p>
          <Link to="/games" className="btn btn--primary">
            Назад
          </Link>
        </div>
      )
    }
    return this.props.children
  }
}
