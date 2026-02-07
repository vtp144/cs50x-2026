from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import CardViewSet, DeckViewSet, study_answer, study_summary

router = DefaultRouter()
router.register(r"decks", DeckViewSet, basename="deck")
router.register(r"cards", CardViewSet, basename="card")

urlpatterns = [
    path("study/answer/", study_answer, name="study_answer"),
    path("study/summary/", study_summary, name="study_summary"),
]

urlpatterns += router.urls
