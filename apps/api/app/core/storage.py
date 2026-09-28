"""Object storage abstraction: local disk in development, S3-compatible in production."""
import io
import os
import uuid
from dataclasses import dataclass

from PIL import Image, ImageOps

from .config import get_settings

settings = get_settings()


@dataclass
class StoredFile:
    key: str
    url: str
    width: int | None = None
    height: int | None = None
    size: int = 0
    content_type: str = "application/octet-stream"


def optimize_image(data: bytes, max_side: int = 2000, quality: int = 84) -> tuple[bytes, int, int, str]:
    """Downscale, strip EXIF, re-encode. Returns (bytes, w, h, content_type)."""
    img = Image.open(io.BytesIO(data))
    img = ImageOps.exif_transpose(img)
    has_alpha = img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info)
    img = img.convert("RGBA" if has_alpha else "RGB")
    img.thumbnail((max_side, max_side))
    out = io.BytesIO()
    if has_alpha:
        img.save(out, format="PNG", optimize=True)
        ct = "image/png"
    else:
        img.save(out, format="JPEG", quality=quality, optimize=True, progressive=True)
        ct = "image/jpeg"
    return out.getvalue(), img.width, img.height, ct


class LocalStorage:
    def __init__(self, root: str):
        self.root = os.path.abspath(root)
        os.makedirs(self.root, exist_ok=True)

    def put(self, data: bytes, ext: str, content_type: str, prefix: str = "uploads") -> StoredFile:
        key = f"{prefix}/{uuid.uuid4().hex}{ext}"
        path = os.path.join(self.root, key)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            f.write(data)
        return StoredFile(key=key, url=f"/media/{key}", size=len(data), content_type=content_type)

    def delete(self, key: str) -> None:
        path = os.path.join(self.root, key)
        if os.path.exists(path):
            os.remove(path)

    def open(self, key: str) -> bytes:
        with open(os.path.join(self.root, key), "rb") as f:
            return f.read()


class S3Storage:
    def __init__(self):
        import boto3  # optional dependency

        self.client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url or None,
            region_name=settings.s3_region or None,
            aws_access_key_id=settings.s3_access_key_id or None,
            aws_secret_access_key=settings.s3_secret_access_key or None,
        )
        self.bucket = settings.s3_bucket

    def put(self, data: bytes, ext: str, content_type: str, prefix: str = "uploads") -> StoredFile:
        key = f"{prefix}/{uuid.uuid4().hex}{ext}"
        self.client.put_object(Bucket=self.bucket, Key=key, Body=data, ContentType=content_type, ACL="public-read")
        base = settings.s3_public_base_url.rstrip("/") or f"{settings.s3_endpoint_url.rstrip('/')}/{self.bucket}"
        return StoredFile(key=key, url=f"{base}/{key}", size=len(data), content_type=content_type)

    def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=key)

    def open(self, key: str) -> bytes:
        return self.client.get_object(Bucket=self.bucket, Key=key)["Body"].read()


def get_storage():
    if settings.storage_backend == "s3":
        return S3Storage()
    return LocalStorage(settings.local_storage_dir)
