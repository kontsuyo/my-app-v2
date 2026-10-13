from django.urls import path

from posts.views import PostDetailView, PostLikeView, PostListCreateView

urlpatterns = [
    path("posts/", PostListCreateView.as_view(), name="post-list"),
    path("posts/<int:pk>/like/", PostLikeView.as_view(), name="post-like"),
    path("posts/<int:pk>/", PostDetailView.as_view(), name="post-detail"),
]
