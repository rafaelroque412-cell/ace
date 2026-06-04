"use client";

import { useEffect, useMemo, useState } from "react";
import { Bookmark, ExternalLink, FolderClosed, Inbox, Save, Trash2 } from "lucide-react";

type Folder = { id: string; name: string };
type SavedItem = {
  id: string;
  carpeta_id: string | null;
  item_type: string;
  document_id: string | null;
  article_id: string | null;
  message_id: string | null;
  title: string;
  note: string | null;
  created_at: string;
};

const typeLabels: Record<string, string> = { documento: "Documento", articulo: "Artículo", mensaje: "Respuesta" };

function itemHref(item: SavedItem) {
  if (item.document_id) {
    return `/api/documents/${item.document_id}`;
  }
  if (item.item_type === "mensaje") {
    return "/historial";
  }
  return null;
}

export function SavedWorkspace() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [items, setItems] = useState<SavedItem[]>([]);
  const [selected, setSelected] = useState<string>("all");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  async function reload() {
    const [foldersRes, itemsRes] = await Promise.all([
      fetch("/api/folders").then((response) => response.json()),
      fetch("/api/saved").then((response) => response.json()),
    ]);
    setFolders(foldersRes.folders ?? []);
    setItems(itemsRes.items ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void reload();
  }, []);

  const visible = useMemo(() => {
    if (selected === "all") return items;
    if (selected === "none") return items.filter((item) => !item.carpeta_id);
    return items.filter((item) => item.carpeta_id === selected);
  }, [items, selected]);

  async function saveNote(id: string) {
    await fetch("/api/saved", {
      body: JSON.stringify({ id, note: drafts[id] ?? "" }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    void reload();
  }

  async function remove(id: string) {
    await fetch(`/api/saved?id=${id}`, { method: "DELETE" });
    setItems((current) => current.filter((item) => item.id !== id));
  }

  return (
    <div className="normGrid">
      <aside className="normList" aria-label="Carpetas">
        <button className={`normCard ${selected === "all" ? "active" : ""}`} onClick={() => setSelected("all")} type="button">
          <strong>
            <Inbox size={15} /> Todo
          </strong>
          <span className="normCardMeta">{items.length} elemento(s)</span>
        </button>
        <button className={`normCard ${selected === "none" ? "active" : ""}`} onClick={() => setSelected("none")} type="button">
          <strong>Sin carpeta</strong>
        </button>
        {folders.map((folder) => (
          <button
            key={folder.id}
            className={`normCard ${selected === folder.id ? "active" : ""}`}
            onClick={() => setSelected(folder.id)}
            type="button"
          >
            <strong>
              <FolderClosed size={15} /> {folder.name}
            </strong>
            <span className="normCardMeta">
              {items.filter((item) => item.carpeta_id === folder.id).length} elemento(s)
            </span>
          </button>
        ))}
      </aside>

      <section className="normDetail" aria-label="Elementos guardados">
        {loading ? (
          <div className="emptyState">
            <span>Cargando...</span>
          </div>
        ) : visible.length === 0 ? (
          <div className="emptyState">
            <Bookmark size={20} />
            <strong>Nada guardado aquí</strong>
            <span>Usa "Guardar" en búsquedas, normas o respuestas del chat.</span>
          </div>
        ) : (
          <div className="documentList">
            {visible.map((item) => {
              const href = itemHref(item);
              return (
                <article className="sourceItem" key={item.id}>
                  <div className="sourceItemHeader">
                    <div>
                      <span>{typeLabels[item.item_type] ?? item.item_type}</span>
                      <strong>{item.title}</strong>
                    </div>
                    <button className="iconButton" onClick={() => remove(item.id)} type="button" aria-label="Eliminar">
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <textarea
                    className="noteTextarea savedNote"
                    onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: event.target.value }))}
                    placeholder="Nota personal..."
                    value={drafts[item.id] ?? item.note ?? ""}
                  />
                  <div className="sourceActions">
                    <button className="secondaryButton compactButton" onClick={() => saveNote(item.id)} type="button">
                      <Save size={15} />
                      Guardar nota
                    </button>
                    {href ? (
                      <a className="secondaryButton compactButton" href={href} rel="noreferrer" target="_blank">
                        <ExternalLink size={15} />
                        Abrir
                      </a>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
