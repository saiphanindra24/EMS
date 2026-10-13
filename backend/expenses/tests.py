from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import Role
from employees.models import Department, Employee
from expenses.models import (
    ExpenseCategory,
    ExpenseClaim,
    ExpenseStatus,
    PaymentMethod,
)
from projects.models import Project

User = get_user_model()


class ExpenseManagementTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.dept = Department.objects.create(name="Engineering", code="ENG")

        # Admin user
        self.admin_user = User.objects.create_user(
            email="admin@sskatttest.com",
            password="AdminPassword123!",
            role=Role.SUPER_ADMIN,
            first_name="Admin",
            last_name="System",
            is_staff=True
        )

        # Manager user & profile
        self.manager_user = User.objects.create_user(
            email="manager@sskatttest.com",
            password="ManagerPassword123!",
            role=Role.MANAGER,
            first_name="Rajesh",
            last_name="Kumar"
        )
        self.manager_emp = Employee.objects.create(
            user=self.manager_user,
            employee_id="EMP-MGR",
            department=self.dept,
            designation="Engineering Manager"
        )

        # Employee user & profile
        self.emp_user = User.objects.create_user(
            email="dev@sskatttest.com",
            password="DevPassword123!",
            role=Role.EMPLOYEE,
            first_name="Sneha",
            last_name="Patel"
        )
        self.emp_profile = Employee.objects.create(
            user=self.emp_user,
            employee_id="EMP-DEV",
            department=self.dept,
            designation="Software Engineer",
            manager=self.manager_emp
        )

        # Sample project
        self.project = Project.objects.create(
            code="PRJ-TEST",
            name="Test Client Project",
            lead=self.manager_emp,
            budget=Decimal("500000.00")
        )

    def test_create_expense_claim(self):
        self.client.force_authenticate(user=self.emp_user)
        payload = {
            "title": "Client Travel Train Tickets",
            "category": "TRAVEL",
            "amount": "1500.00",
            "tax_amount": "75.00",
            "is_billable": True,
            "project": self.project.id,
            "description": "Roundtrip Shatabdi express train tickets"
        }
        response = self.client.post("/api/v1/expenses/claims/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.data
        self.assertTrue(data["claim_number"].startswith("EXP-"))
        self.assertEqual(Decimal(str(data["total_amount"])), Decimal("1575.00"))
        self.assertEqual(data["status"], ExpenseStatus.SUBMITTED)
        self.assertEqual(data["employee_id"], "EMP-DEV")

    def test_manager_review_workflow(self):
        claim = ExpenseClaim.objects.create(
            employee=self.emp_profile,
            title="Team Lunch",
            category=ExpenseCategory.MEALS,
            amount=Decimal("2000.00"),
            tax_amount=Decimal("100.00"),
            status=ExpenseStatus.SUBMITTED
        )

        # Manager approves
        self.client.force_authenticate(user=self.manager_user)
        review_url = f"/api/v1/expenses/claims/{claim.id}/manager_review/"
        response = self.client.post(
            review_url,
            {"action": "APPROVE", "notes": "Approved per team allowance"},
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        claim.refresh_from_db()
        self.assertEqual(claim.status, ExpenseStatus.MANAGER_APPROVED)
        self.assertEqual(claim.manager_reviewed_by, self.manager_user)
        self.assertEqual(claim.manager_notes, "Approved per team allowance")

    def test_finance_settlement_workflow(self):
        claim = ExpenseClaim.objects.create(
            employee=self.emp_profile,
            title="Cloud Infrastructure",
            category=ExpenseCategory.SOFTWARE,
            amount=Decimal("3500.00"),
            tax_amount=Decimal("630.00"),
            status=ExpenseStatus.MANAGER_APPROVED
        )

        # Admin / Finance reimburses
        self.client.force_authenticate(user=self.admin_user)
        settle_url = f"/api/v1/expenses/claims/{claim.id}/finance_settlement/"
        payload = {
            "action": "REIMBURSE",
            "payment_method": PaymentMethod.NEFT_UPI,
            "transaction_reference": "UPI/REF/998877",
            "notes": "Disbursed via bank transfer"
        }
        response = self.client.post(settle_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        claim.refresh_from_db()
        self.assertEqual(claim.status, ExpenseStatus.REIMBURSED)
        self.assertEqual(claim.payment_method, PaymentMethod.NEFT_UPI)
        self.assertEqual(claim.transaction_reference, "UPI/REF/998877")
        self.assertIsNotNone(claim.reimbursed_at)

    def test_permissions_guard(self):
        claim = ExpenseClaim.objects.create(
            employee=self.emp_profile,
            title="Office Desk Accessories",
            category=ExpenseCategory.SUPPLIES,
            amount=Decimal("1200.00"),
            status=ExpenseStatus.SUBMITTED
        )

        # Regular employee attempts manager review -> 403 Forbidden
        self.client.force_authenticate(user=self.emp_user)
        review_url = f"/api/v1/expenses/claims/{claim.id}/manager_review/"
        res = self.client.post(review_url, {"action": "APPROVE"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        # Manager attempts finance settlement -> 403 Forbidden
        self.client.force_authenticate(user=self.manager_user)
        settle_url = f"/api/v1/expenses/claims/{claim.id}/finance_settlement/"
        res2 = self.client.post(settle_url, {"action": "REIMBURSE"}, format="json")
        self.assertEqual(res2.status_code, status.HTTP_403_FORBIDDEN)

    def test_stats_and_breakdown(self):
        ExpenseClaim.objects.create(
            employee=self.emp_profile,
            title="Claim 1",
            category=ExpenseCategory.TRAVEL,
            amount=Decimal("5000.00"),
            tax_amount=Decimal("500.00"),
            status=ExpenseStatus.REIMBURSED,
            is_billable=True
        )
        ExpenseClaim.objects.create(
            employee=self.emp_profile,
            title="Claim 2",
            category=ExpenseCategory.MEALS,
            amount=Decimal("1000.00"),
            status=ExpenseStatus.SUBMITTED
        )

        self.client.force_authenticate(user=self.admin_user)
        res = self.client.get("/api/v1/expenses/claims/stats/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.data
        self.assertEqual(data["total_claims"], 2)
        self.assertEqual(data["pending_manager_approval"], 1)
        self.assertEqual(data["total_reimbursed_amount"], 5500.0)
        self.assertEqual(data["billable_client_amount"], 5500.0)
