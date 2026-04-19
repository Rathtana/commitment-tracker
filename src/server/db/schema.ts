import {
  pgTable,
  uuid,
  text,
  timestamp,
  date,
  pgEnum,
  foreignKey,
  pgPolicy,
} from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { authenticatedRole, authUsers } from "drizzle-orm/supabase"

// ---------- public.users (mirror of auth.users with profile fields) ----------
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().notNull(),
    timezone: text("timezone").notNull().default("UTC"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.id],
      foreignColumns: [authUsers.id],
      name: "users_id_fk",
    }).onDelete("cascade"),
    pgPolicy("users-select-own", {
      for: "select",
      to: authenticatedRole,
      using: sql`id = auth.uid()`,
    }),
    pgPolicy("users-update-own", {
      for: "update",
      to: authenticatedRole,
      using: sql`id = auth.uid()`,
      withCheck: sql`id = auth.uid()`,
    }),
  ],
)

// ---------- goal type enum ----------
export const goalTypeEnum = pgEnum("goal_type", ["count", "checklist", "habit"])

// ---------- public.goals (polymorphic parent) ----------
export const goals = pgTable(
  "goals",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    userId: uuid("user_id").notNull(),
    month: date("month").notNull(), // CHECK enforced via custom SQL migration 0001
    title: text("title").notNull(),
    type: goalTypeEnum("type").notNull(),
    position: text("position").notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "goals_user_id_fk",
    }).onDelete("cascade"),
    pgPolicy("goals-select-own", {
      for: "select",
      to: authenticatedRole,
      using: sql`user_id = auth.uid()`,
    }),
    pgPolicy("goals-insert-own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`user_id = auth.uid()`,
    }),
    pgPolicy("goals-update-own", {
      for: "update",
      to: authenticatedRole,
      using: sql`user_id = auth.uid()`,
      withCheck: sql`user_id = auth.uid()`,
    }),
    pgPolicy("goals-delete-own", {
      for: "delete",
      to: authenticatedRole,
      using: sql`user_id = auth.uid()`,
    }),
  ],
)
