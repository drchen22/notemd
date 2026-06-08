'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Excalidraw, THEME } from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI, AppState, BinaryFiles } from '@excalidraw/excalidraw/types'

type ExcalidrawElement = import('@excalidraw/excalidraw/element/types').ExcalidrawElement

import '@excalidraw/excalidraw/index.css'

type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved'

/** Generate a lightweight fingerprint from elements to detect actual content changes.
 *  Only uses id + version + isDeleted so scroll/zoom/selection changes don't trigger saves. */
function elementsFingerprint(elements: readonly ExcalidrawElement[]): string {
  // Sort by id for stable comparison
  const parts = elements
    .map((el) => `${el.id}:${el.version}:${el.isDeleted ? 1 : 0}`)
    .sort()
    .join(',')
  return `${elements.length}|${parts}`
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
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedContentRef = useRef<string | null>(null)
  const lastSavedFingerprintRef = useRef<string | null>(null)
  const filePathRef = useRef(activeFilePath)
  const onStatusChangeRef = useRef(onStatusChange)
  const isLoadingSceneRef = useRef(false)

  // Keep refs in sync
  filePathRef.current = activeFilePath
  onStatusChangeRef.current = onStatusChange

  // Parse scene data for initialData — only on first render per file
  const initialData = useMemo(() => {
    if (!sceneContent) return undefined
    try {
      const parsed = JSON.parse(sceneContent)
      if (parsed.elements) {
        // Record initial fingerprint so we don't save unchanged content on load
        lastSavedFingerprintRef.current = elementsFingerprint(parsed.elements as ExcalidrawElement[])
        return {
          elements: parsed.elements as ExcalidrawElement[],
          appState: parsed.appState ?? undefined,
          scrollToContent: true,
        }
      }
    } catch {
      // Not valid JSON — start with blank canvas
    }
    return undefined
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilePath]) // recompute when file changes (component remounts via key)

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

      // Save full element data — don't strip properties, Excalidraw needs them on reload
      const sceneData = {
        type: 'excalidraw',
        version: 2,
        source: 'notemd',
        elements,
        appState: {
          viewBackgroundColor: appState.viewBackgroundColor,
          gridSize: appState.gridSize,
        },
      }

      const json = JSON.stringify(sceneData)

      const res = await fetch('/api/files', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: fp, content: json }),
      })

      if (res.ok) {
        lastSavedContentRef.current = json
        lastSavedFingerprintRef.current = elementsFingerprint(elements)
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
      <Excalidraw
        key={activeFilePath}
        excalidrawAPI={(api) => setExcalidrawAPI(api)}
        initialData={initialData}
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
    </div>
  )
}
