from django.conf import settings
from django.core import signing
from django.core.mail import send_mail
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User
from .permissions import IsOwnerOrManagerOrAdmin
from .serializers import (
    ForgotPasswordSerializer,
    LoginSerializer,
    LogoutSerializer,
    MFAToggleSerializer,
    MFAVerifySerializer,
    RegisterSerializer,
    ResetPasswordSerializer,
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
    Authenticates user via email and password, returning JWT or requiring MFA challenge.
    """
    permission_classes = [permissions.AllowAny]
    throttle_scope = "auth"

    def post(self, request, *args, **kwargs):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        user = data["user"]

        # Check if Multi-Factor Authentication is enabled on this account
        if user.mfa_enabled:
            otp = user.generate_mfa_otp()
            try:
                send_mail(
                    subject="EMWTS Security Code - Two-Factor Authentication",
                    message=f"Hello {user.first_name or 'Team Member'},\n\nYour 6-digit verification code is:\n\n{otp}\n\nThis security code expires in 10 minutes. If you did not attempt to sign in, please secure your account immediately.\n\n— EMWTS Security Team",
                    from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@emwts.local"),
                    recipient_list=[user.email],
                    fail_silently=True,
                )
            except Exception:
                pass

            temp_token = signing.dumps({"user_id": user.id, "purpose": "mfa"}, salt="emwts_mfa")
            return Response({
                "status": "mfa_required",
                "message": "Two-factor authentication code required.",
                "email_masked": user.masked_email,
                "temp_token": temp_token,
            }, status=status.HTTP_200_OK)

        user_data = UserSerializer(user).data
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


class MFAVerifyView(APIView):
    """
    POST /api/v1/auth/mfa/verify/
    Verifies 6-digit TOTP or email OTP to complete two-factor authentication.
    """
    permission_classes = [permissions.AllowAny]
    throttle_scope = "auth"

    def post(self, request):
        serializer = MFAVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        temp_token = serializer.validated_data["temp_token"]
        code = serializer.validated_data["code"]

        try:
            payload = signing.loads(temp_token, salt="emwts_mfa", max_age=600)
            if payload.get("purpose") != "mfa":
                raise ValueError("Invalid purpose")
            user = User.objects.get(id=payload["user_id"], is_active=True)
        except Exception:
            return Response(
                {"detail": "MFA session has expired or is invalid. Please sign in again."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not (user.verify_totp(code) or user.verify_mfa_otp(code)):
            return Response(
                {"code": ["Invalid or expired 6-digit security code."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        refresh = RefreshToken.for_user(user)
        refresh["role"] = user.role
        refresh["email"] = user.email
        refresh["full_name"] = user.full_name
        access = str(refresh.access_token)

        user_data = UserSerializer(user).data
        response = Response({
            "status": "success",
            "message": "Two-factor verification successful",
            "user": user_data,
            "access": access,
            "refresh": str(refresh),
        }, status=status.HTTP_200_OK)
        set_auth_cookies(response, access, str(refresh))
        return response


class MFAToggleView(APIView):
    """
    POST /api/v1/auth/mfa/toggle/
    Enables or disables Multi-Factor Authentication for the authenticated user.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = MFAToggleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        enable = serializer.validated_data["enable"]
        user = request.user

        if enable:
            secret = user.mfa_secret or user.generate_mfa_secret()
            user.mfa_enabled = True
            user.save(update_fields=["mfa_enabled", "mfa_secret"])
            otpauth_url = f"otpauth://totp/EMWTS:{user.email}?secret={secret}&issuer=EMWTS"
            return Response({
                "status": "success",
                "mfa_enabled": True,
                "mfa_secret": secret,
                "otpauth_url": otpauth_url,
                "message": "Two-factor authentication enabled successfully.",
            }, status=status.HTTP_200_OK)
        else:
            user.mfa_enabled = False
            user.save(update_fields=["mfa_enabled"])
            return Response({
                "status": "success",
                "mfa_enabled": False,
                "message": "Two-factor authentication has been disabled.",
            }, status=status.HTTP_200_OK)


class RegisterView(APIView):
    """
    POST /api/v1/auth/register/
    Self-service employee registration. Creates user account and employee profile.
    """
    permission_classes = [permissions.AllowAny]
    throttle_scope = "auth"

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        refresh = RefreshToken.for_user(user)
        refresh["role"] = user.role
        refresh["email"] = user.email
        refresh["full_name"] = user.full_name
        access = str(refresh.access_token)

        user_data = UserSerializer(user).data
        response = Response({
            "status": "success",
            "message": f"Welcome to EMWTS, {user.first_name}! Your account has been registered.",
            "user": user_data,
            "access": access,
            "refresh": str(refresh),
        }, status=status.HTTP_201_CREATED)
        set_auth_cookies(response, access, str(refresh))
        return response


class ForgotPasswordView(APIView):
    """
    POST /api/v1/auth/forgot-password/
    Sends a 6-digit password reset verification code to user's registered email.
    """
    permission_classes = [permissions.AllowAny]
    throttle_scope = "auth"

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]

        user = User.objects.filter(email__iexact=email).first()
        if user:
            code = user.generate_password_reset_code()
            try:
                send_mail(
                    subject="EMWTS Password Reset Verification Code",
                    message=f"Hello {user.first_name or 'User'},\n\nYour 6-digit password reset code is:\n\n{code}\n\nThis verification code expires in 15 minutes. If you did not request this change, please ignore this email.\n\n— EMWTS Security Team",
                    from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@emwts.local"),
                    recipient_list=[user.email],
                    fail_silently=True,
                )
            except Exception:
                pass

        return Response({
            "status": "success",
            "message": "If an account exists with this email address, a 6-digit verification code has been dispatched.",
            "email_masked": user.masked_email if user else email,
        }, status=status.HTTP_200_OK)


class ResetPasswordView(APIView):
    """
    POST /api/v1/auth/reset-password/
    Verifies 6-digit code and sets new password for user account.
    """
    permission_classes = [permissions.AllowAny]
    throttle_scope = "auth"

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        new_password = serializer.validated_data["new_password"]

        user.set_password(new_password)
        user.password_reset_code = ""
        user.password_reset_expires_at = None
        user.save(update_fields=["password", "password_reset_code", "password_reset_expires_at"])

        return Response({
            "status": "success",
            "message": "Your password has been successfully reset. You may now sign in.",
        }, status=status.HTTP_200_OK)


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
