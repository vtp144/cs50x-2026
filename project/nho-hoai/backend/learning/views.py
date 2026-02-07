import random
from datetime import timedelta

from django.db.models import Case, Count, IntegerField, Sum, When
from django.utils import timezone
from rest_framework import mixins, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Card, CardProgress, Deck, StudyAnswer, StudySession
from .permissions import IsOwnerOfCardDeck, IsOwnerOfDeck
from .serializers import (
    CardProgressSerializer,
    CardSerializer,
    DeckSerializer,
    StudySessionSerializer,
)

# --- Difficulty policy (Option 2 persisted) ---
DIFF_MIN = 0
DIFF_MAX = 100
DIFF_INC_WRONG = 20
DIFF_DEC_CORRECT = 10
HARD_THRESHOLD = 40

# --- Session policy (core queue) ---
CORE_SIZE_DEFAULT = 6
MAX_TOTAL_QUESTIONS_DEFAULT = 12


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
        progress.lapses += 1
        progress.wrong_streak += 1
        progress.correct_streak = 0

        progress.ease = max(1.3, progress.ease - 0.2)
        progress.interval_days = 0
        progress.due_at = now + timedelta(minutes=10)

    progress.save()


def _dedupe_keep_order(ids):
    seen = set()
    out = []
    for x in ids:
        if x in seen:
            continue
        seen.add(x)
        out.append(x)
    return out


def _filter_existing_deck_ids(deck: Deck, ids):
    if not ids:
        return []
    return list(Card.objects.filter(deck=deck, id__in=ids).values_list("id", flat=True))


def _pick_core_ids_option_a(
    *,
    user,
    deck: Deck,
    all_card_ids: list[int],
    carry_over_ids: list[int],
    core_size: int,
):
    """
    Option A priority:
      1) carry_over (from previous summary)
      2) due
      3) hard
      4) new (no progress yet)
    """
    now = timezone.now()

    # load progress for this deck
    prog_qs = CardProgress.objects.filter(user=user, card_id__in=all_card_ids)
    prog_map = {p.card_id: p for p in prog_qs}

    carry = _filter_existing_deck_ids(deck, carry_over_ids)
    carry = _dedupe_keep_order(carry)

    due = []
    hard = []
    new_ids = []

    for cid in all_card_ids:
        p = prog_map.get(cid)
        if p is None:
            new_ids.append(cid)
            continue

        if p.due_at <= now:
            due.append(cid)
        if p.difficulty_score >= HARD_THRESHOLD:
            hard.append(cid)

    # de-dup and keep order (stable)
    due = _dedupe_keep_order(due)
    hard = _dedupe_keep_order(hard)
    new_ids = _dedupe_keep_order(new_ids)

    core = []
    for src in (carry, due, hard, new_ids):
        for cid in src:
            if cid in core:
                continue
            core.append(cid)
            if len(core) >= core_size:
                break
        if len(core) >= core_size:
            break

    # if still not enough (deck small), fill with remaining cards (allow duplicates later)
    if len(core) < min(core_size, len(all_card_ids)):
        for cid in all_card_ids:
            if cid in core:
                continue
            core.append(cid)
            if len(core) >= min(core_size, len(all_card_ids)):
                break

    # if deck has 0 card
    if not core:
        return []

    # if deck < core_size => duplicate random to reach core_size
    # duplicates allowed by design
    while len(core) < core_size:
        core.append(random.choice(core))

    return core


