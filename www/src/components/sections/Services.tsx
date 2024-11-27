import Link from 'next/link';

export function Services() {
  const services = [
    {
      title: "Smart Work Tools",
      description: "Let AI handle the boring tasks so your team can focus on what matters most.",
      icon: "⚡",
    },
    {
      title: "Better Decisions",
      description: "Turn your business data into clear answers that help you make smart choices.",
      icon: "📊",
    },
    {
      title: "Happy Customers",
      description: "Give your customers better service with AI tools that work 24/7.",
      icon: "🤝",
    },
    {
      title: "Stay Ahead",
      description: "Use the latest AI tools to make your business stand out from others.",
      icon: "🚀",
    },
  ];

  return (
    <section id="services" className="py-24 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4 animate-fadeInUp">How We Help</h2>
          <p className="text-xl text-gray-600 animate-fadeInUp delay-1">
            We make businesses work better using AI tools
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {services.map((service, index) => (
            <Link 
              key={index}
              href="/services"
              className={`block bg-white p-8 rounded-lg shadow-lg hover:shadow-xl transition-all 
                hover:-translate-y-1 duration-300 cursor-pointer animate-fadeInUp delay-${index}`}
            >
              <div className="text-4xl mb-4">{service.icon}</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                {service.title}
              </h3>
              <p className="text-gray-600">
                {service.description}
              </p>
            </Link>
          ))}
        </div>

        <div className="text-center mt-12">
          <Link 
            href="/services" 
            className="inline-flex items-center text-[#0066FF] hover:text-blue-700 font-semibold
              animate-fadeInUp delay-3"
          >
            See all our services
            <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}