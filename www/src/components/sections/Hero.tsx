export function Hero() {
  return (
    <section className="pt-40 pb-16 bg-white">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Make Your Business Better with AI
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            We help businesses work faster and save money by using AI tools. 
            Our solutions make everyday tasks easier and help your team get more done.
          </p>
          <div className="flex justify-center gap-4">
            <a
              href="/contact"
              className="px-8 py-3 bg-[#0066FF] text-white rounded-md 
                hover:bg-blue-700 transition-colors font-semibold text-lg"
            >
              Start Now
            </a>
            <a
              href="/services"
              className="px-8 py-3 border border-gray-300 text-gray-700 rounded-md 
                hover:border-gray-400 transition-colors font-semibold text-lg"
            >
              Learn More
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}