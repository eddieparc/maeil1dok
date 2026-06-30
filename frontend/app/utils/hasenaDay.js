export const resolveHasenaDayState = (data, selectedDate) => {
  if (!data?.success || !data.entry) {
    throw new Error(data?.error || '본문을 불러오는데 실패했습니다');
  }

  const entry = data.entry;
  const entryDate = entry.date || selectedDate;

  return {
    entry,
    entryDate,
    bibleTitle: entry.passage || entry.title || '하세나하시조',
    videoId: entry.video_id || '',
    verses: Array.isArray(entry.verses) ? entry.verses : [],
    isCompleted: Boolean(data.is_completed),
  };
};
