import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { useCustomDecks } from '../hooks/useCustomDecks'
import { useBack } from '../hooks/useBack'
import { haptic } from '../utils/telegram'
import HomeButton from '../components/HomeButton'
import './CustomDeckEditor.css'

function CustomDeckEditor() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const { getDeck, addDeck, updateDeck } = useCustomDecks()
  const isNew = location.pathname === '/decks/custom/new'
  const editId = !isNew && id ? id : null
  const existingDeck = editId ? getDeck(editId) : null

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [questions, setQuestions] = useState<string[]>([])
  const [newQuestion, setNewQuestion] = useState('')

  useEffect(() => {
    if (existingDeck) {
      setTitle(existingDeck.title)
      setDescription(existingDeck.description ?? '')
      setQuestions(existingDeck.questions ?? [])
    }
  }, [existingDeck])

  const handleBack = useBack('/favorites')

  const addQuestion = () => {
    haptic('light')
    const q = newQuestion.trim()
    if (!q) return
    setQuestions((prev) => [...prev, q])
    setNewQuestion('')
  }

  const removeQuestion = (index: number) => {
    haptic('light')
    setQuestions((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSave = () => {
    haptic('light')
    const t = title.trim()
    if (!t) return
    if (isNew) {
      addDeck({
        title: t,
        description: description.trim() || undefined,
        questions,
      })
      navigate('/favorites')
    } else if (editId) {
      updateDeck(editId, {
        title: t,
        description: description.trim() || undefined,
        questions,
      })
      navigate('/favorites')
    }
  }

  return (
    <div className="custom-editor-page">
      <div className="custom-editor-page__top">
        <HomeButton />
        <button type="button" className="btn btn--ghost custom-editor-page__back" onClick={handleBack}>
          ← Назад
        </button>
      </div>
      <h1 className="custom-editor-page__title">
        {isNew ? 'Новая колода' : 'Редактировать колоду'}
      </h1>
      <div className="custom-editor-page__form card">
        <label className="custom-editor-page__label">
          Название
          <input
            type="text"
            className="custom-editor-page__input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Название колоды"
          />
        </label>
        <label className="custom-editor-page__label">
          Описание (необязательно)
          <input
            type="text"
            className="custom-editor-page__input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Краткое описание"
          />
        </label>
        <div className="custom-editor-page__questions">
          <h2 className="custom-editor-page__subtitle">Вопросы ({questions.length})</h2>
          <div className="custom-editor-page__add">
            <input
              type="text"
              className="custom-editor-page__input"
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addQuestion())}
              placeholder="Новый вопрос"
            />
            <button type="button" className="btn btn--secondary" onClick={addQuestion}>
              Добавить
            </button>
          </div>
          <ul className="custom-editor-page__list">
            {questions.map((q, i) => (
              <li key={i} className="custom-editor-page__list-item">
                <span className="custom-editor-page__list-text">{q}</span>
                <button
                  type="button"
                  className="btn btn--ghost custom-editor-page__list-remove"
                  onClick={() => removeQuestion(i)}
                  aria-label="Удалить"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          {questions.length === 0 && (
            <p className="custom-editor-page__empty">Добавьте хотя бы один вопрос</p>
          )}
        </div>
        <div className="custom-editor-page__actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleSave}
            disabled={!title.trim() || questions.length === 0}
          >
            Сохранить
          </button>
          <Link to="/favorites" className="btn btn--ghost" onClick={() => haptic('light')}>
            Отмена
          </Link>
        </div>
      </div>
    </div>
  )
}

export default CustomDeckEditor
