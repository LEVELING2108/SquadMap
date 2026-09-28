import type { Metadata, Viewport } from 'next';
import './globals.css';
import { PwaInstallPrompt } from '../components/PwaInstallPrompt';

export const metadata: Metadata = {
  title: 'SquadMap — Real-time Squad Location, Driving ETAs & Walkie-Talkie',
  description:
    'Coordinate road trips with live vector maps, OSRM driving ETAs, WebRTC voice walkie-talkie, and instant room sharing with zero account required.',
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/favicon.svg',
    shortcut: '/icons/favicon-96x96.png',
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SquadMap',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#090d16',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#090d16] text-gray-100 min-h-screen selection:bg-indigo-500 selection:text-white">
        {children}
        <PwaInstallPrompt />
      </body>
    </html>
  );
}
