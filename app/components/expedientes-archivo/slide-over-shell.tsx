"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

/**
 * Envoltura común de los paneles deslizantes del archivo, sobre la primitiva
 * `Dialog` de Radix.
 *
 * Cuatro paneles —detalle del expediente, chat, mover en bloque y reemplazar
 * PDF— repetían la misma estructura: un overlay que cierra al hacer clic, un
 * panel que detiene la propagación y una cabecera con título, subtítulo y aspa.
 *
 * Ninguno atrapaba el foco ni cerraba con Escape: con el tabulador se salía a la
 * página de detrás, que seguía navegable bajo el overlay. Radix aporta eso, más
 * el bloqueo del scroll, la devolución del foco al cerrar y un `aria-labelledby`
 * con id único en lugar del `aria-label` escrito a mano.
 *
 * Las clases son las de siempre, así que el aspecto no cambia.
 */
export function ExpSlideOver({
  titulo,
  subtitulo,
  onClose,
  children,
  /** Clase del panel: la variante ancha del chat usa la suya. */
  clasePanel = "expSlideOver",
  /** Modificador opcional, p. ej. `expSlideOver-modal` para la variante centrada. */
  modificador,
  etiquetaCerrar = "Cerrar",
}: {
  titulo: React.ReactNode;
  subtitulo?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  clasePanel?: string;
  modificador?: string;
  etiquetaCerrar?: string;
}) {
  return (
    // Estos paneles solo se montan cuando toca mostrarlos, así que están
    // abiertos por definición; cerrarlos es desmontarlos (onClose).
    <Dialog.Root
      open
      onOpenChange={(abierto) => {
        if (!abierto) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="expSlideOverOverlay" />
        <Dialog.Content
          className={`${clasePanel} expSlideOverPortal${modificador ? ` ${modificador}` : ""}`}
        >
          <div className="expSlideOver-header">
            <div>
              <Dialog.Title asChild>
                <h3 className="expSlideOver-title">{titulo}</h3>
              </Dialog.Title>
              {subtitulo ? <p className="expSlideOver-subtitle">{subtitulo}</p> : null}
            </div>
            <Dialog.Close asChild>
              <button aria-label={etiquetaCerrar} className="expSlideOver-close" type="button">
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
