import { describe, it, expect } from 'vitest'

import { resolveImagePaths, relativizeImagePaths } from '@/lib/image-paths'

describe('resolveImagePaths', () => {
  it('converts a relative image path to an API URL using the file dir', () => {
    const md = '![alt](assets/img.png)'
    const out = resolveImagePaths(md, 'guides/intro.md')
    expect(out).toBe('![alt](/api/content-files?path=' + encodeURIComponent('guides/assets/img.png') + ')')
  })

  it('encodes special characters in the resolved path', () => {
    const md = '![alt](assets/my image.png)'
    const out = resolveImagePaths(md, 'guides/intro.md')
    expect(out).toContain(encodeURIComponent('guides/assets/my image.png'))
  })

  it('handles a file at the vault root (no dir prefix)', () => {
    const md = '![alt](assets/img.png)'
    const out = resolveImagePaths(md, 'note.md')
    expect(out).toBe('![alt](/api/content-files?path=' + encodeURIComponent('assets/img.png') + ')')
  })

  it('does not modify external http URLs', () => {
    const md = '![alt](https://example.com/img.png)'
    expect(resolveImagePaths(md, 'guides/intro.md')).toBe(md)
  })

  it('does not modify external https URLs', () => {
    const md = '![alt](http://example.com/img.png)'
    expect(resolveImagePaths(md, 'guides/intro.md')).toBe(md)
  })

  it('does not modify absolute paths starting with /', () => {
    const md = '![alt](/static/img.png)'
    expect(resolveImagePaths(md, 'guides/intro.md')).toBe(md)
  })

  it('does not modify already-resolved /api/ paths', () => {
    const md = '![alt](/api/content-files?path=guides/assets/img.png)'
    expect(resolveImagePaths(md, 'guides/intro.md')).toBe(md)
  })

  it('handles multiple images in one document', () => {
    const md = '![a](assets/1.png)\n\n![b](assets/2.png)'
    const out = resolveImagePaths(md, 'guides/intro.md')
    // Paths are URL-encoded, so '/' becomes '%2F'
    expect(out).toContain(encodeURIComponent('guides/assets/1.png'))
    expect(out).toContain(encodeURIComponent('guides/assets/2.png'))
  })

  it('leaves text without images untouched', () => {
    const md = 'Just some text and [a link](page.md).'
    expect(resolveImagePaths(md, 'guides/intro.md')).toBe(md)
  })
})

describe('relativizeImagePaths', () => {
  it('converts an API URL back to a relative path', () => {
    const apiPath = '/api/content-files?path=' + encodeURIComponent('guides/assets/img.png')
    const md = `![alt](${apiPath})`
    const out = relativizeImagePaths(md, 'guides/intro.md')
    expect(out).toBe('![alt](assets/img.png)')
  })

  it('decodes URL-encoded characters', () => {
    const apiPath = '/api/content-files?path=' + encodeURIComponent('guides/assets/my image.png')
    const md = `![alt](${apiPath})`
    const out = relativizeImagePaths(md, 'guides/intro.md')
    expect(out).toBe('![alt](assets/my image.png)')
  })

  it('handles file at root (keeps full relative path when no dir match)', () => {
    const apiPath = '/api/content-files?path=' + encodeURIComponent('assets/img.png')
    const md = `![alt](${apiPath})`
    // File at root: dir is '', so it falls through to keeping src as-is
    const out = relativizeImagePaths(md, 'note.md')
    expect(out).toBe('![alt](assets/img.png)')
  })

  it('is the inverse of resolveImagePaths', () => {
    const original = '![alt](assets/img.png)'
    const filePath = 'guides/intro.md'
    const resolved = resolveImagePaths(original, filePath)
    const back = relativizeImagePaths(resolved, filePath)
    expect(back).toBe(original)
  })

  it('leaves plain markdown untouched', () => {
    const md = '![alt](assets/img.png)'
    // No /api/ paths present → no-op
    expect(relativizeImagePaths(md, 'guides/intro.md')).toBe(md)
  })
})
