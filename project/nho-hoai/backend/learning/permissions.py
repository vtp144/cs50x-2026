from rest_framework.permissions import BasePermission

class IsOwnerOfDeck(BasePermission):
    def has_object_permission(self, request, view, obj):
        return getattr(obj, "owner_id", None) == request.user.id


class IsOwnerOfCardDeck(BasePermission):
    def has_object_permission(self, request, view, obj):
        return getattr(obj.deck, "owner_id", None) == request.user.id
