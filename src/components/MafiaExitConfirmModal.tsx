import GameExitConfirmModal from './GameExitConfirmModal'

type Props = {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function MafiaExitConfirmModal({ isOpen, onConfirm, onCancel }: Props) {
  if (!isOpen) return null

  return (
    <GameExitConfirmModal
      hint="Текущий прогресс сбросится — роли, ночь и голосование начнутся заново. Вы вернётесь к экрану выбора участников."
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  )
}
