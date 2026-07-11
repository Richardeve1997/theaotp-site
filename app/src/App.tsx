import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react'
import {
  Blocks,
  Compass,
  Gauge,
  GraduationCap,
  Instagram,
  Linkedin,
  Menu,
  Newspaper,
  Rocket,
  Sparkles,
  X,
  Zap,
} from 'lucide-react'
import heroFront from './assets/hero-front.webp'
import heroReveal from './assets/hero-reveal.webp'
import qualiaLogo from './assets/qualia-symbol.png'
import issueData from './data/issues.json'

const API_BASE = 'https://theaotp-gate.theaotp.workers.dev'
const WRAP = 'mx-auto max-w-wrap px-5 sm:px-10 md:px-14'

type Story = {
  order: number
  sourceSlug: string
  category: string
  title: { lead: string; muted?: string }
  hook: string
  treatment: string
  media: { poster: string; alt: string }
}

type Issue = {
  issueNumber: number
  slug: string
  publishedAt: string
  subject: string
  preheader: string
  title: { lead: string; muted: string }
  dek: string
  editorNote: string[]
  stories: Story[]
}

const issues = issueData as Issue[]
const latest = issues[0]
const latestStories = [...latest.stories].sort((a, b) => a.order - b.order)

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
    .format(new Date(value))
    .toUpperCase()
}

function SubscribeForm() {
  const [status, setStatus] = useState('')
  const formRef = useRef<HTMLFormElement>(null)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = formRef.current
    if (!form) return
    const email = (form.elements.namedItem('email') as HTMLInputElement).value.trim().toLowerCase()
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

  return (
    <>
      <form ref={formRef} onSubmit={onSubmit} noValidate className="flex items-stretch border-b-2 border-ink">
        <label className="sr-only" htmlFor="newsletter-email">Email address</label>
        <input
          id="newsletter-email"
          type="email"
          name="email"
          placeholder="you@somewhere.com"
          autoComplete="email"
          required
          className="min-w-0 flex-1 bg-transparent py-4 font-ui text-base text-ink outline-none placeholder:text-ink-mid"
        />
        <button
          type="submit"
          className="px-1 pl-7 font-display text-[13px] font-bold uppercase tracking-[0.06em] text-ink transition-opacity hover:opacity-60 active:translate-y-px"
        >
          Subscribe
        </button>
      </form>
      <p className="mt-3.5 text-[13px] text-ink-mid">One useful email a week. Unsubscribe any time.</p>
      <p className="mt-1.5 min-h-[1.2em] text-[13px] text-ink" aria-live="polite">{status}</p>
    </>
  )
}

function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      const hero = document.getElementById('hero')
      setScrolled(hero ? hero.getBoundingClientRect().bottom <= 72 : window.scrollY > 400)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const textColour = scrolled ? 'text-ink' : 'text-white'
  const secondaryColour = scrolled ? 'text-ink-soft hover:text-ink' : 'text-white/75 hover:text-white'

  return (
    <nav className={`fixed inset-x-0 top-0 z-[100] transition-colors duration-500 ${scrolled ? 'border-b border-rule bg-paper/95 backdrop-blur-md' : 'bg-transparent'}`}>
      <div className={`${WRAP} flex items-center justify-between py-4`}>
        <a href="#top" className="flex items-center gap-3" aria-label="Art of the Possible home">
          <img
            src={qualiaLogo}
            alt=""
            aria-hidden="true"
            className="h-6 w-6 object-contain transition-[filter] duration-500"
            style={{ filter: scrolled ? 'none' : 'brightness(0) invert(1)' }}
          />
          <span className={`whitespace-nowrap font-display text-[15px] font-bold uppercase leading-none tracking-[0.05em] transition-colors duration-500 ${textColour}`}>
            Art of the Possible<sup className="ml-0.5 align-super text-[0.55em]">®</sup>
          </span>
        </a>

        <div className="hidden items-center gap-7 sm:flex">
          <a href="#latest" className={`text-sm font-semibold transition-colors duration-500 ${textColour}`}>The letter</a>
          <a href="/letters/" className={`text-sm font-medium transition-colors duration-500 ${secondaryColour}`}>Archive</a>
          <a href="#about" className={`text-sm font-medium transition-colors duration-500 ${secondaryColour}`}>About</a>
          <a href="#subscribe" className={`px-5 py-2.5 font-display text-[13px] font-semibold transition-colors duration-500 ${scrolled ? 'bg-ink text-paper hover:opacity-85' : 'bg-white text-ink hover:bg-white/90'}`}>
            Subscribe
          </a>
        </div>

        <button
          className="p-1 sm:hidden"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={22} className={textColour} /> : <Menu size={22} className={textColour} />}
        </button>
      </div>

      {open && (
        <div className={`border-t px-5 py-5 sm:hidden ${scrolled ? 'border-rule bg-paper text-ink' : 'border-white/20 bg-black/80 text-white backdrop-blur-md'}`}>
          <div className="mx-auto flex max-w-wrap flex-col gap-4 font-display font-semibold">
            <a href="#latest" onClick={() => setOpen(false)}>The letter</a>
            <a href="/letters/" onClick={() => setOpen(false)}>Archive</a>
            <a href="#about" onClick={() => setOpen(false)}>About</a>
            <a href="#subscribe" onClick={() => setOpen(false)}>Subscribe</a>
          </div>
        </div>
      )}
    </nav>
  )
}

