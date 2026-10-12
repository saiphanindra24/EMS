from django.contrib.auth.models import (
    AbstractBaseUser,
    BaseUserManager,
    PermissionsMixin,
)
from django.db import models
from django.utils import timezone


class Role(models.TextChoices):
    SUPER_ADMIN = "SUPER_ADMIN", "Super Admin"
    HR_ADMIN = "HR_ADMIN", "HR Admin"
    MANAGER = "MANAGER", "Manager"
    EMPLOYEE = "EMPLOYEE", "Employee"


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("The Email field must be set")
        email = self.normalize_email(email)
        extra_fields.setdefault("role", Role.EMPLOYEE)
        user = self.model(email=email, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", Role.SUPER_ADMIN)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique=True, db_index=True)
    first_name = models.CharField(max_length=150, blank=True, default="")
    last_name = models.CharField(max_length=150, blank=True, default="")
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.EMPLOYEE,
        db_index=True,
    )
    department = models.CharField(max_length=100, blank=True, default="")
    manager = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="direct_reports",
    )
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)
    phone = models.CharField(max_length=30, blank=True, default="")
    mfa_enabled = models.BooleanField(default=False)
    mfa_secret = models.CharField(max_length=64, blank=True, default="")
    mfa_otp = models.CharField(max_length=6, blank=True, default="")
    mfa_otp_expires_at = models.DateTimeField(null=True, blank=True)
    password_reset_code = models.CharField(max_length=6, blank=True, default="")
    password_reset_expires_at = models.DateTimeField(null=True, blank=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta:
        verbose_name = "user"
        verbose_name_plural = "users"
        ordering = ["-date_joined"]

    def __str__(self):
        return f"{self.email} ({self.role})"

    @property
    def full_name(self):
        full = f"{self.first_name} {self.last_name}".strip()
        return full or self.email

    @property
    def masked_email(self):
        if "@" not in self.email:
            return self.email
        name, domain = self.email.split("@", 1)
        if len(name) <= 2:
            masked_name = name[0] + "*"
        else:
            masked_name = name[0] + "*" * (len(name) - 2) + name[-1]
        return f"{masked_name}@{domain}"

    @property
    def is_super_admin(self):
        return self.role == Role.SUPER_ADMIN or self.is_superuser

    @property
    def is_hr_admin(self):
        return self.role == Role.HR_ADMIN or self.is_super_admin

    @property
    def is_manager(self):
        return self.role == Role.MANAGER or self.is_hr_admin

    @property
    def is_employee(self):
        return True

    # ── MFA & OTP Utilities ──────────────────────────────────────────────────
    def generate_mfa_secret(self):
        """Generates a standard Base32 TOTP secret for Authenticator apps."""
        import base64
        import secrets
        secret = base64.b32encode(secrets.token_bytes(20)).decode("utf-8").replace("=", "")
        self.mfa_secret = secret
        self.save(update_fields=["mfa_secret"])
        return secret

    def verify_totp(self, code, window=1):
        """Validates a 6-digit TOTP code according to RFC 6238."""
        if not self.mfa_secret or not code:
            return False
        import base64
        import hashlib
        import hmac
        import struct
        import time
        code_str = str(code).strip()
        if len(code_str) != 6 or not code_str.isdigit():
            return False
        try:
            padded_secret = self.mfa_secret + "=" * ((8 - len(self.mfa_secret) % 8) % 8)
            key = base64.b32decode(padded_secret, casefold=True)
            current_time = int(time.time() // 30)
            for offset in range(-window, window + 1):
                t = current_time + offset
                msg = struct.pack(">Q", t)
                h = hmac.new(key, msg, hashlib.sha1).digest()
                o = h[19] & 15
                token = struct.unpack(">I", h[o : o + 4])[0] & 0x7FFFFFFF
                totp_code = str(token % 1000000).zfill(6)
                if hmac.compare_digest(totp_code, code_str):
                    return True
        except Exception:
            return False
        return False

    def generate_mfa_otp(self):
        """Generates a 6-digit numeric OTP valid for 10 minutes."""
        import secrets
        from datetime import timedelta
        otp = "".join(secrets.choice("0123456789") for _ in range(6))
        self.mfa_otp = otp
        self.mfa_otp_expires_at = timezone.now() + timedelta(minutes=10)
        self.save(update_fields=["mfa_otp", "mfa_otp_expires_at"])
        return otp

    def verify_mfa_otp(self, code):
        """Verifies the email OTP against the stored code and expiration."""
        if not self.mfa_otp or not self.mfa_otp_expires_at or not code:
            return False
        if timezone.now() > self.mfa_otp_expires_at:
            return False
        import hmac
        code_str = str(code).strip()
        if hmac.compare_digest(self.mfa_otp, code_str):
            self.mfa_otp = ""
            self.mfa_otp_expires_at = None
            self.save(update_fields=["mfa_otp", "mfa_otp_expires_at"])
            return True
        return False

    def generate_password_reset_code(self):
        """Generates a 6-digit password reset code valid for 15 minutes."""
        import secrets
        from datetime import timedelta
        code = "".join(secrets.choice("0123456789") for _ in range(6))
        self.password_reset_code = code
        self.password_reset_expires_at = timezone.now() + timedelta(minutes=15)
        self.save(update_fields=["password_reset_code", "password_reset_expires_at"])
        return code

    def verify_password_reset_code(self, code):
        """Verifies password reset code."""
        if not self.password_reset_code or not self.password_reset_expires_at or not code:
            return False
        if timezone.now() > self.password_reset_expires_at:
            return False
        import hmac
        code_str = str(code).strip()
        return hmac.compare_digest(self.password_reset_code, code_str)
