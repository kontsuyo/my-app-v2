from datetime import timedelta
from pathlib import Path
import tempfile
from types import SimpleNamespace
from urllib.parse import urlparse
from unittest.mock import patch

from accounts.models import User
from botocore.exceptions import ClientError
from django.contrib.auth.models import AnonymousUser
from django.db import IntegrityError, transaction
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from posts.models import Like, Post
from posts.serializers import PostSerializer


class PostModelTests(TestCase):
    def setUp(self):
        self.author = User.objects.create_user(
            username="author",
            email="author@example.com",
            password="pass12345",
        )
        self.liker = User.objects.create_user(
            username="liker",
            email="liker@example.com",
            password="pass12345",
        )

    def create_post(self):
        return Post.objects.create(
            user=self.author,
            image_url="https://cdn.example.com/boots.jpg",
            brand="RED WING",
        )

    def test_post_persists_fields_and_manages_timestamps(self):
        post = self.create_post()

        self.assertEqual(post.user, self.author)
        self.assertEqual(post.image_url, "https://cdn.example.com/boots.jpg")
        self.assertEqual(post.brand, "RED WING")
        self.assertEqual(post.model, "")
        self.assertEqual(post.caption, "")
        self.assertIsNotNone(post.created_at)
        self.assertIsNotNone(post.updated_at)
        created_at = post.created_at

        stale_updated_at = timezone.now() - timedelta(days=1)
        Post.objects.filter(pk=post.pk).update(updated_at=stale_updated_at)
        post.refresh_from_db()
        post.caption = "One year of wear"
        post.save()
        post.refresh_from_db()

        self.assertEqual(post.created_at, created_at)
        self.assertGreater(post.updated_at, stale_updated_at)
        self.assertEqual(post.caption, "One year of wear")

    def test_deleting_post_owner_cascades_to_post_and_likes(self):
        post = self.create_post()
        like = Like.objects.create(user=self.liker, post=post)

        self.assertEqual(like.user, self.liker)
        self.assertEqual(like.post, post)
        self.assertIsNotNone(like.created_at)

        self.author.delete()

        self.assertFalse(Post.objects.filter(pk=post.pk).exists())
        self.assertFalse(Like.objects.filter(pk=like.pk).exists())

    def test_deleting_like_user_preserves_post_and_deletes_like(self):
        post = self.create_post()
        like = Like.objects.create(user=self.liker, post=post)

        self.liker.delete()

        self.assertTrue(Post.objects.filter(pk=post.pk).exists())
        self.assertFalse(Like.objects.filter(pk=like.pk).exists())

    def test_user_can_like_a_post_only_once(self):
        post = self.create_post()
        Like.objects.create(user=self.liker, post=post)

        with self.assertRaises(IntegrityError), transaction.atomic():
            Like.objects.create(user=self.liker, post=post)


class PostSerializerTests(TestCase):
    def test_post_serializer_includes_author_and_like_metadata_for_anonymous_user(self):
        author = User.objects.create_user(
            username="author",
            email="author@example.com",
            password="pass12345",
        )
        liker = User.objects.create_user(
            username="liker",
            email="liker@example.com",
            password="pass12345",
        )
        post = Post.objects.create(
            user=author,
            image_url="https://cdn.example.com/boots.jpg",
            brand="RED WING",
            model="8875",
            caption="One year of wear",
        )
        Like.objects.create(user=liker, post=post)

        data = PostSerializer(
            post,
            context={"request": SimpleNamespace(user=AnonymousUser())},
        ).data

        self.assertEqual(data["user"], {"id": author.id, "username": "author"})
        self.assertEqual(data["like_count"], 1)
        self.assertFalse(data["liked_by_me"])
        self.assertEqual(
            set(data),
            {
                "id",
                "user",
                "image_url",
                "brand",
                "model",
                "caption",
                "like_count",
                "liked_by_me",
                "created_at",
            },
        )


