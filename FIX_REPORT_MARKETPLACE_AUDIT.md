# TaskMarket Fix Report

## Files changed
- `src/lib/tasks.js`
- `src/pages/PostTask.jsx`
- `src/pages/BrowseTasks.jsx`
- `src/pages/Dashboard.jsx`
- `src/components/LoadingSpinner.jsx`
- `src/contexts/AuthContext.jsx`
- `firestore.rules`

## What was wrong
- Browse Tasks depended on `orderBy('createdAt')`, which can exclude documents missing `createdAt` and make newly posted or legacy tasks disappear from the list.
- Search only matched title, description, and skills, so many valid tasks were not discoverable.
- Task documents did not persist explicit visibility/search metadata or a client timestamp fallback.
- Dashboard fetched posted tasks only with `postedById`, which could miss legacy documents saved with email-only ownership fields.
- Dashboard used two listeners against the same collection unnecessarily.
- Global loading feedback was weak and task/browse/dashboard loading states were hard to read.
- Auth error normalization did not cover some modern Firebase login error codes.
- Firestore rules did not account for the new visibility field and client-side update timestamp used during bidding.

## What was fixed
- Added a shared task normalizer and client-side newest-first sort helper.
- Browse Tasks now reads the whole `tasks` collection safely, normalizes documents, excludes only private tasks, and sorts in the client.
- Search now covers title, description, category, location, skills, and poster name.
- New task creation now saves `visibility`, `searchText`, `clientCreatedAt`, and `clientUpdatedAt` along with the existing fields.
- Dashboard now uses a single normalized task stream, computes posted tasks and bids from the same dataset, and supports both `postedById` and legacy `postedBy` email ownership.
- Loading UI now includes readable labels.
- Auth error handling now supports `auth/invalid-login-credentials` and network failures.
- Firestore rules were updated to allow `visibility` on create and `clientUpdatedAt` during bid updates.

## Notes
- After deploying the updated Firestore rules, republish rules from the Firebase console or CLI.
- Existing legacy tasks without `status` or `visibility` are normalized in the UI and should now appear in Browse Tasks.
