import type { ReadingGroup } from '@/types/groups'

const MOCK_GROUPS: ReadingGroup[] = [
  {
    id: 101,
    name: '새벽 묵상 함께 읽기',
    description: '매일 아침 6시에 함께 통독하고 서로의 묵상을 나누는 그룹입니다.',
    status: 'active',
    isPublic: true,
    isMine: true,
    maxMembers: 30,
    memberCount: 18,
    leader: { id: 'u-1', nickname: '다니엘', profileImage: null },
    plans: [{ id: 1, name: '1년 1독 플랜' }],
    members: [
      { id: 'u-1', nickname: '다니엘', role: '관리자', joinedAt: '2026-01-11', profileImage: null },
      { id: 'u-2', nickname: '사라', role: '멤버', joinedAt: '2026-01-13', profileImage: null },
      { id: 'u-3', nickname: '요셉', role: '멤버', joinedAt: '2026-01-15', profileImage: null },
    ],
    activities: [
      { id: 'a-1', message: '사라님이 오늘 본문을 완료했어요.', createdAt: '2026-03-05T07:10:00+09:00' },
      { id: 'a-2', message: '요셉님이 묵상 노트를 남겼어요.', createdAt: '2026-03-04T22:24:00+09:00' },
    ],
  },
  {
    id: 102,
    name: '청년부 저녁 통독',
    description: '평일 저녁 10분씩, 짧지만 꾸준하게 함께 읽습니다.',
    status: 'recruiting',
    isPublic: true,
    isMine: false,
    maxMembers: 20,
    memberCount: 9,
    leader: { id: 'u-4', nickname: '은혜', profileImage: null },
    plans: [{ id: 2, name: '신약 집중 플랜' }],
    members: [
      { id: 'u-4', nickname: '은혜', role: '관리자', joinedAt: '2026-02-01', profileImage: null },
      { id: 'u-5', nickname: '민수', role: '멤버', joinedAt: '2026-02-05', profileImage: null },
    ],
    activities: [
      { id: 'a-3', message: '민수님이 그룹에 가입했어요.', createdAt: '2026-03-04T11:20:00+09:00' },
    ],
  },
  {
    id: 103,
    name: '직장인 주말 정독팀',
    description: '주말에 긴 호흡으로 정독하며 본문 이해를 깊게 나누는 모임입니다.',
    status: 'ended',
    isPublic: false,
    isMine: true,
    maxMembers: 15,
    memberCount: 15,
    leader: { id: 'u-6', nickname: '한나', profileImage: null },
    plans: [
      { id: 3, name: '역사서 집중 플랜' },
      { id: 4, name: '시편 묵상 플랜' },
    ],
    members: [
      { id: 'u-6', nickname: '한나', role: '관리자', joinedAt: '2025-11-08', profileImage: null },
      { id: 'u-7', nickname: '예람', role: '멤버', joinedAt: '2025-11-12', profileImage: null },
    ],
    activities: [
      { id: 'a-4', message: '지난달 그룹 활동이 종료되었어요.', createdAt: '2026-02-28T18:30:00+09:00' },
    ],
  },
]

export async function getGroups(): Promise<ReadingGroup[]> {
  return MOCK_GROUPS
}

export async function getGroupById(id: number): Promise<ReadingGroup | null> {
  return MOCK_GROUPS.find((group) => group.id === id) ?? null
}
