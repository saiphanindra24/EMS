import logging
from django.conf import settings
from django.db import connection
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

logger = logging.getLogger("django.request")


@api_view(["GET"])
@permission_classes([AllowAny])
@throttle_classes([])
def api_root(request):
    """
    EMWTS Root API Welcome Endpoint.
    """
    return Response({
        "service": "EMWTS Backend API",
        "status": "online",
        "version": "1.0.0",
        "health": "/healthz/",
        "admin": "/admin/",
        "auth": "/api/v1/auth/login/",
        "message": "EMWTS Employee Management & Work Tracking API is live.",
    }, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([AllowAny])
@throttle_classes([])
def health_check(request):
    """
    EMWTS System & Database Health Check Endpoint.
    Used by container orchestrators, load balancers, and uptime monitors.
    """
    now = timezone.now().isoformat()
    try:
        connection.ensure_connection()
        db_vendor = connection.vendor
        db_name = connection.settings_dict.get("NAME")
        return Response({
            "status": "healthy",
            "service": "EMWTS Backend API",
            "timestamp": now,
            "database": {
                "status": "connected",
                "vendor": db_vendor,
                "name": db_name if settings.DEBUG else "configured",
            }
        }, status=status.HTTP_200_OK)
    except Exception as exc:
        logger.error("Health check database probe failed: %s", exc, exc_info=True)
        return Response({
            "status": "unhealthy",
            "service": "EMWTS Backend API",
            "timestamp": now,
            "database": {
                "status": "disconnected",
                "error": str(exc) if settings.DEBUG else "Database connection failure",
            }
        }, status=status.HTTP_503_SERVICE_UNAVAILABLE)