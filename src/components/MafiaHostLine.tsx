import { hostLabel } from '../games/mafia/hostScript'
import './MafiaHostLine.css'

type Props = {
  hostName: string
  children: React.ReactNode
}

/** Реплика ведущего — читается вслух за столом. */
export default function MafiaHostLine({ hostName, children }: Props) {
  return (
    <div className="mafia-host-line">
      <span className="mafia-host-line__badge">🎙 {hostLabel(hostName)}</span>
      <p className="mafia-host-line__text">{children}</p>
    </div>
  )
}
