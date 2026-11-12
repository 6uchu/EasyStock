# EasyStock

증권사 API를 통해 포트폴리오 구성, 간편하게 리밸런싱하고 과거 수익률을 살펴보는 개인용 데스크톱 웹 앱입니다.

## 주요 기능

### 대시보드

- 계좌와 보유 종목 조회
- 대시보드에서 포트폴리오 계획과 목표 비중 관리

### 연구실

- 연구실에서 포트폴리오를 직접 구성하거나 계좌 포트폴리오 불러오기
- 과거 한 시점에 매수하거나 주기적으로 매수했을 때의 수익률 계산
- 과거 포트폴리오의 차트 확인

시세 시뮬레이션은 일별 종가 기준입니다. 수수료, 세금, 배당, 환율 변동은 계산하지 않으며 실제 투자 성과를 보장하지 않습니다. 최초 시세일은 공식 상장일과 다를 수 있습니다. 이 앱은 계좌 조회와 시뮬레이션을 제공하며 실제 매수 주문을 제출하지 않습니다.

## 필요한 프로그램

- Windows
- Python 3.10 이상
- Node.js와 npm
- NH 나무증권 PLUG API 사용 권한 및 앱 키/시크릿

버전을 확인하려면 PowerShell에서 다음을 실행합니다.

```powershell
py --version
node --version
npm --version
```

## 처음 설치하기

프로젝트 폴더에서 PowerShell을 열고, 프런트엔드 환경 파일을 준비합니다.

```powershell
Copy-Item portfolio-app\portfolio-frontend\.env.example portfolio-app\portfolio-frontend\.env
```

기본 설정은 프런트엔드가 로컬 백엔드 `http://localhost:8000/api/v1`에 연결하도록 되어 있습니다. 백엔드 Python 가상환경을 만들고 패키지를 설치합니다.

```powershell
cd portfolio-app\portfolio-backend
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
cd ..\..
```

## 실행하기

프로젝트 폴더의 `EasyStock 실행.bat`을 더블 클릭합니다.

이 배치 파일은 백엔드와 프런트엔드를 시작하고 브라우저를 엽니다. 프런트엔드 패키지가 아직 설치되지 않았다면 `npm install`도 자동으로 실행합니다. Python 가상환경은 자동 생성하지 않으므로 위의 처음 설치 단계를 먼저 완료해야 합니다.

기본 주소:

- 앱: <http://localhost:5173>
- 백엔드 API: <http://localhost:8000/api/v1>

## 나무증권 계좌 연결

앱을 열고 연결 화면에서 NH 나무증권 PLUG 앱 키와 시크릿을 입력합니다. 키와 시크릿은 앱을 실행한 Windows 사용자 계정의 **Windows 자격 증명 관리자**에 저장됩니다. 연결 정보 중 이름과 식별자만 `portfolio-app\portfolio-backend\data\connections.json`에 저장됩니다.

이 저장 방식은 이 PC의 Windows 사용자 계정에 한정됩니다. 프로젝트 폴더나 Git 저장소를 다른 PC로 복사해도 연결 키는 함께 이동하지 않으므로, 다른 사용자는 본인의 키로 다시 연결해야 합니다. 앱 키와 시크릿을 `.env`, README, Git 커밋에 넣지 마세요.

## 데이터 저장 위치

- 연결 키와 시크릿: Windows 자격 증명 관리자
- 증권사 연결의 표시 이름과 식별자: `portfolio-app\portfolio-backend\data\connections.json`
- 포트폴리오 계획 및 연구실 설정: 브라우저의 로컬 저장소

로컬 연결 정보와 Python 가상환경, 프런트엔드 의존성, `.env` 파일은 Git에서 제외됩니다. 따라서 새 PC에서는 Python 패키지 설치와 프런트엔드 환경 파일 설정이 필요합니다.

## 직접 실행하기

배치 파일 대신 터미널 두 개에서 각각 실행할 수도 있습니다.

백엔드:

```powershell
cd portfolio-app\portfolio-backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

프런트엔드:

```powershell
cd portfolio-app\portfolio-frontend
npm install
npm run dev -- --host 127.0.0.1
```

그 뒤 <http://localhost:5173>을 엽니다.

## 문제 해결

### `Backend Python environment was not found`

백엔드 폴더에서 가상환경 생성과 패키지 설치 단계를 실행합니다.

### 프런트엔드에서 백엔드 연결 오류

`portfolio-app\portfolio-frontend\.env`가 있는지 확인하고, 다음 설정이 들어 있는지 확인합니다.

```dotenv
VITE_API_URL=http://localhost:8000/api/v1
```

환경 파일을 수정했다면 Vite 서버를 종료한 뒤 다시 시작합니다.

### 증권사 키를 찾지 못하거나 자격 증명 관리자 오류가 발생함

연결을 저장한 Windows 사용자 계정으로 앱을 실행하는지 확인합니다. 다른 PC나 다른 Windows 계정에서는 증권사 연결을 다시 등록해야 합니다.

### 주소가 이미 사용 중이라고 표시됨

기존 EasyStock 백엔드 또는 프런트엔드 창을 종료한 뒤 배치 파일을 다시 실행합니다.
