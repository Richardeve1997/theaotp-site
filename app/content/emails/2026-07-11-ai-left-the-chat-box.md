[Read this issue online](https://theaotp.com/letters/2026-07-11-ai-left-the-chat-box/)

# AI left the chat box this week. Here are five things I made with it.

AI stopped being a chat window this week. It watched a workday, spoke back in real time, rebuilt a website and rewired an information diet. The common thread is that the model is disappearing into the tool. You notice the result before you notice the AI.
These are the five things I made to understand that shift. I have kept the useful bit from each one: the repo, the template, the workflow, or the honest version of what it took to ship. Start with whichever one solves a problem you actually have.

## In this issue

1. [Your workday can write itself.](https://theaotp.com/letters/2026-07-11-ai-left-the-chat-box/#story-1)
2. [The shortcut to an animated website.](https://theaotp.com/letters/2026-07-11-ai-left-the-chat-box/#story-2)
3. [Nine million follows reveal who shapes tech.](https://theaotp.com/letters/2026-07-11-ai-left-the-chat-box/#story-3)
4. [The content engine has a human inside.](https://theaotp.com/letters/2026-07-11-ai-left-the-chat-box/#story-4)
5. [Open voice AI already feels live.](https://theaotp.com/letters/2026-07-11-ai-left-the-chat-box/#story-5)

---

## 01 · Local AI

### Your workday can write itself. No timers required.

[Dayflow turns everything you did on your Mac into a useful journal, without asking you to log a thing.](https://theaotp.com/letters/2026-07-11-ai-left-the-chat-box/#story-1)

[![Rich presenting a Dayflow Reel with the headline This is the future of AI startups](https://theaotp.com/media/issues/2026-07-11-ai-left-the-chat-box/dayflow-local-ai-time-tracker.jpg)](https://github.com/JerryZLiu/Dayflow)

**What shipped**

Dayflow is an open-source Mac app that watches your screen in the background and writes the journal of your workday. No timers, tags or notes. It reconstructs the day as a clean timeline of what you were actually doing.
You can choose a local model through Ollama or LM Studio, which keeps the analysis on your machine. Cloud providers are optional, not required.

**Why it matters**

The interesting part is not another productivity dashboard. Local models can now make sense of sensitive personal context without shipping it to somebody else's server. That unlocks software that works precisely because the AI lives with you.

**Build on the repo**

Install the app, run the local-model path, then treat its timeline as a starting point for the workflow you wish your computer understood automatically.

[Open it →](https://github.com/JerryZLiu/Dayflow)
- [Open the Dayflow repo](https://github.com/JerryZLiu/Dayflow)
- [Visit Dayflow](https://www.dayflow.so/)

---

## 02 · Build this

### The shortcut to an animated website. Iteration beats prompting.

[The best AI websites rarely begin with a blank prompt. They begin with taste, a proven template and a good substitution brief.](https://theaotp.com/letters/2026-07-11-ai-left-the-chat-box/#story-2)

[![Rich presenting three animated mobile website examples with the headline Level up your website the easy way](https://theaotp.com/media/issues/2026-07-11-ai-left-the-chat-box/ai-website-hero-3-steps.jpg)](https://motionsites.ai/)

**What shipped**

I used a three-step workflow to make the animated newsletter page you are looking at: Pinterest for direction, Midjourney and Gemini for the visual assets, then a proven motion prompt from motionsites.ai.
The final step was deliberately simple: paste the template into Claude and tell it exactly which images and video should replace the placeholders.

**Why it matters**

AI rewards iteration and art direction more than heroic one-shot prompting. Starting from a strong structure lets you spend your time choosing and refining, rather than persuading a model to rediscover a pattern somebody already solved.

**The three-step recipe**

1. Find the visual direction. 2. Borrow a motion pattern that already works. 3. Ask Claude to swap in your assets without changing the interaction model.

[Open it →](https://motionsites.ai/)
- [Browse MotionSites](https://motionsites.ai/)
- [See the finished site](https://theaotp.com/)

---

## 03 · Follow the signal

### Nine million follows reveal who shapes tech. Rebuild your feed around them.

[Digg used the X social graph to rank the people whose followings carry the strongest signal across AI, startups and investing.](https://theaotp.com/letters/2026-07-11-ai-left-the-chat-box/#story-3)

[![Rich presenting a Reel about the most influential technology people on X](https://theaotp.com/media/issues/2026-07-11-ai-left-the-chat-box/digg-x-rankings.jpg)](https://digg.com/tech/x/rankings)

**What shipped**

Digg mapped roughly nine million follow relationships to show how the tech community connects. The ranking surfaces people, companies and politicians actively shaping technology, with category views for AI, founders, investors and more.
The useful surface is the ranking itself: a set of names and categories you can use to rebuild a more deliberate information diet.

**Why it matters**

The editorial bet is information timing: a feed built around people doing the work should expose you to stronger ideas earlier than a feed optimised for mass reach. Curating your inputs remains one of the highest-leverage ways to improve what you know.

**Curate the algorithm**

Pick one field you want to understand, open the matching category, and follow the first ten people whose work is genuinely relevant. Do not copy the whole leaderboard; build a deliberate signal set.

[Open it →](https://digg.com/tech/x/rankings)
- [Explore the rankings](https://digg.com/tech/x/rankings)

---

## 04 · Rich's corner

### The content engine has a human inside. Take fourteen.

[Teaching people about AI and startups also means repeatedly forgetting how sentences work in front of a camera.](https://theaotp.com/letters/2026-07-11-ai-left-the-chat-box/#story-4)

[![Rich on camera under a caption about realising that teaching AI and startups means making content](https://theaotp.com/media/issues/2026-07-11-ai-left-the-chat-box/pov-bloopers.jpg)](https://www.instagram.com/artofthepossible.ai/)

**What shipped**

This 32-second compilation is the honest layer underneath the polished explainers: missed lines, resets and the strange reality of becoming an on-camera creator because you wanted to teach what you were building.
It is lighter than the four builds above, but it belongs in the week because it is what shipping the other four actually looked like.

**Why it matters**

A repeatable system should make the work easier without pretending the work is frictionless. Showing the resets is part of building in public, and a useful antidote to the idea that everybody else ships perfectly on the first take.

**Keep the rough cut**

Save the resets. The failed takes are useful feedback on the script, and occasionally they are the most human thing you made all week.

[Open it →](https://www.instagram.com/artofthepossible.ai/)
- [Follow the next build](https://www.instagram.com/artofthepossible.ai/)

---

## 05 · Open voice AI

### Open voice AI already feels live. The interface is changing.

[A real-time Hugging Face demo can hold a fast conversation, search the web and reason over a screenshot.](https://theaotp.com/letters/2026-07-11-ai-left-the-chat-box/#story-5)

[![Rich presenting a Reel with the headline You can now build anything with Voice AI](https://theaotp.com/media/issues/2026-07-11-ai-left-the-chat-box/hf-realtime-voice.jpg)](https://huggingface.co/spaces/smolagents/hf-realtime-voice)

**What shipped**

I tested an open-source real-time voice workflow rather than another polished assistant demo. In this test it responded quickly, searched the web, read a screenshot and moved between tasks without forcing the conversation back into a text box.
That is enough to imagine the next layer: tutors that can see the work, accessibility tools that can explain a screen, and home assistants that are useful because they understand context.

**Why it matters**

The demo suggests voice stops feeling like a novelty when latency gets low enough and the model can use tools. The interaction becomes closer to directing a collaborator than dictating into software.

**Start from an open demo**

Use a working real-time voice Space or repository as the harness, then add one narrow tool that makes the conversation useful for a real job.

[Open it →](https://huggingface.co/spaces/smolagents/hf-realtime-voice)
- [Try the real-time voice Space](https://huggingface.co/spaces/smolagents/hf-realtime-voice)
- [Open the speech-to-speech repo](https://github.com/huggingface/speech-to-speech)

---

See what's possible. Then build it.

[Browse every edition](https://theaotp.com/letters/)

[Unsubscribe]({{ unsubscribe_url }})
