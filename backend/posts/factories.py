import factory
from factory.django import DjangoModelFactory

from accounts.factories import UserFactory
from posts.models import Like, Post


class PostFactory(DjangoModelFactory):
    user = factory.SubFactory(UserFactory)
    image_url = factory.Sequence(lambda n: f"https://cdn.example.com/boots-{n}.jpg")
    brand = "RED WING"

    class Meta:
        model = Post


class LikeFactory(DjangoModelFactory):
    user = factory.SubFactory(UserFactory)
    post = factory.SubFactory(PostFactory)

    class Meta:
        model = Like
