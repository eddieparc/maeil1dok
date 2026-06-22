from dataclasses import dataclass
from ipaddress import ip_address
from typing import Final
from urllib.parse import urlsplit


ALLOWED_PUSH_SERVICE_HOSTS: Final[frozenset[str]] = frozenset({
    'fcm.googleapis.com',
    'updates.push.services.mozilla.com',
    'updates-autopush.stage.mozaws.net',
    'web.push.apple.com',
})


@dataclass(frozen=True, slots=True)
class InvalidPushEndpoint(Exception):
    message: str

    def __str__(self) -> str:
        return self.message


def validate_push_endpoint_url(value: str) -> str:
    parsed = urlsplit(value)
    if parsed.scheme != 'https':
        raise InvalidPushEndpoint('푸시 구독 endpoint는 HTTPS여야 합니다.')
    if parsed.username is not None or parsed.password is not None:
        raise InvalidPushEndpoint('푸시 구독 endpoint에 사용자 정보는 사용할 수 없습니다.')

    host = parsed.hostname
    if host is None:
        raise InvalidPushEndpoint('푸시 구독 endpoint host가 필요합니다.')

    normalized_host = host.rstrip('.').lower()
    try:
        port = parsed.port
    except ValueError as exc:
        raise InvalidPushEndpoint('푸시 구독 endpoint port가 올바르지 않습니다.') from exc

    if port is not None and port != 443:
        raise InvalidPushEndpoint('푸시 구독 endpoint는 표준 HTTPS port만 사용할 수 있습니다.')
    if _is_ip_address(normalized_host):
        raise InvalidPushEndpoint('푸시 구독 endpoint는 IP 주소를 사용할 수 없습니다.')
    if normalized_host not in ALLOWED_PUSH_SERVICE_HOSTS:
        raise InvalidPushEndpoint('지원하는 브라우저 푸시 서비스 endpoint만 등록할 수 있습니다.')

    return value


def _is_ip_address(host: str) -> bool:
    try:
        ip_address(host)
    except ValueError:
        return False
    return True
