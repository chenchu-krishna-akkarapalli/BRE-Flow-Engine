import asyncio
import json
from typing import Any, Callable, Dict, Optional
from app.core.logging import logger
from app.core.redis import get_redis


class CacheService:
    """Redis Singleflight lock & SWR cache manager."""

    def __init__(self):
        self._locks: Dict[str, asyncio.Lock] = {}

    def _get_in_memory_lock(self, key: str) -> asyncio.Lock:
        if key not in self._locks:
            self._locks[key] = asyncio.Lock()
        return self._locks[key]

    async def get_or_compute_singleflight(
        self, cache_key: str, compute_func: Callable[[], Any], ttl_seconds: int = 60
    ) -> Any:
        """Singleflight pattern: prevents cache stampedes by ensuring only one concurrent request executes compute_func."""
        try:
            redis = await get_redis()
            cached_val = await redis.get(cache_key)
            if cached_val:
                return json.loads(cached_val)
        except Exception as e:
            logger.warning(f"Redis get failed for {cache_key}: {e}")

        # Acquire per-key Singleflight lock
        lock = self._get_in_memory_lock(cache_key)
        async with lock:
            # Re-check cache inside lock
            try:
                redis = await get_redis()
                cached_val = await redis.get(cache_key)
                if cached_val:
                    return json.loads(cached_val)
            except Exception:
                pass

            # Execute computation
            result = await compute_func() if asyncio.iscoroutinefunction(compute_func) else compute_func()

            # Store in Redis
            try:
                redis = await get_redis()
                await redis.setex(cache_key, ttl_seconds, json.dumps(result))
            except Exception as e:
                logger.warning(f"Redis set failed for {cache_key}: {e}")

            return result


cache_service = CacheService()
