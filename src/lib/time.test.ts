import { describe, expect, it } from 'vitest';
import { dateSpan, dayLabel, localDate, timeRange, zonedToIso } from './time';

describe('vrijeme', () => {
  it('pretvara lokalno vrijeme u UTC (ljetno i zimsko računanje)', () => {
    expect(zonedToIso('2026-10-23', '16:00', 'Europe/Zagreb')).toBe('2026-10-23T14:00:00.000Z');
    // 25. 10. 2026. sat se vraća u 3:00
    expect(zonedToIso('2026-10-25', '09:00', 'Europe/Zagreb')).toBe('2026-10-25T08:00:00.000Z');
  });

  it('prikazuje raspon 16:00 – 16:25', () => {
    expect(timeRange('2026-10-23T14:00:00.000Z', 25, 'Europe/Zagreb')).toBe('16:00 – 16:25');
  });

  it('datum i dan na hrvatskom', () => {
    expect(localDate('2026-10-23T22:30:00.000Z', 'Europe/Zagreb')).toBe('2026-10-24');
    expect(dayLabel('2026-10-23')).toBe('petak, 23. 10.');
    expect(dateSpan('2026-10-23', '2026-10-25')).toBe('23. – 25. 10. 2026.');
  });
});
