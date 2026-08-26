from .bible_bookmark import POLICIES as BIBLE_BOOKMARK_POLICIES
from .bible_highlight import POLICIES as BIBLE_HIGHLIGHT_POLICIES
from .bible_note import POLICIES as BIBLE_NOTE_POLICIES
from .bible_personal_record import POLICIES as BIBLE_PERSONAL_RECORD_POLICIES
from .bible_reading_position import POLICIES as BIBLE_READING_POSITION_POLICIES
from .plan_subscription import POLICIES as PLAN_SUBSCRIPTION_POLICIES
from .reading_group import POLICIES as READING_GROUP_POLICIES
from .reading_progress import POLICIES as READING_PROGRESS_POLICIES


_POLICIES = {
    **PLAN_SUBSCRIPTION_POLICIES,
    **READING_PROGRESS_POLICIES,
    **BIBLE_BOOKMARK_POLICIES,
    **BIBLE_HIGHLIGHT_POLICIES,
    **BIBLE_NOTE_POLICIES,
    **BIBLE_READING_POSITION_POLICIES,
    **BIBLE_PERSONAL_RECORD_POLICIES,
    **READING_GROUP_POLICIES,
}


def get_policy(action, resource_class):
    return _POLICIES.get((action, resource_class))
