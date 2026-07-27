import { describe, expect, it } from "vitest";
import { componerAreaConformidad, componerFormaPago, huecosPendientes } from "@/lib/forma-pago";

/**
 * El apartado FORMA DE PAGO no está en los PDF-modelo cargados: lo pide la
 * entidad. Su texto lo fija el Art. 67 de la Ley y solo tiene cinco huecos, así
 * que se compone con una plantilla en vez de generarse: parafrasear un artículo
 * de la Ley en un documento que se firma es un defecto, no una ayuda.
 */
const COMPLETO = {
  areaConformidad: "Sub Gerencia de Desarrollo Económico",
  direccion: "Av. Arenas 121, Abancay",
  documentacionAdicional: "Acta de entrega de los bienes",
  lugarPresentacion: "Mesa de Partes de la Municipalidad",
  tipoPago: "un pago único contra conformidad",
};

describe("el texto que fija la Ley sale literal", () => {
  it("cita el artículo 67 y los plazos de la norma", () => {
    const t = componerFormaPago(COMPLETO);
    expect(t).toContain("artículo 67 de la Ley");
    expect(t).toContain("dentro de los diez días hábiles siguientes de otorgada la conformidad");
    expect(t).toContain("prorrogable, previa justificación de la demora, por cinco días hábiles");
  });

  it("incluye el párrafo del consorcio, que no depende de nada que se escriba", () => {
    expect(componerFormaPago({})).toContain("se haya suscrito contrato con un consorcio");
  });

  it("los dos documentos fijos van siempre", () => {
    const t = componerFormaPago(COMPLETO);
    expect(t).toContain("conformidad de la prestación efectuada");
    expect(t).toContain("- Comprobante de pago.");
  });
});

describe("los cinco huecos se rellenan con lo registrado", () => {
  it("cada valor aparece en su sitio", () => {
    const t = componerFormaPago(COMPLETO);
    expect(t).toContain("a favor del contratista en un pago único contra conformidad.");
    expect(t).toContain("servidor responsable del Sub Gerencia de Desarrollo Económico.");
    expect(t).toContain("- Acta de entrega de los bienes.");
    expect(t).toContain("restante en Mesa de Partes de la Municipalidad, sito en Av. Arenas 121, Abancay.");
  });

  it("ya no queda ningún corchete cuando están los cinco", () => {
    expect(componerFormaPago(COMPLETO)).not.toMatch(/\[[A-ZÁÉÍÓÚ]/);
  });
});

describe("un hueco sin rellenar se VE", () => {
  it("conserva el corchete del formato en vez de disolverse", () => {
    // El requerimiento se firma: un hueco vacío tiene que parecer lo que es
    // —algo que falta— y no una frase que ya está completa.
    const t = componerFormaPago({ ...COMPLETO, direccion: "" });
    expect(t).toContain("[CONSIGNAR LA DIRECCIÓN EXACTA]");
  });

  it("sin nada registrado salen los cinco corchetes", () => {
    const t = componerFormaPago({});
    expect((t.match(/\[[A-ZÁÉÍÓÚ][^\]]*\]/g) ?? []).length).toBe(5);
  });

  it("los espacios en blanco no cuentan como relleno", () => {
    expect(componerFormaPago({ ...COMPLETO, tipoPago: "   " })).toContain("[CONSIGNAR SI SE TRATA DE PAGO ÚNICO");
  });
});

describe("cuántos huecos faltan", () => {
  it("los cuenta para poder avisar antes de firmar", () => {
    expect(huecosPendientes({})).toBe(5);
    expect(huecosPendientes(COMPLETO)).toBe(0);
    expect(huecosPendientes({ ...COMPLETO, direccion: "", tipoPago: "  " })).toBe(2);
  });
});

