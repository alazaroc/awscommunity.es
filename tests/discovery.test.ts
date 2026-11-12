import { describe, expect, it } from 'vitest';
import { handler } from '../backend/handlers/discover';

describe('discovery metadata', () => {
  it('lists active Meetup groups without accessing DynamoDB', async () => {
    const result = await handler({ mode: 'groups' });
    expect(result.groups).toEqual(expect.arrayContaining(['madrid', 'zaragoza', 'sevilla']));
    expect(result.groups).toHaveLength(12);
  });
});
