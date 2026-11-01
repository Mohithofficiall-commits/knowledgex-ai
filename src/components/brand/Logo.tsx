import { routeHref } from '@/lib/router';

interface LogoProps {
  tone?: 'light' | 'dark' | 'auto';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Logo({ tone = 'dark', size = 'md', className = '' }: LogoProps) {
  const iconSizes = {
    sm: 'h-8 w-8',
    md: 'h-9 w-9',
    lg: 'h-11 w-11',
  };

  const textSizes = {
    sm: 'text-sm sm:text-base',
    md: 'text-base sm:text-lg',
    lg: 'text-lg sm:text-xl',
  };

  const isLight = tone === 'light';

  return (
    <a
      href={routeHref('/')}
      className={`group inline-flex items-center gap-2.5 outline-none select-none ${className}`}
    >
      {/* Distinctive Modern Geometric Logo Symbol */}
      <div
        className={`relative flex ${iconSizes[size]} shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-[#53B54F] via-[#14F6FA] to-[#C6A9D8] p-0.5 shadow-md transition-all duration-300 group-hover:scale-105 group-hover:shadow-glow`}
      >
        <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-[#0b1120] transition duration-300 group-hover:bg-[#111827]">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 transition duration-300 group-hover:rotate-6"
          >
            {/* Connected Knowledge Node Topology */}
            <circle cx="6" cy="6" r="2.5" fill="#53B54F" />
            <circle cx="6" cy="18" r="2.5" fill="#14F6FA" />
            <circle cx="18" cy="6" r="2.5" fill="#C6A9D8" />
            <circle cx="18" cy="18" r="2.5" fill="#F09B04" />
            <circle cx="12" cy="12" r="3" fill="#E4D8F1" />
            {/* Synaptic interconnects */}
            <path
              d="M6 8.5V15.5M8.5 6H15.5M8 8L10 10M16 8L14 10M10 14L8 16M14 14L16 16"
              stroke="#ffffff"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeOpacity="0.9"
            />
          </svg>
        </div>
      </div>

      {/* Brand Wordmark with guaranteed high-contrast visibility */}
      <div className="flex items-center leading-none">
        <span
          className={`font-black tracking-wider uppercase ${textSizes[size]} ${
            isLight ? 'text-white drop-shadow-sm' : 'text-slate-900'
          }`}
        >
          KNOWLEDGE
        </span>
        <span className={`font-black ${textSizes[size]} text-[#14F6FA] drop-shadow-xs`}>
          X
        </span>
        <span className="ml-1.5 inline-flex items-center justify-center rounded-md bg-[#C6A9D8]/30 px-1.5 py-0.5 text-[10px] font-black tracking-widest text-[#7c3aed] border border-[#C6A9D8]/60 shadow-xs">
          AI
        </span>
      </div>
    </a>
  );
}