function Hero() {
  const heroRef = useRef<HTMLElement>(null)
  const revealRef = useRef<HTMLDivElement>(null)
  const target = useRef({ x: 0, y: 0 })
  const current = useRef({ x: 0, y: 0 })
  const active = useRef(false)
  const wakeAnimation = useRef<() => void>(() => undefined)

  useEffect(() => {
    let frame = 0
    let inView = true
    const animate = () => {
      frame = 0
      if (!active.current || !inView || document.hidden) return
      current.current.x += (target.current.x - current.current.x) * 0.11
      current.current.y += (target.current.y - current.current.y) * 0.11
      const layer = revealRef.current
      if (layer) {
        layer.style.setProperty('--x', `${current.current.x}px`)
        layer.style.setProperty('--y', `${current.current.y}px`)
      }
      frame = requestAnimationFrame(animate)
    }
    const wake = () => {
      if (!frame && active.current && inView && !document.hidden) frame = requestAnimationFrame(animate)
    }
    wakeAnimation.current = wake
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting
      if (!inView && frame) {
        cancelAnimationFrame(frame)
        frame = 0
      }
      wake()
    })
    if (heroRef.current) observer.observe(heroRef.current)
    document.addEventListener('visibilitychange', wake)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      observer.disconnect()
      document.removeEventListener('visibilitychange', wake)
    }
  }, [])

  function onPointerMove(event: ReactPointerEvent<HTMLElement>) {
    if (event.pointerType === 'touch') return
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - bounds.left
    const y = event.clientY - bounds.top
    target.current = { x, y }
    if (!active.current) {
      active.current = true
      current.current = { x, y }
      revealRef.current?.classList.add('is-active')
    }
    wakeAnimation.current()
  }

  const headingLine = 'block font-display font-extrabold hero-anim hero-reveal'
  const headingSize = { fontSize: 'clamp(40px, 7.8vw, 116px)' } as CSSProperties

  return (
    <section ref={heroRef} id="hero" className="relative h-[100dvh] w-full overflow-hidden bg-black" onPointerMove={onPointerMove}>
      <img
        className="hero-zoom absolute inset-0 z-10 h-full w-full object-cover object-center"
        src={heroFront}
        alt="A lone figure walking through a luminous open field"
        fetchPriority="high"
        style={{ filter: 'brightness(1.1)' }}
      />
      <div ref={revealRef} className="spotlight-reveal absolute inset-0 z-30 bg-cover bg-center bg-no-repeat pointer-events-none" style={{ backgroundImage: `url(${heroReveal})` }} aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-r from-black/35 via-black/10 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-32 bg-gradient-to-b from-black/25 to-transparent" />

      <div className="pointer-events-none absolute left-0 top-[15%] z-50 max-w-[1100px] px-6 sm:px-10 md:px-14">
        <h1 className="text-left leading-[0.95] tracking-[-0.045em] text-white">
          <span className={headingLine} style={{ ...headingSize, animationDelay: '0.25s' }}>New things</span>
          <span className={headingLine} style={{ ...headingSize, paddingLeft: 'clamp(24px, 7vw, 150px)', animationDelay: '0.4s' }}>
            are <em className="font-bold italic">possible</em>
          </span>
          <span className={headingLine} style={{ ...headingSize, animationDelay: '0.55s' }}>every day.</span>
        </h1>
      </div>

      <a href="#latest" className="hero-anim hero-fade absolute bottom-8 left-6 z-50 inline-flex items-center gap-3 text-white/75 transition-colors hover:text-white sm:left-10 md:left-14" style={{ animationDelay: '0.9s' }}>
        <span className="font-display text-[11px] font-semibold uppercase tracking-[0.22em]">Read the latest</span>
        <span className="hero-bounce text-lg leading-none">↓</span>
      </a>
    </section>
  )
}

const STATS = [
  { value: '$1.6b', label: 'consumer startup exit' },
  { value: '$4b+', label: 'enterprise revenue' },
  { value: '100k+', label: 'users reached' },
]

const COMPANIES = ['Eucalyptus', 'HCF', 'Juniper', 'compound', 'everlab', 'Qualia']

const JOURNEY = [
  { year: '2022', title: 'Joined Eucalyptus', body: 'One of the team of 10 that launched Juniper, now doing over $400m a year. Euc later sold to a NY-listed healthcare giant in a $1.6b deal.' },
  { year: '2022', title: 'Built my first AI product', body: "Won 1st place at Australia's largest generative-AI accelerator, back in the GPT-3 days." },
  { year: '2023–25', title: "Led Euc's AI products", body: 'Shipped multiple AI systems, including a healthcare assistant used by 100,000+ people globally.' },
  { year: '2025', title: 'Went all-in on Qualia', body: "Quit to build an AI mental-health coach to sit alongside therapy. It didn't work out, but I learnt a lot." },
  { year: '2026', title: 'AI innovation at HCF', body: "Now leading AI projects at Australia's largest health insurer, a $4b+ enterprise." },
]

const POST_TYPES = [
  { icon: Rocket, title: 'Side projects', body: 'A million things I want to build, and the full zero-to-one journey for each.' },
  { icon: GraduationCap, title: 'AI tutorials', body: 'The tools I actually use day to day, not just whatever gets the most likes and views.' },
  { icon: Newspaper, title: 'AI news that matters', body: 'The non-obvious updates, trends, and predictions you actually need to be across.' },
  { icon: Sparkles, title: 'Random', body: "Whatever you want to see, or whatever I feel like posting. It's not that serious." },
]

const FOR_YOU = [
  { icon: Zap, text: 'Stay at the cutting edge of AI.' },
  { icon: Blocks, text: 'Build your own startup with AI.' },
  { icon: Gauge, text: 'Get faster and better at using AI at work.' },
  { icon: Compass, text: "Learn from someone who's lived the unicorn startup journey." },
]

const SOCIALS = [
  { icon: Instagram, label: 'Instagram', href: 'https://www.instagram.com/artofthepossible.ai/' },
  { icon: Linkedin, label: 'LinkedIn', href: 'https://www.linkedin.com/in/richard-eve-545179138/' },
]

