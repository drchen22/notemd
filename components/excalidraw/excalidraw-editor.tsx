'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Excalidraw, THEME } from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI, AppState, BinaryFiles, BinaryFileData } from '@excalidraw/excalidraw/types'

type ExcalidrawElement = import('@excalidraw/excalidraw/element/types').ExcalidrawElement

import '@excalidraw/excalidraw/index.css'

type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved'

/** Lightweight fingerprint from elements to detect actual content changes. */
function elementsFingerprint(elements: readonly ExcalidrawElement[]): string {
  const parts = elements
    .map((el) => `${el.id}:${el.version}:${el.isDeleted ? 1 : 0}`)
    .sort()
    .join(',')
  return `${elements.length}|${parts}`
}

/** Convert a dataURL string to a Blob for uploading. */
function dataURLtoBlob(dataURL: string): Blob {
  const [meta, base64] = dataURL.split(',')
  const mimeMatch = meta.match(/:(.*?);/)
  const mime = mimeMatch ? mimeMatch[1] : 'image/png'
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

/** Convert a Blob to a dataURL string. */
function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/** Upload a single image to the server's assets directory.
 *  Returns the relative path (e.g. "assets/uuid.png"). */
async function uploadImage(blob: Blob, filePath: string): Promise<string> {
  const formData = new FormData()
  formData.append('file', blob, 'image.png')
  formData.append('filePath', filePath)

  const res = await fetch('/api/upload', { method: 'POST', body: formData })
  if (!res.ok) throw new Error('Upload failed')
  const data = await res.json()
  return data.path as string
}

/** Fetch images from file references and reconstruct BinaryFiles for Excalidraw.
 *  fileReferences: { fileId → relativePath (e.g. "assets/uuid.png") }
 *  filePath: the .excalidraw file's path (to resolve the parent dir) */
async function loadFileReferences(
  fileReferences: Record<string, string>,
  filePath: string,
): Promise<BinaryFiles> {
  const fileDir = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : ''
  const files: BinaryFiles = {}

  const entries = Object.entries(fileReferences)
  const results = await Promise.allSettled(
    entries.map(async ([fileId, refPath]) => {
      const fullPath = fileDir ? `${fileDir}/${refPath}` : refPath
      const res = await fetch(`/api/content-files?path=${encodeURIComponent(fullPath)}`)
      if (!res.ok) throw new Error(`Failed to load image: ${fullPath}`)
      const blob = await res.blob()
      const dataURL = await blobToDataURL(blob)
      files[fileId] = {
        id: fileId as BinaryFileData['id'],
        mimeType: blob.type as BinaryFileData['mimeType'],
        dataURL: dataURL as BinaryFileData['dataURL'],
        created: Date.now(),
      }
    }),
  )

  // Log any failures but don't crash
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.warn(`Failed to load image ${entries[i][0]}:`, r.reason)
    }
  })

  return files
}

const DEBOUNCE_MS = 1500

interface ExcalidrawEditorProps {
  /** Raw JSON string of the .excalidraw file */
  sceneContent?: string | null
  /** Current file path (e.g. "project/diagram.excalidraw") */
  activeFilePath?: string | null
  /** Callback when save status changes */
  onStatusChange?: (status: SaveStatus) => void
}

