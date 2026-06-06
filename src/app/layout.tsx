import type {Metadata} from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'JSON Video Editor',
  description: 'Local JSON-driven video preview and editing workspace.',
};

export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
