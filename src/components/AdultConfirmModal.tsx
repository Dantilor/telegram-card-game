import { useState } from 'react'
import { createPortal } from 'react-dom'
import DocumentModal from './DocumentModal'
import { haptic } from '../utils/telegram'
import './AdultConfirmModal.css'

type Props = {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function AdultConfirmModal({ isOpen, onConfirm, onCancel }: Props) {
  const [policyOpen, setPolicyOpen] = useState(false)
  if (!isOpen) return null

  const handleConfirm = () => {
    haptic('light')
    onConfirm()
  }

  const handleCancel = () => {
    haptic('light')
    onCancel()
  }

  return createPortal(
    <div
      className="adult-confirm-overlay"
      onClick={handleCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="adult-confirm-title"
    >
      <div className="adult-confirm-modal" onClick={(e) => e.stopPropagation()}>
        <p id="adult-confirm-title" className="adult-confirm__text">
          Мне 18+
        </p>
        <p className="adult-confirm__hint">Подтвердите возраст для доступа к этой категории</p>
        <button
          type="button"
          className="adult-confirm__policy"
          onClick={() => {
            haptic('light')
            setPolicyOpen(true)
          }}
        >
          Политика доступа к категориям 18+
        </button>
        <div className="adult-confirm__buttons">
          <button type="button" className="adult-confirm__btn adult-confirm__btn--secondary" onClick={handleCancel}>
            Отмена
          </button>
          <button type="button" className="adult-confirm__btn adult-confirm__btn--primary" onClick={handleConfirm}>
            Да, мне 18+
          </button>
        </div>
      </div>
      <DocumentModal isOpen={policyOpen} onClose={() => setPolicyOpen(false)} documentType="adultPolicy" />
    </div>,
    document.body
  )
}
