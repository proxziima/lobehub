import { doublePrecision, index, integer, pgTable, text } from 'drizzle-orm/pg-core';

import { idGenerator } from '../utils/idGenerator';
import { timestamptz } from './_helpers';
import { messages } from './message';
import { users } from './user';

export const usageEvents = pgTable(
  'usage_events',
  {
    id: text('id')
      .$defaultFn(() => idGenerator('budget'))
      .primaryKey(),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    occurredAt: timestamptz('occurred_at').defaultNow().notNull(),
    messageId: text('message_id').references(() => messages.id, { onDelete: 'set null' }),
    model: text('model'),
    provider: text('provider'),
    weightedTokens: integer('weighted_tokens').notNull(),
    rawInput: integer('raw_input'),
    rawOutput: integer('raw_output'),
    costCents: doublePrecision('cost_cents'),
  },
  (t) => [index('usage_events_user_time_idx').on(t.userId, t.occurredAt)],
);

export type UsageEventItem = typeof usageEvents.$inferSelect;
export type NewUsageEventItem = typeof usageEvents.$inferInsert;