class PostApiTests(TestCase):
    def test_anonymous_user_can_list_posts_with_pagination(self):
        author = User.objects.create_user(
            username="author",
            email="author@example.com",
            password="pass12345",
        )
        Post.objects.create(
            user=author,
            image_url="https://cdn.example.com/boots.jpg",
            brand="RED WING",
        )
        client = APIClient()

        response = client.get("/api/v1/posts/", HTTP_HOST="localhost")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertIsNone(response.data["next"])
        self.assertIsNone(response.data["previous"])
        self.assertEqual(len(response.data["results"]), 1)

    def test_anonymous_user_can_retrieve_post(self):
        """未ログインでも投稿の詳細を取得できる仕様を保証する。"""
        author = User.objects.create_user(
            username="author",
            email="author@example.com",
            password="test-password-123",
        )
        post = Post.objects.create(
            user=author,
            image_url="https://cdn.example.com/boots.jpg",
            brand="RED WING",
        )
        client = APIClient()

        response = client.get(f"/api/v1/posts/{post.pk}/", HTTP_HOST="localhost")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], post.pk)

    def test_authenticated_user_can_create_post_as_the_author(self):
        author = User.objects.create_user(
            username="author",
            email="author@example.com",
            password="pass12345",
        )
        client = APIClient()
        client.force_authenticate(user=author)

        response = client.post(
            "/api/v1/posts/",
            {
                "image_url": "https://cdn.example.com/boots.jpg",
                "brand": "RED WING",
                "model": "8875",
                "caption": "One year of wear",
            },
            format="json",
            HTTP_HOST="localhost",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["user"], {"id": author.id, "username": "author"})
        self.assertEqual(Post.objects.get().user, author)

    def test_anonymous_user_cannot_create_post(self):
        """認証必須の投稿作成で匿名利用者を拒否する。"""
        client = APIClient()

        response = client.post(
            "/api/v1/posts/",
            {
                "image_url": "https://cdn.example.com/boots.jpg",
                "brand": "RED WING",
            },
            format="json",
            HTTP_HOST="localhost",
        )

        self.assertEqual(response.status_code, 401)
        self.assertFalse(Post.objects.exists())

    def test_post_list_uses_fixed_query_count_for_authors_and_likes(self):
        first_author = User.objects.create_user(
            username="first",
            email="first@example.com",
            password="pass12345",
        )
        second_author = User.objects.create_user(
            username="second",
            email="second@example.com",
            password="pass12345",
        )
        first_post = Post.objects.create(
            user=first_author,
            image_url="https://cdn.example.com/first.jpg",
            brand="RED WING",
        )
        Post.objects.create(
            user=second_author,
            image_url="https://cdn.example.com/second.jpg",
            brand="WHITE'S",
        )
        Like.objects.create(user=second_author, post=first_post)
        client = APIClient()

        with self.assertNumQueries(2):
            response = client.get("/api/v1/posts/", HTTP_HOST="localhost")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [post["like_count"] for post in response.data["results"]],
            [0, 1],
        )

    def test_authenticated_user_can_update_post_fields(self):
        author = User.objects.create_user(
            username="author",
            email="author@example.com",
            password="pass12345",
        )
        post = Post.objects.create(
            user=author,
            image_url="https://cdn.example.com/boots.jpg",
            brand="RED WING",
        )
        client = APIClient()
        client.force_authenticate(user=author)

        response = client.patch(
            f"/api/v1/posts/{post.pk}/",
            {"caption": "One year of wear"},
            format="json",
            HTTP_HOST="localhost",
        )

        self.assertEqual(response.status_code, 200)
        post.refresh_from_db()
        self.assertEqual(post.caption, "One year of wear")

    def test_authenticated_non_owner_cannot_update_post(self):
        """投稿者以外の更新でデータが変化しないことを保証する。"""
        author = User.objects.create_user(
            username="author",
            email="author@example.com",
            password="test-password",
        )
        other_user = User.objects.create_user(
            username="other",
            email="other@example.com",
            password="test-password",
        )
        post = Post.objects.create(
            user=author,
            image_url="https://cdn.example.com/boots.jpg",
            brand="RED WING",
            caption="Original caption",
        )
        client = APIClient()
        client.force_authenticate(user=other_user)

        response = client.patch(
            f"/api/v1/posts/{post.pk}/",
            {"caption": "Unauthorized change"},
            format="json",
            HTTP_HOST="localhost",
        )

        self.assertEqual(response.status_code, 403)
        post.refresh_from_db()
        self.assertEqual(post.caption, "Original caption")

    def test_authenticated_user_can_delete_post(self):
        author = User.objects.create_user(
            username="author",
            email="author@example.com",
            password="pass12345",
        )
        post = Post.objects.create(
            user=author,
            image_url="https://cdn.example.com/boots.jpg",
            brand="RED WING",
        )
        client = APIClient()
        client.force_authenticate(user=author)

        response = client.delete(
            f"/api/v1/posts/{post.pk}/",
            HTTP_HOST="localhost",
        )

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Post.objects.filter(pk=post.pk).exists())

    def test_authenticated_non_owner_cannot_delete_post(self):
        """投稿者以外の削除を拒否して投稿を保持する。"""
        author = User.objects.create_user(
            username="author",
            email="author@example.com",
            password="test-password",
        )
        other_user = User.objects.create_user(
            username="other",
            email="other@example.com",
            password="test-password",
        )
        post = Post.objects.create(
            user=author,
            image_url="https://cdn.example.com/boots.jpg",
            brand="RED WING",
        )
        client = APIClient()
        client.force_authenticate(user=other_user)

        response = client.delete(
            f"/api/v1/posts/{post.pk}/",
            HTTP_HOST="localhost",
        )

        self.assertEqual(response.status_code, 403)
        self.assertTrue(Post.objects.filter(pk=post.pk).exists())

    def test_post_list_returns_next_page_after_ten_posts(self):
        author = User.objects.create_user(
            username="author",
            email="author@example.com",
            password="pass12345",
        )
        Post.objects.bulk_create(
            [
                Post(
                    user=author,
                    image_url=f"https://cdn.example.com/boots-{index}.jpg",
                    brand="RED WING",
                )
                for index in range(11)
            ]
        )
        client = APIClient()

        first_page = client.get("/api/v1/posts/", HTTP_HOST="localhost")
        second_page = client.get("/api/v1/posts/?page=2", HTTP_HOST="localhost")

        self.assertEqual(first_page.status_code, 200)
        self.assertEqual(first_page.data["count"], 11)
        self.assertEqual(len(first_page.data["results"]), 10)
        self.assertIsNotNone(first_page.data["next"])
        self.assertEqual(second_page.status_code, 200)
        self.assertEqual(len(second_page.data["results"]), 1)
        self.assertIsNone(second_page.data["next"])

    def test_authenticated_user_can_retrieve_post_and_see_own_like(self):
        author = User.objects.create_user(
            username="author",
            email="author@example.com",
            password="pass12345",
        )
        liker = User.objects.create_user(
            username="liker",
            email="liker@example.com",
            password="pass12345",
        )
        post = Post.objects.create(
            user=author,
            image_url="https://cdn.example.com/boots.jpg",
            brand="RED WING",
        )
        Like.objects.create(user=liker, post=post)
        client = APIClient()
        client.force_authenticate(user=liker)

        response = client.get(f"/api/v1/posts/{post.pk}/", HTTP_HOST="localhost")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["like_count"], 1)
        self.assertTrue(response.data["liked_by_me"])
        self.assertEqual(response.data["user"], {"id": author.id, "username": "author"})

    def test_authenticated_user_can_like_post_and_metadata_is_updated(self):
        """いいね追加後、投稿詳細APIで件数と自分がいいね済みかを確認する。"""
        author = User.objects.create_user(
            username="author",
            email="author@example.com",
            password="pass12345",
        )
        liker = User.objects.create_user(
            username="liker",
            email="liker@example.com",
            password="pass12345",
        )
        post = Post.objects.create(
            user=author,
            image_url="https://cdn.example.com/boots.jpg",
            brand="RED WING",
        )
        client = APIClient()
        client.force_authenticate(user=liker)

        response = client.post(
            f"/api/v1/posts/{post.pk}/like/",
            HTTP_HOST="localhost",
        )
        detail = client.get(f"/api/v1/posts/{post.pk}/", HTTP_HOST="localhost")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(Like.objects.filter(user=liker, post=post).count(), 1)
        self.assertEqual(detail.data["like_count"], 1)
        self.assertTrue(detail.data["liked_by_me"])

    def test_repeating_like_does_not_create_duplicate_or_increment_count(self):
        """同じいいね要求を繰り返しても一件だけに保つ。"""
        author = User.objects.create_user(
            username="author",
            email="author@example.com",
            password="pass12345",
        )
        liker = User.objects.create_user(
            username="liker",
            email="liker@example.com",
            password="pass12345",
        )
        post = Post.objects.create(
            user=author,
            image_url="https://cdn.example.com/boots.jpg",
            brand="RED WING",
        )
        client = APIClient()
        client.force_authenticate(user=liker)
        url = f"/api/v1/posts/{post.pk}/like/"

        first_response = client.post(url, HTTP_HOST="localhost")
        second_response = client.post(url, HTTP_HOST="localhost")
        detail = client.get(f"/api/v1/posts/{post.pk}/", HTTP_HOST="localhost")

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(second_response.status_code, 200)
        self.assertEqual(Like.objects.filter(user=liker, post=post).count(), 1)
        self.assertEqual(detail.data["like_count"], 1)

    def test_authenticated_user_can_unlike_without_removing_other_likes(self):
        """解除時に本人のいいねだけが消えることを確認する。"""
        author = User.objects.create_user(
            username="author",
            email="author@example.com",
            password="pass12345",
        )
        liker = User.objects.create_user(
            username="liker",
            email="liker@example.com",
            password="pass12345",
        )
        other_liker = User.objects.create_user(
            username="other-liker",
            email="other-liker@example.com",
            password="pass12345",
        )
        post = Post.objects.create(
            user=author,
            image_url="https://cdn.example.com/boots.jpg",
            brand="RED WING",
        )
        Like.objects.create(user=liker, post=post)
        Like.objects.create(user=other_liker, post=post)
        client = APIClient()
        client.force_authenticate(user=liker)

        response = client.delete(
            f"/api/v1/posts/{post.pk}/like/",
            HTTP_HOST="localhost",
        )
        detail = client.get(f"/api/v1/posts/{post.pk}/", HTTP_HOST="localhost")

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Like.objects.filter(user=liker, post=post).exists())
        self.assertTrue(Like.objects.filter(user=other_liker, post=post).exists())
        self.assertEqual(detail.data["like_count"], 1)
        self.assertFalse(detail.data["liked_by_me"])

    def test_unlike_without_existing_like_succeeds(self):
        """いいね未登録の状態で解除しても成功し、いいねが作成されないことを確認する。"""
        author = User.objects.create_user(
            username="author",
            email="author@example.com",
            password="pass12345",
        )
        liker = User.objects.create_user(
            username="liker",
            email="liker@example.com",
            password="pass12345",
        )
        post = Post.objects.create(
            user=author,
            image_url="https://cdn.example.com/boots.jpg",
            brand="RED WING",
        )
        client = APIClient()
        client.force_authenticate(user=liker)

        response = client.delete(
            f"/api/v1/posts/{post.pk}/like/",
            HTTP_HOST="localhost",
        )

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Like.objects.filter(user=liker, post=post).exists())

    def test_anonymous_user_cannot_like_or_unlike_post(self):
        """いいね操作を認証済み利用者に限定する。"""
        author = User.objects.create_user(
            username="author",
            email="author@example.com",
            password="pass12345",
        )
        post = Post.objects.create(
            user=author,
            image_url="https://cdn.example.com/boots.jpg",
            brand="RED WING",
        )
        client = APIClient()
        url = f"/api/v1/posts/{post.pk}/like/"

        like_response = client.post(url, HTTP_HOST="localhost")
        unlike_response = client.delete(url, HTTP_HOST="localhost")

        self.assertEqual(like_response.status_code, 401)
        self.assertEqual(unlike_response.status_code, 401)
        self.assertFalse(Like.objects.filter(post=post).exists())

    def test_like_and_unlike_return_not_found_for_missing_post(self):
        """存在しない投稿への操作を404として扱う。"""
        liker = User.objects.create_user(
            username="liker",
            email="liker@example.com",
            password="pass12345",
        )
        client = APIClient()
        client.force_authenticate(user=liker)
        url = "/api/v1/posts/999999/like/"

        like_response = client.post(url, HTTP_HOST="localhost")
        unlike_response = client.delete(url, HTTP_HOST="localhost")

        self.assertEqual(like_response.status_code, 404)
        self.assertEqual(unlike_response.status_code, 404)


