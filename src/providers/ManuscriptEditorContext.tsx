"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Editor } from "@tiptap/react";

type ManuscriptEditorContextValue = {
  editor: Editor | null;
  setEditor: (editor: Editor | null) => void;
};

const ManuscriptEditorContext =
  createContext<ManuscriptEditorContextValue | null>(null);

export function ManuscriptEditorProvider({ children }: { children: ReactNode }) {
  const [editor, setEditorState] = useState<Editor | null>(null);

  const setEditor = useCallback((next: Editor | null) => {
    setEditorState((prev) => {
      if (prev === next) return prev;
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ editor, setEditor }),
    [editor, setEditor],
  );

  return (
    <ManuscriptEditorContext.Provider value={value}>
      {children}
    </ManuscriptEditorContext.Provider>
  );
}

export function useManuscriptEditor() {
  const ctx = useContext(ManuscriptEditorContext);
  if (!ctx) {
    return {
      editor: null as Editor | null,
      setEditor: (_: Editor | null) => {},
    };
  }
  return ctx;
}
