---
"@okforest/okf": minor
"@okforest/validate": minor
"okforest": minor
---

**`okf/draft-verified`** (warning): a concept with `status: draft` that's verified as it stands contradicts itself, since OKF calls a draft not reviewed yet. If the review approved it, mark it `stable`; if it isn't ready, it shouldn't be verified yet. Only current verifications count (on or after `generated.at`), so one from before the content last changed doesn't trip it.
