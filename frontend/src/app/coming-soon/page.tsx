'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { PiArrowLeft } from "react-icons/pi";
import logoIcon from '@/components/icons/logo.png';

export default function ComingSoonPage() {
    return (
        <div className="min-h-screen bg-[#071b16] flex flex-col items-center justify-center relative px-4">
            <div className="absolute inset-0 z-0">
                <div className="absolute bottom-0 left-0 right-0 top-0 bg-[linear-gradient(to_right,#22886c1a_1px,transparent_1px),linear-gradient(to_bottom,#22886c1a_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]" />
            </div>
            
            <div className="relative z-10 text-center max-w-2xl">
                <Image
                    src={logoIcon}
                    alt="Logo"
                    width={80}
                    height={80}
                    className="mx-auto mb-8 transition-transform duration-300 hover:scale-105"
                />
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
                    Coming Soon
                </h1>
                <p className="text-xl text-gray-300 mb-8">
                    We're working hard to bring you a revolutionary mental wellness platform. 
                    Stay tuned for updates!
                </p>
                <Link 
                    href="/"
                    className="inline-flex items-center px-6 py-3 bg-[#22886c] text-white rounded-lg hover:bg-[#1b6d56] transition-all duration-300 hover:scale-105"
                >
                    <PiArrowLeft className="mr-2" size={20} />
                    Back to Home
                </Link>
            </div>
        </div>
    );
};