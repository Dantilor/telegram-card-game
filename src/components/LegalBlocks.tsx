import type { ReactNode } from 'react'
import type { LegalBlock } from '../legal/types'

function linkify(text: string): ReactNode[] {
  const parts = text.split(/(https?:\/\/[^\s<>"']+)/g)
  return parts.map((part, index) => {
    if (!/^https?:\/\//.test(part)) return part
    return (
      <a key={`${index}-${part.slice(0, 24)}`} href={part} target="_blank" rel="noopener noreferrer">
        {part}
      </a>
    )
  })
}

function headingTag(level: number): 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' {
  if (level <= 1) return 'h1'
  if (level === 2) return 'h2'
  if (level === 3) return 'h3'
  if (level === 4) return 'h4'
  if (level === 5) return 'h5'
  return 'h6'
}

export function LegalBlocks({ blocks, fallbackText }: { blocks: LegalBlock[]; fallbackText?: string }) {
  if (blocks.length === 0) {
    if (!fallbackText?.trim()) return null
    return <pre className="legal-doc__pre">{fallbackText}</pre>
  }
  return (
    <>
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          const Tag = headingTag(block.level)
          return (
            <Tag key={index} className={`legal-doc__h legal-doc__h--${block.level}`}>
              {block.text}
            </Tag>
          )
        }
        if (block.type === 'paragraph') {
          return (
            <p key={index} className="legal-doc__p">
              {linkify(block.text)}
            </p>
          )
        }
        if (block.type !== 'table' || !Array.isArray(block.rows)) return null
        return (
          <div key={index} className="legal-doc__table-wrap">
            <table className="legal-doc__table">
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => {
                      const Cell = rowIndex === 0 ? 'th' : 'td'
                      return <Cell key={cellIndex}>{cell}</Cell>
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </>
  )
}
