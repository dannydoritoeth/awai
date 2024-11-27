'use client';

import { Header } from '@/components/layout/Header';
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function ServicesPage() {
  const [openSection, setOpenSection] = useState<number | null>(0);

  const services = [
    {
      title: "Process Automation and Cost Optimization",
      description: "Transform your business operations with intelligent automation solutions.",
      offerings: [
        "Automate repetitive tasks to streamline workflows",
        "Reduce errors and operational costs with AI-driven solutions",
        "Deploy AI-powered tools for resource and time management"
      ],
      benefits: "Boost productivity, save time, and minimize operational expenses.",
    },
    {
      title: "Data-Driven Insights and Decision Support",
      description: "Make informed decisions with advanced analytics and AI-powered insights.",
      offerings: [
        "Advanced analytics and AI models to turn data into actionable insights",
        "Predictive analysis to anticipate trends and risks",
        "Real-time reporting tools for smarter decision-making"
      ],
      benefits: "Empower your team with accurate, timely insights for better strategies.",
    },
    {
      title: "Customer Experience Enhancement",
      description: "Elevate your customer service with AI-powered solutions.",
      offerings: [
        "AI-powered chatbots for instant, 24/7 customer support",
        "Personalized customer engagement through intelligent recommendations",
        "Sentiment analysis to understand and address customer needs effectively"
      ],
      benefits: "Increase customer satisfaction, loyalty, and retention through superior experiences.",
    },
    {
      title: "Innovation and Competitive Edge",
      description: "Stay ahead of the competition with cutting-edge AI solutions.",
      offerings: [
        "Develop AI-driven products and services tailored to your industry",
        "Stay ahead with cutting-edge AI tools that differentiate your business",
        "Identify and implement transformative opportunities with AI consulting"
      ],
      benefits: "Drive innovation and maintain a competitive edge in your market.",
    },
  ];

  const toggleSection = (index: number) => {
    setOpenSection(openSection === index ? null : index);
  };

  return (
    <>
      <Header />
      <main className="pt-40 pb-16 min-h-screen bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center mb-16">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Our Services</h1>
            <p className="text-xl text-gray-600">
              Comprehensive AI solutions to transform your business operations
            </p>
          </div>

          <div className="space-y-6 max-w-4xl mx-auto">
            {services.map((service, index) => (
              <div 
                key={index}
                className="bg-white rounded-xl shadow-lg overflow-hidden"
              >
                <button
                  onClick={() => toggleSection(index)}
                  className="w-full px-8 py-6 flex items-center justify-between bg-white hover:bg-gray-50 transition-colors"
                >
                  <h2 className="text-2xl font-bold text-gray-900 text-left">
                    {service.title}
                  </h2>
                  {openSection === index ? (
                    <ChevronUp className="w-6 h-6 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-6 h-6 text-gray-500" />
                  )}
                </button>

                {openSection === index && (
                  <div className="px-8 pb-8 animate-slideDown">
                    <p className="text-xl text-gray-600 mb-6">
                      {service.description}
                    </p>

                    <div className="mb-6">
                      <h3 className="text-xl font-semibold text-gray-800 mb-3">
                        What We Offer:
                      </h3>
                      <ul className="space-y-2">
                        {service.offerings.map((offering, i) => (
                          <li key={i} className="flex items-start">
                            <span className="text-[#0066FF] mr-2">•</span>
                            <span className="text-gray-600">{offering}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h3 className="text-xl font-semibold text-gray-800 mb-3">
                        Key Benefits:
                      </h3>
                      <p className="text-gray-600">{service.benefits}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
} 