import Link from 'next/link';

export function Footer() {
  return (
    <footer className="bg-gray-50 border-t border-gray-100">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <img
              src="/assets/logos/awai-icon.svg"
              alt="Accelerate with AI Icon"
              className="h-8 w-auto"
            />
          </div>
          
          <nav className="flex gap-8">
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
          </nav>
          
          <div className="mt-4 md:mt-0 text-gray-600">
            © {new Date().getFullYear()} Accelerate with AI. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
} 