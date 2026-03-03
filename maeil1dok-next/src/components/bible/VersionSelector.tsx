import { BIBLE_VERSIONS, type BibleVersion } from '@/lib/bible/books'
import Select from '@/components/ui/Select'
interface VersionSelectorProps {
  version: BibleVersion
  onVersionChange: (version: BibleVersion) => void
}

export default function VersionSelector({ version, onVersionChange }: VersionSelectorProps) {
  return (
    <Select
      label="성경 버전"
      data-testid="version-selector"
      value={version}
      onChange={(event) => onVersionChange(event.target.value as BibleVersion)}
    >
      {Object.entries(BIBLE_VERSIONS).map(([code, name]) => (
        <option key={code} value={code}>
          {name}
        </option>
      ))}
    </Select>
  )
}
