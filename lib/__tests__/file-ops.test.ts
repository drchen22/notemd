import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

// file-ops.ts caches the file tree at module level and reads CONTENT_DIR from
// env on every call. We point CONTENT_DIR at a fresh temp dir per test and
// re-import the module so the treeCache never leaks between tests.
let tmpDir: string

async function importFileOps() {
  vi.resetModules()
  return import('@/lib/file-ops')
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'notemd-test-'))
  process.env.CONTENT_DIR = tmpDir
})

afterEach(async () => {
  try {
    await fs.rm(tmpDir, { recursive: true, force: true })
  } catch {
    // best effort cleanup
  }
})

describe('getTree', () => {
  it('returns an empty tree for an empty vault', async () => {
    const { getTree } = await importFileOps()
    expect(await getTree()).toEqual([])
  })

  it('lists files and folders, folders first then alphabetical', async () => {
    await fs.writeFile(path.join(tmpDir, 'b.md'), '# B')
    await fs.writeFile(path.join(tmpDir, 'a.md'), '# A')
    await fs.mkdir(path.join(tmpDir, 'folder'))
    await fs.writeFile(path.join(tmpDir, 'folder', 'c.md'), '# C')

    const { getTree } = await importFileOps()
    const tree = await getTree()

    // Folder sorted before files, files alphabetical
    expect(tree[0].name).toBe('folder')
    expect(tree[0].type).toBe('folder')
    expect(tree[1].name).toBe('a.md')
    expect(tree[2].name).toBe('b.md')
  })

  it('hides dotfiles and the assets/ directory', async () => {
    await fs.mkdir(path.join(tmpDir, 'assets'))
    await fs.writeFile(path.join(tmpDir, 'assets', 'img.png'), 'x')
    await fs.writeFile(path.join(tmpDir, '.hidden'), 'x')
    await fs.writeFile(path.join(tmpDir, 'visible.md'), '# V')

    const { getTree } = await importFileOps()
    const tree = await getTree()

    expect(tree.map((n) => n.name)).toEqual(['visible.md'])
  })

  it('only includes .md and .excalidraw files', async () => {
    await fs.writeFile(path.join(tmpDir, 'note.md'), '# N')
    await fs.writeFile(path.join(tmpDir, 'board.excalidraw'), '{}')
    await fs.writeFile(path.join(tmpDir, 'readme.txt'), 'ignore me')

    const { getTree } = await importFileOps()
    const tree = await getTree()

    expect(tree.map((n) => n.name).sort()).toEqual(['board.excalidraw', 'note.md'])
  })

  it('parses frontmatter and builds a preview for .md files', async () => {
    await fs.writeFile(
      path.join(tmpDir, 'note.md'),
      '---\ntitle: Hello\n---\n# Heading\n\nBody text here.',
    )

    const { getTree } = await importFileOps()
    const tree = await getTree()
    const node = tree[0]
    expect(node.frontmatter?.title).toBe('Hello')
    expect(node.preview).toContain('Body text here')
    // Heading markers stripped from preview
    expect(node.preview).not.toContain('# Heading')
  })
})

describe('readFile', () => {
  it('reads a .md file, splitting frontmatter and body', async () => {
    await fs.writeFile(
      path.join(tmpDir, 'note.md'),
      '---\ntitle: T\n---\n# Body',
    )
    const { readFile } = await importFileOps()
    const { content, frontmatter } = await readFile('note.md')
    expect(frontmatter.title).toBe('T')
    expect(content.trim()).toBe('# Body')
  })

  it('returns raw content for .excalidraw files', async () => {
    const raw = '{"type":"excalidraw","elements":[]}'
    await fs.writeFile(path.join(tmpDir, 'b.excalidraw'), raw)
    const { readFile } = await importFileOps()
    const { content, frontmatter } = await readFile('b.excalidraw')
    expect(content).toBe(raw)
    expect(frontmatter).toEqual({})
  })

  it('throws on path traversal (..)', async () => {
    const { readFile } = await importFileOps()
    await expect(readFile('../../etc/passwd')).rejects.toThrow(/Forbidden/)
  })

  it('throws on unsupported extension', async () => {
    await fs.writeFile(path.join(tmpDir, 'f.txt'), 'x')
    const { readFile } = await importFileOps()
    await expect(readFile('f.txt')).rejects.toThrow(/Forbidden/)
  })
})

