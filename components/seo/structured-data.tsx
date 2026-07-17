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
    name: 'Weebx',
    alternateName: ['Weeb-X', 'weeb x', 'WeebX', 'weeb-x', 'weeb-x.com', 'weebx.com', 'Weeb X', 'WEEB-X', 'Weeb.X'],
    url: 'https://weeb-x.com',
    logo: 'https://weeb-x.com/icon.svg',
    description: 'Аниме-стриминговая платформа с гача-крутками и PvP-ареной',
    email: 'support@weeb-x.com',
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: 'support@weeb-x.com',
        availableLanguage: ['Russian'],
      },
      {
        '@type': 'ContactPoint',
        contactType: 'legal',
        email: 'dmca@weeb-x.com',
        availableLanguage: ['Russian', 'English'],
      },
    ],
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
    name: 'Weebx',
    alternateName: ['Weeb-X', 'weeb x', 'WeebX', 'weeb-x', 'weeb-x.com', 'weebx.com', 'Weeb X', 'WEEB-X', 'Weeb.X'],
    url: 'https://weeb-x.com',
    description: 'Аниме-стриминговая платформа с гача-крутками и PvP-ареной',
    inLanguage: 'ru-RU',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://weeb-x.com/catalog?search={search_term_string}',
      },
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
    '@context': 'https://schema.org',
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
    '@context': 'https://schema.org',
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
