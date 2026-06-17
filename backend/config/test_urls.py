from django.urls import include, path

urlpatterns = [
    path('api/v1/bible-cache/', include('bible_cache.urls')),
]
