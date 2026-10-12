from django.urls import path
from .views import MessageHistoryView

urlpatterns = [
    path("history/<str:room_name>/", MessageHistoryView.as_view(), name="chat_history"),
]
