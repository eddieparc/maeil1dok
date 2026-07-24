def normalize_email_identity(email):
    if email is None:
        return None
    normalized = email.strip().lower()
    if not normalized:
        return None
    return normalized
