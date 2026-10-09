from datetime import timedelta

from accounts.models import User
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone

from posts.models import Like, Post


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
