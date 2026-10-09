from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from accounts.views import CurrentUserView, RegistrationView

urlpatterns = [
    path("register/", RegistrationView.as_view(), name="register"),
    path("login/", TokenObtainPairView.as_view(), name="login"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("me/", CurrentUserView.as_view(), name="me"),
]
