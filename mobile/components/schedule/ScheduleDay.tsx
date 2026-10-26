import { Text, TouchableOpacity, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { formatScheduleDate, readingStatus, scheduleTitle, type ScheduleEntry, type ReadingStatus } from '../../api/scheduleData';
import { useNativeColors } from '../ui/tokens';
import { scheduleStyles } from './scheduleStyles';

const STATUS_TEXT: Record<ReadingStatus, string> = {
  completed: '읽음', not_completed: '미완료', current: '오늘', upcoming: '예정',
};

export function ScheduleDay({ date, schedules, today, selected, bulkMode, disabled, onLayout, onRead, onToggle }: {
  readonly date: string;
  readonly schedules: readonly ScheduleEntry[];
  readonly today: string;
  readonly selected: boolean;
  readonly bulkMode: boolean;
  readonly disabled: boolean;
  readonly onLayout: (event: LayoutChangeEvent) => void;
  readonly onRead: (schedule: ScheduleEntry) => void;
  readonly onToggle: (schedules: readonly ScheduleEntry[]) => void;
}) {
  const colors = useNativeColors();
  const styles = scheduleStyles(colors);
  const allDone = schedules.every(s => s.is_completed);
  const mixed = !allDone && schedules.some(s => s.is_completed);
  const status = readingStatus(date, allDone, today);
  const first = schedules[0];
  return (
    <View testID={`schedule-day-${date}`} onLayout={onLayout} style={[styles.card,
      status === 'current' && styles.cardCurrent, status === 'upcoming' && styles.cardUpcoming,
      selected && styles.cardSelected]}>
      <View style={styles.cardRow}>
        <TouchableOpacity testID={`schedule-check-${date}`} style={styles.checkbox}
          accessibilityRole="checkbox" accessibilityLabel={`${formatScheduleDate(date)} ${bulkMode ? '범위 선택' : '읽음 표시'}`}
          accessibilityState={{ checked: mixed ? 'mixed' : allDone, disabled }}
          disabled={disabled} hitSlop={6} onPress={() => onToggle(schedules)}>
          <ScheduleCheck checked={allDone} mixed={mixed} missed={status === 'not_completed'} />
        </TouchableOpacity>
        <View style={styles.cardInfo}>
          {schedules.length > 1 || bulkMode ? (
            <TouchableOpacity style={schedules.length > 1 ? styles.groupDate : undefined} disabled={disabled} accessibilityRole="button"
              onPress={() => { if (first) onRead(first); }}>
              <Text style={[styles.cardDate, status === 'current' && styles.cardDateCurrent]}>{formatScheduleDate(date)}</Text>
            </TouchableOpacity>
          ) : <Text style={[styles.cardDate, status === 'current' && styles.cardDateCurrent]}>{formatScheduleDate(date)}</Text>}
          {schedules.map(schedule => (
            <View key={schedule.id} style={styles.cardReadingRow}>
              {schedules.length > 1 && <TouchableOpacity style={styles.checkbox}
                testID={`schedule-check-${schedule.id}`} accessibilityRole="checkbox"
                accessibilityLabel={`${scheduleTitle(schedule)} ${bulkMode ? '범위 선택' : '읽음 표시'}`}
                accessibilityState={{ checked: schedule.is_completed, disabled }}
                disabled={disabled} hitSlop={6} onPress={() => onToggle([schedule])}>
                <ScheduleCheck checked={schedule.is_completed} mixed={false} missed={status === 'not_completed'} />
              </TouchableOpacity>}
              <TouchableOpacity testID={`schedule-read-${schedule.id}`} accessibilityRole="button"
                accessibilityLabel={`${scheduleTitle(schedule)} ${bulkMode ? '범위 선택' : '본문 읽기'}`}
                accessibilityState={{ disabled, selected }} disabled={disabled}
                style={styles.readingButton} onPress={() => onRead(schedule)}>
                <Text style={styles.cardTitle}>{scheduleTitle(schedule)}</Text>
              </TouchableOpacity>
              {schedules.length > 1 && <ScheduleStatus status={readingStatus(date, schedule.is_completed, today)} />}
            </View>
          ))}
        </View>
        {schedules.length === 1 && <ScheduleStatus status={status} />}
      </View>
    </View>
  );
}

function ScheduleCheck({ checked, mixed, missed }: {
  readonly checked: boolean; readonly mixed: boolean; readonly missed: boolean;
}) {
  const colors = useNativeColors();
  return (
    <Svg width={26} height={26} viewBox="0 0 26 26" accessible={false}>
      <Circle cx={13} cy={13} r={12.25} fill={checked ? colors.accent : 'none'}
        stroke={checked ? colors.accent : missed ? colors.error : colors.border}
        strokeWidth={1.5} strokeDasharray={!checked && missed ? '3.5 3.5' : undefined} />
      {(checked || mixed) && <Path d={checked ? 'm7 13 4 4 8-8' : 'M8 13h10'}
        stroke={checked ? colors.onAccent : colors.accent} strokeWidth={1.5}
        fill="none" strokeLinecap="round" strokeLinejoin="round" />}
    </Svg>
  );
}

function ScheduleStatus({ status }: { readonly status: ReadingStatus }) {
  const colors = useNativeColors();
  const styles = scheduleStyles(colors);
  return (
    <View style={[styles.badge, status === 'completed' && styles.badgeCompleted,
      status === 'current' && styles.badgeCurrent, status === 'not_completed' && styles.badgeMissed,
      status === 'upcoming' && styles.badgeUpcoming]}>
      <Text style={[styles.badgeText, { color: status === 'completed' ? colors.accent
        : status === 'current' ? colors.onAccent : status === 'not_completed' ? colors.error : colors.textMuted }]}>
        {STATUS_TEXT[status]}
      </Text>
    </View>
  );
}
