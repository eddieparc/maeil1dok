"""Expo push transport: send tickets and receipt lookups.

Wire-level only — every call goes through `requests.post` so tests fake the
HTTP boundary. Tokens and installation ids are never logged.
"""

import logging

import requests

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts'
EXPO_TIMEOUT_SECONDS = 10
EXPO_RECEIPT_BATCH_SIZE = 1000


class ExpoDeliveryError(Exception):
    """A send attempt that did not produce an accepted ticket."""

    def __init__(self, status_code=None, error_code=None):
        super().__init__(error_code or status_code or 'expo_delivery_failed')
        self.status_code = status_code
        self.error_code = error_code


def send_expo_push(token, message):
    """POST one message to the Expo push API; return the ticket dict.

    Raises ExpoDeliveryError for transport failures, non-200 responses, and
    per-message error tickets (details.error carries the Expo error code).
    """
    try:
        response = requests.post(
            EXPO_PUSH_URL,
            json=[message],
            headers={
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            timeout=EXPO_TIMEOUT_SECONDS,
        )
    except requests.RequestException as exc:
        raise ExpoDeliveryError() from exc

    if response.status_code != 200:
        raise ExpoDeliveryError(status_code=response.status_code)

    try:
        tickets = response.json().get('data')
    except ValueError as exc:
        raise ExpoDeliveryError(status_code=response.status_code) from exc
    if not isinstance(tickets, list) or len(tickets) != 1 or not isinstance(tickets[0], dict):
        raise ExpoDeliveryError(status_code=response.status_code, error_code='invalid_ticket_response')
    ticket = tickets[0]

    if ticket.get('status') == 'ok' and isinstance(ticket.get('id'), str):
        return ticket

    details = ticket.get('details') or {}
    raise ExpoDeliveryError(
        status_code=response.status_code,
        error_code=details.get('error'),
    )


def fetch_expo_receipts(ticket_ids):
    """POST receipt ids to Expo; return {ticket_id: receipt} or None on failure."""
    if not ticket_ids:
        return {}
    try:
        response = requests.post(
            EXPO_RECEIPTS_URL,
            json={'ids': list(ticket_ids)},
            headers={
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            timeout=EXPO_TIMEOUT_SECONDS,
        )
    except requests.RequestException:
        logger.warning('Expo receipt fetch failed (transport)', exc_info=True)
        return None

    if response.status_code != 200:
        logger.warning('Expo receipt fetch failed with status %s', response.status_code)
        return None

    try:
        data = response.json().get('data')
    except ValueError:
        return None
    return data if isinstance(data, dict) else None
