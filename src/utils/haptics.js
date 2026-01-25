/**
 * Haptic feedback для touch-устройств (Phase 6.3)
 * Использует Vibration API, если доступна.
 *
 * Использование:
 *   import { haptics } from '../utils/haptics'
 *
 *   <TouchButton onClick={() => {
 *     haptics.light()
 *     handleClick()
 *   }}>
 *     Нажми меня
 *   </TouchButton>
 */
export const haptics = {
  /** Лёгкая вибрация (~10 ms) — тап, переключатель */
  light() {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(10)
    }
  },

  /** Средняя вибрация (~20 ms) — кнопка, выбор */
  medium() {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(20)
    }
  },

  /** Сильная вибрация (~30 ms) — важное действие */
  heavy() {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(30)
    }
  },

  /** Успех — короткий паттерн (подтверждение) */
  success() {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([10, 50, 10])
    }
  },

  /** Ошибка — более выраженный паттерн */
  error() {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([30, 100, 30])
    }
  },
}
