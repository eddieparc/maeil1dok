from datetime import date
from io import BytesIO

import pandas as pd
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from .models import BibleReadingPlan, DailyBibleSchedule


User = get_user_model()
UPLOAD_URL = '/api/v1/todos/schedules/upload-excel/'


class ScheduleUploadIntegrityTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='schedule-upload-admin',
            nickname='스케줄업로드관리자',
            password='pw-test-1234',
            is_staff=True,
        )
        self.client.force_authenticate(self.user)
        self.plan = BibleReadingPlan.objects.create(
            name='엑셀 업로드 무결성 플랜',
            created_by=self.user,
        )

    def _upload_update_rows(self, rows):
        response = self.client.post(
            UPLOAD_URL,
            data={
                'plan_id': self.plan.id,
                'update_mode': 'update',
                'file': self._excel_file(rows),
            },
            format='multipart',
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIsNone(response.data['errors'])
        return response
    def _upload_rows(self, rows, update_mode='add'):
        response = self.client.post(
            UPLOAD_URL,
            data={
                'plan_id': self.plan.id,
                'update_mode': update_mode,
                'file': self._excel_file(rows),
            },
            format='multipart',
        )
        self.assertEqual(response.status_code, 200, response.data)
        return response


    def _excel_file(self, rows):
        buffer = BytesIO()
        pd.DataFrame(rows).to_excel(buffer, index=False)
        return SimpleUploadedFile(
            'schedules.xlsx',
            buffer.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )

    def _schedule_chapters_by_book(self):
        return {
            schedule.book: (schedule.start_chapter, schedule.end_chapter)
            for schedule in DailyBibleSchedule.objects.filter(plan=self.plan)
        }

    def test_update_mode_updates_same_date_books_by_book_identity(self):
        schedule_date = date(2026, 7, 11)
        DailyBibleSchedule.objects.create(
            plan=self.plan,
            date=schedule_date,
            book='창세기',
            start_chapter=1,
            end_chapter=1,
        )
        DailyBibleSchedule.objects.create(
            plan=self.plan,
            date=schedule_date,
            book='출애굽기',
            start_chapter=1,
            end_chapter=1,
        )

        self._upload_update_rows([
            {'날짜': '2026-07-11', '성경': '창세기', '시작장': 2, '끝장': 3},
            {'날짜': '2026-07-11', '성경': '출애굽기', '시작장': 4, '끝장': 5},
        ])

        self.assertEqual(DailyBibleSchedule.objects.filter(plan=self.plan).count(), 2)
        self.assertEqual(
            self._schedule_chapters_by_book(),
            {
                '창세기': (2, 3),
                '출애굽기': (4, 5),
            },
        )

    def test_update_mode_creates_missing_same_date_book_without_renaming_existing(self):
        schedule_date = date(2026, 7, 12)
        DailyBibleSchedule.objects.create(
            plan=self.plan,
            date=schedule_date,
            book='창세기',
            start_chapter=1,
            end_chapter=1,
        )

        self._upload_update_rows([
            {'날짜': '2026-07-12', '성경': '출애굽기', '시작장': 2, '끝장': 4},
        ])

        self.assertEqual(DailyBibleSchedule.objects.filter(plan=self.plan).count(), 2)
        self.assertEqual(
            self._schedule_chapters_by_book(),
            {
                '창세기': (1, 1),
                '출애굽기': (2, 4),
            },
        )
    def test_replace_mode_rejects_reversed_range_before_deleting_existing(self):
        original = DailyBibleSchedule.objects.create(
            plan=self.plan,
            date=date(2026, 7, 13),
            book='창세기',
            start_chapter=1,
            end_chapter=2,
        )

        response = self._upload_rows([
            {'날짜': '2026-07-14', '성경': '출애굽기', '시작장': 5, '끝장': 3},
        ], update_mode='replace')

        self.assertEqual(response.data['detail'], '0개의 일정이 처리되었습니다. 오류: 1개')
        self.assertEqual(response.data['errors'], ['행 2: 처리 중 오류가 발생했습니다.'])
        self.assertTrue(DailyBibleSchedule.objects.filter(pk=original.pk).exists())
        original.refresh_from_db()
        self.assertEqual((original.book, original.start_chapter, original.end_chapter), ('창세기', 1, 2))
        self.assertFalse(DailyBibleSchedule.objects.filter(plan=self.plan, book='출애굽기').exists())

    def test_fractional_chapter_is_rejected_without_truncation(self):
        response = self._upload_rows([
            {'날짜': '2026-07-14', '성경': '출애굽기', '시작장': 1.5, '끝장': 2},
        ])

        self.assertEqual(response.data['detail'], '0개의 일정이 처리되었습니다. 오류: 1개')
        self.assertEqual(DailyBibleSchedule.objects.filter(plan=self.plan).count(), 0)

    def test_invalid_chapter_cells_are_rejected_without_writes(self):
        cases = [
            ('zero', 0, 1),
            ('negative', -1, 1),
            ('blank', '', 1),
            ('boolean', True, 1),
        ]

        for label, start_chapter, end_chapter in cases:
            with self.subTest(label=label):
                DailyBibleSchedule.objects.filter(plan=self.plan).delete()

                response = self._upload_rows([
                    {'날짜': '2026-07-15', '성경': '민수기', '시작장': start_chapter, '끝장': end_chapter},
                ])

                self.assertEqual(response.data['detail'], '0개의 일정이 처리되었습니다. 오류: 1개')
                self.assertEqual(DailyBibleSchedule.objects.filter(plan=self.plan).count(), 0)

    def test_valid_replace_mode_deletes_old_rows_and_writes_new_rows(self):
        DailyBibleSchedule.objects.create(
            plan=self.plan,
            date=date(2026, 7, 16),
            book='창세기',
            start_chapter=1,
            end_chapter=1,
        )

        response = self._upload_rows([
            {'날짜': '2026-07-17', '성경': '신명기', '시작장': 2, '끝장': 4},
        ], update_mode='replace')

        self.assertEqual(response.data['detail'], '1개의 일정이 처리되었습니다. 오류: 0개')
        self.assertIsNone(response.data['errors'])
        self.assertEqual(
            self._schedule_chapters_by_book(),
            {'신명기': (2, 4)},
        )
