from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from accounts.models import Role
from employees.models import Department, Employee, EmploymentStatus, EmploymentType

User = get_user_model()


class Command(BaseCommand):
    help = "Seeds initial departments and realistic employees into the database."

    def handle(self, *args, **options):
        self.stdout.write("Seeding departments and employees...")

        with transaction.atomic():
            # 1. Departments
            dept_specs = [
                ("Engineering", "ENG", "Core platform, backend APIs, and software infrastructure"),
                ("Human Resources", "HR", "Talent management, recruitment, and workplace culture"),
                ("Product & Design", "PROD", "Product discovery, UX research, and UI design"),
                ("Marketing & Sales", "MKT", "Global brand outreach, customer growth, and campaigns"),
                ("Operations", "OPS", "Business operations, IT support, and facilities"),
            ]

            dept_map = {}
            for name, code, desc in dept_specs:
                dept, created = Department.objects.get_or_create(
                    code=code,
                    defaults={"name": name, "description": desc, "is_active": True},
                )
                if not created and dept.name != name:
                    dept.name = name
                    dept.description = desc
                    dept.save()
                dept_map[code] = dept
                self.stdout.write(f"  Department: {dept.name} ({dept.code})")

            # 2. Employees Specs
            employees_data = [
                {
                    "email": "admin@emwts.local",
                    "first_name": "System",
                    "last_name": "Admin",
                    "role": Role.SUPER_ADMIN,
                    "password": "AdminPass2026!",
                    "employee_id": "EMP-001",
                    "dept_code": "ENG",
                    "designation": "Chief Technology Officer",
                    "employment_type": EmploymentType.FULL_TIME,
                    "status": EmploymentStatus.ACTIVE,
                    "work_location": "New York HQ",
                    "phone": "+1 (555) 019-2831",
                    "base_salary": 165000.00,
                    "bank_account_number": "US98-1002-3344",
                    "national_id": "TAX-990-11-2001",
                    "emergency_name": "Sarah Admin",
                    "emergency_phone": "+1 (555) 019-2839",
                    "address": "450 Lexington Ave, New York, NY",
                },
                {
                    "email": "hr@emwts.local",
                    "first_name": "Priya",
                    "last_name": "Sharma",
                    "role": Role.HR_ADMIN,
                    "password": "HrPass2026!",
                    "employee_id": "EMP-002",
                    "dept_code": "HR",
                    "designation": "HR Director",
                    "employment_type": EmploymentType.FULL_TIME,
                    "status": EmploymentStatus.ACTIVE,
                    "work_location": "New York HQ",
                    "phone": "+1 (555) 019-4455",
                    "base_salary": 120000.00,
                    "bank_account_number": "US98-2003-5566",
                    "national_id": "TAX-990-11-2002",
                    "emergency_name": "Karan Sharma",
                    "emergency_phone": "+1 (555) 019-4456",
                    "address": "120 Broadway, New York, NY",
                },
                {
                    "email": "manager@emwts.local",
                    "first_name": "Rahul",
                    "last_name": "Verma",
                    "role": Role.MANAGER,
                    "password": "ManagerPass2026!",
                    "employee_id": "EMP-003",
                    "dept_code": "ENG",
                    "designation": "Engineering Manager",
                    "employment_type": EmploymentType.FULL_TIME,
                    "status": EmploymentStatus.ACTIVE,
                    "work_location": "Remote",
                    "phone": "+1 (555) 019-7788",
                    "base_salary": 135000.00,
                    "bank_account_number": "US98-3004-7788",
                    "national_id": "TAX-990-11-2003",
                    "emergency_name": "Sunita Verma",
                    "emergency_phone": "+1 (555) 019-7789",
                    "address": "742 Evergreen Terrace, Springfield",
                },
                {
                    "email": "ananya.rao@emwts.local",
                    "first_name": "Ananya",
                    "last_name": "Rao",
                    "role": Role.EMPLOYEE,
                    "password": "EmployeePass2026!",
                    "employee_id": "EMP-004",
                    "dept_code": "ENG",
                    "designation": "Senior Frontend Engineer",
                    "employment_type": EmploymentType.FULL_TIME,
                    "status": EmploymentStatus.ACTIVE,
                    "work_location": "Remote",
                    "phone": "+1 (555) 019-9911",
                    "base_salary": 110000.00,
                    "bank_account_number": "US98-4005-9911",
                    "national_id": "TAX-990-11-2004",
                    "emergency_name": "Ramesh Rao",
                    "emergency_phone": "+1 (555) 019-9912",
                    "address": "88 Pine St, Seattle, WA",
                },
                {
                    "email": "arjun.mehta@emwts.local",
                    "first_name": "Arjun",
                    "last_name": "Mehta",
                    "role": Role.EMPLOYEE,
                    "password": "EmployeePass2026!",
                    "employee_id": "EMP-005",
                    "dept_code": "ENG",
                    "designation": "Backend Systems Engineer",
                    "employment_type": EmploymentType.FULL_TIME,
                    "status": EmploymentStatus.ACTIVE,
                    "work_location": "Hybrid",
                    "phone": "+1 (555) 019-3322",
                    "base_salary": 105000.00,
                    "bank_account_number": "US98-5006-3322",
                    "national_id": "TAX-990-11-2005",
                    "emergency_name": "Devi Mehta",
                    "emergency_phone": "+1 (555) 019-3323",
                    "address": "150 California St, San Francisco, CA",
                },
                {
                    "email": "sneha.patel@emwts.local",
                    "first_name": "Sneha",
                    "last_name": "Patel",
                    "role": Role.EMPLOYEE,
                    "password": "EmployeePass2026!",
                    "employee_id": "EMP-006",
                    "dept_code": "PROD",
                    "designation": "Lead Product Designer",
                    "employment_type": EmploymentType.FULL_TIME,
                    "status": EmploymentStatus.ACTIVE,
                    "work_location": "Hybrid",
                    "phone": "+1 (555) 019-5566",
                    "base_salary": 115000.00,
                    "bank_account_number": "US98-6007-5566",
                    "national_id": "TAX-990-11-2006",
                    "emergency_name": "Amit Patel",
                    "emergency_phone": "+1 (555) 019-5567",
                    "address": "200 Park Ave, New York, NY",
                },
                {
                    "email": "vikram.singh@emwts.local",
                    "first_name": "Vikram",
                    "last_name": "Singh",
                    "role": Role.EMPLOYEE,
                    "password": "EmployeePass2026!",
                    "employee_id": "EMP-007",
                    "dept_code": "MKT",
                    "designation": "Marketing Lead",
                    "employment_type": EmploymentType.FULL_TIME,
                    "status": EmploymentStatus.ACTIVE,
                    "work_location": "On-site",
                    "phone": "+1 (555) 019-8899",
                    "base_salary": 98000.00,
                    "bank_account_number": "US98-7008-8899",
                    "national_id": "TAX-990-11-2007",
                    "emergency_name": "Pooja Singh",
                    "emergency_phone": "+1 (555) 019-8890",
                    "address": "500 Madison Ave, New York, NY",
                },
            ]

            created_employees = {}
            for item in employees_data:
                user, user_created = User.objects.get_or_create(
                    email=item["email"],
                    defaults={
                        "first_name": item["first_name"],
                        "last_name": item["last_name"],
                        "role": item["role"],
                        "is_active": True,
                    },
                )
                if user_created or not user.check_password(item["password"]):
                    user.set_password(item["password"])
                    user.role = item["role"]
                    user.first_name = item["first_name"]
                    user.last_name = item["last_name"]
                    user.save()

                dept = dept_map.get(item["dept_code"])

                emp, emp_created = Employee.objects.get_or_create(
                    employee_id=item["employee_id"],
                    defaults={
                        "user": user,
                        "department": dept,
                        "designation": item["designation"],
                        "employment_type": item["employment_type"],
                        "status": item["status"],
                        "work_location": item["work_location"],
                        "phone": item["phone"],
                        "base_salary": item["base_salary"],
                        "bank_account_number": item["bank_account_number"],
                        "national_id": item["national_id"],
                        "emergency_contact_name": item["emergency_name"],
                        "emergency_contact_phone": item["emergency_phone"],
                        "address": item["address"],
                        "date_joined": timezone.localdate(),
                    },
                )
                if not emp_created:
                    emp.department = dept
                    emp.designation = item["designation"]
                    emp.work_location = item["work_location"]
                    emp.phone = item["phone"]
                    emp.base_salary = item["base_salary"]
                    emp.bank_account_number = item["bank_account_number"]
                    emp.national_id = item["national_id"]
                    emp.address = item["address"]
                    emp.save()

                created_employees[item["employee_id"]] = emp
                self.stdout.write(f"  Employee: {emp.full_name} ({emp.employee_id}) - {emp.designation}")

            # Assign managers
            # Rahul Verma (EMP-003) is manager for Ananya Rao and Arjun Mehta
            manager_emp = created_employees.get("EMP-003")
            if manager_emp:
                for rep_id in ["EMP-004", "EMP-005"]:
                    rep = created_employees.get(rep_id)
                    if rep:
                        rep.manager = manager_emp
                        rep.save()
                        rep.user.manager = manager_emp.user
                        rep.user.save()

            # Assign Department Heads
            # Engineering head -> System Admin (EMP-001)
            # HR head -> Priya Sharma (EMP-002)
            # Product head -> Sneha Patel (EMP-006)
            # Marketing head -> Vikram Singh (EMP-007)
            if "ENG" in dept_map and "EMP-001" in created_employees:
                dept_map["ENG"].head = created_employees["EMP-001"]
                dept_map["ENG"].save()
            if "HR" in dept_map and "EMP-002" in created_employees:
                dept_map["HR"].head = created_employees["EMP-002"]
                dept_map["HR"].save()
            if "PROD" in dept_map and "EMP-006" in created_employees:
                dept_map["PROD"].head = created_employees["EMP-006"]
                dept_map["PROD"].save()
            if "MKT" in dept_map and "EMP-007" in created_employees:
                dept_map["MKT"].head = created_employees["EMP-007"]
                dept_map["MKT"].save()

        self.stdout.write(self.style.SUCCESS("Successfully seeded departments and employees."))
