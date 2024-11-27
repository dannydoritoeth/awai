export default function TermsOfService() {
  return (
    <main className="pt-40 pb-16 min-h-screen bg-white">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-gray-900 mb-8">Terms of Service</h1>
          
          <div className="prose prose-lg max-w-none">
            <p className="text-gray-600 mb-6">Last updated: {new Date().toLocaleDateString()}</p>
            
            <p className="text-gray-600 mb-8">
              Welcome to acceleratewith.ai ("we," "us," or "our"). By accessing or using our website and services, 
              you agree to be bound by these Terms of Service ("Terms"). If you do not agree with these Terms, 
              please do not use our website or services.
            </p>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">1. Scope of Services</h2>
              <div className="text-gray-600 space-y-4">
                <p>1.1 acceleratewith.ai provides AI automation services tailored to the real estate industry.</p>
                <p>1.2 Our services may include, but are not limited to, consulting, implementation, training, and support for AI-driven automation tools.</p>
                <p>1.3 The specific scope of work will be outlined in a separate agreement with each client.</p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">2. Eligibility</h2>
              <div className="text-gray-600 space-y-4">
                <p>2.1 You must be at least 18 years old to use our services.</p>
                <p>2.2 By using our services, you represent that you have the authority to enter into a binding agreement on behalf of yourself or your organization.</p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">3. Use of Website</h2>
              <div className="text-gray-600 space-y-4">
                <p>3.1 You agree to use the website for lawful purposes only.</p>
                <p>3.2 You are prohibited from using the website to:</p>
                <ul className="list-disc pl-8 space-y-2">
                  <li>Violate any applicable laws or regulations.</li>
                  <li>Attempt to disrupt or harm our systems.</li>
                  <li>Misrepresent your identity or affiliation.</li>
                </ul>
              </div>
            </section>

            {/* Continue with sections 4-14 in the same format */}
            
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">14. Contact Information</h2>
              <p className="text-gray-600">
                For questions or concerns about these Terms, please contact us using the contact form.
              </p>
            </section>

            <p className="text-gray-600 mt-8 font-medium">
              By using our website or services, you acknowledge that you have read, understood, and agree 
              to be bound by these Terms of Service.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
} 