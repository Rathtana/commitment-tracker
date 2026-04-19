import {
  pgTable,
  uuid,
  text,
  timestamp,
  date,
  pgEnum,
  foreignKey,
  pgPolicy,
  integer,
  boolean,
  primaryKey,
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
    // Nullable polymorphic columns — enforced via CHECK in migration 0003
    targetCount: integer("target_count"),    // valid only for type='count' (D-03)
    currentCount: integer("current_count"),  // valid only for type='count' (D-03, D-06 denormalized cache)
    targetDays: integer("target_days"),      // valid only for type='habit' (D-03)
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

// ---------- tasks (D-01) ----------
export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    goalId: uuid("goal_id").notNull(),
    label: text("label").notNull(),
    isDone: boolean("is_done").notNull().default(false),
    position: integer("position").notNull().default(0),
    doneAt: timestamp("done_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({ columns: [table.goalId], foreignColumns: [goals.id], name: "tasks_goal_id_fk" }).onDelete("cascade"),
    pgPolicy("tasks-select-own", {
      for: "select", to: authenticatedRole,
      using: sql`EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND g.user_id = auth.uid())`,
    }),
    pgPolicy("tasks-insert-own", {
      for: "insert", to: authenticatedRole,
      withCheck: sql`EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND g.user_id = auth.uid())`,
    }),
    pgPolicy("tasks-update-own", {
      for: "update", to: authenticatedRole,
      using: sql`EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND g.user_id = auth.uid())`,
      withCheck: sql`EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND g.user_id = auth.uid())`,
    }),
    pgPolicy("tasks-delete-own", {
      for: "delete", to: authenticatedRole,
      using: sql`EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND g.user_id = auth.uid())`,
    }),
  ],
)

// ---------- habit_check_ins (D-02) ----------
export const habitCheckIns = pgTable(
  "habit_check_ins",
  {
    goalId: uuid("goal_id").notNull(),
    checkInDate: date("check_in_date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.goalId, table.checkInDate], name: "habit_check_ins_pk" }),
    foreignKey({ columns: [table.goalId], foreignColumns: [goals.id], name: "habit_check_ins_goal_id_fk" }).onDelete("cascade"),
    pgPolicy("habit-check-ins-select-own", {
      for: "select", to: authenticatedRole,
      using: sql`EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND g.user_id = auth.uid())`,
    }),
    pgPolicy("habit-check-ins-insert-own", {
      for: "insert", to: authenticatedRole,
      withCheck: sql`EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND g.user_id = auth.uid())`,
    }),
    pgPolicy("habit-check-ins-update-own", {
      for: "update", to: authenticatedRole,
      using: sql`EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND g.user_id = auth.uid())`,
      withCheck: sql`EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND g.user_id = auth.uid())`,
    }),
    pgPolicy("habit-check-ins-delete-own", {
      for: "delete", to: authenticatedRole,
      using: sql`EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND g.user_id = auth.uid())`,
    }),
  ],
)

// ---------- progress_entries (D-05, D-06) ----------
export const progressEntries = pgTable(
  "progress_entries",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    goalId: uuid("goal_id").notNull(),
    delta: integer("delta").notNull(),
    loggedAt: timestamp("logged_at", { withTimezone: true }).notNull().defaultNow(),
    loggedLocalDate: date("logged_local_date").notNull(),
    undoId: uuid("undo_id"),  // used by D-34 most-recent-only undo — Plan 04 writes/reads
  },
  (table) => [
    foreignKey({ columns: [table.goalId], foreignColumns: [goals.id], name: "progress_entries_goal_id_fk" }).onDelete("cascade"),
    pgPolicy("progress-entries-select-own", {
      for: "select", to: authenticatedRole,
      using: sql`EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND g.user_id = auth.uid())`,
    }),
    pgPolicy("progress-entries-insert-own", {
      for: "insert", to: authenticatedRole,
      withCheck: sql`EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND g.user_id = auth.uid())`,
    }),
    pgPolicy("progress-entries-update-own", {
      for: "update", to: authenticatedRole,
      using: sql`EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND g.user_id = auth.uid())`,
      withCheck: sql`EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND g.user_id = auth.uid())`,
    }),
    pgPolicy("progress-entries-delete-own", {
      for: "delete", to: authenticatedRole,
      using: sql`EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND g.user_id = auth.uid())`,
    }),
  ],
)
