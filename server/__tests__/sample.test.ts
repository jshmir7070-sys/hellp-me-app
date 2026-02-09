/**
 * Sample test to verify Jest setup
 */

describe('Jest Setup', () => {
  it('should run tests successfully', () => {
    expect(true).toBe(true);
  });

  it('should perform basic arithmetic', () => {
    expect(1 + 1).toBe(2);
  });

  it('should handle strings', () => {
    const message = 'Hello, Jest!';
    expect(message).toContain('Jest');
  });
});

describe('TypeScript Support', () => {
  it('should support TypeScript types', () => {
    const user: { id: number; name: string } = {
      id: 1,
      name: 'Test User',
    };

    expect(user.id).toBe(1);
    expect(user.name).toBe('Test User');
  });
});
