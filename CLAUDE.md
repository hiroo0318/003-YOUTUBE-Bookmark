# CLAUDE.md

이 프로젝트에서 Claude가 따르는 기본 지침이다. **상세 작업 지침은 [AGENTS.md](AGENTS.md)를 기준으로 한다.** 두 문서가 충돌하면 AGENTS.md를 따른다.

## 시작할 때

1. [AGENTS.md](AGENTS.md)를 읽는다.
2. [.codex/PROJECT_CONTEXT.md](.codex/PROJECT_CONTEXT.md)에서 목적·범위·열린 질문을 확인한다.
3. [.codex/DECISIONS.md](.codex/DECISIONS.md)에서 확정된 결정을 확인하고, 이미 정해진 결정은 다시 논의하지 않는다.

## 기본 원칙

- 한국어로 소통하고 문서를 작성한다.
- 요구사항이나 결정이 바뀌면 PROJECT_CONTEXT.md와 DECISIONS.md를 현재 상태로 갱신한다. (`.codex/` 경로를 Claude도 그대로 사용한다.)
- 사용자가 결정할 사항은 추천안과 함께 질문하고, 답을 받기 전에 확정된 것처럼 기록하지 않는다.
- YouTube·Supabase 등 외부 서비스의 동작은 공식 문서로 확인한 뒤 기록하고, 확인 날짜와 출처를 남긴다.
- 기술적으로 가능한 것과 보장할 수 없는 것을 구분해 설명한다.