describe('writeFile', () => {
  it('writes content + frontmatter to a .md file', async () => {
    const { writeFile, readFile } = await importFileOps()
    await writeFile('note.md', 'body', { title: 'T' })
    const { content, frontmatter } = await readFile('note.md')
    expect(content.trim()).toBe('body')
    expect(frontmatter.title).toBe('T')
  })

  it('writes raw content for .excalidraw files', async () => {
    const { writeFile, readFile } = await importFileOps()
    const raw = '{"type":"excalidraw"}'
    await writeFile('b.excalidraw', raw)
    const { content } = await readFile('b.excalidraw')
    expect(content).toBe(raw)
  })

  it('creates parent directories as needed', async () => {
    const { writeFile, readFile } = await importFileOps()
    await writeFile('deep/nested/note.md', 'x')
    const { content } = await readFile('deep/nested/note.md')
    expect(content.trim()).toBe('x')
  })

  it('writes body only when frontmatter is empty', async () => {
    const { writeFile, readFile } = await importFileOps()
    await writeFile('note.md', '# Title')
    const { content, frontmatter } = await readFile('note.md')
    expect(content.trim()).toBe('# Title')
    expect(frontmatter).toEqual({})
  })

  it('rejects path traversal', async () => {
    const { writeFile } = await importFileOps()
    await expect(writeFile('../escape.md', 'x')).rejects.toThrow(/Forbidden/)
  })
})

