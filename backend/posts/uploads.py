import logging
import re
import uuid
from pathlib import PurePath

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from botocore.config import Config
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.urls import reverse
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from posts.serializers import UploadPresignSerializer

logger = logging.getLogger(__name__)
LOCAL_UPLOAD_KEY_PATTERN = re.compile(
    r"uploads/[0-9a-f]{32}\.(?:jpg|jpeg|png|webp)\Z"
)


def make_image_url(bucket_name, region_name, key):
    custom_domain = getattr(settings, "AWS_S3_CUSTOM_DOMAIN", "")
    if custom_domain:
        return f"https://{custom_domain}/{key}"
    if region_name == "us-east-1":
        return f"https://{bucket_name}.s3.amazonaws.com/{key}"
    return f"https://{bucket_name}.s3.{region_name}.amazonaws.com/{key}"


class UploadPresignView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        serializer = UploadPresignSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        filename = serializer.validated_data["filename"]
        content_type = serializer.validated_data["content_type"]
        extension = PurePath(filename).suffix.lower()
        key = f"uploads/{uuid.uuid4().hex}{extension}"
        bucket_name = settings.AWS_STORAGE_BUCKET_NAME

        if bucket_name:
            try:
                client = boto3.client(
                    "s3",
                    region_name=settings.AWS_S3_REGION_NAME,
                    config=Config(signature_version="s3v4"),
                )
                upload_url = client.generate_presigned_url(
                    "put_object",
                    Params={
                        "Bucket": bucket_name,
                        "Key": key,
                        "ContentType": content_type,
                    },
                    ExpiresIn=settings.UPLOAD_URL_EXPIRES_IN,
                )
            except (BotoCoreError, ClientError):
                logger.exception("Could not create an S3 upload URL.")
                return Response(
                    {"detail": "Image upload is temporarily unavailable."},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            image_url = make_image_url(
                bucket_name,
                settings.AWS_S3_REGION_NAME,
                key,
            )
        else:
            upload_url = request.build_absolute_uri(
                reverse("upload-local", kwargs={"key": key})
            )
            image_url = request.build_absolute_uri(default_storage.url(key))

        return Response(
            {
                "upload_url": upload_url,
                "image_url": image_url,
                "method": "PUT",
                "headers": {"Content-Type": content_type},
            }
        )


class LocalUploadView(APIView):
    permission_classes = (IsAuthenticated,)

    def put(self, request, key):
        if not LOCAL_UPLOAD_KEY_PATTERN.fullmatch(key):
            return Response(
                {"detail": "Invalid upload key."},
                status=status.HTTP_404_NOT_FOUND,
            )

        content_type = request.headers.get("Content-Type", "").split(";", 1)[0]
        serializer = UploadPresignSerializer(
            data={
                "filename": PurePath(key).name,
                "content_type": content_type,
            }
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        content = request.stream.read(settings.MAX_UPLOAD_SIZE + 1)
        if len(content) > settings.MAX_UPLOAD_SIZE:
            return Response(
                {"detail": "Uploaded image is too large."},
                status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            )
        if not content:
            return Response(
                {"detail": "Uploaded image cannot be empty."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        saved_key = default_storage.save(key, ContentFile(content))
        image_url = request.build_absolute_uri(default_storage.url(saved_key))
        return Response(
            {"image_url": image_url},
            status=status.HTTP_201_CREATED,
        )
