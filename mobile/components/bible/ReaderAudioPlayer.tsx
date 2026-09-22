/** Inline native controls; the WebView contains YouTube media only. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  PLAYBACK_RATES, buildReaderAudioHtml, extractYouTubeVideoId, parseReaderAudioEvent,
  type PlaybackRate, type ReaderAudioSource,
} from '../../api/readerAudio';

interface ReaderAudioPlayerProps {
  readonly visible: boolean;
  readonly audioLink: string | null;
  readonly title?: string;
  readonly initialRate?: PlaybackRate;
  readonly onRateChange?: (rate: PlaybackRate) => void;
  readonly onOpenExternal?: (url: string) => void;
  readonly onClose: () => void;
  /** Caller includes auth/stack/plan/book/chapter identity. */
  readonly contextKey?: string;
  readonly onEnded?: (source: ReaderAudioSource) => void;
}

let generation = 0;
const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

export default function ReaderAudioPlayer(props: ReaderAudioPlayerProps) {
  const [attempt, setAttempt] = useState(0);
  if (!props.visible) return null;
  return <AudioSession key={JSON.stringify([props.audioLink, props.contextKey, attempt])}
    {...props} onRetry={() => setAttempt(value => value + 1)} />;
}

function AudioSession({
  audioLink, title, contextKey = '', initialRate = 1, onRateChange, onOpenExternal,
  onClose, onEnded, onRetry,
}: ReaderAudioPlayerProps & { readonly onRetry: () => void }) {
  const [source] = useState<ReaderAudioSource>(() => ({ link: audioLink ?? '', contextKey, generation: ++generation }));
  const [document] = useState(() => ({ html: buildReaderAudioHtml(source, initialRate), baseUrl: 'https://www.youtube.com' }));
  const [rate, setRate] = useState(initialRate);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState({ currentTime: 0, duration: 0 });
  const [failed, setFailed] = useState(false);
  const [closed, setClosed] = useState(false);
  const [speedMenu, setSpeedMenu] = useState(false);
  const web = useRef<WebView>(null);
  const active = useRef(true);
  const closing = useRef(false);
  const ended = useRef(false);
  const width = useRef(0);
  const videoId = extractYouTubeVideoId(audioLink);
  useLayoutEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  useEffect(() => {
    setRate(initialRate);
    web.current?.injectJavaScript(`window.__readerAudio && window.__readerAudio('rate', ${initialRate}); true;`);
  }, [initialRate]);

  const command = (name: 'play' | 'pause' | 'seek' | 'rate', value = 0) => {
    if (!active.current) return;
    web.current?.injectJavaScript(`window.__readerAudio && window.__readerAudio(${JSON.stringify(name)}, ${value}); true;`);
  };
  const fail = () => {
    if (!active.current) return;
    active.current = false;
    setFailed(true);
    setPlaying(false);
  };
  const close = () => {
    if (closing.current) return;
    closing.current = true;
    active.current = false;
    setClosed(true);
    onClose();
  };
  const seek = (seconds: number) => {
    if (ready && time.duration > 0 && Number.isFinite(seconds)) {
      command('seek', Math.min(time.duration, Math.max(0, seconds)));
    }
  };
  if (closed) return null;
  const enabled = ready && !failed;
  const percent = time.duration > 0 ? Math.min(100, time.currentTime / time.duration * 100) : 0;
  return (
    <View style={styles.container} testID="reader-audio-controls">
      {videoId && !failed && (
        <View style={styles.media} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <WebView ref={web} source={document} style={styles.media}
            originWhitelist={['https://*']} javaScriptEnabled
            mediaPlaybackRequiresUserAction={false} allowsInlineMediaPlayback
            scrollEnabled={false} bounces={false}
            onShouldStartLoadWithRequest={request => {
              if (request.url === 'about:blank') return true;
              try {
                const url = new URL(request.url);
                return url.protocol === 'https:' && url.hostname === 'www.youtube.com' &&
                  (url.pathname === '/' || url.pathname.startsWith('/embed/'));
              } catch { return false; }
            }}
            onMessage={event => {
              if (!active.current) return;
              const message = parseReaderAudioEvent(event.nativeEvent.data, source);
              if (!message) return;
              switch (message.type) {
                case 'ready':
                  command('rate', rate);
                  setReady(true);
                  setTime(message);
                  break;
                case 'time': setTime(message); break;
                case 'state': setPlaying(message.state === 1 || message.state === 3); break;
                case 'ended':
                  setPlaying(false);
                  if (!ended.current) { ended.current = true; onEnded?.(source); }
                  break;
                case 'error': fail(); break;
              }
            }}
            onError={fail}
            onHttpError={event => { if (event.nativeEvent.statusCode >= 400) fail(); }}
          />
        </View>
      )}
      <View style={styles.row}>
        {videoId ? (
          <>
            <Pressable testID="audio-play" style={styles.button} disabled={!enabled}
              accessibilityRole="button" accessibilityLabel={playing ? '오디오 일시정지' : '오디오 재생'}
              accessibilityState={{ disabled: !enabled }} onPress={() => command(playing ? 'pause' : 'play')}>
              {!ready && !failed ? <ActivityIndicator color="#2A1111" /> :
                <Ionicons name={playing ? 'pause' : 'play'} size={18} color="#2A1111" />}
            </Pressable>
            <Pressable testID="audio-seek" style={styles.seek} disabled={!enabled || time.duration <= 0}
              accessibilityRole="adjustable" accessibilityLabel={`${title ?? '오디오'} 재생 위치`}
              accessibilityState={{ disabled: !enabled || time.duration <= 0 }}
              accessibilityValue={{ min: 0, max: 100, now: percent, text: `${formatTime(time.currentTime)} / ${formatTime(time.duration)}` }}
              accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
              onAccessibilityAction={event => {
                if (event.nativeEvent.actionName === 'increment') seek(time.currentTime + 10);
                if (event.nativeEvent.actionName === 'decrement') seek(time.currentTime - 10);
              }}
              onLayout={event => { width.current = event.nativeEvent.layout.width; }}
              onPress={event => { if (width.current > 0) seek(event.nativeEvent.locationX / width.current * time.duration); }}>
              <View pointerEvents="none" style={styles.track}>
                <View style={[styles.fill, { width: `${percent}%` }]} />
              </View>
            </Pressable>
            <Text testID="audio-time" style={styles.time}>{formatTime(time.currentTime)} / {formatTime(time.duration)}</Text>
            <Pressable testID="audio-speed" style={styles.button} onPress={() => setSpeedMenu(value => !value)}
              accessibilityRole="button" accessibilityLabel="오디오 재생 속도 설정" accessibilityState={{ expanded: speedMenu }}>
              <Text style={styles.text}>{rate}x</Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.fallback}>
            <Text style={styles.text}>{audioLink ? '앱 안에서 재생할 수 없는 링크입니다.' : '재생할 오디오가 없습니다.'}</Text>
            {audioLink && onOpenExternal && <Pressable style={styles.button} accessibilityRole="button"
              onPress={() => onOpenExternal(audioLink)}><Text style={styles.text}>외부로 열기</Text></Pressable>}
          </View>
        )}
        <Pressable testID="audio-close" style={styles.button} onPress={close}
          accessibilityRole="button" accessibilityLabel="오디오 닫기">
          <Ionicons name="close" size={20} color="#6B625B" />
        </Pressable>
      </View>
      {failed && <View style={styles.row}>
        <Text accessibilityRole="alert" style={styles.text}>오디오를 불러오지 못했습니다</Text>
        <Pressable testID="audio-retry" style={styles.button} onPress={onRetry} accessibilityRole="button">
          <Text style={styles.text}>다시 시도</Text>
        </Pressable>
      </View>}
      {speedMenu && <View style={styles.rates}>
        {PLAYBACK_RATES.map(option => <Pressable key={option} testID={`audio-rate-${option}`} style={styles.button}
          accessibilityRole="button" accessibilityLabel={`재생 속도 ${option}배`}
          accessibilityState={{ selected: rate === option }} onPress={() => {
            setRate(option); setSpeedMenu(false); command('rate', option); onRateChange?.(option);
          }}><Text style={[styles.text, rate === option && styles.selected]}>{option}x</Text></Pressable>)}
      </View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#FFFFFF', borderTopWidth: 1, borderColor: '#E9E4DE', paddingHorizontal: 8 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  button: { minWidth: 48, minHeight: 48, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  seek: { flex: 1, minWidth: 48, minHeight: 48, justifyContent: 'center' },
  track: { height: 4, backgroundColor: '#E9E4DE', borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, backgroundColor: '#2A1111' },
  media: { position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' },
  time: { color: '#6B625B', fontSize: 11, fontVariant: ['tabular-nums'], marginHorizontal: 4 },
  text: { color: '#6B625B', fontSize: 13 },
  selected: { color: '#2A1111', fontWeight: '700' },
  rates: { flexDirection: 'row', flexWrap: 'wrap' },
  fallback: { flex: 1 },
});
