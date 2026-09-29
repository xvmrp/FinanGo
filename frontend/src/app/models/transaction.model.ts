import { Account } from './account.model';

export type TransactionType = 'INCOME' | 'EXPENSE';
export interface CreateTransaction {
  accountId: number;
  type: TransactionType;
  amount: number;
  date: string;
  description: string;
  category: string;
}
export interface Transaction extends CreateTransaction {
  id: number;
  createdAt: string;
  account: Account;
  statementId?: number | null;
  balanceAfter?: number | null;
}
