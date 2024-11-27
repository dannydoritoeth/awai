import { Bot, TrendingUp, LineChart, Shield } from 'lucide-react';

const services = [
  {
    icon: <Bot className="w-12 h-12 text-blue-900" />,
    title: 'Process Automation',
    description: 'Streamline operations and reduce manual tasks with intelligent automation solutions.'
  },
  {
    icon: <TrendingUp className="w-12 h-12 text-blue-900" />,
    title: 'Growth Optimization',
    description: 'Leverage AI to identify and capitalize on growth opportunities in your market.'
  },
  {
    icon: <LineChart className="w-12 h-12 text-blue-900" />,
    title: 'Data Analytics',
    description: 'Transform raw data into actionable insights with advanced AI analytics.'
  },
  {
    icon: <Shield className="w-12 h-12 text-blue-900" />,
    title: 'AI Integration',
    description: 'Seamlessly integrate AI solutions into your existing business processes.'
  }
];

export function Services() {
  return (
    <section id="services" className="py-20 bg-white">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-blue-900 mb-4">Our Services</h2>
          <p className="text-xl text-gray-600">Comprehensive AI solutions tailored to your needs</p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {services.map((service, index) => (
            <div 
              key={index}
              className="p-6 rounded-lg border border-gray-200 hover:shadow-lg transition-shadow"
            >
              <div className="mb-4">{service.icon}</div>
              <h3 className="text-xl font-bold text-blue-900 mb-2">{service.title}</h3>
              <p className="text-gray-600">{service.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}