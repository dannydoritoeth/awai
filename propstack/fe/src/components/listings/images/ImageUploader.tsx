import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { ArrowUpTrayIcon } from '@heroicons/react/24/outline'

interface ImageUploaderProps {
  onUpload: (files: FileList) => Promise<void>
  loading: boolean
}

export function ImageUploader({ onUpload, loading }: ImageUploaderProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const dataTransfer = new DataTransfer()
    acceptedFiles.forEach(file => dataTransfer.items.add(file))
    onUpload(dataTransfer.files)
  }, [onUpload])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp']
    },
    disabled: loading,
    maxSize: 5 * 1024 * 1024 // 5MB
  })

  return (
    <div className="relative">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-12
          flex flex-col items-center justify-center
          min-h-[200px]
          transition-colors duration-200
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
          ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'}
        `}
      >
        <input {...getInputProps()} />
        <ArrowUpTrayIcon className={`w-12 h-12 mb-4 ${isDragActive ? 'text-blue-500' : 'text-gray-400'}`} />
        <p className="text-base text-gray-600 font-medium">
          {isDragActive ? (
            "Drop the images here..."
          ) : (
            "Drag & drop images here, or click to select"
          )}
        </p>
        <p className="text-sm text-gray-500 mt-2">Maximum file size: 5MB</p>
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-3"></div>
            <p className="text-base text-gray-600">Uploading images...</p>
          </div>
        </div>
      )}
    </div>
  )
} 