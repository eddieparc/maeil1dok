// https://nuxt.com/docs/api/configuration/nuxt-config
const parseNuxtPublicSentryTracesSampleRate = () => {
  const rawValue = process.env.NUXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE
  const parsedValue = Number.parseFloat(rawValue ?? '0')

  return Number.isFinite(parsedValue) && parsedValue >= 0 && parsedValue <= 1 ? parsedValue : 0
}

export default defineNuxtConfig({
  compatibilityDate: '2025-12-29',
  devtools: {
    enabled: process.env.NUXT_DEVTOOLS === 'true'
  },
  sourcemap: {
    client: 'hidden',
  },
  sentry: {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    sourcemaps: {
      filesToDeleteAfterUpload: ['.output/**/public/**/*.map'],
    },
  },
  modules: [
    '@pinia/nuxt',
    '@nuxtjs/tailwindcss',
    '@nuxtjs/sitemap',
    '@nuxt/image',
    '@sentry/nuxt/module',
  ],
  // 이미지 최적화 설정
  image: {
    provider: 'ipx',
    domains: [
      'k.kakaocdn.net',
      't1.kakaocdn.net',
      'img1.kakaocdn.net',
      'lh3.googleusercontent.com',
    ],
    // 지원 포맷
    format: ['webp', 'avif'],
    // 품질 설정
    quality: 80,
    // 스크린 사이즈
    screens: {
      xs: 320,
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280,
      xxl: 1536,
    },
  },
  // Sitemap 설정
  site: {
    url: 'https://maeil1dok.app',
  },
  sitemap: {
    exclude: [
      '/reading',
      '/reading-plan',
      '/profile/**',
      '/groups/**',
      '/friends',
      '/scoreboard',
      '/admin/**',
      '/auth/**',
      '/hasena',
      '/notice/**',
      '/plans/**',
      '/intro/**',
    ],
  },
  css: [
    '~/assets/css/main.css',
    '~/assets/css/global.css',
    '~/assets/css/mobile-nav.css',
    '~/assets/css/themes.css',
    '~/assets/css/bible-page.css'
  ],
  runtimeConfig: {
    internalApiBase: process.env.NUXT_INTERNAL_API_BASE || '',
    cronSecret: process.env.CRON_SECRET || '',
    hasenaCronSecret: process.env.HASENA_CRON_SECRET || '',
    youtubeApiKey: process.env.YOUTUBE_API_KEY || '',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    hasenaPlaylistId: process.env.HASENA_PLAYLIST_ID || '',
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:8019',
      bibleCacheUrl: process.env.NUXT_PUBLIC_BIBLE_CACHE_URL || '',  // 성경 캐시 서버 URL (failback용)
      KAKAO_CLIENT_ID: process.env.KAKAO_CLIENT_ID,
      kakaoJsKey: process.env.KAKAO_JS_KEY,
      KAKAO_REDIRECT_URI: process.env.KAKAO_REDIRECT_URI,
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
      GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
      APPLE_CLIENT_ID: process.env.APPLE_CLIENT_ID,
      APPLE_REDIRECT_URI: process.env.APPLE_REDIRECT_URI || 'https://maeil1dok.app/auth/apple/callback',
      sentry: {
        dsn: process.env.NUXT_PUBLIC_SENTRY_DSN || '',
        environment: process.env.NUXT_PUBLIC_SENTRY_ENVIRONMENT,
        release: process.env.NUXT_PUBLIC_SENTRY_RELEASE || process.env.SENTRY_RELEASE || process.env.RAILWAY_GIT_COMMIT_SHA,
        tracesSampleRate: parseNuxtPublicSentryTracesSampleRate(),
      },
    }
  },
  app: {
    head: {
      htmlAttrs: {
        lang: 'ko',
      },
      title: '매일일독',
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
        { rel: 'manifest', href: '/manifest.json' },
        // Google Fonts - Noto Serif KR, Noto Sans KR
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600&family=Noto+Serif+KR:wght@400;500;600&display=swap' }
      ],
      meta: [
        { name: 'msapplication-TileColor', content: '#ffffff' },
        { name: 'theme-color', content: '#ffffff' },
        {
          name: 'viewport',
          content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover'
        },
        { name: 'description', content: '매일일독과 함께 올해는 성경통독하기!' },
        { property: 'og:title', content: '매일일독' },
        { property: 'og:description', content: '매일일독과 함께 올해는 성경통독하기!' },
        { property: 'og:type', content: 'website' },
        { property: 'og:image', content: 'https://maeil1dok.app/og-image.png' },
        { property: 'og:url', content: 'https://maeil1dok.app' },
        { property: 'og:locale', content: 'ko_KR' },
        { property: 'og:site_name', content: '매일일독' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: '매일일독' },
        { name: 'twitter:description', content: '매일일독과 함께 올해는 성경통독하기!' },
        { name: 'twitter:image', content: 'https://maeil1dok.app/og-image.png' },
        // 검색엔진 인증 메타 태그 (등록 후 인증 코드로 교체 필요)
        // { name: 'google-site-verification', content: 'YOUR_GOOGLE_VERIFICATION_CODE' },
        // { name: 'naver-site-verification', content: 'YOUR_NAVER_VERIFICATION_CODE' },
      ],
      script: [
        {
          innerHTML: `(function(){var t='light';try{var s=localStorage.getItem('readingSettings');if(s){var p=JSON.parse(s);if(p.theme){t=p.theme==='system'?window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light':p.theme}}}catch(e){t=window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'}document.documentElement.setAttribute('data-theme',t)})();`,
          tagPosition: 'head',
        }
      ]
    }
  },
  devServer: {
    host: '0.0.0.0',
    port: 3019
  },
  // Vite 설정 추가
  vite: {
    build: {
      rolldownOptions: {
        checks: {
          pluginTimings: false
        }
      }
    },
    server: {
      // 운영 환경에서는 HMR 관련 설정 비활성화
      hmr: process.env.NODE_ENV === 'production' ? false : {
        protocol: 'ws',
        host: '0.0.0.0',
        port: 3019
      }
    }
  },
  nitro: {
    routeRules: {
      '/': {
        headers: {
          'cache-control': 'no-store'
        }
      },
      '/hasena': {
        headers: {
          'cache-control': 'no-store'
        }
      },
      '/bible': {
        headers: {
          'cache-control': 'no-store'
        }
      },
      '/bible/': {
        headers: {
          'cache-control': 'no-store'
        }
      },
      '/bible/search': {
        headers: {
          'cache-control': 'no-store'
        }
      },
      '/bible/search/': {
        headers: {
          'cache-control': 'no-store'
        }
      },
      '/_nuxt/**': {
        headers: {
          'cache-control': 'public, max-age=31536000, immutable'
        }
      },
      '/favicon.ico': {
        headers: {
          'cache-control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400'
        }
      },
      '/favicon-16x16.png': {
        headers: {
          'cache-control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400'
        }
      },
      '/favicon-32x32.png': {
        headers: {
          'cache-control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400'
        }
      },
      '/apple-touch-icon.png': {
        headers: {
          'cache-control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400'
        }
      },
      '/og-image.png': {
        headers: {
          'cache-control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=86400'
        }
      },
      '/manifest.json': {
        headers: {
          'cache-control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400'
        }
      },
      '/api/**': {
        headers: {
          'cache-control': 'no-store'
        }
      }
    }
  }
})
