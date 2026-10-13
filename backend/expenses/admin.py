from django.contrib import admin
from .models import ExpenseClaim


@admin.register(ExpenseClaim)
class ExpenseClaimAdmin(admin.ModelAdmin):
    list_display = (
        "claim_number",
        "employee",
        "title",
        "category",
        "currency",
        "total_amount",
        "status",
        "is_billable",
        "created_at",
    )
    list_filter = ("status", "category", "is_billable", "currency")
    search_fields = ("claim_number", "title", "employee__user__first_name", "employee__user__last_name")
    readonly_fields = ("claim_number", "total_amount", "created_at", "updated_at")
