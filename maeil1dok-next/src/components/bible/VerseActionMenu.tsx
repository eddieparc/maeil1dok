'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

type CopyType = 'includeLocation' | 'numOnly' | 'textOnly' | 'includeLocationRange' | 'excludeLocationRange'

interface VerseActionMenuProps {
  mode: 'copy' | 'action'
  position?: { x: number; y: number }
  isRange?: boolean
  isHighlighted?: boolean
  onCopyTypeSelect?: (type: CopyType) => void
  onHighlight?: () => void
  onRemoveHighlight?: () => void
  onCopy?: () => void
  onShare?: () => void
  onClose: () => void
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

function PenIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.855z" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" x2="12" y1="2" y2="15" />
    </svg>
  )
}

function getPosition(position?: { x: number; y: number }): React.CSSProperties {
  if (!position) {
    return { top: 120, left: '50%', transform: 'translateX(-50%)' }
  }

  const top = Math.max(position.y - 56, 12)
  return {
    top,
    left: '50%',
    transform: 'translateX(-50%)',
  }
}

export function VerseActionMenu({
  mode,
  position,
  isRange,
  isHighlighted,
  onCopyTypeSelect,
  onHighlight,
  onRemoveHighlight,
  onCopy,
  onShare,
  onClose,
}: VerseActionMenuProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setIsVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  if (typeof window === 'undefined') {
    return null
  }

  return createPortal(
    <div
      data-testid="verse-action-menu"
      className={`${mode === 'copy' ? 'copy-menu' : 'verse-action-menu'} ${isVisible ? 'menu-visible' : ''}`}
      style={getPosition(position)}
    >
      {mode === 'copy' ? (
        <>
          <span className="copy-menu-label">{isRange ? '구간 복사' : '복사'}</span>
          <div className="copy-menu-buttons">
            {isRange ? (
              <>
                <button className="copy-button" type="button" onClick={() => onCopyTypeSelect?.('includeLocationRange')}>위치 포함</button>
                <span className="action-divider">|</span>
                <button className="copy-button" type="button" onClick={() => onCopyTypeSelect?.('excludeLocationRange')}>절 번호만</button>
              </>
            ) : (
              <>
                <button className="copy-button" type="button" onClick={() => onCopyTypeSelect?.('includeLocation')}>위치 포함</button>
                <span className="action-divider">|</span>
                <button className="copy-button" type="button" onClick={() => onCopyTypeSelect?.('numOnly')}>절 번호만</button>
                <span className="action-divider">|</span>
                <button className="copy-button" type="button" onClick={() => onCopyTypeSelect?.('textOnly')}>내용만</button>
              </>
            )}
            <button className="copy-button cancel" type="button" onClick={onClose} aria-label="닫기">
              <XIcon />
            </button>
          </div>
        </>
      ) : (
        <>
          <button type="button" className="action-button" onClick={isHighlighted ? onRemoveHighlight : onHighlight}>
            <PenIcon />
            <span>{isHighlighted ? '제거' : '하이라이트'}</span>
          </button>
          <button type="button" className="action-button" onClick={onCopy}>
            <CopyIcon />
            <span>복사</span>
          </button>
          <button type="button" className="action-button" onClick={onShare}>
            <ShareIcon />
            <span>공유</span>
          </button>
          <button type="button" className="action-button close" onClick={onClose} aria-label="닫기">
            <XIcon />
          </button>
        </>
      )}
    </div>,
    document.body
  )
}
