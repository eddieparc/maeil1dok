"""Offline deployment contract checks; never create containers or resolve DNS."""
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
        self.assertEqual(set(self.compose['services']), {'web-beta', 'frontend-beta', 'mysql-beta', 'redis-beta', 'cloudflared-beta'})
        self.assertEqual(set(self.compose['networks']), {'beta-app', 'beta-data'})
        self.assertTrue(self.compose['networks']['beta-data']['internal'])
        for network in self.compose['networks'].values():
            self.assertFalse(network.get('external', False))
        for name, service in self.compose['services'].items():
            with self.subTest(service=name):
                self.assertNotIn('ports', service)
                self.assertNotIn('network_mode', service)
                self.assertNotIn('container_name', service)
                self.assertGreater(float(service['cpus']), 0)
                self.assertIn('mem_limit', service)
                self.assertEqual(service['logging']['options'], {'max-size': '10m', 'max-file': '3'})
                self.assertTrue(set(service['networks']) <= {'beta-app', 'beta-data'})
        self.assertEqual(self.compose['services']['mysql-beta']['networks'], ['beta-data'])
        self.assertEqual(self.compose['services']['redis-beta']['networks'], ['beta-data'])
        self.assertEqual(set(self.compose['volumes']), {'mysql-beta-data', 'redis-beta-data'})
        for volume in self.compose['volumes'].values():
            self.assertFalse((volume or {}).get('external', False))

    def test_backend_and_frontend_cannot_inherit_primary_env(self):
        services = self.compose['services']
        backend = services['web-beta']['environment']
        frontend = services['frontend-beta']['environment']
        self.assertEqual(backend['DJANGO_SETTINGS_MODULE'], 'config.beta_settings')
        self.assertEqual(backend['DB_HOST'], 'mysql-beta')
        self.assertEqual(backend['DB_NAME'], 'maeil1dok_beta')
        self.assertEqual(backend['DB_USER'], 'maeil1dok_beta')
        self.assertEqual(backend['REDIS_URL'], 'redis://redis-beta:6379/1')
        self.assertEqual(frontend['NUXT_PUBLIC_API_BASE'], 'https://beta.maeil1dok.app')
        self.assertEqual(frontend['NUXT_PUBLIC_BIBLE_CACHE_URL'], 'https://beta.maeil1dok.app')
        # Keep SSR on the public HTTPS origin: preserves Host and proxy security
        # without internal HTTP redirect loops or introducing a primary fallback.
        self.assertEqual(frontend['NUXT_INTERNAL_API_BASE'], 'https://beta.maeil1dok.app')
        self.assertEqual(frontend['NUXT_PUBLIC_CSRF_COOKIE_NAME'], 'beta_csrftoken')
        self.assertEqual(services['web-beta']['env_file'], ['.env.backend.beta'])
        self.assertEqual(services['frontend-beta']['env_file'], ['.env.frontend.beta'])
        for env in [backend, frontend]:
            for name in ['CRON_SECRET', 'HASENA_CRON_SECRET', 'GEMINI_API_KEY', 'YOUTUBE_API_KEY']:
                self.assertEqual(env[name], '')
        self.assertEqual(frontend['NUXT_CRON_SECRET'], '')
        self.assertEqual(frontend['NUXT_HASENA_CRON_SECRET'], '')
        self.assertEqual(backend['RESEND_API_KEY'], '')

    def test_tunnel_has_separate_read_only_credentials_and_configuration(self):
        tunnel = self.compose['services']['cloudflared-beta']
        self.assertEqual(tunnel['networks'], ['beta-app'])
        self.assertEqual(tunnel['command'], ['tunnel', '--config', '/etc/cloudflared/config.yml', '--no-autoupdate', 'run'])
        self.assertEqual(tunnel['volumes'], [
            './.beta-tunnel/config.yml:/etc/cloudflared/config.yml:ro',
            './.beta-tunnel/credentials.json:/etc/cloudflared/credentials.json:ro',
        ])
        self.assertEqual(self.ingress[-1], {'service': 'http_status:404'})

    def test_test_mail_is_mounted_only_on_backend_and_explicitly_labelled(self):
        services = self.compose['services']
        mount = services['web-beta']['volumes'][0]
        self.assertEqual(mount, {
            'type': 'bind', 'source': './.beta-test-mail',
            'target': '/var/lib/maeil1dok-beta/test-mail',
            'bind': {'create_host_path': False},
        })
        for name, service in services.items():
            if name != 'web-beta':
                self.assertNotIn('.beta-test-mail', str(service.get('volumes', [])))
        self.assertEqual(services['frontend-beta']['environment']['NUXT_PUBLIC_TEST_MAIL_TRANSPORT'], 'beta-spool')
        self.assertEqual(services['web-beta']['environment']['RESEND_API_KEY'], '')

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
