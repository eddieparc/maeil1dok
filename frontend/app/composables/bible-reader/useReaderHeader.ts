import { computed, type ComputedRef } from 'vue';

interface ReaderHeaderProps {
  isTongdokMode: boolean;
  tongdokScheduleDate: string | null;
  tongdokSchedule: Array<{ book: string; bookKor: string; startChapter: number; endChapter: number }>;
  currentBookName: string;
  currentChapter: number;
  chapterSuffix: string;
  currentVersionName: string;
}

// 책 이름 축약 (날짜 옆 요약·좁은 화면용)
const abbreviateBookName = (name: string): string => {
  if (!name) return '';
  const abbreviations: Record<string, string> = {
    '창세기': '창', '출애굽기': '출', '레위기': '레', '민수기': '민', '신명기': '신',
    '여호수아': '수', '사사기': '삿', '룻기': '룻', '사무엘상': '삼상', '사무엘하': '삼하',
    '열왕기상': '왕상', '열왕기하': '왕하', '역대상': '대상', '역대하': '대하',
    '에스라': '스', '느헤미야': '느', '에스더': '에', '욥기': '욥', '시편': '시',
    '잠언': '잠', '전도서': '전', '아가': '아', '이사야': '사', '예레미야': '렘',
    '예레미야애가': '애', '에스겔': '겔', '다니엘': '단', '호세아': '호', '요엘': '욜',
    '아모스': '암', '오바댜': '옵', '요나': '욘', '미가': '미', '나훔': '나',
    '하박국': '합', '스바냐': '습', '학개': '학', '스가랴': '슥', '말라기': '말',
    '마태복음': '마', '마가복음': '막', '누가복음': '눅', '요한복음': '요', '사도행전': '행',
    '로마서': '롬', '고린도전서': '고전', '고린도후서': '고후', '갈라디아서': '갈', '에베소서': '엡',
    '빌립보서': '빌', '골로새서': '골', '데살로니가전서': '살전', '데살로니가후서': '살후',
    '디모데전서': '딤전', '디모데후서': '딤후', '디도서': '딛', '빌레몬서': '몬',
    '히브리서': '히', '야고보서': '약',
    '베드로전서': '벧전', '베드로후서': '벧후', '요한일서': '요일', '요한이서': '요이',
    '요한삼서': '요삼', '유다서': '유', '요한계시록': '계',
  };
  return abbreviations[name] || name.charAt(0);
};

export const useReaderHeader = (props: ReaderHeaderProps) => {
  const headerScheduleDate = computed(() => {
    if (!props.tongdokScheduleDate) return '';
    const parsed = new Date(`${props.tongdokScheduleDate}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return props.tongdokScheduleDate;
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    return `${parsed.getMonth() + 1}/${parsed.getDate()}(${weekdays[parsed.getDay()]})`;
  });

  // 첫 책 범위 + 다른 책의 남은 장 수 요약 (예: "사사기 7-8장 외 3장").
  // 같은 책 행은 범위로 합치고, 외 N장은 다른 책의 장만 센다. 단위는 첫 책 기준.
  const headerScheduleSummary = computed(() => {
    const rows = props.tongdokSchedule;
    const first = rows[0];
    if (!first) return '';
    const firstBookRows = rows.filter(row => row.book === first.book);
    const start = Math.min(...firstBookRows.map(row => row.startChapter));
    const end = Math.max(...firstBookRows.map(row => row.endChapter));
    const unit = first.book === 'psa' ? '편' : '장';
    const chapters = start === end ? `${start}${unit}` : `${start}-${end}${unit}`;
    const remaining = rows
      .filter(row => row.book !== first.book)
      .reduce((count, row) => count + row.endChapter - row.startChapter + 1, 0);
    return `${abbreviateBookName(first.bookKor)} ${chapters}${remaining > 0 ? ` 외 ${remaining}장` : ''}`;
  });

  const headerContext = computed(() => {
    if (props.isTongdokMode) {
      return [headerScheduleDate.value, headerScheduleSummary.value].filter(Boolean).join(' · ');
    }
    return props.currentVersionName || '';
  });

  const headerRange = computed(() => `${props.currentBookName} ${props.currentChapter}${props.chapterSuffix}`);

  const headerContextShort = computed(() => {
    if (props.isTongdokMode) {
      return [headerScheduleDate.value, headerScheduleSummary.value].filter(Boolean).join(' · ');
    }
    return props.currentVersionName || '';
  });

  return {
    headerScheduleDate,
    headerScheduleSummary,
    headerContext,
    headerRange,
    headerContextShort,
    abbreviateBookName,
  };
};
