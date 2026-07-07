# StatQA BA/UX Implementation Plan

## Current Product Read

StatQA is now more than a website scanner. It has three product surfaces:

- Website scan analysis: crawl a target URL and produce content, behavior, security, and scan reports.
- AI QA automation: generate test cases, archive/manage them, run them, refresh run results, schedule recurring runs, and export QA reports.
- AI test data: generate synthetic datasets, save them, review history, and export datasets.

The core value proposition is strong, but the UX has started to suffer from feature accretion: navigation is flat, generated test lists can become too long, and schedule controls are too implicit.

## Senior BA Findings

- Users need to understand the difference between website scan reports and generated QA reports.
- Generated test suites with up to 100 tests need list-management patterns: search, pagination, bulk actions, and compact summaries.
- Scheduling must expose cadence choice before a schedule is created.
- QA reports need to communicate lifecycle state: generated, archived, scheduled, running, passed, failed, and needs review.
- Test data generation should remain a reusable asset library, not a one-off JSON preview.

## UX Implementation Priorities

1. Navigation and information architecture
   - Group navigation into Website Scanning, AI QA Automation, and Workspace.
   - Keep labels plain and role-based.
   - Avoid making users guess whether "Reports" means scan reports or QA reports.

2. Large generated-test suite usability
   - Limit visible generated-test cards by default.
   - Add "show more" behavior for active/archive/run pages.
   - Keep search and bulk actions available above the list.

3. Scheduling clarity
   - Add a visible frequency control before scheduling.
   - Use the selected frequency when creating a schedule.
   - Keep weekly as the default.

4. Reporting clarity
   - Keep QA run refresh and status derivation.
   - Keep export actions in QA reporting.
   - Continue improving trace detail in later passes.

5. Next implementation tranche
   - Improve generated-test card density with collapsed detail mode.
   - Add schedule frequency selection.
   - Add project/workspace grouping for tests and reports.
   - Add persistent background job runner for due schedules.
   - Add end-to-end tests for QA management flows.

## Acceptance Criteria For This Pass

- Old 5,000-line plan is removed.
- Active TODO is concise and action-oriented.
- Sidebar navigation is grouped.
- Large generated-test lists do not render all 100 cards by default.
- Schedule frequency is user-selectable.
- Backend/frontend builds pass.
- Existing backend tests pass.
