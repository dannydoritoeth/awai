'use client';

import { useBookingModal } from '@/contexts/BookingModalContext';

export function NarrativeSection() {
  const { openModal } = useBookingModal();

  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="max-w-[800px] mx-auto space-y-8">
          {/* Opening */}
          <div className="space-y-4">
            <h2 className="text-3xl font-bold">Dear Agency Leader,</h2>
            <p className="text-xl">We get it.</p>
            <p className="text-xl">Growing a <span className="text-[#0066FF] font-semibold">real estate agency</span> is hard. Really hard.</p>
          </div>

          {/* Current State */}
          <div className="space-y-4">
            <p className="text-lg">Right now, like most agencies, your business probably comes from your sphere of influence - repeat business, referrals, and word of mouth.</p>
            
            <p className="text-lg">These are great sources, but they have two major problems:</p>
            <ul className="list-disc pl-8 space-y-2 text-lg">
              <li>They're not scalable</li>
              <li>They're not predictable</li>
            </ul>
          </div>

          {/* Failed Solutions */}
          <div className="space-y-4">
            <p className="text-lg">So you've probably tried:</p>
            <div className="pl-6 space-y-2 italic text-lg">
              <p>"Just buy more leads from portals!"</p>
              <p>"Try automated social media tools!"</p>
              <p>"Use this generic content service!"</p>
              <p>"Run templated Facebook ads!"</p>
            </div>
            
            <p className="text-lg font-bold">Sound familiar?</p>
            
            <p className="text-lg">But here's the problem - these solutions are either:</p>
            <ul className="list-disc pl-8 space-y-2 text-lg">
              <li>Delivering low-quality, unqualified leads</li>
              <li>Costing more than they generate</li>
              <li>Creating zero brand differentiation</li>
            </ul>
          </div>

          {/* The Real Issue */}
          <div className="space-y-4">
            <p className="text-[#0066FF] text-xl font-semibold">Here's what's really happening:</p>
            <h3 className="text-2xl font-bold">You don't need more marketing. You need the right system.</h3>
            <p className="text-lg">One that builds real relationships and establishes you as the trusted authority in your market.</p>
          </div>

          {/* The Solution */}
          <div className="space-y-4">
            <p className="text-lg">Imagine having:</p>
            <ul className="list-disc pl-8 space-y-2 text-lg">
              <li>A predictable flow of qualified leads</li>
              <li>Territory exclusivity protection</li>
              <li>A system that builds your brand while generating leads</li>
            </ul>
          </div>

          {/* Value Prop */}
          <div className="space-y-4">
            <p className="text-xl">The best part?</p>
            <h3 className="text-2xl font-bold">You only pay when we deliver results.</h3>
            <p className="text-lg">No retainers. No monthly fees. No risk.</p>
          </div>

          {/* Call to Action */}
          <div className="space-y-6">
            <p className="text-lg">Ready to build a predictable, scalable lead generation system?</p>
            <p className="text-lg">Book your strategy call to learn how we can help you dominate your market.</p>
            <button 
              onClick={openModal}
              className="inline-block text-xl px-10 py-5 bg-[#0A2E4D] text-white rounded-md 
                hover:bg-[#164875] transition-colors duration-300 
                shadow-lg hover:shadow-xl"
            >
              Book Your Strategy Call
            </button>
          </div>
        </div>
      </div>
    </section>
  );
} 