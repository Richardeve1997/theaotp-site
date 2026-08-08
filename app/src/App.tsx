import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import {
  Blocks,
  ChevronDown,
  Compass,
  Gauge,
  Instagram,
  Linkedin,
  Menu,
  X,
  Zap,
} from 'lucide-react'
import heroFront from './assets/hero-front.webp'
import heroReveal from './assets/hero-reveal.webp'
import qualiaLogo from './assets/qualia-symbol.png'
import richSpeaking from './assets/about/rich-speaking.jpg'
import whySky from './assets/why-sky.jpg'
import whySkyReveal from './assets/why-sky-reveal.jpg'
import iconProjects from './assets/about/icons/side-projects.png'
import iconTutorials from './assets/about/icons/ai-tutorials.png'
import iconNews from './assets/about/icons/ai-news.png'
import logoEucalyptus from './assets/about/logo-eucalyptus.png'
import logoHcf from './assets/about/logo-hcf.png'
import logoJuniper from './assets/about/logo-juniper.png'
import logoCompound from './assets/about/logo-compound.png'
import logoEverlab from './assets/about/logo-everlab.png'
import logoQualia from './assets/about/logo-qualia.png'

const API_BASE = 'https://theaotp-gate.theaotp.workers.dev'
const WRAP = 'mx-auto max-w-wrap px-5 sm:px-10 md:px-14'

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="rv mb-8 flex items-center gap-3 font-display text-[14px] font-extrabold uppercase tracking-[0.14em] text-ink">
      <span className="inline-block h-[3px] w-9 bg-ink" aria-hidden="true" />
      {children}
    </p>
  )
}

