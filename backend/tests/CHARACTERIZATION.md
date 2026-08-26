# Backend HTTP characterization suite

This suite walks the active Django URLconf and calls every leaf route through
`APIClient`. It records the status observed by an anonymous client, an owner,
and a non-owner. For HTTP 200 responses it records only normalized structure:
keys, scalar types, list lengths/element shapes, and placeholders for IDs,
timestamps, UUIDs, and tokens.

The harness deliberately does not call view functions, serializers, service
functions, or authorization helpers. ORM use is limited to deterministic test
fixture setup; all contract observations are made at the HTTP boundary.

## Run

```sh
cd backend && SECRET_KEY=test KAKAO_CLIENT_ID=test KAKAO_REDIRECT_URI=http://localhost DJANGO_SETTINGS_MODULE=config.test_settings .venv/bin/python manage.py test tests.test_api_characterization
```

## Update the golden

Review source changes first, then update with one command:

```sh
cd backend && SECRET_KEY=test KAKAO_CLIENT_ID=test KAKAO_REDIRECT_URI=http://localhost DJANGO_SETTINGS_MODULE=config.test_settings UPDATE_CHARACTERIZATION_GOLDEN=1 .venv/bin/python manage.py test tests.test_api_characterization
```

A newly registered route appears automatically in the URLconf walk and causes a
golden diff. Routes that cannot be called deterministically are listed, by full
URL pattern and with an individual reason, in
`tests/characterization_exclusions.py`.
