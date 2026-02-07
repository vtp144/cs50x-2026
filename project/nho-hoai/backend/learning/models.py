from django.conf import settings
from django.db import models
from django.utils import timezone

LANG_CHOICES = [
    ("en", "English"),
    ("ja", "Japanese"),
]


class Deck(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="decks",
    )
    title = models.CharField(max_length=120)
    source_lang = models.CharField(max_length=2, choices=LANG_CHOICES)
    target_lang = models.CharField(max_length=2, choices=LANG_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return f"{self.title} ({self.source_lang}->{self.target_lang})"


class Card(models.Model):
    deck = models.ForeignKey(Deck, on_delete=models.CASCADE, related_name="cards")
    term = models.CharField(max_length=255)
    meaning = models.CharField(max_length=255)
    example = models.TextField(blank=True, default="")
    note = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["deck", "term"]),
        ]

    def __str__(self):
        return f"{self.term} -> {self.meaning}"


class StudySession(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="study_sessions",
    )
    deck = models.ForeignKey(
        Deck,
        on_delete=models.CASCADE,
        related_name="study_sessions",
    )

    started_at = models.DateTimeField(default=timezone.now)
    ended_at = models.DateTimeField(null=True, blank=True)

    total_answered = models.PositiveIntegerField(default=0)
    correct_count = models.PositiveIntegerField(default=0)
    wrong_count = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-started_at"]

    def __str__(self):
        return f"Session {self.id} - {self.user_id} - deck {self.deck_id}"


class CardProgress(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="card_progress",
    )
    card = models.ForeignKey(
        Card,
        on_delete=models.CASCADE,
        related_name="progress",
    )

    # SM-2-ish parameters
    ease = models.FloatField(default=2.5)
    interval_days = models.PositiveIntegerField(default=0)
    due_at = models.DateTimeField(default=timezone.now)

    # ✅ Option 2: persistent difficulty score (0..100)
    difficulty_score = models.PositiveSmallIntegerField(default=0)

    lapses = models.PositiveIntegerField(default=0)
    wrong_streak = models.PositiveIntegerField(default=0)
    correct_streak = models.PositiveIntegerField(default=0)

    total_correct = models.PositiveIntegerField(default=0)
    total_wrong = models.PositiveIntegerField(default=0)

    last_answered_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "card"], name="uniq_user_card_progress"
            ),
        ]
        indexes = [
            models.Index(fields=["user", "due_at"]),
            models.Index(fields=["user", "card"]),
            models.Index(fields=["user", "difficulty_score"]),
        ]

    def __str__(self):
        return f"Progress u{self.user_id}-c{self.card_id} diff={self.difficulty_score}"
