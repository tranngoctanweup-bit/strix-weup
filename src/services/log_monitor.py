"""
Strix Pro - Log Monitor Service
Real-time log collection, storage, and streaming
"""

import json
import time
import threading
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from collections import deque
from enum import Enum


class LogLevel(Enum):
    DEBUG = "debug"
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class LogSource(Enum):
    BACKEND = "backend"
    FRONTEND = "frontend"
    SCANNER = "scanner"
    SYSTEM = "system"


class LogEntry:
    """Single log entry"""
    
    def __init__(
        self,
        level: str,
        message: str,
        source: str = "system",
        component: str = "",
        metadata: Optional[Dict] = None,
    ):
        self.id = f"{int(time.time() * 1000)}-{id(self)}"
        self.timestamp = datetime.utcnow().isoformat() + "Z"
        self.level = level.lower()
        self.message = message
        self.source = source.lower()
        self.component = component
        self.metadata = metadata or {}
    
    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "timestamp": self.timestamp,
            "level": self.level,
            "message": self.message,
            "source": self.source,
            "component": self.component,
            "metadata": self.metadata,
        }


class LogStore:
    """In-memory log store with ring buffer and real-time streaming"""
    
    def __init__(self, max_size: int = 10000):
        self.max_size = max_size
        self.logs: deque = deque(maxlen=max_size)
        self.lock = threading.Lock()
        self.subscribers: List[asyncio.Queue] = []
        self.stats = {
            "total": 0,
            "by_level": {"debug": 0, "info": 0, "warning": 0, "error": 0, "critical": 0},
            "by_source": {"backend": 0, "frontend": 0, "scanner": 0, "system": 0},
        }
    
    def add(self, entry: LogEntry):
        """Add a log entry and notify subscribers"""
        with self.lock:
            self.logs.append(entry)
            self.stats["total"] += 1
            self.stats["by_level"][entry.level] = self.stats["by_level"].get(entry.level, 0) + 1
            self.stats["by_source"][entry.source] = self.stats["by_source"].get(entry.source, 0) + 1
        
        # Notify real-time subscribers
        log_dict = entry.to_dict()
        for queue in self.subscribers:
            try:
                queue.put_nowait(log_dict)
            except asyncio.QueueFull:
                pass  # Drop if subscriber is too slow
    
    def query(
        self,
        level: Optional[str] = None,
        source: Optional[str] = None,
        search: Optional[str] = None,
        since: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[Dict]:
        """Query logs with filters"""
        with self.lock:
            results = list(self.logs)
        
        # Apply filters
        if level:
            results = [l for l in results if l.level == level.lower()]
        if source:
            results = [l for l in results if l.source == source.lower()]
        if search:
            search_lower = search.lower()
            results = [l for l in results if search_lower in l.message.lower() or search_lower in l.component.lower()]
        if since:
            results = [l for l in results if l.timestamp >= since]
        
        # Sort newest first
        results.sort(key=lambda x: x.timestamp, reverse=True)
        
        # Pagination
        return [l.to_dict() for l in results[offset:offset + limit]]
    
    def get_stats(self) -> Dict:
        """Get log statistics"""
        with self.lock:
            return {
                "total": self.stats["total"],
                "stored": len(self.logs),
                "by_level": dict(self.stats["by_level"]),
                "by_source": dict(self.stats["by_source"]),
            }
    
    def clear(self):
        """Clear all logs"""
        with self.lock:
            self.logs.clear()
            self.stats = {
                "total": 0,
                "by_level": {"debug": 0, "info": 0, "warning": 0, "error": 0, "critical": 0},
                "by_source": {"backend": 0, "frontend": 0, "scanner": 0, "system": 0},
            }
    
    def subscribe(self) -> asyncio.Queue:
        """Subscribe to real-time log stream"""
        queue = asyncio.Queue(maxsize=1000)
        self.subscribers.append(queue)
        return queue
    
    def unsubscribe(self, queue: asyncio.Queue):
        """Unsubscribe from log stream"""
        if queue in self.subscribers:
            self.subscribers.remove(queue)


# Global log store
log_store = LogStore()


def add_log(level: str, message: str, source: str = "system", component: str = "", metadata: Optional[Dict] = None):
    """Add a log entry"""
    entry = LogEntry(level=level, message=message, source=source, component=component, metadata=metadata)
    log_store.add(entry)
    return entry


# Convenience functions
def log_debug(message: str, source: str = "system", component: str = "", **kwargs):
    add_log("debug", message, source, component, kwargs)

def log_info(message: str, source: str = "system", component: str = "", **kwargs):
    add_log("info", message, source, component, kwargs)

def log_warning(message: str, source: str = "system", component: str = "", **kwargs):
    add_log("warning", message, source, component, kwargs)

def log_error(message: str, source: str = "system", component: str = "", **kwargs):
    add_log("error", message, source, component, kwargs)

def log_critical(message: str, source: str = "system", component: str = "", **kwargs):
    add_log("critical", message, source, component, kwargs)
