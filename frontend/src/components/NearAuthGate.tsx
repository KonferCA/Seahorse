import React, { useEffect, useState, useRef } from 'react';
import { Wallet } from '@wallets';
import { NetworkId } from '@/config';
import Image from 'next/image';
import logoIcon from '@/components/icons/logo.png';
import { Link as ScrollLink } from 'react-scroll';
import { 
    PiChatCircleText, 
    PiShieldStar, 
    PiHeartbeat, 
    PiClockCountdown,
    PiBrain,
    PiHandshake,
    PiShieldCheck,
    PiCaretDown,
    PiPlus,
    PiGithubLogo,
    PiPlayCircle,
} from "react-icons/pi";
import Link from 'next/link';

const ScrollNavLink: React.FC<{
    to: string;
    children: React.ReactNode;
    className?: string;
    activeClass?: string;
}> = ({ to, children, className, activeClass }) => {
    return (
        <ScrollLink
            to={to}
            spy={true}
            smooth={true}
            offset={-80}
            duration={500}
            className={className}
            activeClass={activeClass}
            href="#"
        >
            {children}
        </ScrollLink>
    );
};

const faqData = [
    {
        question: "How does seahorse help with mental wellness?",
        answer: "Seahorse combines AI-powered wellness recommendations with community connection. Our system analyzes your personal data (like calendar and emails) securely on your device to provide personalized guidance, while helping you connect with like-minded individuals for real-world accountability and support."
    },
    {
        question: "How is my personal data protected?",
        answer: "Your data is processed entirely on your device using our decentralized RAG system. Any stored data is encrypted and secured on the NEAR blockchain. Only you control access to your information, and you can securely share specific data (like calendar events) with chosen connections through our wallet-based key exchange system."
    },
    {
        question: "What kind of data can I share with the system?",
        answer: "Seahorse can process various types of personal data including Google Calendar entries, emails, documents, and voice notes. All processing happens on your device, and you maintain complete control over what data you share."
    },
    {
        question: "How does the community connection work?",
        answer: "Using NEAR Protocol's blockchain, you can safely connect with others who share similar wellness goals. Our secure routing system enables you to share specific calendar events or activities while maintaining privacy. This facilitates real-world meetups and accountability partnerships."
    },
    {
        question: "Do I get compensated for sharing my data?",
        answer: "Yes! Through NEAR smart contracts, you receive compensation in NEAR tokens based on the relevance and usage of your shared data. The system automatically calculates and distributes payments while maintaining your privacy."
    },
    {
        question: "What makes seahorse different from other mental health apps?",
        answer: "Seahorse uniquely combines on-device AI processing, blockchain security, and real-world community building. Unlike traditional apps, we prioritize your data privacy, offer fair compensation for data sharing, and focus on creating meaningful in-person connections for better accountability."
    }
];

interface NearAuthGateProps {
    children: React.ReactNode;
}

interface FAQItemProps {
    question: string;
    answer: string;
    isOpen: boolean;
    onClick: () => void;
}

const FAQItem: React.FC<FAQItemProps> = ({ question, answer, isOpen, onClick }) => {
    return (
        <div className="border-b border-[#22886c]/20">
            <button
                onClick={onClick}
                className="w-full py-4 flex items-center justify-between text-left hover:text-[#22886c] transition-colors"
            >
                <span className="text-lg font-medium text-white">{question}</span>
                <PiPlus
                    className={`text-[#22886c] transition-transform duration-300 ${
                        isOpen ? 'rotate-45' : ''
                    }`}
                    size={24}
                />
            </button>
            <div
                className={`overflow-hidden transition-all duration-300 ${
                    isOpen ? 'max-h-96 pb-4 opacity-100' : 'max-h-0 opacity-0'
                }`}
            >
                <p className="text-gray-300">{answer}</p>
            </div>
        </div>
    );
};

const FAQSection: React.FC = () => {
    const [openIndex, setOpenIndex] = useState<number | null>(null);
    const [wallet] = useState(new Wallet({ networkId: NetworkId }));

    const handleItemClick = (index: number) => {
        setOpenIndex(openIndex === index ? null : index);
    };

    return (
        <section id="faq" className="min-h-screen flex items-center py-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
                <div className="max-w-3xl mx-auto">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-white mb-4">
                            Frequently Asked Questions
                        </h2>
                    </div>

                    <div className="bg-[#0f2c24] rounded-xl p-6 lg:p-8">
                        {faqData.map((faq, index) => (
                            <FAQItem
                                key={index}
                                question={faq.question}
                                answer={faq.answer}
                                isOpen={openIndex === index}
                                onClick={() => handleItemClick(index)}
                            />
                        ))}
                    </div>

                    <div className="mt-12 text-center">
                        <Link 
                            href="/coming-soon"
                            className="px-6 py-3 bg-[#22886c] text-white rounded-lg hover:bg-[#1b6d56] transition-colors font-medium"
                        >
                            Get Started Now
                        </Link>
                    </div>
                </div>
            </div>
        </section>
    );
};

