import type { BackgroundOption } from '../types';

/**
 * Predefined background images served from /public/backgrounds/.
 * Each background carries its own CTA button colour pairing.
 */
export const BACKGROUND_OPTIONS: BackgroundOption[] = [
  {
    id: 'bg-blue',
    name: 'Standard Blue',
    url: '/backgrounds/blue bg.png',
    ctaColor: '#2467CB',
    ctaTextColor: '#FFFFFF',
  },
  {
    id: 'bg-pink',
    name: 'Sample Pink',
    url: '/backgrounds/pink bg.png',
    ctaColor: '#FF6B6B',
    ctaTextColor: '#FFFFFF',
  },
  {
    id: 'bg-purple',
    name: 'Sample Purple',
    url: '/backgrounds/purple bg.png',
    ctaColor: '#411F54',
    ctaTextColor: '#FFFFFF',
  },
];
