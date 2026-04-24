import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AppTopbar } from "@/components/app/app-topbar";
import { HashChip } from "@/components/app/hash-chip";
import { MOCK_WALLET } from "@/lib/mock";

export default function SettingsPage() {
  return (
    <div className="flex flex-col min-h-full">
      <AppTopbar title="Settings" />
      <div className="flex-1 p-6 flex flex-col gap-4 max-w-2xl">
        {/* Wallet */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Wallet</CardTitle>
            <CardDescription className="text-xs">Connected via Privy</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Address</span>
              <HashChip hash={MOCK_WALLET.address} front={10} back={8} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">lUSD balance</span>
              <span className="font-mono font-medium">{MOCK_WALLET.lUsdBalance} lUSD</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Locked in escrow</span>
              <span className="font-mono">{MOCK_WALLET.escrowLocked} lUSD</span>
            </div>
          </CardContent>
        </Card>

        {/* Network */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Network</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Chain</span>
              <span className="font-mono font-medium">0G Testnet</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Indexer</span>
              <span className="font-medium">Envio HyperIndex</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Compute</span>
              <span className="font-medium">0G Compute (fine-tune path)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Storage</span>
              <span className="font-medium">0G Storage</span>
            </div>
          </CardContent>
        </Card>

        {/* Token */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Royalty Token</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Token</span>
              <Badge variant="outline" className="font-mono text-xs">lUSD</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Standard</span>
              <span className="font-mono">ERC-20</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Funding</span>
              <span>Auto-drip on login</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
