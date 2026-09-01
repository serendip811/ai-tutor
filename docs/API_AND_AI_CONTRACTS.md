# Realtime API 및 이벤트 계약 v2.0

## 1. `POST /api/realtime/session`

부모 인증과 아이 접근 권한을 확인한 뒤 OpenAI Realtime 임시 세션을 만든다. 일반 API 키는 서버에만 둔다.

```json
{ "childId": "child_123", "requestedDurationSec": 300 }
```

```json
{
  "sessionId": "ses_123",
  "clientSecret": "ephemeral-secret",
  "expiresAt": "2026-09-01T12:01:00Z",
  "realtimeConfig": {
    "model": "gpt-realtime-2.1",
    "voice": "configured-voice",
    "vad": { "type": "semantic_vad", "eagerness": "low" }
  }
}
```

실제 OpenAI 응답 필드명은 사용 SDK 버전의 공식 타입을 따르며, 클라이언트에는 연결에 필요한 최소 정보만 전달한다.

## 2. WebRTC lifecycle

```text
GET profile → POST session → RTCPeerConnection
→ microphone track → SDP exchange
→ data channel events → active conversation
→ graceful close → report processing
```

브라우저는 `@openai/agents/realtime`의 `RealtimeAgent`와 `RealtimeSession`을 우선 사용한다.

## 3. Client event normalization

```ts
type SessionEvent = {
  eventId: string;
  sessionId: string;
  turnId?: string;
  name:
    | 'SESSION_CONNECTED'
    | 'SPEECH_STARTED'
    | 'SPEECH_STOPPED'
    | 'TRANSCRIPT_FINAL'
    | 'RESPONSE_CREATED'
    | 'FIRST_AUDIO_DELTA'
    | 'PLAYBACK_STARTED'
    | 'PLAYBACK_INTERRUPTED'
    | 'TOOL_CALLED'
    | 'SESSION_ENDED'
    | 'SESSION_ERROR';
  occurredAt: string;
  monotonicMs: number;
  payload: Record<string, unknown>;
  schemaVersion: 2;
};
```

## 4. `POST /api/sessions/{sessionId}/events`

```json
{
  "batchId": "batch_uuid",
  "events": [{
    "eventId": "evt_1",
    "name": "SPEECH_STOPPED",
    "occurredAt": "2026-09-01T12:00:02Z",
    "monotonicMs": 2150,
    "payload": {}
  }]
}
```

음성 반응을 막지 않도록 비동기로 전송하며 `batchId`로 멱등 처리한다.

## 5. 도구 계약

### `record_child_state`

```json
{ "state": "STRUGGLING", "reason": "child_requested_help" }
```

### `show_choices`

```json
{
  "prompt": "Cat or dog?",
  "choices": [
    { "id": "cat", "label": "Cat", "assetKey": "animal-cat" },
    { "id": "dog", "label": "Dog", "assetKey": "animal-dog" }
  ]
}
```

### `end_session`

```json
{ "reason": "CHILD_REQUEST" }
```

도구 실행 실패가 일반 음성 대화를 중단시키지 않도록 timeout과 fallback을 둔다.

## 6. Sideband control

서버는 WebRTC call id로 동일 세션에 WebSocket sideband 연결을 열 수 있다.

- 세션 이벤트 관찰
- 시간 종료 instruction update
- 비공개 도구 실행
- 안전 종료
- 반복 instruction 위반 시 세션 설정 조정

첫 vertical slice에서는 client event 기반으로 시작하고, 필요한 통제가 확인되면 sideband를 활성화한다. 아동용 공개 파일럿 전에는 서버 안전 종료 경로를 갖춘다.

## 7. `POST /api/sessions/{sessionId}/complete`

```json
{
  "reason": "NORMAL_WRAP_UP",
  "clientSummary": {
    "connectedMs": 312000,
    "childTurns": 22,
    "interruptions": 1
  }
}
```

서버는 transcript와 events를 집계해 비동기 리포트 작업을 시작한다.

## 8. 오류 정책

| 오류 | UX |
|---|---|
| 임시 세션 발급 실패 | 시작 전 재시도 |
| WebRTC 연결 실패 | 한 번 재연결 후 종료 안내 |
| 마이크 권한 거부 | iPhone 설정 안내 |
| Realtime 세션 중단 | 3초 이내 재연결 시도 |
| tool timeout | 일반 대화는 지속, 중요 도구는 안전 종료 |
| event 저장 실패 | 로컬 큐 보관 후 재전송, 음성은 지속 |

## 9. 보안

- 일반 API 키는 Vercel 환경변수에만 저장
- 임시 세션 응답에 `Cache-Control: no-store`
- childId에 대한 부모 권한 확인
- 원문 transcript와 audio는 별도 동의 정책 적용
- 개발 이벤트 패널은 운영 아이 화면에서 숨김

