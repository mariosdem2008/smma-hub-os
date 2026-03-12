import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AiOnboardingClient from '@/pages/ai/AiOnboardingClient';

const mockUseQuery = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock('@/components/onboarding-chat-client/ClientOnboardingChatShell', () => ({
  ClientOnboardingChatShell: () => <div data-testid="onboarding-chat-v1">ChatV1</div>,
}));

function renderWithRoute() {
  return render(
    <MemoryRouter initialEntries={['/onboarding/client/client-1']}>
      <Routes>
        <Route path="/onboarding/client/:clientId" element={<AiOnboardingClient />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('AiOnboardingClient route selection', () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
    mockUseQuery.mockReturnValue({
      data: { id: 'client-1', agency_id: 'agency-1' },
      isLoading: false,
      error: null,
    });
  });

  it('loads chat onboarding shell', () => {
    renderWithRoute();
    expect(screen.getByTestId('onboarding-chat-v1')).toBeTruthy();
  });
});
