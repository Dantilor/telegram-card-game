import { renderNotFoundBody } from '../seo/seoRender'
import SeoMarkup from '../seo/SeoMarkup'

/** WEB catch-all route; the server answers these paths with HTTP 404. */
export default function NotFoundPage() {
  return <SeoMarkup html={renderNotFoundBody()} />
}