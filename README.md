# AsobiPlan

AsobiPlan은 도쿄 고토구 주변에서 유모차 이동을 고려해 장소를 찾고, 선택한 출발지와 도착지를 Google Maps 길찾기로 연결하는 정적 웹 앱 및 데이터 수집 백엔드 프로젝트입니다. 수유실과 기저귀 교환대는 독립 장소가 아니라 **매장, 몰, 역, 공공시설 안에 있는 편의시설**로 표시합니다.

---

## 🏗️ 전체 구조

```text
AsobiPlan
 ├── frontend (Next.js 정적 앱)
 │    ├── public/data/ (정적 GeoJSON 데이터)
 │    └── src/ (React-Leaflet 지도 및 UI 컴포넌트)
 └── backend (FastAPI 서버 및 데이터 수집/분석 파이프라인)
      ├── app/ (API 라우터 및 데이터베이스 모델)
      ├── scripts/ (Google Places API 및 Gemini AI 분석 스크립트)
      └── tests/ (백엔드 테스트)
```

---

## ✨ 주요 기능

### 1. 프론트엔드 (Frontend)
- **지도 탐색**: `React-Leaflet`을 사용해 고토구 주변의 편의시설 및 유모차 친화적 매장 위치를 표시합니다.
- **상세 필터링**: 수유실, 기저귀 교환 공간, 온수 제공 여부, 경사로 설치 여부, 아기의자 구비 여부 및 무료 개방 여부 등으로 장소를 필터링할 수 있습니다.
- **AI 이동 점수 필터**: Gemini AI가 분석한 유모차 이동 친화도 점수(1~5점)를 기준으로 탐색할 수 있습니다.
- **길찾기 연동**: 지도상에서 출발지와 도착지(혹은 현재 위치를 출발지로 설정)를 선택한 뒤 Google Maps 앱/웹 딥링크로 연동하여 도보 길찾기 경로를 제공합니다.

### 2. 백엔드 (Backend)
- **FastAPI API 서버**: 데이터베이스에 저장된 유모차 친화 장소 목록을 반경 검색 및 필터와 함께 반환합니다.
- **Gemini AI 리뷰 분석 파이프라인**: `gemini-2.5-flash` 모델을 사용하여 수집된 매장 리뷰 텍스트를 기반으로 유모차 친화도 점수(`stroller_score`), 태그(키워드), 편의시설 여부 및 한국어 요약(`child_summary`, `reasoning`)을 자동으로 생성합니다.
- **데이터 수집 및 가공 스크립트**:
  - `collect_places.py`: API 키 없이 OpenStreetMap 공개 데이터로 장소를 수집하거나, 선택적으로 Google Places API 및 Gemini API를 연동하여 실제 데이터를 수집합니다.
  - `import_akachan_flat.py`: 도쿄도 '아카짱 플랫(赤ちゃん・ふらっと)' 수유 공간 원천 데이터를 DB로 임포트합니다.
  - `keyword_analysis.py`: 리뷰 데이터를 분석해 점수와 키워드를 추출합니다.

---

## 🚀 로컬 실행 가이드

### 1. 환경 설정
API 키 없이 OpenStreetMap 공개 데이터 기반 수집을 사용할 수 있습니다. Google Places 및 Gemini 기반 라이브 수집은 선택 사항이며, 이 모드를 사용할 때만 루트 디렉터리의 `.env.example` 파일을 복사하여 `.env` 파일을 생성하고 필요한 API Key를 설정합니다.

```env
# Google Places API Config
GOOGLE_PLACES_API_KEY=your_google_places_api_key_here

# Gemini API Config (AI 리뷰 분석용)
GEMINI_API_KEY=your_gemini_api_key_here
```

### 2. 백엔드 실행 & 데이터 수집 (Backend)
```bash
cd backend

# 가상환경 구축 및 활성화
python -m venv venv
# Windows의 경우
venv\Scripts\activate
# macOS/Linux의 경우
# source venv/bin/activate

# 의존성 설치
pip install -r requirements.txt

# 데이터베이스 초기화 및 기본 모의(Mock) 데이터 로드
python scripts/import_data.py

# API 키 없이 OpenStreetMap 공개 데이터 기반 장소 수집 실행
python scripts/collect_places.py --open-data

# (선택) Google Places API & Gemini API 기반 라이브 데이터 수집 실행
python scripts/collect_places.py --live

# API 서버 구동
uvicorn app.main:app --reload
```
- 백엔드 서버는 기본적으로 `http://localhost:8000`에서 실행됩니다.
- API 문서(Swagger UI)는 `http://localhost:8000/docs`에서 확인할 수 있습니다.

### 3. 프론트엔드 실행 (Frontend)
```bash
cd frontend
npm install
npm run dev
```
- 프론트엔드 개발 서버는 `http://localhost:3000`에서 실행됩니다.

---

## 📦 정적 데이터 및 배포
현재 AsobiPlan의 기본 배포 목표는 **무료 GitHub Pages 배포**입니다. 프론트엔드는 빌드 시 서버 API 호출 없이 아래 정적 GeoJSON 데이터를 직접 읽어 동작합니다.

- `frontend/public/data/baby-stations.json`
- `frontend/public/data/places.json`
- `frontend/public/data/avoid-areas.json`

현재 포함된 정적 데이터는 다음 규모입니다.

- `baby-stations.json`: 도쿄도 공식 赤ちゃん・ふらっと 기반 수유·기저귀 시설 1,654건
- `places.json`: OpenStreetMap 공개 데이터 기반 장소 4,638건
- `places.json` 중 406건은 공식 수유·기저귀 시설 근접 정보가 함께 보강됨

### API 키 없는 데이터 강화
`collect_places.py --open-data`는 OpenStreetMap 공개 태그를 기반으로 장소와 유모차 접근성 단서를 수집합니다. 이 모드에서는 Google 평점과 리뷰 기반 AI 요약을 사용하지 않으며, `wheelchair`, `changing_table`, `toilets:wheelchair`, `highchair`, `outdoor_seating` 등 공개 태그와 공식 수유·기저귀 시설 근접도를 기준으로 점수를 산정합니다.

수집 결과는 두 경로에 동시에 반영됩니다.

- 정적 배포용 GeoJSON: `frontend/public/data/places.json`, `frontend/public/data/baby-stations.json`
- 백엔드 로컬 DB: `backend/asobi.db`

OpenStreetMap 기반 데이터 사용 시 OpenStreetMap 기여자 표기를 유지해야 합니다. 앱 지도 타일과 수집 데이터는 OpenStreetMap/ODbL 기반 정보를 포함합니다.

### 재수집 절차
```bash
cd backend
python scripts/collect_places.py --open-data
```

재수집 후에는 아래 검증을 실행합니다.

```bash
cd backend
pytest

cd ../frontend
npm test
npm run build
```

### GitHub Pages 배포 설정
1. GitHub 저장소 `Settings > Pages`에서 Source를 `GitHub Actions`로 설정합니다.
2. `main` 브랜치에 push하면 `.github/workflows/pages.yml` 액션이 동작하여 `frontend/out` 결과물을 배포합니다.
3. 배포 주소 형식: `https://<username>.github.io/AsobiPlan/`

---

## 🧪 테스트 및 검증

### 백엔드 테스트
```bash
cd backend
pytest
```

### 프론트엔드 테스트
```bash
cd frontend
# 유닛 테스트
npm test
# 린트 검사
npm run lint
# E2E 테스트 (Playwright)
npm run test:e2e
# 정적 빌드 검증
npm run build
```
