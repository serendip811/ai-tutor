# Repository working agreement

## Source of truth

`docs/`의 명세가 제품 동작의 기준이다. 구현과 명세가 충돌하면 임의로 해석하지 말고 명세를 함께 수정한다.

## Required behavior

- 브라우저 음성은 애플리케이션 서버를 중계하지 않고 OpenAI Realtime에 WebRTC로 직접 연결한다.
- 일반 OpenAI API 키를 클라이언트에 노출하지 않고 서버가 임시 세션을 발급한다.
- 매 턴 도구나 별도 모델 호출을 강제해 Realtime 응답 경로를 느리게 만들지 않는다.
- 아동 원본 음성, transcript, 개인정보를 로그에 평문으로 남기지 않는다.
- Session Director의 상태 전이와 도구는 결정적 단위 테스트를 가진다.
- 사용자에게 보이는 학습 판정에는 분류 신뢰도를 반영한다.

## Initial implementation order

1. Next.js 모바일 화면과 임시 Realtime 세션 API
2. RealtimeAgent·RealtimeSession WebRTC 연결
3. 이벤트 및 지연시간 개발 패널
4. 시하 전용 Agent instruction
5. Session Director 상태·도구
6. 세션·transcript·리포트 저장
7. 실제 시하 세션 평가와 반복 개선

## Definition of done

- 타입 검사, lint, 단위 테스트 통과
- 정상, 느린 발화, 한국어, 혼합어, 끼어들기, 거절, 종료 시나리오 통과
- iPhone에서 end-of-turn부터 첫 응답 음성까지 latency가 기록됨
- 관련 문서 및 결정 기록 업데이트
