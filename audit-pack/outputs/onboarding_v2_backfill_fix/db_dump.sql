SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict 0LnwTkvKnWkqxiNG6H0ys2gr1drJTkZbXow6IYbT0fGbeIcEQF7zFdXsJFpybwm

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: agencies; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."agencies" ("id", "user_id", "name", "created_at", "updated_at", "website", "niche") VALUES
	('8a899ca1-0899-49e0-baa0-26ae096abd5a', 'c3b7eb1e-ca20-4ecb-8ee7-b4658f91c35d', 'Seed Agency', '2025-12-23 13:08:18.460914+00', '2025-12-23 13:08:18.460914+00', 'https://seed-agency.example.com', 'SaaS'),
	('e920c3c8-b525-4309-8269-1c90eeb003c3', '3263f22f-bdce-4cb2-a5ba-cd8a1d17c639', 'Seed Agency', '2025-12-23 13:08:56.064658+00', '2025-12-23 13:08:56.064658+00', 'https://seed-agency.example.com', 'SaaS');


--
-- Data for Name: agency_members; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."agency_members" ("id", "agency_id", "user_id", "role", "created_at", "invited_by", "accepted_at") VALUES
	('859ff9c5-a43c-43ff-9a51-a1e11af596eb', '8a899ca1-0899-49e0-baa0-26ae096abd5a', 'c3b7eb1e-ca20-4ecb-8ee7-b4658f91c35d', 'owner', '2025-12-23 13:08:18.466719+00', NULL, NULL),
	('84b7b3b9-2c25-4293-b31b-39eac29a2fec', 'e920c3c8-b525-4309-8269-1c90eeb003c3', '3263f22f-bdce-4cb2-a5ba-cd8a1d17c639', 'owner', '2025-12-23 13:08:56.070112+00', NULL, NULL);


--
-- Data for Name: clients; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."clients" ("id", "agency_id", "name", "email", "phone", "company", "status", "created_at", "updated_at", "logo_url", "brand_colors", "website", "notes", "niche", "tone_of_voice", "primary_font", "secondary_font", "portal_enabled", "portal_slug", "portal_user_id") VALUES
	('f6ac6d62-4535-4adc-9dc3-9f45ec594af3', 'e920c3c8-b525-4309-8269-1c90eeb003c3', 'Seed Client', NULL, NULL, NULL, 'active', '2025-12-23 13:08:56.07408+00', '2025-12-23 13:08:56.07408+00', NULL, '[]', 'https://seed-client.example.com', 'Seed notes for backfill.', 'B2B', 'Confident', NULL, NULL, false, NULL, NULL);


