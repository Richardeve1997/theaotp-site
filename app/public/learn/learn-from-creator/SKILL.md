---
name: learn-from-creator
description: Turn an Instagram creator's Reels and the guides they give away into Claude skills you can use in your own work. Use when I say "learn from @handle", "turn this creator into skills", "what does @handle teach", or ask you to find creators who teach a skill I want to build.
---

# Learn from a creator

You take a creator's recent Instagram Reels, pull out what they teach, collect the free guides they offer ("comment X and I'll send you Y"), and turn the useful parts into skills in `~/.claude/skills/`. You work from what the creator actually said and shared. Never invent a lesson, step or link.

## 1. Ask first, then wait for my answers

1. **Which creator?** An Instagram handle. If I don't have one, ask what I want to learn and go to step 1b.
2. **What am I trying to get better at?** One or two sentences, such as "running ads for my bakery" or "using Claude Code for data analysis". Everything after this gets filtered through it.
3. **How many Reels?** Default to the 20 most recent.
4. **Which email should you use when a guide page asks for one?** It has to be a real address. Most pages reject made-up ones.
5. **Can you follow, like, save and comment from my Instagram account?** Show me each comment before you post it.

### 1b. Finding creators (only if I didn't name one)

Search Instagram and the web for creators who teach what I said I want to learn. Look for people who show their work on screen and give away guides, prompts or templates. Show me up to five, each with one line on what they teach and a link to a Reel that proves it, then let me pick.

## 2. Set up

- Check for, and install if missing: `ffmpeg` and `yt-dlp` (on a Mac, use Homebrew), plus the `faster-whisper` Python package. Install faster-whisper in a virtual environment in the working folder (`python3 -m venv .venv`), or run it with `uv`, so it doesn't fight the system Python.
- I need to be logged in to Instagram in Chrome. Drive the browser with the Claude in Chrome extension. If it isn't connected, tell me to install it from claude.ai/chrome and wait.
- Make a working folder `learning/<handle>/` with `videos/`, `transcripts/` and `guides/` inside it.

## 3. Collect the Reels

1. Open `instagram.com/<handle>` and follow the account if I'm not already following it.
2. Open the Reels tab and collect the most recent N Reel links, newest first. The grid loads slowly, so scroll one screen at a time and wait for new tiles. Save each link and its full caption to `reels.md`.
3. Open each Reel at `instagram.com/p/<shortcode>/` (the post opens with its buttons), like it and save it with the bookmark icon. Skip any that are already liked or saved.

## 4. Download and transcribe

Download each Reel with `yt-dlp -o "videos/%(id)s.%(ext)s" --write-info-json <link>` (add `--cookies-from-browser chrome` if Instagram blocks it). Transcribe each one with faster-whisper (`small.en` is enough) and save the caption plus transcript to `transcripts/<shortcode>.md`. If a download fails, note it and keep going.

## 5. Find the guides

Read every transcript and caption. Whenever the creator says "comment X", "DM me X" or "link in bio for X", record the Reel, the keyword and what they promised. Show me the list, marking the ones that match what I want to get better at.

## 6. Comment and collect

1. For each guide I approve, comment exactly the keyword on its Reel. Click the **Post** button (pressing Enter doesn't always post) and check the comment appears under my name. Leave about a minute between comments so Instagram doesn't flag the account.
2. Open `instagram.com/direct/inbox` and check **Requests** too. Creators' automations reply by DM, usually within a minute.
3. If a DM asks me to confirm I follow and mentions a button, stop and ask me to tap it in the Instagram app on my phone. Those buttons don't show up on the Instagram website, and typing the words doesn't work. The guide arrives in the same chat once I've tapped it.
4. Open each guide link. If the page asks for an email, use the one I gave you. Save the whole unlocked page (text, prompts, code blocks and links) to `guides/<keyword>.md`.
5. If a guide hasn't arrived after a few minutes, move on and check again at the end. Never guess a guide's URL.

## 7. Write the skills

Group the lessons from the transcripts and guides by the job they help with, and keep only the groups that serve what I want to get better at. For each group, write `~/.claude/skills/<name>/SKILL.md`:

- a short, clear `name` and a `description` that says when to use it
- the steps, keeping the creator's exact prompts, commands and settings
- a `Why:` line citing the Reel link or guide each part came from

Don't add steps that aren't in the source material. If a guide tells you to install someone else's repo or skill, list it and ask me before installing it, and read its SKILL.md first.

## 8. Report back

Tell me which skills you made, what each is for and where it came from. Then give me the five tips from these Reels that matter most for what I want to get better at, and the one thing I should try today.
