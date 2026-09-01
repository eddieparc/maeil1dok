import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const [alertModal, modalContainer, appleSetup] = await Promise.all([
  readFile(
    new URL('../app/components/ui/modal/AlertModal.vue', import.meta.url),
    'utf8',
  ),
  readFile(
    new URL('../app/components/ui/modal/ModalContainer.vue', import.meta.url),
    'utf8',
  ),
  readFile(
    new URL('../app/pages/auth/apple/setup.vue', import.meta.url),
    'utf8',
  ),
]);

test('detailed error modal exposes description and copyable request id accessibly', () => {
  assert.match(alertModal, /modal-description-/);
  assert.match(alertModal, /copyText/);
  assert.match(alertModal, /오류 ID 복사/);
  assert.match(alertModal, /white-space:\s*pre-line/);
  assert.match(alertModal, /word-break:\s*keep-all/);
  assert.match(alertModal, /overflow-wrap:\s*anywhere/);
  assert.match(alertModal, /copyStatus\.value = 'failed'/);
  assert.match(modalContainer, /aria-describedby/);
});

test('Apple nickname validation is announced and linked to the input', () => {
  assert.match(appleSetup, /aria-invalid/);
  assert.match(appleSetup, /aria-describedby="apple-nickname-status"/);
  assert.match(appleSetup, /aria-live="polite"/);
  assert.match(appleSetup, /copyText:\s*signupError\.requestId/);
});
