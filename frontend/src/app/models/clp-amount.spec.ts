import { parseClpAmount } from './clp-amount';

describe('CLP input', () => {
  it('accepts whole pesos and either thousands separator without truncation', () => {
    for (const text of ['223000', '223.000', '223,000']) expect(parseClpAmount(text)).toBe(223000);
    expect(parseClpAmount('1.223.000')).toBe(1223000);
    expect(parseClpAmount('0')).toBe(0);
  });
  it('rejects decimals, malformed grouping, negatives and database overflow', () => {
    for (const text of ['', '223,50', '223.5', '22,30,00', '1,223.000', '-1', 'abc', '2147483648']) {
      expect(parseClpAmount(text)).toBeNull();
    }
  });
});
