/**
 * Shared YouTube IFrame API loader + minimal player factory.
 *
 * Extracted from components/bible/TongdokAudioPlayer.vue:237-258 (LAB-146 WP-10)
 * so pages/hasena.vue stops clobbering window.onYouTubeIframeAPIReady — the old
 * inline loader overwrote the ready callback, which would break the audio
 * player's ready chain if both ever mounted (arch-map P1-8).
 *
 * NOTE: TongdokAudioPlayer.vue still declares `Window.YT` /
 * `Window.onYouTubeIframeAPIReady` globally. This module deliberately does NOT
 * re-augment Window (a second augmentation with a different shape would be a
 * duplicate-declaration error); it reads the globals through a local cast.
 * WP-99 migrates TongdokAudioPlayer onto this module and drops its globals.
 */

export interface YouTubePlayerEvent {
  readonly data: number
  readonly target: YouTubePlayer
}

export interface YouTubePlayer {
  playVideo: () => void
  pauseVideo: () => void
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
  setPlaybackRate: (rate: number) => void
  getCurrentTime: () => number
  getDuration: () => number
  getPlayerState: () => number
  getVideoData: () => { video_id?: string }
  destroy: () => void
}

export interface YouTubePlayerEvents {
  onReady?: (event: YouTubePlayerEvent) => void
  onStateChange?: (event: YouTubePlayerEvent) => void
}

export interface YouTubeNamespace {
  Player: new (
    element: HTMLIFrameElement | string,
    options: { events?: YouTubePlayerEvents },
  ) => YouTubePlayer
}

const YOUTUBE_IFRAME_API_SRC = 'https://www.youtube.com/iframe_api'

interface YouTubeWindow {
  YT?: YouTubeNamespace
  onYouTubeIframeAPIReady?: () => void
}

const youtubeWindow = (): YouTubeWindow => window as unknown as YouTubeWindow

let youtubeApiPromise: Promise<YouTubeNamespace | undefined> | null = null

/**
 * Resolves with the YT namespace once the IFrame API is ready.
 * SSR-safe: resolves to `undefined` on the server — callers guard with
 * `if (!YT) return` (or only call it from client-side lifecycle hooks).
 */
export const loadYouTubeIframeApi = (): Promise<YouTubeNamespace | undefined> => {
  if (typeof window === 'undefined') return Promise.resolve(undefined)

  const win = youtubeWindow()
  if (win.YT?.Player) return Promise.resolve(win.YT)
  if (youtubeApiPromise) return youtubeApiPromise

  youtubeApiPromise = new Promise((resolve) => {
    const previousReady = win.onYouTubeIframeAPIReady
    win.onYouTubeIframeAPIReady = () => {
      previousReady?.()
      resolve(youtubeWindow().YT)
    }

    if (!document.querySelector(`script[src="${YOUTUBE_IFRAME_API_SRC}"]`)) {
      const script = document.createElement('script')
      script.src = YOUTUBE_IFRAME_API_SRC
      script.async = true
      document.head.appendChild(script)
    }
  })

  return youtubeApiPromise
}

/**
 * Creates a YT.Player on an iframe element (or element id). The iframe's src
 * must already carry enablejsapi=1 — rewriting src after mount cancels the
 * in-flight player load and re-triggers ad subframe navigation, which surfaced
 * as a first-entry fullscreen error in the iOS WebView (LAB-59).
 */
export const createYouTubePlayer = (
  YT: YouTubeNamespace,
  target: HTMLIFrameElement | string,
  events: YouTubePlayerEvents,
): YouTubePlayer => new YT.Player(target, { events })

export const useYouTubePlayer = () => ({
  loadYouTubeIframeApi,
  createYouTubePlayer,
})
