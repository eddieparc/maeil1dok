export const HASENA_PLAYLIST_ID = 'PLMT1AJszhYtXkV936HNuExxjAmtFhp2tL';

const YOUTUBE_EMBED_BASE = 'https://www.youtube.com/embed/';

export const buildHasenaEmbedUrl = (videoId) => {
  if (!videoId) {
    const playlistUrl = new URL(`${YOUTUBE_EMBED_BASE}videoseries`);
    playlistUrl.searchParams.set('list', HASENA_PLAYLIST_ID);

    return playlistUrl.toString();
  }

  return new URL(`${YOUTUBE_EMBED_BASE}${videoId}`).toString();
};

export const withJsApiEnabled = (embedUrl) => {
  const url = new URL(embedUrl);
  url.searchParams.set('enablejsapi', '1');

  return url.toString();
};
