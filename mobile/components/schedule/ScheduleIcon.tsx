import Svg, { Circle, Path, Rect } from 'react-native-svg';

type IconName = 'back' | 'down' | 'next' | 'calendar' | 'list' | 'check' | 'minus' | 'up' | 'close' | 'settings' | 'info';

/** Outline geometry used by the web schedule's Lucide icons. */
export function ScheduleIcon({ name, color, size = 20 }: {
  readonly name: IconName;
  readonly color: string;
  readonly size?: number;
}) {
  const paths: Partial<Record<IconName, string>> = {
    back: 'm15 18-6-6 6-6',
    down: 'm6 9 6 6 6-6',
    next: 'm9 18 6-6-6-6',
    check: 'm20 6-11 11-5-5',
    minus: 'M5 12h14',
    up: 'm5 12 7-7 7 7M12 19V5',
    close: 'm18 6-12 12M6 6l12 12',
    list: 'm3 6 1 1 2-2M10 6h10m-17 6 1 1 2-2m4 1h10M3 18h.01M10 18h10',
    settings: 'M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4',
    info: 'M12 16v-4M12 8h.01',
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      accessible={false}>
      {name === 'calendar' ? <>
        <Rect x={3} y={5} width={18} height={16} rx={2} />
        <Path d="M16 3v4M8 3v4M3 11h18M8 15h.01M12 15h.01M16 15h.01M8 18h.01M12 18h.01M16 18h.01" />
      </> : <>
        {name === 'info' && <Circle cx={12} cy={12} r={10} />}
        <Path d={paths[name]} />
      </>}
    </Svg>
  );
}
