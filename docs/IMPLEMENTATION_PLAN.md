# MVP 구현 계획 v2.0

## 1. 권장 기술 구조

초기에는 마이크로서비스로 나누지 않고 모듈형 모놀리스로 시작한다.

- Web client: Next.js + TypeScript, 모바일 PWA 우선
- Realtime: `@openai/agents/realtime`의 RealtimeAgent·RealtimeSession
- Transport: 브라우저에서 OpenAI로 직접 WebRTC
- API: Next.js Route Handler로 임시 세션·이벤트·리포트 처리
- DB: PostgreSQL
- Queue/cache: 초기에는 선택 사항, 오디오 처리 지연이 생기면 Redis 도입
- Object storage: 암호화와 lifecycle 삭제를 지원하는 저장소
- AI: OpenAI Realtime speech-to-speech, 별도 STT/LLM/TTS 체인은 fallback 연구 대상으로만 둠
- Test: Vitest/Jest + Playwright
- Schema: Zod 또는 JSON Schema

첫 파일럿이 iPhone 중심이면 PWA로 대화 엔진을 먼저 검증하고, 지속적인 백그라운드 오디오나 App Store 배포가 필요해질 때 native shell을 검토한다.

## 2. 리포지토리 목표 구조

```text
apps/
  web/
  api/
packages/
  session-director/
  content/
  realtime/
  shared-schemas/
docs/
tests/
  scenarios/
```

## 3. Milestone 0 — Realtime vertical slice

산출물:

- Next.js 앱과 모바일 홈·대화 화면
- `/api/realtime/session` 임시 세션 API
- RealtimeAgent·RealtimeSession WebRTC 연결
- semantic VAD 설정
- 원시 이벤트와 지연시간 개발 패널
- 5분 자동 종료

완료 조건:

- iPhone Safari에서 양방향 음성 대화 가능
- 일반 API 키가 브라우저 번들·응답·로그에 없음
- end-of-turn과 first audio latency 측정 가능
- 끼어들기와 정상 종료 동작

## 4. Milestone 1 — 시하 전용 Agent

산출물:

- 부모 1명/아이 1명 로컬 프로필
- 시하 전용 instruction
- Animals·Colors 주제와 `I like ___`
- `show_choices`, `record_child_state`, `end_session` 도구
- transcript와 정규화 이벤트 수집
- `semantic_vad` low/auto 비교

완료 조건:

- iPhone Safari에서 5분 세션 완료
- 발화 종료부터 응답 재생 P95 3초 이내 또는 병목 수치 확보
- 느린 발화·한국어·혼합어·거절·종료 흐름 검증

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

- 임시 Realtime 세션 API
- WebRTC 음성 연결
- RealtimeAgent instruction
- semantic VAD
- latency 이벤트 수집
- stop intent와 5분 종료
- API 키 및 아동 데이터 보호

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
- Contract: 임시 세션 API, 정규화 이벤트, Realtime tool schema
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

1. Next.js 앱과 모바일 shell
2. 임시 Realtime 세션 Route Handler
3. RealtimeAgent·RealtimeSession 연결
4. 시하 전용 instruction
5. semantic VAD와 끼어들기
6. 이벤트 정규화와 latency 패널
7. 5분 종료 및 재연결
8. 세션 이벤트 저장 schema
9. Animals·Colors 콘텐츠 context
10. 실제 iPhone 시나리오 평가

첫 코드 작업은 1~7을 하나의 vertical slice로 완료하고 실제 iPhone에서 속도를 확인한다.