class UploadApiTests(TestCase):
    def test_local_upload_returns_payload_too_large_for_oversized_image(self):
        """設定した上限を超える画像に413を返す。"""
        user = User.objects.create_user(
            username="uploader",
            email="uploader@example.com",
            password="test-password",
        )
        client = APIClient()
        client.force_authenticate(user=user)
        key = "uploads/0123456789abcdef0123456789abcdef.jpg"
        image_bytes = b"x" * 33

        with (
            tempfile.TemporaryDirectory() as media_root,
            override_settings(
                AWS_STORAGE_BUCKET_NAME="",
                DATA_UPLOAD_MAX_MEMORY_SIZE=16,
                MAX_UPLOAD_SIZE=32,
                MEDIA_ROOT=media_root,
                MEDIA_URL="/media/",
                STORAGES={
                    "default": {
                        "BACKEND": "django.core.files.storage.FileSystemStorage",
                        "OPTIONS": {
                            "location": media_root,
                            "base_url": "/media/",
                        },
                    },
                    "staticfiles": {
                        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
                    },
                },
            ),
        ):
            response = client.put(
                f"/api/v1/uploads/local/{key}",
                image_bytes,
                content_type="image/jpeg",
                HTTP_HOST="localhost",
            )

        self.assertEqual(response.status_code, 413)

    def test_anonymous_user_cannot_upload_to_local_media(self):
        """ローカル保存先へのPUTも認証済み利用者に限定する。"""
        response = APIClient().put(
            "/api/v1/uploads/local/uploads/0123456789abcdef0123456789abcdef.jpg",
            b"image content",
            content_type="image/jpeg",
            HTTP_HOST="localhost",
        )

        self.assertEqual(response.status_code, 401)

    def test_local_upload_fallback_stores_image_in_media(self):
        """S3未設定時に画像をMEDIAへ保存し、表示URLを返す。"""
        user = User.objects.create_user(
            username="uploader",
            email="uploader@example.com",
            password="test-password",
        )
        client = APIClient()
        client.force_authenticate(user=user)
        image_bytes = b"local image content"

        with (
            tempfile.TemporaryDirectory() as media_root,
            override_settings(
                AWS_STORAGE_BUCKET_NAME="",
                DEBUG=True,
                MEDIA_ROOT=media_root,
                MEDIA_URL="/media/",
                STORAGES={
                    "default": {
                        "BACKEND": "django.core.files.storage.FileSystemStorage",
                        "OPTIONS": {
                            "location": media_root,
                            "base_url": "/media/",
                        },
                    },
                    "staticfiles": {
                        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
                    },
                },
            ),
        ):
            presign_response = client.post(
                "/api/v1/uploads/presign/",
                {"filename": "boots.jpg", "content_type": "image/jpeg"},
                format="json",
                HTTP_HOST="localhost",
            )
            upload_path = urlparse(presign_response.data["upload_url"]).path
            upload_response = client.put(
                upload_path,
                image_bytes,
                content_type="image/jpeg",
                HTTP_HOST="localhost",
            )

            self.assertEqual(presign_response.status_code, 200)
            self.assertEqual(upload_response.status_code, 201)
            key = upload_path.split("/uploads/local/", 1)[1]
            self.assertEqual(
                urlparse(upload_response.data["image_url"]).path,
                f"/media/{key}",
            )
            saved_path = Path(media_root) / key
            self.assertEqual(saved_path.read_bytes(), image_bytes)

    @override_settings(
        AWS_STORAGE_BUCKET_NAME="test-images",
        AWS_S3_REGION_NAME="ap-northeast-1",
    )
    @patch("posts.uploads.boto3.client")
    def test_presign_returns_service_unavailable_when_s3_signing_fails(
        self,
        mock_boto_client,
    ):
        """S3署名発行の障害を明示的な503として返す。"""
        user = User.objects.create_user(
            username="uploader",
            email="uploader@example.com",
            password="test-password",
        )
        mock_boto_client.return_value.generate_presigned_url.side_effect = ClientError(
            {"Error": {"Code": "AccessDenied", "Message": "denied"}},
            "PutObject",
        )
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.post(
            "/api/v1/uploads/presign/",
            {"filename": "boots.jpg", "content_type": "image/jpeg"},
            format="json",
            HTTP_HOST="localhost",
        )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(
            response.data,
            {"detail": "Image upload is temporarily unavailable."},
        )

    @override_settings(
        AWS_STORAGE_BUCKET_NAME="test-images",
        AWS_S3_REGION_NAME="ap-northeast-1",
        AWS_S3_CUSTOM_DOMAIN="",
    )
    def test_presign_returns_s3_put_url_and_image_url(self):
        """有効な画像にS3への署名付きPUT情報を返す。"""
        user = User.objects.create_user(
            username="uploader",
            email="uploader@example.com",
            password="test-password",
        )
        client = APIClient()
        client.force_authenticate(user=user)

        with patch.dict(
            "os.environ",
            {
                "AWS_ACCESS_KEY_ID": "test-access-key",
                "AWS_SECRET_ACCESS_KEY": "test-secret-key",
            },
        ):
            response = client.post(
                "/api/v1/uploads/presign/",
                {"filename": "boots.jpg", "content_type": "image/jpeg"},
                format="json",
                HTTP_HOST="localhost",
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["method"], "PUT")
        self.assertIn("X-Amz-Signature=", response.data["upload_url"])
        self.assertEqual(
            response.data["headers"],
            {"Content-Type": "image/jpeg"},
        )
        self.assertTrue(
            response.data["image_url"].startswith(
                "https://test-images.s3.ap-northeast-1.amazonaws.com/uploads/"
            )
        )

    def test_presign_rejects_content_type_and_extension_mismatch(self):
        """Content-Typeと拡張子の不一致を拒否する。"""
        user = User.objects.create_user(
            username="uploader",
            email="uploader@example.com",
            password="test-password",
        )
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.post(
            "/api/v1/uploads/presign/",
            {"filename": "boots.png", "content_type": "image/jpeg"},
            format="json",
            HTTP_HOST="localhost",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.data,
            {"filename": ["Filename extension does not match content type."]},
        )

    def test_presign_rejects_unsupported_content_type(self):
        """許可されていない画像形式の署名URLを発行しない。"""
        user = User.objects.create_user(
            username="uploader",
            email="uploader@example.com",
            password="test-password",
        )
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.post(
            "/api/v1/uploads/presign/",
            {"filename": "boots.gif", "content_type": "image/gif"},
            format="json",
            HTTP_HOST="localhost",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.data,
            {"content_type": ["Unsupported image type."]},
        )

    def test_anonymous_user_cannot_request_upload_url(self):
        """画像アップロードの準備を認証済み利用者に限定する。"""
        response = APIClient().post(
            "/api/v1/uploads/presign/",
            {"filename": "boots.jpg", "content_type": "image/jpeg"},
            format="json",
            HTTP_HOST="localhost",
        )

        self.assertEqual(response.status_code, 401)
