from rest_framework import serializers

from .models import Card, CardProgress, Deck, StudySession


class DeckSerializer(serializers.ModelSerializer):
    cards_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Deck
        fields = [
            "id",
            "title",
            "source_lang",
            "target_lang",
            "cards_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "cards_count", "created_at", "updated_at"]

    def validate(self, attrs):
        src = attrs.get("source_lang", getattr(self.instance, "source_lang", None))
        tgt = attrs.get("target_lang", getattr(self.instance, "target_lang", None))
        if src and tgt and src == tgt:
            raise serializers.ValidationError(
                "source_lang và target_lang phải khác nhau."
            )
        return attrs


class CardSerializer(serializers.ModelSerializer):
    deck_id = serializers.IntegerField(write_only=True, required=False)

    class Meta:
        model = Card
        fields = [
            "id",
            "deck",
            "deck_id",
            "term",
            "meaning",
            "example",
            "note",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "deck", "created_at", "updated_at"]

    def validate(self, attrs):
        term = (attrs.get("term") or "").strip()
        meaning = (attrs.get("meaning") or "").strip()

        # allow PATCH: fallback to instance values
        if self.instance is not None:
            if not term:
                term = (getattr(self.instance, "term", "") or "").strip()
            if not meaning:
                meaning = (getattr(self.instance, "meaning", "") or "").strip()

        if not term or not meaning:
            raise serializers.ValidationError("term và meaning không được rỗng.")
        return attrs


class StudySessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudySession
        fields = [
            "id",
            "deck",
            "started_at",
            "ended_at",
            "total_answered",
            "correct_count",
            "wrong_count",
        ]
        read_only_fields = fields


class CardProgressSerializer(serializers.ModelSerializer):
    class Meta:
        model = CardProgress
        fields = [
            "id",
            "user",
            "card",
            "ease",
            "interval_days",
            "due_at",
            "difficulty_score",
            "lapses",
            "wrong_streak",
            "correct_streak",
            "total_correct",
            "total_wrong",
            "last_answered_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields
