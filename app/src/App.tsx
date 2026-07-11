import { useRef, useState, type CSSProperties, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react'
import heroFront from './assets/hero-front.webp'
import heroReveal from './assets/hero-reveal.webp'
import qualiaLogo from './assets/qualia-symbol.png'
import issueData from './data/issues.json'

const API_BASE = 'https://theaotp-gate.theaotp.workers.dev'

type Story = {
  order: number
  sourceSlug: string
  category: string
  title: { lead: string; muted?: string }
  hook: string
  treatment: string
}

type Issue = {
  issueNumber: number
  slug: string
  publishedAt: string
  subject: string
  title: { lead: string; muted: string }
  dek: string
  editorNote: string[]
  stories: Story[]
}

const issues = issueData as Issue[]
const latest = issues[0]

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
    .format(new Date(value))
    .toUpperCase()
}

function SubscribeForm({ inverse = false, compact = false }: { inverse?: boolean; compact?: boolean }) {
  const [status, setStatus] = useState('')

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const email = new FormData(form).get('email')?.toString().trim().toLowerCase() ?? ''
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus('That email looks off. Try again.')
      return
    }
    setStatus('One sec…')
    try {
      const response = await fetch(`${API_BASE}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!response.ok) throw new Error('subscribe failed')
      setStatus('Check your inbox to confirm your subscription.')
      form.reset()
    } catch {
      setStatus('Something broke on our end. Try again in a minute.')
    }
  }

  const id = `email-${inverse ? 'footer' : compact ? 'nav' : 'hero'}`
  return (
    <div className={`subscribe-wrap ${inverse ? 'subscribe-wrap--inverse' : ''} ${compact ? 'subscribe-wrap--compact' : ''}`}>
      <form className="subscribe-form" onSubmit={onSubmit} noValidate>
        <label className="sr-only" htmlFor={id}>Email address</label>
        <input id={id} name="email" type="email" autoComplete="email" placeholder="you@somewhere.com" required />
        <button type="submit">Subscribe</button>
      </form>
      {!compact && <p className="fineprint">One useful email a week. Confirm once. Unsubscribe any time.</p>}
      <p className="form-status" aria-live="polite">{status}</p>
    </div>
  )
}

function Header() {
  return (
    <header className="site-header shell-pad">
      <a className="brand" href="/" aria-label="Art of the Possible home">
        <img src={qualiaLogo} alt="" aria-hidden="true" />
        <span>Art of the Possible<sup>®</sup></span>
      </a>
      <nav aria-label="Primary navigation">
        <a href="#latest">Latest</a>
        <a href="/letters/">Archive</a>
        <a href="#about">About</a>
      </nav>
      <a className="header-cta" href="#subscribe">Subscribe</a>
    </header>
  )
}

function RevealHero() {
  const revealRef = useRef<HTMLDivElement>(null)

  function moveReveal(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'touch') return
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - bounds.left) / bounds.width) * 100
    const y = ((event.clientY - bounds.top) / bounds.height) * 100
    revealRef.current?.style.setProperty('--x', `${x}%`)
    revealRef.current?.style.setProperty('--y', `${y}%`)
  }

  return (
    <div className="reveal-hero" onPointerMove={moveReveal}>
      <img className="reveal-base" src={heroFront} alt="A lone figure walking through a luminous open field" />
      <div
        ref={revealRef}
        className="reveal-layer"
        style={{ '--x': '64%', '--y': '48%', backgroundImage: `url(${heroReveal})` } as CSSProperties}
        aria-hidden="true"
      />
      <div className="reveal-caption"><span /> Move across the field to reveal what is possible</div>
    </div>
  )
}

function LatestIssue() {
  return (
    <section className="latest shell-pad" id="latest">
      <div className="section-rail">
        <span className="azure-dot" />
        <strong>Latest edition</strong>
        <small>№ {String(latest.issueNumber).padStart(3, '0')} · {formatDate(latest.publishedAt)}</small>
      </div>
      <div className="latest-main">
        <p className="kicker">The week in five builds</p>
        <h2>{latest.title.lead} <span className="muted">{latest.title.muted}</span></h2>
        <p className="latest-dek">{latest.dek}</p>
        <p className="editor-excerpt">{latest.editorNote[0]}</p>
        <a className="text-link" href={`/letters/${latest.slug}/`}>Read edition № {String(latest.issueNumber).padStart(3, '0')} <span>→</span></a>
      </div>
    </section>
  )
}

function ThisWeeksFive() {
  return (
    <section className="weekly shell-pad" aria-labelledby="weekly-title">
      <div className="section-rail"><strong>Inside this week</strong></div>
      <div className="weekly-main">
        <h2 id="weekly-title">Five things worth <span className="muted">opening.</span></h2>
        <div className="story-list">
          {latest.stories.map((story) => (
            <a key={story.sourceSlug} href={`/letters/${latest.slug}/#story-${story.order}`} className={`story-row story-row--${story.treatment}`}>
              <span className="story-number">{String(story.order).padStart(2, '0')}</span>
              <span className="story-row-copy">
                <small>{story.category}</small>
                <strong>{story.title.lead} {story.title.muted && <span>{story.title.muted}</span>}</strong>
                <em>{story.hook}</em>
              </span>
              <span className="story-arrow" aria-hidden="true">↗</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}

function ArchivePreview() {
  return (
    <section className="archive-preview shell-pad">
      <div className="section-rail"><strong>The archive</strong></div>
      <div className="archive-main">
        {issues.map((issue) => (
          <a className="archive-row" href={`/letters/${issue.slug}/`} key={issue.slug}>
            <span>№ {String(issue.issueNumber).padStart(3, '0')}</span>
            <strong>{issue.subject}</strong>
            <small>{formatDate(issue.publishedAt)}</small>
            <em>Read →</em>
          </a>
        ))}
        <a className="text-link" href="/letters/">Browse every edition <span>→</span></a>
      </div>
    </section>
  )
}

function About() {
  return (
    <section className="about shell-pad" id="about">
      <div className="section-rail"><strong>Why listen to Rich?</strong></div>
      <div className="about-main">
        <h2>I build with AI for a living. <span className="muted">Then I show my working.</span></h2>
        <div className="about-copy">
          <p>Ten years inside startups and enterprise innovation, from a consumer startup acquired in a $1.6b deal to AI products used by more than 100,000 people.</p>
          <p>This letter is the practical layer: the thing that shipped, the decision that made it work, and the exact starting point you can reuse.</p>
        </div>
      </div>
    </section>
  )
}

export default function App() {
  return (
    <div className="site-shell">
      <Header />
      <main>
        <section className="hero-copy shell-pad">
          <div className="hero-rail"><span className="azure-dot" /> The letter · weekly</div>
          <div className="hero-main">
            <h1>Five useful things I made this week. <span className="muted">The prompts are inside.</span></h1>
            <p>A field note from the studio: what shipped, why it matters, and the lever you can copy before the idea becomes obvious.</p>
            <SubscribeForm />
          </div>
        </section>
        <RevealHero />
        <LatestIssue />
        <ThisWeeksFive />
        <ArchivePreview />
        <About />
        <section className="deep-subscribe shell-pad" id="subscribe">
          <div className="section-rail"><span className="azure-dot" /> Every Friday</div>
          <div>
            <h2>See what's possible. <span className="muted">Then build it.</span></h2>
            <p>One letter. Five working examples. The recipe behind each one.</p>
            <SubscribeForm inverse />
          </div>
        </section>
      </main>
      <footer className="site-footer shell-pad">
        <span>Art of the Possible®</span>
        <div><a href="https://www.instagram.com/artofthepossible.ai/">Instagram</a><a href="https://www.linkedin.com/in/richard-eve-545179138/">LinkedIn</a></div>
        <span>New things are possible every day. · 2026</span>
      </footer>
    </div>
  )
}
