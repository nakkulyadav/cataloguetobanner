import type { BackgroundOption } from '../types';

/**
 * Predefined background images served from /public/backgrounds/.
 * Each background carries its own CTA button colour pairing.
 */
export const BACKGROUND_OPTIONS: BackgroundOption[] = [
  {
    id: 'bg-blue',
    url: '/backgrounds/blue bg.png',
    ctaColor: '#457DD1',
    ctaTextColor: '#FFFFFF',
  },
  {
    id: 'bg-pink',
    url: '/backgrounds/pink bg.png',
    ctaColor: '#FF6B6B',
    ctaTextColor: '#FFFFFF',
  },
  {
    id: 'bg-purple',
    url: '/backgrounds/purple bg.png',
    ctaColor: '#411F54',
    ctaTextColor: '#FFFFFF',
  },
];
