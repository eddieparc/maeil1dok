export const HASENA_PLAYLIST_ID = 'PLMT1AJszhYtXkV936HNuExxjAmtFhp2tL';

const VIDEO_EMBED_PARAMS = {
  enablejsapi: '1',
  rel: '0',
  playsinline: '1',
};

const PLAYLIST_EMBED_PARAMS = {
  list: HASENA_PLAYLIST_ID,
  rel: '0',
  playsinline: '1',
};

const buildQuery = (params) => new URLSearchParams(params).toString();

export const buildHasenaYoutubeEmbedUrl = (videoId) => {
  const normalizedVideoId = String(videoId || '').trim();

  if (!normalizedVideoId) {
    return `https://www.youtube.com/embed/videoseries?${buildQuery(PLAYLIST_EMBED_PARAMS)}`;
  }

  return `https://www.youtube.com/embed/${encodeURIComponent(normalizedVideoId)}?${buildQuery(VIDEO_EMBED_PARAMS)}`;
};

export const buildHasenaYoutubeWatchUrl = (videoId) => (
  `https://www.youtube.com/watch?v=${encodeURIComponent(String(videoId || '').trim())}`
);
