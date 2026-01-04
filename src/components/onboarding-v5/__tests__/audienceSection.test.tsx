import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AudienceSection } from '../sections/AudienceSection';

describe('AudienceSection', () => {
  it('updates profile from customer and pain point chips', async () => {
    const user = userEvent.setup();
    const onFieldChange = vi.fn();

    render(
      <AudienceSection
        profile={{}}
        onFieldChange={onFieldChange}
        missingFields={[]}
        onFocusField={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    );

    await user.click(screen.getByText('Local families'));
    expect(onFieldChange).toHaveBeenCalledWith({ primary_customer: 'Local families' });

    await user.click(screen.getByText('Not enough customers/leads'));
    expect(onFieldChange).toHaveBeenCalledWith({ q9_pain_points: ['Not enough customers/leads'] });
  });
});
