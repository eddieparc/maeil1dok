'use client'

export function useConfetti() {
  const colors = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#a855f7', '#f472b6']

  const fireConfetti = () => {
    if (typeof document === 'undefined') {
      return
    }

    const container = document.createElement('div')
    container.className = 'confetti-container'
    container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 9999;
      overflow: hidden;
    `
    document.body.appendChild(container)

    for (let i = 0; i < 60; i += 1) {
      const confetti = document.createElement('div')
      const color = colors[Math.floor(Math.random() * colors.length)]
      const size = Math.random() * 10 + 5
      const left = Math.random() * 100
      const delay = Math.random() * 0.8
      const duration = Math.random() * 2 + 2

      confetti.style.cssText = `
        position: absolute;
        top: -20px;
        left: ${left}%;
        width: ${size}px;
        height: ${size}px;
        background-color: ${color};
        border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
        animation: confetti-fall ${duration}s ease-in ${delay}s forwards;
        transform: rotate(${Math.random() * 360}deg);
      `
      container.appendChild(confetti)
    }

    if (!document.getElementById('confetti-keyframes')) {
      const style = document.createElement('style')
      style.id = 'confetti-keyframes'
      style.textContent = `
        @keyframes confetti-fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
      `
      document.head.appendChild(style)
    }

    window.setTimeout(() => {
      container.remove()
    }, 4000)
  }

  return { fireConfetti }
}
