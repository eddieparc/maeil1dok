import os
import threading
import unittest
import uuid

from django.core.cache import caches
from django.test import SimpleTestCase, override_settings

from accounts import handoff


REDIS_TEST_URL = os.environ.get('REDIS_TEST_URL', 'redis://127.0.0.1:6379/15')


@override_settings(
    CACHES={
        'default': {
            'BACKEND': 'django.core.cache.backends.redis.RedisCache',
            'LOCATION': REDIS_TEST_URL,
        },
    },
)
class RedisHandoffIntegrationTest(SimpleTestCase):
    def setUp(self):
        self.cache = caches['default']
        self.cache.clear()
        self.user_id = 7301

    def tearDown(self):
        self.cache.clear()

    def test_marker_generation_gap_rejects_pre_logout_issue(self):
        observed_generation = handoff.current_generation(self.cache, self.user_id)
        code = str(uuid.uuid4())
        publication = {}
        real_set = self.cache.set

        def set_marker_then_publish(key, value, *args, **kwargs):
            result = real_set(key, value, *args, **kwargs)
            if key == handoff.logout_marker_key(self.user_id):
                publication['attempted'] = True
                publication['published'] = handoff.publish_code(
                    self.cache,
                    user_id=self.user_id,
                    code=code,
                    observed_generation=observed_generation,
                    ttl_seconds=60,
                )
            return result

        self.cache.set = set_marker_then_publish
        try:
            handoff.mark_logged_out(self.cache, self.user_id)
        finally:
            self.cache.set = real_set

        self.assertTrue(publication.get('attempted'))
        self.assertFalse(publication.get('published'))
        self.assertIsNone(self.cache.get(f'session_bridge:{code}'))

    def test_logout_during_publish_removes_late_code(self):
        observed_generation = handoff.current_generation(self.cache, self.user_id)
        code = str(uuid.uuid4())
        publish_reached_write = threading.Event()
        release_write = threading.Event()
        outcome = {}

        def publish_worker():
            worker_cache = caches['default']
            real_set = worker_cache.set

            def pause_before_code_write(key, value, *args, **kwargs):
                if key == f'session_bridge:{code}':
                    publish_reached_write.set()
                    if not release_write.wait(timeout=2):
                        raise TimeoutError('logout did not release the Redis publish barrier')
                return real_set(key, value, *args, **kwargs)

            worker_cache.set = pause_before_code_write
            try:
                outcome['published'] = handoff.publish_code(
                    worker_cache,
                    user_id=self.user_id,
                    code=code,
                    observed_generation=observed_generation,
                    ttl_seconds=60,
                )
            finally:
                worker_cache.set = real_set

        worker = threading.Thread(target=publish_worker)
        worker.start()
        try:
            self.assertTrue(
                publish_reached_write.wait(timeout=2),
                'publish must reach its write barrier',
            )
            handoff.mark_logged_out(self.cache, self.user_id)
        finally:
            release_write.set()
            worker.join(timeout=2)

        self.assertFalse(worker.is_alive())
        self.assertFalse(outcome.get('published'))
        self.assertIsNone(self.cache.get(f'session_bridge:{code}'))

    def test_concurrent_first_logouts_seed_generation_atomically(self):
        start = threading.Event()
        finished = []
        errors = []

        def logout_worker():
            try:
                worker_cache = caches['default']
                if not start.wait(timeout=2):
                    raise TimeoutError('test did not release concurrent logouts')
                finished.append(handoff.mark_logged_out(worker_cache, self.user_id))
            except Exception as error:
                errors.append(error)

        workers = [threading.Thread(target=logout_worker) for _ in range(2)]
        for worker in workers:
            worker.start()
        start.set()
        for worker in workers:
            worker.join(timeout=2)

        self.assertTrue(all(not worker.is_alive() for worker in workers))
        self.assertEqual(errors, [])
        self.assertEqual(len(finished), 2)
        self.assertGreaterEqual(handoff.current_generation(self.cache, self.user_id), 2)
