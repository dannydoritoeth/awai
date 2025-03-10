import { ContactHeader } from '@/components/layout/ContactHeader';
import { StrategySessionBooking } from '@/components/sections/StrategySessionBooking';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Book Your Free Strategy Session | Accelerate with AI',
  description: 'Get your free custom paid marketing strategy worth $2,500. Book your 30-minute strategy session today.',
};

export default function StrategySessionPage() {
  return (
    <>
      <ContactHeader />
      <main className="pt-32 min-h-screen bg-gradient-to-br from-[#0A2E4D] to-[#1A1A1A]">
        <StrategySessionBooking />
      </main>
    </>
  );
} 