import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen p-8">
      {/* Header */}
      <div className="max-w-4xl mx-auto text-center mb-16">
        <div className="bg-white/50 backdrop-blur-sm py-8 px-4 rounded-3xl shadow-sm">
          <h1 className="text-5xl font-bold text-blue-600 mb-4 tracking-tight">
          TalentAI
          </h1>
          <p className="text-2xl text-blue-950 font-medium">
            Intelligent HR matching for roles and candidates
          </p>
        </div>
      </div>

      {/* Main Menu */}
      <div className="max-w-3xl mx-auto grid grid-cols-1 gap-8 md:grid-cols-2">
        <Link href="/role-finder" 
          className="group relative bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-transparent hover:border-blue-500">
          <div className="text-center">
            <div className="bg-blue-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center group-hover:bg-blue-200 transition-colors duration-300">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              Find the Best Role
            </h2>
            <p className="text-gray-600">
              Match candidates with their ideal roles based on skills and experience
            </p>
          </div>
        </Link>

        <Link href="/candidate-finder"
          className="group relative bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-transparent hover:border-green-500">
          <div className="text-center">
            <div className="bg-green-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center group-hover:bg-green-200 transition-colors duration-300">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              Find the Best Candidate
            </h2>
            <p className="text-gray-600">
              Discover perfect candidates for your open positions
            </p>
          </div>
        </Link>
      </div>
    </main>
  );
}
