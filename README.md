MedEx Service Explorer

A healthcare service browsing application built for the MedEx Senior Frontend Engineer take-home exercise using Next.js, React, and TypeScript.

Getting Started

Prerequisites

Node.js compatible with the installed Next.js version

npm

Installation and development

Clone the repository, enter the project directory, and run:

npm install
npm run dev

Open http://localhost:3000 in your browser.

Production build

npm run build
npm run start

Run npm run build before starting the production server.

Available scripts

Command

Purpose

npm run dev

Start the development server

npm run build

Compile and validate the production build

npm run start

Start the production server

npm run lint

Run ESLint

Technology and Architecture

Next.js App Router: Provides the application structure and API route.

React and TypeScript: Used to build the interactive service explorer and define data types.

Next.js API route: app/api/services/route.ts exposes service data through /api/services.

Local JSON data: The dataset is stored in data/medex.json and accessed through the API route rather than imported directly into the page component.

URL-based state: Implemented filters and sorting are represented in URL query parameters so that the view can be shared and navigated through browser history.

The application uses the existing Next.js project setup and native React state and URL navigation, avoiding additional state-management and UI-library dependencies.

Implemented Functionality

The current implementation includes:

Service results grouped by provider.

Provider names, ratings, and a fallback for missing ratings.

A maximum of three initially displayed services per provider, with an option to expand the list.

Category and subcategory filtering.

Multi-select service-type filtering.

Searchable, multi-select provider filtering.

Free-text search across service and provider-related information.

Sorting options for relevance, price, and rating.

Visibility filtering for active services and active providers, with category eligibility checks.

Loading and error handling for service data retrieval.

The production build has been run successfully, including TypeScript validation.

Data Handling and Decisions

Service visibility

The implementation filters out inactive services and providers. It also checks category eligibility according to the current filtering logic. Data without a category should be reviewed against the exercise's visibility rules before treating the behavior as final.

Multiple currencies

Service prices belong to their providers. THB, NPR, and INR must not be added together or silently converted without exchange-rate data.

Price comparisons across currencies require a currency-aware design. The current implementation groups providers by currency for price sorting rather than treating amounts in different currencies as directly comparable.

Relevance

The current relevance ordering prioritizes providers with more matching services, followed by provider name. This is a simple, explainable baseline rather than a sophisticated search-ranking algorithm.

Technology trade-offs

Using a Next.js API route keeps the mock API close to the application and makes local development straightforward. Native React state and URL parameters keep dependencies minimal. A larger application could benefit from more explicit separation between filtering, pricing, data normalization, and presentation logic.

Known Limitations and Future Improvements

This is a time-boxed take-home implementation. The following items need further implementation or verification before they can be considered complete:

City and country filters.

Available-as-home-test filtering.

Currency-aware price-range filtering.

Live facet counts calculated against all other active filters, including unavailable options.

Comprehensive verification of final prices, discounts, service charges, and wellness duration options.

Full URL restoration for every filter, sorting option, and page number, including initial-render behavior and browser back/forward navigation.

The mobile filter drawer and pending-result count.

Skeleton loading, empty-result recovery, accessible result announcements, and comprehensive keyboard and responsive behavior.

An on-demand mock API failure mechanism and realistic latency behavior.

Dedicated unit and integration tests for filtering, pricing, sorting, and edge cases.

Performance measurements for filter updates, facet counts, search input responsiveness, and layout stability.

Verification of the two top-level categories that share the ultrasound slug.

A final accessibility audit and production smoke test.

With more time, I would separate core filtering and pricing functions into independently testable modules, add comprehensive tests for the dataset's inconsistencies, implement the remaining facets, and measure performance against the full dataset of 3,200 services.

Testing and Validation

The following validation has been performed:

git diff --check completed without reporting errors.

npm run build completed successfully, including TypeScript validation and Next.js production compilation.

Dedicated automated tests have not yet been added. The successful production build should not be interpreted as proof that every assignment requirement has been met.

Performance targets from the exercise have not yet been formally measured.

AI Tool Disclosure

ChatGPT was used as an assistance tool during development to help understand the assignment, reason about implementation decisions, troubleshoot issues, and prepare documentation.

The implementation should be reviewed and understood by the author. AI assistance does not replace the need to verify behavior, explain the code, and validate the final submission.

Submission Status

This repository represents the current implementation at the time of submission. Known gaps are documented above rather than presented as completed functionality.