"""Response-contract tests for ``POST /api/v1/auth/social-login/v2/``.

Why this file exists
--------------------
``mobile/App.tsx`` calls this endpoint from three places (Kakao 265, Apple 351,
code-exchange 396). The mobile shell has no types and no schema validation, and
rolling it back costs an app redeploy (OTA reach unconfirmed, worst case a store
review). It is therefore the most expensive consumer to break.

The stage-0 golden (``backend/tests/golden/api_characterization.json``) excludes
this route because it calls Kakao / Google / Apple. That exclusion stays valid —
this file is the separate safety net recommended in ``docs/contract-consumers.md``
§5. **Do not fold these cases into the golden.**

What is pinned
--------------
* success status code (200) and ``Content-Type``
* the exact JSON key set and value types the shell parses, for
  - existing-user login,
  - auto-signup of a brand new user,
  - the different ``needsSignup`` payload a new user gets without ``auto_signup``
* the auth cookies the shell relies on (``credentials: 'include'``) and every
  attribute of them: name, HttpOnly, Secure, SameSite, Path, Max-Age, Domain
* failure responses (status + body) for an invalid token per provider

Determinism
-----------
Every outbound provider call is mocked at the real network boundary:
``accounts.views.requests.get`` / ``.post`` for Kakao and Google (routed by URL,
unknown URLs raise), and ``jwt.PyJWKClient`` for Apple's JWKS fetch. Apple tokens
are genuinely RS256-signed by a throwaway key in this process, so the production
``jwt.decode`` audience/issuer/expiry verification really runs. No socket is
opened.
"""

from __future__ import annotations

import time
from contextlib import contextmanager
from unittest.mock import patch

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APITestCase

from accounts.models import SocialAccount

User = get_user_model()

SOCIAL_LOGIN_V2_URL = "/api/v1/auth/social-login/v2/"

KAKAO_TOKEN_URL = "https://kauth.kakao.com/oauth/token"
KAKAO_USERINFO_URL = "https://kapi.kakao.com/v2/user/me"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys"
APPLE_ISSUER = "https://appleid.apple.com"

# accounts.views falls back to this bundle id when APPLE_IOS_BUNDLE_ID is unset;
# it is the audience the iOS shell's identity tokens actually carry.
APPLE_IOS_BUNDLE_ID = "com.maeil1dok.app"
APPLE_SERVICES_ID = "app.maeil1dok.services"


# ---------------------------------------------------------------------------
# Provider boundary doubles
# ---------------------------------------------------------------------------


class _StubHTTPResponse:
    """Minimal stand-in for ``requests.Response`` (only ``.json`` / ``.status_code``)."""

    def __init__(self, payload, status_code=200):
        self._payload = payload
        self.status_code = status_code

    def json(self):
        return self._payload


class FakeProviderNetwork:
    """Routes ``requests`` calls by URL. Any unregistered URL fails the test.

    This is the guard that keeps the suite deterministic: if production code
    starts calling a provider endpoint nobody mocked, the test explodes instead
    of quietly reaching the internet.
    """

    def __init__(self, get_map=None, post_map=None):
        self.get_map = dict(get_map or {})
        self.post_map = dict(post_map or {})
        self.calls = []

    def get(self, url, **kwargs):
        return self._dispatch("GET", self.get_map, url, kwargs)

    def post(self, url, **kwargs):
        return self._dispatch("POST", self.post_map, url, kwargs)

    def _dispatch(self, method, table, url, kwargs):
        self.calls.append((method, url, kwargs))
        if url not in table:
            raise AssertionError(
                f"unmocked outbound {method} {url} — the contract test would hit the network"
            )
        payload = table[url]
        if isinstance(payload, _StubHTTPResponse):
            return payload
        return _StubHTTPResponse(payload)