describe('createFile', () => {
  it('creates a new .md file with auto-generated frontmatter', async () => {
    const { createFile, readFile } = await importFileOps()
    await createFile('notes/hello.md', '')
    const { frontmatter } = await readFile('notes/hello.md')
    expect(frontmatter.title).toBe('Hello')
    expect(frontmatter.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('appends .md extension when missing', async () => {
    const { createFile, readFile } = await importFileOps()
    await createFile('notes/world')
    const { frontmatter } = await readFile('notes/world.md')
    expect(frontmatter.title).toBe('World')
  })

  it('creates an empty scene for .excalidraw files', async () => {
    const { createFile, readFile } = await importFileOps()
    await createFile('board.excalidraw')
    const { content } = await readFile('board.excalidraw')
    expect(JSON.parse(content).type).toBe('excalidraw')
  })

  it('fails when the file already exists (atomic)', async () => {
    const { createFile } = await importFileOps()
    await createFile('note.md', '')
    await expect(createFile('note.md', '')).rejects.toThrow(/already exists/)
  })

  it('creates nested directories (deep paths are allowed by design)', async () => {
    const { createFile, readFile } = await importFileOps()
    await createFile('a/b/c.md', '')
    const { frontmatter } = await readFile('a/b/c.md')
    expect(frontmatter.title).toBe('C')
  })

  it('normalizes intermediate ".." segments safely (stays inside vault)', async () => {
    // path.resolve collapses "a/../b.md" to "b.md" before validateName sees it,
    // and resolveSafePath keeps the result inside the content dir. Document this
    // so a future change that loosened the traversal guard would be caught.
    const { createFile, readFile } = await importFileOps()
    await createFile('a/../b.md', '')
    // File lands at the vault root as "b.md", not outside it
    const { frontmatter } = await readFile('b.md')
    expect(frontmatter.title).toBe('B')
  })
})

describe('createFolder', () => {
  it('creates a new folder', async () => {
    const { createFolder } = await importFileOps()
    await createFolder('new-folder')
    const stat = await fs.stat(path.join(tmpDir, 'new-folder'))
    expect(stat.isDirectory()).toBe(true)
  })

  it('fails when the folder already exists', async () => {
    const { createFolder } = await importFileOps()
    await createFolder('exists')
    await expect(createFolder('exists')).rejects.toThrow(/already exists/)
  })
})

describe('deleteItem', () => {
  it('deletes a file', async () => {
    const { createFile, deleteItem, getTree } = await importFileOps()
    await createFile('note.md', '')
    await deleteItem('note.md')
    expect(await getTree()).toEqual([])
  })

  it('deletes a folder recursively', async () => {
    const { createFile, createFolder, deleteItem, getTree } = await importFileOps()
    await createFolder('folder')
    await createFile('folder/note.md', '')
    await deleteItem('folder')
    expect(await getTree()).toEqual([])
  })

  it('throws when the item does not exist', async () => {
    const { deleteItem } = await importFileOps()
    await expect(deleteItem('nope.md')).rejects.toThrow(/not found/i)
  })
})

describe('renameItem', () => {
  it('renames a file and returns the new relative path', async () => {
    const { createFile, renameItem, readFile } = await importFileOps()
    await createFile('old.md', '')
    const newPath = await renameItem('old.md', 'new')
    expect(newPath).toBe('new.md')
    const { frontmatter } = await readFile('new.md')
    // syncTitleToFilename defaults to true for .md → title updated to slug
    expect(frontmatter.title).toBe('New')
  })

  it('syncs the frontmatter title to the new filename by default', async () => {
    const { createFile, renameItem, readFile } = await importFileOps()
    await createFile('a.md', '---\ntitle: Original\n---\nbody')
    await renameItem('a.md', 'renamed')
    const { frontmatter, content } = await readFile('renamed.md')
    expect(frontmatter.title).toBe('Renamed')
    expect(content.trim()).toBe('body') // body preserved
  })

  it('preserves extension when new name omits it', async () => {
    const { createFile, renameItem, readFile } = await importFileOps()
    await createFile('b.excalidraw')
    const newPath = await renameItem('b.excalidraw', 'c')
    expect(newPath).toBe('c.excalidraw')
    const { content } = await readFile('c.excalidraw')
    expect(JSON.parse(content).type).toBe('excalidraw')
  })

  it('fails when the target name already exists', async () => {
    const { createFile, renameItem } = await importFileOps()
    await createFile('a.md', '')
    await createFile('b.md', '')
    await expect(renameItem('a.md', 'b')).rejects.toThrow(/already exists/)
  })

  it('fails when the source does not exist', async () => {
    const { renameItem } = await importFileOps()
    await expect(renameItem('ghost.md', 'new')).rejects.toThrow(/not found/i)
  })
})

describe('moveItem', () => {
  it('moves a file into a target folder', async () => {
    const { createFile, createFolder, moveItem, readFile } = await importFileOps()
    await createFolder('target')
    await createFile('note.md', '')
    const newPath = await moveItem('note.md', 'target')
    expect(newPath).toBe('target/note.md')
    const { frontmatter } = await readFile('target/note.md')
    expect(frontmatter.title).toBe('Note')
  })

  it('moves a file to the vault root when targetDir is empty', async () => {
    const { createFile, createFolder, moveItem, readFile } = await importFileOps()
    await createFolder('folder')
    await createFile('folder/note.md', '')
    const newPath = await moveItem('folder/note.md', '')
    expect(newPath).toBe('note.md')
    await expect(readFile('note.md')).resolves.toBeDefined()
  })

  it('throws when moving a folder into its own descendant', async () => {
    const { createFolder, moveItem } = await importFileOps()
    await createFolder('parent')
    await createFolder('parent/child')
    await expect(moveItem('parent', 'parent/child')).rejects.toThrow(/descendant/)
  })

  it('throws when moving a folder into itself', async () => {
    const { createFolder, moveItem } = await importFileOps()
    await createFolder('folder')
    await expect(moveItem('folder', 'folder')).rejects.toThrow(/itself/)
  })

  it('throws when source does not exist', async () => {
    const { createFolder, moveItem } = await importFileOps()
    await createFolder('target')
    await expect(moveItem('ghost.md', 'target')).rejects.toThrow(/not found/i)
  })
})

describe('editFile', () => {
  it('replaces a unique text match', async () => {
    const { createFile, editFile, readFile } = await importFileOps()
    await createFile('note.md', 'Hello world')
    const result = await editFile('note.md', 'world', 'there')
    expect(result.replacements).toBe(1)
    const { content } = await readFile('note.md')
    expect(content.trim()).toBe('Hello there')
  })

  it('throws when oldText is not found', async () => {
    const { createFile, editFile } = await importFileOps()
    await createFile('note.md', 'Hello world')
    await expect(editFile('note.md', 'missing', 'x')).rejects.toThrow(/not found/)
  })

  it('throws when oldText appears more than once (ambiguous)', async () => {
    const { createFile, editFile } = await importFileOps()
    await createFile('note.md', 'dup dup')
    await expect(editFile('note.md', 'dup', 'x')).rejects.toThrow(/appears 2 times/)
  })
})

describe('listFiles', () => {
  it('flattens the tree into a list of files and folders', async () => {
    const { createFile, createFolder, listFiles } = await importFileOps()
    await createFolder('folder')
    await createFile('folder/inner.md', '')
    await createFile('root.md', '')

    const list = await listFiles()
    const paths = list.map((n) => n.path).sort()
    expect(paths).toEqual(['folder', 'folder/inner.md', 'root.md'])
  })
})
