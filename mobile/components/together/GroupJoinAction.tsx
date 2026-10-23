import { Alert } from 'react-native';
import { GroupButton } from './GroupControls';
import type { ReadingGroup } from './contracts';

export function GroupJoinAction({ group, signedIn, joining, onJoin, onLogin }: {
  readonly group: ReadingGroup;
  readonly signedIn: boolean;
  readonly joining: boolean;
  readonly onJoin: () => void;
  readonly onLogin: () => void;
}) {
  return <GroupButton label={group.is_member ? '그룹 채팅 열기' : group.is_full ? '정원 초과' : '그룹 가입하기'}
    variant="primary" size="lg" loading={joining} disabled={!group.is_member && group.is_full}
    onPress={() => {
      if (group.is_member) Alert.alert('그룹 채팅', '아직 그룹 채팅 기능이 제공되지 않습니다.');
      else if (!signedIn) onLogin();
      else onJoin();
    }} />;
}