@contextmanager
def mocked_provider_http(get_map=None, post_map=None):
    network = FakeProviderNetwork(get_map=get_map, post_map=post_map)
    with (
        patch("accounts.views.requests.get", new=network.get),
        patch("accounts.views.requests.post", new=network.post),
    ):
        yield network


_APPLE_PRIVATE_KEY = None


def _apple_private_key():
    global _APPLE_PRIVATE_KEY
    if _APPLE_PRIVATE_KEY is None:
        _APPLE_PRIVATE_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    return _APPLE_PRIVATE_KEY


def make_apple_id_token(
    sub,
    email=None,
    email_verified=True,
    audience=APPLE_IOS_BUNDLE_ID,
    issuer=APPLE_ISSUER,
    lifetime=3600,
    key=None,
):
    """Produce a real RS256 Apple-shaped id_token signed by the throwaway key."""
    now = int(time.time())
    claims = {
        "iss": issuer,
        "aud": audience,
        "sub": sub,
        "iat": now,
        "exp": now + lifetime,
    }
    if email is not None:
        claims["email"] = email
        claims["email_verified"] = email_verified
    return jwt.encode(claims, key or _apple_private_key(), algorithm="RS256")


class _StubSigningKey:
    def __init__(self, key):
        self.key = key


class _StubJWKClient:
    """Replaces ``jwt.PyJWKClient`` so Apple's JWKS endpoint is never fetched."""

    constructed_with = []

    def __init__(self, url, *args, **kwargs):
        type(self).constructed_with.append(url)
        self.url = url

    def get_signing_key_from_jwt(self, token):
        return _StubSigningKey(_apple_private_key().public_key())


@contextmanager
def mocked_apple_jwks():
    _StubJWKClient.constructed_with = []
    # get_apple_user_info does `from jwt import PyJWKClient` at call time, so the
    # attribute on the jwt module is the boundary to replace.
    with patch("jwt.PyJWKClient", new=_StubJWKClient):
        yield _StubJWKClient


# ---------------------------------------------------------------------------
# Base case with the contract assertions
# ---------------------------------------------------------------------------


