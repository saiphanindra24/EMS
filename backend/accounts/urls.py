from django.urls import path
from .views import (
    ChangePasswordView,
    CurrentUserView,
    CustomTokenRefreshView,
    LoginView,
    LogoutView,
    UserProfileView,
    UserRecordDetailView,
)

urlpatterns = [
    path("login/", LoginView.as_view(), name="auth-login"),
    path("token/refresh/", CustomTokenRefreshView.as_view(), name="auth-token-refresh"),
    path("logout/", LogoutView.as_view(), name="auth-logout"),
    path("me/", CurrentUserView.as_view(), name="auth-me"),
    path("profile/", UserProfileView.as_view(), name="auth-profile"),
    path("change-password/", ChangePasswordView.as_view(), name="auth-change-password"),
    path("users/<int:pk>/", UserRecordDetailView.as_view(), name="auth-user-detail"),
]
