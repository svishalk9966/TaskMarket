# Auth + Task Posting Fix Report

## Files changed
- `src/contexts/AuthContext.jsx`
- `src/pages/Login.jsx`
- `src/pages/Signup.jsx`
- `src/pages/PostTask.jsx`

## What was wrong
- Auth errors were stored globally and could leak between signup and login screens.
- Login and signup pages were reusing stale auth error state, which could surface the wrong message such as “account already exists” when the user was trying to sign in.
- Auth buttons used weak loading feedback.
- Task posting showed a faint loading state that was easy to miss, especially in dark mode.
- Task posting used a delayed redirect pattern that felt like indefinite loading.
- Form fields stayed active during task submission, making duplicate submits more likely.

## What was fixed
- Added `clearError()` to auth context and now clear auth errors when login/signup pages mount and when users start typing again.
- Improved auth error normalization so signup-only messages are not shown for normal login attempts.
- Updated login and signup buttons to show explicit spinner + action text.
- Upgraded task submission UX with:
  - visible status alert
  - stronger loading spinner visibility
  - `Posting Task...` button state
  - disabled inputs while submitting
  - duplicate submit protection
  - clearer success message before redirect
- Reduced redirect delay after successful post so the flow feels responsive instead of stuck.