@override_settings(
    DEBUG=False,
    COOKIE_SAMESITE="Lax",
    COOKIE_DOMAIN=None,
    KAKAO_CLIENT_ID="kakao-client",
    KAKAO_REDIRECT_URI="https://app.maeil1dok.test/auth/kakao/callback",
    GOOGLE_CLIENT_ID="google-client",
    GOOGLE_CLIENT_SECRET="google-secret",
    GOOGLE_REDIRECT_URI="https://app.maeil1dok.test/auth/google/callback",
    APPLE_CLIENT_ID=APPLE_SERVICES_ID,
)
class SocialLoginV2ContractTestCase(APITestCase):
    """Shared contract assertions. Subclasses cover one provider each."""

    # Keys the mobile shell reads off a successful login.
    SUCCESS_KEYS = {"refresh", "access", "user"}
    USER_KEYS = {
        "id",
        "username",
        "nickname",
        "email",
        "profile_image",
        "is_staff",
        "email_verified",
        "has_usable_password_flag",
    }
    # Keys the shell reads when it must bounce the user to the signup web page.
    NEEDS_SIGNUP_KEYS = {
        "needsSignup",
        "provider",
        "provider_id",
        "email",
        "suggested_nickname",
        "profile_image",
        "signup_token",
    }
    # name -> Max-Age in seconds
    AUTH_COOKIES = {"access_token": 3600, "refresh_token": 60 * 60 * 24 * 30}

    def post_social_login(self, payload):
        return self.client.post(SOCIAL_LOGIN_V2_URL, payload, format="json")

    # -- assertions ---------------------------------------------------------

    def assert_token_success_contract(self, response):
        """200 + {access, refresh, user} + auth cookies. The shell's happy path."""
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response["Content-Type"].startswith("application/json"))

        body = response.json()
        self.assertEqual(set(body), self.SUCCESS_KEYS)

        for key in ("access", "refresh"):
            self.assertIsInstance(body[key], str)
            self.assertTrue(body[key])
            # The shell forwards these to /auth/session/issue/ and
            # /auth/token/refresh/, so they must stay JWTs.
            self.assertEqual(body[key].count("."), 2, f"{key} is not a JWT")

        user = body["user"]
        self.assertIsInstance(user, dict)
        self.assertEqual(set(user), self.USER_KEYS)
        self.assertIsInstance(user["id"], int)
        self.assertIsInstance(user["username"], str)
        self.assertIsInstance(user["nickname"], str)
        self.assertIsInstance(user["email"], str)
        self.assertIsInstance(user["profile_image"], (str, type(None)))
        self.assertIsInstance(user["is_staff"], bool)
        self.assertIsInstance(user["email_verified"], bool)
        self.assertIsInstance(user["has_usable_password_flag"], bool)

        self.assert_auth_cookie_contract(response)
        return body

    def assert_auth_cookie_contract(self, response, expected_domain=""):
        """Every attribute the shell's cookie jar and the web view depend on."""
        for name, max_age in self.AUTH_COOKIES.items():
            self.assertIn(name, response.cookies, f"missing {name} cookie")
            cookie = response.cookies[name]
            self.assertTrue(cookie.value, f"{name} cookie is empty")
            self.assertTrue(cookie["httponly"], f"{name} must be HttpOnly")
            self.assertTrue(cookie["secure"], f"{name} must be Secure")
            self.assertEqual(cookie["samesite"], "Lax", f"{name} SameSite changed")
            self.assertEqual(cookie["path"], "/", f"{name} Path changed")
            self.assertEqual(int(cookie["max-age"]), max_age, f"{name} Max-Age changed")
            self.assertTrue(cookie["expires"], f"{name} must carry Expires")
            self.assertEqual(cookie["domain"], expected_domain, f"{name} Domain changed")

    def assert_no_auth_cookies(self, response):
        for name in self.AUTH_COOKIES:
            self.assertNotIn(name, response.cookies)

    def assert_needs_signup_contract(self, response, provider, provider_id):
        """The second branch the shell handles: build a signup URL, no session."""
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(set(body), self.NEEDS_SIGNUP_KEYS)
        self.assertIs(body["needsSignup"], True)
        self.assertEqual(body["provider"], provider)
        self.assertEqual(body["provider_id"], provider_id)
        self.assertIsInstance(body["email"], (str, type(None)))
        self.assertIsInstance(body["suggested_nickname"], (str, type(None)))
        self.assertIsInstance(body["profile_image"], (str, type(None)))
        self.assertIsInstance(body["signup_token"], str)
        self.assertTrue(body["signup_token"])
        self.assert_no_auth_cookies(response)
        return body

    def assert_error_contract(self, response, status_code=400, message=None):
        """Failure body the shell surfaces through ``data.error``."""
        self.assertEqual(response.status_code, status_code)
        body = response.json()
        self.assertEqual(set(body), {"error"})
        self.assertIsInstance(body["error"], str)
        self.assertTrue(body["error"])
        if message is not None:
            self.assertEqual(body["error"], message)
        self.assert_no_auth_cookies(response)
        return body

    # -- fixtures -----------------------------------------------------------

    def create_linked_user(self, provider, provider_id, *, nickname, email):
        user = User.objects.create(
            username=f"{provider}_{provider_id}",
            nickname=nickname,
            email=email,
            email_verified=True,
            profile_image="https://cdn.maeil1dok.test/existing.png",
        )
        SocialAccount.objects.create(
            user=user,
            provider=provider,
            provider_id=provider_id,
            email=email,
            profile_image="https://cdn.maeil1dok.test/existing.png",
            extra_data={},
        )
        return user


# ---------------------------------------------------------------------------
# Kakao — mobile/App.tsx:265 sends {provider, access_token, auto_signup}
# ---------------------------------------------------------------------------


