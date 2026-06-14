import { describe, it, expect } from 'vitest'

import {
  parseFrontmatter,
  stringifyFrontmatter,
  generateDefaultFrontmatter,
  isEmptyFrontmatter,
  slugToTitle,
  titleToSlug,
} from '@/lib/frontmatter'

describe('parseFrontmatter', () => {
  it('parses a document with frontmatter', () => {
    const raw = `---
title: Hello
category: notes
---
# Body`
    const { frontmatter, content } = parseFrontmatter(raw)
    expect(frontmatter.title).toBe('Hello')
    expect(frontmatter.category).toBe('notes')
    expect(content.trim()).toBe('# Body')
  })

  it('parses bare YAML date as a Date object (gray-matter YAML auto-typing)', () => {
    // YAML spec: bare dates are auto-typed. This documents the real behavior
    // so callers know frontmatter.date may be a Date, not a string.
    const raw = `---
date: 2024-01-01
---
body`
    const { frontmatter } = parseFrontmatter(raw)
    expect(frontmatter.date).toBeInstanceOf(Date)
  })

  it('returns empty frontmatter for plain markdown', () => {
    const raw = '# Just a title'
    const { frontmatter, content } = parseFrontmatter(raw)
    expect(frontmatter).toEqual({})
    expect(content).toBe('# Just a title')
  })

  it('parses tags array', () => {
    const raw = `---
title: T
tags:
  - a
  - b
---
body`
    const { frontmatter } = parseFrontmatter(raw)
    expect(frontmatter.tags).toEqual(['a', 'b'])
  })

  it('preserves unknown custom fields via index signature', () => {
    const raw = `---
custom: value
---
body`
    const { frontmatter } = parseFrontmatter(raw)
    expect((frontmatter as Record<string, unknown>).custom).toBe('value')
  })

  it('falls back to plain content on malformed YAML', () => {
    // Unclosed frontmatter fence → gray-matter treats as plain text
    const raw = `---
title: broken
this: : : invalid`
    const { frontmatter, content } = parseFrontmatter(raw)
    // Should not throw; returns something parseable
    expect(typeof content).toBe('string')
    expect(frontmatter).toBeDefined()
  })
})

describe('stringifyFrontmatter', () => {
  it('serializes frontmatter + body', () => {
    const out = stringifyFrontmatter({ title: 'Hi', date: '2024-01-01' }, 'body')
    expect(out).toContain('title: Hi')
    expect(out).toContain('---')
    expect(out).toContain('body')
  })

  it('returns body as-is when frontmatter is empty', () => {
    const out = stringifyFrontmatter({}, '# Title')
    expect(out).toBe('# Title')
    expect(out).not.toContain('---')
  })

  it('round-trips through parseFrontmatter', () => {
    const fm = { title: 'Round', date: '2024-05-05', tags: ['x', 'y'] }
    const body = 'Some **markdown** content'
    const serialized = stringifyFrontmatter(fm, body)
    const { frontmatter, content } = parseFrontmatter(serialized)
    expect(frontmatter).toEqual(fm)
    // gray-matter appends a trailing newline to the body during stringify
    expect(content.trim()).toBe(body)
  })
})

describe('isEmptyFrontmatter', () => {
  it('returns true for empty object', () => {
    expect(isEmptyFrontmatter({})).toBe(true)
  })

  it('returns false when fields exist', () => {
    expect(isEmptyFrontmatter({ title: 'a' })).toBe(false)
  })
})

describe('generateDefaultFrontmatter', () => {
  it('derives title from filename and uses today date', () => {
    const today = new Date().toISOString().slice(0, 10)
    const fm = generateDefaultFrontmatter('notes/my-new-post.md')
    expect(fm.title).toBe('My New Post')
    expect(fm.date).toBe(today)
  })

  it('handles nested paths', () => {
    const fm = generateDefaultFrontmatter('deep/nested/folder/file_name.md')
    expect(fm.title).toBe('File Name')
  })

  it('handles bare filename', () => {
    const fm = generateDefaultFrontmatter('untitled.md')
    expect(fm.title).toBe('Untitled')
  })
})

describe('slugToTitle', () => {
  it('converts hyphenated slug to Title Case', () => {
    expect(slugToTitle('my-new-post')).toBe('My New Post')
  })

  it('converts underscores to spaces', () => {
    expect(slugToTitle('my_post')).toBe('My Post')
  })

  it('handles mixed separators', () => {
    expect(slugToTitle('my-new_post')).toBe('My New Post')
  })
})

describe('titleToSlug', () => {
  it('lowercases and hyphenates spaces', () => {
    expect(titleToSlug('My New Post')).toBe('my-new-post')
  })

  it('converts underscores to hyphens', () => {
    expect(titleToSlug('My_Post')).toBe('my-post')
  })

  it('collapses multiple consecutive separators', () => {
    expect(titleToSlug('A   B')).toBe('a-b')
  })

  it('trims leading/trailing hyphens', () => {
    expect(titleToSlug('  Hello  ')).toBe('hello')
  })

  it('strips special characters', () => {
    expect(titleToSlug('Hello! World?')).toBe('hello-world')
  })

  it('preserves CJK characters', () => {
    expect(titleToSlug('你好 World')).toBe('你好-world')
  })

  it('preserves digits', () => {
    expect(titleToSlug('Post 42')).toBe('post-42')
  })

  it('is roughly inverse to slugToTitle (lossy)', () => {
    const slug = 'my-new-post'
    const title = slugToTitle(slug)
    expect(titleToSlug(title)).toBe(slug)
  })
})