export default function App() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12 },
    )
    document.querySelectorAll('.rv').forEach((element) => observer.observe(element))
    const hashTarget = window.location.hash ? document.querySelector(window.location.hash) : null
    if (hashTarget) requestAnimationFrame(() => hashTarget.scrollIntoView())
    return () => observer.disconnect()
  }, [])

  return (
    <div id="top" className="bg-paper font-ui tracking-[-0.01em] text-ink">
      <div className="grain" aria-hidden="true" />
      <Nav />
      <Hero />

      <main>
        <div className="overflow-hidden whitespace-nowrap border-y border-rule py-6" aria-hidden="true">
          <div className="marquee-track inline-flex gap-16 font-display text-[clamp(15px,1.6vw,20px)] font-bold tracking-[-0.02em] text-ink-mid">
            <span className="inline-flex items-center gap-16">Five useful builds · The prompt behind each one · One honest field note ·</span>
            <span className="inline-flex items-center gap-16">Five useful builds · The prompt behind each one · One honest field note ·</span>
          </div>
        </div>

        <section id="latest" className={`${WRAP} scroll-mt-16 py-[clamp(64px,11vh,120px)]`}>
          <div className="grid items-start gap-10 md:grid-cols-[1.25fr_0.75fr] md:gap-[clamp(42px,7vw,110px)]">
            <div>
              <p className="rv mb-8 font-display text-[13px] font-bold uppercase tracking-[0.14em] text-ink-mid">
                The weekly letter · № {String(latest.issueNumber).padStart(3, '0')} · {formatDate(latest.publishedAt)}
              </p>
              <h2 className="rv max-w-[15ch] text-balance font-display text-[clamp(38px,5.8vw,78px)] font-extrabold leading-[0.99] tracking-[-0.045em]">
                {latest.title.lead} <span className="text-ink-mid">{latest.title.muted}</span>
              </h2>
              <p className="rv mt-7 max-w-[62ch] text-[17px] leading-relaxed text-ink-soft">{latest.editorNote[0]}</p>
              <a className="rv mt-8 inline-block border-b-2 border-ink pb-1 font-display font-bold" href={`/letters/${latest.slug}/`}>
                Read edition № {String(latest.issueNumber).padStart(3, '0')} →
              </a>
            </div>
            <div className="rv border-t border-ink pt-6 md:mt-12">
              <p className="mb-7 max-w-[44ch] text-[15px] leading-relaxed text-ink-soft">{latest.dek} Get the next five directly in your inbox.</p>
              <SubscribeForm />
            </div>
          </div>

          <div className="mt-[clamp(58px,9vh,100px)] border-t border-ink">
            {latestStories.map((story) => (
              <a
                key={story.sourceSlug}
                href={`/letters/${latest.slug}/#story-${story.order}`}
                className={`rv group grid gap-5 border-b border-rule py-7 transition-colors hover:bg-[#f6f6f3] sm:grid-cols-[54px_minmax(0,1fr)_150px] sm:items-center sm:px-3 ${story.treatment === 'richs-corner' ? 'bg-[#f6f6f3]' : ''}`}
              >
                <span className="font-display text-[18px] font-extrabold text-ink-mid">{String(story.order).padStart(2, '0')}</span>
                <span>
                  <small className="font-display text-[11px] font-bold uppercase tracking-[0.09em] text-ink-mid">{story.category}</small>
                  <strong className="mt-1 block font-display text-[clamp(22px,2.4vw,32px)] font-bold leading-[1.08] tracking-[-0.025em] transition-transform duration-200 group-hover:translate-x-1">
                    {story.title.lead} {story.title.muted && <span className="text-ink-mid">{story.title.muted}</span>}
                  </strong>
                  <em className="mt-2 block max-w-[68ch] text-[14px] not-italic leading-relaxed text-ink-soft">{story.hook}</em>
                </span>
                <img src={story.media.poster} alt="" className="hidden aspect-[3/2] w-full object-cover sm:block" loading="lazy" />
              </a>
            ))}
          </div>
        </section>

        <section className="border-t border-rule">
          <div className={`${WRAP} py-[clamp(52px,8vh,88px)]`}>
            <div className="rv flex flex-wrap items-end justify-between gap-5">
              <div>
                <p className="mb-4 font-display text-[13px] font-bold uppercase tracking-[0.14em] text-ink-mid">The archive</p>
                <h2 className="font-display text-[clamp(28px,3.8vw,50px)] font-extrabold tracking-[-0.04em]">Everything possible so far.</h2>
              </div>
              <a href="/letters/" className="border-b-2 border-ink pb-1 font-display font-bold">Browse all editions →</a>
            </div>
            <div className="rv mt-10 border-t border-ink">
              {issues.slice(0, 4).map((issue) => (
                <a key={issue.slug} href={`/letters/${issue.slug}/`} className="grid gap-2 border-b border-rule py-6 transition-colors hover:bg-[#f6f6f3] sm:grid-cols-[90px_1fr_140px_auto] sm:items-baseline sm:px-3">
                  <span className="text-[12px] text-ink-mid">№ {String(issue.issueNumber).padStart(3, '0')}</span>
                  <strong className="font-display text-[22px] tracking-[-0.02em]">{issue.subject}</strong>
                  <small className="text-[12px] text-ink-mid">{formatDate(issue.publishedAt)}</small>
                  <em className="font-display text-[12px] font-bold not-italic">Read →</em>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section id="about" className={`${WRAP} scroll-mt-16 py-[clamp(64px,11vh,120px)]`}>
          <p className="rv mb-8 font-display text-[13px] font-bold uppercase tracking-[0.14em] text-ink-mid">Start here · Who I am</p>
          <div className="grid items-start gap-10 md:grid-cols-[1.25fr_1fr] md:gap-[clamp(32px,5vw,96px)]">
            <h2 className="rv text-balance font-display text-[clamp(30px,4.3vw,58px)] font-extrabold leading-[1.02] tracking-[-0.04em]">
              I'm a massive nerd with <em className="italic">AI psychosis</em>, and enough real-world experience to have something to say about it.
            </h2>
            <div className="rv">
              <p className="text-[15px] leading-relaxed text-ink-soft">Ten years obsessed with startups and innovation. I've built AI products everywhere from a consumer startup that sold for $1.6b to one of Australia's largest enterprises, doing over $4b in revenue.</p>
              <p className="mt-4 text-[13px] italic leading-relaxed text-ink-mid">AI psychosis (noun): a state of all-consuming curiosity that leaves you unable to stop thinking about, tinkering with, or talking about AI.</p>
            </div>
          </div>

          <div className="rv mt-14 grid grid-cols-3 gap-6 border-t border-rule pt-10 sm:gap-10">
            {STATS.map((stat) => (
              <div key={stat.label}>
                <div className="font-display text-[clamp(30px,4.4vw,58px)] font-extrabold leading-none tracking-[-0.04em]">{stat.value}</div>
                <div className="mt-2 text-[12px] text-ink-soft sm:text-sm">{stat.label}</div>
              </div>
            ))}
          </div>

          <div className="rv mt-10 flex flex-wrap items-center gap-x-7 gap-y-3">
            <span className="font-display text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-mid">Built @</span>
            {COMPANIES.map((company) => <span key={company} className="font-display text-[15px] font-bold text-ink/70">{company}</span>)}
          </div>
        </section>

        <section className="border-t border-rule">
          <div className={`${WRAP} py-[clamp(64px,11vh,120px)]`}>
            <h2 className="rv mb-2 font-display text-[clamp(24px,2.6vw,34px)] font-bold tracking-[-0.03em]">The journey so far</h2>
            <p className="rv mb-10 max-w-[54ch] text-[15px] text-ink-soft">From a team of ten to a $1.6b exit, and plenty I broke along the way.</p>
            {JOURNEY.map((item) => (
              <div key={`${item.year}-${item.title}`} className="rv grid grid-cols-[64px_1fr] items-baseline gap-x-[clamp(16px,3vw,48px)] gap-y-1.5 border-t border-rule py-[clamp(22px,3.5vh,36px)] transition-colors hover:bg-[#f6f6f3] md:grid-cols-[minmax(90px,160px)_1fr_1.1fr]">
                <span className="font-display text-[clamp(17px,1.9vw,26px)] font-extrabold tracking-[-0.03em]">{item.year}</span>
                <h3 className="font-display text-[clamp(18px,2vw,26px)] font-bold leading-[1.1] tracking-[-0.02em]">{item.title}</h3>
                <p className="col-start-2 max-w-[48ch] text-[15px] text-ink-soft md:col-start-3">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-ink">
          <div className={`${WRAP} py-[clamp(72px,13vh,150px)]`}>
            <p className="rv mb-8 font-display text-[13px] font-bold uppercase tracking-[0.14em] text-ink-mid">Why I'm writing this</p>
            <p className="rv max-w-[24ch] text-balance font-display text-[clamp(28px,3.8vw,52px)] font-extrabold leading-[1.06] tracking-[-0.035em]">We're less than five years from AGI. That can be scary. It can also be the best time in history to <em className="italic">build</em>.</p>
            <p className="rv mt-8 max-w-[62ch] text-[clamp(16px,1.5vw,20px)] leading-relaxed text-ink-soft">One person, a laptop, and curiosity have never been able to make a bigger dent. I've been heads-down building for a decade. Now I want to share it, and build with you. That's why I write this letter: to help you find that excitement, and see the art of the possible with AI.</p>
          </div>
        </section>

        <section className="border-t border-rule">
          <div className={`${WRAP} py-[clamp(64px,11vh,120px)]`}>
            <h2 className="rv mb-10 font-display text-[clamp(24px,2.6vw,34px)] font-bold tracking-[-0.03em]">What you'll get</h2>
            <div className="grid gap-x-[clamp(24px,5vw,80px)] gap-y-10 sm:grid-cols-2">
              {POST_TYPES.map(({ icon: Icon, title, body }) => (
                <div key={title} className="rv flex gap-5">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-ink"><Icon size={20} strokeWidth={1.75} /></div>
                  <div><h3 className="mb-1 font-display text-[clamp(19px,2vw,24px)] font-bold tracking-[-0.02em]">{title}</h3><p className="max-w-[42ch] text-[15px] text-ink-soft">{body}</p></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="subscribe" className="scroll-mt-16 border-t border-ink">
          <div className={`${WRAP} grid items-start gap-12 py-[clamp(64px,11vh,120px)] md:grid-cols-2 md:gap-[clamp(32px,5vw,96px)]`}>
            <div>
              <h2 className="rv mb-8 text-balance font-display text-[clamp(28px,3.8vw,52px)] font-extrabold leading-[1.02] tracking-[-0.04em]">This is for you if you want to…</h2>
              <ul className="space-y-4">
                {FOR_YOU.map(({ icon: Icon, text }) => <li key={text} className="rv flex items-center gap-4"><Icon size={20} strokeWidth={1.75} className="shrink-0" /><span className="text-[16px] text-ink-soft">{text}</span></li>)}
              </ul>
            </div>
            <div className="rv md:pt-1">
              <p className="mb-7 max-w-[44ch] text-[15px] text-ink-soft">One email a week: what shipped, the lever that made it work, and the recipe to build it yourself. No drip, no sales sequence.</p>
              <SubscribeForm />
              <p className="mt-9 font-display text-[clamp(18px,2vw,24px)] font-bold leading-[1.15] tracking-[-0.02em]">Follow to make me this happy, and to understand the art of the possible.</p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                {SOCIALS.map(({ icon: Icon, label, href }) => (
                  <a key={label} href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 border border-ink px-4 py-2.5 font-display text-[13px] font-semibold transition-colors hover:bg-ink hover:text-paper"><Icon size={17} strokeWidth={2} />{label}</a>
                ))}
              </div>
            </div>
          </div>
        </section>

        <footer className="border-t border-rule">
          <div className={`${WRAP} flex flex-wrap items-center justify-between gap-6 py-8 text-[13px] text-ink-mid`}>
            <span className="font-display text-xs font-bold uppercase tracking-[0.04em] text-ink">Art of the Possible<sup className="ml-0.5 align-super text-[0.55em]">®</sup></span>
            <div className="flex items-center gap-4">
              {SOCIALS.map(({ icon: Icon, label, href }) => <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="transition-colors hover:text-ink"><Icon size={18} strokeWidth={1.9} /></a>)}
            </div>
            <span>New things are possible every day. · 2026</span>
          </div>
        </footer>
      </main>
    </div>
  )
}
