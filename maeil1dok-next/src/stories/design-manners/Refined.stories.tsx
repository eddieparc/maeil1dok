import type { Meta, StoryObj } from '@storybook/nextjs-vite'

/**
 * Refined v3 — Mono Cocoa (Rounded + Semantic)
 *
 * v2 → v3 변경 (사용자 피드백 2026-05-28):
 * - 라운드 값 일괄 +2-6px (시각적 부드러움)
 * - 배지는 pill (999) 로 매우 둥글게 통일
 * - 시맨틱 컬러 4종 정의 (success / warning / danger / info) — 절제된 톤
 * - 기존 룰 유지: Pretendard + KoPub Batang, brown brand 단일, Lucide icons
 */

// ────── Color tokens ──────
const INK = '#0A0A0A'
const PAPER = '#FFFFFF'
const PAPER_WARM = '#FAFAF9'
const BRAND = '#5C3A2E'
const BRAND_DEEP = '#3D2817'
const BRAND_FAINT = '#F4EFEA'
const RULE = '#E8E5E0'
const MUTE = '#6F6B66'
const SUBTLE = '#A39E97'
const DARK_BG = '#141210'
const DARK_INK = '#FAFAF9'
const DARK_MUTE = '#9B968F'
const DARK_RULE = '#2A2622'

// ────── Semantic colors (v3 추가 — 절제된 톤, brand와 조화) ──────
const SUCCESS = '#3D6B4F'
const SUCCESS_BG = '#ECF2EE'
const SUCCESS_TEXT = '#1F3A2A'
const SUCCESS_BORDER = '#D4DFD8'
const WARNING = '#A87C3D'
const WARNING_BG = '#F7EFE0'
const WARNING_TEXT = '#5C401C'
const WARNING_BORDER = '#E8D8B8'
const DANGER = '#A8483E'
const DANGER_BG = '#F4E5E3'
const DANGER_TEXT = '#5C1F18'
const DANGER_BORDER = '#E5C9C4'
const INFO = '#4A6B8A'
const INFO_BG = '#E8EDF2'
const INFO_TEXT = '#1F344D'
const INFO_BORDER = '#CDD7E1'
const BRAND_FAINT_BORDER = '#E5DED2'

// ────── Radius tokens (v3 — 더 둥글게) ──────
const R = {
  sm: 8,        // small (v2: 4-6 → v3: 8)
  md: 12,       // medium / inputs (v2: 8 → v3: 12)
  lg: 16,       // cards (v2: 12 → v3: 16)
  xl: 20,       // large cards / sections (v2: 16 → v3: 20)
  modal: 24,    // modals
  cell: 8,      // calendar cells (v2: 5 → v3: 8)
  pill: 999,    // badges + buttons
  circle: '50%',
} as const

// ────── Typography ──────
const fontUI = `'Pretendard', 'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif`
const fontSerif = `'KoPub Batang', 'Noto Serif KR', 'RIDIBatang', serif`

const tight = (em: number) => ({ letterSpacing: `${em}em` })
const T = {
  displayL: { fontFamily: fontUI, fontSize: 32, fontWeight: 600, lineHeight: 1.2, ...tight(-0.03) },
  displayM: { fontFamily: fontUI, fontSize: 24, fontWeight: 600, lineHeight: 1.25, ...tight(-0.025) },
  h1: { fontFamily: fontUI, fontSize: 18, fontWeight: 600, lineHeight: 1.3, ...tight(-0.02) },
  h2: { fontFamily: fontUI, fontSize: 15, fontWeight: 600, lineHeight: 1.35, ...tight(-0.018) },
  bodyL: { fontFamily: fontUI, fontSize: 15, fontWeight: 500, lineHeight: 1.6, ...tight(-0.012) },
  body: { fontFamily: fontUI, fontSize: 14, fontWeight: 500, lineHeight: 1.5, ...tight(-0.01) },
  bodyS: { fontFamily: fontUI, fontSize: 13, fontWeight: 500, lineHeight: 1.5, ...tight(-0.008) },
  caption: { fontFamily: fontUI, fontSize: 12, fontWeight: 500, ...tight(-0.005) },
  micro: { fontFamily: fontUI, fontSize: 11, fontWeight: 500, ...tight(0) },
  numL: { fontFamily: fontUI, fontSize: 26, fontWeight: 600, lineHeight: 1, ...tight(-0.025), fontVariantNumeric: 'tabular-nums' as const },
  numM: { fontFamily: fontUI, fontSize: 17, fontWeight: 600, lineHeight: 1, ...tight(-0.02), fontVariantNumeric: 'tabular-nums' as const },
} as const
const S = {
  heroXL: { fontFamily: fontSerif, fontSize: 44, fontWeight: 500, lineHeight: 1.15, ...tight(-0.04) },
  heroL: { fontFamily: fontSerif, fontSize: 30, fontWeight: 500, lineHeight: 1.2, ...tight(-0.03) },
  heroM: { fontFamily: fontSerif, fontSize: 22, fontWeight: 500, lineHeight: 1.3, ...tight(-0.025) },
  heroS: { fontFamily: fontSerif, fontSize: 17, fontWeight: 500, lineHeight: 1.35, ...tight(-0.02) },
  verse: { fontFamily: fontSerif, fontSize: 17, fontWeight: 400, lineHeight: 1.95, ...tight(-0.005) },
  verseS: { fontFamily: fontSerif, fontSize: 14, fontWeight: 500, lineHeight: 1.6, ...tight(-0.005) },
} as const

// ────── Lucide icons (inline SVG) ──────
type IconName =
  | 'check' | 'check-circle' | 'flame' | 'chevron-right' | 'chevron-left'
  | 'arrow-right' | 'arrow-up-right' | 'bookmark' | 'highlighter' | 'calendar'
  | 'settings' | 'user' | 'users' | 'book-open' | 'play' | 'pause'
  | 'more-horizontal' | 'mail' | 'lock' | 'eye-off' | 'sparkles' | 'crown'
  | 'circle-dashed' | 'pen-line' | 'info' | 'triangle-alert' | 'x-circle' | 'check-2'

