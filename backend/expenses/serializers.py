from decimal import Decimal
from rest_framework import serializers
from .models import ExpenseCategory, ExpenseClaim, ExpenseStatus, PaymentMethod


class ExpenseClaimSerializer(serializers.ModelSerializer):
    employee_id = serializers.CharField(source="employee.employee_id", read_only=True)
    employee_name = serializers.SerializerMethodField()
    employee_email = serializers.CharField(source="employee.user.email", read_only=True)
    department_name = serializers.CharField(source="employee.department.name", read_only=True, default="")
    project_code = serializers.CharField(source="project.code", read_only=True, default="")
    project_name = serializers.CharField(source="project.name", read_only=True, default="")
    category_display = serializers.CharField(source="get_category_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    payment_method_display = serializers.CharField(source="get_payment_method_display", read_only=True, default="")
    manager_reviewer_name = serializers.SerializerMethodField()
    finance_reviewer_name = serializers.SerializerMethodField()

    class Meta:
        model = ExpenseClaim
        fields = [
            "id",
            "claim_number",
            "employee",
            "employee_id",
            "employee_name",
            "employee_email",
            "department_name",
            "project",
            "project_code",
            "project_name",
            "title",
            "category",
            "category_display",
            "expense_date",
            "currency",
            "amount",
            "tax_amount",
            "total_amount",
            "is_billable",
            "receipt",
            "receipt_url",
            "description",
            "status",
            "status_display",
            "manager_reviewed_by",
            "manager_reviewer_name",
            "manager_reviewed_at",
            "manager_notes",
            "finance_reviewed_by",
            "finance_reviewer_name",
            "finance_reviewed_at",
            "finance_notes",
            "payment_method",
            "payment_method_display",
            "transaction_reference",
            "reimbursed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "claim_number",
            "employee",
            "total_amount",
            "status",
            "manager_reviewed_by",
            "manager_reviewed_at",
            "manager_notes",
            "finance_reviewed_by",
            "finance_reviewed_at",
            "finance_notes",
            "payment_method",
            "transaction_reference",
            "reimbursed_at",
            "created_at",
            "updated_at",
        ]

    def get_employee_name(self, obj):
        if obj.employee and obj.employee.user:
            user = obj.employee.user
            full = f"{user.first_name} {user.last_name}".strip()
            return full or user.username
        return "Unknown"

    def get_manager_reviewer_name(self, obj):
        if obj.manager_reviewed_by:
            full = f"{obj.manager_reviewed_by.first_name} {obj.manager_reviewed_by.last_name}".strip()
            return full or obj.manager_reviewed_by.username
        return ""

    def get_finance_reviewer_name(self, obj):
        if obj.finance_reviewed_by:
            full = f"{obj.finance_reviewed_by.first_name} {obj.finance_reviewed_by.last_name}".strip()
            return full or obj.finance_reviewed_by.username
        return ""

    def validate(self, attrs):
        amount = attrs.get("amount")
        if amount is not None and amount <= Decimal("0.00"):
            raise serializers.ValidationError({"amount": "Expense amount must be greater than zero."})
        tax_amount = attrs.get("tax_amount", Decimal("0.00"))
        if tax_amount is not None and tax_amount < Decimal("0.00"):
            raise serializers.ValidationError({"tax_amount": "Tax amount cannot be negative."})
        return attrs


class ExpenseManagerReviewInputSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["APPROVE", "REJECT"])
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class ExpenseFinanceSettlementInputSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["APPROVE", "REJECT", "REIMBURSE"])
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    payment_method = serializers.ChoiceField(
        choices=PaymentMethod.choices,
        required=False,
        default=PaymentMethod.DIRECT_DEPOSIT
    )
    transaction_reference = serializers.CharField(required=False, allow_blank=True, default="")
