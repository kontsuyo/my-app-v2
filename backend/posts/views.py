from django.db.models import Count, Exists, OuterRef, QuerySet
from rest_framework import generics, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.request import Request
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema

from posts.models import Like, Post
from posts.permissions import IsOwnerOrReadOnly
from posts.serializers import PostSerializer


class PostPagination(PageNumberPagination):
    page_size = 10


def get_post_queryset(request: Request) -> QuerySet[Post]:
    user_id = request.user.pk or 0
    return (
        Post.objects.select_related("user")
        .order_by("-created_at", "-pk")
        .annotate(
            like_count=Count("likes"),
            liked_by_me=Exists(
                Like.objects.filter(
                    post_id=OuterRef("pk"),
                    user_id=user_id,
                )
            ),
        )
    )


class PostListCreateView(generics.ListCreateAPIView):
    serializer_class = PostSerializer
    pagination_class = PostPagination
    permission_classes = (IsAuthenticatedOrReadOnly,)

    def get_queryset(self) -> QuerySet[Post]:
        return get_post_queryset(self.request)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class PostDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = PostSerializer
    pagination_class = PostPagination
    permission_classes = (IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly)

    def get_queryset(self) -> QuerySet[Post]:
        return get_post_queryset(self.request)


class PostLikeView(generics.GenericAPIView):
    queryset = Post.objects.all()
    permission_classes = (IsAuthenticated,)

    @extend_schema(request=None, responses={200: None})
    def post(self, request, *args, **kwargs):
        post = self.get_object()
        # 同じユーザーが同じ投稿に何度いいねしても、重複登録されないようにするため。
        Like.objects.get_or_create(user=request.user, post=post)
        return Response(status=status.HTTP_200_OK)

    @extend_schema(request=None, responses={204: None})
    def delete(self, request, *args, **kwargs):
        post = self.get_object()
        Like.objects.filter(user=request.user, post=post).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
