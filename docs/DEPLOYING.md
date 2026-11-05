# Deploying safely

The same four steps every time. They exist because a deploy can break things in three ways: the code and the database go live in the wrong order, one change leaves other screens behind, or nobody checks after it goes live.

1. **Before:** `npm run verify` (about 2 minutes). Runs the types, every unit test and the same no-settings build Vercel does. For a big change use `npm run verify:full` (about 10 minutes), which also runs every browser test on the team app and the customer portal. GitHub runs the quick version on every push too: a red tick means do not deploy.
2. **Database change?** If the push adds a folder under `prisma/migrations`, apply it to the live database **before** deploying when it only adds things (a new column or table). The old code ignores them and the new code needs them. If it changes or removes something the old code uses, deploy first and apply it straight after, and say so in the commit. Ask in the chat if unsure.
3. **Deploy.**
4. **After:** `npm run smoke` (20 seconds). It checks the live pages, files and `/api/health`, which reads every table the code knows about and names any table whose live columns do not match the code. Green means the deploy is healthy. Red means fix or roll back before anyone is told.

Rolling back: in Vercel, Deployments, open the last good one, Promote to Production. A database change that only added things can stay.
