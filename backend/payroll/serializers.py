from rest_framework import serializers
from employees.models import Employee
from payroll.models import PayrollRun, Payslip, SalaryStructure


class SalaryStructureSerializer(serializers.ModelSerializer):
    employee_id_code = serializers.CharField(source="employee.employee_id", read_only=True)
    employee_name = serializers.SerializerMethodField()
    employee_email = serializers.CharField(source="employee.user.email", read_only=True)
    department_name = serializers.CharField(source="employee.department.name", default="General", read_only=True)
    designation = serializers.CharField(source="employee.designation", read_only=True)
    monthly_gross = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    monthly_deductions = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    monthly_net = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = SalaryStructure
        fields = [
            "id",
            "employee",
            "employee_id_code",
            "employee_name",
            "employee_email",
            "department_name",
            "designation",
            "annual_ctc",
            "basic_salary",
            "hra",
            "special_allowance",
            "provident_fund",
            "professional_tax",
            "tds",
            "currency",
            "monthly_gross",
            "monthly_deductions",
            "monthly_net",
            "effective_date",
            "is_active",
            "updated_at",
        ]

    def get_employee_name(self, obj):
        return obj.employee.user.get_full_name() or obj.employee.user.username


class PayslipSerializer(serializers.ModelSerializer):
    employee_id_code = serializers.CharField(source="employee.employee_id", read_only=True)
    employee_name = serializers.SerializerMethodField()
    employee_email = serializers.CharField(source="employee.user.email", read_only=True)
    department_name = serializers.CharField(source="employee.department.name", default="General", read_only=True)
    designation = serializers.CharField(source="employee.designation", read_only=True)
    masked_bank_account = serializers.SerializerMethodField()
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Payslip
        fields = [
            "id",
            "payslip_number",
            "payroll_run",
            "employee",
            "employee_id_code",
            "employee_name",
            "employee_email",
            "department_name",
            "designation",
            "month",
            "year",
            "working_days",
            "present_days",
            "paid_leaves",
            "unpaid_leaves",
            "loss_of_pay_days",
            "basic_salary",
            "hra",
            "special_allowance",
            "bonus",
            "overtime_pay",
            "gross_earnings",
            "provident_fund",
            "professional_tax",
            "tds",
            "loss_of_pay_amount",
            "other_deductions",
            "total_deductions",
            "net_salary",
            "bank_name",
            "bank_account_number",
            "masked_bank_account",
            "status",
            "status_display",
            "payment_method",
            "payment_date",
            "transaction_reference",
            "notes",
            "created_at",
        ]

    def get_employee_name(self, obj):
        return obj.employee.user.get_full_name() or obj.employee.user.username

    def get_masked_bank_account(self, obj):
        acc = obj.bank_account_number or ""
        if len(acc) > 4:
            return "•••• " + acc[-4:]
        return acc


class PayrollRunSerializer(serializers.ModelSerializer):
    processed_by_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    payslips_count = serializers.IntegerField(source="payslips.count", read_only=True)

    class Meta:
        model = PayrollRun
        fields = [
            "id",
            "month",
            "year",
            "status",
            "status_display",
            "total_employees",
            "total_gross",
            "total_deductions",
            "total_net",
            "processed_by",
            "processed_by_name",
            "approved_by",
            "approved_by_name",
            "disbursement_date",
            "notes",
            "payslips_count",
            "created_at",
            "updated_at",
        ]

    def get_processed_by_name(self, obj):
        return obj.processed_by.get_full_name() or obj.processed_by.username if obj.processed_by else None

    def get_approved_by_name(self, obj):
        return obj.approved_by.get_full_name() or obj.approved_by.username if obj.approved_by else None


class ProcessPayrollInputSerializer(serializers.Serializer):
    month = serializers.IntegerField(min_value=1, max_value=12)
    year = serializers.IntegerField(min_value=2020, max_value=2050)
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class DisbursePayrollInputSerializer(serializers.Serializer):
    payment_method = serializers.ChoiceField(
        choices=["BANK_TRANSFER", "DIRECT_DEPOSIT", "UPI", "CHEQUE"],
        default="BANK_TRANSFER"
    )
    transaction_reference = serializers.CharField(required=False, allow_blank=True, default="")
    disbursement_date = serializers.DateField(required=False)
