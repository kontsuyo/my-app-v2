from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from accounts.models import User


class RegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ("id", "username", "email", "password")

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)

    def validate_password(self, value):
        validate_password(value)
        return value


class CurrentUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username", "email")
