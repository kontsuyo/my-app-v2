from rest_framework.generics import CreateAPIView, RetrieveAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.serializers import CurrentUserSerializer, RegistrationSerializer


class RegistrationView(CreateAPIView):
    serializer_class = RegistrationSerializer

    def get(self, request, *args, **kwargs):
        return Response({"detail": "Submit a POST request to register a user."})


class CurrentUserView(RetrieveAPIView):
    permission_classes = (IsAuthenticated,)
    serializer_class = CurrentUserSerializer

    def get_object(self):
        return self.request.user
