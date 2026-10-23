import type { NoteRole } from "@/lib/canvas-types";

export type DocumentMaterial = {
  id: string;
  title: string;
  role: NoteRole;
  weight: number;
  depth: number;
  content: string;
  note: string;
};

export type DocumentRelation = {
  id: string;
  fromTitle: string;
  toTitle: string;
  relationTypes: string[];
  selectedPaths: string[];
};

export type DocumentContext = {
  canvas: {
    name: string;
    description: string;
  };
  hint: string;
  result: {
    id: string;
    title: string;
    content: string;
    selectedQuestion: string | null;
  };
  materials: DocumentMaterial[];
  relations: DocumentRelation[];
};
