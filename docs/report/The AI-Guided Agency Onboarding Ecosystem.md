Strategic Blueprint: The AI-Guided Agency Onboarding Ecosystem

1. Strategic Vision: Transitionary Onboarding and Deep Understanding

The move from raw data collection to a high-fidelity "Agency Brain" requires a strategic shift toward a transitionary onboarding phase. This phase serves as the architectural foundation for the long-term agency partnership. Traditional form-based onboarding is deprecated in favor of a Conversational Ingestion model. This transition transforms static agency data into a "Deep Understanding" layer, utilizing an AI-guided interview to probe for operational nuances that standard forms miss. This interactive layer is the prerequisite for generating a personalized service layer, bridging the gap between initial data capture and robust, structured storage architecture.

2. UI/UX Architecture: The Professional Chat Interface

A high-end chat interface is a tactical requirement to mitigate user friction during complex data ingestion. The interface must facilitate dense information entry through manageable conversational beats.

Technical UI Components

The onboarding interface must implement the following core components:

* Message Stream: A chronological, read-only display of the dialogue, supporting markdown-rendered text and structured JSON outputs.
* Adaptive Input Field: A dynamic text area that adjusts validation rules based on the required data type (e.g., descriptive text vs. structured contact details).
* Suggestion Chip Tray: A horizontal scroll container for pre-calculated responses.

Smart Suggestion Logic and Interaction

The system must generate 3-4 personalized answer suggestions for every AI prompt.

* Contextual Generation: To prevent hallucination, the prompt for these suggestions must include the current JSON state of the "Agency Brain." Suggestions must be contextually derived from previously captured data.
* Interaction Logic:
  * Tap-to-Autofill: Hydrates the Adaptive Input Field with the chip's text, allowing for manual refinement before submission.
  * Tap-to-Send: Triggers an immediate POST to the ai-onboarding endpoint for rapid progression.

3. Interaction Logic: Adaptive Reasoning and System States

The implementation of "adaptive probing" is a strategic mandate to ensure data quality. The system must not merely accept inputs but analyze them against the defined schema using the logic found in src/ai/brainResolver.ts.

Adaptive Behavior Protocol

The AI Assistant must adhere to the following states and behaviors:

* State Resolution: The system invokes brainResolver.ts to evaluate the current dataset.
  * If the resolver returns ready, the AI moves to the next module.
  * If the resolver returns calibration_needed, the AI identifies missing or ambiguous fields and generates a follow-up question.
* Agency-Aware Questioning: The AI must transform standard onboarding questions into personalized prompts using captured variables (e.g., replacing "the agency" with "[Agency Name]" and "target niche" with "[Specific Niche]").
* Data Integrity: Interaction logic is strictly coupled to the structured storage requirements to ensure that only validated outcomes persist.

4. Data Persistence: The Agency Brain and Schema Enforcement

Data persistence is handled by the "Agency Brain" module, designed to ensure AI consistency and maintain the security invariant of 0 cross-tenant leaks.

The Agency Brain Architecture

The "Brain" stores information across three distinct layers:

* Personality Vectors: Stores the AI’s identity, including the assigned name, expertise, and tone traits.
* JSON Structured Answers: Finalized, schema-validated agency data (niche, service offerings, KPIs).
* Raw Chat Logs: Maintaining the episodic history for future reference and context retrieval.

Schema Enforcement and Repair Pass

The system must utilize src/ai/router.ts and taskRegistry.ts to enforce JSON schema validation.

* The Repair Pass: If the AI output fails schema validation, the router must trigger a "repair pass" to re-format the output.
* UNKNOWN Fallbacks: The router handles UNKNOWN rules when required context is missing, ensuring the system does not fail silently.

5. Backend Integration: Supabase Edge Functions and Dual-Embedding Strategy

The onboarding workflow leverages the existing Supabase Edge Function stack to maintain security and performance.

Onboarding Workflow Mapping

Component	Task/TaskType	Outcome
ai-onboarding	CLASSIFY_INTENT / PLANNER	Routes user input and generates next conversational step.
ai-brain-ingest	EMBED_TEXT	Populates ai_documents and ai_document_chunks.
AI Setup Page	N/A	Updates UI with custom "Agency Brain" values.

Technical Security Mandates

* Dual-Embedding Strategy: All "Agency Brain" data must be stored in two formats to ensure future-proofing:
  1. ai_embeddings: Standard 1536-dimension vectors.
  2. ai_embeddings_shadow_gemini_vector: 768-dimension vectors for Phase 2 cutover readiness.
* Security Invariant: All calls to the match_ai_embeddings_scoped RPC must be handled via the service_role within the Edge Function. This prevents direct client-side exploitation and ensures retrieval is strictly filtered by agency_id.

6. Identity & Personality: Custom Persona Injection

Implementation of dynamic identity injection is required to move the AI from a general tool to an integrated agency representative.

Personality Configuration Workflow

1. Default State: All instances initialize with the "Alex" default persona.
2. Custom Configuration: During onboarding, users define the Assistant's Name, Tone, and Expertise. These overwrite the "Alex" configurations in the Personality Vectors layer.
3. Identity Adoption: Upon completion of onboarding, the system must:
  * Update ai_onboarding_status to "complete."
  * Trigger a cache invalidation for the Assistant's system prompt.
  * Reload the prompt using the custom traits stored in the "Agency Brain."

7. Governance, Observability, and Quality Assurance

Strategic observability is necessary for refining the onboarding experience and ensuring data integrity.

Monitoring and Observability

Technical oversight is maintained through the following:

* ai_otel_spans: Every onboarding interaction must be logged for latency and performance metrics.
* ai_runs: Records structured logs of model calls and outcomes for debugging the reasoning engine.

Security Mandate: Tenant Scoping

The system must enforce tenant scoping by agency_id at the database level. Direct access to "Agency Brain" data without a validated agency_id is a critical security failure.

Definition of Done (DoD)

The builder has successfully implemented the system when:

1. The "Agency Brain" contains a fully validated, non-null JSON dataset.
2. The AI Assistant successfully adopts the custom name and personality traits immediately after onboarding.
3. match_ai_embeddings_scoped confirms zero cross-tenant visibility through service_role filtered retrieval.
