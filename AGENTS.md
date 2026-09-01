# Repository working agreement

## Source of truth

`docs/`의 명세가 제품 동작의 기준이다. 구현과 명세가 충돌하면 임의로 해석하지 말고 명세를 함께 수정한다.

## Required behavior

- Conversation Controller의 결정은 LLM 출력보다 우선한다.
- LLM의 원문을 검증 없이 TTS로 보내지 않는다.
- 아동 원본 음성, transcript, 개인정보를 로그에 평문으로 남기지 않는다.
- 모든 Controller 규칙은 결정적 단위 테스트를 가진다.
- 사용자에게 보이는 학습 판정에는 분류 신뢰도를 반영한다.

## Initial implementation order

1. 공용 타입과 JSON Schema
2. 발화 분석기 인터페이스
3. Controller 및 우선순위 규칙
4. Response Validator
5. 시뮬레이터와 시나리오 테스트
6. STT/LLM/TTS 어댑터
7. 아이 화면
8. 부모 리포트

## Definition of done

- 타입 검사, lint, 단위 테스트 통과
- 정상, 침묵, 한국어, 혼합어, STT 오류, 거절, 종료 시나리오 통과
- 허용 범위를 벗어난 LLM 응답이 TTS로 전달되지 않음
- 관련 문서 및 결정 기록 업데이트