class KakaoSocialLoginV2ContractTests(SocialLoginV2ContractTestCase):
    PROVIDER = "kakao"

    def kakao_userinfo(self, provider_id="kakao-1001", email="kakao-new@example.com"):
        return {
            "id": provider_id,
            "kakao_account": {"email": email},
            "properties": {
                "nickname": "카카오독자",
                "profile_image": "https://cdn.kakao.test/profile.png",
            },
        }

    def test_native_token_auto_signup_returns_token_pair_and_auth_cookies(self):
        with mocked_provider_http(get_map={KAKAO_USERINFO_URL: self.kakao_userinfo()}) as network:
            response = self.post_social_login(
                {"provider": "kakao", "access_token": "kakao-native-token", "auto_signup": True}
            )

        # The provider boundary really was exercised.
        self.assertEqual([call[1] for call in network.calls], [KAKAO_USERINFO_URL])

        body = self.assert_token_success_contract(response)
        self.assertEqual(body["user"]["nickname"], "카카오독자")
        self.assertEqual(body["user"]["email"], "kakao-new@example.com")
        self.assertTrue(body["user"]["email_verified"])
        self.assertFalse(body["user"]["has_usable_password_flag"])
        self.assertTrue(SocialAccount.objects.filter(provider="kakao", provider_id="kakao-1001").exists())

    def test_existing_user_login_returns_same_shape_as_signup(self):
        self.create_linked_user(
            "kakao", "kakao-1001", nickname="기존카카오독자", email="kakao-existing@example.com"
        )

        with mocked_provider_http(get_map={KAKAO_USERINFO_URL: self.kakao_userinfo()}):
            response = self.post_social_login(
                {"provider": "kakao", "access_token": "kakao-native-token", "auto_signup": True}
            )

        body = self.assert_token_success_contract(response)
        # Existing accounts keep their own profile — the provider payload does not
        # overwrite it — but the envelope is identical to the signup response.
        self.assertEqual(body["user"]["nickname"], "기존카카오독자")
        self.assertEqual(body["user"]["email"], "kakao-existing@example.com")
        self.assertEqual(User.objects.filter(username="kakao_kakao-1001").count(), 1)

    def test_code_exchange_without_auto_signup_returns_needs_signup_payload(self):
        # mobile/App.tsx:396 — {provider, code, redirect_uri}, no auto_signup.
        with mocked_provider_http(
            post_map={KAKAO_TOKEN_URL: {"access_token": "exchanged-token"}},
            get_map={KAKAO_USERINFO_URL: self.kakao_userinfo()},
        ) as network:
            response = self.post_social_login(
                {
                    "provider": "kakao",
                    "code": "kakao-auth-code",
                    "redirect_uri": "https://app.maeil1dok.test/auth/kakao/callback",
                }
            )

        self.assertEqual(
            [call[1] for call in network.calls], [KAKAO_TOKEN_URL, KAKAO_USERINFO_URL]
        )
        body = self.assert_needs_signup_contract(response, "kakao", "kakao-1001")
        self.assertEqual(body["suggested_nickname"], "카카오독자")
        self.assertEqual(body["email"], "kakao-new@example.com")
        self.assertEqual(body["profile_image"], "https://cdn.kakao.test/profile.png")
        self.assertFalse(User.objects.filter(username="kakao_kakao-1001").exists())

    def test_invalid_access_token_returns_generic_error(self):
        with mocked_provider_http(
            get_map={KAKAO_USERINFO_URL: {"msg": "this access token does not exist", "code": -401}}
        ):
            response = self.post_social_login(
                {"provider": "kakao", "access_token": "expired-token", "auto_signup": True}
            )

        self.assert_error_contract(response, 400, "로그인 처리 중 오류가 발생했습니다.")
        self.assertFalse(User.objects.exists())

    def test_missing_code_and_access_token_returns_error(self):
        response = self.post_social_login({"provider": "kakao"})
        self.assert_error_contract(response, 400, "code 또는 access_token이 필요합니다.")

    def test_cookie_domain_is_propagated_when_configured(self):
        with override_settings(COOKIE_DOMAIN=".maeil1dok.app"):
            with mocked_provider_http(get_map={KAKAO_USERINFO_URL: self.kakao_userinfo()}):
                response = self.post_social_login(
                    {"provider": "kakao", "access_token": "kakao-native-token", "auto_signup": True}
                )

        self.assertEqual(response.status_code, 200)
        self.assert_auth_cookie_contract(response, expected_domain=".maeil1dok.app")


