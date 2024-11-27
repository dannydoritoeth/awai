export default function PrivacyPolicy() {
  return (
    <main className="pt-40 pb-16 min-h-screen bg-white">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-gray-900 mb-8">Privacy Policy</h1>
          
          <div className="prose prose-lg max-w-none">
            <p className="text-gray-600 mb-6">Last updated: {new Date().toLocaleDateString()}</p>
            
            <p className="text-gray-600 mb-8">
              Acceleratewith.ai ("we," "us," or "our") is committed to protecting your privacy and ensuring your personal information is handled securely and responsibly. This Privacy Policy outlines how we collect, use, store, and disclose your personal information in compliance with the Privacy Act 1988 (Cth) and the Australian Privacy Principles (APPs).
            </p>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">1. Personal Information We Collect</h2>
              <p className="text-gray-600 mb-4">We may collect the following types of personal information:</p>
              <ul className="text-gray-600 list-disc pl-8 space-y-2">
                <li><span className="font-medium">Identity Information:</span> Name, job title, company name.</li>
                <li><span className="font-medium">Contact Information:</span> Email address, phone number, physical address.</li>
                <li><span className="font-medium">Usage Information:</span> Information about how you use our website, services, and tools, such as IP address, browser type, and device information.</li>
                <li><span className="font-medium">Payment Information:</span> Billing and transaction details for our services (processed securely).</li>
                <li><span className="font-medium">Other Information:</span> Any other personal information you provide to us directly or indirectly through our website or services.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">2. How We Collect Personal Information</h2>
              <p className="text-gray-600 mb-4">We collect personal information in the following ways:</p>
              <ul className="text-gray-600 list-disc pl-8 space-y-2">
                <li><span className="font-medium">Directly from You:</span> When you fill out forms on our website, subscribe to our services, or contact us.</li>
                <li><span className="font-medium">Automatically:</span> Through cookies, tracking technologies, and server logs when you interact with our website.</li>
                <li><span className="font-medium">Third Parties:</span> From payment processors, analytics providers, or publicly available sources.</li>
              </ul>
            </section>

            {/* Continue with sections 3-11 in the same format */}

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">12. Contact Information</h2>
              <p className="text-gray-600">
                For questions or concerns about this Privacy Policy, please contact us using the contact form.
              </p>
            </section>

            <p className="text-gray-600 mt-8 font-medium">
              By using our website or services, you consent to the collection, use, and disclosure of your personal 
              information in accordance with this Privacy Policy.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
} 