const VideoSection = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
  
    const videoUrl = "https://dl.dropboxusercontent.com/scl/fi/6khl8o2roeo2zi9n9dz87/Lesson-One-1080p60.mp4?rlkey=2mei1vv6tmdg3oaor8iihzibf";
  
    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.play().catch((error: any) => {
                console.log("Autoplay prevented:", error);
            });
        }
    }, []);
  
    return (
        <div className="relative w-full aspect-video mb-12 overflow-hidden rounded-xl bg-[#0f2c24]">
            <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                autoPlay
                muted
                loop
            >
                <source src={videoUrl} type="video/mp4" />
                Your browser does not support the video tag.
            </video>
        </div>
    );
};
  
const NearAuthGate: React.FC<NearAuthGateProps> = ({ children }) => {
    const [isSignedIn, setIsSignedIn] = useState(false);
    const [wallet] = useState(new Wallet({ networkId: NetworkId }));
    const [isLoading, setIsLoading] = useState(true);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const accountId = await wallet.startUp((account: any) => {
                    setIsSignedIn(!!account);
                });
                setIsSignedIn(!!accountId);
            } catch (err) {
                console.error('Failed to initialize wallet:', err);
                setIsSignedIn(false);
            } finally {
                setIsLoading(false);
            }
        };

        const handleScroll = () => {
            const offset = window.scrollY;
            setScrolled(offset > 20);
        };

        checkAuth();
        window.addEventListener('scroll', handleScroll);
        
        return () => {
            window.removeEventListener('scroll', handleScroll);
        };
    }, [wallet]);

    const headerLinks = [
        { name: 'Features', to: 'features' },
        { name: 'About', to: 'about' },
        { name: 'FAQ', to: 'faq' }
    ];

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#071b16]">
                <div className="text-center space-y-8">
                    <div className="space-y-3">
                        <h2 className="text-2xl font-bold text-white">
                            Loading...
                        </h2>
                        <div className="flex items-center justify-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-[#22886c] animate-[bounce_1s_infinite_100ms]" />
                            <div className="w-2 h-2 rounded-full bg-[#22886c] animate-[bounce_1s_infinite_200ms]" />
                            <div className="w-2 h-2 rounded-full bg-[#22886c] animate-[bounce_1s_infinite_300ms]" />
                        </div>
                    </div>
    
                    <div className="absolute inset-0 z-0">
                        <div className="absolute bottom-0 left-0 right-0 top-0 bg-[linear-gradient(to_right,#22886c1a_1px,transparent_1px),linear-gradient(to_bottom,#22886c1a_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]" />                    </div>
                </div>
            </div>
        );
    }

    if (isSignedIn) {
        return children;
    }

    return (
        <div className="min-h-screen bg-[#071b16]">
            <header 
                className={`fixed w-full top-0 z-50 transition-all duration-300 ${
                    scrolled 
                        ? 'bg-[#071b16]/70 backdrop-blur-md shadow-lg'
                        : 'bg-transparent'
                }`}
            >
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-20">
                        <div className="flex items-center space-x-8">
                            <div className="flex items-center">
                                <Image
                                    src={logoIcon}
                                    alt="Logo"
                                    width={50}
                                    height={50}
                                    className="transition-transform duration-300 hover:scale-105"
                                />
                                <span className="ml-2 text-xl font-bold text-white">seahorse.</span>
                            </div>
                            
                            <nav className="hidden md:flex space-x-8">
                                {headerLinks.map((link) => (
                                    <ScrollNavLink
                                        key={link.to}
                                        to={link.to}
                                        className="text-gray-300 hover:text-[#22886c] cursor-pointer transition-all duration-300 hover:scale-105 relative group"
                                        activeClass="!text-[#22886c]"
                                    >
                                        {link.name}
                                        <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#22886c] transition-all duration-300 group-hover:w-full" />
                                    </ScrollNavLink>
                                ))}
                            </nav>
                        </div>

                        <div className="flex items-center space-x-4">
                            <a
                                href="https://github.com/KonferCA/Seahorse"
                                target="_blank"
                                rel="noopener noreferrer"
                                className={` 
                                    hidden lg:inline-flex items-center px-4 py-2 text-sm font-medium rounded-md
                                    border-2 border-[#22886c] text-[#22886c]
                                    transition-all duration-300
                                    ${scrolled
                                        ? 'hover:bg-[#22886c]/10 backdrop-blur-md'
                                        : 'hover:bg-[#22886c]/10'
                                    }
                                    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#22886c]
                                    hover:scale-105
                                `}
                            >
                                <PiGithubLogo className="mr-2" size={18} />
                                Contribute
                            </a>

                            <Link
                                href="/coming-soon"
                                className={`
                                    inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white
                                    transition-all duration-300
                                    ${scrolled
                                        ? 'bg-[#22886c]/90 hover:bg-[#22886c] backdrop-blur-md'
                                        : 'bg-[#22886c] hover:bg-[#1b6d56]'
                                    }
                                    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#22886c]
                                    hover:scale-105
                                `}
                            >
                                Connect Wallet
                            </Link>
                        </div>
                    </div>
                </div>
            </header>

            <section className="relative min-h-screen flex items-center justify-center pt-20">
                <div className="absolute inset-0 z-0">
                    <div className="absolute bottom-0 left-0 right-0 top-0 bg-[linear-gradient(to_right,#22886c1a_1px,transparent_1px),linear-gradient(to_bottom,#22886c1a_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]" />                </div>

                <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
                    <div className="text-center">
                        <div className="max-w-3xl mx-auto">
                            <h1 className="text-5xl font-bold text-white mb-6 relative">
                                Connect, Grow, and Thrive Together
                                <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 w-24 h-1 bg-[#22886c] rounded-full opacity-50"></div>
                            </h1>
                            <p className="text-xl text-gray-300 mb-8">
                                Combat loneliness through AI-guided wellness and real-world connections. 
                                Our decentralized platform helps you build meaningful relationships while 
                                maintaining complete control of your personal data.
                            </p>
                            <div className="flex justify-center gap-4">
                                <Link 
                                    href="/coming-soon"
                                    className="px-8 py-4 bg-[#22886c] text-white rounded-lg hover:bg-[#1b6d56] transition-all duration-300 hover:scale-105"
                                >
                                    Join Our Community
                                </Link>
                                <ScrollNavLink
                                    to="features"
                                    className="px-8 py-4 border-2 border-[#22886c] text-[#22886c] rounded-lg hover:bg-[#0f2c24] transition-all duration-300 hover:scale-105 cursor-pointer"
                                >
                                    How It Works
                                </ScrollNavLink>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
                    <ScrollNavLink
                        to="features"
                        className="cursor-pointer"
                    >
                        <PiCaretDown size={24} className="text-[#22886c] hover:text-[#1b6d56] transition-colors" />
                    </ScrollNavLink>
                </div>

                <div className="absolute inset-0 z-0 bg-[#071b16]/50 pointer-events-none"></div>
            </section>

            <section id="features" className="min-h-screen flex items-center border-t border-[#22886c]/20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-20">
                    <div className="mb-24">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl font-bold text-white mb-4">
                                Core Features
                            </h2>
                            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
                                A comprehensive platform that combines AI technology, privacy, and community to support your mental wellness journey.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
                            <div className="bg-[#0f2c24] shadow rounded-lg p-8 text-center transform transition-all duration-300 hover:scale-105 hover:bg-[#0f2c24]/80">
                                <div className="flex justify-center mb-6">
                                    <div className="p-3 bg-[#22886c]/10 rounded-lg">
                                        <PiChatCircleText size={32} className="text-[#22886c]" />
                                    </div>
                                </div>
                                <h3 className="text-lg font-semibold text-white mb-3">AI Wellness Guide</h3>
                                <p className="text-gray-300">Personalized recommendations based on your lifestyle and goals using advanced on-device processing</p>
                            </div>

                            <div className="bg-[#0f2c24] shadow rounded-lg p-8 text-center transform transition-all duration-300 hover:scale-105 hover:bg-[#0f2c24]/80">
                                <div className="flex justify-center mb-6">
                                    <div className="p-3 bg-[#22886c]/10 rounded-lg">
                                        <PiShieldStar size={32} className="text-[#22886c]" />
                                    </div>
                                </div>
                                <h3 className="text-lg font-semibold text-white mb-3">On-Device Privacy</h3>
                                <p className="text-gray-300">Your data stays secure on your device, processed with cutting-edge encryption and security</p>
                            </div>

                            <div className="bg-[#0f2c24] shadow rounded-lg p-8 text-center transform transition-all duration-300 hover:scale-105 hover:bg-[#0f2c24]/80">
                                <div className="flex justify-center mb-6">
                                    <div className="p-3 bg-[#22886c]/10 rounded-lg">
                                        <PiHeartbeat size={32} className="text-[#22886c]" />
                                    </div>
                                </div>
                                <h3 className="text-lg font-semibold text-white mb-3">Real Connections</h3>
                                <p className="text-gray-300">Connect with like-minded individuals for accountability and mutual support in your journey</p>
                            </div>

                            <div className="bg-[#0f2c24] shadow rounded-lg p-8 text-center transform transition-all duration-300 hover:scale-105 hover:bg-[#0f2c24]/80">
                                <div className="flex justify-center mb-6">
                                    <div className="p-3 bg-[#22886c]/10 rounded-lg">
                                        <PiClockCountdown size={32} className="text-[#22886c]" />
                                    </div>
                                </div>
                                <h3 className="text-lg font-semibold text-white mb-3">Fair Rewards</h3>
                                <p className="text-gray-300">Earn NEAR tokens for contributing valuable data and supporting the community</p>
                            </div>
                        </div>
                    </div>

                    <div id="about" className="bg-[#0f2c24] rounded-xl p-8 lg:p-12">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl font-bold text-white mb-4">About Seahorse</h2>
                            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
                                A decentralized platform combining advanced AI technology with real-world community building to support mental wellness.
                            </p>
                        </div>

                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-12 text-left">
                            <div className="space-y-4 bg-[#071b16] p-6 rounded-lg transform transition-all duration-300 hover:scale-105">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-[#22886c]/10 rounded-lg">
                                        <PiBrain size={24} className="text-[#22886c]" />
                                    </div>
                                    <h3 className="text-xl font-semibold text-white">Decentralized RAG System</h3>
                                </div>
                                <p className="text-gray-300">
                                    Advanced on-device processing analyzes your data using all-MiniLM-L6-v2 embeddings, ensuring both privacy and intelligent recommendations.
                                </p>
                            </div>

                            <div className="space-y-4 bg-[#071b16] p-6 rounded-lg transform transition-all duration-300 hover:scale-105">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-[#22886c]/10 rounded-lg">
                                        <PiHandshake size={24} className="text-[#22886c]" />
                                    </div>
                                    <h3 className="text-xl font-semibold text-white">Community-Driven</h3>
                                </div>
                                <p className="text-gray-300">
                                    Connect with others sharing similar wellness goals, fostering real-world accountability and mutual growth through secure data sharing.
                                </p>
                            </div>

                            <div className="space-y-4 bg-[#071b16] p-6 rounded-lg transform transition-all duration-300 hover:scale-105">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-[#22886c]/10 rounded-lg">
                                        <PiShieldCheck size={24} className="text-[#22886c]" />
                                    </div>
                                    <h3 className="text-xl font-semibold text-white">Blockchain Security</h3>
                                </div>
                                <p className="text-gray-300">
                                    Built on NEAR Protocol, featuring encrypted storage and secure key exchange for shared calendars and events.
                                </p>
                            </div>
                        </div>

                        <div className="mt-12 p-8 bg-[#071b16] rounded-lg text-center mb-12">
                            <p className="text-white text-lg mb-6 font-light italic">
                                "Seahorse is designed to bridge the gap between digital wellness tools and real-world connections. 
                                We believe in the power of community support, enhanced by secure technology that respects your privacy."
                            </p>
                            <Link
                                href="/coming-soon"
                                className={`
                                    inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white
                                    transition-all duration-300
                                    ${scrolled
                                        ? 'bg-[#22886c]/90 hover:bg-[#22886c] backdrop-blur-md'
                                        : 'bg-[#22886c] hover:bg-[#1b6d56]'
                                    }
                                    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#22886c]
                                    hover:scale-105
                                `}
                            >
                                Join Seahorse
                            </Link>
                        </div>

                        <VideoSection />

                    </div>
                </div>
            </section>

            <FAQSection />

            <footer className="bg-[#071b16] border-t border-[#0f2c24] py-6">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center text-gray-400">
                        <p>&copy; 2024 Konfer. All rights reserved.</p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default NearAuthGate;