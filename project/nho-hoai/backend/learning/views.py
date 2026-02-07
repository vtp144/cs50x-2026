from datetime import timedelta

from django.db.models import Count
from django.utils import timezone
from rest_framework import mixins, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Card, CardProgress, Deck, StudySession
from .permissions import IsOwnerOfCardDeck, IsOwnerOfDeck
from .serializers import (
    CardProgressSerializer,
    CardSerializer,
    DeckSerializer,
    StudySessionSerializer,
)

# --- Difficulty policy (Option 2) ---
DIFF_MIN = 0
DIFF_MAX = 100
DIFF_INC_WRONG = 20
DIFF_DEC_CORRECT = 10
HARD_THRESHOLD = 40


def clamp_int(n: int, lo: int, hi: int) -> int:
    return max(lo, min(hi, n))


def ensure_progress(user, card: Card) -> CardProgress:
    progress, _ = CardProgress.objects.get_or_create(
        user=user,
        card=card,
        defaults={
            "due_at": timezone.now(),
            "ease": 2.5,
            "interval_days": 0,
            "difficulty_score": 0,
        },
    )
    return progress


def apply_srs(progress: CardProgress, is_correct: bool):
    """
    - scheduling: simple SM-2-ish
    - difficulty_score (0..100): wrong +20, correct -10
    """
    now = timezone.now()
    progress.last_answered_at = now

    # persistent difficulty
    if is_correct:
        progress.difficulty_score = clamp_int(
            progress.difficulty_score - DIFF_DEC_CORRECT, DIFF_MIN, DIFF_MAX
        )
    else:
        progress.difficulty_score = clamp_int(
            progress.difficulty_score + DIFF_INC_WRONG, DIFF_MIN, DIFF_MAX
        )

    if is_correct:
        progress.total_correct += 1
        progress.correct_streak += 1
        progress.wrong_streak = 0

        progress.ease = max(1.3, progress.ease + 0.1)
        if progress.interval_days == 0:
            progress.interval_days = 1
        elif progress.interval_days == 1:
            progress.interval_days = 3
        else:
            progress.interval_days = max(
                1, int(round(progress.interval_days * progress.ease))
            )

        progress.due_at = now + timedelta(days=progress.interval_days)
    else:
        progress.total_wrong += 1
        progress.wrong_streak += 1
        progress.correct_streak = 0
        progress.lapses += 1

        progress.ease = max(1.3, progress.ease - 0.2)
        progress.interval_days = 0
        progress.due_at = now + timedelta(minutes=10)

    progress.save(
        update_fields=[
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
            "updated_at",
        ]
    )


