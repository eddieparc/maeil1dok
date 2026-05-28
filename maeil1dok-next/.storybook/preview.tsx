import type { Preview } from '@storybook/nextjs-vite'
import '../src/app/globals.css'

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'cream',
      values: [
        { name: 'cream', value: '#faf8f6' },
        { name: 'white', value: '#ffffff' },
        { name: 'warm-dark', value: '#1A1815' },
        { name: 'forest-dark', value: '#0E1614' },
        { name: 'reading-dark', value: '#0F0E0C' },
      ],
    },
    options: {
      storySort: {
        order: [
          'Design',
          ['Refined v1 — Mono Cocoa', ['Overview', 'Login', 'Home', 'Bible Reader', 'Bible Reader · Dark', 'Plan', 'Friends · Leaderboard', 'Atoms', 'Tokens']],
        ],
      },
    },
    a11y: {
      test: 'todo',
    },
  },
}

export default preview
