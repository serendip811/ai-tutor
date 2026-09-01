# 8분 세션 시나리오 3개

각 시나리오는 구현 시 end-to-end 평가 대화로 사용한다. 문장은 정답 fixture가 아니라 기대 행동이며 Realtime Agent의 실제 표현은 달라질 수 있다.

## 시나리오 A — 반응이 좋은 날

목표: `I like ___`, `It's ___`; Animals → Colors.

| 시각 | AI | Child | 기대 관찰 |
|---:|---|---|---|
| 0:00 | Hi, Siha! Are you happy? | Yes. | MATCH, ASK_YES_NO |
| 0:20 | Yay! Cat or dog? | Cat. | SINGLE_WORD, RESPOND |
| 0:40 | Cat! Big or small? | Small. | MATCH, PLAY_ACTION |
| 1:00 | A small cat! What color? | Pink. | MATCH, 색 변경 |
| 1:20 | Pink! You like pink! | I like pink. | SPONTANEOUS pattern 증거 |
| 1:45 | Yes! Do you like blue? | Yes. | MATCH |
| 2:05 | Yes, I do. Blue or pink? | Pink. | 모델링만, 따라 말하기 없음 |
| 2:30 | Make the cat big! | Big! | PLAY_ACTION, 고양이 확대 |
| 3:00 | It's big! Can you say it? | It's big. | OPTIONAL_SHADOW 1회 |
| 3:30 | Great! Cookie or apple? | Cookie. | 계획된 Food 전환 |
| 4:00 | I like cookies. You? | I like cookies. | target recall 성공 |
| 4:30 | More? | Yes. | 세션 8분까지 연장 |
| 5:00 | Pink cookie or blue cookie? | Pink cookie. | CHUNK |
| 6:00 | It's pink! | It's pink. | 자발/직전 모델 여부 판정 |
| 7:20 | Cats, pink, cookies! Fun! | 웃음/Yes | wrap-up 준비 |
| 7:45 | That was fun! Bye, Siha! | Bye! | ENDED |

검증 포인트: 5분 연장, 단답과 문장 균형, 화면 반응, Pattern A 재사용, 응답 latency.

## 시나리오 B — 이해가 어려운 날

목표: 대화를 중단하지 않고 support를 높인다.

| 시각 | AI | Child | 처리 |
|---:|---|---|---|
| 0:00 | Hi, Siha! Happy? | 응. | KOREAN+MATCH, 성공 |
| 0:20 | Cat or dog? | Cat. | MATCH |
| 0:40 | Big or small? | 뭐? | STRUGGLE, support 3 |
| 0:45 | 큰 고양이? 작은 고양이? Big or small? | Small. | MATCH, input 유지 |
| 1:10 | A small cat! Pink or blue? | Pink. | MATCH |
| 1:35 | Pink cat! I like pink. | 침묵 | 모델링 후 강요 없음 |
| 2:00 | Cookie or apple? | 모르겠어. | 이해 실패, 그림 표시 |
| 2:05 | 쿠키? 사과? Cookie or apple? | Cookie. | MATCH |
| 2:30 | Cookie! You like cookies! | 응. | 대화 진행 |
| 3:00 | Make it big! | 뭐? | 행동 이해 실패 |
| 3:05 | 크게 해볼까? Big? | Big. | 선택 성공 |
| 4:00 | More? | 아니. | 5분 종료 준비 |
| 4:30 | That was fun! Bye! | Bye. | ENDED |

검증 포인트: 한국어 답을 실패로 계산하지 않음, 같은 문장을 그대로 반복하지 않음, 5분에 종료.

## 시나리오 C — STT 오류와 거절

목표: 확인 1회 제한, 추측 방지, 따라 말하기 거절 존중.

| 시각 | AI | Child/인식 | 처리 |
|---:|---|---|---|
| 0:00 | Cat or dog? | Cat / `cat` | 수용 |
| 0:30 | What snack do you like? | 고래밥 / `forever` | mismatch + low confidence |
| 0:35 | I didn't hear. Say it once more? | 고래밥 / `for a bat` | repair 1회 소진 |
| 0:45 | Okay! Cookie or chips? | Cookie. | 선택형 전환, 추가 반복 없음 |
| 1:15 | Cookie! Say, “I like cookies”? | 싫어. | REFUSAL, 요구 취소 |
| 1:20 | Okay! Pink cookie or blue? | Pink. | 놀이 질문 |
| 2:00 | A pink cookie! Big or small? | Big. | 화면 반응 |
| 3:00 | Do you like cats? | I like cats. | spontaneous 증거 |
| 4:20 | More? | 그만할래. | STOP_REQUESTED |
| 4:25 | Okay! That was fun. Bye! | Bye. | 추가 질문 없이 ENDED |

검증 포인트: `Forever! Cool!` 금지, repair 최대 1회, 거절 후 5턴 내 shadow 금지, stop 최우선.

## 평가 레코드 요건

각 행은 다음을 포함한다.

```json
{
  "scenario": "uncertain_child_speech",
  "transcript": "forever",
  "expectedBehavior": ["ASK_ONCE", "DO_NOT_PRETEND_UNDERSTANDING"],
  "forbiddenOutputPatterns": ["Forever!", "Cool!"]
}
```

평가는 문구 완전 일치가 아니라 행동 기준으로 수행한다. 음성 세션마다 false interruption, perceived latency, instruction violation도 함께 기록한다.
