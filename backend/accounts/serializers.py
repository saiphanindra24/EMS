from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from employees.models import Department, Employee, EmploymentStatus, EmploymentType
from .models import Role, User


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    masked_email = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "role",
            "department",
            "phone",
            "mfa_enabled",
            "manager",
            "is_active",
            "date_joined",
            "masked_email",
        ]
        read_only_fields = ["id", "is_active", "date_joined", "masked_email"]


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, required=True, style={"input_type": "password"})

    def validate(self, attrs):
        email = attrs.get("email").strip().lower()
        password = attrs.get("password")

        user = authenticate(
            request=self.context.get("request"),
            username=email,
            password=password,
        )

        if not user:
            raise serializers.ValidationError("Invalid email or password.")

        if not user.is_active:
            raise serializers.ValidationError("This account is currently disabled.")

        refresh = RefreshToken.for_user(user)
        refresh["role"] = user.role
        refresh["email"] = user.email
        refresh["full_name"] = user.full_name

        return {
            "user": user,
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        }


class RegisterSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=150, required=True)
    last_name = serializers.CharField(max_length=150, required=True)
    email = serializers.EmailField(required=True)
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True, default="")
    department = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    designation = serializers.CharField(max_length=100, required=False, allow_blank=True, default="Associate")
    password = serializers.CharField(write_only=True, required=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, required=True, min_length=8)

    def validate_email(self, value):
        normalized = value.strip().lower()
        if User.objects.filter(email__iexact=normalized).exists():
            raise serializers.ValidationError("An account with this email address already exists.")
        return normalized

    def validate(self, attrs):
        password = attrs.get("password")
        confirm_password = attrs.get("confirm_password")

        if password != confirm_password:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})

        try:
            validate_password(password)
        except DjangoValidationError as e:
            raise serializers.ValidationError({"password": list(e.messages)})

        return attrs

    def create(self, validated_data):
        validated_data.pop("confirm_password")
        password = validated_data.pop("password")
        email = validated_data["email"]
        first_name = validated_data["first_name"].strip()
        last_name = validated_data["last_name"].strip()
        phone = validated_data.get("phone", "").strip()
        dept_name = validated_data.get("department", "").strip()
        designation = validated_data.get("designation", "Associate").strip()

        # Find or create department object
        department_obj = None
        if dept_name:
            department_obj = Department.objects.filter(name__iexact=dept_name).first()
            if not department_obj:
                code = dept_name[:4].upper()
                department_obj, _ = Department.objects.get_or_create(
                    code=code,
                    defaults={"name": dept_name, "description": f"{dept_name} department"},
                )

        user = User.objects.create_user(
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            role=Role.EMPLOYEE,
            department=dept_name or (department_obj.name if department_obj else "Engineering"),
            phone=phone,
            is_active=True,
        )

        # Generate unique employee ID
        count = Employee.objects.count() + 101
        emp_id = f"EMP-{count:04d}"
        while Employee.objects.filter(employee_id=emp_id).exists():
            count += 1
            emp_id = f"EMP-{count:04d}"

        Employee.objects.create(
            user=user,
            employee_id=emp_id,
            phone=phone,
            department=department_obj,
            designation=designation or "Associate Specialist",
            employment_type=EmploymentType.FULL_TIME,
            status=EmploymentStatus.ACTIVE,
        )

        return user


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)

    def validate_email(self, value):
        return value.strip().lower()


class ResetPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    code = serializers.CharField(max_length=6, min_length=6, required=True)
    new_password = serializers.CharField(write_only=True, required=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, required=True, min_length=8)

    def validate(self, attrs):
        if attrs.get("new_password") != attrs.get("confirm_password"):
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})

        email = attrs.get("email").strip().lower()
        user = User.objects.filter(email__iexact=email).first()
        if not user:
            raise serializers.ValidationError("Invalid email address or verification code.")

        if not user.verify_password_reset_code(attrs.get("code")):
            raise serializers.ValidationError({"code": "Invalid or expired 6-digit verification code."})

        try:
            validate_password(attrs.get("new_password"), user)
        except DjangoValidationError as e:
            raise serializers.ValidationError({"new_password": list(e.messages)})

        attrs["user"] = user
        return attrs


class MFAVerifySerializer(serializers.Serializer):
    temp_token = serializers.CharField(required=True)
    code = serializers.CharField(max_length=6, min_length=6, required=True)


class MFAToggleSerializer(serializers.Serializer):
    enable = serializers.BooleanField(required=True)
    code = serializers.CharField(max_length=6, required=False, allow_blank=True, default="")


class TokenRefreshSerializer(serializers.Serializer):
    refresh = serializers.CharField(required=True)

    def validate(self, attrs):
        refresh_str = attrs.get("refresh")
        try:
            refresh = RefreshToken(refresh_str)
            data = {"access": str(refresh.access_token)}
            return data
        except Exception:
            raise serializers.ValidationError("Invalid or expired refresh token.")


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField(required=False, allow_blank=True)
