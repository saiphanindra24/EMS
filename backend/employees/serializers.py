from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers

from accounts.models import Role
from .models import Department, Employee, EmploymentStatus, EmploymentType

User = get_user_model()


class DepartmentHeadSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source="user.full_name", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = Employee
        fields = ["id", "employee_id", "full_name", "email", "designation"]


class DepartmentSerializer(serializers.ModelSerializer):
    employee_count = serializers.IntegerField(read_only=True)
    head_details = DepartmentHeadSerializer(source="head", read_only=True)

    class Meta:
        model = Department
        fields = [
            "id",
            "name",
            "code",
            "description",
            "head",
            "head_details",
            "is_active",
            "employee_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_name(self, value):
        stripped = value.strip()
        qs = Department.objects.filter(name__iexact=stripped)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("A department with this name already exists.")
        return stripped

    def validate_code(self, value):
        code_upper = value.strip().upper()
        qs = Department.objects.filter(code__iexact=code_upper)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("A department with this code already exists.")
        return code_upper


class SimpleEmployeeSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    email = serializers.EmailField(read_only=True)
    role = serializers.CharField(read_only=True)

    class Meta:
        model = Employee
        fields = [
            "id",
            "employee_id",
            "full_name",
            "email",
            "role",
            "designation",
            "status",
            "work_location",
            "profile_photo",
        ]


class DepartmentDetailSerializer(DepartmentSerializer):
    employees = SimpleEmployeeSerializer(many=True, read_only=True)

    class Meta(DepartmentSerializer.Meta):
        fields = DepartmentSerializer.Meta.fields + ["employees"]


class EmployeeListSerializer(serializers.ModelSerializer):
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)
    full_name = serializers.CharField(read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    role = serializers.CharField(source="user.role", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True, default="")
    department_code = serializers.CharField(source="department.code", read_only=True, default="")
    manager_name = serializers.CharField(source="manager.full_name", read_only=True, default="")
    is_active_account = serializers.BooleanField(source="user.is_active", read_only=True)

    class Meta:
        model = Employee
        fields = [
            "id",
            "employee_id",
            "first_name",
            "last_name",
            "full_name",
            "email",
            "phone",
            "profile_photo",
            "department",
            "department_name",
            "department_code",
            "designation",
            "manager",
            "manager_name",
            "employment_type",
            "status",
            "work_location",
            "date_joined",
            "role",
            "is_active_account",
            "is_archived",
            "created_at",
            "updated_at",
        ]


class EmployeeDetailSerializer(serializers.ModelSerializer):
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)
    full_name = serializers.CharField(read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    role = serializers.CharField(source="user.role", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True, default="")
    department_code = serializers.CharField(source="department.code", read_only=True, default="")
    manager_name = serializers.CharField(source="manager.full_name", read_only=True, default="")
    is_active_account = serializers.BooleanField(source="user.is_active", read_only=True)

    class Meta:
        model = Employee
        fields = [
            "id",
            "employee_id",
            "first_name",
            "last_name",
            "full_name",
            "email",
            "phone",
            "profile_photo",
            "department",
            "department_name",
            "department_code",
            "designation",
            "manager",
            "manager_name",
            "employment_type",
            "status",
            "work_location",
            "date_joined",
            "role",
            "is_active_account",
            "is_archived",
            # Sensitive fields:
            "date_of_birth",
            "gender",
            "emergency_contact_name",
            "emergency_contact_phone",
            "address",
            "national_id",
            "bank_account_number",
            "bank_name",
            "base_salary",
            "created_at",
            "updated_at",
        ]

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        request = self.context.get("request")

        # Check sensitive permission: Super Admin, HR Admin, or the Employee owner themselves
        can_view_sensitive = False
        if request and request.user and request.user.is_authenticated:
            u = request.user
            if u.is_super_admin or u.is_hr_admin or (instance.user_id == u.id):
                can_view_sensitive = True

        if not can_view_sensitive:
            sensitive_keys = [
                "date_of_birth",
                "gender",
                "emergency_contact_name",
                "emergency_contact_phone",
                "address",
                "national_id",
                "bank_account_number",
                "bank_name",
                "base_salary",
            ]
            for key in sensitive_keys:
                ret.pop(key, None)

        return ret


class EmployeeCreateSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(write_only=True)
    first_name = serializers.CharField(write_only=True, max_length=150)
    last_name = serializers.CharField(write_only=True, max_length=150, required=False, allow_blank=True, default="")
    password = serializers.CharField(write_only=True, required=False, allow_blank=True, default="")
    role = serializers.ChoiceField(choices=Role.choices, default=Role.EMPLOYEE, write_only=True)
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = Employee
        fields = [
            "id",
            "full_name",
            "email",
            "first_name",
            "last_name",
            "password",
            "role",
            "employee_id",
            "phone",
            "profile_photo",
            "department",
            "designation",
            "manager",
            "employment_type",
            "status",
            "work_location",
            "date_joined",
            # Sensitive fields
            "date_of_birth",
            "gender",
            "emergency_contact_name",
            "emergency_contact_phone",
            "address",
            "national_id",
            "bank_account_number",
            "bank_name",
            "base_salary",
        ]

    def validate_email(self, value):
        norm = value.strip().lower()
        if User.objects.filter(email__iexact=norm).exists():
            raise serializers.ValidationError("An account with this email address already exists.")
        return norm

    def validate_employee_id(self, value):
        norm = value.strip().upper()
        if Employee.objects.filter(employee_id__iexact=norm).exists():
            raise serializers.ValidationError("An employee with this Employee ID already exists.")
        return norm

    @transaction.atomic
    def create(self, validated_data):
        email = validated_data.pop("email")
        first_name = validated_data.pop("first_name")
        last_name = validated_data.pop("last_name", "")
        password = validated_data.pop("password", "").strip()
        role = validated_data.pop("role", Role.EMPLOYEE)

        # Create user account
        user = User(
            email=email,
            first_name=first_name,
            last_name=last_name,
            role=role,
            is_active=True,
        )
        if password:
            user.set_password(password)
        else:
            # Default secure initial password: Employee ID + 2026!
            emp_id = validated_data.get("employee_id", "EMWTS")
            user.set_password(f"{emp_id}Pass2026!")

        manager_employee = validated_data.get("manager")
        if manager_employee and manager_employee.user:
            user.manager = manager_employee.user

        dept = validated_data.get("department")
        if dept:
            user.department = dept.name

        user.save()

        employee = Employee.objects.create(user=user, **validated_data)
        return employee


class EmployeeUpdateSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email", required=False)
    first_name = serializers.CharField(source="user.first_name", required=False, max_length=150)
    last_name = serializers.CharField(source="user.last_name", required=False, max_length=150, allow_blank=True)
    role = serializers.ChoiceField(choices=Role.choices, source="user.role", required=False)

    class Meta:
        model = Employee
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "role",
            "employee_id",
            "phone",
            "profile_photo",
            "department",
            "designation",
            "manager",
            "employment_type",
            "status",
            "work_location",
            "date_joined",
            # Sensitive fields
            "date_of_birth",
            "gender",
            "emergency_contact_name",
            "emergency_contact_phone",
            "address",
            "national_id",
            "bank_account_number",
            "bank_name",
            "base_salary",
        ]

    def validate_email(self, value):
        norm = value.strip().lower()
        user_qs = User.objects.filter(email__iexact=norm)
        if self.instance and self.instance.user:
            user_qs = user_qs.exclude(pk=self.instance.user.pk)
        if user_qs.exists():
            raise serializers.ValidationError("An account with this email address already exists.")
        return norm

    def validate_employee_id(self, value):
        norm = value.strip().upper()
        emp_qs = Employee.objects.filter(employee_id__iexact=norm)
        if self.instance:
            emp_qs = emp_qs.exclude(pk=self.instance.pk)
        if emp_qs.exists():
            raise serializers.ValidationError("An employee with this Employee ID already exists.")
        return norm

    @transaction.atomic
    def update(self, instance, validated_data):
        user_data = validated_data.pop("user", {})
        user = instance.user

        if user_data:
            if "first_name" in user_data:
                user.first_name = user_data["first_name"]
            if "last_name" in user_data:
                user.last_name = user_data["last_name"]
            if "email" in user_data:
                user.email = user_data["email"]
            if "role" in user_data:
                user.role = user_data["role"]

        if "department" in validated_data:
            dept = validated_data["department"]
            user.department = dept.name if dept else ""

        if "manager" in validated_data:
            mgr = validated_data["manager"]
            user.manager = mgr.user if (mgr and mgr.user) else None

        user.save()

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()
        return instance