describe("el apartado está en la ficha y se guarda", () => {
  it("los seis campos existen en 3.3 Condiciones de contratación", async () => {
    const { FICHA_SECCIONES } = await import("@/lib/necesidad-ficha-secciones");
    const seccion = FICHA_SECCIONES.find((s) => s.title === "3.3 Condiciones de contratación")!;
    const apis = seccion.fields.map((f) => f.api);
    for (const api of [
      "formaPago", "formaPagoTipo", "formaPagoAreaConformidad",
      "formaPagoDocumentacion", "formaPagoLugar", "formaPagoDireccion",
    ]) {
      expect(apis, api).toContain(api);
    }
  });

  it("el esquema los acepta: sin esto el guardado responde 400", async () => {
    const { necesidadUpdateSchema } = await import("@/lib/necesidades");
    const r = necesidadUpdateSchema.safeParse({
      formaPago: componerFormaPago(COMPLETO),
      formaPagoAreaConformidad: COMPLETO.areaConformidad,
      formaPagoDireccion: COMPLETO.direccion,
      formaPagoDocumentacion: COMPLETO.documentacionAdicional,
      formaPagoLugar: COMPLETO.lugarPresentacion,
      formaPagoTipo: COMPLETO.tipoPago,
    });
    expect(r.success, r.success ? "" : JSON.stringify(r.error.issues)).toBe(true);
  });

  it("el texto compuesto cabe en el tope del campo", () => {
    // Con los cinco huecos vacios el texto es el MAS largo: los corchetes del
    // formato son mas largos que casi cualquier valor real.
    expect(componerFormaPago({}).length).toBeLessThan(6000);
  });

  it("«Redactar con IA» compone el texto, no llama al copiloto", async () => {
    // Se vigila el fuente porque el suite no monta React. Lo que importa es que
    // este campo NO pase por el modelo de lenguaje: su texto es literal de la
    // Ley y parafrasearlo en un documento que se firma seria un defecto.
    const { readFileSync } = await import("node:fs");
    const fuente = readFileSync("app/components/necesidad-detail.tsx", "utf-8");
    // Se acota por el CIERRE de la función, no por un número de caracteres: la
    // primera versión de esta prueba cortaba a 1 400 y empezó a fallar sola en
    // cuanto se añadió un segundo atajo al mismo manejador.
    const i = fuente.indexOf("const pedirRedactarIA");
    const cuerpo = fuente.slice(i, fuente.indexOf("\n  };", i));
    expect(cuerpo).toContain('api === "formaPago"');
    expect(cuerpo).toContain("componerFormaPago");
    // y el atajo va ANTES de abrir el copiloto
    expect(cuerpo.indexOf("componerFormaPago")).toBeLessThan(cuerpo.indexOf("setCopilotoAbierto"));
  });
});

describe("el tipo de pago se elige, no se escribe", () => {
  it("son exactamente dos opciones", async () => {
    const { FICHA_SECCIONES } = await import("@/lib/necesidad-ficha-secciones");
    const campo = FICHA_SECCIONES.flatMap((s) => s.fields).find((f) => f.api === "formaPagoTipo")!;
    expect(campo.kind).toBe("select");
    expect(campo.opciones?.map((o) => o.label)).toEqual(["Pago único", "Pagos a cuenta"]);
  });

  it("el valor guardado encaja en la frase del formato", async () => {
    // La frase es «...a favor del contratista en ___.», así que el valor se
    // guarda ya redactado —«un pago único»— y no como etiqueta suelta.
    const { FICHA_SECCIONES } = await import("@/lib/necesidad-ficha-secciones");
    const campo = FICHA_SECCIONES.flatMap((s) => s.fields).find((f) => f.api === "formaPagoTipo")!;
    for (const opcion of campo.opciones ?? []) {
      const texto = componerFormaPago({ ...COMPLETO, tipoPago: opcion.value });
      expect(texto).toContain(`a favor del contratista en ${opcion.value}.`);
    }
  });

  it("y el esquema acepta los dos valores", async () => {
    const { necesidadUpdateSchema } = await import("@/lib/necesidades");
    const { FICHA_SECCIONES } = await import("@/lib/necesidad-ficha-secciones");
    const campo = FICHA_SECCIONES.flatMap((s) => s.fields).find((f) => f.api === "formaPagoTipo")!;
    for (const o of campo.opciones ?? []) {
      expect(necesidadUpdateSchema.safeParse({ formaPagoTipo: o.value }).success, o.value).toBe(true);
    }
  });
});

/**
 * El área que otorga la conformidad ya está registrada en la ficha —en el
 * apartado del Art. 144— y, cuando la contratación se imputa a una inversión,
 * también su proyecto y su CUI. Aquí se compone con los tres en vez de pedir
 * que se teclee otra vez.
 */
const PROYECTO =
  "186 MEJORAMIENTO Y AMPLIACION DE LOS SERVICIOS DE AGUA POTABLE Y SANEAMIENTO BASICO";

