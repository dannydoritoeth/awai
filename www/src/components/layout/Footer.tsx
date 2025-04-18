import Link from 'next/link';
import Image from 'next/image';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-50 border-t border-gray-100" role="contentinfo">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand Section */}
          <div className="flex flex-col items-center md:items-start">
            <Link href="/" aria-label="Home">
              <Image
                src="/assets/logos/awai-icon.svg"
                alt="Accelerate with AI Icon"
                width={32}
                height={32}
                className="h-8 w-auto"
              />
            </Link>
            <p className="mt-4 text-gray-600 text-sm">
              AI-powered solutions for business growth and efficiency
            </p>
          </div>

          {/* Navigation Section */}
          <nav className="flex flex-col items-center md:items-start" aria-label="Footer navigation">
            <h3 className="font-semibold text-gray-900 mb-4">Quick Links</h3>
            <div className="flex flex-col gap-2">
              <Link 
                href="/contact"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                Contact
              </Link>
              <Link 
                href="/30-minute-strategy-session"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                Book Strategy Session
              </Link>
            </div>
          </nav>

          {/* Legal Section */}
          <nav className="flex flex-col items-center md:items-start" aria-label="Legal navigation">
            <h3 className="font-semibold text-gray-900 mb-4">Legal</h3>
            <div className="flex flex-col gap-2">
              <Link 
                href="/privacy"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                Privacy Policy
              </Link>
              <Link 
                href="/terms"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                Terms of Service
              </Link>
            </div>
          </nav>
        </div>

        {/* Copyright Section */}
        <div className="mt-12 pt-8 border-t border-gray-200 text-center">
          <p className="text-gray-600 text-sm">
            © {currentYear} Accelerate with AI. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
} 