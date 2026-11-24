import { useParams } from 'react-router-dom'
import { findLandingBySlug } from '../seo/seoContent'
import { renderNotFoundBody, renderSeoPageBody } from '../seo/seoRender'
import SeoMarkup from '../seo/SeoMarkup'

/** WEB /discover/:slug — public SEO landing (same markup as the prerendered HTML). */
export default function SeoLandingPage() {
  const { slug = '' } = useParams()
  const page = findLandingBySlug(slug)
  return <SeoMarkup html={page ? renderSeoPageBody(page) : renderNotFoundBody()} />
}