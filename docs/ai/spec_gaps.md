# Spec Gaps / TODO

1) Define canonical routing criteria for the admin chat playbooks beyond keyword heuristics.
2) Confirm which setup_profile_v1 fields are authoritative for positioning, proof, and constraints.
3) Specify how client context should be selected for admin chat (currently client_profile is null).
4) Clarify whether clarifying question caps should be tracked per thread or across all admin chat sessions.
5) Confirm expected pricing format (currency, ranges) for default tiers.
6) Confirm stage transition rules for admin_chat_state_v1 (discover/define/design/decide/deliver mapping).
7) Confirm max character budgets for memory_snippets total chars and open_questions cap.
8) Confirm desired production behavior for missing/empty prompt files (currently throws).
