import { routeHref } from '@/lib/router';

interface LogoProps {
  tone?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg';
}

export function Logo({ tone = 'dark', size = 'md' }: LogoProps) {
  const iconSizes = {
    sm: 'h-8 w-8',
    md: 'h-9 w-9',
    lg: 'h-11 w-11',
  };

  const textSizes = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-xl',
  };

  return (
    <a href={routeHref('/')} className="group flex items-center gap-2.5 outline-none select-none">
      {/* Distinctive Modern Geometric Logo Symbol */}
      <div
        className={`relative flex ${iconSizes[size]} items-center justify-center rounded-xl bg-gradient-to-tr from-brand-green via-brand-cyan to-brand-purple p-0.5 shadow-soft transition-all duration-300 group-hover:scale-105 group-hover:shadow-glow`}
      >
        <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-ink-900 transition duration-300 group-hover:bg-ink-800">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 transition duration-300 group-hover:rotate-6"
          >
            {/* Connected Node Network in K shape */}
            <circle cx="6" cy="6" r="2.5" fill="#53B54F" />
            <circle cx="6" cy="18" r="2.5" fill="#14F6FA" />
            <circle cx="18" cy="6" r="2.5" fill="#C6A9D8" />
            <circle cx="18" cy="18" r="2.5" fill="#F09B04" />
            <circle cx="12" cy="12" r="3" fill="#E4D8F1" />
            {/* Connecting Synaptic Edges */}
            <path
              d="M6 8.5V15.5M8.5 6H15.5M8 8L10 10M16 8L14 10M10 14L8 16M14 14L16 16"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeOpacity="0.85"
            />
          </svg>
        </div>
      </div>

      <div className="flex flex-col">
        <span className={`font-bold tracking-tight ${textSizes[size]} ${tone === 'light' ? 'text-white' : 'text-ink-900'}`}>
          KNOWLEDGE<span className="text-secondary-600 font-extrabold">X</span>
          <span className="ml-1.5 rounded-md bg-brand-purple/25 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-700 ring-1 ring-accent-300/50">
            AI
          </span>
        </span>
      </div>
    </a>
  );
}
