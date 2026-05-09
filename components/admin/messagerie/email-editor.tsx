"use client";

import React from "react";
import { RichTextInput } from "@/components/page-builder/inspector/rich-text-input";
import { cn } from "@/lib/utils";

interface EmailEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Thin wrapper around the existing RichTextInput tuned for email composition:
 *  - No headings (emails don't need H1/H2/H3)
 *  - Quote / blockquote allowed (used for "citer le message")
 *  - Larger min-height to feel like a proper email composer
 */
export function EmailEditor({ value, onChange, placeholder, className }: EmailEditorProps) {
  return (
    <RichTextInput
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      allowHeadings={false}
      allowQuote
      className={cn(
        "[&_.ProseMirror]:min-h-[200px] [&_.ProseMirror]:text-sm [&_blockquote]:border-l-2 [&_blockquote]:border-primary/30 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
        className
      )}
    />
  );
}
