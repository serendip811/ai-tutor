# 시하 AI 영어친구

영어를 어느 정도 알아듣지만 스스로 말하기 어려운 6~8세 아이가, 이미 아는 단어와 표현을 사용해 짧은 영어 발화 성공 경험을 쌓는 음성 대화 서비스입니다.

## 제품 원칙

> 시스템이 지금 해야 할 대화 행동을 결정하고, LLM은 허용된 범위에서 그 행동을 자연스럽게 표현한다.

- 새 영어를 많이 가르치기보다 이미 아는 영어를 말하게 한다.
- 아이의 한국어 답변은 실패가 아니라 이해 여부를 보여주는 정보다.
- 한 번의 실패 뒤에는 더 쉬운 선택지로 대화를 살린다.
- 점수보다 아이의 발화, 자발적 사용, 부담 없는 지속을 측정한다.
- 아이가 영어로 말하면 캐릭터와 화면 세계가 의미 있게 반응한다.

## 문서

- [개발 제품 명세](docs/PRODUCT_SPEC.md)
- [대화 엔진 명세](docs/CONVERSATION_ENGINE.md)
- [API 및 AI JSON 계약](docs/API_AND_AI_CONTRACTS.md)
- [데이터 모델](docs/DATA_MODEL.md)
- [화면 및 UX 명세](docs/UX_SPEC.md)
- [8분 세션 시나리오](docs/SESSION_SCENARIOS.md)
- [MVP 구현 계획](docs/IMPLEMENTATION_PLAN.md)

## MVP 범위

- 음성 중심 5~8분 세션
- 캐릭터 1개
- 주제 5개: Animals, Colors, Food, Toys, Today
- 목표 패턴 5개: `I like ___`, `It's ___`, `I want ___`, `Yes, I do`, `No, I don't`
- 한국어 힌트, 그림 선택지, 단답 확장
- 듣기·말하기·지원 수준의 독립 조정
- 부모용 세션 리포트 및 선택적 대화 기록

## 구현 시작 기준

개발자는 먼저 `CONVERSATION_ENGINE.md`와 `API_AND_AI_CONTRACTS.md`의 순수 함수형 Controller를 구현하고, 녹음·STT·LLM을 붙이기 전에 시나리오 기반 자동 테스트를 통과시켜야 합니다.

