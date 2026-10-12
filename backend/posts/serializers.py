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

    def get_like_count(self, post):
        if hasattr(post, "like_count"):
            return post.like_count
        return post.likes.count()

    def get_liked_by_me(self, post):
        if hasattr(post, "liked_by_me"):
            return post.liked_by_me
        request = self.context.get("request")
        if request is None or not request.user.is_authenticated:
            return False
        return post.likes.filter(user=request.user).exists()
