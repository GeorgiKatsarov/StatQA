# StatQA Full-Stack Build Prompt

You are building a production-minded MVP SaaS application called **StatQA**.

Follow this prompt exactly. Build in stages. Do not collapse the work into a single giant output. Each phase must produce working code, clear file boundaries, and testable behavior before moving to the next phase.

## Operating rules

- Use TypeScript everywhere for backend and frontend code.
- Favor modular services over large files.
- Keep naming explicit and consistent.
- Avoid speculative architecture.
- Build for maintainability, not demo-only output.
- Do not skip validation, error handling, or basic security.
- After each major step, run the project or tests and fix obvious issues before continuing.
- If a missing dependency or assumption blocks progress, resolve it directly rather than hand-waving.

## Product definition

StatQA is a SaaS platform that accepts a website URL, crawls a limited set of pages on that site, inspects page structure and content, detects QA and UX issues, stores historical analyses for authenticated users, and presents results in a clean dashboard.

The product is not a generic SEO checker. It is a website QA audit application focused on practical page-level and site-level problems across structure, usability, accessibility, content quality, and lightweight performance indicators.

## Primary user flow

1. A user registers or logs in.
2. The user enters a public website URL into the dashboard.
3. The backend validates the URL and rejects unsafe or unsupported targets.
4. The crawler discovers multiple internal pages on the same domain.
5. The scraper analyzes each crawled page.
6. The validation engine creates structured issues with severity, explanation, and recommendation.
7. The analyzer aggregates page-level results into a single site report.
8. The report is stored in the database.
9. The frontend displays score, issue counts, highlights, per-page breakdown, filters, and export actions.

## Scope boundaries

Implement:

- Email/password auth
- JWT-based protected APIs
- Multi-page crawling
- Page scraping with Playwright
- Rule-based validation engine
- Prisma persistence
- Dashboard UI
- Analysis history support if feasible within the MVP structure

Do not implement:

- OAuth providers
- Team accounts
- Billing
- Microservices
- Background job queues unless absolutely necessary
- Lighthouse integration
- Full browser extension functionality
- Advanced AI-generated recommendations

## Delivery philosophy

Build incrementally in this order:

1. Repository and app structure
2. Backend API foundation
3. Database and auth
4. Crawler and scraper
5. Validation engine
6. Aggregation and scoring
7. Frontend authentication flow
8. Frontend analysis dashboard
9. Polish, edge cases, and testing

Do not start frontend polish before the backend analysis path works end-to-end.

## Required technology stack

### Backend

- Node.js
- TypeScript
- Express
- Playwright
- Prisma ORM
- PostgreSQL
- JWT
- bcrypt
- zod for request validation if needed

### Frontend

- React
- TypeScript
- Vite preferred
- Tailwind CSS or a small custom CSS system
- Fetch API or Axios

### Development quality

- ESLint if project setup includes it
- Prettier optional
- Environment variable support
- Clear scripts for dev, build, and start

## Monorepo-style project layout

Use this structure unless there is a strong implementation reason to refine it:

```text
StatQA/
  backend/
    package.json
    tsconfig.json
    .env.example
    prisma/
      schema.prisma
    src/
      server.ts
      app.ts
      config/
        env.ts
      routes/
        auth.ts
        analyze.ts
        analyses.ts
      middleware/
        authMiddleware.ts
        errorHandler.ts
      services/
        crawler.ts
        scraper.ts
        validator.ts
        scorer.ts
        analyzer.ts
        spellcheck.ts
        auth.ts
      utils/
        normalizeUrl.ts
        urlSafety.ts
        domain.ts
      lib/
        prisma.ts
      types/
        index.ts
  frontend/
    package.json
    tsconfig.json
    vite.config.ts
    src/
      main.tsx
      App.tsx
      lib/
        api.ts
        auth.ts
      pages/
        Login.tsx
        Dashboard.tsx
      components/
        UrlInput.tsx
        ScoreCard.tsx
        SummaryCards.tsx
        Sidebar.tsx
        IssueList.tsx
        IssueCard.tsx
        Highlights.tsx
        MetricsPanel.tsx
        Loader.tsx
        PageBreakdown.tsx
        TopBar.tsx
      styles/
        index.css
```

