# AsobiPlan

AsobiPlan은 유모차 이동을 고려한 경로 탐색과 주변 수유실, 기저귀 교환대, 유모차 친화 장소를 조회하기 위한 웹 애플리케이션입니다.

현재 저장소는 다음 구성으로 되어 있습니다.

- `backend`: FastAPI 기반 API 서버
- `frontend`: Next.js, React Leaflet 기반 지도 프론트엔드
- `osrm`: 유모차 이동에 맞춘 OSRM 라우팅 프로파일과 Docker 설정
- `docker-compose.yml`: PostgreSQL/PostGIS와 OSRM 실행 환경

> 참고: 백엔드는 `.env`가 없으면 SQLite fallback으로도 실행됩니다. 프론트엔드는 기본적으로 `http://localhost:8000`의 백엔드 API를 호출합니다. 실제 동선 계산은 OSRM이 실행 중일 때만 제공됩니다.

## 기술 스택

- Backend: FastAPI, SQLAlchemy, GeoAlchemy2
- Database: PostgreSQL 15, PostGIS, SQLite fallback
- Routing: OSRM
- Frontend: Next.js, React, React Leaflet, TypeScript, Tailwind CSS
- Runtime/Tooling: Docker Compose, Python, npm

## 시작하기

### 1. 환경 변수 준비

PostgreSQL/PostGIS를 사용할 경우 루트의 `.env.example`을 참고해 `.env` 파일을 만듭니다.

```bash
DATABASE_URL=postgresql://asobi_user:asobi_password@localhost:5432/asobi_db
OSRM_URL=http://localhost:5000
GOOGLE_PLACES_API_KEY=your_google_places_api_key_here
```

`.env`를 만들지 않으면 백엔드는 `sqlite:///./asobi.db`를 기본값으로 사용합니다. 이 경우 반경 검색은 PostGIS 대신 Python Haversine 계산으로 처리됩니다.

`GOOGLE_PLACES_API_KEY`가 기본 placeholder 값이면 데이터 import 스크립트는 mock 데이터를 사용합니다.

프론트엔드에서 백엔드 API 주소를 바꿔야 할 경우 `frontend` 쪽 환경 변수로 `NEXT_PUBLIC_API_URL`을 설정합니다. 설정하지 않으면 `http://localhost:8000`을 사용합니다.

### 2. 인프라 실행

PostgreSQL/PostGIS와 OSRM을 사용할 경우 루트 디렉터리에서 컨테이너를 실행합니다.

```bash
docker compose up -d
```

OSRM 컨테이너는 최초 실행 시 Kanto 지역 OSM 데이터를 다운로드하고 전처리합니다. 다운로드와 `osrm-extract`, `osrm-partition`, `osrm-customize` 작업 때문에 첫 실행은 시간이 걸릴 수 있습니다.

POI 조회만 확인할 경우 이 단계는 생략할 수 있습니다. 다만 OSRM을 실행하지 않으면 실제 동선은 표시되지 않고, 프론트엔드에 라우팅 엔진 미기동 메시지가 표시됩니다.

### 3. 백엔드 설정 및 데이터 import

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python scripts\import_data.py
```

데이터 import 스크립트는 다음 작업을 수행합니다.

- PostGIS extension 활성화
- `.env`가 없으면 SQLite DB 생성
- `baby_stations` 테이블 생성 및 mock 수유실 데이터 적재
- `stroller_friendly_places` 테이블 생성 및 mock 장소 데이터 적재
- 리뷰 키워드 기반 유모차 친화도 점수 계산

### 4. 백엔드 실행

`backend` 디렉터리에서 실행합니다.

```bash
uvicorn app.main:app --reload
```

기본 주소:

- API: `http://localhost:8000`
- Swagger 문서: `http://localhost:8000/docs`

### 5. 프론트엔드 실행

새 터미널에서 `frontend` 디렉터리로 이동합니다.

