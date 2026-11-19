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

### 아이온2 공식 게시판 크롤링

Node.js 18 이상과 인터넷 연결이 필요합니다. 기본 AI 제공자는 OpenAI이며, API 키를 프로젝트 파일이나 채팅에 저장하지 말고 환경 변수로 설정한 뒤 프로젝트 폴더에서 `npm run crawl`을 실행하세요. 기본 기준일은 한국 시간 2026년 11월 18일이며, 세 공식 게시판에서 그 날짜 이후의 게시물을 수집해 AI가 요약·분석한 결과를 `data/aion2.js`에 기록합니다. 기준일은 `AION2_CRAWL_SINCE=YYYY-MM-DD` 환경 변수로 바꿀 수 있습니다.

#### OpenRouter 임시 사용

[OpenRouter API 키](https://openrouter.ai/settings/keys)를 만든 뒤 Windows 사용자 환경 변수 `OPENROUTER_API_KEY`에 저장합니다. PowerShell에서 아래 명령을 실행하면 이 터미널에서만 Gemma 4 31B 무료 모델로 크롤링합니다.

```powershell
cd C:\Users\user\Desktop\Todaypatch
$env:AI_PROVIDER = "openrouter"
npm run crawl
```

`AI_PROVIDER`는 현재 PowerShell 창에만 적용됩니다. 새 PowerShell 창에서는 기본 OpenAI 설정으로 돌아갑니다. OpenRouter 키는 `OPENAI_API_KEY`와 다른 키이므로 `OPENROUTER_API_KEY`로 등록해야 합니다. 크롤러는 `google/gemma-4-31b-it:free`만 요청하며 다른 모델로 대체하지 않습니다. 429 응답은 `Retry-After` 값(없으면 60초)을 기다려 한 번 재시도한 뒤에도 실패하면 중단하고 기존 데이터는 유지합니다. 응답 모델 ID가 Gemma와 다르면 결과를 저장하지 않습니다. 무료 모델 ID에는 `:free` 접미사가 필요하며, 접미사가 없는 `google/gemma-4-31b-it`은 별도의 유료 모델 ID입니다. OpenRouter 연결은 Chat Completions JSON 모드를 사용합니다. 이 모델은 JSON 형식은 지원하지만 JSON Schema를 강제하지 않으므로, 크롤러가 결과를 검사한 뒤에만 데이터를 갱신합니다.

- [공지](https://aion2.plaync.com/ko-kr/board/notice/list)
- [업데이트](https://aion2.plaync.com/ko-kr/board/update/list)
- [CM 이야기](https://aion2.plaync.com/ko-kr/board/cm_story/list)

상세 화면과 검색은 AI 요약·분석을 사용하고, 공식 본문은 출처 링크로 연결합니다. 원문 본문 자체는 사이트 데이터에 저장하지 않습니다. API 키 누락, 크롤링 실패, 요약 오류가 발생하면 기존 데이터는 유지됩니다. OpenAI 선택 시 Responses API를 사용하고 응답 저장을 비활성화합니다. OpenRouter 선택 시 OpenRouter의 Chat Completions API를 사용합니다.

## 화면과 동작

- 메인 화면: 게임 검색, 팔로우 게임 목록, 이용 방법 안내
- 아이온2 개요: 최신 크롤링 게시물과 공지·업데이트·CM 이야기 바로가기
- 게시판 화면: 게시물 검색, 유형 필터, 상세 화면 이동
- 상세 화면: AI 요약·분석, 게시일, 수정일, 공식 원문 링크
- 체크리스트 완료 표시와 소식 북마크를 브라우저 `localStorage`에 저장
- 정보 신고 양식, 모바일 메뉴, 반응형 레이아웃

크롤링 데이터는 공지, 업데이트, CM 이야기 게시판에 한정됩니다. 기존 화면용 데이터의 요약은 현재 제공된 공지 내용을 바탕으로 작성했으며, 다음 크롤링부터는 설정한 OpenAI API를 통해 자동 생성됩니다. 팔로우와 북마크는 브라우저별로 저장되며 계정 간 동기화와 신고 저장 API는 연결되어 있지 않습니다.
