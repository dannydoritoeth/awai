import { Header } from '@/components/layout/Header';
import { HeroSection } from '@/components/sections/HeroSection';
import { NarrativeSection } from '@/components/sections/NarrativeSection';
import { SolutionSection } from '@/components/sections/SolutionSection';
import { BenefitsSection } from '@/components/sections/BenefitsSection';
import { OfferSection } from '@/components/sections/OfferSection';
import { CTASection } from '@/components/sections/CTASection';

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <HeroSection />
        <NarrativeSection />
        <SolutionSection />
        <BenefitsSection />
        <OfferSection />
        <CTASection />
      </main>
    </>
  );
}