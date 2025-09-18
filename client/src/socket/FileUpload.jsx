import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Card, CardContent } from '@/components/ui/card.jsx'
import { Progress } from '@/components/ui/progress.jsx'
import { 
  Upload, 
  X, 
  File, 
  Image, 
  Video, 
  Music,
  FileText
} from 'lucide-react'

const FileUpload = ({ onFileUpload, onClose }) => {
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  const handleFileSelect = (file) => {
    if (file && file.size <= 10 * 1024 * 1024) { // 10MB limit
      setSelectedFile(file)
    } else {
      alert('File size must be less than 10MB')
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    handleFileSelect(file)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setDragOver(false)
  }

  const uploadFile = async () => {
    if (!selectedFile) return

    setUploading(true)
    setUploadProgress(0)

    const formData = new FormData()
    formData.append('file', selectedFile)

    try {
      const response = await fetch('https://5000-icunrtsc1a3j808ljp9f7-4b4915e2.manusvm.computer/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const fileInfo = await response.json()
        onFileUpload(fileInfo)
        setSelectedFile(null)
        onClose()
      } else {
        throw new Error('Upload failed')
      }
    } catch (error) {
      console.error('Upload error:', error)
      alert('File upload failed')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const getFileIcon = (file) => {
    if (!file) return <File className="w-8 h-8" />
    
    if (file.type.startsWith('image/')) return <Image className="w-8 h-8 text-blue-500" />
    if (file.type.startsWith('video/')) return <Video className="w-8 h-8 text-purple-500" />
    if (file.type.startsWith('audio/')) return <Music className="w-8 h-8 text-green-500" />
    if (file.type.includes('pdf') || file.type.includes('document')) return <FileText className="w-8 h-8 text-red-500" />
    
    return <File className="w-8 h-8 text-gray-500" />
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Upload File</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {!selectedFile ? (
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragOver 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">
              Drag and drop a file here, or click to select
            </p>
            <p className="text-sm text-gray-500">
              Max file size: 10MB
            </p>
            <Input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files[0])}
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              {getFileIcon(selectedFile)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {selectedFile.name}
                </p>
                <p className="text-sm text-gray-500">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedFile(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {uploading && (
              <div className="space-y-2">
                <Progress value={uploadProgress} className="w-full" />
                <p className="text-sm text-gray-500 text-center">
                  Uploading... {uploadProgress}%
                </p>
              </div>
            )}

            <div className="flex space-x-2">
              <Button
                onClick={uploadFile}
                disabled={uploading}
                className="flex-1"
              >
                {uploading ? 'Uploading...' : 'Upload'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setSelectedFile(null)}
                disabled={uploading}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default FileUpload