--
-- Data for Name: assets; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: client_users; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: ideas; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: scripts; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: projects; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: activity_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: ad_accounts; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: ad_campaigns; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: ad_insights; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: agency_brains; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."agency_brains" ("id", "agency_id", "version", "status", "locked", "brain_json", "json_diff", "confidence", "created_at", "updated_at") VALUES
	('ad7fa0a5-6550-47e0-9523-37714a66ee09', '8a899ca1-0899-49e0-baa0-26ae096abd5a', 1, 'draft', false, '{"faq": [], "icp": {"size": [], "pains": [], "personas": [], "industries": ["SaaS"], "objections": []}, "identity": {"geo": [], "name": "Seed Agency", "niches": ["SaaS"], "offers": [], "languages": []}, "voice_tone": {"adjectives": [], "banned_words": [], "writing_rules": [], "preferred_vocab": []}, "gold_examples": [], "process_rules": {"approvals": "", "revisions": "", "escalation_rules": ""}, "raw_responses": {"legacy_agency_name": "Seed Agency", "legacy_agency_niche": "SaaS", "legacy_agency_website": "https://seed-agency.example.com"}, "safety_policy": {"avoid": [], "allowed": [], "compliance_notes": []}, "strategy_defaults": {"pillars": [], "cta_styles": [], "hook_styles": [], "platform_formats": []}, "inference_metadata": {"fields": {"name": true, "niche": true, "website": true}, "source": "legacy_onboarding"}}', NULL, 12, '2025-12-23 13:09:19.89271+00', '2025-12-23 13:09:19.89271+00'),
	('8e7b8bdd-6a80-41a5-ad19-ff6ee4da4bc1', 'e920c3c8-b525-4309-8269-1c90eeb003c3', 1, 'usable', false, '{"faq": [{"answer": "Seed answer", "question": "FAQ 1"}, {"answer": "Seed answer", "question": "FAQ 2"}, {"answer": "Seed answer", "question": "FAQ 3"}, {"answer": "Seed answer", "question": "FAQ 4"}, {"answer": "Seed answer", "question": "FAQ 5"}, {"answer": "Seed answer", "question": "FAQ 6"}, {"answer": "Seed answer", "question": "FAQ 7"}, {"answer": "Seed answer", "question": "FAQ 8"}, {"answer": "Seed answer", "question": "FAQ 9"}, {"answer": "Seed answer", "question": "FAQ 10"}], "icp": {"size": ["11-50"], "pains": ["Lead gen"], "personas": ["Founder"], "industries": ["SaaS"], "objections": ["Price"]}, "identity": {"geo": ["US"], "name": "Seed Agency", "niches": ["SaaS"], "offers": ["Strategy", "Content"], "languages": ["English"]}, "voice_tone": {"adjectives": ["Clear", "Bold", "Direct", "Friendly", "Premium"], "banned_words": ["cheap"], "writing_rules": ["Short sentences"], "preferred_vocab": ["growth"]}, "gold_examples": [{"title": "Example 1", "content": "Seed content", "why_good": "Clear structure"}, {"title": "Example 2", "content": "Seed content", "why_good": "Clear structure"}, {"title": "Example 3", "content": "Seed content", "why_good": "Clear structure"}, {"title": "Example 4", "content": "Seed content", "why_good": "Clear structure"}, {"title": "Example 5", "content": "Seed content", "why_good": "Clear structure"}], "process_rules": {"approvals": "Manager approval", "revisions": "2 rounds", "escalation_rules": "Escalate after 2 rejections"}, "raw_responses": {"legacy_agency_name": "Seed Agency", "legacy_agency_niche": "SaaS", "legacy_agency_website": "https://seed-agency.example.com"}, "safety_policy": {"avoid": ["Guarantees"], "allowed": ["General claims"], "compliance_notes": ["No medical claims"]}, "strategy_defaults": {"pillars": ["Education"], "cta_styles": ["Book a call"], "hook_styles": ["Question"], "platform_formats": ["LinkedIn"]}, "inference_metadata": {"fields": {"name": true, "niche": true, "website": true}, "source": "legacy_onboarding"}}', NULL, 100, '2025-12-23 13:09:19.907675+00', '2025-12-23 13:09:19.907675+00');


