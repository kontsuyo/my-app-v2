from datetime import timedelta
from types import SimpleNamespace

from accounts.models import User
from django.contrib.auth.models import AnonymousUser
from django.db import IntegrityError, transaction
from django.test import TestCase
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
