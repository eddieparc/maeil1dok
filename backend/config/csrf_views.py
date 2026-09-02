from django.contrib.auth.models import AnonymousUser
from django.http import HttpRequest, HttpResponse
from django.shortcuts import redirect
from django.views.csrf import csrf_failure as django_csrf_failure


def csrf_failure(request: HttpRequest, reason: str = "") -> HttpResponse:
    user = getattr(request, "user", AnonymousUser())
    if request.path == "/admin/login/" and user.is_authenticated:
        return redirect("admin:index")
    return django_csrf_failure(request, reason=reason)
