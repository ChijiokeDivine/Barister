import Link from "next/link";
import { LuExternalLink } from "react-icons/lu";
import { SettingsForm } from "@/components/dashboard/settings/SettingsForm";
import { Badge } from "@/components/dashboard/ui/Badge";
import { Panel } from "@/components/dashboard/ui/Panel";
import { getSettingsPage } from "@/lib/server/queries";

export const instant = false;

function statusTone(ok: boolean) {
  return ok ? ("success" as const) : ("warn" as const);
}

export default async function SettingsPage() {
  const { settings, system } = await getSettingsPage();
  const chain = system.chain;
  const chainAddress = "address" in chain ? chain.address : undefined;
  const explorer = "explorer" in chain ? chain.explorer : undefined;
  const balance = "balanceWei" in chain && chain.balanceWei ? Number(BigInt(chain.balanceWei) / 10n ** 14n) / 10000 : null;

  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 py-6 sm:px-6 lg:px-10 lg:py-7">
      <div>
        <h1 className="font-serif text-[26px] leading-tight text-fg">Settings</h1>
        <p className="mt-1 max-w-2xl text-[13px] leading-5 text-fg-muted">
          Firm-wide redaction rules and negotiation positions. Secrets stay in the environment; this page only reports whether each integration is configured.
        </p>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <SettingsForm initial={settings} />

        <aside className="space-y-4">
          <Panel title="System status" description="Configuration is read from the server environment.">
            <ul className="space-y-2.5 text-[12.5px]">
              <li className="flex items-center justify-between gap-3">
                <span className="text-fg-muted">API authentication</span>
                <Badge tone={statusTone(system.auth)}>{system.auth ? "Configured" : "Missing key"}</Badge>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span className="text-fg-muted">Vault encryption</span>
                <Badge tone={statusTone(system.encryption)}>{system.encryption ? "Configured" : "Missing key"}</Badge>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span className="text-fg-muted">Storage</span>
                <Badge tone={statusTone(system.storage.ok)}>{system.storage.ok ? system.storage.driver : "Unavailable"}</Badge>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span className="text-fg-muted">Gemini</span>
                <Badge tone={statusTone(system.llm.gemini.configured)}>{system.llm.gemini.configured ? system.llm.gemini.model : "Not configured"}</Badge>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span className="text-fg-muted">Groq</span>
                <Badge tone={statusTone(system.llm.groq.configured)}>{system.llm.groq.configured ? system.llm.groq.model : "Not configured"}</Badge>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span className="text-fg-muted">Anchor relayer</span>
                <Badge tone={statusTone(chain.configured)}>{chain.configured ? `Chain ${"chainId" in chain ? chain.chainId : "—"}` : "Not configured"}</Badge>
              </li>
            </ul>
            {system.storage.error && <p className="mt-3 text-[11.5px] leading-5 text-red-700">{system.storage.error}</p>}
            {"error" in chain && chain.error && <p className="mt-1 text-[11.5px] leading-5 text-red-700">RPC error: {chain.error}</p>}
            {chainAddress && (
              <div className="mt-3 border-t border-line pt-3 text-[11.5px] leading-5 text-fg-muted">
                <p className="break-all">
                  Relayer {chainAddress.slice(0, 10)}…{chainAddress.slice(-8)}
                  {balance !== null ? ` · ${balance} ETH` : ""}
                </p>
                {explorer && (
                  <Link href={explorer} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-accent hover:underline">
                    View on explorer <LuExternalLink aria-hidden className="size-3" />
                  </Link>
                )}
              </div>
            )}
          </Panel>

          <Panel title="Upload limits">
            <dl className="space-y-2 text-[12.5px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-fg-muted">Standard upload</dt>
                <dd className="font-medium text-fg">{system.limits.maxUploadMb} MB</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-fg-muted">Large upload</dt>
                <dd className="font-medium text-fg">{system.limits.maxLargeUploadMb} MB</dd>
              </div>
            </dl>
          </Panel>

          <Panel title="Good to know">
            <ul className="space-y-2 text-[12px] leading-5 text-fg-muted">
              <li>Redaction changes apply to new uploads. Use “Re-apply redaction” on a document to update existing files.</li>
              <li>The playbook is sealed at rest and is only sent to the model after the document has been redacted.</li>
              <li>Allow-listed terms are never replaced, even if another detector matches them.</li>
            </ul>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
