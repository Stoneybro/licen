
"use client"
import { type ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PrivyProvider } from "@privy-io/react-auth";
import { privyConfig } from "@/lib/privyConfig";
import { Toaster } from "sonner";



interface ProviderProps {
    children: ReactNode;
}


export function Provider({ children }: ProviderProps) {

    return (
        <>
            <PrivyProvider
                appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
                config={privyConfig}
            >
                <TooltipProvider>
                    <Toaster position='top-center' />
                    {children}
                </TooltipProvider>
            </PrivyProvider>
        </>
    );
}
