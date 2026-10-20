# RakshaSetu - Distributed Autonomous Emergency Response Network

[![CI/CD Pipeline](https://github.com/yourusername/RakshaSetu/actions/workflows/ci.yml/badge.svg)](https://github.com/yourusername/RakshaSetu/actions/workflows/ci.yml)
[![Docker Compose Ready](https://img.shields.io/badge/Docker%20Compose-Ready-blue.svg)](docker-compose.yml)
[![Tests Passing](https://img.shields.io/badge/Tests-11%20Passed-brightgreen.svg)](backend/tests)
[![Redis Geospatial](https://img.shields.io/badge/Redis-Geospatial%20p50%20%3C%205ms-red.svg)](backend/scripts/benchmark-geospatial.js)
[![License: ISC](https://img.shields.io/badge/License-ISC-yellow.svg)](LICENSE)

RakshaSetu is a high-throughput, fault-tolerant distributed emergency coordination network designed for neighborhoods, campuses, and smart cities. It features a **sub-100ms asynchronous SOS ingestion pipeline**, **Redis Geospatial $O(\log N)$ proximity matching**, **distributed locks (Redlock) preventing split-brain dispatches**, and a **stateless FastAPI vision triage microservice with circuit breakers**.

---

## Key SDE Architectural Highlights

1. **Sub-100ms Event-Driven SOS Ingestion (BullMQ + Redis)**:
   - Client requests receive `HTTP 202 Accepted` in **< 80ms** (p99).
   - Offloads Gemini AI guidance, TomTom routing, and notification fanout to asynchronous background worker pools.
2. **Sub-5ms Geospatial Proximity Matching (Redis vs. MongoDB)**:
   - Replaced linear $O(N)$ JavaScript math with **Redis Geospatial (`GEOADD`, `GEOSEARCH`)**.
   - Benchmarked across 10,000 active responders with a **median query latency of 4.25ms** (p99 < 21ms).
3. **Zero Split-Brain Dispatches (Redlock & FSM)**:
   - Uses Redis distributed locking (`SET NX PX` + Lua atomic release) to guarantee mutual exclusion when responders claim an active emergency.
   - Strict **Finite State Machine (FSM)** rejects illegal out-of-order state transitions.
   - Redis-backed **`Idempotency-Key` middleware** eliminates duplicate emergency alerts caused by flaky cellular network retries.
4. **Resilient AI Vision Microservice with Circuit Breakers**:
   - Python vision microservice built with **FastAPI and Uvicorn**, utilizing thread-pooled CPU workers for non-blocking YOLO inference.
   - Wrapped cloud APIs (Gemini LLM & TomTom Routing) in **`opossum` Circuit Breakers**, guaranteeing instant failover to local deterministic first-aid triage (`102 / 108 / 112`) during cloud degradation.
5. **Production Reliability & DevOps**:
   - **One-Command Orchestration**: Full-stack multi-container deployment via `docker compose up --build`.
   - **Automated Verification**: Vitest unit/integration tests and automated concurrency stress test suites.
   - **Instant Demo Seeding**: `npm run seed` instantly populates trauma centers, ambulances, and active CPR responders with live GPS heartbeats.

---

## System Architecture

```
                    ┌─────────────────────────┐
                    │ Mobile / Web Client     │
                    └───────────┬─────────────┘
                                │ HTTPS / WSS
                                ▼
                    ┌─────────────────────────┐
                    │ NGINX / Gateway         │
                    └───────────┬─────────────┘
                                │
        ┌───────────────────────┴───────────────────────┐
        ▼                                               ▼
┌───────────────────────────────┐       ┌───────────────────────────────┐
│ Express API Ingestion Cluster │       │ Socket.io Multi-Node Cluster  │
│ - Idempotency Guard (24h)     │       │ - Distributed Redis Adapter   │
│ - Sub-100ms ACK (HTTP 202)    │       │ - Real-Time Room Telemetry    │
└───────────────┬───────────────┘       └───────────────▲───────────────┘
                │                                       │
                ├───────────────────────────────────────┤
                ▼                                       ▼
┌───────────────────────────────┐       ┌───────────────────────────────┐
│ Redis 7 In-Memory Cluster     │       │ MongoDB Replica Set           │
│ - BullMQ Emergency Queue      │       │ - Persistent State Storage    │
│ - Geospatial (geo:responders) │       │ - Medical Records (QR Token)  │
│ - Distributed Locks (Redlock) │       │ - Audit Trails & Welfare Logs │
└───────────────▲───────────────┘       └───────────────▲───────────────┘
                │                                       │
                ▼                                       │
┌───────────────────────────────┐                       │
│ Asynchronous BullMQ Workers   │───────────────────────┘
│ ├─ Stage 1: Proximity Match   │
│ ├─ Stage 2: Gemini AI Guidance│ ◄── [Circuit Breakers (opossum)]
│ └─ Stage 3: Alert Fanout      │
└───────────────────────────────┘
```

---

## Tech Stack

### Frontend
- **React 19** + **Vite 7**
- **TailwindCSS 4** + **Framer Motion**
- **Zustand** (State Management)
- **Leaflet & React-Leaflet** (Interactive Maps)
- **Socket.io Client** (Real-Time Bidirectional Event Streaming)
- **Phosphor Icons**

### Backend Core
- **Node.js 20** + **Express 5**
- **Redis 7** (Geospatial Indexes, Distributed Locks, Socket.io Pub/Sub Adapter)
- **BullMQ 6** (Event-Driven Asynchronous Dispatch Pipeline)
- **MongoDB 7** + **Mongoose 9** (2dsphere Geospatial Indexing)
- **Opossum** (Circuit Breakers for Fault Tolerance)
- **Vitest & Supertest** (Test Suites)

### AI Vision Microservice
- **FastAPI** + **Uvicorn** (Asynchronous ASGI Architecture)
- **YOLOv11n** (Ultralytics Nano Model for Person & Hazard Detection)
- **Gemini 2.5 Flash** / **LLaVA 7b via Ollama** (Vision-Language Triage Models)
- **OpenCV** (Image Preprocessing & Frame Decoders)

---

## Quickstart (Single Command with Docker Compose)

The entire platform (Frontend, Backend, AI Microservice, MongoDB, and Redis) runs with one command:

```bash
docker compose up --build
```

Access points:
- **Web Application**: `http://localhost:3000`
- **Backend API**: `http://localhost:5000`
- **AI Microservice Swagger Docs**: `http://localhost:5003/docs`

---

## Local Development Setup (Manual)

### 1. Prerequisites
- Node.js 20+
- Python 3.10+
- Docker (for Redis and MongoDB)

### 2. Start Infrastructure
```bash
docker run -d --name raksha-redis -p 6379:6379 redis:alpine
docker run -d --name raksha-mongo -p 27017:27017 mongo:7.0
```

### 3. Backend Setup
```bash
cd backend
npm install
npm run seed              # Seeds hospitals, ambulances, and active responders into Redis
npm test                  # Runs 11 Vitest integration tests
npm run test:concurrency  # Verifies Redlock mutual exclusion across 10 concurrent requests
npm run benchmark:geo     # Runs 10,000-responder Redis Geospatial benchmark
npm run dev               # Starts backend on http://localhost:5000
```

### 4. AI Microservice Setup
```bash
cd models
python -m venv venv
# Windows: venv\Scripts\activate | Unix: source venv/bin/activate
pip install -r requirements.txt
python run_server.py      # Starts FastAPI on http://localhost:5003
```

### 5. Frontend Setup
```bash
cd frontend
npm install
npm run dev               # Starts Vite dev server on http://localhost:5173
```

---

## Verified Benchmarks & Test Results

### 1. Geospatial Ingestion & Search (`npm run benchmark:geo`)
Tested on 10,000 simulated community responders in a metropolitan area:
```text
================== BENCHMARK RESULTS ==================
Total Responders Ingested: 10,000 in 415 ms (24,093 ops/sec)
Total Proximity Queries:   1,000 (radius: 3 km)
Total Responders Found:    229,730 (avg 229.7 / query)
Throughput:                183 queries/sec
-------------------------------------------------------
Latency p50 (Median):      4.252 ms
Latency p90:               7.157 ms
Latency p95:               10.751 ms
Latency p99:               20.890 ms
=======================================================
```

### 2. Concurrency & Race Condition Suite (`npm run test:concurrency`)
```text
[Test 1] Validating Emergency Finite State Machine (FSM)...
PASSED: All valid and terminal state transitions enforced.

[Test 2] Simulating 10 concurrent responders accepting the SAME emergency...
  -> Lock acquired by responder-1! Emergency claimed.
Results:
  - Successful Claims:        1 (Expected: 1)
  - Blocked Concurrent Units: 9 (Expected: 9)
  - Winning Responder:        responder-1
PASSED: Distributed Lock successfully prevented split-brain race condition!

[Test 3] Testing Idempotency Token Ingestion Guard...
PASSED: Idempotency Key successfully blocked duplicate in-flight network retry.
```

---

## API Documentation

### Emergency SOS
- `POST /api/sos` - Create SOS alert (Accepts `Idempotency-Key` header; returns `202 Accepted` in < 80ms)
- `PATCH /api/sos/:id/accept` - Claim an SOS alert (Guarded by Redis Distributed Try-Lock)
- `PUT /api/sos/:id/resolve` - Resolve SOS alert (Guarded by FSM validation)
- `GET /api/sos/active` - List active emergencies
- `GET /api/sos/:id` - Fetch live tracking, routing, and ambulance assignments

### AI Vision Triage
- `POST /api/analyze` - Ingest multi-frame camera feed for YOLO person detection + VLM classification
- `GET /docs` - Interactive OpenAPI / Swagger UI

---

## License

This project is licensed under the ISC License.

---

Built with ❤️ by **Team RakshaSetu**