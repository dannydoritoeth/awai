export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-gray-900 text-center mb-4">
          Choose the plan that fits your needs.
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
          {/* Starter Plan */}
          <div className="bg-white rounded-xl shadow-sm p-8">
            <h2 className="text-2xl font-semibold text-gray-900">Starter</h2>
            <p className="text-gray-600 mb-4">For individuals</p>
            <p className="text-3xl font-bold text-gray-900 mb-6">Free</p>
            <button className="w-full bg-indigo-600 text-white rounded-md py-2 px-4 hover:bg-indigo-700">
              Sign Up, It's Free
            </button>
            <div className="mt-6">
              <p className="text-gray-600 mb-2">Includes:</p>
              <ul className="space-y-2">
                <li className="flex items-center text-gray-600">
                  <span>• Up to 25 videos/person</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Business Plan */}
          <div className="bg-white rounded-xl shadow-sm p-8">
            <h2 className="text-2xl font-semibold text-gray-900">Business</h2>
            <p className="text-gray-600 mb-4">For teams</p>
            <p className="text-3xl font-bold text-gray-900 mb-6">$12.50</p>
            <button className="w-full bg-indigo-600 text-white rounded-md py-2 px-4 hover:bg-indigo-700">
              Start Free 14-Day Trial
            </button>
            <div className="mt-6">
              <p className="text-gray-600 mb-2">Includes:</p>
              <ul className="space-y-2">
                <li className="flex items-center text-gray-600">
                  <span>• Unlimited videos</span>
                </li>
                <li className="flex items-center text-gray-600">
                  <span>• Optimized recording length</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Enterprise Plan */}
          <div className="bg-white rounded-xl shadow-sm p-8">
            <h2 className="text-2xl font-semibold text-gray-900">Enterprise</h2>
            <p className="text-gray-600 mb-4">For scaling teams</p>
            <p className="text-3xl font-bold text-gray-900 mb-6">Let's Talk</p>
            <button className="w-full bg-indigo-600 text-white rounded-md py-2 px-4 hover:bg-indigo-700">
              Contact Sales
            </button>
            <div className="mt-6">
              <p className="text-gray-600 mb-2">Includes:</p>
              <ul className="space-y-2">
                <li className="flex items-center text-gray-600">
                  <span>• Unlimited videos</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>
      
    </div>
  )
} 