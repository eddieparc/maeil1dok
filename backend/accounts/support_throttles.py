"""Endpoint-local, cache-backed intake limits; never trust caller-supplied XFF."""
from rest_framework.throttling import SimpleRateThrottle


class SupportInquiryThrottle(SimpleRateThrottle):
    scope = 'support_inquiry'
    rate = '5/hour'

    def get_cache_key(self, request, view):
        ident = (f'user:{request.user.pk}' if request.user.is_authenticated
                 else f'peer:{request.META.get("REMOTE_ADDR")}')
        return self.cache_format % {'scope': self.scope, 'ident': ident}


class SupportInquiryPeerThrottle(SimpleRateThrottle):
    scope = 'support_inquiry_peer'
    rate = '20/hour'

    def get_cache_key(self, request, view):
        return self.cache_format % {'scope': self.scope, 'ident': request.META.get('REMOTE_ADDR')}
