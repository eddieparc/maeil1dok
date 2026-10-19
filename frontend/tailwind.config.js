/** @type {import('tailwindcss').Config} */
module.exports = {
  // Dark mode via data-theme attribute (synced with themes.css)
  darkMode: ['selector', '[data-theme="dark"]'],

  // hover: 유틸리티도 터치 기기에서 고착되지 않도록 hover 지원 포인터에서만 활성화
  future: {
    hoverOnlyWhenSupported: true,
  },

  theme: {
    extend: {
      screens: {
        'tablet': '768px',      // iPad Mini and similar
        'tablet-lg': '1024px',  // iPad Pro and larger tablets
      },

      // Semantic color tokens using CSS variables
      colors: {
        // Background colors
        bg: {
          primary: 'var(--color-bg-primary)',
          secondary: 'var(--color-bg-secondary)',
          tertiary: 'var(--color-bg-tertiary)',
          card: 'var(--color-bg-card)',
          hover: 'var(--color-bg-hover)',
          active: 'var(--color-bg-active)',
        },

        // Text colors
        txt: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          tertiary: 'var(--color-text-tertiary)',
          muted: 'var(--color-text-muted)',
          inverse: 'var(--color-text-inverse)',
        },

        // Border colors
        border: {
          DEFAULT: 'var(--color-border-default)',
          light: 'var(--color-border-light)',
          dark: 'var(--color-border-dark)',
        },

        // Accent colors
        accent: {
          primary: 'var(--color-accent-primary)',
          'primary-hover': 'var(--color-accent-primary-hover)',
          'primary-light': 'var(--color-accent-primary-light)',
          secondary: 'var(--color-accent-secondary)',
          'secondary-hover': 'var(--color-accent-secondary-hover)',
        },

        // Status colors
        status: {
          success: 'var(--color-success)',
          'success-bg': 'var(--color-success-bg)',
          'success-text': 'var(--color-success-text)',
          error: 'var(--color-error)',
          'error-bg': 'var(--color-error-bg)',
          'error-text': 'var(--color-error-text)',
          warning: 'var(--color-warning)',
          'warning-bg': 'var(--color-warning-bg)',
          'warning-text': 'var(--color-warning-text)',
          info: 'var(--color-info)',
          'info-bg': 'var(--color-info-bg)',
          'info-text': 'var(--color-info-text)',
        },

        // Interactive elements
        button: {
          DEFAULT: 'var(--color-button-default)',
          hover: 'var(--color-button-hover)',
          active: 'var(--color-button-active)',
        },
        input: {
          bg: 'var(--color-input-bg)',
          border: 'var(--color-input-border)',
          focus: 'var(--color-input-focus)',
        },
        link: {
          DEFAULT: 'var(--color-link)',
          hover: 'var(--color-link-hover)',
        },

        // Overlay/Modal
        modal: {
          bg: 'var(--color-modal-bg)',
        },
        overlay: 'var(--color-overlay)',

        // Third-party (Kakao)
        kakao: {
          bg: 'var(--color-kakao-bg)',
          hover: 'var(--color-kakao-hover)',
          text: 'var(--color-kakao-text)',
        },

        // Legacy primary (for backward compatibility with existing code)
        primary: {
          DEFAULT: 'var(--color-accent-primary)',
          dark: 'var(--color-accent-primary-hover)',
          light: 'var(--color-accent-primary-light)',
        },
      },

      // Box shadows using CSS variables
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
      },

      fontSize: {
        // Responsive font sizes for tablets
        'xs-tablet': ['0.8125rem', { lineHeight: '1.25rem' }],
        'sm-tablet': ['0.9375rem', { lineHeight: '1.5rem' }],
        'base-tablet': ['1.0625rem', { lineHeight: '1.75rem' }],
        'lg-tablet': ['1.25rem', { lineHeight: '2rem' }],
        'xl-tablet': ['1.5rem', { lineHeight: '2.25rem' }],
      },

      spacing: {
        // Additional spacing options for tablets
        '18': '4.5rem',
        '22': '5.5rem',
      },

      maxWidth: {
        'tablet': '900px',
        'tablet-lg': '1200px',
      },
    },
  },

  plugins: [],
}
