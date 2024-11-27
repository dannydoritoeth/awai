export default function PrivacyPolicy() {
  return (
    <main className="pt-40 pb-16 min-h-screen bg-white">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-gray-900 mb-8">Privacy Policy</h1>
          
          <div className="prose prose-lg max-w-none">
            <p className="text-gray-600 mb-6">Last updated: {new Date().toLocaleDateString()}</p>
            
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">1. Information We Collect</h2>
              <p className="text-gray-600">
                We collect information that you provide directly to us, including when you fill out forms,
                contact us, or interact with our services. This may include your name, email address,
                phone number, and any other information you choose to provide.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">2. How We Use Your Information</h2>
              <p className="text-gray-600">
                We use the information we collect to provide, maintain, and improve our services,
                to communicate with you, and to comply with legal obligations.
              </p>
            </section>

            {/* Add more sections as needed */}
          </div>
        </div>
      </div>
    </main>
  );
} 