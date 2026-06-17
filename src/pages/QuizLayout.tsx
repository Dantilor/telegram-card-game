import { Outlet } from 'react-router-dom'
import { QuizGameProvider } from '../games/quiz/QuizGameContext'
import '../styles/GamePageShell.css'

export default function QuizLayout() {
  return (
    <QuizGameProvider>
      <Outlet />
    </QuizGameProvider>
  )
}
