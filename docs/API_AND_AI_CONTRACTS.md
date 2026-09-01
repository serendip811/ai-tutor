# API 및 AI JSON 계약 v1.0

## 1. 설계 원칙

- 외부 모델 공급자를 도메인 타입에서 분리한다.
- Controller 입력과 출력은 JSON으로 재현 가능해야 한다.
- 모든 AI 출력은 JSON Schema 검증 후 사용한다.
- transcript 원문은 최소 범위로 전달하고 로그에는 기본 마스킹한다.

## 2. 세션 API

### `POST /v1/sessions`

요청:

```json
{
  "childId": "child_123",
  "requestedDurationSec": 300,
  "client": { "platform": "ios", "locale": "ko-KR" }
}
```

응답:

```json
{
  "sessionId": "ses_123",
  "status": "ACTIVE",
  "phase": "HELLO",
  "expiresAt": "2026-09-01T12:10:00Z"
}
```

### `POST /v1/sessions/{sessionId}/turns`

클라이언트가 녹음 파일 참조와 turn idempotency key를 보낸다.

```json
{
  "clientTurnId": "ios-uuid",
  "audioObjectKey": "ephemeral/audio-key",
  "audioDurationMs": 1320,
  "clientEvents": ["CHOICE_VISIBLE"]
}
```

응답:

```json
{
  "turnId": "turn_456",
  "recognizedText": "Cat",
  "displayText": "Cat! You like cats!",
  "ttsAudioUrl": "signed-ephemeral-url",
  "visualAction": { "type": "SHOW_ANIMAL", "animal": "cat" },
  "choices": null,
  "listenMode": "OPEN_MIC",
  "stateVersion": 14
}
```

동일 `clientTurnId` 재요청은 동일 응답을 반환한다.

### `POST /v1/sessions/{sessionId}/silence`

```json
{ "promptTurnId": "turn_455", "elapsedMs": 5100 }
```

서버는 현재 state version과 prompt가 일치할 때만 힌트를 반환한다.

### `POST /v1/sessions/{sessionId}/stop`

아이 또는 부모의 즉시 종료. 추가 질문 없이 wrap-up 결과를 반환한다.

### `GET /v1/parent/sessions/{sessionId}/report`

부모 인증이 필수다. transcript와 원본 음성 URL은 별도 동의와 권한 검사를 거친다.

## 3. Analyzer 계약

입력:

```json
{
  "transcript": "I like 고래밥",
  "sttConfidence": 0.76,
  "prompt": {
    "intent": "ASK_LIKED_SNACK",
    "choices": [],
    "targetPattern": "I like ___"
  },
  "knownWords": ["I", "like", "cookie", "chips"],
  "allowedEntities": [{ "canonical": "Goraebap", "aliases": ["고래밥"] }]
}
```

출력:

```json
{
  "language": "MIXED",
  "answerForm": "SHORT_SENTENCE",
  "semanticIntent": "LIKE_SNACK",
  "semanticSlots": { "snack": "Goraebap" },
  "comprehension": "MATCH",
  "spontaneity": "SPONTANEOUS",
  "safety": "SAFE",
  "confidence": 0.88,
  "reasonCodes": ["PATTERN_MATCH", "REGISTERED_ALIAS_MATCH"]
}
```

Analyzer가 모르는 값을 추측해서 채우지 않는다. 불확실하면 `UNKNOWN` 또는 null을 반환한다.

## 4. Controller 계약

Controller는 모델 호출 없는 순수 함수여야 한다.

```ts
decideNextPlan(
  state: ConversationState,
  analysis: UtteranceAnalysis,
  content: ContentContext,
  nowMs: number
): { nextState: ConversationState; plan: ResponsePlan }
```

예시 출력:

```json
{
  "priority": 8,
  "acknowledge": true,
  "coreAction": "MODEL_PATTERN",
  "supportAction": "SHOW_TEXT",
  "visualAction": "SHOW_SNACK_GORAEBAP",
  "targetPattern": "I like ___",
  "allowedWords": ["Goraebap", "I", "like", "you"],
  "expectedChildResponse": "WORD",
  "reasonCodes": ["MIXED_MATCH", "MODEL_MISSING_ENGLISH_WORD"]
}
```

## 5. Response composer 프롬프트 입력

```json
{
  "role": "friendly_english_playmate_for_age_7",
  "responsePlan": {
    "coreAction": "ASK_CHOICE",
    "acknowledge": true,
    "allowedWords": ["cat", "dog", "like", "you"],
    "expectedChildResponse": "WORD"
  },
  "limits": {
    "maxEnglishWordsPerSentence": 5,
    "maxQuestions": 1,
    "maxNewWords": 0
  },
  "context": {
    "childAnswer": "Cat",
    "topic": "animals",
    "recentAssistantLines": ["Cat or dog?"]
  }
}
```

## 6. Response composer 출력

```json
{
  "spokenSegments": [
    { "language": "en", "text": "Cat!" },
    { "language": "en", "text": "Big or small?" }
  ],
  "displayText": "Cat! Big or small?",
  "choices": [
    { "id": "big", "label": "Big", "imageAsset": "size-big" },
    { "id": "small", "label": "Small", "imageAsset": "size-small" }
  ],
  "visualAction": { "type": "SHOW_CAT" }
}
```

출력에는 점수, 난이도 변경, state 변경을 포함할 수 없다.

## 7. Validator 결과

```json
{
  "valid": false,
  "violations": ["WORD_NOT_ALLOWED:tiny", "SENTENCE_TOO_LONG"],
  "fallbackKey": "ANIMAL_CHOICE_BASIC"
}
```

Fallback 템플릿은 코드와 콘텐츠 저장소에서 버전 관리한다.

## 8. 이벤트 계약

필수 이벤트:

- `session_started`
- `assistant_prompt_played`
- `child_audio_received`
- `stt_completed`
- `utterance_analyzed`
- `response_plan_decided`
- `response_validated`
- `repair_requested`
- `choice_shown`
- `visual_action_played`
- `session_extended`
- `session_ended`
- `parent_report_viewed`

공통 필드:

```json
{
  "eventId": "evt_uuid",
  "eventName": "response_plan_decided",
  "occurredAt": "2026-09-01T12:00:00Z",
  "sessionId": "ses_123",
  "turnId": "turn_456",
  "stateVersion": 14,
  "payload": {},
  "schemaVersion": 1
}
```

원본 transcript와 오디오 주소는 분석 이벤트에 넣지 않는다.

## 9. 오류 처리

| 오류 | 처리 |
|---|---|
| STT timeout | 한 번 짧게 재시도, 실패 시 선택 화면 |
| LLM timeout | 즉시 템플릿 fallback |
| Validator fail | 1회 재생성 후 fallback |
| TTS fail | 캐시된 짧은 음성 또는 세션 안전 종료 |
| stale state version | 409 반환, 최신 turn 재조회 |
| 중복 turn | idempotency key로 기존 결과 반환 |

