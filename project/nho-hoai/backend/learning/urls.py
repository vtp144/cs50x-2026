from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DeckViewSet, CardViewSet

router = DefaultRouter()
router.register(r"decks", DeckViewSet, basename="deck")
router.register(r"cards", CardViewSet, basename="card")

urlpatterns = [
    path("", include(router.urls)),
]