class DeckViewSet(viewsets.ModelViewSet):
    serializer_class = DeckSerializer
    permission_classes = [IsAuthenticated, IsOwnerOfDeck]
    http_method_names = ["get", "post", "patch", "put", "delete", "head", "options"]

    def get_queryset(self):
        return Deck.objects.filter(owner=self.request.user).annotate(
            cards_count=Count("cards")
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

        core_size = request.data.get("core_size", CORE_SIZE_DEFAULT)
        max_total = request.data.get("max_total_questions", MAX_TOTAL_QUESTIONS_DEFAULT)

        try:
            core_size = int(core_size)
        except Exception:
            core_size = CORE_SIZE_DEFAULT
        try:
            max_total = int(max_total)
        except Exception:
            max_total = MAX_TOTAL_QUESTIONS_DEFAULT

        core_size = max(1, min(core_size, 50))
        max_total = max(core_size, min(max_total, 200))

        carry_ids = request.data.get("carry_over_card_ids", [])
        if not isinstance(carry_ids, list):
            carry_ids = []
        carry_ids = [int(x) for x in carry_ids if str(x).isdigit()]

        cards = list(Card.objects.filter(deck=deck).order_by("id"))
        if not cards:
            return Response({"detail": "Deck has no cards."}, status=400)

        all_ids = [c.id for c in cards]

        # pick core ids using Option A
        core_ids = _pick_core_ids_option_a(
            user=request.user,
            deck=deck,
            all_card_ids=all_ids,
            carry_over_ids=carry_ids,
            core_size=core_size,
        )

        if not core_ids:
            return Response(
                {"detail": "Failed to create session core set."}, status=400
            )

        # shuffle core for better UX (frontend will also shuffle queue, but we give shuffled as well)
        core_ids_shuffled = core_ids[:]
        random.shuffle(core_ids_shuffled)

        session = StudySession.objects.create(user=request.user, deck=deck)

        return Response(
            {
                "session": StudySessionSerializer(session).data,
                "deck": DeckSerializer(deck).data,
                "cards": CardSerializer(cards, many=True).data,
                "core_ids": core_ids_shuffled,  # ✅ exactly core_size (duplicates allowed)
                "policy": {
                    "core_size": core_size,
                    "max_total_questions": max_total,
                    "hard_threshold": HARD_THRESHOLD,
                    "diff_inc_wrong": DIFF_INC_WRONG,
                    "diff_dec_correct": DIFF_DEC_CORRECT,
                    "priority": "carry_over > due > hard > new",
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

    try:
        session = StudySession.objects.select_related("deck").get(
            id=session_id, user=request.user
        )
    except StudySession.DoesNotExist:
        return Response({"detail": "Session not found."}, status=404)

    try:
        card = Card.objects.select_related("deck").get(id=card_id, deck=session.deck)
    except Card.DoesNotExist:
        return Response({"detail": "Card not found in this deck."}, status=404)

    ok = bool(is_correct)

    # log answer
    StudyAnswer.objects.create(session=session, card=card, is_correct=ok)

    progress = ensure_progress(request.user, card)
    apply_srs(progress, ok)

    session.total_answered += 1
    if ok:
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


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def study_summary(request):
    session_id = request.query_params.get("session_id")
    if not session_id or not str(session_id).isdigit():
        return Response({"detail": "session_id is required."}, status=400)

    try:
        session = StudySession.objects.select_related("deck").get(
            id=int(session_id), user=request.user
        )
    except StudySession.DoesNotExist:
        return Response({"detail": "Session not found."}, status=404)

    answers = (
        StudyAnswer.objects.filter(session=session)
        .values("card_id")
        .annotate(
            correct=Sum(
                Case(
                    When(is_correct=True, then=1),
                    default=0,
                    output_field=IntegerField(),
                )
            ),
            wrong=Sum(
                Case(
                    When(is_correct=False, then=1),
                    default=0,
                    output_field=IntegerField(),
                )
            ),
        )
    )

    card_ids = [a["card_id"] for a in answers]
    cards = {c.id: c for c in Card.objects.filter(id__in=card_ids, deck=session.deck)}

    prog_map = {
        p.card_id: p
        for p in CardProgress.objects.filter(user=request.user, card_id__in=card_ids)
    }

    rows = []
    for a in answers:
        cid = a["card_id"]
        c = cards.get(cid)
        if not c:
            continue
        p = prog_map.get(cid)
        diff = int(getattr(p, "difficulty_score", 0) or 0)
        rows.append(
            {
                "cardId": cid,
                "term": c.term,
                "meaning": c.meaning,
                "note": c.note or "",
                "correct": int(a["correct"] or 0),
                "wrong": int(a["wrong"] or 0),
                "difficulty_score": diff,
                "hard": diff >= HARD_THRESHOLD,
            }
        )

    rows.sort(key=lambda r: (-r["wrong"], -r["difficulty_score"], r["term"]))
    recommended = [r["cardId"] for r in rows if r["wrong"] > 0][:4]

    return Response(
        {
            "session": StudySessionSerializer(session).data,
            "deck_id": session.deck_id,
            "rows": rows,
            "recommended_carry_over_card_ids": recommended,
        }
    )
