# EasyStock 📈

증권사 API를 활용해 주식 포트폴리오 리밸런싱을 자동화하고, 과거 수익률을 분석할 수 있는 개인용 웹 대시보드입니다. 

## 💡 기획 취지
개인 투자자가 포트폴리오 비중을 유지하기 위해 매번 직접 계산하고 주문하는 번거로움을 해결하고자 합니다. 예산 입력 후 버튼 클릭 한 번으로 리밸런싱 매매 주문을 실행하며, 시뮬레이션을 통해 포트폴리오의 과거 성과를 직관적으로 확인할 수 있습니다.

## ✨ 주요 기능

* **실시간 포트폴리오 모니터링**
  * 현재 보유 중인 포트폴리오의 종합 수익률 및 자산 현황 확인
  * 개별 종목의 평단가(평균 매입 단가), 현재가, 보유 수량 등 모든 상세 정보 조회
* **원클릭 자동 리밸런싱**
  * 투자 예산을 입력하면 현재 포트폴리오 목표 비중에 맞춘 매수/매도 수량을 자동 계산
  * 버튼 클릭 한 번으로 나무증권 API를 통한 실제 매매 주문 실행
* **포트폴리오 수익률 백테스트**
  * 사용자 맞춤형 포트폴리오 구성 및 저장
  * **거치식 시뮬레이션:** 과거 특정 시점에 일시불로 구매했을 때의 수익률 추적
  * **적립식 시뮬레이션:** 과거부터 주기적으로(예: 매월) 분할 매수했을 때의 수익률 추적

## 🛠 기술 스택

* **Frontend:** React, TypeScript, Vite, Tailwind CSS
* **Backend:** FastAPI, C# 
* **Integration:** 나무증권 API 연동

## 🚀 시작하기

### 필수 조건
* Node.js 설치
* Python 3.8 이상 설치
* 나무증권 API 발급 키 (App Key, App Secret)

### 설치 및 실행

```bash
# 레포지토리 클론
git clone [https://github.com/6uchu/EasyStock.git](https://github.com/6uchu/EasyStock.git)
cd EasyStock

# 프론트엔드 종속성 설치 및 실행
npm install
npm run dev

# 백엔드 가상환경 설정 및 실행 (FastAPI)
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
