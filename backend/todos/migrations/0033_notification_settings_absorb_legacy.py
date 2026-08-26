"""Make `todos.NotificationSettings` the single owner of notification preferences.

Notification preferences lived in two models. `todos.NotificationSettings` is the
one every sender reads (`todos/services/notifications.py`,
`todos/services/push_notifications.py`). `accounts.UserReadingSettings` carried
four more preference fields exposed at
`/api/v1/{auth,accounts}/notification-settings/` that **no sender ever read**:

- `daily_reading_reminder`  — delivery is driven by `reading_reminders_enabled`,
  so turning this off did not stop reading reminders.
- `weekly_progress_summary` / `service_notice` — no sending code exists at all
  (no task, no beat schedule entry); these switches were inert in both states.
- `reminder_time` — delivery time comes from `reading_reminder_time`.

This migration absorbs the two preferences that have no counterpart, then carries
the stored values across so the legacy endpoint can become a facade over this
model without silently changing what a user asked for.

Propagation is deliberately asymmetric:

- `reading_reminders_enabled`: only explicit opt-outs are carried over. A row
  cannot distinguish "user chose 07:00" from "never touched an inert control",
  so `reminder_time` is NOT propagated — the legacy default (07:00) differs from
  the effective default (20:00) and copying it would move real delivery time for
  every user. Silencing a reminder someone switched off is safe; moving
  everyone's delivery hour is not.
- `weekly_summary_enabled` / `service_notice_enabled`: copied verbatim in both
  directions, because nothing sends on them. Copying cannot change delivery.
"""

from django.db import migrations, models


def carry_legacy_preferences(apps, schema_editor):
    UserReadingSettings = apps.get_model("accounts", "UserReadingSettings")
    NotificationSettings = apps.get_model("todos", "NotificationSettings")

    legacy_rows = list(
        UserReadingSettings.objects.values(
            "user_id",
            "daily_reading_reminder",
            "weekly_progress_summary",
            "service_notice",
        )
    )
    if not legacy_rows:
        return

    legacy_by_user = {row["user_id"]: row for row in legacy_rows}
    existing = {
        settings.user_id: settings
        for settings in NotificationSettings.objects.filter(
            user_id__in=legacy_by_user
        )
    }

    to_update = []
    for user_id, legacy in legacy_by_user.items():
        settings = existing.get(user_id)
        if settings is None:
            continue
        settings.weekly_summary_enabled = legacy["weekly_progress_summary"]
        settings.service_notice_enabled = legacy["service_notice"]
        if not legacy["daily_reading_reminder"]:
            settings.reading_reminders_enabled = False
        to_update.append(settings)

    if to_update:
        NotificationSettings.objects.bulk_update(
            to_update,
            ["weekly_summary_enabled", "service_notice_enabled", "reading_reminders_enabled"],
        )

    missing = set(legacy_by_user) - set(existing)
    if missing:
        NotificationSettings.objects.bulk_create(
            [
                NotificationSettings(
                    user_id=user_id,
                    reading_reminders_enabled=legacy_by_user[user_id][
                        "daily_reading_reminder"
                    ],
                    weekly_summary_enabled=legacy_by_user[user_id][
                        "weekly_progress_summary"
                    ],
                    service_notice_enabled=legacy_by_user[user_id]["service_notice"],
                )
                for user_id in sorted(missing)
            ]
        )


def noop_reverse(apps, schema_editor):
    """Reversing drops the absorbed columns; the legacy fields still hold values.

    `accounts.UserReadingSettings` is left untouched by the forward pass, so a
    reverse needs to restore nothing. Re-enabling reading reminders on reverse
    would resume delivery to people who explicitly opted out, so it is not done.
    """


class Migration(migrations.Migration):

    dependencies = [
        ("todos", "0032_biblereadingplan_default_plan_identity"),
        ("accounts", "0018_active_email_identity"),
    ]

    operations = [
        migrations.AddField(
            model_name="notificationsettings",
            name="weekly_summary_enabled",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="notificationsettings",
            name="service_notice_enabled",
            field=models.BooleanField(default=True),
        ),
        migrations.RunPython(carry_legacy_preferences, noop_reverse),
    ]
