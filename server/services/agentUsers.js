import { memoryDb } from '../config/database.js';
import User, { publicUser } from '../models/User.js';
import { round6 } from './economy.js';
import { issue } from './ledger.js';

export class AgentUserError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'AgentUserError';
    this.status = status;
  }
}

const validateOpeningBalance = (openingBalance, maximum) => {
  const balance = Number(openingBalance ?? 0);
  if (!Number.isFinite(balance) || balance < 0) {
    throw new AgentUserError('openingBalance must be a non-negative number');
  }
  if (balance > maximum) {
    throw new AgentUserError(
      `openingBalance exceeds the operator maximum of ${maximum} /t26`
    );
  }
  return round6(balance);
};

export const createAgentUser = (
  { username, password, openingBalance },
  operator
) => {
  const balance = validateOpeningBalance(
    openingBalance,
    operator.maxOpeningBalance
  );

  return memoryDb.atomic(() => {
    const created = User.createAgent({ username, password, openingBalance: balance });
    if (!created.success) {
      throw new AgentUserError(created.error, created.code || 400);
    }

    const user = created.data;
    if (balance > 0) {
      issue(user.id, 'operator_grant', balance, {
        reason: 'agent_user_create'
      });
    }
    memoryDb.createEvent({
      type: 'operator_agent_user_created',
      user_id: user.id,
      opening_balance: balance
    });

    const current = memoryDb.getUserById(user.id);
    return {
      user: publicUser(current),
      openingBalance: balance,
      balance: current.balance
    };
  });
};
