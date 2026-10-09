from django.contrib.auth.models import AbstractUser
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import User


class UserModelTests(TestCase):
    def test_user_model_inherits_abstract_user(self):
        self.assertTrue(issubclass(User, AbstractUser))

    def test_email_is_the_login_identifier(self):
        self.assertEqual(User.USERNAME_FIELD, "email")

    def test_duplicate_email_raises_integrity_error(self):
        User.objects.create_user(
            username="alice", email="dup@example.com", password="pass12345"
        )
        with self.assertRaises(IntegrityError), transaction.atomic():
            User.objects.create_user(
                username="bob", email="dup@example.com", password="pass12345"
            )

    def test_superuser_can_access_user_admin_with_email_login(self):
        User.objects.create_superuser(
            username="admin", email="admin@example.com", password="pass12345"
        )

        response = self.client.post(
            reverse("admin:login"),
            {
                "username": "admin@example.com",
                "password": "pass12345",
                "next": reverse("admin:index"),
            },
        )

        self.assertRedirects(response, reverse("admin:index"))


class RegistrationApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_register_creates_user_with_hashed_password(self):
        response = self.client.post(
            "/api/v1/auth/register/",
            {
                "username": "new-user",
                "email": "new-user@example.com",
                "password": "strong-pass-123",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        user = User.objects.get(email="new-user@example.com")
        self.assertTrue(user.check_password("strong-pass-123"))
        self.assertNotIn("password", response.data)

    def test_register_rejects_password_that_fails_validation(self):
        response = self.client.post(
            "/api/v1/auth/register/",
            {
                "username": "new-user",
                "email": "new-user@example.com",
                "password": "short",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.filter(email="new-user@example.com").exists())


class LoginApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        User.objects.create_user(
            username="existing-user",
            email="existing-user@example.com",
            password="strong-pass-123",
        )

    def test_login_with_email_returns_access_and_refresh_tokens(self):
        response = self.client.post(
            "/api/v1/auth/login/",
            {
                "email": "existing-user@example.com",
                "password": "strong-pass-123",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_login_rejects_invalid_password(self):
        response = self.client.post(
            "/api/v1/auth/login/",
            {
                "email": "existing-user@example.com",
                "password": "incorrect-password",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 401)


class TokenRefreshApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        User.objects.create_user(
            username="existing-user",
            email="existing-user@example.com",
            password="strong-pass-123",
        )

    def test_refresh_token_returns_new_access_token(self):
        login_response = self.client.post(
            "/api/v1/auth/login/",
            {
                "email": "existing-user@example.com",
                "password": "strong-pass-123",
            },
            format="json",
        )

        response = self.client.post(
            "/api/v1/auth/token/refresh/",
            {"refresh": login_response.data["refresh"]},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)


class CurrentUserApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="current-user",
            email="current-user@example.com",
            password="strong-pass-123",
        )

    def test_authenticated_user_can_retrieve_own_profile(self):
        login_response = self.client.post(
            "/api/v1/auth/login/",
            {
                "email": "current-user@example.com",
                "password": "strong-pass-123",
            },
            format="json",
        )
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}"
        )

        response = self.client.get("/api/v1/auth/me/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], self.user.id)
        self.assertEqual(response.data["username"], self.user.username)
        self.assertEqual(response.data["email"], self.user.email)
        self.assertNotIn("password", response.data)

    def test_anonymous_user_cannot_retrieve_current_user_profile(self):
        response = self.client.get("/api/v1/auth/me/")

        self.assertEqual(response.status_code, 401)
