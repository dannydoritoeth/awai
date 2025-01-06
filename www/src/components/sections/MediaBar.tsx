export function MediaBar() {
  return (
    <section className="py-8 bg-gray-900">
      <div className="container mx-auto px-4">
        <p className="text-center text-gray-400 text-sm mb-6">
          AS SEEN ON
        </p>
        <div className="flex justify-center items-center gap-12 opacity-70 grayscale">
          <img src="/assets/media/forbes.svg" alt="Media Logo" className="h-8" />
          <img src="/assets/media/entrepreneur.svg" alt="Media Logo" className="h-8" />
          <img src="/assets/media/inc.svg" alt="Media Logo" className="h-8" />
          <img src="/assets/media/business-insider.svg" alt="Media Logo" className="h-8" />
        </div>
      </div>
    </section>
  );
} 