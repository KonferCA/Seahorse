'use client';
import { useContext, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { NearContext } from '@wallets';

import { ReactNode } from 'react';

export default function AuthGate({ children }: { children: ReactNode }) {
  const { signedAccountId } = useContext(NearContext);
  const router = useRouter();

  useEffect(() => {
    if (!signedAccountId) {
      router.push('/login');
    }
  }, [signedAccountId, router]);

  if (!signedAccountId) {
    return null;
  }

  return <>{children}</>;
}
