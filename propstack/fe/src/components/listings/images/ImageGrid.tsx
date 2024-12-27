interface ImageGridProps {
  images: Array<{
    id: string
    url: string
    order: number
  }>
  onDelete: (imageId: string) => void
}

export function ImageGrid({ images, onDelete }: ImageGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {images.map((image) => (
        <div key={image.id} className="relative group">
          <img
            src={image.url}
            alt=""
            className="w-full h-48 object-cover rounded-lg"
          />
          
          {/* Overlay with actions */}
          <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                onClick={() => onDelete(image.id)}
                className="px-3 py-1 bg-red-600 text-white rounded-md text-sm hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
} 