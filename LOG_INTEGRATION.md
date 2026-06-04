# Strix Pro — Log Integration Guide

Hướng dẫn tích hợp push log từ các hệ thống bên ngoài vào Strix Pro.

---

## 1. Webhook Endpoint

```
POST http://localhost:8000/api/logs/webhook/loki
Content-Type: application/json
```

## 2. Payload Format

### Option A: Loki Push API (batch, nhiều log cùng lúc)

```json
{
  "streams": [
    {
      "stream": {
        "job": "my-service",
        "level": "info",
        "source": "backend",
        "env": "production"
      },
      "values": [
        ["1717500000000000000", "User login successful"],
        ["1717500001000000000", "API request GET /api/users 200"],
        ["1717500002000000000", "Database query completed in 45ms"]
      ]
    }
  ]
}
```

**Lưu ý:** Timestamp là **nanoseconds** (Unix epoch × 10^9).

### Option B: Single Log (đơn giản)

```json
POST http://localhost:8000/api/logs
Content-Type: application/json

{
  "level": "error",
  "message": "Database connection timeout after 30s",
  "source": "backend",
  "component": "database",
  "log_metadata": {
    "host": "db-primary",
    "region": "ap-southeast-1",
    "retry_count": 3
  }
}
```

**Fields:**
- `level`: `debug` | `info` | `warning` | `error` | `critical`
- `message`: Nội dung log (bắt buộc)
- `source`: Tên service/system gửi log
- `component`: Component cụ thể (tuỳ chọn)
- `log_metadata`: Object JSON bất kỳ (tuỳ chọn)

---

## 3. Ví dụ tích hợp

### Python (requests)

```python
import requests
from datetime import datetime

def send_log(level: str, message: str, source: str, **extra):
    requests.post(
        "http://localhost:8000/api/logs",
        json={
            "level": level,
            "message": message,
            "source": source,
            "log_metadata": extra if extra else None
        },
        timeout=5
    )

# Sử dụng
send_log("info", "User login", "auth-service", user_id=123, ip="1.2.3.4")
send_log("error", "Payment failed", "payment-service", order_id="ORD-456", amount=99.99)
```

### Python (batch via Loki format)

```python
import requests
import time

def send_logs_batch(logs: list[tuple[str, str]], job: str, source: str):
    """logs = [(level, message), ...]"""
    values = []
    for i, (level, message) in enumerate(logs):
        ts = str(int((time.time() + i * 0.001) * 1_000_000_000))
        values.append([ts, message])

    requests.post(
        "http://localhost:8000/api/logs/webhook/loki",
        json={
            "streams": [{
                "stream": {"job": job, "source": source},
                "values": values
            }]
        },
        timeout=10
    )

# Gửi 1 batch
send_logs_batch(
    logs=[
        ("info", "Service started on port 8080"),
        ("info", "Connected to database"),
        ("warning", "Cache miss rate high: 45%"),
    ],
    job="my-api",
    source="backend"
)
```

### Node.js (fetch)

```javascript
async function sendLog(level, message, source, metadata = null) {
  await fetch('http://localhost:8000/api/logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      level,
      message,
      source,
      log_metadata: metadata
    })
  });
}

// Sử dụng
sendLog('info', 'Server started', 'api-gateway', { port: 3000 });
sendLog('error', 'Redis connection lost', 'cache-service', { host: 'redis://...' });
```

### cURL

```bash
# Single log
curl -X POST http://localhost:8000/api/logs \
  -H "Content-Type: application/json" \
  -d '{
    "level": "info",
    "message": "Deployment completed successfully",
    "source": "ci-cd",
    "component": "deployer"
  }'

# Loki batch
curl -X POST http://localhost:8000/api/logs/webhook/loki \
  -H "Content-Type: application/json" \
  -d '{
    "streams": [{
      "stream": {"job": "nginx", "source": "web-server"},
      "values": [
        ["1717500000000000000", "GET /api/health 200"],
        ["1717500001000000000", "POST /api/login 200"],
        ["1717500002000000000", "GET /api/users 401 Unauthorized"]
      ]
    }]
  }'
```

### Shell Script (cron job log collector)

```bash
#!/bin/bash
# File: /usr/local/bin/strix-log.sh
# Cron: */5 * * * * /usr/local/bin/strix-log.sh

STRIX_URL="http://localhost:8000/api/logs"
HOSTNAME=$(hostname)

# Collect system metrics
CPU=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}')
MEM=$(free -m | awk 'NR==2{printf "%.1f%%", $3*100/$2}')
DISK=$(df -h / | awk 'NR==2{print $5}')

# Determine level
LEVEL="info"
if (( $(echo "$CPU > 80" | bc -l) )); then LEVEL="warning"; fi
if (( $(echo "$CPU > 95" | bc -l) )); then LEVEL="error"; fi

curl -s -X POST "$STRIX_URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"level\": \"$LEVEL\",
    \"message\": \"CPU: ${CPU}% | RAM: ${MEM} | Disk: ${DISK}\",
    \"source\": \"${HOSTNAME}\",
    \"component\": \"system-monitor\"
  }"
```

---

## 4. Levels & Best Practices

| Level      | Khi nào dùng                                      |
|------------|---------------------------------------------------|
| `debug`    | Chi tiết kỹ thuật, chỉ bật khi debug              |
| `info`     | Hoạt động bình thường: startup, request, deploy   |
| `warning`  | Bất thường nhưng chưa lỗi: retry, slow query      |
| `error`    | Lỗi cần xử lý: exception, timeout, auth fail      |
| `critical` | Nghiêm trọng: data loss, security breach, outage  |

### Labels khuyến nghị

- **`source`**: Tên service (e.g., `auth-service`, `payment-api`, `nginx`)
- **`component`**: Module cụ thể (e.g., `database`, `cache`, `router`)
- **`log_metadata`**: Context bổ sung — request_id, user_id, error stack, v.v.

---

## 5. Xem log trong Strix Pro

1. Mở **http://localhost:3000** → Đăng nhập
2. Vào **Logs** tab (sidebar)
3. Chế độ xem:
   - **Live** — realtime qua WebSocket, log mới tự động hiện
   - **History** — query từ database (persistent, 90 ngày)
4. Filter theo: level, source, search text
5. Pause/Resume để dừng auto-scroll

---

## 6. Architecture

```
                    ┌──────────────┐
  Service A ──────▶│              │
                    │  Strix Pro   │──── SQLite (90 days)
  Service B ──────▶│  Backend     │
                    │  :8000       │──── Loki :3100 (Docker logs)
  Service C ──────▶│              │
                    └──────────────┘
                           │
                    ┌──────┴──────┐
                    │  Logs Tab   │◀── WebSocket (live)
                    │  :3000      │◀── REST API (history)
                    └─────────────┘
```

**Endpoints:**
- `POST /api/logs` — Gửi single log
- `POST /api/logs/webhook/loki` — Gửi batch (Loki format)
- `GET /api/logs?level=error&limit=100` — Query logs
- `GET /api/logs/sources` — Danh sách sources
- `WS /ws/logs` — Realtime stream
