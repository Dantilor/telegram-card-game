import { Outlet } from 'react-router-dom'
import { QuizGameProvider } from '../games/quiz/QuizGameContext'

export default function QuizLayout() {
  return (
    <QuizGameProvider>
      <Outlet />
    </QuizGameProvider>
  )
}
