# Radit Help Desk Implementation Plan

> **For agentic workers:** Inline execution in this session (Joe: gas). TDD on hours/queue/silence first.

**Goal:** Human support chat named Radit — public + in-app widget, Super Admin Help desk queue of one, 10-minute visitor silence close, 09:00–17:00 Jakarta (settings), off-hours = existing contact form.

**Architecture:** Pure `hours`/`rules` modules (tested). Prisma `SupportDeskSettings` + `SupportThread` + `SupportMessage` (never `Wa*`). Polling APIs. Widget in MarketingChrome, AppShell, AuthSplitShell.

**Tech Stack:** Next.js App Router, Prisma 5, Postgres, node:test, existing `/api/contact`.

## Global Constraints

- Display name always **Radit**. Human only. No AI.
- Do not mix with `WaConversation` / brand WhatsApp.
- Clock **Asia/Jakarta**. Close 17:00 exclusive.
- Off-hours submit = `ContactMessage`, not a support thread.
- Monetization: not a SKU. No WA credits.
- SUPER_ADMIN platform mode only for Help desk.
- One ACTIVE thread globally.

## Files

- `src/lib/support/hours.ts` + `.test.ts`
- `src/lib/support/rules.ts` + `.test.ts`
- `src/lib/support/service.ts` + `scheduler.ts` + `cookie.ts`
- `prisma/schema.prisma` + migration `20260901200000_support_helpdesk`
- `src/app/api/support/widget/route.ts`
- `src/app/api/support/widget/message/route.ts`
- `src/app/api/support/desk/route.ts`
- `src/app/api/support/desk/settings/route.ts`
- `src/components/support/SupportWidget.tsx`
- `src/components/support/HelpDesk.tsx`
- `src/app/(app)/support/page.tsx`
- Nav, i18n, middleware, tenancy, instrumentation, shells
