"""Celery wiring. In development CELERY_EAGER=true runs tasks inline so no
Redis/worker is needed; in production point REDIS_URL at Redis and run
`celery -A app.workers.celery_app worker`."""
from app.core.config import get_settings

settings = get_settings()

try:
    from celery import Celery

    celery_app = Celery("invito", broker=settings.redis_url, backend=settings.redis_url)
    celery_app.conf.task_always_eager = settings.celery_eager
    celery_app.conf.task_eager_propagates = True
except Exception:  # celery not installed → eager shim
    class _Shim:
        def task(self, *a, **k):
            def deco(fn):
                fn.delay = fn
                return fn
            return deco

    celery_app = _Shim()