```bash
cd frontend
npm install
npm run dev
```

기본 주소:

- Frontend: `http://localhost:3000`

프론트엔드 화면에서는 도요초/미나미스나 주변 지도를 기준으로 수유실, 유모차 친화 장소, 출발지/도착지 기반 경로를 표시합니다.

## API

### `GET /`

API 서버 상태 확인용 루트 엔드포인트입니다.

응답 예시:

```json
{
  "message": "Welcome to AsobiPlan API"
}
```

SQLite fallback으로 실행 중이면 메시지는 `"Welcome to AsobiPlan API (SQLite Fallback Enabled)"`입니다.

### `GET /api/baby-stations`

중심 좌표 주변의 수유실, 기저귀 교환대 등 아기 돌봄 시설을 조회합니다.

Query parameters:

- `lat`: 중심 위도
- `lon`: 중심 경도
- `radius`: 검색 반경 미터 단위, 기본값 `500.0`

예시:

```bash
curl "http://localhost:8000/api/baby-stations?lat=35.6728&lon=139.8174&radius=1000"
```

### `GET /api/places`

중심 좌표 주변의 유모차 친화 장소를 조회합니다.

Query parameters:

- `lat`: 중심 위도
- `lon`: 중심 경도
- `radius`: 검색 반경 미터 단위, 기본값 `1000.0`
- `min_score`: 최소 유모차 친화도 점수, `1`부터 `5`까지, 기본값 `3`

예시:

```bash
curl "http://localhost:8000/api/places?lat=35.6728&lon=139.8174&radius=1500&min_score=3"
```

### `GET /api/route`

OSRM을 통해 출발지와 도착지 사이의 유모차 이동 친화 경로를 조회합니다.

Query parameters:

- `start_lat`: 출발지 위도
- `start_lon`: 출발지 경도
- `end_lat`: 도착지 위도
- `end_lon`: 도착지 경도

예시:

```bash
curl "http://localhost:8000/api/route?start_lat=35.6728&start_lon=139.8174&end_lat=35.6701&end_lon=139.8302"
```

OSRM 서버에 연결할 수 없는 경우 `503 Routing engine unavailable`을 반환합니다. 실제 도로망 기반 경로가 없을 때 가짜 동선을 그리지 않기 위한 정책입니다.

## OSRM 유모차 프로파일

`osrm/stroller.lua`는 OSRM 기본 foot profile을 확장해 유모차 이동에 맞는 가중치를 적용합니다.

- 계단(`highway=steps`) 경로 제외
- 접근 금지, 휠체어 불가 경로 제외
- 자갈, 모래, 비포장, 거친 `smoothness`, 높은 턱(`kerb=raised`) 등에 패널티 적용
- sidewalk, footway, pedestrian, asphalt, paved, concrete 같은 유모차 친화 경로 선호

## 프로젝트 구조

```text
.
├── backend
│   ├── app
│   │   ├── database.py
│   │   └── main.py
│   ├── scripts
│   │   └── import_data.py
│   └── requirements.txt
├── frontend
│   ├── src
│   │   ├── app
│   │   └── components
│   │       └── Map.tsx
│   └── package.json
├── osrm
│   ├── Dockerfile
│   ├── docker-entrypoint.sh
│   └── stroller.lua
├── .env.example
└── docker-compose.yml
```

## 개발 메모

- PostgreSQL 사용 시 데이터베이스는 PostGIS의 `ST_DWithin`을 사용해 반경 검색을 수행합니다.
- SQLite fallback 사용 시 Python Haversine 계산으로 반경 검색을 수행합니다.
- 장소 데이터는 현재 mock 기반이며, Google Places API 키가 설정되어도 실제 외부 fetch 구현은 아직 boilerplate 수준입니다.
- 프론트엔드는 `NEXT_PUBLIC_API_URL` 또는 기본 `http://localhost:8000`을 통해 백엔드 API와 연동합니다.
