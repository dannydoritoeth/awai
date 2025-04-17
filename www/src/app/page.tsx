import { Header } from '@/components/layout/Header';
import { HeroSection } from '@/components/sections/HeroSection';
import { NarrativeSection } from '@/components/sections/NarrativeSection';
import { OfferingSection } from '@/components/sections/OfferingSection';
import { GuaranteeSection } from '@/components/sections/GuaranteeSection';
import { FAQSection } from '@/components/sections/FAQSection';
import { CTASection } from '@/components/sections/CTASection';

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <HeroSection />
        <FAQSection />
      </main>
    </>
  );
}