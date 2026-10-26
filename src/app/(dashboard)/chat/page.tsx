import { notFound } from "next/navigation";
import { MatterComposer } from "@/components/dashboard/chat/ChatComposer";
import { matters } from "@/components/dashboard/data/mock";
import { Greeting } from "@/components/dashboard/layout/Greeting";

/** Matter-scoped new chat. */
export default function ChatPage() {
  const matter = matters[1] ?? matters[0];
  if (!matter) notFound();
  return (
    <div className="relative flex min-h-full flex-1 flex-col items-center justify-center px-4 pb-14 sm:px-6 lg:pb-20">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_50%_45%,#e6eaea_0%,transparent_70%)]" />
      <div className="relative flex w-full flex-col items-center">
        <Greeting size="md">{`Let's work on ${matter.name}`}</Greeting>
        <MatterComposer
          matter={matter}
          spaceName="Project Titan — Acme Co"
          resources={{ count: 98, vaults: 4, queries: 13 }}
          className="mt-8 w-full max-w-[476px] lg:mt-10"
        />
      </div>
    </div>
  );
}
