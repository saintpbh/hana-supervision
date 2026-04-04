import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'HANA Supervision',
    short_name: 'HANA 슈퍼비전',
    description: 'AI 기반 심리상담 슈퍼비전 보고서 자동 생성기',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#4f46e5',
    icons: [
      {
        src: '/icons/app-icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable'
      },
      {
        src: '/icons/app-icon.svg',
        sizes: '192x192',
        type: 'image/svg+xml'
      },
      {
        src: '/icons/app-icon.svg',
        sizes: '512x512',
        type: 'image/svg+xml'
      }
    ]
  };
}
