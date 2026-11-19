# 오늘의 패치

게임을 검색해 선택한 뒤 아이온2 공식 공지, 업데이트, CM 이야기와 패치 후 할 일을 확인할 수 있는 웹 UI입니다. Figma의 화면 구조와 Notion 서비스 기획의 1차 출시 범위를 참고했습니다.

## 로컬에서 실행하기

### Node.js 없이 바로 열기

파일 탐색기에서 `index.html`을 더블클릭하세요. 정적 화면과 검색·필터 기능을 바로 사용할 수 있습니다. CSS와 JavaScript 경로를 상대 경로로 지정해 `file://`에서도 열리도록 구성했습니다.

### 로컬 서버로 실행하기 (선택)

Node.js 18 이상이 설치되어 있으면 추가 패키지 설치 없이 실행할 수 있습니다.

```bash
node server.js
```

터미널 창을 켜둔 채 브라우저에서 [http://localhost:4173](http://localhost:4173)을 여세요. 다른 포트를 사용하려면 Windows PowerShell에서 `$env:PORT=5000; node server.js`로 실행합니다.

### 아이온2 공식 게시판 크롤링 및 AI 요약

크롤러는 아이온2 공식 공지, 업데이트, CM 이야기 게시판의 게시물을 가져온 뒤 Google AI Studio에서 발급한 키로 Gemini API를 직접 호출해 요약·분석합니다. API 키를 프로젝트 파일이나 채팅에 쓰지 말고 Windows 사용자 환경 변수로 설정하세요.

1. [Google AI Studio API 키 페이지](https://aistudio.google.com/apikey)에서 API 키를 만듭니다.
2. Windows 검색에서 `계정의 환경 변수 편집`을 열고 사용자 변수의 `새로 만들기`를 누릅니다.
3. 변수 이름에 `GEMINI_API_KEY`, 변수 값에 Google AI Studio에서 발급받은 키를 입력하고 저장합니다.
4. 열려 있는 PowerShell을 닫고 새로 연 뒤 프로젝트 폴더에서 크롤링을 실행합니다.

```powershell
cd C:\Users\user\Desktop\Todaypatch
npm run crawl
```

크롤러는 `gemma-4-31b-it` 모델을 Google Gemini API의 `generateContent` 주소로 직접 호출하고, JSON 형식의 요약·분석 결과를 검증한 다음 `data/aion2.js`에 저장합니다. Google API가 요청을 제한하거나 일시 오류를 반환하면 같은 모델로 한 번만 재시도하며, 실패할 경우 기존 데이터는 유지됩니다. 무료 사용량과 요청 제한은 Google 계정·프로젝트 상태에 따라 달라질 수 있습니다.

현재 PowerShell 창에서만 키를 설정하려면 아래처럼 실행할 수도 있습니다. 따옴표 안의 예시를 실제 키로 바꾸세요. 이 방식은 새 터미널을 열면 사라집니다.

```powershell
$env:GEMINI_API_KEY = "YOUR_GOOGLE_AI_STUDIO_API_KEY"
npm run crawl
```

크롤링 기본 기준일은 한국 시간 2026년 11월 18일이며, 세 공식 게시판에서 그 날짜 이후 게시물을 가져옵니다. 기준일은 `$env:AION2_CRAWL_SINCE = "YYYY-MM-DD"`로 바꿀 수 있습니다.

- [공지](https://aion2.plaync.com/ko-kr/board/notice/list)
- [업데이트](https://aion2.plaync.com/ko-kr/board/update/list)
- [CM 이야기](https://aion2.plaync.com/ko-kr/board/cm_story/list)

상세 화면과 검색은 AI 요약·분석을 사용하고, 공식 본문은 출처 링크로 연결합니다. 원문 본문 자체는 사이트 데이터에 저장하지 않습니다. API 키 누락, 크롤링 실패, 요약 오류가 발생하면 기존 데이터는 유지됩니다.

## 화면과 동작

- 메인 화면: 게임 검색, 팔로우 게임 목록, 이용 방법 안내
- 아이온2 개요: 최신 크롤링 게시물과 공지·업데이트·CM 이야기 바로가기
- 게시판 화면: 게시물 검색, 유형 필터, 상세 화면 이동
- 상세 화면: AI 요약·분석, 게시일, 수정일, 공식 원문 링크
- 체크리스트 완료 표시와 소식 북마크를 브라우저 `localStorage`에 저장
- 정보 신고 양식, 모바일 메뉴, 반응형 레이아웃

크롤링 데이터는 공지, 업데이트, CM 이야기 게시판에 한정됩니다. 팔로우와 북마크는 브라우저별로 저장되며 계정 간 동기화와 신고 저장 API는 연결되어 있지 않습니다.
