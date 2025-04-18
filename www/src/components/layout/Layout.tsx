import { Header } from './Header';
import { Footer } from './Footer';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Accelerate with AI',
  description: 'AI-powered solutions for business growth and efficiency',
};

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
} 