# ---------------------------------------------------------------------------
# Google — mobile/App.tsx:396 code exchange, plus the native access_token path
# ---------------------------------------------------------------------------


class GoogleSocialLoginV2ContractTests(SocialLoginV2ContractTestCase):
    PROVIDER = "google"

    def google_userinfo(self, sub="google-2002", email="google-new@example.com"):
        return {
            "sub": sub,
            "email": email,
            "email_verified": True,
            "name": "구글독자",
            "picture": "https://cdn.google.test/profile.png",
        }

    def test_native_token_auto_signup_returns_token_pair_and_auth_cookies(self):
        with mocked_provider_http(get_map={GOOGLE_USERINFO_URL: self.google_userinfo()}) as network:
            response = self.post_social_login(
                {"provider": "google", "access_token": "google-native-token", "auto_signup": True}
            )

        self.assertEqual([call[1] for call in network.calls], [GOOGLE_USERINFO_URL])
        body = self.assert_token_success_contract(response)
        self.assertEqual(body["user"]["nickname"], "구글독자")
        self.assertEqual(body["user"]["email"], "google-new@example.com")
        self.assertTrue(SocialAccount.objects.filter(provider="google", provider_id="google-2002").exists())

    def test_existing_user_login_returns_same_shape_as_signup(self):
        self.create_linked_user(
            "google", "google-2002", nickname="기존구글독자", email="google-existing@example.com"
        )

        with mocked_provider_http(get_map={GOOGLE_USERINFO_URL: self.google_userinfo()}):
            response = self.post_social_login(
                {"provider": "google", "access_token": "google-native-token", "auto_signup": True}
            )

        body = self.assert_token_success_contract(response)
        self.assertEqual(body["user"]["nickname"], "기존구글독자")
        self.assertEqual(User.objects.filter(username="google_google-2002").count(), 1)

    def test_code_exchange_without_auto_signup_returns_needs_signup_payload(self):
        with mocked_provider_http(
            post_map={GOOGLE_TOKEN_URL: {"access_token": "exchanged-token"}},
            get_map={GOOGLE_USERINFO_URL: self.google_userinfo()},
        ) as network:
            response = self.post_social_login(
                {
                    "provider": "google",
                    "code": "google-auth-code",
                    "redirect_uri": "https://app.maeil1dok.test/auth/google/callback",
                }
            )

        self.assertEqual(
            [call[1] for call in network.calls], [GOOGLE_TOKEN_URL, GOOGLE_USERINFO_URL]
        )
        body = self.assert_needs_signup_contract(response, "google", "google-2002")
        self.assertEqual(body["suggested_nickname"], "구글독자")
        self.assertEqual(body["profile_image"], "https://cdn.google.test/profile.png")
        self.assertFalse(User.objects.filter(username="google_google-2002").exists())

    def test_invalid_access_token_returns_missing_account_error(self):
        # Google's userinfo endpoint answers 401 with an error document; the view
        # finds no `sub` and reports this specific message to the shell.
        with mocked_provider_http(
            get_map={
                GOOGLE_USERINFO_URL: _StubHTTPResponse(
                    {"error": "invalid_token", "error_description": "Invalid Credentials"},
                    status_code=401,
                )
            }
        ):
            response = self.post_social_login(
                {"provider": "google", "access_token": "expired-token", "auto_signup": True}
            )

        self.assert_error_contract(response, 400, "소셜 계정 정보를 가져올 수 없습니다.")
        self.assertFalse(User.objects.exists())