const PATHS: Record<IconName, React.ReactNode> = {
  'check': <polyline points="20 6 9 17 4 12" />,
  'check-2': <polyline points="20 6 9 17 4 12" />,
  'check-circle': <><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></>,
  'flame': <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />,
  'chevron-right': <path d="m9 18 6-6-6-6" />,
  'chevron-left': <path d="m15 18-6-6 6-6" />,
  'arrow-right': <><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>,
  'arrow-up-right': <><path d="M7 7h10v10" /><path d="M7 17 17 7" /></>,
  'bookmark': <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />,
  'highlighter': <><path d="m9 11-6 6v3h9l3-3" /><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" /></>,
  'calendar': <><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  'settings': <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
  'user': <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
  'users': <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
  'book-open': <><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></>,
  'play': <polygon points="6 3 20 12 6 21 6 3" />,
  'pause': <><rect width="4" height="16" x="6" y="4" /><rect width="4" height="16" x="14" y="4" /></>,
  'more-horizontal': <><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></>,
  'mail': <><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-10 5L2 7" /></>,
  'lock': <><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
  'eye-off': <><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" x2="22" y1="2" y2="22" /></>,
  'sparkles': <><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" /><path d="M5 3v4M3 5h4M19 17v4M17 19h4" /></>,
  'crown': <><path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" /><path d="M5 21h14" /></>,
  'circle-dashed': <><path d="M10.1 2.182a10 10 0 0 1 3.8 0" /><path d="M13.9 21.818a10 10 0 0 1-3.8 0" /><path d="M17.609 3.721a10 10 0 0 1 2.69 2.7" /><path d="M2.182 13.9a10 10 0 0 1 0-3.8" /><path d="M20.279 17.609a10 10 0 0 1-2.7 2.69" /><path d="M21.818 10.1a10 10 0 0 1 0 3.8" /><path d="M3.721 6.391a10 10 0 0 1 2.7-2.69" /><path d="M6.391 20.279a10 10 0 0 1-2.69-2.7" /></>,
  'pen-line': <><path d="M12 20h9" /><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" /></>,
  'info': <><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></>,
  'triangle-alert': <><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4M12 17h.01" /></>,
  'x-circle': <><circle cx="12" cy="12" r="10" /><path d="m15 9-6 6M9 9l6 6" /></>,
}

function Icon({ name, size = 14, color = 'currentColor', strokeWidth = 1.8 }: { name: IconName; size?: number; color?: string; strokeWidth?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}>
      {PATHS[name]}
    </svg>
  )
}

