import { useEffect, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronRight,
  Database,
  FileSearch,
  FileText,
  FlaskConical,
  GitCompare,
  Languages,
  Layers,
  Network,
  Quote,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  Zap,
} from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';
import { routeHref } from '@/lib/router';
import { Logo } from '@/components/brand/Logo';
import { LanguageToggle } from '@/components/language/LanguageToggle';
import { Badge, Button } from '@/components/ui';
import { cn } from '@/lib/cn';

export function LandingPage() {
  const { t, language } = useTranslation();
  const [scrolled, setScrolled] = useState(false);
  const [activeTab, setActiveTab] = useState<'ask' | 'compare' | 'graph'>('ask');

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 12);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const features = [
    {
      icon: Layers,
      title: t('landing.feature1Title'),
      body: t('landing.feature1Body'),
      accent: 'border-brand-green/30 hover:border-brand-green/80 bg-gradient-to-b from-primary-50/50 to-white',
      badge: 'Multi-Doc Retrieval',
      badgeTone: 'green' as const,
    },
    {
      icon: Quote,
      title: t('landing.feature2Title'),
      body: t('landing.feature2Body'),
      accent: 'border-brand-cyan/40 hover:border-brand-cyan bg-gradient-to-b from-secondary-50/50 to-white',
      badge: 'Exact Citations',
      badgeTone: 'cyan' as const,
    },
    {
      icon: GitCompare,
      title: t('landing.feature3Title'),
      body: t('landing.feature3Body'),
      accent: 'border-brand-purple/40 hover:border-brand-purple bg-gradient-to-b from-lavender-50/50 to-white',
      badge: 'Concept Alignment',
      badgeTone: 'purple' as const,
    },
    {
      icon: Network,
      title: 'Knowledge Graph Nexus',
      body: 'Extract concepts, entities, and cross-document links into an interactive visual network.',
      accent: 'border-brand-orange/40 hover:border-brand-orange bg-gradient-to-b from-warm-50/50 to-white',
      badge: 'Interactive Graph',
      badgeTone: 'orange' as const,
    },
  ];

  const steps = [
    {
      number: '01',
      icon: Upload,
      title: t('landing.step1Title'),
      body: t('landing.step1Body'),
      accent: 'text-primary-700 bg-primary-100',
    },
    {
      number: '02',
      icon: FileSearch,
      title: t('landing.step2Title'),
      body: t('landing.step2Body'),
      accent: 'text-secondary-700 bg-secondary-100',
    },
    {
      number: '03',
      icon: ShieldCheck,
      title: t('landing.step3Title'),
      body: t('landing.step3Body'),
      accent: 'text-accent-800 bg-accent-100',
    },
  ];

  return (
    <div className="min-h-screen bg-ink-50 text-ink-900 selection:bg-brand-lavender selection:text-ink-950">
      {/* ── Sticky Navigation Bar ── */}
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-40 transition-all duration-300',
          scrolled ? 'border-b border-ink-200/80 bg-white/90 shadow-soft backdrop-blur-md' : 'bg-transparent',
        )}
      >
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
          <Logo size="md" />

          <div className="hidden items-center gap-6 md:flex">
            <a href="#features" className="text-sm font-semibold text-ink-600 transition hover:text-ink-950">
              Capabilities
            </a>
            <a href="#architecture" className="text-sm font-semibold text-ink-600 transition hover:text-ink-950">
              Architecture
            </a>
            <a href="#preview" className="text-sm font-semibold text-ink-600 transition hover:text-ink-950">
              Interactive Preview
            </a>
          </div>

          <div className="flex items-center gap-3">
            <LanguageToggle />
            <a href={routeHref('/dashboard')}>
              <Button size="sm" variant="cyan" className="hidden sm:inline-flex shadow-glow">
                {t('nav.openApp')}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
          </div>
        </div>
      </header>

      {/* ── Hero Section ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-ink-900 via-ink-800 to-slate-900 pb-28 pt-36 text-white sm:pt-44">
        {/* Soft Ambient Light Glows with Exact Palette */}
        <div className="pointer-events-none absolute -left-20 top-20 h-96 w-96 rounded-full bg-brand-green/20 blur-3xl animate-pulse-slow" />
        <div className="pointer-events-none absolute right-0 top-36 h-[30rem] w-[30rem] rounded-full bg-brand-cyan/15 blur-3xl" />
        <div className="pointer-events-none absolute bottom-10 left-1/3 h-80 w-80 rounded-full bg-brand-purple/20 blur-3xl animate-pulse-slow" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-12">
          {/* Hero Left Content */}
          <div className="animate-fade-up space-y-7 lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-brand-cyan backdrop-blur-md">
              <span className="flex h-2 w-2 rounded-full bg-brand-cyan animate-ping" />
              {t('landing.heroBadge')}
            </div>

            <h1 className="text-balance text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl leading-[1.12]">
              {t('landing.heroTitle')}
            </h1>

            <p className="max-w-2xl text-lg leading-relaxed text-slate-300">
              {t('landing.heroSubtitle')}
            </p>

            <div className="flex flex-col gap-3.5 sm:flex-row pt-2">
              <a href={routeHref('/dashboard')}>
                <Button size="lg" variant="primary" className="w-full sm:w-auto shadow-glow-green text-base">
                  {t('landing.ctaPrimary')}
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </a>
              <a href={routeHref('/library')}>
                <Button size="lg" variant="secondary" className="w-full sm:w-auto border-white/20 bg-white/10 text-white backdrop-blur hover:bg-white/20">
                  <Upload className="h-5 w-5 text-brand-cyan" />
                  {t('landing.ctaSecondary')}
                </Button>
              </a>
            </div>

            {/* Architecture Highlights */}
            <div className="flex flex-wrap items-center gap-6 pt-4 text-xs font-medium text-slate-400">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-brand-green" />
                <span>PostgreSQL & pgvector Ready</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-brand-cyan" />
                <span>Qdrant Vector DB Support</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-brand-purple" />
                <span>Runs 100% Without API Keys</span>
              </div>
            </div>
          </div>

          {/* Hero Right Mockup / Interactive Panel */}
          <div className="relative animate-fade-up [animation-delay:150ms] lg:col-span-5">
            <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-white/10 p-5 shadow-lift backdrop-blur-xl ring-1 ring-white/10">
              {/* Mockup Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-red-400/80" />
                  <span className="h-3 w-3 rounded-full bg-amber-400/80" />
                  <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
                  <span className="ml-2 text-xs font-semibold text-slate-300">knowledge-query-session #1</span>
                </div>
                <span className="rounded-full bg-brand-green/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-green border border-brand-green/30">
                  Dual RAG
                </span>
              </div>

              {/* Mock Chat / Citation Card */}
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-brand-cyan">
                    <Search className="h-3.5 w-3.5" />
                    User Inquiry
                  </div>
                  <p className="mt-1 text-sm font-medium text-white">
                    "What are the renewal terms and penalties for municipal trade licenses?"
                  </p>
                </div>

                <div className="rounded-2xl border border-white/15 bg-white/10 p-4 shadow-soft">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-brand-cyan flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-brand-cyan" />
                      Synthesised Evidence
                    </span>
                    <Badge tone="green">High Confidence</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-200">
                    The trade license must be renewed annually before 31 March{' '}
                    <span className="inline-flex items-center justify-center rounded bg-brand-cyan/20 px-1.5 py-0.2 text-xs font-bold text-brand-cyan border border-brand-cyan/40">
                      [1]
                    </span>
                    . A 10 percent late fee is assessed for each month of delay beyond the grace period{' '}
                    <span className="inline-flex items-center justify-center rounded bg-brand-green/20 px-1.5 py-0.2 text-xs font-bold text-brand-green border border-brand-green/40">
                      [2]
                    </span>
                    .
                  </p>

                  {/* Citation preview boxes */}
                  <div className="mt-4 space-y-2 border-t border-white/10 pt-3">
                    <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-xs text-slate-300">
                      <span className="flex items-center gap-2 font-medium">
                        <FileText className="h-3.5 w-3.5 text-brand-cyan" />
                        Municipal_Act_2024.pdf (p. 14)
                      </span>
                      <span className="font-bold text-brand-cyan">[1]</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-xs text-slate-300">
                      <span className="flex items-center gap-2 font-medium">
                        <FileText className="h-3.5 w-3.5 text-brand-green" />
                        Commercial_Guidelines.docx
                      </span>
                      <span className="font-bold text-brand-green">[2]</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Capabilities Grid ── */}
      <section id="features" className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <Badge tone="purple" className="mb-3">
            Core Intelligence
          </Badge>
          <h2 className="text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
            {t('landing.featuresTitle')}
          </h2>
          <p className="mt-3.5 text-base text-ink-500 leading-relaxed">
            {t('landing.featuresSubtitle')}
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, title, body, accent, badge, badgeTone }) => (
            <div
              key={title}
              className={cn(
                'group flex flex-col justify-between rounded-3xl border p-7 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift',
                accent,
              )}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-soft transition group-hover:scale-110">
                    <Icon className="h-6 w-6 text-ink-800" />
                  </span>
                  <Badge tone={badgeTone}>{badge}</Badge>
                </div>
                <h3 className="mt-6 text-lg font-bold text-ink-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">{body}</p>
              </div>
              <div className="mt-6 flex items-center gap-1.5 text-xs font-semibold text-ink-900">
                Explore in workspace
                <ChevronRight className="h-4 w-4 text-ink-400 group-hover:translate-x-1 transition" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Interactive Workspace Feature Showcase Tabs ── */}
      <section id="preview" className="bg-white py-24 border-y border-ink-200">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <Badge tone="cyan" className="mb-3">Live Interactive Preview</Badge>
            <h2 className="text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
              One Workspace. Deep Insight Across All Formats.
            </h2>
            <p className="mt-3 text-ink-500 text-sm">
              Toggle between modules to preview how KnowledgeX handles your research workflows.
            </p>

            <div className="mt-8 flex justify-center">
              <div className="inline-flex rounded-2xl bg-ink-100 p-1.5 ring-1 ring-ink-200">
                <button
                  type="button"
                  onClick={() => setActiveTab('ask')}
                  className={cn(
                    'flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs sm:text-sm font-semibold transition',
                    activeTab === 'ask' ? 'bg-white text-ink-900 shadow-soft' : 'text-ink-600 hover:text-ink-900',
                  )}
                >
                  <Brain className="h-4 w-4 text-primary-600" />
                  AI Assistant & Evidence
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('compare')}
                  className={cn(
                    'flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs sm:text-sm font-semibold transition',
                    activeTab === 'compare' ? 'bg-white text-ink-900 shadow-soft' : 'text-ink-600 hover:text-ink-900',
                  )}
                >
                  <GitCompare className="h-4 w-4 text-secondary-600" />
                  Document Comparison
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('graph')}
                  className={cn(
                    'flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs sm:text-sm font-semibold transition',
                    activeTab === 'graph' ? 'bg-white text-ink-900 shadow-soft' : 'text-ink-600 hover:text-ink-900',
                  )}
                >
                  <Network className="h-4 w-4 text-accent-600" />
                  Knowledge Graph
                </button>
              </div>
            </div>
          </div>

          <div className="mt-12 rounded-3xl border border-ink-200 bg-ink-50/60 p-6 sm:p-10 shadow-soft">
            {activeTab === 'ask' && (
              <div className="grid gap-8 lg:grid-cols-2 items-center">
                <div className="space-y-4">
                  <Badge tone="green">Multi-Document Q&A</Badge>
                  <h3 className="text-2xl font-bold text-ink-900">Precise answers with transparent attribution</h3>
                  <p className="text-sm leading-relaxed text-ink-600">
                    Unlike ordinary search engines, KnowledgeX extracts sentence-level semantic chunks and pairs every assertion with an interactive citation index. Click any citation to inspect the original text immediately.
                  </p>
                  <ul className="space-y-2 text-sm text-ink-700 font-medium">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary-600" />
                      Page-level numbering on PDFs
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary-600" />
                      Supports English & Tamil cross-lingual querying
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary-600" />
                      Full session history persisted in database
                    </li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-ink-200 bg-white p-6 shadow-soft">
                  <div className="flex items-center justify-between border-b border-ink-100 pb-3">
                    <span className="text-xs font-bold text-ink-500 uppercase tracking-wider">Sample Query Output</span>
                    <Badge tone="cyan">Confidence: 94%</Badge>
                  </div>
                  <p className="mt-4 text-sm font-semibold text-ink-900">
                    "Under Section 4.2, tenant improvements require written landlord consent within 14 business days [1]. Failure to reply constitutes deemed approval [2]."
                  </p>
                  <div className="mt-4 rounded-xl bg-ink-50 p-3 text-xs text-ink-600 border border-ink-200">
                    <span className="font-bold text-primary-700">[1]</span> Commercial_Lease_Agreement.pdf · Page 8
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'compare' && (
              <div className="grid gap-8 lg:grid-cols-2 items-center">
                <div className="space-y-4">
                  <Badge tone="cyan">Contrast Analysis</Badge>
                  <h3 className="text-2xl font-bold text-ink-900">Side-by-side contrast of policies & contracts</h3>
                  <p className="text-sm leading-relaxed text-ink-600">
                    Upload two files to immediately discover overlapping terminology, shared operational mandates, and divergent policy clauses without manual skimming.
                  </p>
                  <div className="flex items-center gap-4 pt-2">
                    <div className="rounded-xl border border-ink-200 bg-white p-3 text-center flex-1">
                      <p className="text-xs text-ink-400">Jaccard Similarity</p>
                      <p className="text-xl font-bold text-secondary-700">68.4%</p>
                    </div>
                    <div className="rounded-xl border border-ink-200 bg-white p-3 text-center flex-1">
                      <p className="text-xs text-ink-400">Shared Concepts</p>
                      <p className="text-xl font-bold text-primary-700">14 Themes</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-primary-200 bg-primary-50/40 p-5">
                    <p className="text-xs font-bold text-primary-800 uppercase">Document A Unique</p>
                    <ul className="mt-3 space-y-1.5 text-xs text-ink-700">
                      <li>• Strict penalty clause</li>
                      <li>• 30-day inspection notice</li>
                      <li>• Arbitrated dispute resolution</li>
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-accent-200 bg-accent-50/40 p-5">
                    <p className="text-xs font-bold text-accent-800 uppercase">Document B Unique</p>
                    <ul className="mt-3 space-y-1.5 text-xs text-ink-700">
                      <li>• Annual fee waiver option</li>
                      <li>• Expedited digital renewal</li>
                      <li>• Multi-state jurisdiction</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'graph' && (
              <div className="grid gap-8 lg:grid-cols-2 items-center">
                <div className="space-y-4">
                  <Badge tone="purple">Knowledge Graph</Badge>
                  <h3 className="text-2xl font-bold text-ink-900">Discover hidden connections between topics</h3>
                  <p className="text-sm leading-relaxed text-ink-600">
                    KnowledgeX extracts entities and builds a multi-relational concept graph, revealing how different regulations, people, and topics cross-reference each other across your document library.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Badge tone="green">Concept (Green)</Badge>
                    <Badge tone="cyan">Entity (Cyan)</Badge>
                    <Badge tone="purple">Topic (Purple)</Badge>
                    <Badge tone="orange">Reference (Orange)</Badge>
                  </div>
                </div>
                <div className="relative flex h-60 items-center justify-center rounded-2xl border border-ink-200 bg-white p-6 shadow-soft overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(#C6A9D8_1px,transparent_1px)] [background-size:16px_16px] opacity-40" />
                  <div className="relative flex items-center justify-center">
                    <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-tr from-brand-green via-brand-cyan to-brand-purple text-white shadow-glow animate-pulse-slow">
                      <Network className="h-8 w-8" />
                    </span>
                    <span className="absolute -top-6 -right-12 rounded-lg bg-primary-100 px-2.5 py-1 text-xs font-bold text-primary-800 shadow-soft">
                      Licensing
                    </span>
                    <span className="absolute -bottom-6 -left-12 rounded-lg bg-secondary-100 px-2.5 py-1 text-xs font-bold text-secondary-800 shadow-soft">
                      Compliance
                    </span>
                    <span className="absolute -bottom-8 right-8 rounded-lg bg-accent-100 px-2.5 py-1 text-xs font-bold text-accent-800 shadow-soft">
                      Penalties
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── 3-Step Process ── */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-wider text-secondary-700">{t('landing.howEyebrow')}</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">{t('landing.howTitle')}</h2>
          </div>
          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {steps.map(({ number, icon: Icon, title, body, accent }) => (
              <div key={title} className="relative rounded-3xl bg-white p-8 ring-1 ring-ink-200 shadow-soft">
                <span className="absolute right-6 top-6 text-5xl font-black text-ink-100">{number}</span>
                <span className={cn('flex h-14 w-14 items-center justify-center rounded-2xl shadow-soft', accent)}>
                  <Icon className="h-7 w-7" />
                </span>
                <h3 className="mt-6 text-xl font-bold text-ink-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-500">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Language Switcher Demo Box ── */}
      <section className="mx-auto max-w-7xl px-5 pb-24 sm:px-8">
        <div className="grid items-center gap-12 overflow-hidden rounded-3xl bg-ink-900 p-10 text-white sm:p-14 lg:grid-cols-2 shadow-lift">
          <div className="space-y-5">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-orange/20 text-brand-orange">
              <Languages className="h-6 w-6" />
            </span>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('landing.languagesTitle')}</h2>
            <p className="leading-relaxed text-slate-300">{t('landing.languagesBody')}</p>
            <p className="text-xs text-slate-400">{t('landing.demoNote')}</p>
          </div>
          <div className="flex flex-col gap-4 rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
            <div className="rounded-xl bg-white/10 p-4">
              <p className="text-xs font-semibold text-brand-cyan">English Query</p>
              <p className="mt-1 font-semibold text-sm">Where do I renew my commercial trade licence?</p>
            </div>
            <div className="rounded-xl bg-primary-500/20 p-4 ring-1 ring-primary-400/40">
              <p className="text-xs font-semibold text-brand-green">தமிழ் வினவல்</p>
              <p className="mt-1 font-semibold text-sm">வணிக உரிமத்தை எங்கே புதுப்பிக்கலாம்?</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="mx-auto max-w-7xl px-5 pb-24 sm:px-8">
        <div className="rounded-3xl bg-gradient-to-r from-emerald-800 via-teal-900 to-indigo-950 px-8 py-14 text-center text-white shadow-lift sm:px-14 border border-white/10">
          <h2 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
            {t('landing.ctaBandTitle')}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-slate-200 text-sm leading-relaxed">{t('landing.ctaBandBody')}</p>
          <div className="mt-8 flex justify-center">
            <a href={routeHref('/library')}>
              <Button size="lg" variant="primary" className="shadow-glow-green text-base">
                {t('common.getStarted')}
                <ArrowRight className="h-5 w-5" />
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-ink-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 py-8 text-xs text-ink-500 sm:flex-row sm:px-8">
          <Logo size="sm" />
          <p>{t('landing.footer')}</p>
          <div className="flex items-center gap-4 text-xs font-medium">
            <a href={routeHref('/dashboard')} className="hover:text-ink-900">Dashboard</a>
            <a href={routeHref('/library')} className="hover:text-ink-900">Library</a>
            <a href={routeHref('/settings')} className="hover:text-ink-900">Settings</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
