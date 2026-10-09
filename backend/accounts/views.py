from rest_framework.generics import CreateAPIView, RetrieveAPIView
from rest_framework.permissions import IsAuthenticated

from accounts.serializers import CurrentUserSerializer, RegistrationSerializer


class RegistrationView(CreateAPIView):
    serializer_class = RegistrationSerializer


class CurrentUserView(RetrieveAPIView):
    permission_classes = (IsAuthenticated,)
    serializer_class = CurrentUserSerializer

    def get_object(self):
        return self.request.user
