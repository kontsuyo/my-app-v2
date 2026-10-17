from django.urls import path

from posts.uploads import LocalUploadView, UploadPresignView
from posts.views import (
    PostDetailView,
    PostLikeView,
    PostListCreateView,
)

urlpatterns = [
    path("uploads/presign/", UploadPresignView.as_view(), name="upload-presign"),
    path(
        "uploads/local/<path:key>",
        LocalUploadView.as_view(),
        name="upload-local",
    ),
    path("posts/", PostListCreateView.as_view(), name="post-list"),
    path("posts/<int:pk>/like/", PostLikeView.as_view(), name="post-like"),
    path("posts/<int:pk>/", PostDetailView.as_view(), name="post-detail"),
]
