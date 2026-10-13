from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import Role
from employees.models import Department, Employee, EmploymentStatus
from payroll.models import PayrollRun, PayrollStatus, Payslip, PayslipStatus, SalaryStructure
from payroll.services import calculate_employee_payroll, run_monthly_payroll

User = get_user_model()


class PayrollModuleTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Create Admin
        self.admin_user = User.objects.create_user(
            email="admin@sskatt.local",
            password="AdminPassword123!",
            role=Role.SUPER_ADMIN,
            first_name="Admin",
            last_name="User"
        )

        # Create Employee User
        self.emp_user = User.objects.create_user(
            email="employee@sskatt.local",
            password="EmpPassword123!",
            role=Role.EMPLOYEE,
            first_name="Ananya",
            last_name="Rao"
        )

        # Create Department
        self.dept = Department.objects.create(name="Engineering", code="ENG")

        # Create Employee Profile
        self.employee = Employee.objects.create(
            user=self.emp_user,
            employee_id="EMP-101",
            department=self.dept,
            designation="Software Engineer",
            base_salary=Decimal("50000.00"),
            status=EmploymentStatus.ACTIVE,
            bank_name="HDFC Bank",
            bank_account_number="123456789012"
        )

        # Create Salary Structure
        self.salary_struct = SalaryStructure.objects.create(
            employee=self.employee,
            annual_ctc=Decimal("1200000.00"),
            basic_salary=Decimal("50000.00"),
            hra=Decimal("25000.00"),
            special_allowance=Decimal("25000.00"),
            provident_fund=Decimal("1800.00"),
            professional_tax=Decimal("200.00"),
            tds=Decimal("1000.00"),
        )

    def test_salary_structure_properties(self):
        self.assertEqual(self.salary_struct.monthly_gross, Decimal("100000.00"))
        self.assertEqual(self.salary_struct.monthly_deductions, Decimal("3000.00"))
        self.assertEqual(self.salary_struct.monthly_net, Decimal("97000.00"))

    def test_payroll_service_calculation(self):
        calc = calculate_employee_payroll(self.employee, year=2026, month=10)
        self.assertEqual(calc["basic_salary"], Decimal("50000.00"))
        self.assertEqual(calc["gross_earnings"], Decimal("100000.00"))
        self.assertEqual(calc["total_deductions"], Decimal("3000.00"))
        self.assertEqual(calc["net_salary"], Decimal("97000.00"))

    def test_run_monthly_payroll_batch(self):
        run = run_monthly_payroll(year=2026, month=10, user=self.admin_user)
        self.assertEqual(run.month, 10)
        self.assertEqual(run.year, 2026)
        self.assertEqual(run.total_employees, 1)
        self.assertEqual(run.total_net, Decimal("97000.00"))

        payslip = Payslip.objects.get(payroll_run=run, employee=self.employee)
        self.assertEqual(payslip.net_salary, Decimal("97000.00"))
        self.assertEqual(payslip.status, PayslipStatus.GENERATED)

    def test_admin_process_and_disburse_api(self):
        self.client.force_authenticate(user=self.admin_user)

        # 1. Process Run
        url = reverse("payroll-run-process-payroll")
        res = self.client.post(url, {"month": 11, "year": 2026, "notes": "Nov 2026 Run"})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        run_id = res.data["payroll_run"]["id"]

        # 2. Disburse Run
        disburse_url = reverse("payroll-run-disburse", kwargs={"pk": run_id})
        d_res = self.client.post(disburse_url, {"payment_method": "BANK_TRANSFER"})
        self.assertEqual(d_res.status_code, status.HTTP_200_OK)
        self.assertEqual(d_res.data["payroll_run"]["status"], PayrollStatus.PAID)

        # Child payslip is now PAID
        slip = Payslip.objects.filter(payroll_run_id=run_id).first()
        self.assertEqual(slip.status, PayslipStatus.PAID)

    def test_rbac_payslip_isolation(self):
        # Generate payslip for employee
        run_monthly_payroll(year=2026, month=10, user=self.admin_user)

        # Authenticate as Employee
        self.client.force_authenticate(user=self.emp_user)
        list_url = reverse("payslip-list")
        res = self.client.get(list_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        # Employee sees only their payslip
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]["employee_id_code"], "EMP-101")

        # Employee cannot process payroll
        process_url = reverse("payroll-run-process-payroll")
        p_res = self.client.post(process_url, {"month": 12, "year": 2026})
        self.assertEqual(p_res.status_code, status.HTTP_403_FORBIDDEN)