# ---------------------------------------------------------------------------
# Apple — mobile/App.tsx:351 sends {provider, id_token, full_name, auto_signup}
# ---------------------------------------------------------------------------


class AppleSocialLoginV2ContractTests(SocialLoginV2ContractTestCase):
    PROVIDER = "apple"

    def test_identity_token_auto_signup_returns_token_pair_and_auth_cookies(self):
        id_token = make_apple_id_token("apple-3003", email="apple-new@example.com")

        with mocked_apple_jwks() as jwks_client:
            response = self.post_social_login(
                {
                    "provider": "apple",
                    "id_token": id_token,
                    "full_name": "사도 요한",
                    "auto_signup": True,
                }
            )

        # JWKS was resolved through the mocked client, not the network.
        self.assertEqual(jwks_client.constructed_with, [APPLE_JWKS_URL])

        body = self.assert_token_success_contract(response)
        self.assertEqual(body["user"]["email"], "apple-new@example.com")
        # 셸(`mobile/App.tsx:357`)은 `full_name`으로 보내고 웹/문서는 `user_name`을 쓴다.
        # 뷰가 둘 다 수용하므로 셸이 보낸 이름이 닉네임이 된다.
        # (이전에는 `user_name`만 읽어 애플 가입자가 항상 기본값 "사용자"였다.)
        self.assertEqual(body["user"]["nickname"], "사도 요한")
        self.assertEqual(body["user"]["profile_image"], "")
        self.assertTrue(SocialAccount.objects.filter(provider="apple", provider_id="apple-3003").exists())

    def test_services_id_audience_is_accepted(self):
        id_token = make_apple_id_token(
            "apple-3004", email="apple-web@example.com", audience=APPLE_SERVICES_ID
        )

        with mocked_apple_jwks():
            response = self.post_social_login(
                {"provider": "apple", "id_token": id_token, "auto_signup": True}
            )

        self.assert_token_success_contract(response)

    def test_existing_user_login_returns_same_shape_as_signup(self):
        self.create_linked_user(
            "apple", "apple-3003", nickname="기존애플독자", email="apple-existing@example.com"
        )
        id_token = make_apple_id_token("apple-3003", email="apple-new@example.com")

        with mocked_apple_jwks():
            response = self.post_social_login(
                {"provider": "apple", "id_token": id_token, "auto_signup": True}
            )

        body = self.assert_token_success_contract(response)
        self.assertEqual(body["user"]["nickname"], "기존애플독자")
        self.assertEqual(User.objects.filter(username="apple_apple-3003").count(), 1)

    def test_without_auto_signup_returns_needs_signup_payload(self):
        id_token = make_apple_id_token("apple-3003", email="apple-new@example.com")

        with mocked_apple_jwks():
            response = self.post_social_login({"provider": "apple", "id_token": id_token})

        body = self.assert_needs_signup_contract(response, "apple", "apple-3003")
        self.assertEqual(body["email"], "apple-new@example.com")
        self.assertEqual(body["suggested_nickname"], "")
        self.assertIsNone(body["profile_image"])
        self.assertFalse(User.objects.filter(username="apple_apple-3003").exists())

    def test_needs_signup_propagates_the_shell_supplied_name(self):
        """셸이 보낸 이름이 가입 화면 프리필까지 전달되는지 고정한다.

        `mobile/App.tsx:357` 은 `full_name` 으로 이름을 보내고, 같은 파일 377행에서
        needsSignup 응답의 `suggested_nickname` 으로 가입 화면 URL 을 만든다.
        뷰가 `user_name` 만 읽던 시절에는 이 값이 늘 비어 있어 프리필이 죽어 있었다.
        auto_signup 경로는 위 테스트가 잡지만 이 경로는 값이 고정돼 있지 않아
        되돌아가도 아무도 모른다.
        """
        id_token = make_apple_id_token("apple-3006", email="apple-prefill@example.com")

        with mocked_apple_jwks():
            response = self.post_social_login(
                {"provider": "apple", "id_token": id_token, "full_name": "사도 바울"}
            )

        body = self.assert_needs_signup_contract(response, "apple", "apple-3006")
        self.assertEqual(body["suggested_nickname"], "사도 바울")
        self.assertFalse(User.objects.filter(username="apple_apple-3006").exists())

    def test_needs_signup_accepts_the_documented_name_field_too(self):
        """문서·웹이 쓰는 `user_name` 도 같은 자리에 도달해야 한다."""
        id_token = make_apple_id_token("apple-3007", email="apple-doc@example.com")

        with mocked_apple_jwks():
            response = self.post_social_login(
                {"provider": "apple", "id_token": id_token, "user_name": "사도 베드로"}
            )

        body = self.assert_needs_signup_contract(response, "apple", "apple-3007")
        self.assertEqual(body["suggested_nickname"], "사도 베드로")

    def test_relay_email_signup_keeps_the_success_contract(self):
        id_token = make_apple_id_token(
            "apple-3005", email="relay-abc@privaterelay.appleid.com"
        )

        with mocked_apple_jwks():
            response = self.post_social_login(
                {"provider": "apple", "id_token": id_token, "auto_signup": True}
            )

        body = self.assert_token_success_contract(response)
        self.assertEqual(body["user"]["email"], "relay-abc@privaterelay.appleid.com")

    def test_expired_identity_token_returns_generic_error(self):
        id_token = make_apple_id_token(
            "apple-3003", email="apple-new@example.com", lifetime=-60
        )

        with mocked_apple_jwks():
            response = self.post_social_login(
                {"provider": "apple", "id_token": id_token, "auto_signup": True}
            )

        self.assert_error_contract(response, 400, "로그인 처리 중 오류가 발생했습니다.")
        self.assertFalse(User.objects.exists())

    def test_foreign_signing_key_returns_generic_error(self):
        forged = make_apple_id_token(
            "apple-3003",
            email="apple-new@example.com",
            key=rsa.generate_private_key(public_exponent=65537, key_size=2048),
        )

        with mocked_apple_jwks():
            response = self.post_social_login(
                {"provider": "apple", "id_token": forged, "auto_signup": True}
            )

        self.assert_error_contract(response, 400, "로그인 처리 중 오류가 발생했습니다.")
        self.assertFalse(User.objects.exists())

    def test_missing_identity_token_returns_specific_error(self):
        response = self.post_social_login({"provider": "apple", "auto_signup": True})
        self.assert_error_contract(response, 400, "Apple 로그인에는 id_token이 필요합니다.")


# ---------------------------------------------------------------------------
# Provider-independent contract
# ---------------------------------------------------------------------------


class SocialLoginV2SharedContractTests(SocialLoginV2ContractTestCase):
    def test_unsupported_provider_returns_error(self):
        response = self.post_social_login(
            {"provider": "naver", "access_token": "whatever", "auto_signup": True}
        )
        self.assert_error_contract(response, 400, "지원하지 않는 소셜 제공자입니다.")

    def test_missing_provider_returns_field_validation_errors(self):
        # Serializer-level rejection has a different body shape (field -> messages),
        # so `data.error` is undefined and the shell shows its fallback message.
        response = self.post_social_login({"access_token": "whatever"})

        self.assertEqual(response.status_code, 400)
        body = response.json()
        self.assertEqual(set(body), {"provider"})
        self.assertIsInstance(body["provider"], list)
        self.assert_no_auth_cookies(response)
