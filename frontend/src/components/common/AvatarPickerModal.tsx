import React, { useRef, useState } from 'react'
import { RotateCcw, Upload } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './Button'
import { Avatar } from './Avatar'

export interface AvatarPickerModalProps {
  isOpen: boolean
  onClose: () => void
  currentAvatar: string
  onSave: (avatarUrl: string) => void
  userName?: string
}

export function AvatarPickerModal({
  isOpen,
  onClose,
  currentAvatar,
  onSave,
  userName = 'Profile',
}: AvatarPickerModalProps) {
  const [draftAvatar, setDraftAvatar] = useState<string | null>(null)
  const [customUrl, setCustomUrl] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const selectedAvatar = draftAvatar ?? currentAvatar

  const handleClose = () => {
    setDraftAvatar(null)
    setCustomUrl('')
    onClose()
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setDraftAvatar(reader.result)
        }
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSave = () => {
    onSave(selectedAvatar)
    handleClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Change Profile Picture — ${userName}`}>
      <div className="space-y-5">
        {/* Current / Selected Preview */}
        <div className="flex items-center justify-between gap-4 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar
                src={selectedAvatar}
                name={userName}
                className="w-16 h-16 text-xl border-2 border-indigo-500 shadow-sm"
              />
              <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900 absolute -bottom-0.5 -right-0.5" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                Active Selection Preview
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Upload an image, paste a corporate photo URL, or use clean initials
              </span>
            </div>
          </div>

          {selectedAvatar && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              icon={RotateCcw}
              onClick={() => setDraftAvatar('')}
            >
              Use Initials
            </Button>
          )}
        </div>

        {/* Upload from device */}
        <div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-2.5 px-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 bg-white dark:bg-slate-800/40 text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Upload className="w-4 h-4 text-slate-400" />
            <span>Upload Image from Computer</span>
          </button>
        </div>

        {/* Custom Image URL input */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Or Paste Custom Image URL
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://example.com/photo.jpg"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              className="flex-1 text-xs px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
            />
            <Button
              type="button"
              variant="secondary"
              size="xs"
              onClick={() => {
                if (customUrl.trim()) {
                  setDraftAvatar(customUrl.trim())
                  setCustomUrl('')
                }
              }}
              disabled={!customUrl.trim()}
            >
              Apply
            </Button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
          <Button variant="ghost" size="sm" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave}>
            Save Picture
          </Button>
        </div>
      </div>
    </Modal>
  )
}
