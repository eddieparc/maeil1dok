"""Operator-only beta mail spool. No HTTP reader and no provider fallback."""
from contextlib import contextmanager
from contextvars import ContextVar
from datetime import datetime, timezone
import fcntl
import json
import os
from pathlib import Path
import re
import stat
from uuid import uuid4

from django.conf import settings
from django.http import JsonResponse


_CAPTURE_RESULTS = ContextVar('beta_test_mail_results', default=None)
_RECORD_ID = re.compile(r'^[0-9a-f]{32}$')
_MAIL_ROUTES = {
    f'/api/v1/{prefix}/{action}/'
    for prefix in ('auth', 'accounts')
    for action in ('send-verification', 'resend-verification', 'request-password-reset')
}


def record_capture_result(success):
    results = _CAPTURE_RESULTS.get()
    if results is not None:
        results.append(success)


def _private_file(fd):
    info = os.fstat(fd)
    if (not stat.S_ISREG(info.st_mode) or info.st_uid != os.geteuid()
            or stat.S_IMODE(info.st_mode) != 0o600 or info.st_nlink != 1):
        raise ValueError('Test mail requires a private owner-only regular file')


@contextmanager
def private_directory(directory):
    """Walk with dirfds: reject symlink components and public/source locations."""
    path = Path(directory)
    if not path.is_absolute() or '..' in path.parts:
        raise ValueError('Test mail requires an absolute private directory')
    for root in (settings.BASE_DIR, getattr(settings, 'STATIC_ROOT', None), getattr(settings, 'MEDIA_ROOT', None)):
        if root and path.is_relative_to(Path(root).resolve()):
            raise ValueError('Test mail cannot be stored in source or public assets')
    fd = os.open('/', os.O_RDONLY | os.O_DIRECTORY)
    try:
        for component in path.parts[1:]:
            child = os.open(component, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
            os.close(fd)
            fd = child
        info = os.fstat(fd)
        if info.st_uid != os.geteuid() or stat.S_IMODE(info.st_mode) != 0o700:
            raise ValueError('Test mail directory must belong to this operator and have mode 0700')
        yield fd
    finally:
        os.close(fd)


def capture_message(message, purpose):
    """Return only after a durable private record exists; never silently discard."""
    identifier = uuid4().hex
    record = {
        'id': identifier,
        'transport': 'beta-spool',
        'delivery_status': 'captured_not_delivered',
        'created_at': datetime.now(timezone.utc).isoformat(),
        'purpose': purpose,
        'message': message,
    }
    payload = json.dumps(record, ensure_ascii=False).encode('utf-8')
    with private_directory(settings.BETA_TEST_MAIL_DIR) as directory:
        # Lock the existing directory inode; no racy shared lock-file creation.
        # Closing its descriptor releases the inter-process/thread flock.
        fcntl.flock(directory, fcntl.LOCK_EX)
        size = sum(os.stat(name, dir_fd=directory, follow_symlinks=False).st_size
                   for name in os.listdir(directory) if name.endswith(('.json', '.tmp')))
        if size + len(payload) > settings.BETA_TEST_MAIL_MAX_BYTES:
            raise ValueError('Test mail spool capacity exceeded')
        temporary = f'{identifier}.tmp'
        final = f'{identifier}.json'
        fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600, dir_fd=directory)
        published = False
        try:
            with os.fdopen(fd, 'wb') as output:
                output.write(payload)
                output.flush()
                os.fsync(output.fileno())
            os.rename(temporary, final, src_dir_fd=directory, dst_dir_fd=directory)
            published = True
            os.fsync(directory)
        except OSError:
            os.unlink(final if published else temporary, dir_fd=directory)
            raise


def read_capture(directory, identifier):
    if not _RECORD_ID.fullmatch(identifier):
        raise ValueError('Invalid test mail record ID')
    fd = os.open(f'{identifier}.json', os.O_RDONLY | os.O_NOFOLLOW, dir_fd=directory)
    with os.fdopen(fd, 'rb') as source:
        _private_file(source.fileno())
        record = json.load(source)
    if record['id'] != identifier or record['delivery_status'] != 'captured_not_delivered':
        raise ValueError('Invalid test mail capture')
    return record


def export_capture(record, destination):
    path = Path(destination)
    with private_directory(path.parent) as directory:
        fd = os.open(path.name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600, dir_fd=directory)
        try:
            with os.fdopen(fd, 'w') as output:
                json.dump(record, output, ensure_ascii=False, indent=2)
                output.flush()
                os.fsync(output.fileno())
        except OSError:
            os.unlink(path.name, dir_fd=directory)
            raise


class BetaTestMailMiddleware:
    """Beta-only receipt semantics, with no tokens/content exposed in responses.

    Primary public mail routes deliberately acknowledge requests even when no
    message is sent. In this synthetic sandbox only, a successful mail receipt
    requires actual capture. Failures/no eligible recipient share one response.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if getattr(settings, 'ACCOUNT_MAIL_TRANSPORT', 'resend') != 'beta-spool':
            return self.get_response(request)
        results = []
        context = _CAPTURE_RESULTS.set(results)
        try:
            response = self.get_response(request)
        finally:
            _CAPTURE_RESULTS.reset(context)
        mail_request = request.method == 'POST' and request.path in _MAIL_ROUTES
        if not mail_request and not results:
            return response
        captured = bool(results) and all(results)
        if mail_request and 200 <= response.status_code < 300:
            if captured:
                response = JsonResponse({'success': True, 'message': '베타 테스트 메일을 보관했어요. 실제 이메일은 발송하지 않았어요.'})
            else:
                response = JsonResponse({'success': False, 'error': 'beta_test_mail_not_captured',
                                         'message': '테스트 메일이 보관되지 않았어요. 운영자에게 확인해 주세요.'}, status=503)
        response['X-Beta-Test-Mail'] = 'captured_not_delivered' if captured else 'not_captured'
        response['Cache-Control'] = 'no-store'
        return response
