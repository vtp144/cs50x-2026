from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        u = request.user
        return Response({"id": u.id, "username": u.username, "email": u.email})


class RegisterView(APIView):
    """
    POST /api/auth/register/
    body: { username, password, password2 }
    returns: { access, refresh, user }
    """

    permission_classes = [AllowAny]

    def post(self, request):
        User = get_user_model()

        username = (request.data.get("username") or "").strip()
        password = request.data.get("password") or ""
        password2 = request.data.get("password2") or ""

        errors = {}

        if not username:
            errors["username"] = ["Username is required."]
        elif User.objects.filter(username=username).exists():
            errors["username"] = ["Username already exists."]

        if not password:
            errors["password"] = ["Password is required."]
        if password and password2 and password != password2:
            errors["password2"] = ["Passwords do not match."]

        # Run Django password validators (min length, common password, etc.)
        if password and not errors.get("password2"):
            try:
                validate_password(password)
            except DjangoValidationError as e:
                errors["password"] = list(e.messages)

        if errors:
            return Response({"errors": errors}, status=400)

        user = User.objects.create_user(username=username, password=password)

        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": {"id": user.id, "username": user.username},
            },
            status=201,
        )
