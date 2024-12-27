import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { PhotoIcon } from '@heroicons/react/24/outline'

interface ImageUploaderProps {
  onUpload: (files: FileList) => void
  loading: boolean
}

export function ImageUploader({ onUpload, loading }: ImageUploaderProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const fileList = Object.assign(acceptedFiles, {
      item: (index: number) => acceptedFiles[index],
      length: acceptedFiles.length
    })
    onUpload(fileList as FileList)
  }, [onUpload])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png']
    }
  })

  return (
    <div
      {...getRootProps()}
      className={`
        border-2 border-dashed rounded-lg p-8 text-center
        ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
        ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-gray-400'}
      `}
    >
      <input {...getInputProps()} disabled={loading} />
      <PhotoIcon className="mx-auto h-12 w-12 text-gray-400" />
      <p className="mt-2 text-sm text-gray-600">
        {isDragActive
          ? "Drop the files here..."
          : "Drag 'n' drop images here, or click to select"}
      </p>
    </div>
  )
} 