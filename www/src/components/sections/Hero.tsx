export function Hero() {
  return (
    <section className="pt-40 pb-20 bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-blue-900 mb-6">
            Transform Your Business with AI Automation
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            We help businesses leverage artificial intelligence to drive growth, reduce costs, and stay ahead of the competition.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="px-8 py-3 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-colors">
              Get Started
            </button>
            <button className="px-8 py-3 border-2 border-blue-900 text-blue-900 rounded-lg hover:bg-blue-50 transition-colors">
              Learn More
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}