from django.db.models import Count
from rest_framework import viewsets, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied, NotFound

from .models import Deck, Card
from .serializers import DeckSerializer, CardSerializer
from .permissions import IsOwnerOfDeck, IsOwnerOfCardDeck

class DeckViewSet(viewsets.ModelViewSet):
    serializer_class = DeckSerializer
    permission_classes = [IsAuthenticated, IsOwnerOfDeck]

    def get_queryset(self):
        return (
            Deck.objects.filter(owner=self.request.user)
            .annotate(cards_count=Count("cards"))
        )

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=["get", "post"], url_path="cards")
    def cards(self, request, pk=None):
        # GET /api/decks/:id/cards/  (list)
        # POST /api/decks/:id/cards/ (create)
        try:
            deck = Deck.objects.get(pk=pk)
        except Deck.DoesNotExist:
            raise NotFound("Deck không tồn tại.")

        if deck.owner_id != request.user.id:
            raise PermissionDenied("Bạn không có quyền truy cập deck này.")

        if request.method.lower() == "get":
            qs = Card.objects.filter(deck=deck).order_by("-updated_at")
            return Response(CardSerializer(qs, many=True).data)

        # POST
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


class CardViewSet(
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet
):
    serializer_class = CardSerializer
    permission_classes = [IsAuthenticated, IsOwnerOfCardDeck]

    def get_queryset(self):
        return Card.objects.select_related("deck").filter(deck__owner=self.request.user)
