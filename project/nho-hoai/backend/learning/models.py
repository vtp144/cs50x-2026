from django.conf import settings
from django.db import models

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
