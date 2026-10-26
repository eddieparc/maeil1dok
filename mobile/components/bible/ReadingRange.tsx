import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useNativeColors } from '../ui/tokens';

interface Props {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly suffix?: string;
  readonly onChange: (value: number) => void;
}

/** Native responder track; accessibility actions use the same quantized range. */
export function ReadingRange({ label, value, min, max, step, suffix = '', onChange }: Props) {
  const colors = useNativeColors();
  const [width, setWidth] = useState(0);
  const track = useRef<View>(null);
  const origin = useRef(0);
  const quantize = (next: number) =>
    Math.min(max, Math.max(min, Math.round((next - min) / step) * step + min));
  const setValue = (next: number) => onChange(Number(quantize(next).toFixed(1)));
  const fromTouch = (pageX: number) => {
    if (width > 20) setValue(min + (pageX - origin.current - 10) / (width - 20) * (max - min));
  };
  const thumbLeft = Math.max(0, width - 20) * (Math.min(max, Math.max(min, value)) - min) / (max - min);
  return <View>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ fontFamily: 'Pretendard-SemiBold', fontSize: 13, color: colors.textSecondary }}>{label}</Text>
      <Text style={{ fontFamily: 'Pretendard-SemiBold', fontSize: 13, color: colors.accent, fontVariant: ['tabular-nums'] }}>
        {step < 1 ? value.toFixed(1) : value}{suffix}
      </Text>
    </View>
    <View ref={track} testID={`reading-range-${suffix === 'px' ? 'font' : 'line'}`}
      accessible accessibilityRole="adjustable" accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={event => {
        if (event.nativeEvent.actionName === 'increment') setValue(value + step);
        if (event.nativeEvent.actionName === 'decrement') setValue(value - step);
      }}
      onLayout={event => setWidth(event.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={event => {
        const pageX = event.nativeEvent.pageX;
        track.current?.measureInWindow(x => { origin.current = x; fromTouch(pageX); });
      }}
      onResponderMove={event => fromTouch(event.nativeEvent.pageX)}
      style={{ height: 44, justifyContent: 'center' }}>
      <View pointerEvents="none" style={{ height: 4, borderRadius: 2, backgroundColor: colors.border }} />
      <View pointerEvents="none" style={{ position: 'absolute', left: thumbLeft, width: 20, height: 20,
        borderRadius: 10, backgroundColor: colors.accent }} />
    </View>
  </View>;
}
