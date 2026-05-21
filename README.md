# AsobiPlan

AsobiPlan은 도쿄 고토구 주변에서 유모차 이동을 고려해 수유실, 기저귀 교환대, 유모차 친화 장소와 도보 동선을 확인하는 웹 앱입니다.

현재 기본 배포 목표는 **무료 정적 배포**입니다.

- 프론트엔드: Next.js static export → GitHub Pages
- 장소 데이터: `frontend/public/data/*.json` 정적 GeoJSON
- 동선 계산: Cloudflare Worker 프록시 → OpenRouteService 무료 API
- 기존 백엔드/OSRM: 로컬 개발 또는 서버형 운영용으로 유지

## 무료 배포 구조

```text
GitHub Pages
  └─ 정적 Next.js 앱
       ├─ /data/baby-stations.json
       ├─ /data/places.json
       └─ NEXT_PUBLIC_ROUTE_API_URL로 Worker 호출

Cloudflare Worker
  └─ ORS_API_KEY를 숨긴 상태로 OpenRouteService 호출
```

브라우저에는 OpenRouteService API 키를 넣지 않습니다. 라우팅 API 키는 Cloudflare Worker secret으로만 저장합니다.

## 로컬 실행

```bash
cd frontend
npm install
npm run dev
```

기본 주소는 `http://localhost:3000`입니다.

동선 계산까지 로컬에서 확인하려면 `NEXT_PUBLIC_ROUTE_API_URL`을 설정해야 합니다.

```bash
$env:NEXT_PUBLIC_ROUTE_API_URL="https://your-worker.your-subdomain.workers.dev"
npm run dev
```

## GitHub Pages 배포

이 저장소에는 GitHub Pages용 workflow가 포함되어 있습니다.

- `.github/workflows/pages.yml`
- `frontend/next.config.ts`의 `output: "export"`
- GitHub Pages용 `basePath=/AsobiPlan`

설정 순서:

1. GitHub 저장소 `Settings > Pages`에서 Source를 `GitHub Actions`로 설정합니다.
2. Cloudflare Worker를 배포합니다.
3. GitHub 저장소 `Settings > Secrets and variables > Actions > Variables`에 `NEXT_PUBLIC_ROUTE_API_URL`을 추가하고 Worker URL을 넣습니다.
4. `main` 브랜치에 push하면 GitHub Actions가 `frontend/out`을 GitHub Pages에 배포합니다.

배포 주소는 보통 다음 형태입니다.

```text
https://chanpa09.github.io/AsobiPlan/
```

## Cloudflare Worker 라우팅 프록시

Worker 소스는 `workers/route-proxy`에 있습니다.

```bash
cd workers/route-proxy
copy wrangler.toml.example wrangler.toml
wrangler secret put ORS_API_KEY
wrangler deploy
```

`wrangler.toml`의 `ALLOWED_ORIGIN`은 필수입니다. 이 값이 없거나 요청 origin이 다르면 Worker는 요청을 거부합니다. 공개 Worker URL을 통해 무료 ORS quota가 소모되는 일을 줄이기 위한 설정입니다.

```toml
[vars]
ALLOWED_ORIGIN = "https://chanpa09.github.io"
```

프론트엔드는 Worker에 다음 형식으로 요청합니다.

```json
{
  "start": { "lat": 35.6728, "lon": 139.8174 },
  "end": { "lat": 35.6701, "lon": 139.8302 }
}
```

Worker는 OpenRouteService의 `foot-walking` 경로를 호출하고, `steps` 회피 옵션을 적용한 결과를 프론트엔드가 쓰는 route 형식으로 반환합니다.

## 정적 데이터

프론트엔드는 서버 API 대신 아래 파일을 직접 읽습니다.

- `frontend/public/data/baby-stations.json`
- `frontend/public/data/places.json`
- `frontend/public/data/avoid-areas.json`

반경 검색과 필터링은 브라우저에서 Haversine 거리 계산과 배열 필터링으로 처리합니다. 고토구 규모의 POI 데이터에서는 별도 DB 없이 충분히 빠르게 동작합니다.

## 검증

```bash
cd frontend
npm test
npm run lint
npm run build
```

`npm run build`는 정적 export 산출물인 `frontend/out`을 생성합니다.

## 서버형 로컬 아키텍처

아래 구성은 GitHub Pages 배포에는 필요하지 않지만, 자체 서버/OSRM 운영을 실험할 때 사용할 수 있습니다.

- `backend`: FastAPI 기반 API 서버
- `osrm`: 유모차 이동에 맞춘 OSRM 라우팅 프로파일과 Docker 설정
- `docker-compose.yml`: PostgreSQL/PostGIS와 OSRM 실행 환경

OSRM 컨테이너가 실행되지 않으면 기존 `/api/route`는 `503 Routing engine unavailable`을 반환합니다. GitHub Pages 배포에서는 이 경로를 사용하지 않고 Cloudflare Worker 라우팅 프록시를 사용합니다.