export default function ExcalidrawEditor({
  sceneContent,
  activeFilePath,
  onStatusChange,
}: ExcalidrawEditorProps) {
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null)
  const [loadedInitialData, setLoadedInitialData] = useState<{
    elements: ExcalidrawElement[]
    appState?: Record<string, unknown>
    files?: BinaryFiles
    scrollToContent: boolean
  } | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedFingerprintRef = useRef<string | null>(null)
  const filePathRef = useRef(activeFilePath)
  const onStatusChangeRef = useRef(onStatusChange)
  const isLoadingSceneRef = useRef(false)
  // Track file references from the loaded file to avoid re-uploading existing images
  const loadedFileRefsRef = useRef<Record<string, string> | null>(null)

  // Keep refs in sync
  filePathRef.current = activeFilePath
  onStatusChangeRef.current = onStatusChange

  // Load scene data asynchronously — handles both new fileReferences and legacy embedded files
  useEffect(() => {
    if (!sceneContent || !activeFilePath) {
      setLoadedInitialData(null)
      loadedFileRefsRef.current = null
      return
    }
    let cancelled = false
    async function load() {
      try {
        const parsed = JSON.parse(sceneContent!)
        if (!parsed.elements) {
          setLoadedInitialData(null)
          return
        }

        // Record initial fingerprint so we don't save unchanged content on load
        lastSavedFingerprintRef.current = elementsFingerprint(parsed.elements as ExcalidrawElement[])

        // New format: fileReferences → fetch images from assets
        // Legacy format: files → dataURLs embedded in JSON (use directly)
        let files: BinaryFiles | undefined
        if (parsed.fileReferences && Object.keys(parsed.fileReferences).length > 0) {
          loadedFileRefsRef.current = parsed.fileReferences
          files = await loadFileReferences(parsed.fileReferences, activeFilePath!)
        } else if (parsed.files && Object.keys(parsed.files).length > 0) {
          // Legacy: files stored as dataURLs directly in the JSON
          files = parsed.files
          loadedFileRefsRef.current = null
        }

        if (!cancelled) {
          setLoadedInitialData({
            elements: parsed.elements as ExcalidrawElement[],
            appState: parsed.appState ?? undefined,
            files,
            scrollToContent: true,
          })
        }
      } catch {
        if (!cancelled) setLoadedInitialData(null)
      }
    }
    load()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilePath]) // re-run when file changes (component remounts via key)

  const setStatus = useCallback((status: SaveStatus) => {
    onStatusChangeRef.current?.(status)
  }, [])

  /** Serialize and save the scene to the server */
  const saveFile = useCallback(async () => {
    const fp = filePathRef.current
    if (!fp) return

    const api = excalidrawAPI
    if (!api) return

    setStatus('saving')

    try {
      const elements = api.getSceneElements()
      const appState = api.getAppState()

      // Collect binary files (images) referenced by elements
      const allFiles = api.getFiles()
      const elementFileIds = new Set(
        elements
          .filter((el) => 'fileId' in el && el.fileId)
          .map((el) => (el as { fileId: string }).fileId),
      )

      // Upload new images to assets/, build fileReferences map
      const existingRefs = loadedFileRefsRef.current ?? {}
      const fileReferences: Record<string, string> = {}

      for (const fileId of elementFileIds) {
        // Already uploaded in a previous save → reuse the existing path
        if (existingRefs[fileId]) {
          fileReferences[fileId] = existingRefs[fileId]
          continue
        }

        // New image → upload to assets
        const fileData = allFiles[fileId]
        if (fileData?.dataURL) {
          const blob = dataURLtoBlob(fileData.dataURL)
          const relativePath = await uploadImage(blob, fp)
          fileReferences[fileId] = relativePath
        }
      }

      const sceneData = {
        type: 'excalidraw',
        version: 2,
        source: 'notemd',
        elements,
        appState: {
          viewBackgroundColor: appState.viewBackgroundColor,
          gridSize: appState.gridSize,
        },
        ...(Object.keys(fileReferences).length > 0 ? { fileReferences } : {}),
      }

      const json = JSON.stringify(sceneData)

      const res = await fetch('/api/files', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: fp, content: json }),
      })

      if (res.ok) {
        lastSavedFingerprintRef.current = elementsFingerprint(elements)
        // Update loaded refs so subsequent saves don't re-upload the same images
        loadedFileRefsRef.current = fileReferences
        setStatus('saved')
        setTimeout(() => setStatus('idle'), 2000)
      } else {
        setStatus('idle')
      }
    } catch {
      setStatus('idle')
    }
  }, [excalidrawAPI, setStatus])

  const saveFileRef = useRef(saveFile)
  saveFileRef.current = saveFile

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  const handleChange = useCallback(
    (elements: readonly ExcalidrawElement[], _appState: AppState, _files: BinaryFiles) => {
      if (isLoadingSceneRef.current) return

      // Only trigger save when elements actually changed (not on scroll/zoom/selection)
      const fp = elementsFingerprint(elements)
      if (fp === lastSavedFingerprintRef.current) return

      setStatus('unsaved')

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        saveFileRef.current()
      }, DEBOUNCE_MS)
    },
    [setStatus],
  )

  return (
    <div className="excalidraw-container" style={{ height: '100%', width: '100%' }}>
      {loadedInitialData || !sceneContent ? (
        <Excalidraw
          key={activeFilePath}
          excalidrawAPI={(api) => setExcalidrawAPI(api)}
          initialData={loadedInitialData ?? undefined}
          onChange={handleChange}
          theme={THEME.LIGHT}
          langCode="zh-CN"
          UIOptions={{
            canvasActions: {
              loadScene: false,
              export: { saveFileToDisk: true },
              saveToActiveFile: false,
            },
          }}
          gridModeEnabled={false}
          viewModeEnabled={false}
          zenModeEnabled={false}
        />
      ) : (
        <div className="flex items-center justify-center h-full text-sm text-[#8a8a8a]">
          Loading…
        </div>
      )}
    </div>
  )
}
