export function ProblemSection() {
  return (
    <section className="section-padding bg-gray-50">
      <div className="section-container">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-12">
          Common Challenges Sales Teams Face
        </h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Challenge 1 */}
          <div className="bg-white p-8 rounded-lg shadow-lg">
            <h3 className="text-2xl font-semibold mb-4 text-gray-900">
              Time-Consuming Manual Tasks
            </h3>
            <p className="text-gray-700">
              Hours wasted on data entry, follow-ups, and administrative work 
              instead of focusing on closing deals.
            </p>
          </div>

          {/* Challenge 2 */}
          <div className="bg-white p-8 rounded-lg shadow-lg">
            <h3 className="text-2xl font-semibold mb-4 text-gray-900">
              Inconsistent Lead Quality
            </h3>
            <p className="text-gray-700">
              Struggling with unreliable lead sources and spending valuable time 
              on prospects that never convert.
            </p>
          </div>

          {/* Challenge 3 */}
          <div className="bg-white p-8 rounded-lg shadow-lg">
            <h3 className="text-2xl font-semibold mb-4 text-gray-900">
              Scaling Difficulties
            </h3>
            <p className="text-gray-700">
              Unable to handle increased lead volume without hiring more staff 
              or working longer hours.
            </p>
          </div>
        </div>

        {/* Pain Point Summary */}
        <div className="mt-12 text-center">
          <p className="text-xl text-gray-700 max-w-3xl mx-auto">
            If any of these challenges sound familiar, you're not alone. 
            But there's a better way to run your sales operation.
          </p>
        </div>
      </div>
    </section>
  );
} 