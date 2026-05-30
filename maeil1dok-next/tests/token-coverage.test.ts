import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Files to exclude from token coverage check
const EXCLUDED_FILES = [
  'src/components/bible/BibleReaderView.tsx',
  'src/components/bible/BibleChapterView.tsx',
  'src/components/bible/BibleHome.tsx',
  'src/components/bible/BiblePageClient.tsx',
  'src/components/bible/BibleViewer.tsx',
  'src/components/bible/BookSelector.tsx',
  'src/components/bible/BibleTOC.tsx',
  'src/components/bible/BookmarkModal.tsx',
  'src/components/bible/HighlightModal.tsx',
  'src/components/bible/HighlightColorPicker.tsx',
  'src/components/bible/NoteQuickModal.tsx',
  'src/components/bible/PlanSelectorModal.tsx',
  'src/components/bible/ChapterNavigation.tsx',
  'src/components/bible/VersionSelector.tsx',
  'src/components/bible/chapter',
  'src/components/bible/home',
  'src/components/bible/reader',
  'src/app/(authenticated)/bible',
  'src/stories/',
  'src/hooks/useConfetti.ts',
  'src/__mocks__/',
  'src/app/api/',
]

// Allowed hardcoded colors (brand colors and Bible highlight palette)
const ALLOWED_COLORS = [
  // Kakao brand colors
  '#FEE500',
  '#FDD835',
  '#000000',
  // Google brand colors
  '#4285F4',
  '#EA4335',
  '#FBBC05',
  '#34A853',
  // Bible highlight palette
  '#FACC15',
  '#4ADE80',
  '#60A5FA',
  '#F472B6',
  '#C084FC',
]

// Normalize color to uppercase for comparison
function normalizeColor(color: string): string {
  return color.toUpperCase()
}

// Check if a file should be excluded
function isExcluded(filePath: string): boolean {
  const relativePath = filePath.replace(/^.*\/src\//, 'src/')
  return EXCLUDED_FILES.some((excluded) => {
    if (excluded.endsWith('/')) {
      return relativePath.startsWith(excluded)
    }
    return relativePath === excluded || relativePath.startsWith(excluded + '/')
  })
}

// Recursively get all TSX/TS files
function getAllSourceFiles(dir: string): string[] {
  const files: string[] = []

  function walk(currentPath: string) {
    try {
      const entries = readdirSync(currentPath)
      for (const entry of entries) {
        const fullPath = join(currentPath, entry)
        const stat = statSync(fullPath)

        if (stat.isDirectory()) {
          if (!entry.startsWith('.') && entry !== 'node_modules' && entry !== '__tests__') {
            walk(fullPath)
          }
        } else if (
          (entry.endsWith('.tsx') || entry.endsWith('.ts')) &&
          !entry.endsWith('.test.ts') &&
          !entry.endsWith('.test.tsx') &&
          !entry.endsWith('.spec.ts') &&
          !entry.endsWith('.spec.tsx')
        ) {
          files.push(fullPath)
        }
      }
    } catch (error) {
      // Ignore errors for inaccessible directories
    }
  }

  walk(dir)
  return files
}

// Extract hardcoded hex colors from file content
function extractHardcodedColors(content: string): Array<{ color: string; line: number; context: string }> {
  const violations: Array<{ color: string; line: number; context: string }> = []

  // Pattern 1: Tailwind arbitrary values like bg-[#fff], text-[#123456]
  const tailwindPattern = /(?:bg|text|border|ring|shadow|fill|stroke|outline)-\[#([0-9a-fA-F]{3,8})\]/g
  // Pattern 2: Inline hex colors in style attributes or CSS
  const hexPattern = /#([0-9a-fA-F]{3,8})/g

  const lines = content.split('\n')

  lines.forEach((line, lineIndex) => {
    // Check Tailwind pattern
    let match: RegExpExecArray | null
    match = tailwindPattern.exec(line)
    while (match !== null) {
      const color = '#' + match[1]
      const normalizedColor = normalizeColor(color)

      if (!ALLOWED_COLORS.includes(normalizedColor)) {
        violations.push({
          color: normalizedColor,
          line: lineIndex + 1,
          context: line.trim().substring(0, 100),
        })
      }
      match = tailwindPattern.exec(line)
    }

    // Check inline hex pattern (but avoid false positives from URLs, etc.)
    // Only check if it looks like a style or className context
    if (line.includes('style') || line.includes('className') || line.includes('color')) {
      match = hexPattern.exec(line)
      while (match !== null) {
        const color = '#' + match[1]
        const normalizedColor = normalizeColor(color)

        // Skip if it's part of a URL or already caught by Tailwind pattern
        const beforeMatch = line.substring(Math.max(0, match.index - 10), match.index)
        if (beforeMatch.includes('http') || beforeMatch.includes('://')) {
          match = hexPattern.exec(line)
          continue
        }

        // Skip if already in Tailwind pattern
        if (line.substring(match.index - 5, match.index).includes('-[')) {
          match = hexPattern.exec(line)
          continue
        }

        if (!ALLOWED_COLORS.includes(normalizedColor)) {
          violations.push({
            color: normalizedColor,
            line: lineIndex + 1,
            context: line.trim().substring(0, 100),
          })
        }
        match = hexPattern.exec(line)
      }
    }
  })

  return violations
}

describe('Token Coverage', () => {
  it('should have no hardcoded hex colors in non-exempt files', () => {
    const srcDir = join(process.cwd(), 'src')
    const allFiles = getAllSourceFiles(srcDir)

    const violations: Array<{
      file: string
      violations: Array<{ color: string; line: number; context: string }>
    }> = []

    for (const filePath of allFiles) {
      if (isExcluded(filePath)) {
        continue
      }

      try {
        const content = readFileSync(filePath, 'utf-8')
        const fileViolations = extractHardcodedColors(content)

        if (fileViolations.length > 0) {
          const relativePath = filePath.replace(process.cwd() + '/', '')
          violations.push({
            file: relativePath,
            violations: fileViolations,
          })
        }
      } catch (error) {
        // Ignore read errors
      }
    }

    // Format violation report
    if (violations.length > 0) {
      let report = `\n\n❌ Found ${violations.length} file(s) with hardcoded colors:\n\n`

      for (const fileViolation of violations) {
        report += `📄 ${fileViolation.file}\n`
        const uniqueColors = new Set(fileViolation.violations.map((v) => v.color))
        report += `   Colors: ${Array.from(uniqueColors).join(', ')}\n`
        report += `   Violations:\n`

        for (const violation of fileViolation.violations) {
          report += `     - Line ${violation.line}: ${violation.color}\n`
          report += `       Context: ${violation.context}\n`
        }
        report += '\n'
      }

      report += `\n📋 Summary:\n`
      report += `   Total files with violations: ${violations.length}\n`
      report += `   Total violations: ${violations.reduce((sum, v) => sum + v.violations.length, 0)}\n`
      report += `\n✅ Allowed colors:\n`
      report += `   ${ALLOWED_COLORS.join(', ')}\n`

      console.log(report)
    }

    expect(violations).toHaveLength(0)
  })
})