class DeckViewSet(viewsets.ModelViewSet):
    serializer_class = DeckSerializer
    permission_classes = [IsAuthenticated, IsOwnerOfDeck]

    def get_queryset(self):
        return (
            Deck.objects.filter(owner=self.request.user)
            .annotate(cards_count=Count("cards"))
            .order_by("-updated_at")
        )

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=["get", "post"], url_path="cards")
    def cards(self, request, pk=None):
        deck = self.get_object()

        if request.method.lower() == "get":
            qs = Card.objects.filter(deck=deck).order_by("-updated_at")
            return Response(CardSerializer(qs, many=True).data)

        serializer = CardSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        Card.objects.create(
            deck=deck,
            term=serializer.validated_data["term"],
            meaning=serializer.validated_data["meaning"],
            example=serializer.validated_data.get("example", ""),
            note=serializer.validated_data.get("note", ""),
        )
        return Response({"ok": True}, status=201)

    @action(detail=True, methods=["post"], url_path="study/start")
    def study_start(self, request, pk=None):
        deck = self.get_object()
        now = timezone.now()

        # safe limits
        new_limit = request.data.get("new_limit", 6)
        question_limit = request.data.get("question_limit", 10)

        try:
            new_limit = int(new_limit)
        except Exception:
            new_limit = 6
        try:
            question_limit = int(question_limit)
        except Exception:
            question_limit = 10

        new_limit = max(0, min(new_limit, 30))
        question_limit = max(1, min(question_limit, 50))

        session = StudySession.objects.create(user=request.user, deck=deck)

        cards = list(Card.objects.filter(deck=deck).order_by("id"))
        card_ids = [c.id for c in cards]

        progress_qs = CardProgress.objects.filter(
            user=request.user, card_id__in=card_ids
        )
        progress_map = {p.card_id: p for p in progress_qs}

        due_ids, new_ids, learning_ids = [], [], []

        for c in cards:
            p = progress_map.get(c.id)
            if p is None:
                new_ids.append(c.id)
                continue

            if p.due_at <= now:
                due_ids.append(c.id)
                continue

            if p.difficulty_score >= HARD_THRESHOLD or p.interval_days <= 3:
                learning_ids.append(c.id)

        # carry over
        carry_ids = request.data.get("carry_over_card_ids", [])
        if not isinstance(carry_ids, list):
            carry_ids = []
        carry_ids = [int(x) for x in carry_ids if str(x).isdigit()]
        carry_ids = list(dict.fromkeys(carry_ids))
        carry_ids = list(
            Card.objects.filter(deck=deck, id__in=carry_ids).values_list(
                "id", flat=True
            )
        )

        learning_ids = carry_ids + [x for x in learning_ids if x not in carry_ids]

        # limit new
        new_later_ids = []
        if new_limit < len(new_ids):
            new_later_ids = new_ids[new_limit:]
            new_ids = new_ids[:new_limit]

        return Response(
            {
                "session": StudySessionSerializer(session).data,
                "deck": DeckSerializer(deck).data,
                "cards": CardSerializer(cards, many=True).data,
                "queues": {
                    "due": due_ids,
                    "new": new_ids,
                    "learning": learning_ids,
                    "new_later": new_later_ids,
                },
                "policy": {
                    "question_limit": question_limit,
                    "new_limit": new_limit,
                    "hard_threshold": HARD_THRESHOLD,
                    "diff_inc_wrong": DIFF_INC_WRONG,
                    "diff_dec_correct": DIFF_DEC_CORRECT,
                },
            }
        )


class CardViewSet(
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = CardSerializer
    permission_classes = [IsAuthenticated, IsOwnerOfCardDeck]
    http_method_names = ["get", "patch", "put", "delete", "head", "options"]

    def get_queryset(self):
        return Card.objects.select_related("deck").filter(deck__owner=self.request.user)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def study_answer(request):
    session_id = request.data.get("session_id")
    card_id = request.data.get("card_id")
    is_correct = request.data.get("is_correct")

    if session_id is None or card_id is None or is_correct is None:
        return Response(
            {"detail": "session_id, card_id, is_correct are required."}, status=400
        )

    # validate session ownership
    try:
        session = StudySession.objects.select_related("deck").get(
            id=session_id, user=request.user
        )
    except StudySession.DoesNotExist:
        return Response({"detail": "Session not found."}, status=404)

    # validate card belongs to deck
    try:
        card = Card.objects.select_related("deck").get(id=card_id, deck=session.deck)
    except Card.DoesNotExist:
        return Response({"detail": "Card not found in this deck."}, status=404)

    progress = ensure_progress(request.user, card)
    apply_srs(progress, bool(is_correct))

    # session counts
    session.total_answered += 1
    if bool(is_correct):
        session.correct_count += 1
    else:
        session.wrong_count += 1
    session.save(update_fields=["total_answered", "correct_count", "wrong_count"])

    return Response(
        {
            "ok": True,
            "session": StudySessionSerializer(session).data,
            "progress": CardProgressSerializer(progress).data,
            "flags": {
                "hard": progress.difficulty_score >= HARD_THRESHOLD,
                "difficulty_score": progress.difficulty_score,
            },
        }
    )
