interface StructuredDataProps {
  type: 'organization' | 'website' | 'breadcrumb' | 'faq'
  data: Record<string, any>
}

export function StructuredData({ type, data }: StructuredDataProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}

export function OrganizationStructuredData() {
  const organizationData: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Weeb-X',
    alternateName: ['Weebx', 'weeb x', 'WeebX', 'weeb-x'],
    url: 'https://weeb-x.com',
    logo: 'https://weeb-x.com/icon.svg',
    description: 'Аниме-стриминговая платформа с гача-крутками и PvP-ареной',
    sameAs: [
      'https://t.me/evangelion_chat',
    ],
  }

  return <StructuredData type="organization" data={organizationData} />
}

export function WebSiteStructuredData() {
  const websiteData: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Weeb-X',
    alternateName: ['Weebx', 'weeb x', 'WeebX', 'weeb-x'],
    url: 'https://weeb-x.com',
    description: 'Аниме-стриминговая платформа с гача-крутками и PvP-ареной',
    potentialAction: {
      '@type': 'SearchAction',
      target: 'https://weeb-x.com/catalog?search={search_term_string}',
      'query-input': 'required name=search_term_string',
    },
  }

  return <StructuredData type="website" data={websiteData} />
}

interface BreadcrumbItem {
  name: string
  url: string
}

export function BreadcrumbStructuredData({ items }: { items: BreadcrumbItem[] }) {
  const breadcrumbData: Record<string, any> = {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }

  return <StructuredData type="breadcrumb" data={breadcrumbData} />
}

interface FAQItem {
  question: string
  answer: string
}

export function FAQStructuredData({ items }: { items: FAQItem[] }) {
  const faqData: Record<string, any> = {
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }

  return <StructuredData type="faq" data={faqData} />
}
