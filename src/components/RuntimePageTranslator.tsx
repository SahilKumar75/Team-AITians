"use client";

import { useEffect, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

type TranslatableAttr = "placeholder" | "title" | "aria-label" | "alt";

const TRANS_ATTRS: readonly TranslatableAttr[] = ["placeholder", "title", "aria-label", "alt"];
const EXCLUDED_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE", "PRE"]);

function isProbablyCode(text: string): boolean {
  return /[{};$]|=>|\b(?:const|let|var|function|await|return|new|Promise|map\(|filter\(|toLowerCase\()\b/.test(text);
}

function isProbablyTranslatable(text: string): boolean {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (!normalized) return false;
  if (normalized.length < 2 || normalized.length > 500) return false;
  if (!/[A-Za-z\u0900-\u097F]/.test(normalized)) return false;
  if (/^https?:\/\//i.test(normalized)) return false;
  if (/^0x[a-fA-F0-9]{6,}$/.test(normalized)) return false;
  if (isProbablyCode(normalized)) return false;
  return true;
}

function splitPadding(raw: string): { lead: string; core: string; trail: string } {
  const match = raw.match(/^(\s*)([\s\S]*?)(\s*)$/);
  if (!match) return { lead: "", core: raw, trail: "" };
  return { lead: match[1] || "", core: match[2] || "", trail: match[3] || "" };
}

export function RuntimePageTranslator() {
  const { tx } = useLanguage();
  const textSourceRef = useRef(new WeakMap<Text, string>());
  const attrSourceRef = useRef(new WeakMap<Element, Map<TranslatableAttr, string>>());
  const observerRef = useRef<MutationObserver | null>(null);
  const rafRef = useRef<number | null>(null);
  const queuedRef = useRef<Set<Node>>(new Set());
  const applyingRef = useRef(false);
  const txRef = useRef(tx);
  const queueNodeRef = useRef<(node: Node) => void>(() => undefined);

  useEffect(() => {
    txRef.current = tx;
  }, [tx]);

  useEffect(() => {
    if (typeof window === "undefined" || !document.body) return;

    const shouldSkipElement = (el: Element | null): boolean => {
      if (!el) return true;
      if (el.closest("[data-i18n-ignore]")) return true;
      if (EXCLUDED_TAGS.has(el.tagName)) return true;
      if (el.closest("script,style,noscript,textarea,code,pre,[data-i18n-ignore]")) return true;
      if (el.closest("[contenteditable='true']")) return true;
      return false;
    };

    const maybeTranslateTextNode = (node: Text) => {
      const parent = node.parentElement;
      if (shouldSkipElement(parent)) return;

      const current = node.nodeValue ?? "";
      let source = textSourceRef.current.get(node);

      if (!source) {
        source = current;
        textSourceRef.current.set(node, source);
      } else {
        const { lead, core, trail } = splitPadding(source);
        const expected = isProbablyTranslatable(core)
          ? `${lead}${txRef.current(core, { scope: "dom_auto" })}${trail}`
          : source;
        if (current !== expected && current !== source) {
          source = current;
          textSourceRef.current.set(node, source);
        }
      }

      const { lead, core, trail } = splitPadding(source);
      if (!isProbablyTranslatable(core)) return;
      const translated = `${lead}${txRef.current(core, { scope: "dom_auto" })}${trail}`;
      if (translated !== current) {
        node.nodeValue = translated;
      }
    };

    const maybeTranslateAttr = (el: Element, attr: TranslatableAttr) => {
      if (!el.hasAttribute(attr)) return;
      if (shouldSkipElement(el)) return;

      const current = el.getAttribute(attr) || "";
      let attrMap = attrSourceRef.current.get(el);
      if (!attrMap) {
        attrMap = new Map<TranslatableAttr, string>();
        attrSourceRef.current.set(el, attrMap);
      }

      let source = attrMap.get(attr);
      if (!source) {
        source = current;
        attrMap.set(attr, source);
      } else {
        const expected = isProbablyTranslatable(source)
          ? txRef.current(source, { scope: "dom_auto_attr" })
          : source;
        if (current !== expected && current !== source) {
          source = current;
          attrMap.set(attr, source);
        }
      }

      if (!isProbablyTranslatable(source)) return;
      const translated = txRef.current(source, { scope: "dom_auto_attr" });
      if (translated !== current) {
        el.setAttribute(attr, translated);
      }
    };

    const translateElementTree = (root: Element) => {
      if (shouldSkipElement(root)) return;

      TRANS_ATTRS.forEach((attr) => maybeTranslateAttr(root, attr));
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);

      while (walker.nextNode()) {
        const current = walker.currentNode;
        if (current.nodeType === Node.TEXT_NODE) {
          maybeTranslateTextNode(current as Text);
          continue;
        }
        if (current.nodeType === Node.ELEMENT_NODE) {
          const element = current as Element;
          TRANS_ATTRS.forEach((attr) => maybeTranslateAttr(element, attr));
        }
      }
    };

    const processNode = (node: Node) => {
      if (!node.isConnected) return;
      if (node.nodeType === Node.TEXT_NODE) {
        maybeTranslateTextNode(node as Text);
        return;
      }
      if (node.nodeType === Node.ELEMENT_NODE) {
        translateElementTree(node as Element);
        return;
      }
      if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
        node.childNodes.forEach((child) => processNode(child));
      }
    };

    const flushQueue = () => {
      rafRef.current = null;
      if (applyingRef.current) return;
      applyingRef.current = true;
      try {
        if (queuedRef.current.size === 0) {
          translateElementTree(document.body);
        } else {
          queuedRef.current.forEach((node) => processNode(node));
        }
      } finally {
        queuedRef.current.clear();
        applyingRef.current = false;
      }
    };

    const queueNode = (node: Node) => {
      queuedRef.current.add(node);
      if (rafRef.current === null) {
        rafRef.current = window.requestAnimationFrame(flushQueue);
      }
    };

    queueNodeRef.current = queueNode;
    queueNode(document.body);

    const observer = new MutationObserver((mutations) => {
      if (applyingRef.current) return;
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          queueNode(mutation.target);
          continue;
        }
        if (mutation.type === "attributes") {
          queueNode(mutation.target);
          continue;
        }
        mutation.addedNodes.forEach((added) => queueNode(added));
      }
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...TRANS_ATTRS],
    });

    observerRef.current = observer;

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      queueNodeRef.current = () => undefined;
      queuedRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !document.body) return;
    queueNodeRef.current(document.body);
  }, [tx]);

  return null;
}
