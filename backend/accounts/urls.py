from django.urls import path
from .views import (
    ChangePasswordView,
    CurrentUserView,
    CustomTokenRefreshView,
    ForgotPasswordView,
    LoginView,
    LogoutView,
    MFAToggleView,
    MFAVerifyView,
    RegisterView,
    ResetPasswordView,
    UserProfileView,
    UserRecordDetailView,
)

urlpatterns = [
    path("login/", LoginView.as_view(), name="auth-login"),
    path("register/", RegisterView.as_view(), name="auth-register"),
    path("forgot-password/", ForgotPasswordView.as_view(), name="auth-forgot-password"),
    path("reset-password/", ResetPasswordView.as_view(), name="auth-reset-password"),
    path("mfa/verify/", MFAVerifyView.as_view(), name="auth-mfa-verify"),
    path("mfa/toggle/", MFAToggleView.as_view(), name="auth-mfa-toggle"),
    path("token/refresh/", CustomTokenRefreshView.as_view(), name="auth-token-refresh"),
    path("logout/", LogoutView.as_view(), name="auth-logout"),
    path("me/", CurrentUserView.as_view(), name="auth-me"),
    path("profile/", UserProfileView.as_view(), name="auth-profile"),
    path("change-password/", ChangePasswordView.as_view(), name="auth-change-password"),
    path("users/<int:pk>/", UserRecordDetailView.as_view(), name="auth-user-detail"),
]
