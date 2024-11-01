import { Metadata } from 'next';
import iconLogo from '@/components/icons/logo.png';

export const metadata: Metadata = {
    title: 'Seahorse | Mental Wellness Platform',
    description: 'A decentralized platform combining AI technology with real-world community building to support mental wellness.',
    icons: {
        icon: iconLogo.src
    },
};

import ClientLayout from '@/layouts/client';

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return <ClientLayout>{children}</ClientLayout>;
}