// ────── Badge component (v3 — pill 형태로 통일) ──────
function Badge({ children, variant = 'default', icon }: { children: React.ReactNode; variant?: 'default' | 'solid' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'outline'; icon?: IconName }) {
  const styles: Record<string, React.CSSProperties> = {
    default: { background: BRAND_FAINT, color: BRAND, border: 'none' },
    solid: { background: INK, color: PAPER, border: 'none' },
    brand: { background: BRAND, color: PAPER, border: 'none' },
    success: { background: SUCCESS_BG, color: SUCCESS_TEXT, border: 'none' },
    warning: { background: WARNING_BG, color: WARNING_TEXT, border: 'none' },
    danger: { background: DANGER_BG, color: DANGER_TEXT, border: 'none' },
    info: { background: INFO_BG, color: INFO_TEXT, border: 'none' },
    outline: { background: 'transparent', color: INK, border: `1px solid ${RULE}` },
  }
  return (
    <span style={{ ...styles[variant], ...T.caption, fontSize: 11, padding: '3px 9px', borderRadius: R.pill, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {icon && <Icon name={icon} size={11} />}
      {children}
    </span>
  )
}

function Frame({ children, bg = PAPER_WARM, label, dark }: { children: React.ReactNode; bg?: string; label?: string; dark?: boolean }) {
  return (
    <div style={{ background: bg, minHeight: '100vh', fontFamily: fontUI, color: dark ? DARK_INK : INK }}>
      {label && <div style={{ position: 'fixed', top: 8, right: 8, ...T.micro, padding: '2px 8px', background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', borderRadius: R.pill, zIndex: 100, color: dark ? DARK_MUTE : MUTE }}>{label}</div>}
      {children}
    </div>
  )
}

function Btn({ children, variant = 'primary', size = 'md', icon, iconRight, fullWidth, dark }: { children: React.ReactNode; variant?: 'primary' | 'secondary' | 'ghost' | 'outline'; size?: 'sm' | 'md' | 'lg'; icon?: IconName; iconRight?: IconName; fullWidth?: boolean; dark?: boolean }) {
  const padding = { sm: '6px 13px', md: '9px 17px', lg: '12px 22px' }[size]
  const fontSize = { sm: 12, md: 13, lg: 14 }[size]
  const iconSize = { sm: 12, md: 13, lg: 14 }[size]
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: INK, color: PAPER, border: `1px solid ${INK}` },
    secondary: { background: BRAND, color: PAPER, border: `1px solid ${BRAND}` },
    outline: { background: 'transparent', color: dark ? DARK_INK : INK, border: `1px solid ${dark ? DARK_RULE : RULE}` },
    ghost: { background: 'transparent', color: dark ? DARK_INK : INK, border: '1px solid transparent' },
  }
  return (
    <button style={{ ...styles[variant], padding, fontSize, fontWeight: 600, ...tight(-0.012), borderRadius: R.pill, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, width: fullWidth ? '100%' : 'auto', justifyContent: 'center', fontFamily: fontUI, transition: 'all 0.15s' }}>
      {icon && <Icon name={icon} size={iconSize} />}
      {children}
      {iconRight && <Icon name={iconRight} size={iconSize} />}
    </button>
  )
}

function Logo({ size = 17, color = INK }: { size?: number; color?: string }) {
  return <span style={{ fontFamily: fontSerif, fontSize: size, fontWeight: 500, letterSpacing: '-0.03em', color }}>매일일독</span>
}

function TopNav({ active = '홈', dark }: { active?: string; dark?: boolean }) {
  const items = ['홈', '통독표', '성경', '밀린통독', '친구']
  return (
    <header style={{ padding: '14px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${dark ? DARK_RULE : RULE}` }}>
      <Logo color={dark ? DARK_INK : INK} />
      <nav style={{ display: 'flex', gap: 22, ...T.bodyS, color: dark ? DARK_MUTE : MUTE }}>
        {items.map((i) => (
          <span key={i} style={{ color: i === active ? (dark ? DARK_INK : INK) : 'inherit', fontWeight: i === active ? 600 : 500, cursor: 'pointer' }}>{i}</span>
        ))}
      </nav>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: dark ? DARK_MUTE : MUTE, padding: 5 }} aria-label="설정"><Icon name="settings" size={15} /></button>
        <div style={{ width: 28, height: 28, borderRadius: R.circle as any, background: dark ? DARK_RULE : BRAND_FAINT, display: 'flex', alignItems: 'center', justifyContent: 'center', ...T.caption, color: dark ? DARK_INK : BRAND, fontWeight: 600 }}>정</div>
      </div>
    </header>
  )
}

// ────── Alert component (v3 — 시맨틱 컬러 활용) ──────
function Alert({ tone, title, message, icon }: { tone: 'success' | 'warning' | 'danger' | 'info'; title: string; message: string; icon: IconName }) {
  const palette = {
    success: { bg: SUCCESS_BG, fg: SUCCESS_TEXT, accent: SUCCESS, border: SUCCESS_BORDER },
    warning: { bg: WARNING_BG, fg: WARNING_TEXT, accent: WARNING, border: WARNING_BORDER },
    danger: { bg: DANGER_BG, fg: DANGER_TEXT, accent: DANGER, border: DANGER_BORDER },
    info: { bg: INFO_BG, fg: INFO_TEXT, accent: INFO, border: INFO_BORDER },
  }[tone]
  return (
    <div style={{ background: palette.bg, color: palette.fg, padding: '12px 14px', borderRadius: R.md, border: `1px solid ${palette.border}`, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <Icon name={icon} size={16} color={palette.accent} />
      <div style={{ flex: 1 }}>
        <p style={{ ...T.bodyS, fontWeight: 600, margin: 0, color: palette.fg }}>{title}</p>
        <p style={{ ...T.caption, color: palette.fg, opacity: 0.8, margin: '2px 0 0 0' }}>{message}</p>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// Stories
// ═══════════════════════════════════════════════════════════

export const Login: StoryObj = {
  render: () => (
    <Frame bg={PAPER}>
      <div style={{ maxWidth: 360, margin: '0 auto', padding: '56px 24px 28px', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <Logo size={16} />
          <h1 style={{ ...S.heroXL, fontSize: 38, color: INK, margin: '28px 0 12px 0' }}>매일,<br />말씀과 함께</h1>
          <p style={{ ...S.verseS, color: MUTE, margin: '0 0 32px 0', maxWidth: 260, fontStyle: 'italic' }}>
            "주의 말씀은 내 발에 등이요<br />내 길에 빛이니이다" — 시편 119:105
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
            <button style={{ ...T.bodyS, background: '#FEE500', color: '#000', border: 'none', padding: '11px 14px', borderRadius: R.md, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>K</span>카카오로 시작하기
            </button>
            <button style={{ ...T.bodyS, background: PAPER, color: INK, border: `1px solid ${RULE}`, padding: '11px 14px', borderRadius: R.md, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <span style={{ width: 13, height: 13, borderRadius: 2, background: 'conic-gradient(from 0deg, #ea4335, #fbbc05, #34a853, #4285f4)' }} />Google로 시작하기
            </button>
            <button style={{ ...T.bodyS, background: INK, color: PAPER, border: `1px solid ${INK}`, padding: '11px 14px', borderRadius: R.md, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              Apple로 시작하기
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0' }}>
            <div style={{ flex: 1, height: 1, background: RULE }} />
            <span style={{ ...T.caption, color: SUBTLE }}>또는</span>
            <div style={{ flex: 1, height: 1, background: RULE }} />
          </div>
          <button style={{ ...T.bodyS, background: 'transparent', color: INK, border: 'none', padding: '9px', cursor: 'pointer', fontWeight: 600, width: '100%', textAlign: 'center', textDecoration: 'underline', textUnderlineOffset: 4, textDecorationColor: RULE }}>
            이메일로 계속하기
          </button>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', ...T.caption, color: SUBTLE, fontSize: 11 }}>
          <span style={{ cursor: 'pointer' }}>이용약관</span><span>·</span>
          <span style={{ cursor: 'pointer' }}>개인정보</span><span>·</span>
          <span style={{ cursor: 'pointer' }}>사업자 정보</span>
        </div>
      </div>
    </Frame>
  ),
}

export const Home: StoryObj = {
  name: 'Home',
  render: () => (
    <Frame label="홈">
      <TopNav active="홈" />
      <main style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px 56px' }}>
        <p style={{ ...T.caption, color: MUTE, margin: '0 0 6px 0' }}>2026년 5월 28일 · 목요일</p>
        <h2 style={{ ...S.heroL, fontSize: 28, color: INK, margin: '0 0 24px 0' }}>정주현 님,<br />오늘도 함께 걸어요</h2>

        <div style={{ background: PAPER, border: `1px solid ${RULE}`, borderRadius: R.lg, padding: '20px 22px', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <p style={{ ...T.caption, color: MUTE, margin: 0 }}>오늘의 통독</p>
              <h3 style={{ ...S.heroM, fontSize: 20, color: INK, margin: '4px 0 2px 0' }}>창세기 1-3장</h3>
              <p style={{ ...T.bodyS, color: MUTE, margin: 0 }}>예상 12분 · 천지 창조</p>
            </div>
            <Badge variant="default" icon="flame">12일 연속</Badge>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', ...T.caption, color: MUTE, marginBottom: 4, fontSize: 11 }}>
              <span>전체 47%</span><span>178 / 379일</span>
            </div>
            <div style={{ height: 4, background: RULE, borderRadius: R.pill }}>
              <div style={{ height: 4, background: INK, borderRadius: R.pill, width: '47%' }} />
            </div>
          </div>
          <Btn variant="primary" size="md" iconRight="arrow-right" fullWidth>오늘 분량 시작하기</Btn>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
          {[
            { icon: 'calendar' as IconName, value: '22 / 30', sub: '이번 달 완료' },
            { icon: 'bookmark' as IconName, value: '8', sub: '저장된 구절' },
            { icon: 'highlighter' as IconName, value: '23', sub: '강조 표시' },
          ].map((s, i) => (
            <button key={i} style={{ textAlign: 'left', background: PAPER, border: `1px solid ${RULE}`, borderRadius: R.lg, padding: '12px 14px', cursor: 'pointer', fontFamily: fontUI }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <Icon name={s.icon} size={13} color={MUTE} />
                <Icon name="arrow-up-right" size={11} color={SUBTLE} />
              </div>
              <p style={{ ...T.numM, fontSize: 16, color: INK, margin: '0 0 1px 0' }}>{s.value}</p>
              <p style={{ ...T.caption, fontSize: 11, color: MUTE, margin: 0 }}>{s.sub}</p>
            </button>
          ))}
        </div>

        <div style={{ background: BRAND_FAINT, border: `1px solid ${BRAND_FAINT_BORDER}`, borderRadius: R.lg, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ ...T.caption, color: BRAND, margin: '0 0 2px 0', fontWeight: 600, fontSize: 11 }}>오늘의 하세나</p>
            <p style={{ ...S.heroS, fontSize: 16, color: INK, margin: 0 }}>창세기 1장 · 무에서 유로</p>
            <p style={{ ...T.caption, color: MUTE, margin: '2px 0 0 0' }}>8분 30초 · 김도현 목사</p>
          </div>
          <Btn variant="primary" size="sm" icon="play">듣기</Btn>
        </div>
      </main>
    </Frame>
  ),
}

const VERSES = [
  { n: 1, text: '태초에 하나님이 천지를 창조하시니라' },
  { n: 2, text: '땅이 혼돈하고 공허하며 흑암이 깊음 위에 있고 하나님의 영은 수면 위에 운행하시니라' },
  { n: 3, text: '하나님이 이르시되 빛이 있으라 하시니 빛이 있었고' },
  { n: 4, text: '빛이 하나님이 보시기에 좋았더라 하나님이 빛과 어둠을 나누사' },
  { n: 5, text: '하나님이 빛을 낮이라 부르시고 어둠을 밤이라 부르시니라 저녁이 되고 아침이 되니 이는 첫째 날이니라' },
  { n: 6, text: '하나님이 이르시되 물 가운데에 궁창이 있어 물과 물로 나뉘라 하시고' },
  { n: 7, text: '하나님이 궁창을 만드사 궁창 아래의 물과 궁창 위의 물로 나뉘게 하시니 그대로 되니라' },
]

function ReaderHeader({ dark }: { dark?: boolean }) {
  return (
    <header style={{ borderBottom: `1px solid ${dark ? DARK_RULE : RULE}`, padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: dark ? DARK_MUTE : MUTE, padding: 4, display: 'flex', alignItems: 'center', gap: 3 }}>
        <Icon name="chevron-left" size={14} />
        <span style={{ ...T.caption, fontSize: 12 }}>뒤로</span>
      </button>
      <div style={{ textAlign: 'center' }}>
        <p style={{ ...T.caption, color: dark ? DARK_MUTE : MUTE, margin: 0, fontSize: 11 }}>오늘의 통독 · 1 / 3</p>
        <p style={{ ...T.bodyS, color: dark ? DARK_INK : INK, margin: '1px 0 0 0', fontWeight: 600 }}>창세기 1장 · 개역개정</p>
      </div>
      <div style={{ display: 'flex', gap: 2 }}>
        <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: dark ? DARK_MUTE : MUTE, padding: 5 }} aria-label="듣기"><Icon name="play" size={15} /></button>
        <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: dark ? DARK_MUTE : MUTE, padding: 5 }} aria-label="더보기"><Icon name="more-horizontal" size={15} /></button>
      </div>
    </header>
  )
}

function ReaderBody({ dark }: { dark?: boolean }) {
  return (
    <article style={{ maxWidth: 600, margin: '0 auto', padding: '40px 24px 180px' }}>
      <p style={{ ...T.caption, color: dark ? DARK_MUTE : SUBTLE, textAlign: 'center', margin: '0 0 6px 0' }}>창세기 · 1장</p>
      <h1 style={{ ...S.heroM, fontSize: 22, color: dark ? DARK_INK : INK, textAlign: 'center', margin: '0 0 36px 0' }}>천지 창조</h1>
      {VERSES.map((v) => {
        const isHighlighted = v.n === 3
        return (
          <p key={v.n} style={{ ...S.verse, color: dark ? '#D8D4CD' : '#1F1B17', margin: '0 0 12px 0' }}>
            <sup style={{ ...T.micro, color: dark ? DARK_MUTE : SUBTLE, marginRight: 5, fontWeight: 500, verticalAlign: 'super', fontSize: 10 }}>{v.n}</sup>
            {isHighlighted ? <mark style={{ background: dark ? 'rgba(92,58,46,0.3)' : BRAND_FAINT, color: 'inherit', padding: '1px 0', borderRadius: 3, textDecoration: `underline 2px solid ${BRAND}`, textUnderlineOffset: 5 }}>{v.text}</mark> : v.text}
          </p>
        )
      })}
    </article>
  )
}

function ReaderFooter({ dark }: { dark?: boolean }) {
  return (
    <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 4, alignItems: 'center', background: dark ? '#1F1B17' : PAPER, border: `1px solid ${dark ? DARK_RULE : RULE}`, padding: 4, borderRadius: R.pill, boxShadow: dark ? '0 8px 24px rgba(0,0,0,0.5)' : '0 6px 16px rgba(15,10,5,0.08)' }}>
      <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px 11px', display: 'flex', alignItems: 'center', gap: 3, color: dark ? DARK_MUTE : MUTE, ...T.caption, fontWeight: 600, borderRadius: R.pill }}>
        <Icon name="chevron-left" size={13} />이전
      </button>
      <button style={{ background: INK, color: PAPER, border: 'none', padding: '6px 13px', borderRadius: R.pill, ...T.caption, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
        <Icon name="check" size={12} />완료 표시
      </button>
      <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px 11px', display: 'flex', alignItems: 'center', gap: 3, color: dark ? DARK_MUTE : MUTE, ...T.caption, fontWeight: 600, borderRadius: R.pill }}>
        다음<Icon name="chevron-right" size={13} />
      </button>
    </div>
  )
}

export const BibleReader: StoryObj = {
  name: 'Bible Reader',
  render: () => (
    <Frame bg={PAPER_WARM} label="성경 본문 · 라이트">
      <ReaderHeader />
      <ReaderBody />
      <ReaderFooter />
    </Frame>
  ),
}

export const BibleReaderDark: StoryObj = {
  name: 'Bible Reader · Dark',
  render: () => (
    <Frame bg={DARK_BG} dark label="성경 본문 · 다크">
      <ReaderHeader dark />
      <ReaderBody dark />
      <ReaderFooter dark />
    </Frame>
  ),
}

export const Plan: StoryObj = {
  name: 'Plan',
  render: () => (
    <Frame label="통독표">
      <TopNav active="통독표" />
      <main style={{ maxWidth: 700, margin: '0 auto', padding: '28px 24px 56px' }}>
        <h1 style={{ ...S.heroL, fontSize: 28, color: INK, margin: '0 0 20px 0' }}>통독 진행</h1>

        <div style={{ background: PAPER, border: `1px solid ${RULE}`, borderRadius: R.lg, padding: '18px 22px', marginBottom: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            <div>
              <p style={{ ...T.caption, color: MUTE, margin: '0 0 4px 0', fontSize: 11 }}>전체 진행률</p>
              <p style={{ ...T.numL, fontSize: 24, color: INK, margin: 0 }}>47<span style={{ fontSize: 14, color: SUBTLE, marginLeft: 2 }}>%</span></p>
              <p style={{ ...T.caption, color: SUBTLE, margin: '3px 0 0 0', fontSize: 11 }}>178 / 379일</p>
            </div>
            <div style={{ borderLeft: `1px solid ${RULE}`, paddingLeft: 14 }}>
              <p style={{ ...T.caption, color: MUTE, margin: '0 0 4px 0', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}>
                <Icon name="flame" size={10} color={BRAND} />현재 스트릭
              </p>
              <p style={{ ...T.numL, fontSize: 24, color: BRAND, margin: 0 }}>12<span style={{ fontSize: 13, color: BRAND_DEEP, marginLeft: 3, fontWeight: 500 }}>일</span></p>
              <p style={{ ...T.caption, color: SUBTLE, margin: '3px 0 0 0', fontSize: 11 }}>최장 28일</p>
            </div>
            <div style={{ borderLeft: `1px solid ${RULE}`, paddingLeft: 14 }}>
              <p style={{ ...T.caption, color: MUTE, margin: '0 0 4px 0', fontSize: 11 }}>이번 주</p>
              <p style={{ ...T.numL, fontSize: 24, color: INK, margin: 0 }}>6<span style={{ fontSize: 14, color: SUBTLE, marginLeft: 2 }}>/7</span></p>
              <p style={{ ...T.caption, color: SUBTLE, margin: '3px 0 0 0', fontSize: 11 }}>토요일까지 1일</p>
            </div>
          </div>
        </div>

        <div style={{ background: PAPER, border: `1px solid ${RULE}`, borderRadius: R.lg, padding: '16px 20px', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h2 style={{ ...T.h1, fontSize: 16, color: INK, margin: 0 }}>5월</h2>
            <div style={{ display: 'flex', gap: 4 }}>
              <button style={{ background: 'transparent', border: `1px solid ${RULE}`, borderRadius: R.sm, padding: 4, cursor: 'pointer', color: MUTE }}><Icon name="chevron-left" size={12} /></button>
              <button style={{ background: 'transparent', border: `1px solid ${RULE}`, borderRadius: R.sm, padding: 4, cursor: 'pointer', color: MUTE }}><Icon name="chevron-right" size={12} /></button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 5 }}>
            {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
              <div key={d} style={{ ...T.caption, fontSize: 11, color: SUBTLE, textAlign: 'center', padding: '3px 0' }}>{d}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {Array.from({ length: 31 }, (_, i) => {
              const completed = [1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0][i]
              const isToday = i === 27
              const bg = completed ? INK : isToday ? BRAND_FAINT : 'transparent'
              const color = completed ? PAPER : isToday ? BRAND : MUTE
              const borderColor = completed ? INK : isToday ? BRAND : RULE
              return (
                <div key={i} style={{ aspectRatio: '1', borderRadius: R.cell, background: bg, border: `1px solid ${borderColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', ...T.caption, fontSize: 11, color, fontWeight: isToday || completed ? 600 : 500 }}>
                  {i + 1}
                </div>
              )
            })}
          </div>
        </div>

        <h2 style={{ ...T.h1, fontSize: 16, color: INK, margin: '20px 0 8px 0' }}>이번 주</h2>
        <div style={{ background: PAPER, border: `1px solid ${RULE}`, borderRadius: R.lg, overflow: 'hidden' }}>
          {[
            { day: '5/26(월)', book: '여호수아 22-24장', done: true },
            { day: '5/27(화)', book: '사사기 1-3장', done: true },
            { day: '5/28(목) 오늘', book: '창세기 1-3장', done: false, today: true },
            { day: '5/29(금)', book: '창세기 4-6장', done: false },
            { day: '5/30(토)', book: '창세기 7-9장', done: false },
          ].map((d, i, arr) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: i < arr.length - 1 ? `1px solid ${RULE}` : 'none', background: d.today ? BRAND_FAINT : 'transparent' }}>
              <div style={{ width: 16, height: 16, borderRadius: R.circle as any, border: `1.5px solid ${d.done ? INK : d.today ? BRAND : RULE}`, background: d.done ? INK : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {d.done && <Icon name="check" size={9} color={PAPER} strokeWidth={3} />}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ ...T.bodyS, color: d.done ? MUTE : INK, fontWeight: d.today ? 600 : 500, textDecoration: d.done ? 'line-through' : 'none', margin: 0 }}>{d.book}</p>
                <p style={{ ...T.caption, color: SUBTLE, margin: '1px 0 0 0', fontSize: 11 }}>{d.day}</p>
              </div>
              {d.today && <Btn variant="primary" size="sm" iconRight="arrow-right">시작</Btn>}
              {!d.today && <Icon name="chevron-right" size={13} color={SUBTLE} />}
            </div>
          ))}
        </div>
      </main>
    </Frame>
  ),
}

export const Friends: StoryObj = {
  name: 'Friends · Leaderboard',
  render: () => (
    <Frame label="친구 · 리더보드">
      <TopNav active="친구" />
      <main style={{ maxWidth: 660, margin: '0 auto', padding: '28px 24px 56px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
          <h1 style={{ ...S.heroL, fontSize: 28, color: INK, margin: 0 }}>리더보드</h1>
          <div style={{ display: 'flex', gap: 3, border: `1px solid ${RULE}`, borderRadius: R.pill, padding: 3, background: PAPER }}>
            {['이번 주', '이번 달', '전체'].map((t, i) => (
              <button key={t} style={{ ...T.caption, fontSize: 11, padding: '4px 10px', borderRadius: R.pill, background: i === 0 ? INK : 'transparent', color: i === 0 ? PAPER : MUTE, border: 'none', cursor: 'pointer', fontWeight: 600 }}>{t}</button>
            ))}
          </div>
        </div>

        <div style={{ background: PAPER, border: `1px solid ${RULE}`, borderRadius: R.lg, overflow: 'hidden' }}>
          {[
            { rank: 1, name: '김민서', church: '베다니교회', streak: 28, progress: 89 },
            { rank: 2, name: '정주현', church: '소망교회', streak: 12, progress: 47, me: true },
            { rank: 3, name: '이서연', church: '사랑의교회', streak: 8, progress: 42 },
            { rank: 4, name: '박지훈', church: '온누리교회', streak: 5, progress: 38 },
            { rank: 5, name: '최예린', church: '베다니교회', streak: 4, progress: 31 },
            { rank: 6, name: '한도윤', church: '소망교회', streak: 3, progress: 28 },
          ].map((u, i, arr) => (
            <div key={u.rank} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', borderBottom: i < arr.length - 1 ? `1px solid ${RULE}` : 'none', background: u.me ? BRAND_FAINT : 'transparent' }}>
              <div style={{ width: 20, textAlign: 'center', ...T.bodyS, color: u.rank <= 3 ? INK : SUBTLE, fontWeight: 600 }}>
                {u.rank === 1 ? <Icon name="crown" size={14} color={BRAND} /> : u.rank}
              </div>
              <div style={{ width: 28, height: 28, borderRadius: R.circle as any, background: PAPER_WARM, border: `1px solid ${RULE}`, display: 'flex', alignItems: 'center', justifyContent: 'center', ...T.bodyS, color: INK, fontWeight: 600, flexShrink: 0 }}>
                {u.name[0]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ ...T.bodyS, color: INK, margin: 0, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                  {u.name}
                  {u.me && <Badge variant="brand">나</Badge>}
                </p>
                <p style={{ ...T.caption, fontSize: 11, color: MUTE, margin: '1px 0 0 0' }}>{u.church}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ ...T.bodyS, color: INK, margin: 0, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'flex-end', fontVariantNumeric: 'tabular-nums' }}>
                  <Icon name="flame" size={11} color={BRAND} />{u.streak}일
                </p>
                <p style={{ ...T.caption, fontSize: 11, color: MUTE, margin: '1px 0 0 0', fontVariantNumeric: 'tabular-nums' }}>{u.progress}%</p>
              </div>
            </div>
          ))}
        </div>
      </main>
    </Frame>
  ),
}

export const Atoms: StoryObj = {
  name: 'Atoms',
  render: () => (
    <Frame label="atoms">
      <main style={{ maxWidth: 800, margin: '0 auto', padding: '40px 26px 72px' }}>
        <h1 style={{ ...S.heroL, fontSize: 28, color: INK, margin: '0 0 4px 0' }}>아톰</h1>
        <p style={{ ...T.bodyS, color: MUTE, margin: '0 0 28px 0' }}>Refined v3 · 더 둥근 라운드 + 시맨틱 컬러</p>

        <h2 style={{ ...T.h1, fontSize: 15, color: INK, margin: '0 0 10px 0' }}>버튼 (pill)</h2>
        <div style={{ background: PAPER, border: `1px solid ${RULE}`, borderRadius: R.lg, padding: 16, marginBottom: 24, display: 'flex', flexWrap: 'wrap', gap: 7, alignItems: 'center' }}>
          <Btn variant="primary" icon="check">완료 표시</Btn>
          <Btn variant="primary" iconRight="arrow-right">시작하기</Btn>
          <Btn variant="secondary" icon="flame">스트릭</Btn>
          <Btn variant="outline" icon="bookmark">저장</Btn>
          <Btn variant="ghost" icon="more-horizontal">더보기</Btn>
          <Btn variant="primary" size="sm">Small</Btn>
          <Btn variant="primary" size="lg" iconRight="arrow-right">Large</Btn>
        </div>

        <h2 style={{ ...T.h1, fontSize: 15, color: INK, margin: '0 0 10px 0' }}>배지 (pill — v3 매우 둥글게)</h2>
        <div style={{ background: PAPER, border: `1px solid ${RULE}`, borderRadius: R.lg, padding: 16, marginBottom: 24, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Badge variant="default">기본</Badge>
          <Badge variant="solid">오늘</Badge>
          <Badge variant="brand">나</Badge>
          <Badge variant="default" icon="flame">스트릭 12일</Badge>
          <Badge variant="success" icon="check">완료</Badge>
          <Badge variant="warning" icon="triangle-alert">밀린 3일</Badge>
          <Badge variant="danger" icon="x-circle">중단됨</Badge>
          <Badge variant="info" icon="info">신규</Badge>
          <Badge variant="outline">대기</Badge>
        </div>

        <h2 style={{ ...T.h1, fontSize: 15, color: INK, margin: '0 0 10px 0' }}>알림 (시맨틱 컬러)</h2>
        <div style={{ background: PAPER, border: `1px solid ${RULE}`, borderRadius: R.lg, padding: 16, marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Alert tone="success" icon="check-circle" title="오늘 분량 완료" message="창세기 1-3장 통독을 마쳤습니다. 12일 연속 진행 중이에요." />
          <Alert tone="warning" icon="triangle-alert" title="밀린 통독 3일" message="이번 주 분량을 따라잡으려면 오늘 7장을 읽어주세요." />
          <Alert tone="danger" icon="x-circle" title="통독 진행 중단" message="14일째 진행되지 않았습니다. 다시 시작하시겠어요?" />
          <Alert tone="info" icon="info" title="새 통독 플랜 추가" message="'1년 신약 통독' 플랜이 6월 1일부터 시작됩니다." />
        </div>

        <h2 style={{ ...T.h1, fontSize: 15, color: INK, margin: '0 0 10px 0' }}>아이콘 (Lucide)</h2>
        <div style={{ background: PAPER, border: `1px solid ${RULE}`, borderRadius: R.lg, padding: 16, marginBottom: 24, display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 10 }}>
          {(['check', 'check-circle', 'flame', 'bookmark', 'highlighter', 'calendar', 'settings', 'user', 'users', 'book-open', 'play', 'pause', 'mail', 'lock', 'sparkles', 'crown', 'arrow-right', 'arrow-up-right', 'chevron-right', 'pen-line', 'circle-dashed', 'more-horizontal', 'eye-off', 'info', 'triangle-alert', 'x-circle'] as IconName[]).map((n) => (
            <div key={n} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: 5, borderRadius: R.sm }}>
              <Icon name={n} size={16} color={INK} />
              <span style={{ ...T.micro, color: MUTE, fontSize: 10 }}>{n}</span>
            </div>
          ))}
        </div>

        <h2 style={{ ...T.h1, fontSize: 15, color: INK, margin: '0 0 10px 0' }}>카드</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 24 }}>
          <div style={{ background: PAPER, border: `1px solid ${RULE}`, borderRadius: R.lg, padding: '16px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <p style={{ ...T.caption, color: MUTE, margin: 0, fontSize: 11 }}>오늘의 통독</p>
                <h3 style={{ ...S.heroM, fontSize: 19, color: INK, margin: '3px 0 0 0' }}>창세기 1-3장</h3>
              </div>
              <Badge variant="default" icon="flame">12일</Badge>
            </div>
            <Btn variant="primary" iconRight="arrow-right" fullWidth>시작하기</Btn>
          </div>
          <div style={{ background: BRAND_FAINT, border: `1px solid ${BRAND_FAINT_BORDER}`, borderRadius: R.lg, padding: '16px 18px' }}>
            <Icon name="sparkles" size={16} color={BRAND} />
            <h3 style={{ ...S.heroS, fontSize: 15, color: INK, margin: '8px 0 3px 0' }}>오늘의 하세나</h3>
            <p style={{ ...T.caption, color: MUTE, margin: 0, fontSize: 11 }}>창세기 1장 · 8분 30초</p>
          </div>
        </div>

        <h2 style={{ ...T.h1, fontSize: 15, color: INK, margin: '0 0 10px 0' }}>인풋 (더 둥글게)</h2>
        <div style={{ background: PAPER, border: `1px solid ${RULE}`, borderRadius: R.lg, padding: 16, marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 360 }}>
          <div>
            <label style={{ ...T.caption, color: MUTE, display: 'block', marginBottom: 3, fontSize: 11 }}>이메일</label>
            <input style={{ width: '100%', padding: '9px 12px', border: `1px solid ${RULE}`, borderRadius: R.md, ...T.bodyS, fontFamily: fontUI, outline: 'none', color: INK, boxSizing: 'border-box' }} defaultValue="jugyung@maeil1dok.app" />
          </div>
          <div>
            <label style={{ ...T.caption, color: MUTE, display: 'block', marginBottom: 3, fontSize: 11 }}>비밀번호</label>
            <input type="password" style={{ width: '100%', padding: '9px 12px', border: `1px solid ${INK}`, borderRadius: R.md, ...T.bodyS, fontFamily: fontUI, outline: 'none', color: INK, boxSizing: 'border-box' }} defaultValue="password" />
          </div>
        </div>
      </main>
    </Frame>
  ),
}

export const Tokens: StoryObj = {
  name: 'Tokens',
  render: () => (
    <Frame label="tokens">
      <main style={{ maxWidth: 820, margin: '0 auto', padding: '40px 26px 72px' }}>
        <h1 style={{ ...S.heroL, fontSize: 28, color: INK, margin: '0 0 4px 0' }}>토큰</h1>
        <p style={{ ...T.bodyS, color: MUTE, margin: '0 0 28px 0' }}>Color · semantic · typography · spacing · radius</p>

        <h2 style={{ ...T.h1, fontSize: 15, color: INK, margin: '0 0 10px 0' }}>기본 컬러 (12개 · 흑백 + 갈색 1색 + 다크)</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 28 }}>
          {[
            { name: 'ink', hex: INK, role: '본문 + 주요 액션' },
            { name: 'paper', hex: PAPER, role: '카드 배경' },
            { name: 'paper-warm', hex: PAPER_WARM, role: '페이지 배경' },
            { name: 'brand', hex: BRAND, role: '상징 (warm cocoa)' },
            { name: 'brand-deep', hex: BRAND_DEEP, role: '강조 (espresso)' },
            { name: 'brand-faint', hex: BRAND_FAINT, role: '5% tint' },
            { name: 'rule', hex: RULE, role: 'hairline' },
            { name: 'mute', hex: MUTE, role: '보조 텍스트' },
            { name: 'subtle', hex: SUBTLE, role: '3차 / placeholder' },
            { name: 'dark-bg', hex: DARK_BG, role: '다크 배경' },
            { name: 'dark-ink', hex: DARK_INK, role: '다크 텍스트' },
            { name: 'dark-rule', hex: DARK_RULE, role: '다크 hairline' },
          ].map((c) => (
            <div key={c.name} style={{ border: `1px solid ${RULE}`, borderRadius: R.md, overflow: 'hidden', background: PAPER }}>
              <div style={{ background: c.hex, height: 48, borderBottom: `1px solid ${RULE}` }} />
              <div style={{ padding: '7px 9px' }}>
                <p style={{ ...T.bodyS, color: INK, margin: 0, fontWeight: 600, fontSize: 12 }}>{c.name}</p>
                <p style={{ ...T.caption, color: MUTE, margin: '1px 0 3px 0', fontFamily: 'SFMono-Regular, Menlo, monospace', fontSize: 10 }}>{c.hex}</p>
                <p style={{ ...T.micro, color: SUBTLE, margin: 0, fontSize: 10 }}>{c.role}</p>
              </div>
            </div>
          ))}
        </div>

        <h2 style={{ ...T.h1, fontSize: 15, color: INK, margin: '0 0 6px 0' }}>시맨틱 컬러 (4종 × 3 → 12개 · 절제된 톤)</h2>
        <p style={{ ...T.caption, color: MUTE, margin: '0 0 12px 0' }}>시스템 알림용 — 브랜드 강조는 brand cocoa 단일 유지. 시맨틱은 status communication에만 사용.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
          {[
            { name: 'success', main: SUCCESS, bg: SUCCESS_BG, text: SUCCESS_TEXT, role: '완료 · 성공 (통독 완료)' },
            { name: 'warning', main: WARNING, bg: WARNING_BG, text: WARNING_TEXT, role: '주의 · 밀린 통독' },
            { name: 'danger', main: DANGER, bg: DANGER_BG, text: DANGER_TEXT, role: '오류 · 중단 · 삭제' },
            { name: 'info', main: INFO, bg: INFO_BG, text: INFO_TEXT, role: '정보 · 공지 · 업데이트' },
          ].map((c) => (
            <div key={c.name} style={{ border: `1px solid ${RULE}`, borderRadius: R.md, overflow: 'hidden', background: PAPER }}>
              <div style={{ display: 'flex', height: 48 }}>
                <div style={{ flex: 1, background: c.main, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ ...T.caption, fontSize: 10, color: PAPER, fontWeight: 600 }}>main</span>
                </div>
                <div style={{ flex: 1, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ ...T.caption, fontSize: 10, color: c.text, fontWeight: 600 }}>bg</span>
                </div>
                <div style={{ flex: 1, background: c.text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ ...T.caption, fontSize: 10, color: PAPER, fontWeight: 600 }}>text</span>
                </div>
              </div>
              <div style={{ padding: '7px 9px', borderTop: `1px solid ${RULE}` }}>
                <p style={{ ...T.bodyS, color: INK, margin: 0, fontWeight: 600, fontSize: 12 }}>{c.name}</p>
                <p style={{ ...T.caption, color: MUTE, margin: '1px 0 3px 0', fontFamily: 'SFMono-Regular, Menlo, monospace', fontSize: 10 }}>{c.main} · {c.bg} · {c.text}</p>
                <p style={{ ...T.micro, color: SUBTLE, margin: 0, fontSize: 10 }}>{c.role}</p>
              </div>
            </div>
          ))}
        </div>
        <div style={{ background: PAPER, border: `1px solid ${RULE}`, borderRadius: R.lg, padding: 14, marginBottom: 28, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Alert tone="success" icon="check-circle" title="success" message="bg + text 페어로 알림 박스 구성" />
          <Alert tone="warning" icon="triangle-alert" title="warning" message="ochre 톤 — brand brown 과 조화" />
          <Alert tone="danger" icon="x-circle" title="danger" message="brick muted — 채도 낮춤" />
          <Alert tone="info" icon="info" title="info" message="slate blue muted — neutral 톤" />
        </div>

        <h2 style={{ ...T.h1, fontSize: 15, color: INK, margin: '0 0 10px 0' }}>타이포 (Serif = KoPub Batang · Sans = Pretendard)</h2>
        <div style={{ background: PAPER, border: `1px solid ${RULE}`, borderRadius: R.lg, padding: '18px 20px', marginBottom: 28 }}>
          <p style={{ ...T.caption, color: BRAND, margin: '0 0 6px 0', fontWeight: 600, fontSize: 11 }}>Serif — KoPub Batang (hero · verse · page title)</p>
          {[
            { name: 'Hero XL', style: S.heroXL, sample: '매일, 말씀과 함께' },
            { name: 'Hero L', style: S.heroL, sample: '정주현 님, 오늘도' },
            { name: 'Hero M', style: S.heroM, sample: '창세기 1-3장' },
            { name: 'Hero S', style: S.heroS, sample: '오늘의 하세나' },
            { name: 'Verse (reading)', style: S.verse, sample: '태초에 하나님이 천지를 창조하시니라' },
          ].map((t) => (
            <div key={t.name} style={{ padding: '8px 0', borderBottom: `1px solid ${RULE}`, display: 'grid', gridTemplateColumns: '130px 1fr', gap: 14, alignItems: 'baseline' }}>
              <p style={{ ...T.caption, color: MUTE, margin: 0, fontSize: 11 }}>
                {t.name}<br />
                <span style={{ color: SUBTLE, fontSize: 10 }}>{(t.style as any).fontSize}px · {(t.style as any).fontWeight}</span>
              </p>
              <p style={{ ...(t.style as React.CSSProperties), color: INK, margin: 0 }}>{t.sample}</p>
            </div>
          ))}
          <p style={{ ...T.caption, color: BRAND, margin: '18px 0 6px 0', fontWeight: 600, fontSize: 11 }}>Sans — Pretendard (UI · 리스트 · 숫자)</p>
          {[
            { name: 'Display L', style: T.displayL, sample: '리더보드' },
            { name: 'Display M', style: T.displayM, sample: '오늘의 통독' },
            { name: 'Heading 1', style: T.h1, sample: '이번 주' },
            { name: 'Heading 2', style: T.h2, sample: '5월' },
            { name: 'Body L', style: T.bodyL, sample: '오늘 분량을 시작하시겠어요?' },
            { name: 'Body', style: T.body, sample: '178일 완료 · 201일 남음' },
            { name: 'Body S', style: T.bodyS, sample: '예상 12분 · 천지 창조' },
            { name: 'Caption', style: T.caption, sample: '178 / 379일 · 47%' },
            { name: 'Number L', style: T.numL, sample: '47%' },
          ].map((t) => (
            <div key={t.name} style={{ padding: '8px 0', borderBottom: `1px solid ${RULE}`, display: 'grid', gridTemplateColumns: '130px 1fr', gap: 14, alignItems: 'baseline' }}>
              <p style={{ ...T.caption, color: MUTE, margin: 0, fontSize: 11 }}>
                {t.name}<br />
                <span style={{ color: SUBTLE, fontSize: 10 }}>{(t.style as any).fontSize}px · {(t.style as any).fontWeight}</span>
              </p>
              <p style={{ ...(t.style as React.CSSProperties), color: INK, margin: 0 }}>{t.sample}</p>
            </div>
          ))}
        </div>

        <h2 style={{ ...T.h1, fontSize: 15, color: INK, margin: '0 0 10px 0' }}>스페이싱 / 라운드 (v3 — 모든 라운드 +2-6px)</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ background: PAPER, border: `1px solid ${RULE}`, borderRadius: R.lg, padding: 16 }}>
            <h3 style={{ ...T.h2, color: INK, margin: '0 0 10px 0' }}>스페이싱 (4px base)</h3>
            {[4, 8, 12, 16, 20, 24, 32, 40].map((s) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
                <span style={{ ...T.caption, fontSize: 11, color: MUTE, width: 28, fontVariantNumeric: 'tabular-nums' }}>{s}px</span>
                <div style={{ background: INK, height: 3, width: s, borderRadius: R.pill }} />
              </div>
            ))}
          </div>
          <div style={{ background: PAPER, border: `1px solid ${RULE}`, borderRadius: R.lg, padding: 16 }}>
            <h3 style={{ ...T.h2, color: INK, margin: '0 0 10px 0' }}>라운드 (v3 더 둥글게)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
              {[
                { n: 'sm', r: R.sm, label: '8px' },
                { n: 'md', r: R.md, label: '12px' },
                { n: 'lg', r: R.lg, label: '16px' },
                { n: 'xl', r: R.xl, label: '20px' },
                { n: 'modal', r: R.modal, label: '24px' },
                { n: 'cell', r: R.cell, label: '8px' },
                { n: 'pill', r: R.pill, label: '999' },
                { n: 'circle', r: R.circle as any, label: '50%' },
              ].map((r) => (
                <div key={r.n} style={{ aspectRatio: '1', background: BRAND_FAINT, border: `1px solid ${BRAND}`, borderRadius: r.r as any, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', ...T.caption, fontSize: 10, color: BRAND, fontWeight: 600, gap: 1 }}>
                  <span>{r.n}</span>
                  <span style={{ color: MUTE, fontSize: 8 }}>{r.label}</span>
                </div>
              ))}
            </div>
            <p style={{ ...T.caption, fontSize: 11, color: MUTE, margin: '10px 0 0 0' }}>버튼/배지 = pill · 카드 = lg(16) · 모달 = modal(24) · 인풋 = md(12)</p>
          </div>
        </div>
      </main>
    </Frame>
  ),
}

const meta: Meta = {
  title: 'Design/Refined v1 — Mono Cocoa',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `**Refined v3 — Mono Cocoa (Rounded + Semantic)**

v2 → v3 변경 (사용자 피드백 2026-05-28):
- 라운드 일괄 +2-6px (sm 4→8 · md 8→12 · lg 12→16 · xl 16→20 · modal 24)
- **배지 = pill (999)** — 매우 둥글게 통일
- **시맨틱 컬러 4종 정의** (절제된 톤 · brand와 조화)
  - success #3D6B4F (forest muted)
  - warning #A87C3D (ochre — brand 톤)
  - danger #A8483E (brick muted)
  - info #4A6B8A (slate blue muted)
- Atoms 스토리: 시맨틱 배지 5종 + Alert 컴포넌트 4종 추가
- Tokens 스토리: 시맨틱 컬러 섹션 (main/bg/text 페어) 추가
`,
      },
    },
  },
}

export default meta
