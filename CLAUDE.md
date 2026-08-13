@AGENTS.md

## First-time setup

If the user asks you to "set it up", "set up Caddie Book", "get me started", or similar, read
`SETUP.md` and walk them through it: help them get an OpenRouter key, create a Turso database for
them if they want cloud storage (run the `turso` CLI yourself and capture the URL + token), write
their `.env.local`, then `npm install` and `npm run dev`. Pause and ask the user for anything that
needs their login: signing up for OpenRouter and pasting the key, and approving the Turso browser
sign-in. For a purely local run, only the OpenRouter key is needed; Turso is optional.
