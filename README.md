# RunBook Control

RunBook Control is the remote orchestration and admin surface for the RunBook system.

## Role

Control is the remote authority for:

- account identity
- shop membership
- billing and entitlement
- device enrollment and revocation
- workstation registration policy
- shared access policy
- onboarding coordination

Control is not the owner of Desktop local manufacturing files or Desktop company shells.

## What Control Owns

Control owns remote/shared authority for:

- `shop_id` membership and admin access
- billing state and seat enforcement
- desktop/device enrollment state
- workstation registration state
- shared remote access decisions

## What Control Must Not Own

Control must not:

- become the primary authority for Desktop local manufacturing artifacts
- redefine Desktop-owned local manufacturing domain rules independently
- normalize legacy compatibility patterns as final architecture

## Current Architecture Reality

This repo is a Next.js app plus remote API/admin layer.
It uses Supabase and Stripe-backed infrastructure for many shared authority flows.

It also still contains staged compatibility patterns and some legacy-tenancy coexistence.
Those compatibility paths are implementation reality, not the final ideal.

## Important Remote Surfaces

Examples include:

- desktop bootstrap / onboarding
- billing checkout / portal / status
- device enrollment / activation / token validation
- workstation login / timeclock
- shared membership and device admin pages

## Documentation

For the cross-app architecture source of truth, see:

- `D:\RunBook.Desktop\Docs\RUNBOOK_BIBLE.md`
- `D:\RunBook.Desktop\Docs\SYSTEM_DATA_CONTRACT.md`

For a deeper current-state repo-specific review, see:

- `RUNBOOK_CONTROL_AUDIT_REPORT.md`

