# AsobiPlan

AsobiPlan은 도쿄 고토구 주변에서 유모차 이동을 고려해 수유실, 기저귀 교환대, 유모차 친화 장소를 찾고, 선택한 출발지와 도착지를 Google Maps 길찾기로 여는 정적 웹 앱입니다.

현재 기본 배포 목표는 **무료 GitHub Pages 배포**입니다.

- 프론트엔드: Next.js static export → GitHub Pages
- 장소 데이터: `frontend/public/data/*.json` 정적 GeoJSON
- 길찾기: Google Maps 앱/웹 딥링크
- 서버/DB/라우팅 엔진: MVP 배포에는 필요 없음

## 무료 배포 구조

```text
GitHub Pages
  └─ 정적 Next.js 앱
       ├─ /data/baby-stations.json
       ├─ /data/places.json
       └─ Google Maps 길찾기 링크
```

OpenRouteService, Cloudflare Worker, OSRM은 현재 기본 길찾기 흐름에 필요하지 않습니다. 사용자는 앱에서 출발지와 도착지를 선택한 뒤 **Google Maps에서 길찾기** 버튼을 눌러 지도 앱으로 이동합니다.

## MVP 길찾기

앱은 Google Maps URL을 다음 형태로 생성합니다.

```text
https://www.google.com/maps/dir/?api=1&origin=<lat>,<lon>&destination=<lat>,<lon>&travelmode=walking
```

사용 흐름:

1. 수유소나 장소 카드에서 `출발`을 선택합니다.
2. 장소 카드, 지도 팝업, 또는 지도 우클릭으로 `도착`을 선택합니다.
3. 상단 패널의 `Google Maps에서 길찾기`를 누릅니다.

Google Maps 도보 길찾기는 계단 회피를 강제하는 옵션을 제공하지 않습니다. 따라서 앱은 장소 탐색과 출발/도착 선택에 집중하고, 실시간 내비게이션은 Google Maps에 맡깁니다.

## 로컬 실행

```bash
cd frontend
npm install
npm run dev
```

기본 주소는 `http://localhost:3000`입니다.

## GitHub Pages 배포

이 저장소에는 GitHub Pages용 workflow가 포함되어 있습니다.

- `.github/workflows/pages.yml`
- `frontend/next.config.ts`의 `output: "export"`
- GitHub Pages용 `basePath=/AsobiPlan`

설정 순서:

1. GitHub 저장소 `Settings > Pages`에서 Source를 `GitHub Actions`로 설정합니다.
2. `main` 브랜치에 push하면 GitHub Actions가 `frontend/out`을 GitHub Pages에 배포합니다.

배포 주소는 보통 다음 형태입니다.

```text
https://chanpa09.github.io/AsobiPlan/
```

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
npm run test:e2e
```

`npm run build`는 정적 export 산출물인 `frontend/out`을 생성합니다.

## 서버형 실험 구성

아래 구성은 현재 GitHub Pages MVP에는 필요하지 않지만, 나중에 앱 내부 경로 표시를 다시 실험할 때 사용할 수 있습니다.

- `backend`: FastAPI 기반 API 서버
- `osrm`: 유모차 이동에 맞춘 OSRM 라우팅 프로파일과 Docker 설정
- `workers/route-proxy`: OpenRouteService 호출용 Cloudflare Worker 예제
- `docker-compose.yml`: PostgreSQL/PostGIS와 OSRM 실행 환경