--
-- Data for Name: agency_invites; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: agency_invite_email_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: ai_budgets; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: ai_documents; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."ai_documents" ("id", "agency_id", "client_id", "doc_type", "title", "content", "extracted_text", "source", "source_url", "file_ref", "file_name", "file_size_mb", "mime_type", "metadata", "created_at", "updated_at") VALUES
	('6aa2c51c-a43c-47d9-bcfe-d3fab507d055', 'e920c3c8-b525-4309-8269-1c90eeb003c3', NULL, 'agency_sop', 'Seed Agency SOP', 'Seed agency backfill payload', NULL, '{"source_ref": "dev_backfill_seed", "source_type": "seed"}', NULL, NULL, NULL, NULL, NULL, '{"backfill_payload": {"faq": [{"answer": "Seed answer", "question": "FAQ 1"}, {"answer": "Seed answer", "question": "FAQ 2"}, {"answer": "Seed answer", "question": "FAQ 3"}, {"answer": "Seed answer", "question": "FAQ 4"}, {"answer": "Seed answer", "question": "FAQ 5"}, {"answer": "Seed answer", "question": "FAQ 6"}, {"answer": "Seed answer", "question": "FAQ 7"}, {"answer": "Seed answer", "question": "FAQ 8"}, {"answer": "Seed answer", "question": "FAQ 9"}, {"answer": "Seed answer", "question": "FAQ 10"}], "icp": {"size": ["11-50"], "pains": ["Lead gen"], "personas": ["Founder"], "industries": ["SaaS"], "objections": ["Price"]}, "identity": {"geo": ["US"], "name": "Seed Agency", "niches": ["SaaS"], "offers": ["Strategy", "Content"], "languages": ["English"]}, "voice_tone": {"adjectives": ["Clear", "Bold", "Direct", "Friendly", "Premium"], "banned_words": ["cheap"], "writing_rules": ["Short sentences"], "preferred_vocab": ["growth"]}, "gold_examples": [{"title": "Example 1", "content": "Seed content", "why_good": "Clear structure"}, {"title": "Example 2", "content": "Seed content", "why_good": "Clear structure"}, {"title": "Example 3", "content": "Seed content", "why_good": "Clear structure"}, {"title": "Example 4", "content": "Seed content", "why_good": "Clear structure"}, {"title": "Example 5", "content": "Seed content", "why_good": "Clear structure"}], "process_rules": {"approvals": "Manager approval", "revisions": "2 rounds", "escalation_rules": "Escalate after 2 rejections"}, "safety_policy": {"avoid": ["Guarantees"], "allowed": ["General claims"], "compliance_notes": ["No medical claims"]}, "strategy_defaults": {"pillars": ["Education"], "cta_styles": ["Book a call"], "hook_styles": ["Question"], "platform_formats": ["LinkedIn"]}}}', '2025-12-23 13:08:56.078628+00', '2025-12-23 13:08:56.078628+00'),
	('f6b97806-45a1-46a0-b7e3-d75c181f33c0', 'e920c3c8-b525-4309-8269-1c90eeb003c3', 'f6ac6d62-4535-4adc-9dc3-9f45ec594af3', 'client_guidelines', 'Seed Client Guidelines', 'Seed client backfill payload', NULL, '{"source_ref": "dev_backfill_seed", "source_type": "seed"}', NULL, NULL, NULL, NULL, NULL, '{"backfill_payload": {"faq": [{"answer": "Seed answer", "question": "Client FAQ 1"}, {"answer": "Seed answer", "question": "Client FAQ 2"}, {"answer": "Seed answer", "question": "Client FAQ 3"}, {"answer": "Seed answer", "question": "Client FAQ 4"}, {"answer": "Seed answer", "question": "Client FAQ 5"}, {"answer": "Seed answer", "question": "Client FAQ 6"}, {"answer": "Seed answer", "question": "Client FAQ 7"}, {"answer": "Seed answer", "question": "Client FAQ 8"}, {"answer": "Seed answer", "question": "Client FAQ 9"}, {"answer": "Seed answer", "question": "Client FAQ 10"}], "pillars": [{"name": "Education", "examples": ["How-to content"]}, {"name": "Social proof", "examples": ["Case studies"]}, {"name": "Product", "examples": ["Feature highlights"]}], "audience": {"intent": ["Pipeline growth"], "location": ["US"], "problems": ["Low awareness"], "objections": ["Budget"], "demographics": ["Founders"]}, "competitors": [{"name": "Competitor 1", "notes": "Strong brand"}, {"name": "Competitor 2", "notes": "Low price"}, {"name": "Competitor 3", "notes": "Niche focus"}], "constraints": {"dos": ["Use approved CTAs"], "donts": ["No medical claims"], "taboo_topics": ["Politics"], "banned_claims": ["Guarantees"], "legal_constraints": ["No financial promises"]}, "assets_links": {"key_urls": ["https://seed-client.example.com/guide"], "guidelines_link": "https://seed-client.example.com/brand"}, "brand_basics": {"name": "Seed Client", "tone": "Confident", "socials": ["https://linkedin.com/company/seed-client"], "website": "https://seed-client.example.com", "differentiators": ["Fast delivery"]}, "offer_details": {"usps": ["ROI focused"], "products_services": ["B2B SaaS"]}}}', '2025-12-23 13:08:56.082103+00', '2025-12-23 13:08:56.082103+00'),
	('02bbe9e1-6fe4-47bd-ab47-7c19d6ff98d0', '8a899ca1-0899-49e0-baa0-26ae096abd5a', NULL, 'agency_sop', 'Legacy agency website', 'https://seed-agency.example.com', NULL, '{"source_ref": "legacy_onboarding", "source_type": "system"}', NULL, NULL, NULL, NULL, NULL, '{"field": "website", "source": "legacy_onboarding"}', '2025-12-23 13:09:19.899436+00', '2025-12-23 13:09:19.899436+00'),
	('96598a1e-18be-4ebb-b42f-3df6a64f182c', 'e920c3c8-b525-4309-8269-1c90eeb003c3', NULL, 'agency_sop', 'Legacy agency website', 'https://seed-agency.example.com', NULL, '{"source_ref": "legacy_onboarding", "source_type": "system"}', NULL, NULL, NULL, NULL, NULL, '{"field": "website", "source": "legacy_onboarding"}', '2025-12-23 13:09:19.913507+00', '2025-12-23 13:09:19.913507+00'),
	('5826e38b-1ea2-4fe8-be83-ae288a59d1f5', 'e920c3c8-b525-4309-8269-1c90eeb003c3', 'f6ac6d62-4535-4adc-9dc3-9f45ec594af3', 'client_notes', 'Legacy client notes', 'Seed notes for backfill.', NULL, '{"source_ref": "legacy_onboarding", "source_type": "system"}', NULL, NULL, NULL, NULL, NULL, '{"field": "notes", "source": "legacy_onboarding"}', '2025-12-23 13:09:19.937153+00', '2025-12-23 13:09:19.937153+00');


