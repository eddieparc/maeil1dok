import { BIBLE_VERSIONS, type BibleVersion } from '@/lib/bible/books'

interface VersionSelectorProps {
  version: BibleVersion
  onVersionChange: (version: BibleVersion) => void
}

export default function VersionSelector({ version, onVersionChange }: VersionSelectorProps) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm text-gray-600">
      <span className="text-xs font-medium tracking-wide text-gray-500">성경 버전</span>
      <select
        data-testid="version-selector"
        value={version}
        onChange={(event) => onVersionChange(event.target.value as BibleVersion)}
        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-400 focus:outline-none"
      >
        {Object.entries(BIBLE_VERSIONS).map(([code, name]) => (
          <option key={code} value={code}>
            {name}
          </option>
        ))}
      </select>
    </label>
  )
}
