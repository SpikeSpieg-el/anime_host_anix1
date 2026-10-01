import sanitizeHtml from "sanitize-html"

const ALLOWED_TAGS = [
  "a", "abbr", "b", "blockquote", "br", "caption", "code", "dd", "del", "div", "dl", "dt",
  "em", "figcaption", "figure", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "i", "img", "li",
  "ol", "p", "pre", "s", "small", "source", "span", "strong", "sub", "sup", "table", "tbody",
  "td", "th", "thead", "tr", "u", "ul", "video",
]

/** Sanitize news HTML (including admin-authored content) before rendering it as markup. */
export function sanitizeNewsHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      "*": ["class"],
      a: ["href", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "loading"],
      source: ["src", "type"],
      video: ["controls", "preload", "poster", "width", "height"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan", "scope"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }, true),
    },
  })
}
