# 업적 메타데이터 설정
# 각 업적 타입에 대한 제목, 설명, 아이콘, 순서를 정의합니다.

ACHIEVEMENT_METADATA = {
    'first_complete': {
        'title': '첫 걸음',
        'description': '첫 번째 성경 읽기 완료',
        'icon': 'fa-solid fa-shoe-prints',
        'order': 1,
        'milestone_value': 1,
    },
    'streak_7': {
        'title': '일주일 연속',
        'description': '7일 연속 성경 읽기 달성',
        'icon': 'fa-solid fa-fire',
        'order': 2,
        'milestone_value': 7,
    },
    'streak_30': {
        'title': '한 달 연속',
        'description': '30일 연속 성경 읽기 달성',
        'icon': 'fa-solid fa-fire-flame-curved',
        'order': 3,
        'milestone_value': 30,
    },
    'streak_100': {
        'title': '백일의 기적',
        'description': '100일 연속 성경 읽기 달성',
        'icon': 'fa-solid fa-medal',
        'order': 4,
        'milestone_value': 100,
    },
    'total_30': {
        'title': '꾸준한 시작',
        'description': '누적 30일 성경 읽기 완료',
        'icon': 'fa-solid fa-calendar-check',
        'order': 5,
        'milestone_value': 30,
    },
    'total_100': {
        'title': '백일 달성',
        'description': '누적 100일 성경 읽기 완료',
        'icon': 'fa-solid fa-award',
        'order': 6,
        'milestone_value': 100,
    },
    'total_365': {
        'title': '일 년의 헌신',
        'description': '누적 365일 성경 읽기 완료',
        'icon': 'fa-solid fa-crown',
        'order': 7,
        'milestone_value': 365,
    },
    'book_complete': {
        'title': '책 완독',
        'description': '성경 한 권 완독',
        'icon': 'fa-solid fa-book',
        'order': 8,
        'milestone_value': 1,
    },
    'testament_complete': {
        'title': '구약/신약 완독',
        'description': '구약 또는 신약 전체 완독',
        'icon': 'fa-solid fa-book-bible',
        'order': 9,
        'milestone_value': 1,
    },
    'bible_complete': {
        'title': '성경 완독',
        'description': '성경 66권 전체 완독',
        'icon': 'fa-solid fa-trophy',
        'order': 10,
        'milestone_value': 66,
    },
    'hasena_total_30': {
        'title': '하시조 30일',
        'description': '하세나하시조 30일 완료',
        'icon': 'fa-solid fa-star',
        'order': 11,
        'milestone_value': 30,
    },
    'hasena_total_100': {
        'title': '하시조 100일',
        'description': '하세나하시조 100일 완료',
        'icon': 'fa-solid fa-hands-praying',
        'order': 12,
        'milestone_value': 100,
    },
    'hasena_streak_7': {
        'title': '하시조 일주일',
        'description': '하세나하시조 7회 연속 완료',
        'icon': 'fa-solid fa-fire',
        'order': 13,
        'milestone_value': 7,
    }
}

# 성경 66권 목록 (완독 업적 확인용)
BIBLE_BOOKS = {
    'old_testament': [
        '창세기', '출애굽기', '레위기', '민수기', '신명기',
        '여호수아', '사사기', '룻기', '사무엘상', '사무엘하',
        '열왕기상', '열왕기하', '역대상', '역대하', '에스라',
        '느헤미야', '에스더', '욥기', '시편', '잠언',
        '전도서', '아가', '이사야', '예레미야', '예레미야애가',
        '에스겔', '다니엘', '호세아', '요엘', '아모스',
        '오바댜', '요나', '미가', '나훔', '하박국',
        '스바냐', '학개', '스가랴', '말라기'
    ],
    'new_testament': [
        '마태복음', '마가복음', '누가복음', '요한복음', '사도행전',
        '로마서', '고린도전서', '고린도후서', '갈라디아서', '에베소서',
        '빌립보서', '골로새서', '데살로니가전서', '데살로니가후서', '디모데전서',
        '디모데후서', '디도서', '빌레몬서', '히브리서', '야고보서',
        '베드로전서', '베드로후서', '요한일서', '요한이서', '요한삼서',
        '유다서', '요한계시록'
    ]
}

# 모든 성경 책 목록
ALL_BIBLE_BOOKS = BIBLE_BOOKS['old_testament'] + BIBLE_BOOKS['new_testament']
