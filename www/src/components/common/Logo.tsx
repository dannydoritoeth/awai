import Link from 'next/link';

export function Logo() {
  return (
    <Link href="/" className="flex items-center">
      <img
        src="/assets/logos/awai-logo.svg"
        alt="AWAI Logo"
        className="w-[360px] h-[120px]"
      />
    </Link>
  );
} 