describe("el área de la conformidad se trae de lo ya registrado", () => {
  it("con los tres datos dice a qué inversión pertenece el área", () => {
    expect(
      componerAreaConformidad({
        area: "Sub Gerencia de Desarrollo Económico",
        cui: "2661009",
        proyectoInversion: PROYECTO,
      }),
    ).toBe(
      `Sub Gerencia de Desarrollo Económico, del proyecto de inversión «${PROYECTO}», con CUI 2661009`,
    );
  });

  it("sin inversión sale solo el área", () => {
    expect(componerAreaConformidad({ area: "Unidad de Logística" })).toBe("Unidad de Logística");
  });

  it("el proyecto y el CUI se añaden por separado", () => {
    // Una ficha puede tener el nombre del proyecto y todavía no el código, o al
    // revés: esperar a los dos dejaría el campo vacío teniendo ya la mitad.
    expect(componerAreaConformidad({ area: "A", proyectoInversion: "P" })).toBe(
      "A, del proyecto de inversión «P»",
    );
    expect(componerAreaConformidad({ area: "A", cui: "123" })).toBe("A, con CUI 123");
  });

  it("sin área no compone nada: el hueco del formato tiene que verse", () => {
    // Devolver «del proyecto de inversión …» sin decir QUIÉN firma sería peor
    // que el corchete: parecería un apartado completo.
    expect(componerAreaConformidad({ cui: "2661009", proyectoInversion: PROYECTO })).toBe("");
    expect(componerAreaConformidad({ area: "   ", cui: "2661009" })).toBe("");
    expect(componerAreaConformidad({})).toBe("");
  });

  it("los espacios sobrantes no cuentan como dato", () => {
    expect(componerAreaConformidad({ area: " A ", cui: "  ", proyectoInversion: " " })).toBe("A");
  });

  it("el apartado lo compone solo, a partir de los campos sueltos", () => {
    // La composición vive DENTRO de `componerFormaPago` y no en el campo de la
    // ficha: ese campo es de donde sale el área, y escribir en él el resultado
    // de leerlo sería morderse la cola.
    const texto = componerFormaPago({ ...COMPLETO, cui: "2661009", proyectoInversion: PROYECTO });
    expect(texto).toContain(
      `responsable del Sub Gerencia de Desarrollo Económico, del proyecto de inversión «${PROYECTO}», con CUI 2661009.`,
    );
  });

  it("sin inversión el apartado no cambia respecto a antes", () => {
    expect(componerFormaPago(COMPLETO)).toContain(
      "responsable del Sub Gerencia de Desarrollo Económico.",
    );
  });

  it("y el corchete sigue saliendo si falta el área, aunque haya inversión", () => {
    const texto = componerFormaPago({ ...COMPLETO, areaConformidad: "", cui: "2661009", proyectoInversion: PROYECTO });
    expect(texto).toContain("[REGISTRAR LA DENOMINACIÓN DEL ÁREA RESPONSABLE");
    expect(texto).not.toContain(PROYECTO);
  });
});

describe("el área se pide UNA sola vez", () => {
  it("la casilla del Art. 144 ya no se enseña", async () => {
    // Estaban las dos en la sección 3.3, con el MISMO rótulo y una debajo de la
    // otra: se registraba dos veces y nada garantizaba que dijeran lo mismo.
    const { FICHA_SECCIONES } = await import("@/lib/necesidad-ficha-secciones");
    const visibles = FICHA_SECCIONES.flatMap((s) => s.fields).filter(
      (f) => !f.oculto && f.label === "Área que otorga la conformidad",
    );
    expect(visibles.map((f) => f.api)).toEqual(["formaPagoAreaConformidad"]);
  });

  it("pero su columna sigue existiendo, espejada", async () => {
    // El apartado del Art. 144 la usa: se oculta la casilla, no el dato.
    const { FICHA_SECCIONES } = await import("@/lib/necesidad-ficha-secciones");
    const campo = FICHA_SECCIONES.flatMap((s) => s.fields).find((f) => f.api === "conformidadArea");
    expect(campo?.oculto).toBe(true);

    const { readFileSync } = await import("node:fs");
    const fuente = readFileSync("app/components/necesidad/usar-ficha-form.ts", "utf-8");
    const i = fuente.indexOf("function setFichaField");
    const cuerpo = fuente.slice(i, fuente.indexOf("\n  }", i));
    expect(cuerpo).toContain('if (api === "formaPagoAreaConformidad") next.conformidadArea = value;');
  });

  it("y al abrir, la ficha vieja que solo tenga una de las dos rellena la otra", async () => {
    const { readFileSync } = await import("node:fs");
    const fuente = readFileSync("app/components/necesidad/usar-ficha-form.ts", "utf-8");
    const i = fuente.indexOf("function startFichaEdit");
    const cuerpo = fuente.slice(i, fuente.indexOf("setFichaEdit(true)", i));
    expect(cuerpo).toContain("initial.formaPagoAreaConformidad = initial.conformidadArea");
    expect(cuerpo).toContain("initial.conformidadArea = initial.formaPagoAreaConformidad");
  });
});