function SubscribeForm({ idSuffix = 'a' }: { idSuffix?: string }) {
  const [status, setStatus] = useState('')
  const formRef = useRef<HTMLFormElement>(null)
  const inputId = `newsletter-email-${idSuffix}`

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
      const data = await response.json().catch(() => null)
      setStatus(data && data.new === false ? "You're already on the list. See you Friday." : 'Check your inbox to confirm your subscription.')
      form.reset()
    } catch {
      setStatus('Something broke on our end. Try again in a minute.')
    }
  }

  return (
    <>
      <form ref={formRef} onSubmit={onSubmit} noValidate className="flex items-stretch border-b-2 border-ink">
        <label className="sr-only" htmlFor={inputId}>Email address</label>
        <input
          id={inputId}
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
      <p className="mt-3.5 text-[13px] text-ink-mid">Unsubscribe any time.</p>
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
          <a href="#about" className={`text-sm font-medium transition-colors duration-500 ${secondaryColour}`}>About</a>
          <a href="#signup" className={`px-5 py-2.5 font-display text-[13px] font-semibold transition-colors duration-500 ${scrolled ? 'bg-ink text-paper hover:opacity-85' : 'bg-white text-ink hover:bg-white/90'}`}>
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
            <a href="#signup" onClick={() => setOpen(false)}>Subscribe</a>
            <a href="#about" onClick={() => setOpen(false)}>About</a>
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

      <a href="#signup" className="hero-anim hero-fade absolute bottom-8 left-6 z-50 inline-flex items-center gap-3 text-white/75 transition-colors hover:text-white sm:left-10 md:left-14" style={{ animationDelay: '0.9s' }}>
        <span className="font-display text-[11px] font-semibold uppercase tracking-[0.22em]">Start here</span>
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

const COMPANY_LOGOS = [
  { src: logoEucalyptus, name: 'Eucalyptus' },
  { src: logoHcf, name: 'HCF' },
  { src: logoJuniper, name: 'Juniper' },
  { src: logoCompound, name: 'compound' },
  { src: logoEverlab, name: 'everlab' },
  { src: logoQualia, name: 'Qualia' },
]

const JOURNEY = [
  { year: '2022', title: 'Joined Eucalyptus', body: 'One of the team of 10 that launched Juniper, now doing over $400m a year. Euc later sold to a NY-listed healthcare giant in a $1.6b deal.' },
  { year: '2022', title: 'Built my first AI product', body: "Won 1st place at Australia's largest generative-AI accelerator, back in the GPT-3 days." },
  { year: '2023–25', title: "Led Euc's AI products", body: 'Shipped multiple AI systems, including a healthcare assistant used by 100,000+ people globally.' },
  { year: '2025', title: 'Went all-in on Qualia', body: "Quit to build an AI mental-health coach to sit alongside therapy. It didn't work out, but I learnt a lot." },
  { year: '2026', title: 'AI innovation at HCF', body: "Now leading AI projects at Australia's largest health insurer, a $4b+ enterprise." },
]

const POST_TYPES = [
  { icon: iconProjects, title: 'Side projects', body: 'A million things I want to build, and the full zero-to-one journey for each.' },
  { icon: iconTutorials, title: 'AI tutorials', body: 'The tools I actually use day to day, not just whatever gets the most likes and views.' },
  { icon: iconNews, title: 'AI news that matters', body: 'The non-obvious updates, trends, and predictions you actually need to be across.' },
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

function Journey() {
  const [open, setOpen] = useState(false)
  return (
    <section className="border-t border-rule">
      <div className={`${WRAP} roll py-[clamp(44px,7vh,72px)]`}>
        <button
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="rv flex w-full items-center justify-between gap-4 text-left"
        >
          <span>
            <span className="mb-2 flex items-center gap-3 font-display text-[14px] font-extrabold uppercase tracking-[0.14em] text-ink">
              <span className="inline-block h-[3px] w-9 bg-ink" aria-hidden="true" />
              The journey so far
            </span>
            <span className="block max-w-[54ch] text-[15px] text-ink-soft">From a team of ten to a $1.6b exit, and plenty I broke along the way.</span>
          </span>
          <ChevronDown size={26} strokeWidth={2} className={`shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="mt-8">
            {JOURNEY.map((item) => (
              <div key={`${item.year}-${item.title}`} className="grid grid-cols-[64px_1fr] items-baseline gap-x-[clamp(16px,3vw,48px)] gap-y-1.5 border-t border-rule py-[clamp(22px,3.5vh,36px)] transition-colors hover:bg-[#f6f6f3] md:grid-cols-[minmax(90px,160px)_1fr_1.1fr]">
                <span className="font-display text-[clamp(17px,1.9vw,26px)] font-extrabold tracking-[-0.03em]">{item.year}</span>
                <h3 className="font-display text-[clamp(18px,2vw,26px)] font-bold leading-[1.1] tracking-[-0.02em]">{item.title}</h3>
                <p className="col-start-2 max-w-[48ch] text-[15px] text-ink-soft md:col-start-3">{item.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function WhySection() {
  const revealRef = useRef<HTMLDivElement>(null)

  function onPointerMove(event: ReactPointerEvent<HTMLElement>) {
    if (event.pointerType === 'touch') return
    const bounds = event.currentTarget.getBoundingClientRect()
    const layer = revealRef.current
    if (layer) {
      layer.classList.add('is-active')
      layer.style.setProperty('--x', `${event.clientX - bounds.left}px`)
      layer.style.setProperty('--y', `${event.clientY - bounds.top}px`)
    }
  }

  return (
    <section
      className="relative overflow-hidden border-t border-ink"
      onPointerMove={onPointerMove}
      onPointerLeave={() => revealRef.current?.classList.remove('is-active')}
    >
      <img src={whySky} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
      <div ref={revealRef} className="spotlight-reveal absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none" style={{ backgroundImage: `url(${whySkyReveal})` }} aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/45 via-black/20 to-transparent" />
      <div className={`${WRAP} roll relative z-10 py-[clamp(72px,13vh,150px)]`}>
        <p className="rv mb-8 flex items-center gap-3 font-display text-[14px] font-extrabold uppercase tracking-[0.14em] text-white">
          <span className="inline-block h-[3px] w-9 bg-white" aria-hidden="true" />
          Why I'm writing this
        </p>
        <p className="rv max-w-[24ch] text-balance font-display text-[clamp(28px,3.8vw,52px)] font-extrabold leading-[1.06] tracking-[-0.035em] text-white">We're less than five years from AGI. That can be scary. It can also be the best time in history to <em className="italic">build</em>.</p>
        <p className="rv mt-8 max-w-[62ch] text-[clamp(16px,1.5vw,20px)] leading-relaxed text-white/85">One person, a laptop, and curiosity have never been able to make a bigger dent. I've been heads-down building for a decade. Now I want to share it, and build with you. That's why I write this letter: to help you find that excitement, and see the art of the possible with AI.</p>
      </div>
    </section>
  )
}

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
    document.querySelectorAll('.rv, .roll').forEach((element) => observer.observe(element))
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
        <section id="signup" className={`${WRAP} roll scroll-mt-16 py-[clamp(64px,11vh,120px)]`}>
          <div className="grid items-start gap-10 md:grid-cols-[1.25fr_0.75fr] md:gap-[clamp(42px,7vw,110px)]">
            <div>
              <Eyebrow>The weekly letter</Eyebrow>
              <h2 className="rv max-w-[18ch] text-balance font-display text-[clamp(36px,5.2vw,72px)] font-extrabold leading-[1.0] tracking-[-0.045em]">
                Sign up for the best weekend read covering AI and startups.
              </h2>
            </div>
            <div className="rv border-t border-ink pt-6 md:mt-14">
              <p className="mb-7 max-w-[44ch] text-[15px] leading-relaxed text-ink-soft">One email a week containing the most useful AI and startup content.</p>
              <SubscribeForm idSuffix="top" />
            </div>
          </div>

          <div className="rv mt-[clamp(48px,8vh,84px)] border-t border-rule pt-10">
            <h3 className="mb-10 flex items-center gap-3 font-display text-[14px] font-extrabold uppercase tracking-[0.14em] text-ink">
              <span className="inline-block h-[3px] w-9 bg-ink" aria-hidden="true" />
              What to expect
            </h3>
            <div className="grid gap-x-[clamp(24px,4vw,64px)] gap-y-10 sm:grid-cols-3">
              {POST_TYPES.map(({ icon, title, body }) => (
                <div key={title}>
                  <img src={icon} alt="" aria-hidden="true" className="mb-5 h-16 w-16 object-contain" loading="lazy" />
                  <h3 className="mb-1 font-display text-[clamp(19px,2vw,24px)] font-bold tracking-[-0.02em]">{title}</h3>
                  <p className="max-w-[38ch] text-[15px] text-ink-soft">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="about" className="scroll-mt-16 border-t border-ink">
          <div className={`${WRAP} roll py-[clamp(64px,11vh,120px)]`}>
            <Eyebrow>Start here · Who I am</Eyebrow>
            <div className="grid items-start gap-10 md:grid-cols-[1.25fr_1fr] md:gap-[clamp(32px,5vw,96px)]">
              <div>
                <h2 className="rv text-balance font-display text-[clamp(30px,4.3vw,58px)] font-extrabold leading-[1.02] tracking-[-0.04em]">
                  I'm a massive nerd with <em className="italic">AI psychosis</em>, and enough real-world experience to have something to say about it.
                </h2>
                <p className="rv mt-8 text-[15px] leading-relaxed text-ink-soft">Ten years obsessed with startups and innovation. I've built AI products everywhere from a consumer startup that sold for $1.6b to one of Australia's largest enterprises, doing over $4b in revenue.</p>
                <p className="rv mt-4 text-[13px] italic leading-relaxed text-ink-mid">AI psychosis (noun): a state of all-consuming curiosity that leaves you unable to stop thinking about, tinkering with, or talking about AI.</p>
              </div>
              <figure className="rv w-full max-w-[300px] md:justify-self-end">
                <img src={richSpeaking} alt="Rich speaking on stage with a microphone" className="aspect-square w-full object-cover" loading="lazy" />
                <figcaption className="mt-3 text-[13px] text-ink-mid">Talking startups and AI, as always.</figcaption>
              </figure>
            </div>

            <div className="rv mt-14 border-t border-rule pt-10">
              <h3 className="mb-6 flex items-center gap-3 font-display text-[14px] font-extrabold uppercase tracking-[0.14em] text-ink">
                <span className="inline-block h-[3px] w-9 bg-ink" aria-hidden="true" />
                Built AI products @
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {COMPANY_LOGOS.map(({ src, name }) => (
                  <img key={name} src={src} alt={`${name} logo`} className="aspect-[8/5] w-full object-cover" loading="lazy" />
                ))}
              </div>
            </div>

            <div className="rv mt-12 grid grid-cols-3 gap-6 sm:gap-10">
              {STATS.map((stat) => (
                <div key={stat.label}>
                  <div className="font-display text-[clamp(30px,4.4vw,58px)] font-extrabold leading-none tracking-[-0.04em]">{stat.value}</div>
                  <div className="mt-2 text-[12px] text-ink-soft sm:text-sm">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <Journey />

        <WhySection />

        <section id="subscribe" className="scroll-mt-16 border-t border-ink">
          <div className={`${WRAP} roll grid items-start gap-12 py-[clamp(64px,11vh,120px)] md:grid-cols-2 md:gap-[clamp(32px,5vw,96px)]`}>
            <div>
              <h2 className="rv mb-8 text-balance font-display text-[clamp(28px,3.8vw,52px)] font-extrabold leading-[1.02] tracking-[-0.04em]">Follow to understand the art of the <em className="italic">possible</em>.</h2>
              <ul className="space-y-4">
                {FOR_YOU.map(({ icon: Icon, text }) => <li key={text} className="rv flex items-center gap-4"><Icon size={20} strokeWidth={1.75} className="shrink-0" /><span className="text-[16px] text-ink-soft">{text}</span></li>)}
              </ul>
            </div>
            <div className="rv md:pt-1">
              <p className="mb-7 max-w-[44ch] text-[15px] text-ink-soft">One email a week: what shipped, the lever that made it work, and the recipe to build it yourself.</p>
              <SubscribeForm idSuffix="bottom" />
              <div className="mt-9 flex flex-wrap items-center gap-3">
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