## Backend domain model

Define clear TypeScript interfaces and shared internal shapes for:

### ScrapedData

Should include:

- `url`
- `finalUrl`
- `title`
- `description`
- `lang`
- `headings`
- `links`
- `buttons`
- `inputs`
- `forms`
- `images`
- `videos`
- `iframes`
- `landmarks`
- `textContent`
- `domNodeCount`
- `scriptCount`
- `consoleErrors`
- `loadTimeMs`
- `accessibilitySignals`

### Issue

Should include:

- `id`
- `pageUrl`
- `category`
- `severity`
- `message`
- `explanation`
- `recommendation`
- `selector` optional
- `meta` optional key-value object

### PageResult

Should include:

- `url`
- `score`
- `healthLabel`
- `issueCount`
- `issues`
- `metrics`
- `summary`

### AnalysisResult

Should include:

- `rootUrl`
- `score`
- `healthLabel`
- `pagesScanned`
- `totals`
- `highlights`
- `categoryBreakdown`
- `pageResults`
- `createdAt`

### Severity enum

Use:

- `critical`
- `error`
- `warning`
- `info`

## Database design

Use Prisma with PostgreSQL.

### User model

Fields:

- `id`
- `email`
- `passwordHash`
- `analysesCount`
- `createdAt`
- `updatedAt`

Constraints:

- unique email
- analyses count defaults to zero

### Analysis model

Fields:

- `id`
- `userId`
- `url`
- `score`
- `healthLabel`
- `reportJson`
- `createdAt`

Requirements:

- relation to user
- `reportJson` stores the full aggregated result
- index on `userId` and `createdAt`

If useful, add an `AnalyzedPage` model later, but only if it meaningfully improves maintainability.

## Environment variables

Backend should support:

- `PORT`
- `DATABASE_URL`
- `JWT_SECRET`
- `NODE_ENV`
- `MAX_PAGES`
- `MAX_DEPTH`
- `ANALYSIS_CONCURRENCY`

Provide a `.env.example` file.

## Authentication requirements

