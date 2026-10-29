"use client";

import type { ComponentPropsWithoutRef, JSX } from "react";
import type { Components, ExtraProps } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/cn";

/**
 * Assistant answers are GitHub-flavoured Markdown. Raw HTML is allowed through `rehype-raw` because models
 * legitimately emit `<br>` inside table cells, then immediately sanitised with the GitHub schema so an answer
 * can never inject a script/handler. Links open in a new tab only when they leave the app.
 */
const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    th: [...(defaultSchema.attributes?.th ?? []), "align"],
    td: [...(defaultSchema.attributes?.td ?? []), "align"],
  },
};

type Props<T extends keyof JSX.IntrinsicElements> = ComponentPropsWithoutRef<T> & ExtraProps;

/** react-markdown passes an AST `node` prop; keep it off the DOM. */
function attrs<T extends ExtraProps>(props: T) {
  const { node, ...rest } = props;
  void node;
  return rest;
}

const components: Components = {
  h1: (props: Props<"h1">) => <h1 className="mt-6 mb-2 font-serif text-[20px] leading-snug text-fg first:mt-0" {...attrs(props)} />,
  h2: (props: Props<"h2">) => <h2 className="mt-5 mb-2 text-[15.5px] font-semibold leading-snug text-fg first:mt-0" {...attrs(props)} />,
  h3: (props: Props<"h3">) => <h3 className="mt-4 mb-1.5 text-[14px] font-semibold text-fg first:mt-0" {...attrs(props)} />,
  h4: (props: Props<"h4">) => <h4 className="mt-3 mb-1 text-[13.5px] font-semibold text-fg first:mt-0" {...attrs(props)} />,
  p: (props: Props<"p">) => <p className="my-2.5 first:mt-0 last:mb-0" {...attrs(props)} />,
  ul: (props: Props<"ul">) => <ul className="my-2.5 list-disc space-y-1 pl-5" {...attrs(props)} />,
  ol: (props: Props<"ol">) => <ol className="my-2.5 list-decimal space-y-1 pl-5" {...attrs(props)} />,
  li: (props: Props<"li">) => <li className="pl-0.5 [&>p]:my-0" {...attrs(props)} />,
  a: (props: Props<"a">) => {
    const external = Boolean(props.href && /^https?:/i.test(props.href));
    return (
      <a
        className="text-accent underline decoration-accent/30 underline-offset-2 transition-colors hover:decoration-accent"
        {...attrs(props)}
        target={external ? "_blank" : undefined}
        rel={external ? "noreferrer noopener" : undefined}
      />
    );
  },
  strong: (props: Props<"strong">) => <strong className="font-semibold text-fg" {...attrs(props)} />,
  em: (props: Props<"em">) => <em className="italic" {...attrs(props)} />,
  code: (props: Props<"code">) => <code className={cn("rounded bg-surface-strong px-1 py-0.5 font-mono text-[12.5px] text-fg", props.className)} {...attrs(props)} />,
  pre: (props: Props<"pre">) => (
    <pre
      className="scroll-quiet my-3 overflow-x-auto rounded-lg border border-line bg-surface p-3 font-mono text-[12px] leading-6 [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-[12px]"
      {...attrs(props)}
    />
  ),
  blockquote: (props: Props<"blockquote">) => <blockquote className="my-3 border-l-2 border-accent/40 pl-3 text-fg-muted" {...attrs(props)} />,
  hr: (props: Props<"hr">) => <hr className="my-5 border-line" {...attrs(props)} />,
  table: (props: Props<"table">) => (
    <div className="scroll-quiet my-3 overflow-x-auto rounded-lg border border-line">
      <table className="w-full border-collapse text-left text-[12.5px] leading-6" {...attrs(props)} />
    </div>
  ),
  thead: (props: Props<"thead">) => <thead className="bg-surface" {...attrs(props)} />,
  th: (props: Props<"th">) => <th className="border-b border-line px-3 py-2 align-top font-medium text-fg" {...attrs(props)} />,
  td: (props: Props<"td">) => <td className="border-t border-line px-3 py-2 align-top" {...attrs(props)} />,
  // Remote images would leak the reader's IP to whoever the model links to; show nothing instead.
  img: () => null,
};

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("break-words text-[14px] leading-7 text-fg", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, [rehypeSanitize, schema]]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
