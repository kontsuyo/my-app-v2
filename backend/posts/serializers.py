from pathlib import PurePath

from rest_framework import serializers

from posts.models import Post


class PostUserSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    username = serializers.CharField()


class PostSerializer(serializers.ModelSerializer):
    user = PostUserSerializer(read_only=True)
    like_count = serializers.SerializerMethodField()
    liked_by_me = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = (
            "id",
            "user",
            "image_url",
            "brand",
            "model",
            "caption",
            "like_count",
            "liked_by_me",
            "created_at",
        )
        read_only_fields = ("id", "user", "like_count", "liked_by_me", "created_at")

    def get_like_count(self, post) -> int:
        if hasattr(post, "like_count"):
            return post.like_count
        return post.likes.count()

    def get_liked_by_me(self, post) -> bool:
        if hasattr(post, "liked_by_me"):
            return post.liked_by_me
        request = self.context.get("request")
        if request is None or not request.user.is_authenticated:
            return False
        return post.likes.filter(user=request.user).exists()


class UploadPresignSerializer(serializers.Serializer):
    CONTENT_TYPE_EXTENSIONS = {
        "image/jpeg": {".jpg", ".jpeg"},
        "image/png": {".png"},
        "image/webp": {".webp"},
    }

    filename = serializers.CharField()
    content_type = serializers.CharField()

    def validate_content_type(self, value):
        if value not in self.CONTENT_TYPE_EXTENSIONS:
            raise serializers.ValidationError("Unsupported image type.")
        return value

    def validate(self, attrs):
        extension = PurePath(attrs["filename"]).suffix.lower()
        if extension not in self.CONTENT_TYPE_EXTENSIONS[attrs["content_type"]]:
            raise serializers.ValidationError(
                {"filename": "Filename extension does not match content type."}
            )
        return attrs
