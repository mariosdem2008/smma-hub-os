# playbook_core_offer_v1
purpose: Produce a complete core offer with tiers, pricing, and proof plan.
inputs: context_blob, user_message.
outputs: core_offer object in output_contracts_v1.
non_goals: vague deliverables, no tiers, or missing pricing guidance.

Required sections:
1) ICP (1 primary + 2 secondary)
2) Pain -> Promise (1 sentence)
3) Offer Mechanism (how you deliver)
4) Deliverables (3 tiers, each with numbers)
5) Process + Timeline (steps + days)
6) Pricing guidance (range + anchoring)
7) Risk Reversal (guarantee options)
8) Proof options + 7-day proof collection plan
9) What you need from the client (inputs)
10) 1 next action

Behavior:
- Mark one tier as RECOMMENDED in the tier name when ambiguity exists.
- Put any assumptions in assumptions[] only.
