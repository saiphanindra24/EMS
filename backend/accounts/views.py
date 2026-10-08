from django.conf import settings
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User
from .permissions import IsOwnerOrManagerOrAdmin
from .serializers import (
    LoginSerializer,
    LogoutSerializer,
    TokenRefreshSerializer,
    UserSerializer,
)


def set_auth_cookies(response, access_token, refresh_token=None):
    """Sets secure HttpOnly cookies for JWT tokens."""
    cookie_kwargs = {
        "httponly": True,
        "samesite": "Lax",
        "secure": not settings.DEBUG,  # True in production (HTTPS)
        "path": "/",
    }
    # 30-minute access cookie
    response.set_cookie("access_token", access_token, max_age=1800, **cookie_kwargs)
    if refresh_token:
        # 7-day refresh cookie
        response.set_cookie("refresh_token", refresh_token, max_age=604800, **cookie_kwargs)


def clear_auth_cookies(response):
    """Clears authentication cookies."""
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")


class LoginView(APIView):
    """
    POST /api/v1/auth/login/
    Authenticates user via email and password, returning JWT and user profile.
    """
    permission_classes = [permissions.AllowAny]
    throttle_scope = "auth"

    def post(self, request, *args, **kwargs):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        user_data = UserSerializer(data["user"]).data
        response_data = {
            "status": "success",
            "message": "Login successful",
            "user": user_data,
            "access": data["access"],
            "refresh": data["refresh"],
        }
        response = Response(response_data, status=status.HTTP_200_OK)
        set_auth_cookies(response, data["access"], data["refresh"])
        return response


class CustomTokenRefreshView(APIView):
    """
    POST /api/v1/auth/token/refresh/
    Refreshes access token using refresh token from request body or cookie.
    """
    permission_classes = [permissions.AllowAny]
    throttle_scope = "auth"

    def post(self, request, *args, **kwargs):
        refresh_token = request.data.get("refresh") or request.COOKIES.get("refresh_token")
        if not refresh_token:
            return Response(
                {"detail": "Refresh token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = TokenRefreshSerializer(data={"refresh": refresh_token})
        serializer.is_valid(raise_exception=True)
        new_access = serializer.validated_data["access"]

        response = Response({
            "status": "success",
            "access": new_access,
        }, status=status.HTTP_200_OK)
        set_auth_cookies(response, new_access)
        return response


class LogoutView(APIView):
    """
    POST /api/v1/auth/logout/
    Logs out the user and clears authentication cookies.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        refresh_token = request.data.get("refresh") or request.COOKIES.get("refresh_token")
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except Exception:
                pass  # Ignore invalid token during logout

        response = Response({
            "status": "success",
            "message": "Logged out successfully",
        }, status=status.HTTP_200_OK)
        clear_auth_cookies(response)
        return response


class CurrentUserView(APIView):
    """
    GET /api/v1/auth/me/
    Returns the currently authenticated user's profile and permissions.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        serializer = UserSerializer(request.user)
        return Response({
            "status": "success",
            "user": serializer.data,
            "roles": {
                "role": request.user.role,
                "is_super_admin": request.user.is_super_admin,
                "is_hr_admin": request.user.is_hr_admin,
                "is_manager": request.user.is_manager,
                "is_employee": request.user.is_employee,
            },
        }, status=status.HTTP_200_OK)


class UserRecordDetailView(generics.RetrieveAPIView):
    """
    GET /api/v1/auth/users/<int:pk>/
    Object-level permission test endpoint:
    - Super/HR Admin can view any record.
    - Manager can view self and direct reports.
    - Employee can only view self.
    """
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrManagerOrAdmin]


class UserProfileView(APIView):
    """
    GET /api/v1/auth/profile/
    PATCH /api/v1/auth/profile/
    Allows the authenticated user to view and update permitted personal details.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        emp = getattr(user, "employee_profile", None)
        return Response({
            "id": user.id,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "full_name": user.full_name,
            "role": user.role,
            "department": user.department,
            "phone": emp.phone if emp else "",
            "designation": emp.designation if emp else "",
            "work_location": emp.work_location if emp else "",
            "profile_photo": emp.profile_photo.url if (emp and emp.profile_photo) else None,
        }, status=status.HTTP_200_OK)

    def patch(self, request):
        user = request.user
        first_name = request.data.get("first_name")
        last_name = request.data.get("last_name")
        phone = request.data.get("phone")

        if first_name is not None:
            user.first_name = first_name.strip()
        if last_name is not None:
            user.last_name = last_name.strip()
        user.save(update_fields=["first_name", "last_name"])

        emp = getattr(user, "employee_profile", None)
        if emp and phone is not None:
            emp.phone = phone.strip()
            emp.save(update_fields=["phone"])

        return self.get(request)


class ChangePasswordView(APIView):
    """
    POST /api/v1/auth/change-password/
    Updates user password after verifying current password.
    """
    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = "auth"

    def post(self, request):
        user = request.user
        current_password = request.data.get("current_password")
        new_password = request.data.get("new_password")

        if not current_password or not new_password:
            return Response(
                {"detail": "Both current_password and new_password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not user.check_password(current_password):
            return Response(
                {"detail": "Incorrect current password."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError
        try:
            validate_password(new_password, user)
        except ValidationError as e:
            return Response(
                {"detail": list(e.messages)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.save(update_fields=["password"])

        return Response(
            {"status": "success", "message": "Password changed successfully."},
            status=status.HTTP_200_OK,
        )
