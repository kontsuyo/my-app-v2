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


def test_browsable_api_login_page_renders(client):
    """DRFのログイン画面を表示し、ブラウザーから認証できる。"""
    response = client.get(
        "/api-auth/login/",
        HTTP_ACCEPT="text/html",
        HTTP_HOST="localhost",
    )

    assert response.status_code == 200
    assert response["Content-Type"].startswith("text/html")
    assert b'name="username"' in response.content


@pytest.mark.django_db
def test_browsable_api_login_authenticates_session_for_api_requests(client):
    """ブラウザーでのログイン後にセッションでAPIへアクセスできる。"""
    user = UserFactory(email="browser@example.com")

    login_response = client.post(
        "/api-auth/login/",
        {
            "username": user.email,
            "password": "test-password",
            "next": "/api/v1/auth/me/",
        },
        HTTP_HOST="localhost",
    )

    assert login_response.status_code == 302
    response = client.get(
        "/api/v1/auth/me/",
        HTTP_ACCEPT="application/json",
        HTTP_HOST="localhost",
    )

    assert response.status_code == 200
    assert response.json()["email"] == user.email
