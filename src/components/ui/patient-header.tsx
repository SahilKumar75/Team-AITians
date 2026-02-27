"use client";

import { Button } from "@/components/ui/button";
import {
    NavigationMenu,
    NavigationMenuContent,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
    NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { ProfileDropdown } from "@/components/ui/profile-dropdown";
import { Menu, MoveRight, X, Activity, User, LogOut, LayoutDashboard, Sun, Moon } from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuthSession, useAuth } from "@/contexts/AuthContext";
import { disconnectWallet, formatAddress } from "@/lib/web3";
import { useRouter } from "next/navigation";

interface PatientHeaderProps {
    connection?: { account: string } | null;
}

function PatientHeader({ connection }: PatientHeaderProps) {
    const { data: session } = useAuthSession();
    const router = useRouter();
    const [isOpen, setOpen] = useState(false);
    const [theme, setTheme] = useState<"light" | "dark">("light");

    // Initialize theme from localStorage or system preference
    useEffect(() => {
        const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
        const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        const initialTheme = savedTheme || systemTheme;
        setTheme(initialTheme);
        document.documentElement.classList.toggle("dark", initialTheme === "dark");
    }, []);

    const toggleTheme = () => {
        const newTheme = theme === "light" ? "dark" : "light";
        setTheme(newTheme);
        localStorage.setItem("theme", newTheme);
        document.documentElement.classList.toggle("dark", newTheme === "dark");
    };

    const navigationItems = [
        {
            title: "Home",
            href: "/patient-home",
        },
        {
            title: "Features",
            description: "Access your health records and emergency tools",
            items: [
                {
                    title: "Medical Records",
                    href: "/patient/records",
                    description: "View your complete medical history"
                },
                {
                    title: "Emergency QR",
                    href: "/patient/emergency",
                    description: "Generate life-saving QR code"
                },
                {
                    title: "Doctor Access",
                    href: "/patient/access",
                    description: "Manage doctor permissions"
                },
            ],
        },
    ];

    const { logout } = useAuth();
    const handleLogout = async () => {
        await disconnectWallet();
        logout();
        router.push("/");
    };

    return (
        <header className="w-full z-40 fixed top-0 left-0 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
            <div className="container relative mx-auto min-h-16 flex gap-4 items-center justify-between px-6">
                {/* Left: Logo */}
                <Link href="/" className="flex items-center gap-2 shrink-0">
                    <Activity className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    <span className="font-bold text-xl text-neutral-900 dark:text-neutral-100">Swasthya Sanchar</span>
                </Link>

                {/* Center: Navigation (Desktop) */}
                <div className="justify-center items-center gap-4 lg:flex hidden flex-row">
                    <NavigationMenu className="flex justify-start items-start">
                        <NavigationMenuList className="flex justify-start gap-4 flex-row">
                            {navigationItems.map((item) => (
                                <NavigationMenuItem key={item.title}>
                                    {item.href ? (
                                        <NavigationMenuLink asChild>
                                            <Link href={item.href}>
                                                <Button variant="ghost" className="text-sm">
                                                    {item.title}
                                                </Button>
                                            </Link>
                                        </NavigationMenuLink>
                                    ) : (
                                        <>
                                            <NavigationMenuTrigger className="font-medium text-sm">
                                                {item.title}
                                            </NavigationMenuTrigger>
                                            <NavigationMenuContent className="!w-[400px] p-4">
                                                <div className="flex flex-col gap-2">
                                                    <div className="mb-2">
                                                        <p className="text-sm font-medium">{item.title}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {item.description}
                                                        </p>
                                                    </div>
                                                    <div className="flex flex-col gap-1">
                                                        {item.items?.map((subItem) => (
                                                            <NavigationMenuLink
                                                                key={subItem.title}
                                                                asChild
                                                            >
                                                                <Link
                                                                    href={subItem.href}
                                                                    className="flex flex-col hover:bg-accent p-3 rounded-md transition-colors"
                                                                >
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-sm font-medium">{subItem.title}</span>
                                                                        <MoveRight className="w-4 h-4 text-muted-foreground" />
                                                                    </div>
                                                                    <span className="text-xs text-muted-foreground">{subItem.description}</span>
                                                                </Link>
                                                            </NavigationMenuLink>
                                                        ))}
                                                    </div>
                                                </div>
                                            </NavigationMenuContent>
                                        </>
                                    )}
                                </NavigationMenuItem>
                            ))}
                        </NavigationMenuList>
                    </NavigationMenu>
                </div>

                {/* Right: Wallet + Profile Dropdown */}
                <div className="flex justify-end gap-3 items-center">
                    {connection && (
                        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
                            <span className="text-xs text-neutral-600 dark:text-neutral-400">Wallet:</span>
                            <span className="font-mono text-xs text-neutral-900 dark:text-neutral-100">{formatAddress(connection.account)}</span>
                        </div>
                    )}
                    {session?.user && (
                        <ProfileDropdown
                            user={{
                                name: session.user.email?.split('@')[0],
                                email: session.user.email,
                                image: null
                            }}
                            theme={theme}
                            onThemeToggle={toggleTheme}
                        />
                    )}
                </div>

                {/* Mobile Menu */}
                <div className="flex w-12 shrink lg:hidden items-end justify-end">
                    <Button variant="ghost" size="icon" onClick={() => setOpen(!isOpen)}>
                        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </Button>
                    {isOpen && (
                        <div className="absolute top-16 left-0 flex flex-col w-full bg-background shadow-lg border-t py-4 px-6 gap-6">
                            {navigationItems.map((item) => (
                                <div key={item.title} className="flex flex-col gap-3">
                                    {item.href ? (
                                        <Link
                                            href={item.href}
                                            className="flex justify-between items-center"
                                            onClick={() => setOpen(false)}
                                        >
                                            <span className="text-base font-medium">{item.title}</span>
                                            <MoveRight className="w-4 h-4 text-muted-foreground" />
                                        </Link>
                                    ) : (
                                        <>
                                            <p className="text-base font-medium">{item.title}</p>
                                            {item.items?.map((subItem) => (
                                                <Link
                                                    key={subItem.title}
                                                    href={subItem.href}
                                                    className="flex justify-between items-center pl-4 py-2"
                                                    onClick={() => setOpen(false)}
                                                >
                                                    <div className="flex flex-col">
                                                        <span className="text-sm">{subItem.title}</span>
                                                        <span className="text-xs text-muted-foreground">{subItem.description}</span>
                                                    </div>
                                                    <MoveRight className="w-4 h-4" />
                                                </Link>
                                            ))}
                                        </>
                                    )}
                                </div>
                            ))}
                            {connection && (
                                <div className="flex flex-col gap-2 pt-4 border-t">
                                    <span className="text-xs text-muted-foreground">Connected Wallet</span>
                                    <span className="font-mono text-sm">{formatAddress(connection.account)}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}

export { PatientHeader };