--
-- Data for Name: ai_document_chunks; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: ai_embeddings; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: ai_escalations; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: ai_generation_usage; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: ai_history; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: ai_prompt_registry; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."ai_prompt_registry" ("id", "name", "version", "status", "task_type", "model", "max_tokens", "template", "notes", "created_at") VALUES
	('1a21a035-4d6d-441a-b24c-5a94557d26ff', 'Answer Quality Check', 1, 'active', 'answer_quality_check', 'CHEAP_MODEL', 6000, 'quality_check_v1', 'Sprint 1 default', '2025-12-23 13:07:52.622359+00'),
	('6c1d90dc-a9ff-4f10-a153-3bbe74cf5dd2', 'RAG Ask', 1, 'active', 'rag_ask', 'STRONG_MODEL', 6000, 'rag_ask_v1', 'Sprint 1 default', '2025-12-23 13:07:52.622359+00');


--
-- Data for Name: ai_rate_limits; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: ai_runs; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: asset_versions; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: approval_tasks; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: asset_comments; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: captions; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: client_assets; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: client_brains; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."client_brains" ("id", "agency_id", "client_id", "version", "status", "locked", "brain_json", "json_diff", "confidence", "created_at", "updated_at") VALUES
	('73ee80c4-db50-433a-831f-6dfc03d06aa2', 'e920c3c8-b525-4309-8269-1c90eeb003c3', 'f6ac6d62-4535-4adc-9dc3-9f45ec594af3', 1, 'usable', false, '{"faq": [{"answer": "Seed answer", "question": "Client FAQ 1"}, {"answer": "Seed answer", "question": "Client FAQ 2"}, {"answer": "Seed answer", "question": "Client FAQ 3"}, {"answer": "Seed answer", "question": "Client FAQ 4"}, {"answer": "Seed answer", "question": "Client FAQ 5"}, {"answer": "Seed answer", "question": "Client FAQ 6"}, {"answer": "Seed answer", "question": "Client FAQ 7"}, {"answer": "Seed answer", "question": "Client FAQ 8"}, {"answer": "Seed answer", "question": "Client FAQ 9"}, {"answer": "Seed answer", "question": "Client FAQ 10"}], "pillars": [{"name": "Education", "examples": ["How-to content"]}, {"name": "Social proof", "examples": ["Case studies"]}, {"name": "Product", "examples": ["Feature highlights"]}], "audience": {"intent": ["Pipeline growth"], "location": ["US"], "problems": ["Low awareness"], "objections": ["Budget"], "demographics": ["Founders"]}, "competitors": [{"name": "Competitor 1", "notes": "Strong brand"}, {"name": "Competitor 2", "notes": "Low price"}, {"name": "Competitor 3", "notes": "Niche focus"}], "constraints": {"dos": ["Use approved CTAs"], "donts": ["No medical claims"], "taboo_topics": ["Politics"], "banned_claims": ["Guarantees"], "legal_constraints": ["No financial promises"]}, "assets_links": {"key_urls": ["https://seed-client.example.com/guide"], "guidelines_link": "https://seed-client.example.com/brand", "lead_magnet_optional": ""}, "brand_basics": {"name": "Seed Client", "tone": "Confident", "socials": ["https://linkedin.com/company/seed-client"], "website": "https://seed-client.example.com", "differentiators": ["Fast delivery"]}, "offer_details": {"usps": ["ROI focused"], "pricing_optional": "", "products_services": ["B2B SaaS"]}, "raw_responses": {"legacy_brand_tone": "", "legacy_brand_voice": "", "legacy_client_notes": "Seed notes for backfill."}, "inference_metadata": {"fields": {"name": true, "notes": true, "assets": 0, "pillars": 0, "website": true, "brand_tone": false, "brand_voice": false, "brand_guidelines": false}, "source": "legacy_onboarding"}}', NULL, 100, '2025-12-23 13:09:19.932636+00', '2025-12-23 13:09:19.932636+00');


