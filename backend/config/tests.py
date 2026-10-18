from django.test import TestCase
from django.urls import reverse
import pytest
import yaml

from accounts.factories import UserFactory


class ApiSchemaTests(TestCase):
    def test_schema_lists_auth_post_and_like_routes(self):
        """OpenAPI仕様に主要APIのパスを含める。"""
        response = self.client.get(reverse("schema"), HTTP_HOST="localhost")

        self.assertEqual(response.status_code, 200)
        paths = yaml.safe_load(response.content)["paths"]
        self.assertIn("/api/v1/auth/register/", paths)
        self.assertIn("/api/v1/posts/", paths)
        self.assertIn("/api/v1/posts/{id}/like/", paths)

    def test_swagger_ui_loads_the_generated_schema(self):
        """Swagger UIページを表示できる。"""
        response = self.client.get(reverse("swagger-ui"), HTTP_HOST="localhost")

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'id="swagger-ui"')


def test_registration_endpoint_renders_browsable_api_for_html_requests(client):
    """HTMLリクエストで登録APIのフォームを表示し、ブラウザーから操作できる。"""
    response = client.get(
        "/api/v1/auth/register/",
        HTTP_ACCEPT="text/html",
        HTTP_HOST="localhost",
    )

    assert response.status_code == 200
    assert response["Content-Type"].startswith("text/html")
    assert b'name="username"' in response.content


def test_browsable_api_exposes_login_link_for_html_requests(client):
    """Browsable APIからセッションログイン画面へ移動できることを保証する。"""
    response = client.get(
        "/api/v1/auth/register/",
        HTTP_ACCEPT="text/html",
        HTTP_HOST="localhost",
    )

    assert response.status_code == 200
    assert b"/api-auth/login/" in response.content


@pytest.mark.django_db
def test_browsable_api_login_authenticates_session_requests(client):
    """ログイン後にAPI認証とログアウト導線が有効になることを保証する。"""
    user = UserFactory(email="browser@example.com")

    login_response = client.post(
        "/api-auth/login/",
        {"username": user.email, "password": "test-password"},
        HTTP_HOST="localhost",
    )
    profile_response = client.get(
        "/api/v1/auth/me/",
        HTTP_ACCEPT="application/json",
        HTTP_HOST="localhost",
    )
    browsable_response = client.get(
        "/api/v1/auth/register/",
        HTTP_ACCEPT="text/html",
        HTTP_HOST="localhost",
    )

    assert login_response.status_code == 302
    assert profile_response.status_code == 200
    assert profile_response.json()["email"] == user.email
    assert browsable_response.status_code == 200
    assert b"/api-auth/logout/" in browsable_response.content
