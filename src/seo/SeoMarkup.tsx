import { useCallback, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { SEO_PAGE_CSS } from './seoPageCss'

/** Renders the same markup as the prerendered HTML; same-origin links stay inside the SPA. */
export default function SeoMarkup({ html }: { html: string }) {
  const navigate = useNavigate()
  const onClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = (event.target as Element | null)?.closest?.('a')
      const href = anchor?.getAttribute('href')
      // /legal/documents/* is rendered by the server, not by React Router.
      if (!href || !href.startsWith('/') || href.startsWith('//') || href.startsWith('/legal/')) return
      event.preventDefault()
      navigate(href)
    },
    [navigate],
  )
  return (
    <>
      <style data-gnh-seo="css-runtime">{SEO_PAGE_CSS}</style>
      <div className="gnh-seo-host" onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />
    </>
  )
}