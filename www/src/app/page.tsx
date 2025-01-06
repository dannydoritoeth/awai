import { Header } from '@/components/layout/Header';
import { HeroSection } from '@/components/sections/HeroSection';
import { NarrativeSection } from '@/components/sections/NarrativeSection';
import { OfferingSection } from '@/components/sections/OfferingSection';
import { ProofSection } from '@/components/sections/ProofSection';
import { GuaranteeSection } from '@/components/sections/GuaranteeSection';
import { FAQSection } from '@/components/sections/FAQSection';
import { CTASection } from '@/components/sections/CTASection';

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <HeroSection />
        <NarrativeSection />
        <OfferingSection />
        <ProofSection />
        <GuaranteeSection />
        <FAQSection />
        <CTASection />
      </main>
    </>
  );
}