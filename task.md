# Tasks

## 1. Scraping Engine — Listing Card Extraction
- [x] Add `extractListingCards()` to `dom-extractor.ts` (parse repeating card elements)
- [x] Upgrade `discovery.ts` pagination to generate all `?page=N` URLs programmatically
- [x] Add listing-mode flow to `job.processor.ts` (extract cards → store → paginate)

## 2. Frontend — Leads Table Improvements
- [x] Truncate all table cells to ~30 chars max for compact layout
- [x] Add more columns (WhatsApp, Description, Source URL)
- [x] Improve pagination for 10,000+ leads (show page numbers, jump-to-page)
- [x] Add Address column alongside Location

## 3. Frontend — Export Column Selector
- [x] Add export modal with column checkboxes
- [x] Let users pick which columns to include in CSV export
- [x] Send selected columns to API export endpoint

## 4. Frontend — Job Click → Leads Table
- [x] Clicking completed job row navigates to `/leads?jobId=X`
- [x] Keep "View Feed" for in-progress jobs

## 5. Verification
- [/] Build passes with 0 errors
- [ ] Manual test of scraping + export flow
