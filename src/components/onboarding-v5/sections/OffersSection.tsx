import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AiSuggestionChips, MultiSelectChips, SingleSelectChips } from '@/components/onboarding-v4/components/AiSuggestionChips';
import type { OnboardingOffer, OnboardingProfile } from '@/types/onboarding';
import { OFFER_PROMISE_OPTIONS, OFFER_SLOT_OPTIONS } from '@/types/onboarding';
import { getFieldLabel } from '../lib/labels';

interface OffersSectionProps {
  profile: Partial<OnboardingProfile>;
  onFieldChange: (updates: Partial<OnboardingProfile>) => void;
  missingFields: string[];
  onFocusField: (fieldKey: string) => void;
  onNext: () => void;
  onBack: () => void;
}

function buildOfferNameSuggestions(type: OnboardingOffer['type']): string[] {
  switch (type) {
    case 'best_seller':
      return ['Signature Service', 'Hero Offer', 'Best Seller Package', 'Core Program'];
    case 'starter_offer':
      return ['Starter Package', 'Intro Offer', 'Quick Start', 'Trial Offer'];
    case 'premium_offer':
      return ['Premium Transformation', 'VIP Experience', 'Elite Package', 'Signature Premium'];
    case 'bundle_package':
      return ['Bundle Package', 'Complete Bundle', 'All-in-One Package', 'Growth Bundle'];
    case 'membership_subscription':
      return ['Membership Plan', 'Monthly Membership', 'Subscription Offer', 'Loyalty Program'];
    case 'seasonal_promo':
      return ['Seasonal Promo', 'Limited Offer', 'Holiday Special', 'Flash Deal'];
    default:
      return ['Custom Offer', 'Signature Offer', 'Main Offer'];
  }
}

function ensureOfferShell(type: OnboardingOffer['type'], existing?: OnboardingOffer): OnboardingOffer {
  return {
    type,
    name: existing?.name ?? '',
    price_min: existing?.price_min ?? null,
    price_max: existing?.price_max ?? null,
    promise: existing?.promise ?? null,
  };
}

export function OffersSection({ profile, onFieldChange, missingFields, onFocusField, onNext, onBack }: OffersSectionProps) {
  const missing = new Set(missingFields);
  const nextMissing = missingFields[0];
  const focusMap: Record<string, string> = {
    offers: 'offers',
  };

  const offers = profile.offers ?? [];
  const selectedTypes = offers.map((offer) => offer.type);

  const handleOfferTypesChange = (types: string[]) => {
    const typedTypes = types as OnboardingOffer['type'][];
    const nextOffers = typedTypes.map((type) => ensureOfferShell(type, offers.find((o) => o.type === type)));
    const primary = nextOffers[0];
    onFieldChange({
      offers: nextOffers.length ? nextOffers : null,
      q6_offer_name: primary?.name ?? null,
      q6_price_min: primary?.price_min ?? null,
      q6_price_max: primary?.price_max ?? null,
    });
  };

  const updateOffer = (index: number, updates: Partial<OnboardingOffer>) => {
    const next = [...offers];
    next[index] = { ...next[index], ...updates };
    const primary = next[0];
    onFieldChange({
      offers: next,
      q6_offer_name: primary?.name ?? null,
      q6_price_min: primary?.price_min ?? null,
      q6_price_max: primary?.price_max ?? null,
    });
  };

  const offerTypeOptions = useMemo(() => OFFER_SLOT_OPTIONS, []);
  const handleSuggest = () => {
    if (offers.length === 0) {
      const suggested: OnboardingOffer = {
        type: 'best_seller',
        name: 'Signature Service',
        promise: 'results_focused',
      };
      onFieldChange({
        offers: [suggested],
        q6_offer_name: suggested.name,
        q6_price_min: suggested.price_min ?? null,
        q6_price_max: suggested.price_max ?? null,
      });
      return;
    }
    const first = offers[0];
    if (!first?.name) {
      updateOffer(0, { name: buildOfferNameSuggestions(first?.type ?? 'best_seller')[0] ?? 'Signature Service' });
    }
    if (!first?.promise) {
      updateOffer(0, { promise: 'results_focused' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Offers</h2>
          <p className="text-sm text-muted-foreground">Define the offers you want to promote.</p>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={handleSuggest}>
          Suggest for me
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Top offers (pick 1-3)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div data-field-key="offers" tabIndex={-1}>
            <MultiSelectChips
              options={offerTypeOptions}
              values={selectedTypes}
              onChange={handleOfferTypesChange}
              minSelections={1}
              maxSelections={3}
            />
          </div>
          {missing.has('offers') && (
            <div className="text-xs text-muted-foreground">
              Example: Best seller / signature service. Needed to build campaigns.
            </div>
          )}
        </CardContent>
      </Card>

      {offers.map((offer, index) => {
        const nameSuggestions = buildOfferNameSuggestions(offer.type);
        const chips = nameSuggestions.map((label, i) => ({ id: `${offer.type}-${i}`, label }));
        return (
          <Card key={offer.type}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                {offerTypeOptions.find((option) => option.id === offer.type)?.label ?? 'Offer'} details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Offer name</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const suggested = nameSuggestions[0];
                      if (suggested && !offer.name) {
                        updateOffer(index, { name: suggested });
                      }
                      if (!offer.promise) {
                        updateOffer(index, { promise: 'results_focused' });
                      }
                    }}
                  >
                    Suggest for me
                  </Button>
                </div>
                <AiSuggestionChips
                  suggestions={chips}
                  value={offer.name || null}
                  onSelect={(values) => updateOffer(index, { name: values[0] ?? '' })}
                  allowCustom
                  allowNotSure={false}
                  customPlaceholder="Write custom offer name"
                />
              </div>

              <div className="space-y-2">
                <Label>Price range (optional)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={offer.price_min ?? ''}
                    onChange={(event) => updateOffer(index, { price_min: event.target.value ? Number(event.target.value) : null })}
                    placeholder="Min"
                  />
                  <Input
                    type="number"
                    value={offer.price_max ?? ''}
                    onChange={(event) => updateOffer(index, { price_max: event.target.value ? Number(event.target.value) : null })}
                    placeholder="Max"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>1-line promise</Label>
                <SingleSelectChips
                  options={OFFER_PROMISE_OPTIONS}
                  selected={(offer.promise as string) ?? null}
                  onSelect={(value) => updateOffer(index, { promise: value })}
                  allowCustom
                  customPlaceholder="Write custom promise"
                  className="grid gap-2 md:grid-cols-2"
                />
              </div>
            </CardContent>
          </Card>
        );
      })}

      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <div className="flex flex-col items-end gap-2">
          {missingFields.length > 0 && (
            <button
              type="button"
              onClick={() => onFocusField(focusMap[nextMissing] ?? nextMissing)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Add {getFieldLabel(nextMissing)} to continue.
            </button>
          )}
          <Button type="button" onClick={onNext} disabled={missingFields.length > 0}>
            Next: Audience
          </Button>
        </div>
      </div>
    </div>
  );
}
