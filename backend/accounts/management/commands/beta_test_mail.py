"""Local operator access only; never print message content/token links to stdout."""
import json
import os

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from accounts.beta_test_mail import export_capture, private_directory, read_capture


class Command(BaseCommand):
    help = 'List beta TEST MAIL IDs or export one capture to a new private file; no email is delivered.'
    requires_system_checks = []

    def add_arguments(self, parser):
        action = parser.add_mutually_exclusive_group(required=True)
        action.add_argument('--list', action='store_true')
        action.add_argument('--id')
        parser.add_argument('--output', help='New file in an existing owner-only 0700 directory outside source/assets')

    def handle(self, *args, **options):
        if getattr(settings, 'ACCOUNT_MAIL_TRANSPORT', 'resend') != 'beta-spool':
            raise CommandError('Test mail access is available only with the beta-spool transport')
        if bool(options['id']) != bool(options['output']):
            raise CommandError('--id and --output must be supplied together')
        try:
            with private_directory(settings.BETA_TEST_MAIL_DIR) as directory:
                if options['list']:
                    for name in sorted(os.listdir(directory)):
                        if not name.endswith('.json'):
                            continue
                        record = read_capture(directory, name[:-5])
                        self.stdout.write(json.dumps({key: record[key] for key in ('id', 'created_at', 'delivery_status')}))
                else:
                    record = read_capture(directory, options['id'])
                    export_capture(record, options['output'])
                    self.stdout.write('TEST MAIL exported to a private file. No email was delivered.')
        except (OSError, ValueError, KeyError, TypeError):
            # Paths, content and exception text may contain tokens/PII.
            raise CommandError('Test mail access failed; check the record ID, ownership, permissions and output path') from None
