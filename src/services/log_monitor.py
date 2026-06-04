"""
Strix Pro - Log Monitor Service
Persistent log storage with Loki webhook support + real-time streaming
"""

import json
import time
import threading
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from collections import deque


class LogStore:
    """Log store: in-memory ring buffer + persistent DB storage + real-time streaming"""
    
    def __init__(self, max_memory: int = 5000):
        self.max_memory = max_memory
        self.memory_logs: deque = deque(maxlen=max_memory)
        self.lock = threading.Lock()
        self.subscribers: List[asyncio.Queue] = []
        self.stats = {
            "total": 0,
            "by_level": {"debug": 0, "info": 0, "warning": 0, "error": 0, "critical": 0},
            "by_source": {"backend": 0, "frontend": 0, "scanner": 0, "system": 0, "loki": 0},
        }
    
    def add(
        self,
        level: str,
        message: str,
        source: str = "system",
        component: str = "",
        metadata: Optional[Dict] = None,
        labels: Optional[Dict] = None,
        raw: Optional[str] = None,
        timestamp: Optional[datetime] = None,
    ):
        """Add a log entry to memory + optionally persist to DB"""
        ts = timestamp or datetime.utcnow()
        
        entry = {
            "id": f"{int(time.time() * 1000)}-{id(self)}-{len(self.memory_logs)}",
            "timestamp": ts.isoformat() + "Z",
            "level": level.lower(),
            "message": message,
            "source": source.lower(),
            "component": component,
            "metadata": metadata or {},
            "labels": labels or {},
        }
        
        with self.lock:
            self.memory_logs.appendleft(entry)
            self.stats["total"] += 1
            self.stats["by_level"][level.lower()] = self.stats["by_level"].get(level.lower(), 0) + 1
            self.stats["by_source"][source.lower()] = self.stats["by_source"].get(source.lower(), 0) + 1
        
        # Notify real-time subscribers
        for queue in self.subscribers:
            try:
                queue.put_nowait(entry)
            except asyncio.QueueFull:
                pass
        
        # Persist to DB in background
        self._persist_to_db(level, message, source, component, metadata, labels, raw, ts)
        
        return entry
    
    def _persist_to_db(self, level, message, source, component, metadata, labels, raw, timestamp):
        """Persist log entry to SQLite database"""
        try:
            from src.db.models import SessionLocal, Log
            db = SessionLocal()
            try:
                log_entry = Log(
                    timestamp=timestamp,
                    level=level.lower(),
                    source=source.lower(),
                    component=component,
                    message=message,
                    metadata=metadata or {},
                    labels=labels or {},
                    raw=raw,
                )
                db.add(log_entry)
                db.commit()
            finally:
                db.close()
        except Exception as e:
            # Don't crash if DB write fails
            print(f"[LogStore] DB persist error: {e}")
    
    def query(
        self,
        level: Optional[str] = None,
        source: Optional[str] = None,
        search: Optional[str] = None,
        since: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
        use_db: bool = False,
    ) -> List[Dict]:
        """Query logs with filters"""
        if use_db:
            return self._query_db(level=level, source=source, search=search, since=since, limit=limit, offset=offset)
        
        with self.lock:
            results = list(self.memory_logs)
        
        if level:
            results = [l for l in results if l["level"] == level.lower()]
        if source:
            results = [l for l in results if l["source"] == source.lower()]
        if search:
            s = search.lower()
            results = [l for l in results if s in l["message"].lower() or s in l.get("component", "").lower()]
        if since:
            results = [l for l in results if l["timestamp"] >= since]
        
        return results[offset:offset + limit]
    
    def _query_db(self, level=None, source=None, search=None, since=None, limit=100, offset=0):
        """Query from persistent DB storage"""
        try:
            from src.db.models import SessionLocal, Log
            db = SessionLocal()
            try:
                q = db.query(Log)
                if level:
                    q = q.filter(Log.level == level.lower())
                if source:
                    q = q.filter(Log.source == source.lower())
                if search:
                    q = q.filter(Log.message.ilike(f"%{search}%"))
                if since:
                    q = q.filter(Log.timestamp >= since)
                q = q.order_by(Log.timestamp.desc()).offset(offset).limit(limit)
                
                return [
                    {
                        "id": str(l.id),
                        "timestamp": l.timestamp.isoformat() + "Z" if l.timestamp else "",
                        "level": l.level,
                        "message": l.message,
                        "source": l.source,
                        "component": l.component or "",
                        "metadata": l.metadata or {},
                        "labels": l.labels or {},
                    }
                    for l in q.all()
                ]
            finally:
                db.close()
        except Exception as e:
            print(f"[LogStore] DB query error: {e}")
            return []
    
    def get_stats(self) -> Dict:
        """Get log statistics"""
        with self.lock:
            memory_stats = dict(self.stats)
        
        # Also get DB count
        try:
            from src.db.models import SessionLocal, Log
            from sqlalchemy import func
            db = SessionLocal()
            try:
                total_db = db.query(Log).count()
                memory_stats["total_persisted"] = total_db
                memory_stats["retention_days"] = 90
            finally:
                db.close()
        except:
            pass
        
        return memory_stats
    
    def cleanup_old_logs(self, days: int = 90):
        """Delete logs older than N days (retention policy)"""
        try:
            from src.db.models import SessionLocal, Log
            db = SessionLocal()
            try:
                cutoff = datetime.utcnow() - timedelta(days=days)
                deleted = db.query(Log).filter(Log.timestamp < cutoff).delete()
                db.commit()
                print(f"[LogStore] Cleaned up {deleted} logs older than {days} days")
                return deleted
            finally:
                db.close()
        except Exception as e:
            print(f"[LogStore] Cleanup error: {e}")
            return 0
    
    def clear(self):
        """Clear all logs (memory + DB)"""
        with self.lock:
            self.memory_logs.clear()
            self.stats = {
                "total": 0,
                "by_level": {"debug": 0, "info": 0, "warning": 0, "error": 0, "critical": 0},
                "by_source": {"backend": 0, "frontend": 0, "scanner": 0, "system": 0, "loki": 0},
            }
        
        try:
            from src.db.models import SessionLocal, Log
            db = SessionLocal()
            try:
                db.query(Log).delete()
                db.commit()
            finally:
                db.close()
        except Exception as e:
            print(f"[LogStore] DB clear error: {e}")
    
    def parse_loki_push(self, payload: Dict) -> List[Dict]:
        """Parse Loki push payload (Loki API format)"""
        entries = []
        streams = payload.get("streams", [])
        
        for stream in streams:
            labels = stream.get("labels", {})
            # Parse labels dict (format: {"job": "...", "instance": "...", "level": "..."})
            if isinstance(labels, str):
                try:
                    labels = json.loads(labels)
                except:
                    labels = {"raw": labels}
            
            values = stream.get("values", [])
            for value_pair in values:
                if len(value_pair) >= 2:
                    ts_ns = value_pair[0]  # nanosecond timestamp
                    log_line = value_pair[1]
                    
                    # Parse timestamp
                    try:
                        ts_sec = int(ts_ns) / 1e9
                        ts = datetime.utcfromtimestamp(ts_sec)
                    except:
                        ts = datetime.utcnow()
                    
                    # Try to parse structured log (JSON)
                    level = labels.get("level", "info").lower()
                    source = labels.get("source", labels.get("job", "loki")).lower()
                    component = labels.get("component", labels.get("job", ""))
                    message = log_line
                    metadata = {}
                    
                    # Try JSON parse
                    try:
                        parsed = json.loads(log_line)
                        message = parsed.get("msg", parsed.get("message", log_line))
                        level = parsed.get("level", parsed.get("severity", level)).lower()
                        source = parsed.get("source", parsed.get("logger", source))
                        component = parsed.get("component", parsed.get("caller", component))
                        metadata = {k: v for k, v in parsed.items() if k not in ("msg", "message", "level", "severity", "source", "logger", "component", "caller")}
                    except json.JSONDecodeError:
                        pass
                    
                    # Normalize level
                    level_map = {"err": "error", "warn": "warning", "fatal": "critical", "emerg": "critical", "crit": "critical"}
                    level = level_map.get(level, level)
                    if level not in ("debug", "info", "warning", "error", "critical"):
                        level = "info"
                    
                    entry = self.add(
                        level=level,
                        message=message,
                        source=source,
                        component=component,
                        metadata=metadata,
                        labels=labels,
                        raw=log_line,
                        timestamp=ts,
                    )
                    entries.append(entry)
        
        return entries
    
    def subscribe(self) -> asyncio.Queue:
        """Subscribe to real-time log stream"""
        queue = asyncio.Queue(maxsize=2000)
        self.subscribers.append(queue)
        return queue
    
    def unsubscribe(self, queue: asyncio.Queue):
        """Unsubscribe from log stream"""
        if queue in self.subscribers:
            self.subscribers.remove(queue)


# Global log store
log_store = LogStore()


def add_log(level: str, message: str, source: str = "system", component: str = "", metadata: Optional[Dict] = None):
    return log_store.add(level=level, message=message, source=source, component=component, metadata=metadata)


def log_debug(message: str, source: str = "system", component: str = "", **kw):
    add_log("debug", message, source, component, kw or None)

def log_info(message: str, source: str = "system", component: str = "", **kw):
    add_log("info", message, source, component, kw or None)

def log_warning(message: str, source: str = "system", component: str = "", **kw):
    add_log("warning", message, source, component, kw or None)

def log_error(message: str, source: str = "system", component: str = "", **kw):
    add_log("error", message, source, component, kw or None)

def log_critical(message: str, source: str = "system", component: str = "", **kw):
    add_log("critical", message, source, component, kw or None)