Create these endpoints:

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`

Implementation requirements:

- hash passwords with bcrypt
- sign JWTs with a reasonable expiration
- return sanitized user data only
- protect analysis endpoints with auth middleware
- reject invalid input with clear messages
- store token client-side in localStorage for the MVP

## Usage limit rules

For free users:

- maximum 5 analyses total

Behavior:

- enforce the limit server-side
- return a meaningful `403` or `429` style response with explanation
- increment usage only after a successful analysis is stored

## URL safety and validation

Before crawling:

- ensure URL is syntactically valid
- normalize missing protocol if necessary
- reject localhost
- reject private network targets
- reject unsupported protocols
- restrict crawling to `http` and `https`

Do not allow the crawler to scan arbitrary internal infrastructure.

## Crawler specification

Create `crawlSite(startUrl)` with a breadth-first strategy.

Requirements:

- same domain only
- default `maxPages = 20`
- default `maxDepth = 2`
- visited set to avoid loops
- normalize URLs before enqueueing
- ignore fragments
- skip obvious asset links when crawling
- handle trailing slash consistency
- return crawled URLs in stable order

Crawler behavior details:

- start with the user-provided URL as depth 0
- fetch links from already-scraped pages
- enqueue only valid internal navigable pages
- avoid mailto, tel, javascript, file, and hash-only links

## Scraper specification

Create `scrapePage(url)` using Playwright.

Collect:

- page title
- meta description
- html lang attribute
- headings by level
- internal and external links
- buttons and their visible labels
- forms and submit buttons
- input fields with type, name, label, required state, placeholder
- images with src, alt, dimensions if practical
- landmark structure such as header, nav, main, footer
- visible text snapshot
- script count
- approximate DOM node count
- console errors
- page load time

Implementation details:

- set a reasonable navigation timeout
- capture console error events
- tolerate partial extraction failures
- close pages and browser resources correctly
- return structured data, not ad-hoc blobs

## Validation engine

Create a rule-based validator that transforms `ScrapedData` into a list of `Issue` records.

### Link rules

- broken or malformed href
- empty anchor text for visible links
- duplicate links with suspicious repetition
- generic anchor text like "click here" should be `info` or `warning`

### Button rules

- no visible text
- ambiguous labels like "submit" without context if needed
- buttons that appear interactive but lack meaningful semantics

### Input and form rules

- missing input `name`
- missing associated label
- forms with no submit button
- password fields with no autocomplete hints can be a warning if surfaced

### Image rules

- missing `alt`
- empty `alt` on non-decorative images where context suggests it matters
- broken image source if detectable

### Structure rules

- missing `h1`
- multiple `h1` values if clearly conflicting
- missing `main`
- missing title landmark cues for content-heavy pages

### Meta rules

- missing page title is `critical`
- missing meta description is `warning`
- missing or empty language is `warning`

### Performance heuristics

- too many script tags
- too many DOM nodes
- page load time above threshold

### Accessibility heuristics

- unlabeled controls
- missing landmark structure
- low semantic clarity in forms

### Content rules

- nearly empty page body
- placeholder or lorem ipsum style text
- simple spelling anomalies if a spellcheck utility is added

### Console rules

- JavaScript console errors should generate issues

Each issue must include:

- concise message
- practical explanation
- actionable recommendation

## Scoring model

Start from `100`.

Subtract:

- `critical * 20`
- `error * 10`
- `warning * 3`
- `info * 0` or a very small amount if justified

Clamp score to `0..100`.

Map score to health label:

- `90-100` => `Excellent`
- `75-89` => `Good`
- `50-74` => `Needs Improvement`
- `0-49` => `Poor`

Also compute:

- total issues by severity
- total issues by category
- pass count where checks succeeded if practical

## Analyzer orchestration

Create `analyzeSite(url, userId)` as the main service entry point.

Execution steps:

1. validate and normalize URL
2. verify user limit
3. crawl site
4. analyze pages with limited concurrency of 3
5. validate each page
6. score each page
7. aggregate all pages into a site result
8. compute top highlights
9. persist analysis in database
10. increment user analysis count
11. return final structured report

Aggregation requirements:

- combine issues from all pages
- compute total links, buttons, inputs, images, DOM nodes, and average load time
- extract top 3 most important issues
- preserve page-level breakdown

## API design

Implement:

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `POST /analyze`
- `GET /analyses`
- `GET /analyses/:id`

### `POST /analyze`

Input:

- `url`

Response:

- full analysis result

Behavior:

- authenticated only
- enforce usage limit
- return detailed errors for validation failures

### `GET /analyses`

Response:

- recent analysis summaries for the logged-in user

### `GET /analyses/:id`

Response:

- one stored analysis if it belongs to the logged-in user

## Error handling

Implement consistent JSON errors with:

- `message`
- `code` optional
- `details` optional

Add centralized Express error middleware.

Differentiate:

- validation errors
- auth errors
- rate or usage limit errors
- crawl or analysis failures
- unexpected server errors

## Frontend experience

Build a modern but restrained SaaS interface.

Do not produce a flashy landing page. Build an authenticated product UI.

### Login page

Requirements:

- centered card layout
- email and password inputs
- login button
- register button or tab switch
- inline error display
- loading state

Behavior:

- on success, store JWT in localStorage
- redirect to dashboard
- if token already exists, try `/auth/me`

### Dashboard page

Use a two-level layout:

- top bar for branding and session actions
- main dashboard workspace for analysis and results

#### Section 1: URL input

- URL field
- run analysis button
- disabled/loading state during analysis

#### Section 2: Analysis progress

Show a staged loading UI:

- validating URL
- crawling pages
- scraping content
- evaluating issues
- generating report

Use a progress bar or staged loader.

#### Section 3: Overall score

Show:

- large numeric score
- health label
- strong visual emphasis

#### Section 4: Summary cards

Show counts for:

- critical or errors
- warnings
- passed checks or informational totals
- pages scanned

#### Section 5: Highlights

Display the top 3 most important findings with:

- severity
- short message
- recommendation snippet

#### Section 6: Category filtering sidebar

Categories:

- Links
- Buttons
- Inputs
- Forms
- Images
- Structure
- Meta
- Performance
- Accessibility
- Content
- Console

Behavior:

- clicking a category filters the issue list
- include an all-categories option

#### Section 7: Issue list

Each issue card should show:

- severity badge
- category
- short message
- page URL or path
- expandable explanation
- actionable recommendation

#### Section 8: Metrics panel

Display:

- total links
- buttons
- inputs
- images
- DOM size
- average or max load time

#### Section 9: Page breakdown

Show per-page results with:

- page URL
- page score
- issue count
- ability to inspect page-specific issues if practical

#### Section 10: Report actions

Add:

- export JSON
- copy summary

## Frontend state and API behavior

- keep auth token in localStorage for MVP simplicity
- attach bearer token to protected requests
- redirect to login when token is missing or invalid
- handle loading and error states explicitly
- keep analysis result in state after completion
- do not clear the previous report until a new run succeeds unless deliberate

## Performance and execution rules

- analysis timeout cap around 600 seconds
- max crawl pages 20
- max crawl depth 2
- analysis concurrency 3
- avoid unbounded parallel Playwright page creation

## Testing expectations

At minimum, add practical validation for:

- URL normalization logic
- score calculation
- one or two validator rules
- auth input or middleware behavior if lightweight tests are present

Also verify manually:

- register flow
- login flow
- protected analyze flow
- invalid URL rejection
- multi-page result rendering

## Step-by-step implementation plan

### Phase 1: Backend bootstrap

- initialize backend package
- install dependencies
- configure TypeScript
- create Express app and health route
- add environment loader
- verify server starts cleanly

### Phase 2: Prisma and auth

- define Prisma schema
- generate client
- wire Prisma singleton
- build register/login/me endpoints
- implement password hashing
- implement JWT middleware
- test auth flow

### Phase 3: URL safety and crawl foundation

- add URL normalization utilities
- add localhost/private-network blocking
- build crawler queue and visited set
- verify domain restriction logic

### Phase 4: Scraping

- build Playwright scrape service
- extract structured page data
- capture console errors and timings
- validate output shape on a few sample URLs

### Phase 5: Validation engine

- implement category-specific rule functions
- return normalized issues
- ensure each issue has explanation and recommendation

### Phase 6: Scoring and aggregation

- score each page
- compute site-wide score and labels
- generate highlights and category totals
- return final `AnalysisResult`

### Phase 7: Protected analysis API

- add `POST /analyze`
- persist report to database
- increment usage count after success
- add history endpoints

### Phase 8: Frontend bootstrap

- initialize Vite React app
- create auth screens
- create API client
- verify login/register and token persistence

### Phase 9: Dashboard implementation

- create dashboard layout
- wire URL submission
- render loading states
- render score, summaries, highlights, filters, issues, and page breakdown

### Phase 10: Final hardening

- improve empty states
- improve error presentation
- test edge cases
- confirm build succeeds

## Output discipline for the builder

When implementing from this prompt:

- create real files, not pseudo-code
- keep code runnable
- do not leave major TODOs in core flow
- favor complete MVP behavior over broad but shallow coverage
- explain tradeoffs only when they affect implementation

## Final success criteria

The project is successful when:

1. A user can register and log in.
2. A protected dashboard accepts a URL.
3. The backend crawls multiple pages on the same domain.
4. Each page is scraped and validated.
5. Issues are categorized and scored.
6. The final report is saved and returned.
7. The frontend renders a usable dashboard with filters, highlights, and page results.

## Final instruction

Build the backend first, verify it, then build the frontend against the real API. Test after every major phase. Do not skip intermediate verification.