--
-- Data for Name: client_branding; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: client_hashtags; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: client_invites; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: client_refresh_tokens; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: client_reports; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: client_uploads; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: content_activities; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: conversations; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: conversation_participants; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: message_read_receipts; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: metrics_sync_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: notification_preferences; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: pipeline_comments; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: social_connections; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: scheduled_posts; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: post_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."profiles" ("id", "email", "full_name", "created_at", "updated_at", "timezone") VALUES
	('c3b7eb1e-ca20-4ecb-8ee7-b4658f91c35d', 'dev-backfill-seed@example.com', NULL, '2025-12-23 13:08:18.444031+00', '2025-12-23 13:08:18.444031+00', 'UTC'),
	('3263f22f-bdce-4cb2-a5ba-cd8a1d17c639', 'dev-backfill-seed-a317a41d-64bb-4e96-8ed1-8a1d7323a730@example.com', NULL, '2025-12-23 13:08:56.048652+00', '2025-12-23 13:08:56.048652+00', 'UTC');


--
-- Data for Name: project_activities; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: project_assets; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: project_failure_tracking; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: social_post_metrics; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: social_profile_stats; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: social_profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: subscriptions; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: task_templates; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: tasks; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: team_members; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: token_refresh_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."user_roles" ("id", "user_id", "role", "created_at") VALUES
	('43a7010c-ccf6-47b7-848c-0460eb3a3d80', 'c3b7eb1e-ca20-4ecb-8ee7-b4658f91c35d', 'owner', '2025-12-23 13:08:18.460914+00'),
	('5e2f2ad1-23f7-4c42-b10f-31d6ed61d3b2', '3263f22f-bdce-4cb2-a5ba-cd8a1d17c639', 'owner', '2025-12-23 13:08:56.064658+00');


--
-- Data for Name: waitlist_subscribers; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- PostgreSQL database dump complete
--

-- \unrestrict 0LnwTkvKnWkqxiNG6H0ys2gr1drJTkZbXow6IYbT0fGbeIcEQF7zFdXsJFpybwm

RESET ALL;
