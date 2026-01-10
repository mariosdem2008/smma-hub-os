import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { OnboardingV5Wizard } from '../OnboardingV5Wizard';

const supabaseMocks = vi.hoisted(() => {
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const maybeSingle = vi.fn();
  const selectEq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq: selectEq }));
  const update = vi.fn(() => ({ eq: updateEq }));
  const from = vi.fn(() => ({ select, update }));
  const rpc = vi.fn().mockResolvedValue({ error: null });
  const invoke = vi.fn((name: string) => {
    if (name === 'ai-onboarding-scan') {
      return Promise.resolve({
        data: {
          extracted: {
            niche: 'restaurant',
            offers: ['Lunch bundle'],
            audience: ['Local families'],
            pain_points: ['Not enough customers/leads', 'Low engagement', 'Bad reviews / not enough reviews'],
            differentiators: ['Better experience / hospitality'],
            cta: 'Book appointment',
          },
          confidence: 82,
          source_urls: ['https://example.com'],
        },
        error: null,
      });
    }
    return Promise.resolve({ data: {}, error: null });
  });

  return {
    updateEq,
    maybeSingle,
    selectEq,
    select,
    update,
    from,
    rpc,
    invoke,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: supabaseMocks.from,
    rpc: supabaseMocks.rpc,
    functions: { invoke: supabaseMocks.invoke },
  },
}));

const profile = {
  client_id: 'client-1',
  agency_id: 'agency-1',
  q2_website: 'https://example.com',
  offers: [{ type: 'best_seller', name: 'Existing offer' }],
};

describe('OnboardingV5Wizard', () => {
  beforeEach(() => {
    supabaseMocks.maybeSingle.mockResolvedValue({ data: profile, error: null });
    supabaseMocks.updateEq.mockClear();
    supabaseMocks.invoke.mockClear();
    window.localStorage.clear();
    window.sessionStorage.clear();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders sections, autosaves, and applies scan without overwrite', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <OnboardingV5Wizard clientId="client-1" agencyId="agency-1" autosaveDelayMs={0} />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'Basics' })).toBeInTheDocument();

    const businessInput = screen.getByLabelText('Business name');
    await user.type(businessInput, 'Northwind Studios');

    await waitFor(() => expect(supabaseMocks.updateEq).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: 'Scan website/profile (45s)' }));
    await user.click(await screen.findByRole('button', { name: 'Apply all' }));
    await user.keyboard('{Escape}');

    const offerNavButtons = screen.getAllByRole('button', { name: /Offers/ });
    await user.click(offerNavButtons[0]);

    expect(await screen.findByRole('heading', { name: 'Offers' })).toBeInTheDocument();
    expect(screen.getByText('Existing offer')).toBeInTheDocument();
  });

  it('defaults right rail to collapsed and persists expand state', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <OnboardingV5Wizard clientId="client-1" agencyId="agency-1" />
      </MemoryRouter>
    );

    expect(await screen.findByText('Strategy Snapshot')).toBeInTheDocument();
    const expandButton = screen.getByRole('button', { name: /Expand/ });
    await user.click(expandButton);
    expect(await screen.findByText('Output Preview')).toBeInTheDocument();
    await waitFor(() =>
      expect(window.localStorage.getItem('onboarding_right_rail_agency-1_client-1')).toBe('expanded')
    );
  });

  it('does not render Next Best Actions anywhere', async () => {
    render(
      <MemoryRouter>
        <OnboardingV5Wizard clientId="client-1" agencyId="agency-1" />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'Basics' })).toBeInTheDocument();
    expect(screen.queryByText(/Next best actions/i)).not.toBeInTheDocument();
  });

  it('gating helper focuses missing field', async () => {
    const user = userEvent.setup();
    supabaseMocks.maybeSingle.mockResolvedValue({ data: { ...profile, q1_business_name: null }, error: null });

    render(
      <MemoryRouter>
        <OnboardingV5Wizard clientId="client-1" agencyId="agency-1" />
      </MemoryRouter>
    );

    const helper = (await screen.findAllByRole('button', { name: /Add Business name to continue/i }))[0];
    await user.click(helper);
    const businessInput = screen.getByLabelText('Business name');
    await waitFor(() => expect(document.activeElement).toBe(businessInput));
  });
});
