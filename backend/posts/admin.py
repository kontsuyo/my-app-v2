from django.contrib import admin
from posts.models import Like, Post

admin.site.register(Post)
admin.site.register(Like)
