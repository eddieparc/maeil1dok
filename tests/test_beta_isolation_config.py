"""Offline deployment contract checks; never create containers or resolve DNS."""
import ast
from pathlib import Path
import re
import unittest

import yaml

ROOT = Path(__file__).resolve().parents[1]


class BetaIsolationConfigTests(unittest.TestCase):
    def setUp(self):
        self.compose = yaml.safe_load((ROOT / 'docker-compose.beta-isolated.yml').read_text())
        self.ingress = yaml.safe_load((ROOT / 'ops/beta/cloudflared.yml.example').read_text())['ingress']

    def route(self, hostname, path):
        for rule in self.ingress:
            if rule.get('hostname', hostname) != hostname:
                continue
            if 'path' in rule and not re.search(rule['path'], path):
                continue
            return rule['service']
        self.fail('missing terminal ingress rule')

    def test_only_versioned_api_and_exact_backend_health_reach_django(self):
        for path in ['/api/v1/auth/user/', '/api/v1/todos/admin/users/', '/api/v1/bible-cache/search/', '/health/']:
            with self.subTest(path=path):
                self.assertEqual(self.route('beta.maeil1dok.app', path), 'http://web-beta:8000')
        for path in ['/', '/admin/', '/admin/users', '/auth/google/callback', '/auth/apple/callback',
                     '/api/health', '/api/hasena/latest-video', '/api/cron/hasena-summary', '/_nuxt/app.js',
                     '/favicon.ico', '/_build-marker.json', '/api/v10/auth/', '/api/v1', '/health/extra', '/ready/']:
            with self.subTest(path=path):
                self.assertEqual(self.route('beta.maeil1dok.app', path), 'http://frontend-beta:3000')
        for hostname in ['maeil1dok.app', 'api.maeil1dok.app', 'www.maeil1dok.app', 'api.ublanks.com']:
            self.assertEqual(self.route(hostname, '/api/v1/auth/user/'), 'http_status:404')

    def test_all_resources_are_beta_scoped_and_bounded(self):
        self.assertEqual(self.compose['name'], 'maeil1dok-beta-isolated')
        self.assertEqual(set(self.compose['services']), {
            'web-beta', 'frontend-beta', 'mysql-beta', 'redis-beta',
            'celery-worker-beta', 'celery-beat-beta', 'api-beta-edge', 'cloudflared-beta',
        })
        self.assertEqual(set(self.compose['networks']), {'beta-app', 'beta-data'})
        self.assertTrue(self.compose['networks']['beta-data']['internal'])
        for network in self.compose['networks'].values():
            self.assertFalse(network.get('external', False))
            self.assertNotIn('name', network)
        for name, service in self.compose['services'].items():
            with self.subTest(service=name):
                if name == 'api-beta-edge':
                    self.assertEqual(service['ports'], ['8443:8443'])
                else:
                    self.assertNotIn('ports', service)
                self.assertNotIn('network_mode', service)
                self.assertNotIn('container_name', service)
                self.assertGreater(float(service['cpus']), 0)
                self.assertLessEqual(float(service['cpus']), 1)
                self.assertRegex(service['mem_limit'], r'^[1-9][0-9]*m$')
                self.assertLessEqual(int(service['mem_limit'][:-1]), 768)
                self.assertEqual(service['logging']['options'], {'max-size': '10m', 'max-file': '3'})
                self.assertTrue(set(service['networks']) <= {'beta-app', 'beta-data'})
        self.assertEqual(self.compose['services']['mysql-beta']['networks'], ['beta-data'])
        self.assertEqual(self.compose['services']['redis-beta']['networks'], ['beta-data'])
        self.assertEqual(set(self.compose['volumes']), {'mysql-beta-data', 'redis-beta-data'})
        for volume in self.compose['volumes'].values():
            self.assertFalse((volume or {}).get('external', False))
            self.assertNotIn('name', volume or {})

    def test_backend_and_frontend_cannot_inherit_primary_env(self):
        services = self.compose['services']
        frontend = services['frontend-beta']['environment']
        for name in ['web-beta', 'celery-worker-beta', 'celery-beat-beta']:
            with self.subTest(service=name):
                self.assertIn(name, services)
                backend = services[name]['environment']
                self.assertEqual(services[name]['env_file'], ['.env.backend.beta'])
                self.assertEqual(backend['DJANGO_SETTINGS_MODULE'], 'config.beta_settings')
                self.assertEqual(backend['DB_HOST'], 'mysql-beta')
                self.assertEqual(backend['DB_PORT'], '3306')
                self.assertEqual(backend['DB_NAME'], 'maeil1dok_beta')
                self.assertEqual(backend['DB_USER'], 'maeil1dok_beta')
                self.assertTrue(backend['DB_PASSWORD'].startswith('${BETA_DB_PASSWORD:?'))
                self.assertTrue(backend['BETA_SECRET_KEY'].startswith('${BETA_SECRET_KEY:?'))
                self.assertEqual(backend['SECRET_KEY'], backend['BETA_SECRET_KEY'])
                self.assertEqual(backend['REDIS_URL'], 'redis://redis-beta:6379/1')
                self.assertEqual(backend['CELERY_BROKER_URL'], 'redis://redis-beta:6379/0')
                self.assertEqual(backend['CELERY_RESULT_BACKEND'], 'redis://redis-beta:6379/0')
                self.assertEqual(backend['RESEND_API_KEY'], '')
                self.assertEqual(backend['FRONTEND_URL'], 'https://beta.maeil1dok.app')
        self.assertEqual(frontend['NUXT_PUBLIC_API_BASE'], 'https://beta.maeil1dok.app')
        self.assertEqual(frontend['NUXT_PUBLIC_BIBLE_CACHE_URL'], 'https://beta.maeil1dok.app')
        # Keep SSR on the public HTTPS origin: preserves Host and proxy security
        # without internal HTTP redirect loops or introducing a primary fallback.
        self.assertEqual(frontend['NUXT_INTERNAL_API_BASE'], 'https://beta.maeil1dok.app')
        self.assertEqual(frontend['NUXT_PUBLIC_CSRF_COOKIE_NAME'], 'beta_csrftoken')
        self.assertEqual(services['frontend-beta']['env_file'], ['.env.frontend.beta'])

    def test_optional_integrations_are_supplied_by_beta_env_files(self) -> None:
        backend_keys = [
            'CRON_SECRET', 'HASENA_CRON_SECRET', 'GEMINI_API_KEY', 'YOUTUBE_API_KEY',
            'WEB_PUSH_VAPID_PRIVATE_KEY', 'WEB_PUSH_VAPID_PUBLIC_KEY', 'WEB_PUSH_VAPID_SUBJECT',
        ]
        frontend_keys = ['CRON_SECRET', 'HASENA_CRON_SECRET', 'GEMINI_API_KEY', 'YOUTUBE_API_KEY']
        for service_name, keys in [
            ('web-beta', backend_keys), ('celery-worker-beta', backend_keys),
            ('celery-beat-beta', backend_keys),
            ('frontend-beta', frontend_keys + ['NUXT_' + key for key in frontend_keys]),
        ]:
            with self.subTest(service=service_name):
                self.assertIn(service_name, self.compose['services'])
                environment = self.compose['services'][service_name]['environment']
                for key in keys:
                    with self.subTest(key=key):
                        # An environment entry, even empty, masks the env_file value.
                        self.assertNotIn(key, environment)

    def test_celery_processes_use_the_beta_image_after_web_migrations(self) -> None:
        services = self.compose['services']
        for name, command, memory, cpus in [
            ('celery-worker-beta', ['celery', '-A', 'config', 'worker', '-l', 'info', '--concurrency=1'], '600m', 0.75),
            ('celery-beat-beta', ['celery', '-A', 'config', 'beat', '-l', 'info'], '300m', 0.5),
        ]:
            with self.subTest(service=name):
                self.assertIn(name, services)
                service = services[name]
                self.assertEqual(service['image'], services['web-beta']['image'])
                self.assertTrue(service['image'].startswith('maeil1dok-web-beta-isolated:${COMMIT_SHA:?'))
                self.assertEqual(service['build'], {'context': './backend', 'dockerfile': 'Dockerfile'})
                self.assertEqual(service['entrypoint'], [])
                self.assertEqual(service['command'], command)
                self.assertEqual(service['depends_on'], {
                    dependency: {'condition': 'service_healthy'}
                    for dependency in ['web-beta', 'mysql-beta', 'redis-beta']
                })
                self.assertEqual(service['networks'], ['beta-app', 'beta-data'])
                self.assertEqual(service['mem_limit'], memory)
                self.assertEqual(service['cpus'], cpus)
                self.assertEqual(service['restart'], 'unless-stopped')
                if name == 'celery-beat-beta':
                    self.assertEqual(service['deploy']['replicas'], 1)

    def test_api_edge_exposes_only_its_isolated_tls_listener(self) -> None:
        edge = self.compose['services']['api-beta-edge']
        self.assertEqual(edge['networks'], ['beta-app'])
        self.assertEqual(edge['ports'], ['8443:8443'])
        self.assertEqual(edge['depends_on'], {'web-beta': {'condition': 'service_healthy'}})
        self.assertEqual(edge['volumes'], [
            './.beta-edge/Caddyfile:/etc/caddy/Caddyfile:ro',
            './.beta-edge/origin.pem:/etc/caddy/origin.pem:ro',
            './.beta-edge/origin.key:/etc/caddy/origin.key:ro',
        ])

    def test_tunnel_has_separate_read_only_credentials_and_configuration(self):
        tunnel = self.compose['services']['cloudflared-beta']
        self.assertEqual(tunnel['networks'], ['beta-app'])
        self.assertEqual(tunnel['command'], ['tunnel', '--config', '/etc/cloudflared/config.yml', '--no-autoupdate', 'run'])
        self.assertEqual(tunnel['volumes'], [
            './.beta-tunnel/config.yml:/etc/cloudflared/config.yml:ro',
            './.beta-tunnel/credentials.json:/etc/cloudflared/credentials.json:ro',
        ])
        self.assertEqual(self.ingress[-1], {'service': 'http_status:404'})

    def test_test_mail_is_mounted_only_on_mail_producers_and_explicitly_labelled(self):
        services = self.compose['services']
        mount = {
            'type': 'bind', 'source': './.beta-test-mail',
            'target': '/var/lib/maeil1dok-beta/test-mail',
            'bind': {'create_host_path': False},
        }
        for name in ['web-beta', 'celery-worker-beta']:
            with self.subTest(service=name):
                self.assertIn(name, services)
                self.assertEqual(services[name]['volumes'], [mount])
        for name, service in services.items():
            if name not in ['web-beta', 'celery-worker-beta']:
                self.assertNotIn('.beta-test-mail', str(service.get('volumes', [])))
        self.assertEqual(services['frontend-beta']['environment']['NUXT_PUBLIC_TEST_MAIL_TRANSPORT'], 'beta-spool')
        # Read only literal settings, without importing base settings or any .env.
        settings = ast.parse((ROOT / 'backend/config/beta_settings.py').read_text())
        mail_settings = {
            target.id: ast.literal_eval(node.value)
            for node in settings.body if isinstance(node, ast.Assign)
            for target in node.targets if isinstance(target, ast.Name)
            and target.id in ['ACCOUNT_MAIL_TRANSPORT', 'RESEND_API_KEY', 'BETA_TEST_MAIL_DIR']
        }
        self.assertEqual(mail_settings, {
            'ACCOUNT_MAIL_TRANSPORT': 'beta-spool', 'RESEND_API_KEY': None,
            'BETA_TEST_MAIL_DIR': mount['target'],
        })

    def test_health_checks_do_not_claim_beat_readiness(self):
        backend_probe = self.compose['services']['web-beta']['healthcheck']['test'][-1]
        self.assertIn('/health/', backend_probe)
        self.assertIn('X-Forwarded-Proto', backend_probe)
        self.assertIn('beta.maeil1dok.app', backend_probe)
        self.assertNotIn('/ready/', backend_probe)
        frontend_probe = self.compose['services']['frontend-beta']['healthcheck']['test'][-1]
        self.assertIn('/api/health', frontend_probe)


if __name__ == '__main__':
    unittest.main()
