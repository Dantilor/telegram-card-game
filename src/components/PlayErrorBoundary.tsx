import { Component, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { isChunkLoadError, recoverMissingGameChunk } from '../lib/chunkRecovery'

type Props = { children: ReactNode }
type State = { hasError: boolean; chunkError: boolean }

/** Handles lazy-route failures without leaving a blank Telegram Mini App. */
export class PlayErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, chunkError: false }

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, chunkError: isChunkLoadError(error) }
  }

  componentDidCatch(error: unknown): void {
    if (isChunkLoadError(error)) {
      recoverMissingGameChunk()
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="play-page" style={{ padding: '1rem', minHeight: '40vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
          <p className="play-page__message">
            {this.state.chunkError
              ? 'Приложение обновилось. Перезапустите игру, чтобы загрузить новые файлы.'
              : 'Не удалось загрузить игру.'}
          </p>
          <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
            Обновить приложение
          </button>
          <Link to="/games" className="btn btn--primary" onClick={() => this.setState({ hasError: false, chunkError: false })}>
            Назад к играм
          </Link>
        </div>
      )
    }
    return this.props.children
  }
}
