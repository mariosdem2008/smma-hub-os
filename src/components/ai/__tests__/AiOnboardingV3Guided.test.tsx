import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AiOnboardingV3Guided } from "../AiOnboardingV3Guided";
import { BrowserRouter } from "react-router-dom";
import { mapV3AnswersToClientBrain } from "../../../../supabase/functions/_shared/client-brain-mapping";

// Mock supabase at module level
const mockInvoke = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();
const mockInsert = vi.fn();
const mockSingle = vi.fn();
const mockUpdate = vi.fn();
const mockGetUser = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (...args: any[]) => mockInvoke(...args)
    },
    from: (table: string) => ({
      select: (...args: any[]) => {
        mockSelect(table, ...args);
        return {
          eq: (...args: any[]) => {
            mockEq(...args);
            return {
              maybeSingle: () => mockMaybeSingle(),
              single: () => mockSingle()
            };
          }
        };
      },
      insert: (...args: any[]) => {
        mockInsert(...args);
        return {
          select: () => ({
            single: () => mockSingle()
          })
        };
      },
      update: (...args: any[]) => {
        mockUpdate(...args);
        return {
          eq: () => ({ error: null })
        };
      }
    }),
    auth: {
      getUser: () => mockGetUser()
    }
  }
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

describe("AiOnboardingV3Guided", () => {
  const defaultProps = {
    agencyId: "agency-123",
    clientId: "client-456",
    onboardingType: "client" as const
  };

  function setupInvokeSequence(responses: any[]) {
    let callCount = 0;
    mockInvoke.mockImplementation(() => {
      const response = responses[callCount] || responses[responses.length - 1];
      callCount++;
      return Promise.resolve(response);
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();

    // Default auth
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders loading state initially", async () => {
    // Set up mock sequence for initialization
    setupInvokeSequence([
      { data: { brain: { id: "brain-789" } }, error: null }, // brain create
      { data: { step_id: "brand_basics" }, error: null } // step load
    ]);

    // No existing session
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockSingle.mockResolvedValue({
      data: { id: "session-123", step_id: "brand_basics" },
      error: null
    });

    render(
      <BrowserRouter>
        <AiOnboardingV3Guided {...defaultProps} />
      </BrowserRouter>
    );

    // Should show loader initially (using Loader2 icon, not progressbar role)
    const loader = document.querySelector('.animate-spin');
    expect(loader).toBeInTheDocument();

    // Wait for it to load the step
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalled();
    }, { timeout: 3000 });
  });

  it("loads first step with brand_basics", async () => {
    setupInvokeSequence([
      { data: { brain: { id: "brain-789" } }, error: null },
      {
        data: {
          step_id: "brand_basics",
          assistant_message: "Let's start with the basics. What's your client's brand name and website?",
          input_type: "short_text",
          constraints: { required: true, min: 2 },
          progress_percent: 11,
          can_lock: false
        },
        error: null
      }
    ]);

    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockSingle.mockResolvedValue({
      data: { id: "session-123", step_id: "brand_basics" },
      error: null
    });

    render(
      <BrowserRouter>
        <AiOnboardingV3Guided {...defaultProps} />
      </BrowserRouter>
    );

    // Use findBy for async content
    const message = await screen.findByText(/Let's start with the basics/i);
    expect(message).toBeInTheDocument();

    const brandInput = await screen.findByLabelText(/Brand Name/i);
    const websiteInput = await screen.findByLabelText(/Website URL/i);

    expect(brandInput).toBeInTheDocument();
    expect(websiteInput).toBeInTheDocument();
  });

  it("validates brand_basics input and shows errors", async () => {
    const user = userEvent.setup();

    setupInvokeSequence([
      { data: { brain: { id: "brain-789" } }, error: null },
      {
        data: {
          step_id: "brand_basics",
          assistant_message: "Let's start with the basics.",
          input_type: "short_text",
          constraints: { required: true, min: 2 },
          progress_percent: 11,
          can_lock: false
        },
        error: null
      },
      { data: {}, error: null }, // brain update
      {
        data: {
          step_id: "brand_basics",
          assistant_message: "Let's start with the basics.",
          input_type: "short_text",
          constraints: { required: true, min: 2 },
          validation_errors: ["Brand name must be at least 2 characters", "Please enter a valid website URL"],
          progress_percent: 11,
          can_lock: false
        },
        error: null
      }
    ]);

    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockSingle.mockResolvedValue({
      data: { id: "session-123", step_id: "brand_basics" },
      error: null
    });

    render(
      <BrowserRouter>
        <AiOnboardingV3Guided {...defaultProps} />
      </BrowserRouter>
    );

    await screen.findByText(/Let's start with the basics/i);

    // Enter invalid input to trigger server-side validation
    // (valid enough to pass client-side check, but fails server constraints)
    const brandInput = await screen.findByLabelText(/Brand Name/i);
    const websiteInput = await screen.findByLabelText(/Website URL/i);

    await user.type(brandInput, "A"); // 1 char, fails min: 2
    await user.type(websiteInput, "x"); // invalid URL

    const nextButtons = await screen.findAllByRole("button", { name: /Next/i });
    const nextButton = nextButtons[nextButtons.length - 1]; // Get the last one (active)

    await user.click(nextButton);

    // Wait for validation error
    const error = await screen.findByText(/Brand name must be at least 2 characters/i);
    expect(error).toBeInTheDocument();
  });

  it("renders multi_select step with options", async () => {
    setupInvokeSequence([
      { data: { brain: { id: "brain-789" } }, error: null },
      {
        data: {
          step_id: "offers",
          assistant_message: "Which of these offerings should we focus on?",
          input_type: "multi_select",
          options: [
            { id: "service1", label: "Social media management" },
            { id: "service2", label: "Content creation" }
          ],
          constraints: { required: true, min: 1, max: 3 },
          progress_percent: 33,
          can_lock: false
        },
        error: null
      }
    ]);

    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockSingle.mockResolvedValue({
      data: { id: "session-123", step_id: "brand_basics" },
      error: null
    });

    render(
      <BrowserRouter>
        <AiOnboardingV3Guided {...defaultProps} />
      </BrowserRouter>
    );

    const message = await screen.findByText(/Which of these offerings/i);
    expect(message).toBeInTheDocument();

    const option1 = await screen.findByText("Social media management");
    const option2 = await screen.findByText("Content creation");

    expect(option1).toBeInTheDocument();
    expect(option2).toBeInTheDocument();
  });

  it("handles selection in chips input", async () => {
    const user = userEvent.setup();

    setupInvokeSequence([
      { data: { brain: { id: "brain-789" } }, error: null },
      {
        data: {
          step_id: "differentiators",
          assistant_message: "What makes this brand stand out?",
          input_type: "chips",
          options: [
            { id: "diff1", label: "Premium quality" },
            { id: "diff2", label: "Customer service" }
          ],
          constraints: { required: true, min: 2, max: 4 },
          progress_percent: 55,
          can_lock: false
        },
        error: null
      }
    ]);

    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockSingle.mockResolvedValue({
      data: { id: "session-123", step_id: "brand_basics" },
      error: null
    });

    render(
      <BrowserRouter>
        <AiOnboardingV3Guided {...defaultProps} />
      </BrowserRouter>
    );

    await screen.findByText(/What makes this brand stand out/i);

    const chip1 = await screen.findByText("Premium quality");
    const chip2 = await screen.findByText("Customer service");

    await user.click(chip1);
    await user.click(chip2);

    await waitFor(() => {
      const nextButtons = screen.queryAllByRole("button", { name: /Next/i });
      const nextButton = nextButtons[nextButtons.length - 1];
      expect(nextButton).not.toBeDisabled();
    });
  });

  it("blocks proceed when missing OPENAI_API_KEY", async () => {
    setupInvokeSequence([
      { data: { brain: { id: "brain-789" } }, error: null },
      {
        data: null,
        error: { message: "AI service unavailable (missing API key). Contact support." }
      }
    ]);

    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockSingle.mockResolvedValue({
      data: { id: "session-123", step_id: "brand_basics" },
      error: null
    });

    render(
      <BrowserRouter>
        <AiOnboardingV3Guided {...defaultProps} />
      </BrowserRouter>
    );

    // Should not show the step content
    await waitFor(() => {
      expect(screen.queryByText(/Let's start with the basics/i)).not.toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it("saves progress to client_onboarding_sessions", async () => {
    const user = userEvent.setup();

    setupInvokeSequence([
      { data: { brain: { id: "brain-789" } }, error: null },
      {
        data: {
          step_id: "brand_basics",
          assistant_message: "Let's start",
          input_type: "short_text",
          constraints: { required: true },
          progress_percent: 11,
          can_lock: false
        },
        error: null
      },
      { data: {}, error: null }, // brain update
      {
        data: {
          step_id: "niche",
          assistant_message: "Next step",
          input_type: "single_select",
          options: [],
          progress_percent: 22,
          can_lock: false
        },
        error: null
      }
    ]);

    mockMaybeSingle.mockResolvedValue({
      data: {
        id: "session-123",
        step_id: "brand_basics",
        answers_json: {}
      },
      error: null
    });

    mockSingle.mockResolvedValue({
      data: { id: "session-123" },
      error: null
    });

    render(
      <BrowserRouter>
        <AiOnboardingV3Guided {...defaultProps} />
      </BrowserRouter>
    );

    const brandInput = await screen.findByLabelText(/Brand Name/i);
    const websiteInput = await screen.findByLabelText(/Website URL/i);

    await user.type(brandInput, "Test Brand");
    await user.type(websiteInput, "https://test.com");

    const nextButtons = await screen.findAllByRole("button", { name: /Next/i });
    const nextButton = nextButtons[nextButtons.length - 1];
    await user.click(nextButton);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  it("resumes from existing session", async () => {
    setupInvokeSequence([
      { data: { brain: { id: "brain-789" } }, error: null },
      {
        data: {
          step_id: "offers",
          assistant_message: "Which offerings?",
          input_type: "multi_select",
          options: [
            { id: "service1", label: "Social media management" }
          ],
          progress_percent: 33,
          can_lock: false
        },
        error: null
      }
    ]);

    mockMaybeSingle.mockResolvedValue({
      data: {
        id: "session-123",
        step_id: "offers",
        brain_id: "brain-789",
        answers_json: {
          brand: "Existing Brand",
          website: "https://existing.com",
          niche: "ecommerce"
        }
      },
      error: null
    });

    render(
      <BrowserRouter>
        <AiOnboardingV3Guided {...defaultProps} />
      </BrowserRouter>
    );

    // Should resume from offers step
    const message = await screen.findByText(/Which offerings/i);
    expect(message).toBeInTheDocument();

    // Should NOT show brand_basics
    expect(screen.queryByLabelText(/Brand Name/i)).not.toBeInTheDocument();
  });

  it("calls ai-brain-ingest with freshest answers when locking (includes brief + pillars + safety topics)", async () => {
    const user = userEvent.setup();

    const sessionAnswers = {
      brand: "Acme Co",
      website: "https://acme.example",
      niche: "saas",
      offers: ["offer_a"],
      audience: ["persona_a"],
      differentiators: ["diff_a", "diff_b"],
      tone: ["professional", "friendly", "educational"],
      platforms: ["instagram"],
      primary_platform: "instagram",
      goals: ["awareness"],
      kpis: ["reach"],
      pillars: ["Customer stories", "Product education", "Behind-the-scenes"],
      banned_claims: ["Guaranteed results"],
      taboo_topics: ["politics"],
      approval_cadence: "weekly_batch",
      approver_contact: "Jane Doe",
    };

    mockInvoke.mockImplementation((fnName: string, payload: any) => {
      const body = payload?.body ?? {};

      if (fnName === "ai-brains-client" && body.action === "create") {
        return Promise.resolve({ data: { brain: { id: "brain-789" } }, error: null });
      }

      if (fnName === "ai-onboarding-guide") {
        return Promise.resolve({
          data: {
            step_id: "review_required",
            assistant_message: "Ready to lock?",
            input_type: "single_select",
            options: [
              { id: "lock", label: "Lock & Finish (Brain is ready)" },
              { id: "enhance", label: "Enhance Strategy Depth (5 optional steps)" },
            ],
            constraints: { required: true },
            progress_percent: 100,
            can_lock: true,
          },
          error: null,
        });
      }

      if (fnName === "ai-brains-client" && (body.action === "update" || body.action === "lock")) {
        return Promise.resolve({ data: {}, error: null });
      }

      if (fnName === "ai-brain-ingest") {
        return Promise.resolve({ data: { ok: true, usable: true }, error: null });
      }

      return Promise.resolve({ data: {}, error: null });
    });

    mockMaybeSingle.mockResolvedValue({
      data: {
        id: "session-123",
        step_id: "review_required",
        answers_json: sessionAnswers,
        brain_id: "brain-789",
      },
      error: null,
    });

    render(
      <BrowserRouter>
        <AiOnboardingV3Guided {...defaultProps} />
      </BrowserRouter>
    );

    const lockOption = await screen.findByRole("button", { name: "Lock & Finish (Brain is ready)" });
    await user.click(lockOption);

    const finishButton = await screen.findByRole("button", { name: "Lock & Finish" });
    await user.click(finishButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("ai-brain-ingest", expect.anything());
    });

    const ingestCall = mockInvoke.mock.calls.find((call) => call[0] === "ai-brain-ingest");
    expect(ingestCall).toBeTruthy();
    const ingestBody = ingestCall?.[1]?.body;
    const rawResponses = ingestBody?.raw_responses;

    expect(rawResponses.pillars).toEqual(sessionAnswers.pillars);
    expect(rawResponses.taboo_topics).toEqual(sessionAnswers.taboo_topics);
    expect(rawResponses.banned_claims).toEqual(sessionAnswers.banned_claims);

    expect(rawResponses.brief).toBeTruthy();
    expect(typeof rawResponses.brief.confidence).toBe("number");

    const brain = mapV3AnswersToClientBrain(rawResponses, {}, "2025-12-25T00:00:00.000Z") as any;
    expect(Array.isArray(brain.pillars)).toBe(true);
    expect(brain.pillars.length).toBeGreaterThan(0);
    expect(Array.isArray(brain.constraints?.banned_claims_or_taboo_topics)).toBe(true);
    expect(brain.constraints.banned_claims_or_taboo_topics.length).toBeGreaterThan(0);
  });
});
