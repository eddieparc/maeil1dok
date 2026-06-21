import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const readSource = (path) => readFile(new URL(path, import.meta.url), 'utf8');

const [
  biblePageSource,
  cardSource,
  modalSource,
  shareComposableSource,
] = await Promise.all([
  readSource('../app/pages/bible/index.vue'),
  readSource('../app/components/bible/TongdokCertificationCard.vue'),
  readSource('../app/components/bible/TongdokCertificationModal.vue'),
  readSource('../app/composables/useCertificationShare.ts'),
]);

const assertContract = (source, pattern, message) => {
  assert.match(source, pattern, message);
};

test('certification card renders the team memo copy with accessible summary and design tokens', () => {
  for (const label of [
    '매일일독',
    '오늘 통독 완료',
    '오늘도 말씀을 읽었습니다',
    '매일 말씀을 읽는 작은 습관',
  ]) {
    assertContract(cardSource, new RegExp(label), `card should render "${label}"`);
  }

  assertContract(
    cardSource,
    /(aria-label|sr-only|visually-hidden)[\s\S]{0,180}(매일일독|오늘 통독 완료|오늘도 말씀을 읽었습니다)/,
    'card should expose an accessible textual summary of the certification image',
  );
  assertContract(
    cardSource,
    /var\(--color-bg-primary\)|var\(--color-bg-card\)|var\(--color-bg-tertiary\)/,
    'card should use warm-paper surface tokens from DESIGN.md',
  );
  assertContract(
    cardSource,
    /var\(--color-accent-primary\)|var\(--primary-color\)/,
    'card should use the sage action/accent token from DESIGN.md',
  );
});

test('certification modal opens as a separate completion surface with required actions', () => {
  assertContract(modalSource, /title="통독 인증 카드"|title='통독 인증 카드'|>\s*통독 인증 카드\s*</, 'modal title should be 통독 인증 카드');
  assertContract(modalSource, /<TongdokCertificationCard[\s\S]*:certification=/, 'modal should render the certification card with fetched certification data');
  assertContract(modalSource, /\/api\/v1\/todos\/certification\/progress\//, 'modal should fetch the certification progress API');
  assertContract(modalSource, /plan_id:\s*props\.planId/, 'modal should request certification data for the completed plan');
  assertContract(modalSource, /schedule_id:\s*props\.scheduleId/, 'modal should request certification data for the completed schedule');

  for (const label of ['공유하기', '이미지 저장', '링크 복사']) {
    assertContract(modalSource, new RegExp(`>${label}<|${label}`), `modal should show "${label}" action`);
  }

  assertContract(modalSource, /shareCertification/, 'modal should call the share composable for the primary share action');
  assertContract(modalSource, /downloadCertificationImage/, 'modal should expose an image-save action');
  assertContract(modalSource, /copyCertificationLink/, 'modal should expose a link-copy action');
  assertContract(modalSource, /isCertificationActionDisabled/, 'modal should disable certification image actions until API certification data is loaded');
  assertContract(modalSource, /\/bible\/history/, 'link copy should point to certification history, not the generic plan page');
  assertContract(modalSource, /min-height:\s*44px|height:\s*44px/, 'modal action buttons should meet the 44px touch target contract');
});

test('completion success opens certification modal before plan navigation', () => {
  assertContract(biblePageSource, /TongdokCertificationModal/, 'Bible page should mount the certification modal');
  assertContract(biblePageSource, /showCertificationModal\s*=\s*ref\(false\)/, 'Bible page should keep certification modal state');
  assertContract(biblePageSource, /certificationContext\s*=\s*ref/, 'Bible page should keep the completed plan/schedule context for the certification modal');
  assertContract(biblePageSource, /:plan-id="certificationContext\.planId"/, 'Bible page should pass completed plan id to the certification modal');
  assertContract(biblePageSource, /:schedule-id="certificationContext\.scheduleId"/, 'Bible page should pass completed schedule id to the certification modal');
  assertContract(
    biblePageSource,
    /const handleTongdokComplete[\s\S]*const completionContext = getCertificationContext\(\);[\s\S]*const success = await completeReading\(\);[\s\S]*if \(success\) \{[\s\S]*openCertificationModal\(completionContext\);[\s\S]*\}/,
    'successful manual completion should open certification modal',
  );
  assertContract(
    biblePageSource,
    /const handleTongdokComplete[\s\S]*if \(success\) \{(?![\s\S]{0,180}router\.push\('\/plan'\))/,
    'manual completion should not immediately navigate to /plan before the certification modal is shown',
  );
  assertContract(
    biblePageSource,
    /const handleCertificationClose[\s\S]*showCertificationModal\.value = false;[\s\S]*router\.push\('\/plan'\)/,
    'closing certification should continue to /plan after the user sees the modal',
  );
  assertContract(
    biblePageSource,
    /const handleNextScheduleAction[\s\S]*const completionContext = getCertificationContext\(\);[\s\S]*openCertificationModal\(completionContext,[\s\S]*continueToNextUnreadSchedule\(planId\)/,
    'next-schedule completion should show certification before continuing to the next unread schedule',
  );
});

test('certification share fallback order handles image errors, Web Share, download, and link copy', () => {
  assertContract(shareComposableSource, /export const useCertificationShare/, 'share helper should be a named composable export');
  assertContract(shareComposableSource, /canvas\.toBlob|toBlob\(/, 'share helper should render the card as a PNG blob');
  assertContract(shareComposableSource, /CertificationSharePayload/, 'share helper should accept certification content for the generated PNG');
  assertContract(shareComposableSource, /\/bible\/history/, 'share helper should build a certification history link');
  assertContract(shareComposableSource, /new File\(\[[^\]]*blob[^\]]*\][\s\S]*image\/png/, 'Web Share path should create a PNG File');
  assertContract(shareComposableSource, /navigator\.canShare\(\{\s*files/, 'share helper should gate Web Share file support');
  assertContract(
    shareComposableSource,
    /try \{[\s\S]*blob = await createCertificationPngBlob\(payload\);[\s\S]*\} catch \(error\) \{[\s\S]*await copyCertificationLink\(link\);[\s\S]*return 'copied';/,
    'image-generation failure should fall back to a certification link copy',
  );

  const webShareIndex = shareComposableSource.indexOf('navigator.share');
  const downloadIndex = shareComposableSource.indexOf('downloadCertificationImage');

  assert.ok(webShareIndex >= 0, 'share helper should try navigator.share');
  assert.ok(downloadIndex > webShareIndex, 'PNG download fallback should come after Web Share file');
  assertContract(shareComposableSource, /navigator\.clipboard\.writeText/, 'final fallback should copy the certification link');
});

test('existing verse selection share behavior remains isolated', () => {
  assertContract(biblePageSource, /const handleShareAction = async \(selection: SelectionSharePayload\)/, 'verse selection share handler should remain');
  assertContract(biblePageSource, /generateShareUrl\(verseRange\)/, 'verse selection share should keep using verse-range URLs');
  assertContract(biblePageSource, /@share="handleShareAction"/, 'Bible reader should keep wiring selection share to the existing handler');
  assert.doesNotMatch(
    biblePageSource.match(/const handleShareAction[\s\S]*?};/)?.[0] ?? '',
    /useCertificationShare|shareCertification|TongdokCertification/,
    'verse selection sharing should not be routed through the certification share helper',
  );
});