describe("el apartado entero cabe en su tope", () => {
  it("el peor caso posible —todos los huecos al máximo— no se corta", async () => {
    // El texto capa a `LIMITES_TEXTO.formaPago` al escribirlo en la ficha. Si el
    // peor caso lo rebasa, el apartado se corta SIN avisar en un documento que
    // se firma. Al sumarle el nombre del proyecto (2000 por sí solo) el tope de
    // 6000 se quedó corto.
    const { LIMITES_TEXTO } = await import("@/lib/necesidades-limites");
    const { necesidadUpdateSchema } = await import("@/lib/necesidades");
    const relleno = (api: string) => "á".repeat(LIMITES_TEXTO[api]);
    const peor = componerFormaPago({
      areaConformidad: relleno("formaPagoAreaConformidad"),
      cui: relleno("cui"),
      direccion: relleno("formaPagoDireccion"),
      documentacionAdicional: relleno("formaPagoDocumentacion"),
      lugarPresentacion: relleno("formaPagoLugar"),
      proyectoInversion: relleno("proyectoInversion"),
      tipoPago: relleno("formaPagoTipo"),
    });
    expect(peor.length).toBeLessThanOrEqual(LIMITES_TEXTO.formaPago);
    expect(necesidadUpdateSchema.safeParse({ formaPago: peor }).success).toBe(true);
  });
});

describe("el formulario compone el apartado con la inversión", () => {
  it("«Redactar con IA» le pasa el proyecto y el CUI", async () => {
    // Se vigila el fuente porque el suite no monta React.
    const { readFileSync } = await import("node:fs");
    const fuente = readFileSync("app/components/necesidad-detail.tsx", "utf-8");
    const i = fuente.indexOf("const pedirRedactarIA");
    const cuerpo = fuente.slice(i, fuente.indexOf("\n  };", i));
    expect(cuerpo).toContain("cui: fichaForm.cui");
    expect(cuerpo).toContain("proyectoInversion: fichaForm.proyectoInversion");
  });

  it("el borrador local se guarda DESPUÉS de derivar los campos", async () => {
    // Estaba antes, así que guardaba un estado que ya no era el devuelto y solo
    // se corregía en la siguiente tecla.
    const { readFileSync } = await import("node:fs");
    const fuente = readFileSync("app/components/necesidad/usar-ficha-form.ts", "utf-8");
    const i = fuente.indexOf("function setFichaField");
    const cuerpo = fuente.slice(i, fuente.indexOf("\n  }", i));
    // Los dos tienen que ESTAR: con -1, un «menor que» pasaría solo.
    expect(cuerpo).toContain("next.conformidadArea = value");
    expect(cuerpo).toContain("localStorage.setItem(DRAFT_KEY");
    expect(cuerpo.indexOf("next.conformidadArea = value")).toBeLessThan(
      cuerpo.indexOf("localStorage.setItem(DRAFT_KEY"),
    );
  });
});

describe("«Redactar con IA» solo donde hay prosa", () => {
  it("no sale en desplegables, fechas ni números", async () => {
    const { readFileSync } = await import("node:fs");
    const fuente = readFileSync("app/components/necesidad/campo-ficha.tsx", "utf-8");
    // El botón se calcula UNA vez y se reparte; la condición vive ahí.
    const i = fuente.indexOf("const botonRedactarIA");
    const decl = fuente.slice(i - 400, i + 120);
    expect(decl).toContain("esProsa");
    expect(decl).toMatch(/kind === "text"/);
    expect(decl).toMatch(/kind === "textarea"/);
  });
});
