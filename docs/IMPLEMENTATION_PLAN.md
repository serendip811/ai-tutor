# MVP 구현 계획 v1.0

## 1. 권장 기술 구조

초기에는 마이크로서비스로 나누지 않고 모듈형 모놀리스로 시작한다.

- Web client: Next.js + TypeScript, 모바일 PWA 우선
- API: Next.js server 또는 별도 Node.js TypeScript API
- DB: PostgreSQL
- Queue/cache: 초기에는 선택 사항, 오디오 처리 지연이 생기면 Redis 도입
- Object storage: 암호화와 lifecycle 삭제를 지원하는 저장소
- AI providers: STT, LLM, TTS를 adapter interface 뒤에 둠
- Test: Vitest/Jest + Playwright
- Schema: Zod 또는 JSON Schema

첫 파일럿이 iPhone 중심이면 PWA로 대화 엔진을 먼저 검증하고, 지속적인 백그라운드 오디오나 App Store 배포가 필요해질 때 native shell을 검토한다.

## 2. 리포지토리 목표 구조

```text
apps/
  web/
  api/
packages/
  conversation-domain/
  content/
  ai-adapters/
  shared-schemas/
docs/
tests/
  scenarios/
```

## 3. Milestone 0 — 결정적 시뮬레이터

산출물:

- 공용 타입과 Schema
- `decideNextPlan()` 순수 함수
- Response Validator
- 3개 세션 시나리오 fixture
- CLI 또는 간단한 웹 기반 text simulator

완료 조건:

- 외부 STT/LLM/TTS 없이 10개 Controller 필수 테스트 통과
- 동일 입력은 동일 plan을 생성
- Validator 실패 시 항상 안전 템플릿 반환

## 4. Milestone 1 — 음성 세션 vertical slice

산출물:

- 부모 1명/아이 1명 로컬 프로필
- 마이크 녹음
- STT adapter
- Analyzer
- Controller
- LLM composer + Validator
- TTS 재생
- Animals 주제와 `I like ___`

완료 조건:

- iPhone Safari에서 5분 세션 완료
- 발화 종료부터 응답 재생 P95 3초 이내 또는 병목 수치 확보
- STT 실패·침묵·거절·종료 흐름 수동 검증

## 5. Milestone 2 — MVP 콘텐츠와 부모 리포트

산출물:

- 주제 5개, Pattern 5개
- 의미 기반 시각 반응
- 세션 집계 및 부모 리포트
- 단어·패턴 프로필
- transcript 보관/삭제 설정

완료 조건:

- 시하 실제 사용 20~30세션
- 세션별 로그 재생 도구
- 잘못된 자발 발화 판정 표본 검토
- 질문 반복, 끊김, 과도한 따라 말하기 지표 확인

## 6. Milestone 3 — 파일럿 안정화

- 두 번째 아동 프로필 지원
- 관측성, 오류 알림, 비용 계측
- 개인정보 삭제 작업
- 부모 동의 화면과 정책 검토
- 제한된 외부 파일럿 준비

## 7. 우선 백로그

### P0

- 도메인 타입과 JSON Schema
- Controller 우선순위
- 한국어/Mixed 의미 성공 처리
- repair 1회 제한
- stop intent 최우선
- Validator와 fallback
- 세션 이벤트 수집

### P1

- 5개 주제 콘텐츠
- 단답 확장 빈도 정책
- 그림 선택과 캐릭터 반응
- 부모 리포트
- 단어/패턴 evidence 업데이트

### P2

- 콘텐츠 관리 도구
- 다양한 캐릭터
- 추가 주제
- 네이티브 앱

## 8. 테스트 전략

- Unit: Analyzer 규칙, Controller, Validator, mastery evidence
- Contract: STT/LLM/TTS adapter의 고정 fixture
- Scenario: `SESSION_SCENARIOS.md` 전체 흐름
- Property: 어떤 입력에서도 질문 1개·repair 1회·stop 후 질문 0개
- E2E: iOS Safari 녹음 권한, 네트워크 지연, 중복 제출
- Human review: 아동 음성 STT 표본과 부모 리포트의 판정 정확도

## 9. 관측성과 비용

Dashboard 최소 항목:

- 단계별 latency P50/P95
- STT low-confidence 비율
- repair 및 fallback 비율
- 세션 완료·중단율
- child turn, language mix, spontaneous pattern 추정
- 세션당 STT/LLM/TTS 비용

## 10. 첫 개발 이슈 묶음

1. `shared-schemas`: ConversationState와 UtteranceAnalysis
2. `conversation-domain`: action priority resolver
3. `conversation-domain`: difficulty/support reducer
4. `conversation-domain`: repair policy
5. `conversation-domain`: shadowing policy
6. `conversation-domain`: response validator
7. `tests/scenarios`: 3개 fixture
8. `simulator`: text turn runner
9. `content`: Animals topic v1
10. `api`: session/turn endpoints skeleton

첫 코드 작업은 1~8을 하나의 vertical development branch에서 완료하는 것을 권장한다.

