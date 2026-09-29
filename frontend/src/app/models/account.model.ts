export interface Account {
  id: number;
  bank: string;
  accountType: string;
  balance: number;
  source?: 'MANUAL' | 'BANK_STATEMENT';
  balanceAsOf?: string | null;
  last4?: string | null;
}
