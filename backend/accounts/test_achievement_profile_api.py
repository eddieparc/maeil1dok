from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIRequestFactory

from accounts import profile_views

User = get_user_model()


class AchievementProfileApiTest(TestCase):
    def test_locked_achievements_include_configured_milestone_value(self):
        user = User.objects.create_user(
            username="achievement-target-reader",
            nickname="업적목표독자",
            password="pw-test-1234",
        )
        request = APIRequestFactory().get(f"/api/v1/accounts/profile/{user.id}/achievements/")

        response = profile_views.get_user_achievements(request, user.id)

        self.assertEqual(response.status_code, 200)
        achievements = response.data["data"]["achievements"]
        by_type = {item["achievement_type"]: item for item in achievements}
        self.assertEqual(by_type["total_30"]["milestone_value"], 30)
        self.assertEqual(by_type["hasena_streak_7"]["milestone_value"], 7)
