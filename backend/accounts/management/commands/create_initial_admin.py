import getpass
from django.core.management.base import BaseCommand
from accounts.models import User, Role


class Command(BaseCommand):
    help = "Securely create an initial EMWTS Super Admin user"

    def add_arguments(self, parser):
        parser.add_argument("--email", type=str, help="Admin email address")
        parser.add_argument("--password", type=str, help="Admin password (leave blank for secure prompt)")
        parser.add_argument("--first-name", type=str, default="System", help="First name")
        parser.add_argument("--last-name", type=str, default="Admin", help="Last name")
        parser.add_argument("--role", type=str, default="SUPER_ADMIN", choices=["SUPER_ADMIN", "HR_ADMIN"])

    def handle(self, *args, **options):
        email = options.get("email")
        if not email:
            email = input("Enter admin email: ").strip()

        if User.objects.filter(email=email).exists():
            self.stdout.write(self.style.WARNING(f"User with email '{email}' already exists."))
            return

        password = options.get("password")
        if not password:
            password = getpass.getpass("Enter secure password: ")
            password_confirm = getpass.getpass("Confirm password: ")
            if password != password_confirm:
                self.stdout.write(self.style.ERROR("Passwords do not match."))
                return

        role = options.get("role") or Role.SUPER_ADMIN

        user = User.objects.create_user(
            email=email,
            password=password,
            first_name=options.get("first_name", "System"),
            last_name=options.get("last_name", "Admin"),
            role=role,
            is_staff=True,
            is_superuser=(role == Role.SUPER_ADMIN),
        )

        self.stdout.write(
            self.style.SUCCESS(f"Successfully created initial admin user: {user.email} (Role: {user.role})")
        )
