// Plantillas de Bases estándar OECE por tipo de procedimiento (R.D. 001-2026-EF/54.01).
//
// Cada bases estándar tiene DOS partes de naturaleza opuesta (confirmado
// leyendo el PDF oficial de "Licitación Pública para bienes", ver el plan
// docs/superpowers/plans/2026-09-01-a9-elaboracion-bases.md):
//
//   Sección General (Cap. I-IV): FIJA. La propia norma dice "ESTA SECCIÓN NO
//   DEBE SER MODIFICADA EN NINGÚN EXTREMO, BAJO SANCIÓN DE NULIDAD". Se
//   reproduce tal cual.
//
//   Sección Específica: campos [ENTRE CORCHETES] que la entidad completa. La
//   mayoría YA tiene dato en ACE (A1-A9): origen "literal" apunta a
//   hitos[hito].data[campoHito] y NUNCA se pisa con texto libre; origen
//   "entidad" apunta a un dato de la entidad contratante (Configuración →
//   Municipalidad, tabla entity_settings), que no vive en ningún hito. Solo
//   lo que de verdad no existe en ningún dato ya registrado es origen
//   "libre" (la entidad lo escribe en el momento de elaborar las bases).
//
// ADVERTENCIA DE FIDELIDAD (no eliminar sin re-verificar): toda constante
// SECCION_GENERAL_* de este archivo se transcribió a mano leyendo el texto de
// capa del propio PDF oficial correspondiente (`extractPdfPagedText` de
// lib/pdf-processing.ts sobre el PDF en actuaciones-preparatorias/bases/),
// NO desde los chunks ya indexados en Pinecone (que se confirmó tienen ruido
// de OCR, p. ej. "CAPÍTULO II I" en vez de "III"). Se limpiaron artefactos de
// espaciado propios de la extracción (p. ej. "e ntidad" → "entidad") sin tocar
// el contenido normativo. Aun así, antes de usar este texto para un .docx que
// vaya a producción, cotéjese palabra por palabra contra el PDF/DOCX oficial
// del OECE — es una sección "bajo sanción de nulidad" y esta transcripción no
// reemplaza esa verificación humana final.

export type CampoBases = {
  /** Identifica el campo dentro de la Sección Específica (p. ej. "cap1.entidad.ruc"). */
  ruta: string;
  label: string;
  /**
   * "literal": se resuelve de `hitos[hito].data[campoHito]` sin tocarlo.
   * "entidad": se resuelve de un dato de la entidad contratante (entity_settings),
   *   que no vive en ningún hito de la fase de contratación.
   * "libre": no hay dato capturado en A1-A9 ni en la entidad; lo completa
   *   quien elabora las bases.
   */
  origen: "literal" | "entidad" | "libre";
  /** Código del hito de origen (A1..A9), solo si origen === "literal". */
  hito?: string;
  /** Clave dentro de hitos[hito].data, solo si origen === "literal". */
  campoHito?: string;
};

export type PlantillaBases = {
  proceso: string;
  /** Texto literal de los Capítulos I-IV, verificado a mano contra el PDF oficial. */
  seccionGeneral: string;
  seccionEspecifica: CampoBases[];
};

const SECCION_GENERAL_BIENES = `
CAPÍTULO I
ASPECTOS GENERALES

1.1. REFERENCIAS
Cuando en el presente documento se mencione la palabra "Ley", se entiende que se está haciendo referencia a la Ley N° 32069, Ley General de Contrataciones Públicas, y cuando se mencione la palabra "Reglamento", se entiende que se está haciendo referencia al Reglamento de la Ley N° 32069, Ley General de Contrataciones Públicas, aprobado por Decreto Supremo N° 009-2025-EF. Las referidas normas incluyen sus respectivas modificaciones, de ser el caso.

1.2. ALCANCE
La presente base estándar es utilizada por la entidad contratante para la adquisición de bienes, según la cuantía establecida en la Ley de Presupuesto del Sector Público para el Año Fiscal correspondiente; así como para la adquisición de bienes bajo los sistemas de entrega de llave en mano y llave en mano con mantenimiento con una cuantía mayor a S/ 2 000 000,00 (Dos millones y 00/100 Soles), en tanto se implemente el procedimiento de selección de Licitación Pública para bienes especializados. (De acuerdo con el numeral 4 de la Decimotercera Disposición Complementaria Transitoria del Reglamento de la Ley N° 32069, Ley General de Contrataciones Públicas.)

CAPÍTULO II
DESARROLLO DEL PROCEDIMIENTO DE SELECCIÓN

2.1 ETAPAS DE LA LICITACIÓN PÚBLICA PARA BIENES
Las etapas del presente procedimiento de selección son las siguientes (de conformidad con el numeral 27.1 del artículo 27 de la Ley, la facultad para actuar discrecionalmente se fundamenta en el rigor técnico empleado por los funcionarios y servidores, dependencias y unidades de organización encargadas de las contrataciones públicas para optar por la mejor decisión debidamente sustentada que permita el cumplimiento oportuno de los fines públicos):

a) Convocatoria. Se realiza a través del SEACE de la Pladicop en la fecha señalada en el cronograma. (Artículos 63 y 64 del Reglamento.)

b) Registro de participantes. Aplica lista abierta, por lo que cualquier proveedor puede registrarse como participante en el procedimiento de selección. (Artículos 65 y 93 del Reglamento.)

c) Cuestionamientos a las bases (consultas, observaciones e integración):
1. La presentación de consultas y/u observaciones se realiza en un plazo no menor a siete días hábiles contabilizados desde el día siguiente de la convocatoria.
2. La absolución de los referidos cuestionamientos y la publicación de las bases integradas se realiza en la fecha prevista en el cronograma del procedimiento de selección.
3. El pliego de absolución de consultas y observaciones, así como las bases integradas pueden ser cuestionadas por los participantes, para su elevación ante el OECE, dentro de los tres días hábiles siguientes de publicado el pliego de absolución de consultas y observaciones e integración de bases. La entidad contratante realiza la elevación de conformidad con la directiva del OECE.
4. La entidad contratante solo puede omitir la elevación al OECE del pliego de absolución de consultas y observaciones y las bases integradas en caso haya utilizado la herramienta de difusión del requerimiento en la interacción con el mercado.
(Artículos 51, 62, 66, 67 y 93 del Reglamento.)

d) Evaluación de ofertas técnicas y económicas:
1. La presentación de ofertas se realiza a través del SEACE de la Pladicop desde las 00:01 hasta las 23:59 horas (hora peruana) de la fecha prevista en el cronograma del procedimiento de selección. Dicha fecha no puede ser fijada en menos de siete días hábiles desde la publicación de la integración de bases o el pronunciamiento con la integración definitiva de bases por parte del OECE.
2. La presentación de ofertas se realiza adjuntando el archivo digitalizado que contenga los documentos que la conforman, según lo requerido en las bases (los formularios electrónicos del SEACE de la Pladicop que los participantes deben registrar para presentar sus ofertas, tienen carácter de declaración jurada).
3. La evaluación de ofertas es SIN PRECALIFICACIÓN y consiste en:
   a. Admisión de las ofertas: los evaluadores revisan que la oferta contenga los documentos señalados en el Capítulo II de la Sección Específica de las bases, caso contrario la oferta se considera no admitida.
   b. Revisión de los requisitos de calificación: los evaluadores califican a los postores verificando que cumplan con los requisitos de calificación detallados en el Capítulo III de la Sección Específica de las bases. Caso contrario la oferta se considera descalificada.
   c. Evaluación técnica: los evaluadores aplican los factores de evaluación previstos en el Capítulo IV de la Sección Específica de las bases a las ofertas que cumplen los requisitos de calificación. La evaluación de la oferta económica es simultánea a la evaluación técnica, por lo cual la oferta económica es un factor de evaluación.
4. Todos los actos se realizan a través del SEACE de la Pladicop, incluyendo la subsanación de ofertas.
(Artículos 68, 70, 71, 72, 73, 74, 75, 78 y 132 del Reglamento.)

Rechazo de ofertas: los evaluadores pueden rechazar ofertas económicas que se encuentren por debajo de la cuantía de la contratación, en los siguientes casos: i) la oferta se encuentra sustancialmente por debajo de la cuantía de la contratación; ii) la oferta no incorpora alguna de las prestaciones requeridas; o iii) las prestaciones requeridas no se encuentren suficientemente presupuestadas. Para ello, los evaluadores solicitan al postor por escrito o por medios electrónicos, una descripción detallada de los elementos que componen su oferta, pudiendo proporcionarle un formato de estructura de costos con los aspectos mínimos que deben ser acreditados, además de solicitarle información complementaria pertinente. El postor cuenta con un plazo mínimo de dos (2) días hábiles para responder, computados desde el día siguiente de recibida la solicitud. Una vez recibida la información, los evaluadores analizan objetivamente el riesgo del incumplimiento de las prestaciones ofertadas y de advertir que es probable su incumplimiento, rechazan la oferta mediante decisión debidamente motivada.

Oferta económica de mejor puntaje que supera la cuantía de la contratación: en caso la oferta económica del postor que obtiene el mejor puntaje total supere la cuantía de la contratación, se siguen los siguientes pasos, de conformidad con el artículo 132 del Reglamento:
i. La DEC gestiona la solicitud de la ampliación de la certificación de crédito presupuestario y/o previsión presupuestal correspondiente. De otorgarse la ampliación, se procede a adjudicar la buena pro.
ii. De no contar con la ampliación de la certificación de crédito presupuestario y/o previsión presupuestal, los evaluadores negocian con el postor que obtuvo el mejor puntaje total, en este orden: i) la reducción de su oferta económica; ii) la reducción de las prestaciones o condiciones del requerimiento, conforme al numeral 132.1 del artículo 132 del Reglamento. No pueden negociarse las condiciones que dieron lugar al otorgamiento de puntaje en los factores de evaluación correspondientes a la oferta técnica o aquellos establecidos como no negociables en el requerimiento. La finalidad pública de la contratación no debe ser afectada.
iii. En caso el postor con el mejor puntaje no acepte, se procede a negociar con los siguientes postores en el orden de prelación que obtuvieron. Si el postor que sigue en el orden de prelación ofertó un monto igual o menor a la cuantía de la contratación, se le adjudica la buena pro.
iv. En caso el postor que obtuvo el mejor puntaje total reduzca su oferta económica pero la reducción no se encuentre dentro de la cuantía de la contratación, se solicita la ampliación de la certificación de crédito presupuestario y/o previsión presupuestal correspondiente. En caso se otorgue la ampliación, se adjudica la buena pro. Caso contrario, se puede optar por: negociar con los siguientes postores en el orden de prelación o declarar desierto el procedimiento de selección.
v. Las decisiones adoptadas por los evaluadores en la negociación constan en actas que se publican en el SEACE de la Pladicop y se sustentan en el principio de valor por dinero, priorizando el cumplimiento de la finalidad pública de la contratación.
(Artículos 80, 81, 82, 83 y 84 del Reglamento.)

e) Otorgamiento de la buena pro:
1. Determinada la oferta ganadora, los evaluadores otorgan la buena pro, mediante su publicación en el SEACE de la Pladicop, incluyendo los documentos que sustenten los resultados de la admisión, calificación, evaluación y el otorgamiento de la buena pro.
2. En caso de haber sorteo por desempate, éste se realiza a través del SEACE de la Pladicop.
3. En caso se hayan presentado dos o más ofertas, el consentimiento de la buena pro se produce y registra a través del SEACE de la Pladicop al día siguiente de vencido el plazo correspondiente para interponer recurso de apelación, sin que los postores hayan ejercido el derecho de interponer dicho recurso. En caso se haya presentado una sola oferta, el consentimiento de la buena pro se produce el mismo día de la notificación de su otorgamiento y se registra en el SEACE de la Pladicop al día siguiente.

2.2 CONSIDERACIONES PARA TODOS LOS PROVEEDORES:
2.2.1 Para registrarse como participante en un procedimiento de selección convocado por una entidad contratante, es necesario que los proveedores cuenten con inscripción vigente ante el Registro Nacional de Proveedores (RNP) que administra el Organismo Especializado para las Contrataciones Públicas Eficientes (OECE) en el registro correspondiente al objeto del procedimiento de selección. Para obtener mayor información, se puede ingresar a la siguiente dirección electrónica: www.rnp.gob.pe.
2.2.2 Los proveedores que deseen registrar su participación deben ingresar al SEACE de la Pladicop utilizando su certificado (usuario y contraseña).
2.2.3 No pueden formularse consultas ni observaciones respecto del contenido de una ficha técnica o ficha de homologación aprobada, aun cuando el requerimiento haya sido estandarizado parcialmente respecto de las características técnicas y/o requisitos de calificación y/o condiciones de ejecución. Las consultas y observaciones que se formulen sobre el particular se tienen como no presentadas.
2.2.4 Las declaraciones juradas, formatos o formularios previstos en las bases que conforman la oferta deben estar debidamente firmados por el postor (firma manuscrita o digital, según la Ley Nº 27269, Ley de Firmas y Certificados Digitales). No se acepta insertar la imagen de una firma. El postor, el representante legal o común, apoderado o mandatario designado se hace responsable de la totalidad de los documentos incluidos en la oferta. El postor es responsable de verificar, antes de su envío, que los archivos puedan ser descargados y su contenido sea legible. En caso la información contenida en los documentos que conforman la oferta no coincida con lo declarado a través del SEACE de la Pladicop, prevalece la información declarada en los documentos de la oferta. (Conforme al artículo 23 del Reglamento de la Ley N° 27269, Ley de Firmas y Certificados Digitales, aprobado mediante Decreto Supremo N° 052-2008-PCM y sus normas modificatorias, los Prestadores de Servicios de Certificación Digital (PSC) pueden ser: a) Entidad de Certificación, b) Entidad de Registro o Verificación, y c) Prestador de Servicios de Valor Añadido. El Registro Oficial de Prestadores de Servicios de Certificación Digital (ROPS) lo administra el INDECOPI.)

Advertencia: en caso el proveedor emplee la firma digital como una única firma en los documentos que conforman la oferta, esta es suficiente para que el documento sea considerado firmado legalmente.

2.2.5 En caso que al registrarse como participante el proveedor presente una declaración jurada de desafectación del impedimento debido al parentesco establecido en el inciso 2 del numeral 30.1 del artículo 30 de la Ley, debe presentar adicionalmente para la admisión de su oferta la acreditación documental de su condición de desafectación conforme a lo indicado en el literal f) del numeral 2.2.1.1. del Capítulo II de la Sección Específica de las bases.

2.3 CONSIDERACIONES ADICIONALES PARA LOS CONSORCIOS:
2.3.1 En el caso de consorcios, basta que uno de sus integrantes se haya registrado como participante en el procedimiento de selección, para lo cual dicho integrante debe contar con inscripción vigente en el RNP como proveedor de bienes. Los demás integrantes del consorcio deben contar con inscripción vigente en el RNP, en las demás etapas del procedimiento de selección. No se considera consorcio a la asociación de personas de duración ilimitada o indefinida que, denominándose consorcios, han sido constituidas como personas jurídicas en los Registros Públicos.
2.3.2 Los integrantes de un consorcio no pueden presentar ofertas individuales ni conformar más de un consorcio en un procedimiento de selección o en un determinado ítem cuando se trate de procedimientos de selección según relación de ítems. En este segundo supuesto, los integrantes del consorcio pueden participar en ítems distintos a aquel en el que se presentaron en consorcio, sea en forma individual o en consorcio.
2.3.3 Como parte de los documentos de su oferta el consorcio debe presentar la promesa de consorcio con firmas digitales de todos sus integrantes o, en su defecto, firmas legalizadas, de ser el caso, conforme a lo establecido en el literal d) del numeral 69.1 del artículo 69 del Reglamento. La promesa de consorcio debe consignar, como mínimo, lo siguiente:
a) La identificación de los integrantes del consorcio. Se debe precisar el nombre completo o la denominación o razón social de los integrantes del consorcio, según corresponda.
b) La designación del representante común de consorcio.
c) El domicilio común del consorcio.
d) El correo electrónico común del consorcio, al cual se dirige todas las comunicaciones remitidas por la entidad contratante al consorcio durante el proceso de contratación, siendo éste el único válido para todos los efectos.
e) Las obligaciones que correspondan a cada uno de los integrantes del consorcio.
f) El porcentaje del total de las obligaciones de cada uno de los integrantes, respecto del objeto del contrato. Dicho porcentaje debe ser expresado en número entero, sin decimales.
2.3.4 La información contenida en los literales a), e) y f) precedentes no puede ser modificada con ocasión de la suscripción del contrato de consorcio, ni durante la etapa de ejecución contractual. En tal sentido, no cabe variación alguna en la conformación del consorcio, por lo que no es posible que se incorpore, sustituya o separe a un integrante.
2.3.5 El representante común tiene facultades para actuar en nombre y representación del consorcio, en todos los actos referidos al procedimiento de selección, suscripción y ejecución del contrato, con poderes suficientes para ejercitar los derechos y cumplir las obligaciones que se deriven de su calidad de postor y de contratista hasta la conformidad o liquidación del contrato, según corresponda. El representante común no debe encontrarse impedido, inhabilitado ni suspendido para contratar con el Estado. Para cambiar al representante común, todos los integrantes del consorcio deben firmar (mediante firmas legalizadas o firmas digitales) el documento en el que conste el acuerdo, el cual surte efectos cuando es notificado a la entidad contratante.
2.3.6 Las declaraciones juradas, formatos o formularios previstos en las bases que conforman la oferta deben estar debidamente firmados por el representante común, por todos los integrantes del consorcio o de forma independiente por cada consorciado, según corresponda (firma manuscrita o digital, según la Ley Nº 27269, Ley de Firmas y Certificados Digitales). En el caso de los documentos que deban suscribir todos los integrantes del consorcio, la firma es seguida de la razón social o denominación de cada uno de ellos. Lo mismo aplica en caso deban ser suscritos en forma independiente por cada integrante del consorcio, de acuerdo con lo establecido en los documentos del procedimiento de selección. En el caso de un consorcio integrado por una persona natural, basta que la persona natural indique debajo de su firma, sus nombres y apellidos completos.
2.3.7 La acreditación del requisito de calificación de la experiencia del postor se realiza en base a la documentación aportada por los integrantes del consorcio que se hubieran comprometido a ejecutar conjuntamente las obligaciones vinculadas directamente con el objeto materia de la contratación, de acuerdo con lo declarado en la promesa de consorcio. Para ello se debe seguir los siguientes pasos:
a) Primer paso: obtener el monto de facturación por cada integrante del consorcio, el cual se obtiene de la sumatoria de montos facturados por éste que, a criterio del evaluador han sido acreditados conforme a las bases, correspondiente a las contrataciones ejecutadas en forma individual y/o consorcio. En caso un integrante del consorcio presente facturación de contrataciones ejecutadas en consorcio, se considera el monto que corresponda al porcentaje de las obligaciones del referido integrante del consorcio. Este porcentaje debe estar consignado expresamente en la promesa o en el contrato de consorcio, de lo contrario, no se considera la experiencia ofertada en consorcio.
b) Segundo paso: verificar si el integrante del consorcio que acredita la mayor experiencia cumple con un determinado porcentaje de participación. En caso la entidad contratante haya establecido en las bases un porcentaje determinado de participación en la ejecución del contrato, para el integrante del consorcio que acredite mayor experiencia, debe verificarse que éste cumple con dicho parámetro a efectos de considerar su experiencia.
c) Tercer paso: sumatoria de experiencia de los consorciados. Para obtener la experiencia del consorcio se suma el monto de facturación aportado por cada integrante que cumple con lo señalado previamente.
2.3.8 Para calificar la experiencia del postor no se toma en cuenta la documentación presentada por el o los consorciados que asumen las obligaciones referidas a las siguientes actividades: i) actividades de carácter administrativo o de gestión como facturación, financiamiento, aporte de garantías, entre otras; ii) actividades relacionadas con asuntos de organización interna, tales como representación u otros aspectos que no se relacionan con la ejecución de las prestaciones, entre otras.
2.3.9 Tratándose de bienes, solo se consideran las obligaciones vinculadas directamente con el objeto de la contratación, como la fabricación y/o comercialización. No corresponde considerar la experiencia presentada por los integrantes del consorcio que se obliguen a ejecutar las demás actividades de la cadena productiva y actividades accesorias, tales como el aporte de materias primas, combustible, infraestructura, transporte, envasado, almacenaje, entre otras.
2.3.10 Los integrantes del consorcio son responsables de que su inscripción en el RNP se encuentre vigente, así como de no estar inhabilitados o suspendidos al registrarse como participantes, a la presentación de ofertas, al otorgamiento de la buena pro y al perfeccionamiento del contrato.
2.3.11 Los integrantes de un consorcio se encuentran obligados solidariamente a responder frente a la entidad contratante por los efectos patrimoniales que ésta sufra como consecuencia de la actuación de dichos integrantes, ya sea individual o conjunta, durante el procedimiento de selección y la ejecución contractual.

CAPÍTULO III
RECURSO DE APELACIÓN

3.1. ACCESO AL EXPEDIENTE DE CONTRATACIÓN
Una vez otorgada la buena pro, la DEC está en la obligación de permitir el acceso de los participantes y postores al expediente de contratación, con excepción de la información calificada como secreta, confidencial o reservada por la normativa de la materia y de aquella correspondiente a las ofertas que no fueron admitidas, a más tardar dentro del día hábil siguiente de haberse solicitado por escrito. A efectos de recoger la información de su interés, los participantes y postores pueden valerse de distintos medios, tales como: (i) la lectura y/o toma de apuntes, (ii) la captura y almacenamiento de imágenes, e incluso (iii) pueden solicitar copia de la documentación obrante en el expediente, siendo que, en este último caso, la entidad contratante debe entregar dicha documentación en el menor tiempo posible, previo pago de la tasa por tal concepto previsto en el Texto Único de Procedimientos Administrativos (TUPA) de la respectiva entidad contratante.

3.2. RECURSO DE APELACIÓN
A través del recurso de apelación se pueden impugnar los actos dictados durante el desarrollo del procedimiento de selección hasta antes del perfeccionamiento del contrato, incluyendo aquellos que declaren la nulidad de oficio, la cancelación del procedimiento de selección y otros actos emitidos por la entidad contratante que afecten la continuidad de éste. El recurso de apelación se presenta ante la mesa de partes digital o física del Tribunal de Contrataciones Públicas y es resuelto por este.

3.3. PLAZOS DE INTERPOSICIÓN DEL RECURSO DE APELACIÓN
La apelación contra el otorgamiento de la buena pro o contra los actos dictados con anterioridad a ella se interpone, como máximo, dentro de los ocho días hábiles siguientes de haberse notificado el otorgamiento de la buena pro a través del SEACE de la Pladicop. En el caso de la apelación contra los actos dictados con posterioridad al otorgamiento de la buena pro, contra la declaración de nulidad, cancelación y declaratoria de desierto del procedimiento de selección, el plazo indicado en el párrafo precedente se contabiliza desde que se toma conocimiento del acto que se desea impugnar. Se considera que se ha tomado conocimiento en el día de la publicación en el SEACE de la Pladicop del acto que se desea impugnar.

CAPÍTULO IV
DEL CONTRATO

4.1 REQUISITOS PARA EL PERFECCIONAMIENTO DEL CONTRATO:
Para perfeccionar el contrato, el postor o postores ganadores de la buena pro presentan los siguientes requisitos de conformidad con el artículo 88 del Reglamento:

a) Garantías, salvo casos de excepción.
El postor ganador de la buena pro presenta una garantía de fiel cumplimiento por una suma equivalente al 10% del monto del contrato original. La garantía de fiel cumplimiento puede ser: (i) fideicomiso, solo en caso el plazo de ejecución del contrato supere los noventa días calendario, (ii) carta fianza financiera, (iii) contrato de seguro o (iv) retención de pago. Asimismo, en la sección específica de las Bases puede considerarse la presentación de: i) garantía de fiel cumplimiento de prestaciones accesorias y, ii) garantía por adelantos directos, siempre que se cumplan las condiciones señaladas en el Reglamento. La retención de pago como garantía de fiel cumplimiento o de prestaciones accesorias aplica para contrataciones cuya cuantía adjudicada sea igual o menor a S/ 480 000,00 (Cuatrocientos ochenta mil y 00/100 Soles) en el caso de bienes. En el caso de las micro y pequeñas empresas estas pueden otorgar como garantía de fiel cumplimiento la retención de pago por parte de la entidad contratante con independencia de la cuantía de la contratación.
Excepciones: conforme a lo dispuesto en el literal a) del artículo 139 del Reglamento, en los contratos de bienes cuyos montos sean menores o iguales a 50 UIT, no corresponde presentar garantía de fiel cumplimiento de contrato ni garantía de fiel cumplimiento por prestaciones accesorias. Esta excepción no aplica cuando la sumatoria de los contratos derivados de procedimientos de selección por relación de ítems, adjudicados a un mismo postor, superen el monto señalado. Asimismo, tampoco se otorga garantía de fiel cumplimiento en caso el objeto contractual sea la adquisición de bienes inmuebles de propiedad privada.
(Numerales 61.4 y 61.5 del artículo 61 de la Ley. Literal a) del numeral 88.1 del artículo 88, y los artículos 113, 114, 115, 116, 138 y 139 del Reglamento.)

b) Contrato de consorcio, de ser el caso.
El contrato de consorcio debe cumplir con los siguientes requisitos: a. Contener la información indicada en el numeral 2.3.3 del Capítulo II de la Sección General de las presentes bases. b. Identificar al integrante del consorcio a quien se efectuará el pago y emite la respectiva factura o, en caso de llevar contabilidad independiente, señalar el número de Registro Único de Contribuyente (RUC), del consorcio. c. Consignar las firmas legalizadas ante notario público de cada uno de los integrantes del consorcio, de sus apoderados o de sus representantes legales, según corresponda.
Lo indicado no excluye la información adicional que pueda consignarse en el contrato de consorcio con el objeto de regular su administración interna, como es el régimen y los sistemas de participación en los resultados del consorcio, al que se refiere el artículo 448 de la Ley N° 26887, Ley General de Sociedades. En ningún caso puede aceptarse la presentación de la promesa de consorcio que fue parte de la oferta, independientemente de que dicha promesa contenga firmas legalizadas ante notario público.
(Literal b) del numeral 88.1 del artículo 88 y el artículo 89 del Reglamento.)

c) Código de cuenta interbancaria (CCI) o, en el caso de proveedores no domiciliados, el número de cuenta bancaria y nombre de la entidad bancaria en el exterior.
El CCI es requisito indispensable para realizar una transferencia entre cuentas de bancos diferentes, siendo requerido para efectuar el pago a los proveedores domiciliados en el Perú. Para los proveedores no domiciliados, corresponde el número de cuenta bancaria y nombre de la entidad bancaria en el exterior.
(Artículo 67 de la Ley. El literal c) del numeral 88.1 del artículo 88 del Reglamento.)

d) Documento que acredite que cuenta con facultades para perfeccionar el contrato, cuando corresponda.
Corresponde a la vigencia del poder del representante legal que acredite que cuenta con facultades para perfeccionar el contrato, en caso el postor sea persona jurídica. Adicionalmente, el representante legal presenta copia de su documento de identidad (DNI o carné de extranjería, según corresponda). En el caso de personas naturales, se solicita copia de su documento de identidad (DNI o carné de extranjería, según corresponda). En el caso de consorcios, estos documentos deben ser presentados por cada uno de los integrantes que suscribieron la promesa de consorcio, según corresponda. Asimismo, debe presentarse copia del documento de identidad (DNI o carné de extranjería, según corresponda) del representante común del consorcio.
(Literal d) del numeral 88.1 del artículo 88 del Reglamento.)

e) Institución Arbitral elegida del listado de instituciones arbitrales propuesto por la entidad contratante o propuesta de tres instituciones arbitrales por el postor.
Este requisito es obligatorio para todos los contratos que superen las 10 UIT (de conformidad con el numeral 84.1 del artículo 84 de la Ley, el arbitraje puede ser ad hoc solo en los casos en los que el monto de la controversia no supere las 10 UIT). Desde el 1 de enero de 2026, la institución arbitral elegida debe encontrarse inscrita en el Registro de Instituciones Arbitrales y Centros de Administración de Juntas de Prevención y Resolución de Disputas (REGAJU).
(Artículos 77, 83 y 84, así como la Décima Disposición Complementaria Transitoria de la Ley. El literal e) del numeral 88.1 del artículo 88 del Reglamento.)

f) Centro de administración de la JPRD elegido del listado de centros de administración propuesto por la entidad contratante o propuesta de tres centros de administración de la JPRD del postor.
Solo procede este requisito cuando el contrato tenga como objeto el suministro de bienes, su monto supere los S/ 10 000 000,00 (diez millones y 00/100 soles) y, adicionalmente, se haya determinado la JPRD como medio de solución de controversias en la estrategia de contratación.
(Artículos 77 y 79, así como la Décima Disposición Complementaria Transitoria de la Ley. Artículos 88 y 346 del Reglamento.)

4.2 PERFECCIONAMIENTO DEL CONTRATO
4.2.1. El postor ganador de la buena pro debe presentar los requisitos para perfeccionar el contrato dentro del plazo de ocho o cinco días hábiles, según corresponda, plazo que se contabiliza desde el día siguiente del registro del consentimiento de la buena pro en el SEACE de la Pladicop o desde que esta haya quedado administrativamente firme, de conformidad con el procedimiento y plazos dispuestos en los artículos 88, 89, 90 y 91 del Reglamento.
4.2.2. El contrato se suscribe mediante firma digital, siempre que el postor ganador de la buena pro cuente con certificado digital emitido por una entidad de certificación, de acuerdo con la normativa de la materia; caso contrario, se suscribe manualmente.
4.2.3. De conformidad con el numeral 87.3 del Reglamento, excepcionalmente, la entidad contratante puede sustentar la imposibilidad de suscribir el contrato mediante firma digital, supuesto en el cual la suscripción se realiza manualmente.

4.3 CONSIDERACIONES PARA LOS CONSORCIOS
4.3.1. Las garantías que presenten los consorcios para el perfeccionamiento del contrato, durante la ejecución contractual y para la interposición de los recursos impugnativos, además de cumplir con las condiciones establecidas en la Ley y el Reglamento, deben consignar expresamente el nombre completo o la denominación o razón social de los integrantes del consorcio, en calidad de garantizados, de lo contrario no pueden ser aceptadas por las entidades contratantes o el Tribunal de Contrataciones Públicas. No se cumple el requisito antes indicado si se consigna únicamente la denominación del consorcio.
4.3.2. La retención del 10% del monto del contrato original en calidad de garantía de fiel cumplimiento aplica cuando la cuantía adjudicada sea igual o menor a S/ 480 000,00 (Cuatrocientos ochenta mil y 00/100 Soles). En el caso de micro o pequeñas empresas que hayan declarado en su oferta tal condición, no aplica dicho umbral, según lo señalado en el artículo 114 del Reglamento. En caso de consorcio, aplica dicha retención si todos sus integrantes declaran en su oferta la condición de micro o pequeña empresa.

4.4 CONSIDERACIONES PARA LAS GARANTÍAS FINANCIERAS
4.4.1. En caso de garantías financieras, estas deben ser incondicionales, solidarias, irrevocables y de realización automática en el país, al solo requerimiento de la respectiva entidad contratante bajo responsabilidad de las empresas que las emiten. Las empresas que emitan garantías financieras deben encontrarse bajo la supervisión directa de la Superintendencia de Banca, Seguros y Administradoras Privadas de Fondos de Pensiones, contar con clasificación de riesgo B o superior, y deben estar autorizadas para emitir garantías o estar consideradas en la última lista de bancos extranjeros de primera categoría que periódicamente publica el Banco Central de Reserva del Perú.
4.4.2. La clasificadora de riesgo que asigna la clasificación a la empresa que emite la garantía debe encontrarse listada en el portal web de la SBS (http://www.sbs.gob.pe/sistema-financiero/clasificadoras-de-riesgo).
4.4.3. Se debe identificar en la página web de la clasificadora de riesgo respectiva, cuál es la clasificación vigente de la empresa que emite la garantía, considerando la vigencia a la fecha de emisión de la garantía. Para fines de lo establecido en el artículo 61 de la Ley, se requiere la clasificación de riesgo B o superior.
4.4.4. Si la empresa que otorga la garantía cuenta con más de una clasificación de riesgo emitida por distintas empresas listadas en la sede digital de la SBS, basta que en una de ellas cumpla con la clasificación mínima establecida en la Ley.
4.4.5. En caso exista alguna duda sobre la clasificación de riesgo asignada a la empresa emisora de la garantía, se debe consultar a la clasificadora de riesgos respectiva.
4.4.6. Además de cumplir con el requisito referido a la clasificación de riesgo, a efectos de verificar si la empresa emisora se encuentra autorizada por la SBS para emitir garantías, debe revisarse la sede digital de dicha entidad (http://www.sbs.gob.pe/sistema-financiero/relacion-de-empresas-que-se-encuentran-autorizadas-a-emitir-cartas-fianza).

4.5 CONSIDERACIONES PARA LOS DOCUMENTOS EXTENDIDOS EN EL EXTRANJERO
En el caso que los documentos requeridos para el perfeccionamiento del contrato incluyan documentos públicos extendidos en el exterior, que no les sea aplicable el Convenio de la Apostilla, se debe tener en cuenta que, de conformidad con lo previsto en el artículo 137 del Reglamento Consular del Perú, aprobado mediante Decreto Supremo N° 032-2023-RE, para que estos surtan efectos legales en el Perú deben estar legalizados por los funcionarios consulares peruanos competentes, cuyas firmas deben ser autenticadas posteriormente por el área competente del órgano de línea consular, además de cumplir con los requisitos adicionales que contemple la legislación peruana para su validez en el Perú. Cuando se trate de documentos privados extendidos en el exterior, el funcionario consular sólo legaliza las firmas cuando hayan sido suscritas en su presencia o cuando conste de modo indubitable su autenticidad, verificando en ambos casos la identidad de los firmantes, conforme lo requiere el artículo 138 del citado Reglamento.

4.6 DISPOSICIONES FINALES
Todos los demás aspectos del presente procedimiento de selección no contemplados en las bases se rigen por la Ley y su Reglamento, así como por las disposiciones legales vigentes.
`.trim();

// Transcrita a mano leyendo el texto de capa del PDF oficial de "obras"
// (actuaciones-preparatorias/bases/7614342-5-bases-estandar-licitacion-publica-de-obras.pdf),
// mismo método que SECCION_GENERAL_BIENES. Misma advertencia de fidelidad.
const SECCION_GENERAL_OBRAS = `
CAPÍTULO I
ASPECTOS GENERALES

1.1. REFERENCIAS
Cuando en el presente documento se mencione la palabra "Ley", se entiende que se está haciendo referencia a la Ley N° 32069, Ley General de Contrataciones Públicas, y cuando se mencione la palabra "Reglamento", se entiende que se está haciendo referencia al Reglamento de la Ley N° 32069, Ley General de Contrataciones Públicas, aprobado por Decreto Supremo N° 009-2025-EF. Las referidas normas incluyen sus respectivas modificaciones, de ser el caso.

1.2. ALCANCE
La presente base estándar es utilizada por la entidad contratante para la contratación de obras bajo los sistemas de entrega de: (i) solo construcción; o, (ii) diseño y construcción, según la cuantía establecida en la Ley de Presupuesto del Sector Público para el Año Fiscal correspondiente (en tanto se implementen los procedimientos de selección de licitación pública de obras con precalificación no resulta aplicable el límite del monto correspondiente a S/ 79 000 000,00 — setenta y nueve millones y 00/100 soles). Esta base estándar no es aplicable para la suscripción de contratos estandarizados de ingeniería y construcción de uso internacional (en estos casos se debe utilizar la base estándar correspondiente; la Decimocuarta Disposición Complementaria Transitoria del Reglamento señala que la implementación de los contratos estandarizados de ingeniería y construcción de uso internacional es progresiva y se realiza mediante pilotos, de acuerdo con lo definido por la Dirección General de Abastecimiento).

CAPÍTULO II
DESARROLLO DEL PROCEDIMIENTO DE SELECCIÓN

2.1. ETAPAS DE LA LICITACIÓN PÚBLICA DE OBRAS
Los evaluadores del procedimiento de selección pueden ser comité o jurado: en caso la entidad contratante haya designado un comité para conducir el procedimiento de selección, este se encarga de la evaluación de las ofertas de los postores de forma colegiada, siendo solidariamente responsables por dicha evaluación, salvo que dejen constancia de su voto en discordia en el acta correspondiente con el respectivo sustento. En caso la entidad contratante haya designado un jurado para la evaluación de las ofertas de los postores, la DEC se encarga de la recepción de las ofertas, de la revisión de los documentos para la admisión y los requisitos de calificación de las ofertas; así como de su remisión a cada uno de los expertos que conforman el jurado, quienes realizan individualmente la evaluación técnica y económica de las mismas y remiten los puntajes asignados a la DEC para su publicación y otorgamiento de la buena pro.

Las etapas del presente procedimiento de selección son las siguientes (de conformidad con el numeral 27.1 del artículo 27 de la Ley, la facultad para actuar discrecionalmente se fundamenta en el rigor técnico empleado por los funcionarios y servidores, dependencias y unidades de organización encargadas de las contrataciones públicas para optar por la mejor decisión debidamente sustentada que permita el cumplimiento oportuno de los fines públicos):

a) Convocatoria:
1. Se realiza a través del SEACE de la Pladicop en la fecha señalada en el cronograma.
2. Tratándose de procedimientos de selección para la ejecución de obras bajo el sistema de entrega de solo construcción, adicionalmente a los requisitos establecidos en el artículo 63 del Reglamento, es requisito contar con el expediente técnico aprobado y la disponibilidad física del terreno.
3. La cuantía de la contratación se publica en la convocatoria, según corresponda al sistema de entrega.
(Artículos 63, 64, 163 y 166 del Reglamento.)

b) Registro de participantes. Aplica lista abierta, por lo que cualquier proveedor puede registrarse como participante en el procedimiento de selección. (Artículos 65 y 93 del Reglamento.)

c) Cuestionamientos a las bases (consultas, observaciones e integración):
1. La presentación de consultas y/u observaciones se realiza en un plazo no menor a siete días hábiles contabilizados desde el día siguiente de la convocatoria.
2. La absolución de los referidos cuestionamientos y la publicación de las bases integradas se realiza en la fecha prevista en el cronograma del procedimiento de selección (en el caso de obras bajo el sistema de entrega de solo construcción, en caso la modificación del requerimiento como producto de las consultas u observaciones implique el replanteo del expediente técnico, los evaluadores remiten la consulta u observación al órgano encargado de la elaboración, aprobación o conformidad de los expedientes técnicos en la entidad contratante, para su opinión técnica, previo a realizar cualquier modificación o solicitar la no objeción del área usuaria, de acuerdo con el numeral 66.5 del artículo 66 del Reglamento).
3. El pliego de absolución de consultas y observaciones, así como las bases integradas pueden ser cuestionadas por los participantes, para su elevación ante el OECE, dentro de los tres días hábiles siguientes de publicado el pliego de absolución de consultas y observaciones e integración de bases. La entidad contratante realiza la elevación de conformidad con la directiva del OECE.
4. La entidad contratante solo puede omitir la elevación al OECE del pliego de absolución de consultas y observaciones y las bases integradas en caso se haya utilizado la herramienta de difusión del requerimiento en la interacción con el mercado.
(Artículos 51, 62, 66, 67 y 93 del Reglamento.)

d) Evaluación de ofertas técnicas y económicas:
1. La presentación de ofertas se realiza a través del SEACE de la Pladicop desde las 00:01 hasta las 23:59 horas (hora peruana) de la fecha prevista en el cronograma del procedimiento de selección. Dicha fecha no puede ser fijada en menos de siete días hábiles desde la publicación de la integración de bases o el pronunciamiento con la integración definitiva de bases por parte del OECE.
2. La presentación de ofertas se realiza adjuntando el archivo digitalizado que contenga los documentos que la conforman, según lo requerido en las bases (los formularios electrónicos del SEACE de la Pladicop que los participantes deben registrar para presentar sus ofertas, tienen carácter de declaración jurada).
3. La evaluación de ofertas es SIN PRECALIFICACIÓN y consiste en:
   a. Admisión de las ofertas: los evaluadores o la DEC, según corresponda, revisan que la oferta contenga los documentos señalados en el Capítulo II de la Sección Específica de las bases, caso contrario la oferta se considera no admitida.
   b. Revisión de los requisitos de calificación: los evaluadores o la DEC, según corresponda, califican a los postores verificando que cumplan con los requisitos de calificación detallados en el Capítulo III de la Sección Específica de las bases. Caso contrario, la oferta se considera descalificada.
   c. Evaluación de ofertas técnicas: los evaluadores aplican los factores de evaluación previstos en el Capítulo IV de la Sección Específica de las bases a las ofertas que cumplen los requisitos de calificación.
   d. Evaluación de ofertas económicas: la evaluación de la oferta económica es posterior a la evaluación técnica y solo respecto de aquellos proveedores que hubieran obtenido o superado el puntaje mínimo en la evaluación técnica.
4. En los procedimientos de selección de obras bajo sistema de entrega de solo construcción, la cuantía de la contratación determinada en el expediente técnico es punto de referencia para las ofertas. En la estrategia de contratación se puede optar entre dos métodos de evaluación de ofertas:
   a. Oferta económica limitada: la oferta económica de los postores debe encontrarse en el rango entre el 95% y 110% de la cuantía de la contratación. Este rango se calcula considerando dos (2) decimales. Para ello, si el límite inferior tiene más de dos (2) decimales, se aumenta en un dígito el valor del segundo decimal; en el caso del límite superior, se considera el valor del segundo decimal, en ambos casos, sin efectuar el redondeo matemático. Los evaluadores descalifican las propuestas que no cumplan el referido rango.
   b. Oferta económica fija al 100%: la oferta económica de los postores corresponde al 100% de la cuantía de la contratación. En este caso, solo se realiza la evaluación técnica de las ofertas, sobre cien puntos.
5. En los procedimientos de selección de obras bajo el sistema de entrega de diseño y construcción, la cuantía de la contratación señalada en las bases es punto de referencia para cada componente. La oferta económica contiene: i) el monto ofertado para el componente de ejecución de obra, que es fijo al 100%; ii) el monto ofertado para el componente de diseño, que no debe ser menor al 90% de su cuantía y cuya evaluación se realiza sobre cien puntos.
6. Todos los actos se realizan a través del SEACE de la Pladicop, incluyendo la subsanación de ofertas.
(Artículos 68, 70, 71, 72, 73, 74, 75, 78, 165 y 166 del Reglamento.)

Oferta económica de mejor puntaje que supera la cuantía de la contratación: en caso la oferta económica del postor que obtiene el mejor puntaje total supere la cuantía de la contratación, se siguen los siguientes pasos, de conformidad con el artículo 167 del Reglamento:
i. La DEC gestiona la solicitud de la ampliación de la certificación de crédito presupuestario y/o previsión presupuestal correspondiente. De otorgarse la ampliación, se procede a adjudicar la buena pro.
ii. De no contar con la ampliación de la certificación de crédito presupuestario o previsión presupuestal, los evaluadores negocian con el postor que obtuvo el mejor puntaje total, conforme al numeral 167.1 del artículo 167 del Reglamento, en el siguiente orden: a) la reducción de su oferta económica (en el caso del sistema de entrega de diseño y construcción, solo puede negociarse la reducción del componente materia de calificación, es decir del componente diseño); b) la reducción de determinadas prestaciones o condiciones del requerimiento, previa no objeción del área usuaria. No pueden negociarse las condiciones que dieron lugar al otorgamiento de puntaje en los factores de evaluación correspondientes a la oferta técnica o aquellos establecidos como no negociables en el requerimiento. La finalidad pública de la contratación no debe ser afectada.
iii. En caso el postor con el mejor puntaje no acepte la reducción del monto o la reducción de las prestaciones o condiciones del requerimiento, se procede a negociar con los siguientes postores en el orden de prelación que obtuvieron. Si el postor que sigue en el orden de prelación ofertó un monto igual o menor al de la cuantía de la contratación, se le adjudica la buena pro.
iv. En caso el postor que obtuvo el mejor puntaje total reduzca su oferta económica pero la reducción no se encuentre dentro de la cuantía de la contratación, se solicita la ampliación de la certificación de crédito presupuestario y/o previsión presupuestal correspondiente. En caso se otorgue la ampliación, se adjudica la buena pro. Caso contrario, se puede optar por: negociar con los siguientes postores (siempre que hayan obtenido el puntaje mínimo en la evaluación técnica) en el orden de prelación o declarar desierto el procedimiento de selección.
v. Las decisiones adoptadas por los evaluadores en la negociación constan en actas que se publican en el SEACE de la Pladicop y se sustentan en el principio de valor por dinero, priorizando el cumplimiento de la finalidad pública de la contratación.

e) Otorgamiento de la buena pro:
1. Determinada la oferta ganadora, los evaluadores o la DEC, según corresponda, otorgan la buena pro mediante su publicación en el SEACE de la Pladicop, incluyendo los documentos que sustenten los resultados de la admisión, calificación, evaluación y el otorgamiento de la buena pro.
2. En caso de haber sorteo por desempate, éste se realiza a través del SEACE de la Pladicop.
3. En caso se hayan presentado dos o más ofertas, el consentimiento de la buena pro se produce y registra a través del SEACE de la Pladicop al día siguiente de vencido el plazo correspondiente para interponer recurso de apelación, sin que los postores hayan ejercido el derecho de interponer dicho recurso.
4. En caso se haya presentado una sola oferta, el consentimiento de la buena pro se produce el mismo día de la notificación de su otorgamiento y se registra en el SEACE de la Pladicop al día siguiente.
(Artículos 80, 81, 82, 83 y 84 del Reglamento.)

2.2. CONSIDERACIONES PARA TODOS LOS PROVEEDORES:
2.2.1. Para registrarse como participante en un procedimiento de selección convocado por una entidad contratante es necesario que los proveedores cuenten con inscripción vigente ante el Registro Nacional de Proveedores (RNP) que administra el Organismo Especializado para las Contrataciones Públicas Eficientes (OECE) en el registro correspondiente al objeto del procedimiento de selección. Para obtener mayor información se puede ingresar a la siguiente dirección electrónica: www.rnp.gob.pe.
2.2.2. Los proveedores que deseen registrar su participación deben ingresar al SEACE de la Pladicop utilizando su certificado (usuario y contraseña).
2.2.3. No pueden formularse consultas ni observaciones respecto del contenido de una ficha de homologación aprobada, aun cuando el requerimiento haya sido estandarizado parcialmente respecto de las características técnicas, requisitos de calificación y/o condiciones de ejecución. Las consultas y observaciones que se formulen sobre el particular se tienen como no presentadas.
2.2.4. Las declaraciones juradas, formatos o formularios previstos en las bases que conforman la oferta deben estar debidamente firmados por el postor (firma manuscrita o digital, según la Ley Nº 27269, Ley de Firmas y Certificados Digitales). No se acepta insertar la imagen de una firma. El postor, el representante legal o común, apoderado o mandatario designado se hace responsable de la totalidad de los documentos incluidos en la oferta. El postor es responsable de verificar, antes de su envío, que el archivo pueda ser descargado y su contenido sea legible. En caso la información contenida en los documentos que conforman la oferta no coincida con lo declarado a través del SEACE de la Pladicop, prevalece la información declarada en los documentos de la oferta.

Advertencia: en caso el proveedor emplee la firma digital como una única firma en los documentos que conforman la oferta, esta es suficiente para que el documento sea considerado firmado legalmente.

2.2.5. En caso que al registrarse como participante el proveedor presente una declaración jurada de desafectación del impedimento debido al parentesco establecido en el inciso 2 del numeral 30.1 del artículo 30 de la Ley, debe presentar adicionalmente para la admisión de su oferta la acreditación documental de su condición de desafectación conforme a lo indicado en el literal f) del numeral 2.2.1.1. del Capítulo II de la Sección Específica de las bases.

2.3. CONSIDERACIONES ADICIONALES PARA LOS CONSORCIOS:
2.3.1. En el caso de consorcios, en el sistema de entrega de diseño y construcción, basta que uno de sus integrantes se haya registrado como participante en el procedimiento de selección, supuesto en el cual dicho integrante debe contar con inscripción vigente en el RNP como consultor y/o ejecutor de obras. En el sistema de entrega de solo construcción, de manera similar, el integrante debe contar con inscripción vigente en el RNP como ejecutor de obras. Los demás integrantes del consorcio deben contar con inscripción vigente en el RNP en las demás etapas del procedimiento de selección. No se considera consorcio a la asociación de personas de duración ilimitada o indefinida que, denominándose consorcios, han sido constituidas como personas jurídicas en los Registros Públicos.
2.3.2. Los integrantes de un consorcio no pueden presentar ofertas individuales ni conformar más de un consorcio en un procedimiento de selección o en un determinado ítem, cuando se trate de procedimientos de selección según relación de ítems. En este segundo supuesto, los integrantes del consorcio pueden participar en ítems distintos a aquel en el que se presentaron en consorcio, sea en forma individual o en consorcio.
2.3.3. Como parte de los documentos de su oferta el consorcio debe presentar la promesa de consorcio con firmas digitales de todos sus integrantes o, en su defecto, firmas legalizadas, de ser el caso, conforme a lo establecido en el literal d) del numeral 69.1 del artículo 69 del Reglamento. La promesa de consorcio debe considerar, como mínimo, lo siguiente:
a) La identificación de los integrantes del consorcio. Se debe precisar el nombre completo o la denominación o razón social de los integrantes del consorcio, según corresponda.
b) La designación del representante común del consorcio.
c) El domicilio común del consorcio.
d) El correo electrónico común del consorcio, al cual se dirigirán todas las comunicaciones remitidas por la entidad contratante al consorcio durante el proceso de contratación, siendo éste el único válido para todos los efectos.
e) Las obligaciones que correspondan a cada uno de los integrantes del consorcio.
f) El porcentaje del total de las obligaciones de cada uno de los integrantes, respecto del objeto del contrato. Dicho porcentaje debe ser expresado en número entero, sin decimales.
2.3.4. La información contenida en los literales a), e) y f) precedentes no puede ser modificada con ocasión de la suscripción del contrato de consorcio, ni durante la etapa de ejecución contractual. En tal sentido, no cabe variación alguna en la conformación del consorcio, por lo que no es posible que se incorpore, sustituya o separe a un integrante.
2.3.5. El representante común tiene facultades para actuar en nombre y representación del consorcio, en todos los actos referidos al procedimiento de selección, suscripción y ejecución del contrato, con poderes suficientes para ejercitar los derechos y cumplir las obligaciones que se deriven de su calidad de postor y de contratista hasta la conformidad o liquidación del contrato, según corresponda. El representante común no debe encontrarse impedido, inhabilitado ni suspendido para contratar con el Estado. Para cambiar al representante común, todos los integrantes del consorcio deben firmar (mediante firmas legalizadas o firmas digitales) el documento en el que conste el acuerdo, el cual surte efectos cuando es notificado a la entidad contratante.
2.3.6. Las declaraciones juradas, formatos o formularios previstos en las bases que conforman la oferta deben estar debidamente firmados por el representante común, por todos los integrantes del consorcio o de forma independiente por cada consorciado, según corresponda (firma manuscrita o digital, según la Ley Nº 27269, Ley de Firmas y Certificados Digitales). En el caso de los documentos que deban suscribir todos los integrantes del consorcio, la firma es seguida de la razón social o denominación de cada uno de ellos. Lo mismo aplica en caso deban ser suscritos en forma independiente por cada integrante del consorcio, de acuerdo con lo establecido en los documentos del procedimiento de selección. En el caso de un consorcio integrado por una persona natural, basta que la persona natural indique debajo de su firma, sus nombres y apellidos completos.
2.3.7. La acreditación del requisito de calificación de la experiencia del postor se realiza en base a la documentación aportada por los integrantes del consorcio que se hubieran comprometido a ejecutar conjuntamente las obligaciones vinculadas directamente con el objeto materia de la contratación, de acuerdo con lo declarado en la promesa de consorcio. Para ello se debe seguir los siguientes pasos:
a) Primer paso: obtener el monto de facturación por cada integrante del consorcio, el cual se obtiene de la sumatoria de montos facturados por éste que, a criterio del evaluador, han sido acreditados conforme a las bases, correspondiente a las contrataciones ejecutadas en forma individual y/o consorcio. En caso un integrante del consorcio presente facturación de contrataciones ejecutadas en consorcio, se considera el monto que corresponda al porcentaje de las obligaciones del referido integrante del consorcio. Este porcentaje debe estar consignado expresamente en la promesa o en el contrato de consorcio, de lo contrario, no se considera la experiencia ofertada en consorcio.
b) Segundo paso: verificar si el integrante del consorcio que acredita la mayor experiencia cumple con un determinado porcentaje de participación. En caso la entidad contratante haya establecido en las bases un porcentaje determinado de participación en la ejecución del contrato, para el integrante del consorcio que acredite mayor experiencia, debe verificarse que éste cumple con dicho parámetro a efectos de considerar su experiencia. En el caso de obras bajo los sistemas de entrega de solo construcción, y diseño y construcción, la mayor experiencia se refiere a la experiencia en las subespecialidades de obras.
c) Tercer paso: sumatoria de experiencia de los consorciados. Para obtener la experiencia del consorcio se suma el monto de facturación aportado por cada integrante que cumple con lo señalado previamente.
2.3.8. Para calificar la experiencia del postor no se toma en cuenta la documentación presentada por el o los consorciados que asumen las obligaciones referidas a las siguientes actividades: i) actividades de carácter administrativo o de gestión como facturación, financiamiento, aporte de garantías, entre otras; ii) actividades relacionadas con asuntos de organización interna, tales como representación u otros aspectos que no se relacionan con la ejecución de las prestaciones, entre otras.
2.3.9. En el caso de obras convocadas bajo el sistema de entrega de solo construcción, todos los integrantes del consorcio deben contar con inscripción vigente en el RNP como ejecutores de obra.
2.3.10. En el caso de obras convocadas bajo el sistema de entrega de diseño y construcción, los integrantes del consorcio deben contar con inscripción vigente en el RNP como consultores o ejecutores de obra, según la obligación asumida en la promesa de consorcio, conforme a lo siguiente: i) los integrantes del consorcio que se hayan obligado a ejecutar el componente de diseño deben encontrarse inscritos como consultores de obra en la categoría de "Elaboración del expediente técnico de obras" del RNP; asimismo, en atención a la Cuarta Disposición Complementaria Transitoria del Reglamento, cada integrante del consorcio que se obligue a elaborar el expediente técnico debe contar con la especialidad y categoría que corresponda; ii) los integrantes del consorcio que se hayan obligado a ejecutar el componente de obra deben contar con inscripción vigente en el RNP como ejecutores de obra.
2.3.11. En caso el consorcio resulte favorecido con la buena pro, cada integrante del consorcio debe contar con capacidad libre de contratación igual o superior al porcentaje equivalente al monto de sus obligaciones consideradas en la promesa de consorcio.
2.3.12. Los integrantes del consorcio son responsables de que su inscripción en el RNP se encuentre vigente, así como de no estar inhabilitados o suspendidos al registrarse como participantes, a la presentación de ofertas, al otorgamiento de la buena pro y al perfeccionamiento del contrato.
2.3.13. Los integrantes de un consorcio se encuentran obligados solidariamente a responder frente a la entidad contratante por los efectos patrimoniales que ésta sufra como consecuencia de la actuación de dichos integrantes, ya sea individual o conjunta, durante el procedimiento de selección y la ejecución contractual.

CAPÍTULO III
RECURSO DE APELACIÓN

3.1. ACCESO AL EXPEDIENTE DE CONTRATACIÓN
Una vez otorgada la buena pro, la DEC está en la obligación de permitir el acceso de los participantes y postores al expediente de contratación, con excepción de la información calificada como secreta, confidencial o reservada por la normativa de la materia y de aquella correspondiente a las ofertas que no fueron admitidas, a más tardar dentro del día hábil siguiente de haberse solicitado por escrito. A efectos de recoger la información de su interés, los participantes y postores pueden valerse de distintos medios, tales como: (i) la lectura y/o toma de apuntes, (ii) la captura y almacenamiento de imágenes, e incluso (iii) pueden solicitar copia de la documentación obrante en el expediente, siendo que, en este último caso, la entidad contratante debe entregar dicha documentación en el menor tiempo posible, previo pago de la tasa por tal concepto previsto en el Texto Único de Procedimientos Administrativos (TUPA) de la respectiva entidad contratante.

3.2. RECURSO DE APELACIÓN
A través del recurso de apelación se pueden impugnar los actos dictados durante el desarrollo del procedimiento de selección hasta antes del perfeccionamiento del contrato, incluyendo aquellos que declaren la nulidad de oficio, la cancelación del procedimiento de selección y otros actos emitidos por la entidad contratante que afecten la continuidad de éste. El recurso de apelación se presenta ante la mesa de partes digital o física del Tribunal de Contrataciones Públicas y es resuelto por este.

3.3. PLAZOS DE INTERPOSICIÓN DEL RECURSO DE APELACIÓN
La apelación contra el otorgamiento de la buena pro o contra los actos dictados con anterioridad a ella se interpone, como máximo, dentro de los ocho días hábiles siguientes de haberse notificado el otorgamiento de la buena pro a través del SEACE de la Pladicop. En el caso de la apelación contra los actos dictados con posterioridad al otorgamiento de la buena pro, contra la declaración de nulidad, cancelación y declaratoria de desierto del procedimiento de selección, el plazo indicado en el párrafo precedente se contabiliza desde que se toma conocimiento del acto que se desea impugnar. Se considera que se ha tomado conocimiento en el día de la publicación en el SEACE de la Pladicop del acto que se desea impugnar.

CAPÍTULO IV
DEL CONTRATO

4.1. REQUISITOS PARA EL PERFECCIONAMIENTO DEL CONTRATO
Para perfeccionar el contrato, el postor o postores ganadores de la buena pro presentan los siguientes requisitos de conformidad con el artículo 88 del Reglamento:

a) Garantías, salvo casos de excepción.
El postor ganador de la buena pro presenta una garantía de fiel cumplimiento por una suma equivalente al 10% del monto del contrato original. La garantía de fiel cumplimiento puede ser: (i) fideicomiso, (ii) carta fianza financiera, (iii) contrato de seguro, o (iv) retención de pago. La retención de pago como garantía de fiel cumplimiento aplica para contrataciones cuya cuantía adjudicada sea igual o menor a S/ 5 000 000,00 (cinco millones y 00/100 soles). En el caso de las micro y pequeñas empresas estas pueden otorgar como garantía de fiel cumplimiento la retención de pago con independencia de la cuantía de la contratación.
(Numerales 61.4 y 61.5 del artículo 61 de la Ley. Literal a) del numeral 88.1 del artículo 88 y los artículos 113, 114, 115 y 116 del Reglamento.)

b) Contrato de consorcio, de ser el caso.
El contrato de consorcio debe cumplir con los siguientes requisitos: a. Contener la información indicada en el numeral 2.3.3 del Capítulo II de la Sección General de las presentes bases. b. Identificar al integrante del consorcio a quien se efectúa el pago y emite la respectiva factura o, en caso de llevar contabilidad independiente, señalar el número de Registro Único de Contribuyente (RUC) del consorcio. c. Consignar las firmas legalizadas ante notario público de cada uno de los integrantes del consorcio, de sus apoderados o de sus representantes legales, según corresponda.
Lo indicado no excluye la información adicional que pueda consignarse en el contrato de consorcio con el objeto de regular su administración interna, como es el régimen y los sistemas de participación en los resultados del consorcio, al que se refiere el artículo 448 de la Ley N° 26887, Ley General de Sociedades. En ningún caso puede aceptarse la presentación de la promesa de consorcio que fue parte de la oferta, independientemente de que dicha promesa contenga firmas legalizadas ante notario público.
(Literal b) del numeral 88.1 del artículo 88 y el artículo 89 del Reglamento.)

c) Código de cuenta interbancaria (CCI) o, en el caso de proveedores no domiciliados, el número de cuenta bancaria y nombre de la entidad bancaria en el exterior.
El CCI es requisito indispensable para realizar una transferencia entre cuentas de bancos diferentes, siendo requerido para efectuar el pago a los proveedores domiciliados en el Perú. Para los proveedores no domiciliados, corresponde el número de cuenta bancaria y nombre de la entidad bancaria en el exterior.
(Artículo 67 de la Ley. El literal c) del numeral 88.1 del 88 y los artículos 213 y 215 del Reglamento.)

d) Documento que acredite que cuenta con facultades para perfeccionar el contrato, cuando corresponda.
Corresponde a la vigencia del poder del representante legal que acredite que cuenta con facultades para perfeccionar el contrato, en caso el postor sea persona jurídica. Adicionalmente, el representante legal presenta copia de su documento de identidad (DNI o carné de extranjería, según corresponda). En el caso de personas naturales, se solicita copia de su documento de identidad (DNI o carné de extranjería, según corresponda). En el caso de consorcios, estos documentos deben ser presentados por cada uno de los integrantes que suscribieron la promesa de consorcio, según corresponda. Asimismo, debe presentarse copia del documento de identidad (DNI o carné de extranjería, según corresponda) del representante común del consorcio.
(Literal d) del numeral 88.1 del artículo 88 del Reglamento.)

e) Institución Arbitral elegida del listado de instituciones arbitrales propuesto por la entidad contratante o propuesta de tres instituciones arbitrales del postor.
Este requisito es obligatorio para todos los contratos que superen las 10 UIT (de conformidad con el numeral 84.1 del artículo 84 de la Ley, el arbitraje puede ser ad hoc solo en los casos en los que el monto de la controversia no supere las 10 UIT). Desde el 1 de enero de 2026, la institución arbitral elegida debe encontrarse inscrita en el Registro de Instituciones Arbitrales y Centros de Administración de Juntas de Prevención y Resolución de Disputas (REGAJU).
(Artículos 77, 83 y 84, así como la Décima Disposición Complementaria Transitoria de la Ley. El literal e) del numeral 88.1 del artículo 88 del Reglamento.)

f) Centro de administración de la JPRD elegido del listado de centros de administración propuesto por la entidad contratante o propuesta de tres centros de administración de la JPRD del postor.
Las JPRD son obligatorias en los contratos de obra cuyos montos sean iguales o superiores a S/ 10 000 000,00 (diez millones y 00/100 soles). Son facultativas para contratos cuyos montos sean inferiores al monto previamente señalado. No puede establecerse JPRD en los casos de obras cuyos montos sean inferiores a S/ 5 000 000,00 (cinco millones y 00/100 soles).
(Artículos 77 y 79 de la Ley. Décima Disposición Complementaria Transitoria de la Ley. Artículos 88 y 346 del Reglamento.)

g) Capacidad Técnica y Profesional.
Comprende la experiencia y calificaciones del personal clave (pueden ser considerados personal clave los profesionales especialistas que son esenciales para elaborar el expediente técnico o ejecutar la obra; no son personal clave aquellos que brinden labores de asistencia administrativa o técnica, labores operativas o laboren como obreros), así como el equipamiento estratégico y/o infraestructura estratégica del proveedor necesario para la ejecución del contrato. La experiencia del personal clave corresponde a la especialidad y subespecialidad de la obra. La capacidad técnica y profesional es verificada por la DEC para la suscripción del contrato. Solo debe presentar la acreditación del personal clave en la oferta en caso se haya elegido el factor de evaluación experiencia específica adicional del personal clave.
(Literal b) del numeral 72.3 del artículo 72 y literal g) del numeral 88.1 del artículo 88 del Reglamento.)

h) Plan de trabajo.
El plan de trabajo se presenta para el perfeccionamiento del contrato solo cuando no haya sido evaluado como parte del factor de evaluación de planificación detallada durante el procedimiento de selección. Este plan incluye una memoria descriptiva señalando las consideraciones que se han tomado en cuenta para su elaboración.
(Literal a) del artículo 168 del Reglamento.)

i) Constancia de Capacidad de Libre Contratación (CCLC) del ejecutor de obra expedida por el RNP.
El postor debe presentar la Constancia de Capacidad Libre de Contratación - CCLC de ejecutor de obra, en los sistemas de entrega de solo construcción y diseño y construcción.
(Literal b) del artículo 168 del Reglamento.)

4.2. PERFECCIONAMIENTO DEL CONTRATO
4.2.1. El postor ganador de la buena pro debe presentar los requisitos para perfeccionar el contrato dentro del plazo de ocho o cinco días hábiles, según corresponda, plazo que se contabiliza desde el día siguiente del registro del consentimiento de la buena pro en el SEACE de la Pladicop o desde que esta haya quedado administrativamente firme, de conformidad con el procedimiento y plazos dispuestos en los artículos 88, 89, 90, 91 y 168 del Reglamento.
4.2.2. El contrato se suscribe mediante firma digital, siempre que el postor ganador de la buena pro cuente con certificado digital emitido por una entidad de certificación, de acuerdo con la normativa de la materia; caso contrario, se suscribe manualmente.
4.2.3. De conformidad con el numeral 87.3 del artículo 87 del Reglamento, excepcionalmente, la entidad contratante puede sustentar la imposibilidad de suscribir el contrato mediante firma digital, supuesto en el cual la suscripción se realiza manualmente.

4.3. CONSIDERACIONES PARA LOS CONSORCIOS
4.3.1. Las garantías que presenten los consorcios para el perfeccionamiento del contrato, durante la ejecución contractual y para la interposición de los recursos impugnativos, además de cumplir con las condiciones establecidas en la Ley y el Reglamento, deben consignar expresamente el nombre completo o la denominación o razón social de los integrantes del consorcio, en calidad de garantizados, de lo contrario no pueden ser aceptadas por las entidades contratantes o el Tribunal de Contrataciones Públicas. No se cumple el requisito antes indicado si se consigna únicamente la denominación del consorcio.
4.3.2. La retención del 10% del monto del contrato original en calidad de garantía de fiel cumplimiento aplica cuando la cuantía adjudicada sea igual o menor a S/ 5 000 000,00 (cinco millones y 00/100 soles). En el caso de micro o pequeñas empresas que hayan declarado en su oferta tal condición, no aplica dicho umbral, según lo señalado en el artículo 114 del Reglamento. En caso de consorcio, aplica dicha retención si todos sus integrantes declaran en su oferta la condición de micro o pequeña empresa.

4.4. CONSIDERACIONES PARA LAS GARANTÍAS FINANCIERAS
4.4.1. En caso de garantías financieras, estas deben ser incondicionales, solidarias, irrevocables y de realización automática en el país, al solo requerimiento de la respectiva entidad contratante bajo responsabilidad de las empresas que las emiten. Las empresas que emitan garantías financieras deben encontrarse bajo la supervisión directa de la Superintendencia de Banca, Seguros y Administradoras Privadas de Fondos de Pensiones, contar con clasificación de riesgo B o superior, y deben estar autorizadas para emitir garantías o estar consideradas en la última lista de bancos extranjeros de primera categoría que periódicamente publica el Banco Central de Reserva del Perú.
4.4.2. La clasificadora de riesgo que asigna la clasificación a la empresa que emite la garantía debe encontrarse listada en el portal web de la SBS (http://www.sbs.gob.pe/sistema-financiero/clasificadoras-de-riesgo).
4.4.3. Se debe identificar en la página web de la clasificadora de riesgo respectiva, cuál es la clasificación vigente de la empresa que emite la garantía, considerando la vigencia a la fecha de emisión de la garantía. Para fines de lo establecido en el artículo 61 de la Ley, se requiere la clasificación de riesgo B o superior.
4.4.4. Si la empresa que otorga la garantía cuenta con más de una clasificación de riesgo emitida por distintas empresas listadas en la sede digital de la SBS, bastará que en una de ellas cumpla con la clasificación mínima establecida en la Ley.
4.4.5. En caso exista alguna duda sobre la clasificación de riesgo asignada a la empresa emisora de la garantía, se debe consultar a la clasificadora de riesgos respectiva.
4.4.6. Además de cumplir con el requisito referido a la clasificación de riesgo, a efectos de verificar si la empresa emisora se encuentra autorizada por la SBS para emitir garantías, debe revisarse la sede digital de dicha entidad (http://www.sbs.gob.pe/sistema-financiero/relacion-de-empresas-que-se-encuentran-autorizadas-a-emitir-cartas-fianza).

4.5. CONSIDERACIONES PARA LOS DOCUMENTOS EXTENDIDOS EN EL EXTRANJERO
En el caso que los documentos requeridos para el perfeccionamiento del contrato incluyan documentos públicos extendidos en el exterior, que no les sea aplicable el Convenio de la Apostilla, se debe tener en cuenta que, de conformidad con lo previsto en el artículo 137 del Reglamento Consular del Perú, aprobado mediante Decreto Supremo N° 032-2023-RE, para que estos surtan efectos legales en el Perú deben estar legalizados por los funcionarios consulares peruanos competentes, cuyas firmas deben ser autenticadas posteriormente por el área competente del órgano de línea consular, además de cumplir con los requisitos adicionales que contemple la legislación peruana para su validez en el Perú. Cuando se trate de documentos privados extendidos en el exterior, el funcionario consular sólo legaliza las firmas cuando hayan sido suscritas en su presencia o cuando conste de modo indubitable su autenticidad, verificando en ambos casos la identidad de los firmantes, conforme lo requiere el artículo 138 del citado Reglamento.

4.6. DISPOSICIONES FINALES
Todos los demás aspectos del presente procedimiento de selección no contemplados en las bases se rigen por la Ley y su Reglamento, así como por las disposiciones legales vigentes.
`.trim();

// Transcrita a mano leyendo el texto de capa del PDF oficial de "servicios"
// (actuaciones-preparatorias/bases/7614342-8-bases-estandar-concurso-publico-de-servicios.pdf),
// mismo método que las anteriores. Misma advertencia de fidelidad.
//
// Es, en su mayor parte, el mismo texto que SECCION_GENERAL_BIENES con
// "bienes" → "servicios" (confirmado leyendo el PDF, no asumido): comparten
// la misma "Disposiciones Comunes" del OECE. Las diferencias reales
// confirmadas: la base legal de la etapa de registro de participantes cita el
// artículo 94 (no el 93, que es de Licitación Pública); y el Capítulo IV
// termina en el literal e) "Institución Arbitral" — servicios NO tiene el
// literal f) de JPRD que sí tienen bienes y obras (la JPRD, según el propio
// Reglamento, solo aplica al suministro de bienes y a obras de cierto monto).
const SECCION_GENERAL_SERVICIOS = `
CAPÍTULO I
ASPECTOS GENERALES

1.1. REFERENCIAS
Cuando en el presente documento se mencione la palabra "Ley", se entiende que se está haciendo referencia a la Ley N° 32069, Ley General de Contrataciones Públicas, y cuando se mencione la palabra "Reglamento", se entiende que se está haciendo referencia al Reglamento de la Ley N° 32069, Ley General de Contrataciones Públicas, aprobado por Decreto Supremo N° 009-2025-EF. Las referidas normas incluyen sus respectivas modificaciones, de ser el caso.

1.2. ALCANCE
La presente base estándar es utilizada por la entidad contratante para la contratación de servicios en general, así como del ASISTE, según la cuantía establecida en la Ley de Presupuesto del Sector Público para el Año Fiscal correspondiente.

CAPÍTULO II
DESARROLLO DEL PROCEDIMIENTO DE SELECCIÓN

2.1 ETAPAS DEL CONCURSO PÚBLICO DE SERVICIOS
Las etapas del presente procedimiento de selección son las siguientes (de conformidad con el numeral 27.1 del artículo 27 de la Ley, la facultad para actuar discrecionalmente se fundamenta en el rigor técnico empleado por los funcionarios y servidores, dependencias y unidades de organización encargadas de las contrataciones públicas para optar por la mejor decisión debidamente sustentada que permita el cumplimiento oportuno de los fines públicos):

a) Convocatoria. Se realiza a través del SEACE de la Pladicop en la fecha señalada en el cronograma. (Artículos 63 y 64 del Reglamento.)

b) Registro de participantes. Aplica lista abierta, por lo que cualquier proveedor puede registrarse como participante en el procedimiento de selección. (Artículos 65 y 94 del Reglamento.)

c) Cuestionamientos a las bases (consultas, observaciones e integración):
1. La presentación de consultas y/u observaciones se realiza en un plazo no menor a siete días hábiles contabilizados desde el día siguiente de la convocatoria.
2. La absolución de los referidos cuestionamientos y la publicación de las bases integradas se realiza en la fecha prevista en el cronograma del procedimiento de selección.
3. El pliego de absolución de consultas y observaciones, así como las bases integradas pueden ser cuestionadas por los participantes, para su elevación ante el OECE, dentro de los tres días hábiles siguientes de publicado el pliego de absolución de consultas y observaciones e integración de bases. La entidad contratante realiza la elevación de conformidad con la directiva del OECE.
4. La entidad contratante solo puede omitir la elevación al OECE del pliego de absolución de consultas y observaciones y las bases integradas en caso haya utilizado la herramienta de difusión del requerimiento en la interacción con el mercado.
(Artículos 51, 62, 66, 67 y 94 del Reglamento.)

d) Evaluación de ofertas técnicas y económicas:
1. La presentación de ofertas se realiza a través del SEACE de la Pladicop desde las 00:01 hasta las 23:59 horas (hora peruana) de la fecha prevista en el cronograma del procedimiento de selección. Dicha fecha no puede ser fijada en menos de siete días hábiles desde la publicación de la integración de bases o el pronunciamiento con la integración definitiva de bases por parte del OECE.
2. La presentación de ofertas se realiza adjuntando el archivo digitalizado que contenga los documentos que la conforman, según lo requerido en las bases (los formularios electrónicos del SEACE de la Pladicop que los participantes deben registrar para presentar sus ofertas, tienen carácter de declaración jurada).
3. La evaluación de ofertas es SIN PRECALIFICACIÓN y consiste en:
   a. Admisión de las ofertas: los evaluadores revisan que la oferta contenga los documentos señalados en el Capítulo II de la Sección Específica de las bases, caso contrario la oferta se considera no admitida.
   b. Revisión de los requisitos de calificación: los evaluadores califican a los postores verificando que cumplan con los requisitos de calificación detallados en el Capítulo III de la Sección Específica de las bases. Caso contrario la oferta se considera descalificada.
   c. Evaluación de ofertas técnicas: los evaluadores aplican los factores de evaluación previstos en el Capítulo IV de la Sección Específica de las bases a las ofertas que cumplen los requisitos de calificación. En la Sección Específica se prevé un puntaje mínimo en la evaluación técnica para proceder a la evaluación económica de la oferta.
   d. Evaluación de ofertas económicas: la evaluación de la oferta económica es posterior a la evaluación de la oferta técnica y solo respecto de aquellos proveedores que hubieran obtenido un puntaje mínimo en la evaluación técnica.
4. Todos los actos se realizan a través del SEACE de la Pladicop, incluyendo la subsanación de ofertas.
(Artículos 68, 70, 71, 72, 73, 74, 75, 78 y 132 del Reglamento.)

Rechazo de ofertas: los evaluadores pueden rechazar ofertas económicas que se encuentren por debajo de la cuantía de la contratación, en los siguientes casos: i) la oferta se encuentra sustancialmente por debajo de la cuantía de la contratación; ii) la oferta no incorpora alguna de las prestaciones requeridas; o iii) las prestaciones requeridas no se encuentren suficientemente presupuestadas. Para ello, los evaluadores solicitan al postor por escrito o por medios electrónicos, una descripción detallada de los elementos que componen su oferta, pudiendo proporcionarle un formato de estructura de costos con los aspectos mínimos que deben ser acreditados, además de solicitarle información complementaria pertinente. El postor cuenta con un plazo mínimo de dos (2) días hábiles para responder, computados desde el día siguiente de recibida la solicitud. Una vez recibida la información, los evaluadores analizan objetivamente el riesgo del incumplimiento de las prestaciones ofertadas y de advertir que es probable su incumplimiento, rechazan la oferta mediante decisión debidamente motivada.

Oferta económica de mejor puntaje que supera la cuantía de la contratación: en caso la oferta económica del postor que obtiene el mejor puntaje total supere la cuantía de la contratación, se siguen los siguientes pasos, de conformidad con el artículo 132 del Reglamento:
i. La DEC gestiona la solicitud de la ampliación de la certificación de crédito presupuestario y/o previsión presupuestal correspondiente. De otorgarse la ampliación, se procede a adjudicar la buena pro.
ii. De no contar con la ampliación de la certificación de crédito presupuestario y/o previsión presupuestal, los evaluadores negocian con el postor que obtuvo el mejor puntaje total, en este orden: i) la reducción de su oferta económica; ii) la reducción de las prestaciones o condiciones del requerimiento, conforme al numeral 132.1 del artículo 132 del Reglamento. No pueden negociarse las condiciones que dieron lugar al otorgamiento de puntaje en los factores de evaluación correspondientes a la oferta técnica o aquellos establecidos como no negociables en el requerimiento. La finalidad pública de la contratación no debe ser afectada.
iii. En caso el postor con el mejor puntaje no acepte, se procede a negociar con los siguientes postores en el orden de prelación que obtuvieron. Si el postor que sigue en el orden de prelación ofertó un monto igual o menor a la cuantía de la contratación, se le adjudica la buena pro.
iv. En caso el postor que obtuvo el mejor puntaje total reduzca su oferta económica pero la reducción no se encuentre dentro de la cuantía de la contratación, se solicita la ampliación de la certificación de crédito presupuestario y/o previsión presupuestal correspondiente. En caso se otorgue la ampliación, se adjudica la buena pro. Caso contrario, se puede optar por: negociar con los siguientes postores (siempre que hayan obtenido el puntaje mínimo en la evaluación técnica) en el orden de prelación o declarar desierto el procedimiento de selección.
v. Las decisiones adoptadas por los evaluadores en la negociación constan en actas que se publican en el SEACE de la Pladicop y se sustentan en el principio de valor por dinero, priorizando el cumplimiento de la finalidad pública de la contratación.

e) Otorgamiento de la buena pro:
1. Determinada la oferta ganadora, los evaluadores otorgan la buena pro mediante su publicación en el SEACE de la Pladicop, incluyendo los documentos que sustenten los resultados de la admisión, calificación, evaluación y el otorgamiento de la buena pro.
2. En caso de haber sorteo por desempate, éste se realiza a través del SEACE de la Pladicop.
3. En caso se hayan presentado dos o más ofertas, el consentimiento de la buena pro se produce y registra a través del SEACE de la Pladicop al día siguiente de vencido el plazo correspondiente para interponer recurso de apelación, sin que los postores hayan ejercido el derecho de interponer dicho recurso. En caso de que se haya presentado una sola oferta, el consentimiento de la buena pro se produce el mismo día de la notificación de su otorgamiento y se registra en el SEACE de la Pladicop al día siguiente.
(Artículos 80, 81, 82, 83 y 84 del Reglamento.)

2.2 CONSIDERACIONES PARA TODOS LOS PROVEEDORES:
2.2.1 Para registrarse como participante en un procedimiento de selección convocado por una entidad contratante, es necesario que los proveedores cuenten con inscripción vigente ante el Registro Nacional de Proveedores (RNP) que administra el Organismo Especializado para las Contrataciones Públicas Eficientes (OECE) en el registro correspondiente al objeto del procedimiento de selección. Para obtener mayor información, se puede ingresar a la siguiente dirección electrónica: www.rnp.gob.pe.
2.2.2 Los proveedores que deseen registrar su participación deben ingresar al SEACE de la Pladicop utilizando su certificado (usuario y contraseña).
2.2.3 No pueden formularse consultas ni observaciones respecto del contenido de una ficha técnica o ficha de homologación aprobada, aun cuando el requerimiento haya sido estandarizado parcialmente respecto de las características técnicas, requisitos de calificación y/o condiciones de ejecución. Las consultas y observaciones que se formulen sobre el particular se tienen como no presentadas.
2.2.4 Las declaraciones juradas, formatos o formularios previstos en las bases que conforman la oferta deben estar debidamente firmados por el postor (firma manuscrita o digital, según la Ley Nº 27269, Ley de Firmas y Certificados Digitales). No se acepta insertar la imagen de una firma. El postor, el representante legal o común, apoderado o mandatario designado se hace responsable de la totalidad de los documentos que se incluyen en la oferta. El postor es responsable de verificar, antes de su envío, que los archivos puedan ser descargados y su contenido sea legible. En caso la información contenida en los documentos que conforman la oferta no coincida con lo declarado a través del SEACE de la Pladicop, prevalece la información declarada en los documentos de la oferta.

Advertencia: en caso el proveedor emplee la firma digital como una única firma en los documentos que conforman la oferta, esta es suficiente para que el documento sea considerado firmado legalmente.

2.2.5 En caso que al registrarse como participante el proveedor presente una declaración jurada de desafectación del impedimento debido a parentesco establecido en el inciso 2 del numeral 30.1 del artículo 30 de la Ley, debe presentar adicionalmente para la admisión de su oferta la acreditación documental de su condición de desafectación conforme a lo indicado en el literal f) del numeral 2.2.1.1 del Capítulo II de la Sección Específica de las bases.

2.3 CONSIDERACIONES ADICIONALES PARA LOS CONSORCIOS:
2.3.1 En el caso de consorcios, basta que uno de sus integrantes se haya registrado como participante en el procedimiento de selección, para lo cual dicho integrante debe contar con inscripción vigente en el RNP como proveedor de servicios. Los demás integrantes del consorcio deben contar con inscripción vigente en el RNP en las demás etapas del procedimiento de selección. No se considera consorcio a la asociación de personas de duración ilimitada o indefinida que, denominándose consorcios, han sido constituidas como personas jurídicas en los Registros Públicos.
2.3.2 Los integrantes de un consorcio no pueden presentar ofertas individuales ni conformar más de un consorcio en un procedimiento de selección o en un determinado ítem, cuando se trate de procedimientos de selección según relación de ítems. En este segundo supuesto, los integrantes del consorcio pueden participar en ítems distintos a aquel en el que se presentaron en consorcio, sea en forma individual o en consorcio.
2.3.3 Como parte de los documentos de su oferta el consorcio debe presentar la promesa de consorcio con firmas digitales de todos sus integrantes o, en su defecto, firmas legalizadas, de ser el caso, conforme a lo establecido en el literal d) del numeral 69.1 del artículo 69 del Reglamento. La promesa de consorcio debe consignar como mínimo lo siguiente:
a) La identificación de los integrantes del consorcio. Se debe precisar el nombre completo o la denominación o razón social de los integrantes del consorcio, según corresponda.
b) La designación del representante común del consorcio.
c) El domicilio común del consorcio.
d) El correo electrónico común del consorcio, al cual se dirigirán todas las comunicaciones remitidas por la entidad contratante al consorcio durante el proceso de contratación, siendo éste el único válido para todos los efectos.
e) Las obligaciones que correspondan a cada uno de los integrantes del consorcio.
f) El porcentaje del total de las obligaciones de cada uno de los integrantes, respecto del objeto del contrato. Dicho porcentaje debe ser expresado en número entero, sin decimales.
2.3.4 La información contenida en los literales a), e) y f) precedentes no puede ser modificada con ocasión de la suscripción del contrato de consorcio, ni durante la etapa de ejecución contractual. En tal sentido, no cabe variación alguna en la conformación del consorcio, por lo que no es posible que se incorpore, sustituya o separe a un integrante.
2.3.5 El representante común tiene facultades para actuar en nombre y representación del consorcio, en todos los actos referidos al procedimiento de selección, suscripción y ejecución del contrato, con poderes suficientes para ejercitar los derechos y cumplir las obligaciones que se deriven de su calidad de postor y de contratista hasta la conformidad o liquidación del contrato, según corresponda. El representante común no debe encontrarse impedido, inhabilitado ni suspendido para contratar con el Estado. Para cambiar al representante común, todos los integrantes del consorcio deben firmar (mediante firmas legalizadas o firmas digitales) el documento en el que conste el acuerdo, el cual surte efectos cuando es notificado a la entidad contratante.
2.3.6 Las declaraciones juradas, formatos o formularios previstos en las bases que conforman la oferta deben estar debidamente firmados por el representante común, por todos los integrantes del consorcio o de forma independiente por cada consorciado, según corresponda (firma manuscrita o digital, según la Ley Nº 27269, Ley de Firmas y Certificados Digitales). En el caso de los documentos que deban suscribir todos los integrantes del consorcio, la firma es seguida de la razón social o denominación de cada uno de ellos. Lo mismo aplica en caso deban ser suscritos en forma independiente por cada integrante del consorcio, de acuerdo con lo establecido en los documentos del procedimiento de selección. En el caso de un consorcio integrado por una persona natural, bastará que la persona natural indique debajo de su firma sus nombres y apellidos completos.
2.3.7 La acreditación del requisito de calificación de la experiencia del postor se realiza en base a la documentación aportada por los integrantes del consorcio que se hubieran comprometido a ejecutar conjuntamente las obligaciones vinculadas directamente con el objeto materia de la contratación, de acuerdo con lo declarado en la promesa de consorcio. Para ello se debe seguir los siguientes pasos:
a) Primer paso: obtener el monto de facturación por cada integrante del consorcio, el cual se obtiene de la sumatoria de montos facturados por éste que, a criterio del evaluador han sido acreditados conforme a las bases, correspondiente a las contrataciones ejecutadas en forma individual y/o en consorcio. En caso un integrante del consorcio presente facturación de contrataciones ejecutadas en consorcio, se considera el monto que corresponda al porcentaje de las obligaciones del referido integrante del consorcio. Este porcentaje debe estar consignado expresamente en la promesa o en el contrato de consorcio, de lo contrario, no se considera la experiencia ofertada en consorcio.
b) Segundo paso: verificar si el integrante del consorcio que acredita la mayor experiencia cumple con un determinado porcentaje de participación. En caso la entidad contratante haya establecido en las bases un porcentaje determinado de participación en la ejecución del contrato, para el integrante del consorcio que acredite mayor experiencia, debe verificarse que éste cumple con dicho parámetro a efectos de considerar su experiencia.
c) Tercer paso: sumatoria de experiencia de los consorciados. Para obtener la experiencia del consorcio se suma el monto de facturación aportado por cada integrante que cumple con lo señalado previamente.
2.3.8 Para calificar la experiencia del postor no se toma en cuenta la documentación presentada por el o los consorciados que asumen las obligaciones referidas a las siguientes actividades: i. actividades de carácter administrativo o de gestión como facturación, financiamiento, aporte de garantías, entre otras; ii. actividades relacionadas con asuntos de organización interna, tales como representación u otros aspectos que no se relacionan con la ejecución de las prestaciones, entre otras.
2.3.9 Los integrantes del consorcio son responsables de que su inscripción en el RNP se encuentre vigente, así como de no estar inhabilitado o suspendido al registrarse como participantes, a la presentación de ofertas, al otorgamiento de la buena pro y al perfeccionamiento del contrato.
2.3.10 Los integrantes de un consorcio se encuentran obligados solidariamente a responder frente a la entidad contratante por los efectos patrimoniales que ésta sufra como consecuencia de la actuación de dichos integrantes, ya sea individual o conjunta, durante el procedimiento de selección y la ejecución contractual.

CAPÍTULO III
RECURSO DE APELACIÓN

3.1 ACCESO AL EXPEDIENTE DE CONTRATACIÓN
Una vez otorgada la buena pro, la DEC está en la obligación de permitir el acceso de los participantes y postores al expediente de contratación, con excepción de la información calificada como secreta, confidencial o reservada por la normativa de la materia y de aquella correspondiente a las ofertas que no fueron admitidas, a más tardar dentro del día hábil siguiente de haberse solicitado por escrito. A efectos de recoger la información de su interés, los participantes y postores pueden valerse de distintos medios, tales como: (i) la lectura y/o toma de apuntes, (ii) la captura y almacenamiento de imágenes, e incluso (iii) pueden solicitar copia de la documentación obrante en el expediente, siendo que, en este último caso, la entidad contratante debe entregar dicha documentación en el menor tiempo posible, previo pago de la tasa por tal concepto previsto en el Texto Único de Procedimientos Administrativos (TUPA) de la respectiva entidad contratante.

3.2 RECURSO DE APELACIÓN
A través del recurso de apelación se pueden impugnar los actos dictados durante el desarrollo del procedimiento de selección hasta antes del perfeccionamiento del contrato, incluyendo aquellos que declaren la nulidad de oficio, la cancelación del procedimiento de selección y otros actos emitidos por la entidad contratante que afecten la continuidad de éste. El recurso de apelación se presenta ante la mesa de partes digital o física del Tribunal de Contrataciones Públicas y es resuelto por este.

3.3 PLAZOS DE INTERPOSICIÓN DEL RECURSO DE APELACIÓN
La apelación contra el otorgamiento de la buena pro o contra los actos dictados con anterioridad a ella se interpone, como máximo, dentro de los ocho días hábiles siguientes de haberse notificado el otorgamiento de la buena pro a través del SEACE de la Pladicop. En el caso de la apelación contra los actos dictados con posterioridad al otorgamiento de la buena pro, contra la declaración de nulidad, cancelación y declaratoria de desierto del procedimiento de selección, el plazo indicado en el párrafo precedente se contabiliza desde que se toma conocimiento del acto que se desea impugnar. Se considera que se ha tomado conocimiento en el día de la publicación en el SEACE de la Pladicop del acto que se desea impugnar.

CAPÍTULO IV
DEL CONTRATO

4.1 REQUISITOS PARA EL PERFECCIONAMIENTO DEL CONTRATO:
Para perfeccionar el contrato, el postor o postores ganadores de la buena pro presentan los siguientes requisitos de conformidad con el artículo 88 del Reglamento:

a) Garantías, salvo casos de excepción.
El postor ganador de la buena pro presenta una garantía de fiel cumplimiento por una suma equivalente al 10% del monto del contrato original. La garantía de fiel cumplimiento puede ser: (i) fideicomiso, solo cuando el plazo de ejecución del contrato supere los noventa días calendario, (ii) carta fianza financiera, (iii) contrato de seguro, o (iv) retención de pago. Asimismo, en la Sección Específica de las Bases puede considerarse la presentación de: i) garantía de fiel cumplimiento de prestaciones accesorias, y ii) garantía por adelantos directos, siempre que se cumplan las condiciones señaladas en el Reglamento. La retención de pago como garantía de fiel cumplimiento o de prestaciones accesorias aplica para contrataciones cuya cuantía adjudicada sea igual o menor a S/ 480 000,00 (Cuatrocientos ochenta mil y 00/100 Soles). En el caso de las micro y pequeñas empresas estas pueden otorgar como garantía de fiel cumplimiento la retención de pago por parte de la entidad contratante con independencia del monto de la contratación.
Excepciones: conforme a lo dispuesto en el literal a) del artículo 139 del Reglamento, en los contratos de servicios cuyos montos sean menores o iguales a 50 UIT, no corresponde presentar garantía de fiel cumplimiento de contrato ni garantía de fiel cumplimiento por prestaciones accesorias. Esta excepción no aplica cuando la sumatoria de los contratos derivados de procedimientos de selección por relación de ítems, adjudicados a un mismo postor, superen el monto señalado.
(Numerales 61.4 y 61.5 del artículo 61 de la Ley. Literal a) del numeral 88.1 del artículo 88, y los artículos 113, 114, 115, 116, 138 y 139 del Reglamento.)

b) Contrato de consorcio, de ser el caso.
El contrato de consorcio debe cumplir con los siguientes requisitos: a. Contener la información indicada en el numeral 2.3.3 del Capítulo II de la Sección General de las presentes bases. b. Identificar al integrante del consorcio a quien se efectuará el pago y emite la respectiva factura o, en caso de llevar contabilidad independiente, señalar el número de Registro Único de Contribuyente (RUC), del consorcio. c. Consignar las firmas legalizadas ante notario público de cada uno de los integrantes del consorcio, de sus apoderados o de sus representantes legales, según corresponda.
Lo indicado no excluye la información adicional que pueda consignarse en el contrato de consorcio con el objeto de regular su administración interna, como es el régimen y los sistemas de participación en los resultados del consorcio, al que se refiere el artículo 448 de la Ley N° 26887, Ley General de Sociedades. En ningún caso puede aceptarse la presentación de la promesa de consorcio que fue parte de la oferta, independientemente de que dicha promesa contenga firmas legalizadas de sus integrantes ante notario público.
(Literal b) del numeral 88.1 del artículo 88 y el artículo 89 del Reglamento.)

c) Código de cuenta interbancaria (CCI) o, en el caso de proveedores no domiciliados, el número de cuenta bancaria y nombre de la entidad bancaria en el exterior.
El CCI es requisito indispensable para realizar una transferencia entre cuentas de bancos diferentes, siendo requerido para efectuar el pago a los proveedores domiciliados en el Perú. Para los proveedores no domiciliados, corresponde el número de cuenta bancaria y nombre de la entidad bancaria en el exterior.
(Artículo 67 de la Ley. Literal c) del numeral 88.1 del artículo 88 del Reglamento.)

d) Documento que acredite que cuenta con facultades para perfeccionar el contrato, cuando corresponda.
Corresponde a la vigencia del poder del representante legal que acredite que cuenta con facultades para perfeccionar el contrato, en caso el postor sea persona jurídica. Adicionalmente, el representante legal presenta copia de su documento de identidad (DNI o carné de extranjería, según corresponda). En el caso de personas naturales, se solicita copia de su documento de identidad (DNI o carné de extranjería, según corresponda). En el caso de consorcios, estos documentos deben ser presentados por cada uno de los integrantes que suscribieron la promesa de consorcio, según corresponda. Asimismo, debe presentarse copia del documento de identidad (DNI o carné de extranjería, según corresponda) del representante común del consorcio.
(Literal d) del numeral 88.1 del artículo 88 del Reglamento.)

e) Institución Arbitral elegida del listado de instituciones arbitrales propuesto por la entidad contratante o propuesta de tres instituciones arbitrales del postor.
Este requisito es obligatorio para todos los contratos que superen las 10 UIT (de conformidad con el numeral 84.1 del artículo 84 de la Ley, el arbitraje puede ser ad hoc solo en los casos en los que el monto de la controversia no supere las diez (10) UIT). Desde el 1 de enero de 2026, la institución arbitral elegida debe encontrarse inscrita en el Registro de Instituciones Arbitrales y Centros de Administración de Juntas de Prevención y Resolución de Disputas (REGAJU).
(Artículos 77, 83 y 84, así como la Décima Disposición Complementaria Transitoria de la Ley. Literal e) del numeral 88.1 del artículo 88 del Reglamento.)

4.2 PERFECCIONAMIENTO DEL CONTRATO
4.2.1 El postor ganador de la buena pro debe presentar los requisitos para perfeccionar el contrato dentro del plazo de ocho o cinco días hábiles, según corresponda, plazo que se contabiliza desde el día siguiente del registro del consentimiento de la buena pro en el SEACE de la Pladicop o desde que esta haya quedado administrativamente firme, de conformidad con los requisitos, plazos y procedimiento dispuestos en los artículos 88, 89, 90 y 91 del Reglamento.
4.2.2. El contrato se suscribe mediante firma digital, siempre que el postor ganador de la buena pro cuente con certificado digital emitido por una entidad de certificación, de acuerdo con la normativa de la materia; caso contrario, se suscribe manualmente.
4.2.3. De conformidad con el numeral 87.3 del Reglamento, excepcionalmente, la entidad contratante puede sustentar la imposibilidad de suscribir el contrato mediante firma digital, supuesto en el cual la suscripción se realiza manualmente.

4.3 CONSIDERACIONES PARA LOS CONSORCIOS
4.3.1 Las garantías que presenten los consorcios para el perfeccionamiento del contrato durante la ejecución contractual y para la interposición de los recursos impugnativos, además de cumplir con las condiciones establecidas en la Ley y el Reglamento, deben consignar expresamente el nombre completo o la denominación o razón social de los integrantes del consorcio, en calidad de garantizados, de lo contrario no pueden ser aceptadas por las entidades contratantes o el Tribunal de Contrataciones Públicas. No se cumple el requisito antes indicado si se consigna únicamente la denominación del consorcio.
4.3.2 La retención del 10% del monto del contrato original en calidad de garantía de fiel cumplimiento aplica cuando la cuantía adjudicada sea igual o menor a S/ 480 000,00 (Cuatrocientos ochenta mil y 00/100 Soles). En el caso de micro o pequeñas empresas que hayan declarado en su oferta tal condición, no aplica dicho umbral, según lo señalado en el artículo 114 del Reglamento. En caso de consorcio, aplica dicha retención si todos sus integrantes declaran en su oferta la condición de micro o pequeña empresa.

4.4 CONSIDERACIONES PARA LAS GARANTÍAS FINANCIERAS
4.4.1 En caso de garantías financieras, estas deben ser incondicionales, solidarias, irrevocables y de realización automática en el país, al solo requerimiento de la respectiva entidad contratante bajo responsabilidad de las empresas que las emiten. Las empresas que emitan garantías financieras deben encontrarse bajo la supervisión directa de la Superintendencia de Banca, Seguros y Administradoras Privadas de Fondos de Pensiones, contar con clasificación de riesgo B o superior, y deben estar autorizadas para emitir garantías o estar consideradas en la última lista de bancos extranjeros de primera categoría que periódicamente publica el Banco Central de Reserva del Perú.
4.4.2 La clasificadora de riesgo que asigna la clasificación a la empresa que emite la garantía debe encontrarse listada en el portal web de la SBS (http://www.sbs.gob.pe/sistema-financiero/clasificadoras-de-riesgo).
4.4.3 Se debe identificar en la página web de la clasificadora de riesgo respectiva, cuál es la clasificación vigente de la empresa que emite la garantía, considerando la vigencia a la fecha de emisión de la garantía. Para fines de lo establecido en el artículo 61 de la Ley, se requiere la clasificación de riesgo B o superior.
4.4.4 Si la empresa que otorga la garantía cuenta con más de una clasificación de riesgo emitida por distintas empresas listadas en la sede digital de la SBS, basta que en una de ellas cumpla con la clasificación mínima establecida en la Ley.
4.4.5 En caso exista alguna duda sobre la clasificación de riesgo asignada a la empresa emisora de la garantía, se debe consultar a la clasificadora de riesgos respectiva.
4.4.6 Además de cumplir con el requisito referido a la clasificación de riesgo, a efectos de verificar si la empresa emisora se encuentra autorizada por la SBS para emitir garantías, debe revisarse la sede digital de dicha entidad (http://www.sbs.gob.pe/sistema-financiero/relacion-de-empresas-que-se-encuentran-autorizadas-a-emitir-cartas-fianza).

4.5 CONSIDERACIONES PARA LOS DOCUMENTOS EXTENDIDOS EN EL EXTRANJERO
En el caso que los documentos requeridos para el perfeccionamiento del contrato incluyan documentos públicos extendidos en el exterior, que no les sea aplicable el Convenio de la Apostilla, se debe tener en cuenta que, de conformidad con lo previsto en el artículo 137 del Reglamento Consular del Perú, aprobado mediante Decreto Supremo N° 032-2023-RE, para que estos surtan efectos legales en el Perú deben estar legalizados por los funcionarios consulares peruanos competentes, cuyas firmas deben ser autenticadas posteriormente por el área competente del órgano de línea consular, además de cumplir con los requisitos adicionales que contemple la legislación peruana para su validez en el Perú. Cuando se trate de documentos privados extendidos en el exterior, el funcionario consular sólo legaliza las firmas cuando hayan sido suscritas en su presencia o cuando conste de modo indubitable su autenticidad, verificando en ambos casos la identidad de los firmantes, conforme lo requiere el artículo 138 del citado Reglamento.

4.6 DISPOSICIONES FINALES
Todos los demás aspectos del presente procedimiento de selección no contemplados en las bases se rigen por la Ley y su Reglamento, así como por las disposiciones legales vigentes.
`.trim();

// Transcrita a mano leyendo el texto de capa del PDF oficial de "consultoría
// en general" (actuaciones-preparatorias/bases/7614342-10-bases-estandar-concurso-publico-para-consultoria-en-general.pdf),
// mismo método que las anteriores. Misma advertencia de fidelidad.
//
// IMPORTANTE — brecha de resolución sin cerrar (ver PLANTILLAS_BASES más
// abajo): en `lib/procesos-seleccion.ts` el valor de catálogo "Concurso
// Público para consultorías y servicios de mantenimiento vial" resuelve a
// TRES PDFs distintos del OECE (`BASES_CONSULTORIA_VIAL`): consultoría en
// general (esta), consultoría de obra, y servicio de mantenimiento vial. Ese
// único `procedure_type` no alcanza para saber cuál de los tres aplica a un
// expediente concreto — ACE no tiene hoy un dato que distinga "consultoría
// en general" de "consultoría de obra" o "mantenimiento vial" dentro de ese
// mismo tipo de procedimiento. Por eso esta plantilla NO se registra bajo el
// valor de catálogo (que no la identificaría sin ambigüedad), sino bajo un
// nombre propio ("Concurso Público para consultoría en general"). Hasta que
// se resuelva esa brecha (p. ej. un campo adicional en la ficha o en A4 que
// distinga el subtipo), `plantillaDeProceso` con el valor real del catálogo
// sigue devolviendo `undefined` para este tipo de procedimiento — la ruta de
// exportación (fase1/bases-docx) ya maneja ese caso con un 404 explicado.
const SECCION_GENERAL_CONSULTORIA_GENERAL = `
CAPÍTULO I
ASPECTOS GENERALES

1.1. REFERENCIAS
Cuando en el presente documento se mencione la palabra "Ley", se entiende que se está haciendo referencia a la Ley N° 32069, Ley General de Contrataciones Públicas, y cuando se mencione la palabra "Reglamento", se entiende que se está haciendo referencia al Reglamento de la Ley N° 32069, Ley General de Contrataciones Públicas, aprobado por Decreto Supremo N° 009-2025-EF. Las referidas normas incluyen sus respectivas modificaciones, de ser el caso.

1.2. ALCANCE
La presente base estándar es utilizada por la entidad contratante para la contratación de consultoría en general, según la cuantía establecida en la Ley de Presupuesto del Sector Público para el Año Fiscal correspondiente.

CAPÍTULO II
DESARROLLO DEL PROCEDIMIENTO DE SELECCIÓN

2.1 ETAPAS DEL CONCURSO PÚBLICO PARA CONSULTORÍA EN GENERAL
Los evaluadores del procedimiento de selección pueden ser comité o jurado: en caso la entidad contratante haya designado un comité para conducir el procedimiento de selección, este se encarga de la evaluación de las ofertas de los postores de forma colegiada, siendo solidariamente responsables por dicha evaluación, salvo que dejen constancia de su voto en discordia en el acta correspondiente con el respectivo sustento. En caso la entidad contratante haya designado un jurado para la evaluación de las ofertas de los postores, la DEC se encarga de la recepción de las ofertas, de la revisión de los documentos para la admisión y los requisitos de calificación de las ofertas; así como de la revisión de las ofertas y de su remisión a cada uno de los expertos que conforman el jurado, quienes realizan individualmente la evaluación técnica y económica de las mismas y remiten los puntajes asignados a la DEC para su publicación y otorgamiento de la buena pro.

Las etapas del procedimiento de selección de Concurso Público para Consultoría en General son las siguientes (de conformidad con el numeral 27.1 del artículo 27 de la Ley, la facultad para actuar discrecionalmente se fundamenta en el rigor técnico empleado por los funcionarios y servidores, dependencias y unidades de organización encargadas de las contrataciones públicas para optar por la mejor decisión debidamente sustentada que permita el cumplimiento oportuno de los fines públicos):

a) Convocatoria. Se realiza a través del SEACE de la Pladicop en la fecha señalada en el cronograma. (Artículos 63 y 64 del Reglamento.)

b) Registro de participantes. Aplica lista abierta, por lo que cualquier proveedor puede registrarse como participante en el procedimiento de selección. (Artículos 65 y 94 del Reglamento.)

c) Cuestionamientos a las bases (consultas, observaciones e integración):
1. La presentación de consultas y/u observaciones se realiza en un plazo no menor a siete días hábiles contabilizados desde el día siguiente de la convocatoria.
2. La absolución de los referidos cuestionamientos y la publicación de las bases integradas se realiza en la fecha prevista en el cronograma del procedimiento de selección.
3. El pliego de absolución de consultas y observaciones, así como las bases integradas pueden ser cuestionadas por los participantes, para su elevación ante el OECE, dentro de los tres días hábiles siguientes de publicados el pliego de absolución y observaciones e integración de bases. La entidad contratante realiza la elevación de conformidad con la directiva del OECE.
4. La entidad contratante solo puede omitir la elevación al OECE del pliego de absolución de consultas y observaciones y las bases integradas en caso hayan utilizado la herramienta de difusión del requerimiento en la interacción con el mercado.
(Artículos 51, 62, 66, 67 y 94 del Reglamento.)

d) Evaluación de ofertas técnicas y económicas:
1. La presentación de ofertas se realiza a través del SEACE de la Pladicop desde las 00:01 hasta las 23:59 horas (hora peruana) de la fecha prevista en el cronograma del procedimiento de selección. Dicha fecha no puede ser fijada en menos de siete días hábiles desde la publicación de la integración de bases o el pronunciamiento con la integración definitiva de bases por parte del OECE.
2. La presentación de ofertas se realiza adjuntando el archivo digitalizado que contenga los documentos que la conforman, según lo requerido en las bases (los formularios electrónicos del SEACE de la Pladicop que los participantes deben registrar para presentar sus ofertas, tienen carácter de declaración jurada).
3. La evaluación de ofertas es SIN PRECALIFICACIÓN y consiste en:
   a. Admisión de las ofertas: los evaluadores o la DEC, según corresponda, revisan que la oferta contenga los documentos señalados en el Capítulo II de la Sección Específica de las bases, caso contrario la oferta se considera no admitida.
   b. Revisión de los requisitos de calificación: los evaluadores o la DEC, según corresponda, califican a los postores verificando que cumplan con los requisitos de calificación detallados en el Capítulo III de la Sección Específica de las bases. Caso contrario la oferta se considera descalificada.
   c. Evaluación de ofertas técnicas: los evaluadores o la DEC, según corresponda, aplican los factores de evaluación previstos en el Capítulo IV de la Sección Específica de las bases a las ofertas que cumplen los requisitos de calificación. En la Sección Específica se prevé un puntaje mínimo en la evaluación técnica para proceder a la evaluación económica de la oferta.
   d. Evaluación de ofertas económicas: la evaluación de la oferta económica es posterior a la evaluación de la oferta técnica y solo respecto de aquellos proveedores que hubieran obtenido o superado un puntaje mínimo en la evaluación técnica.
4. Todos los actos se realizan a través del SEACE de la Pladicop, incluyendo la subsanación de ofertas.
(Artículos 68, 70, 71, 72, 73, 74, 75, 78 y 132 del Reglamento.)

Rechazo de ofertas: los evaluadores pueden rechazar ofertas económicas que se encuentren por debajo de la cuantía de la contratación, en los siguientes casos: i) la oferta se encuentra sustancialmente por debajo de la cuantía de la contratación; ii) la oferta no incorpora alguna de las prestaciones requeridas; o iii) las prestaciones requeridas no se encuentren suficientemente presupuestadas. Para ello, los evaluadores solicitan al postor por escrito o por medios electrónicos, una descripción detallada de los elementos que componen su oferta, pudiendo proporcionarle un formato de estructura de costos con los aspectos mínimos que deben ser acreditados, además de solicitarle información complementaria pertinente. El postor cuenta con un plazo mínimo de dos (2) días hábiles para responder, computados desde el día siguiente de recibida la solicitud. Una vez recibida la información, los evaluadores analizan objetivamente el riesgo del incumplimiento de las prestaciones ofertadas y de advertir que es probable su incumplimiento, rechazan la oferta mediante decisión debidamente motivada.

Oferta económica de mejor puntaje que supera la cuantía de la contratación: en caso la oferta económica definitiva del postor que obtiene el mejor puntaje total supere la cuantía de la contratación, se siguen los siguientes pasos, de conformidad con el artículo 132 del Reglamento:
i. La DEC gestiona la solicitud de la ampliación de la certificación de crédito presupuestario y/o previsión presupuestal correspondiente. De otorgarse la ampliación, se procede a adjudicar la buena pro.
ii. De no contar con la ampliación de la certificación de crédito presupuestario y/o previsión presupuestal, los evaluadores negocian con el postor que obtuvo el mejor puntaje total, en este orden: i) la reducción de su oferta económica; ii) la reducción de las prestaciones o condiciones del requerimiento, conforme al numeral 132.1 del artículo 132 del Reglamento. No pueden negociarse las condiciones que dieron lugar al otorgamiento de puntaje en los factores de evaluación correspondientes a la oferta técnica o aquellos establecidos como no negociables en el requerimiento. La finalidad pública de la contratación no debe ser afectada.
iii. En caso el postor con el mejor puntaje no acepte, se procede a negociar con los siguientes postores en el orden de prelación que obtuvieron. Si el postor que sigue en el orden de prelación ofertó un monto igual o menor a la cuantía de la contratación, se le adjudica la buena pro.
iv. En caso el postor que obtuvo el mejor puntaje total reduzca su oferta económica pero la reducción no se encuentre dentro de la cuantía de la contratación, se solicita la ampliación de la certificación de crédito presupuestario y/o previsión presupuestal correspondiente. En caso se otorgue la ampliación, se adjudica la buena pro. Caso contrario, se puede optar por: negociar con los siguientes postores en el orden de prelación o declarar desierto el procedimiento de selección.
v. Las decisiones adoptadas por los evaluadores en la negociación constan en actas que se publican en el SEACE de la Pladicop y se sustentan en el principio de valor por dinero, priorizando el cumplimiento de la finalidad pública de la contratación.

e) Otorgamiento de la buena pro:
1. Determinada la oferta ganadora, los evaluadores o la DEC, según corresponda, otorgan la buena pro, mediante su publicación en el SEACE de la Pladicop, incluyendo los documentos que sustenten los resultados de la admisión, calificación, evaluación y el otorgamiento de la buena pro.
2. En caso de haber sorteo por desempate, éste se realiza a través del SEACE de la Pladicop.
3. En caso se hayan presentado dos o más ofertas, el consentimiento de la buena pro se produce y registra a través del SEACE de la Pladicop al día siguiente de vencido el plazo correspondiente para interponer recurso de apelación, sin que los postores hayan ejercido el derecho de interponer dicho recurso. En caso de que se haya presentado una sola oferta, el consentimiento de la buena pro se produce el mismo día de la notificación de su otorgamiento, y se registra en el SEACE de la Pladicop al día siguiente.
(Artículos 80, 81, 82, 83 y 84 del Reglamento.)

2.2 CONSIDERACIONES PARA TODOS LOS PROVEEDORES:
2.2.1 Para registrarse como participante en un procedimiento de selección convocado por una entidad contratante, es necesario que los proveedores cuenten con inscripción vigente ante el Registro Nacional de Proveedores (RNP) que administra el Organismo Especializado para las Contrataciones Públicas Eficientes (OECE) en el registro correspondiente al objeto del procedimiento de selección. Para obtener mayor información, se puede ingresar a la siguiente dirección electrónica: www.rnp.gob.pe.
2.2.2 Los proveedores que deseen registrar su participación deben ingresar al SEACE de la Pladicop utilizando su certificado (usuario y contraseña).
2.2.3 No pueden formularse consultas ni observaciones respecto del contenido de una ficha técnica o ficha de homologación aprobada, aun cuando el requerimiento haya sido estandarizado parcialmente respecto a las características técnicas y/o requisitos de calificación y/o condiciones de ejecución. Las consultas y observaciones que se formulen sobre el particular se tienen como no presentadas.
2.2.4 Las declaraciones juradas, formatos o formularios previstos en las bases que conforman la oferta deben estar debidamente firmados por el postor (firma manuscrita o digital, según la Ley Nº 27269, Ley de Firmas y Certificados Digitales). No se acepta insertar la imagen de una firma o visto. El postor, el representante legal o común, apoderado o mandatario designado, se hace responsable de la totalidad de los documentos que se incluyen en la oferta. El postor es responsable de verificar, antes de su envío, que el archivo pueda ser descargado y su contenido sea legible. En caso la información contenida en los documentos que conforman la oferta no coincida con lo declarado a través del SEACE de la Pladicop, prevalece la información declarada en los documentos de la oferta.

Advertencia: en caso el proveedor emplee la firma digital como una única firma en los documentos que conforman la oferta, esta es suficiente para que el documento sea considerado firmado legalmente.

2.2.5 En caso de que al registrarse como participante el proveedor presente una declaración jurada de desafectación del impedimento debido al parentesco establecido en el inciso 2 del numeral 30.1 del artículo 30 de la Ley, debe presentar adicionalmente para la admisión de su oferta la acreditación documental de su condición de desafectación conforme a lo indicado en el literal f) del numeral 2.2.1.1. del Capítulo II de la Sección Específica de las bases.

2.3 CONSIDERACIONES ADICIONALES PARA LOS CONSORCIOS:
2.3.1 En el caso de consorcios, basta que uno de sus integrantes se haya registrado como participante en el procedimiento de selección, para lo cual dicho integrante debe contar con inscripción vigente en el RNP como proveedor de servicios. Los demás integrantes del consorcio deben contar con inscripción vigente en el RNP en las demás etapas del procedimiento de selección. No se considera consorcio a la asociación de personas de duración ilimitada o indefinida que, denominándose consorcios, han sido constituidas como personas jurídicas en los Registros Públicos.
2.3.2 Los integrantes de un consorcio no pueden presentar ofertas individuales ni conformar más de un consorcio en un procedimiento de selección, o en un determinado ítem cuando se trate de procedimientos de selección según relación de ítems. En este segundo supuesto, los integrantes del consorcio pueden participar en ítems distintos a aquel en el que se presentaron en consorcio, sea en forma individual o en consorcio.
2.3.3 Como parte de los documentos de su oferta el consorcio debe presentar la promesa de consorcio con firmas digitales de todos sus integrantes o, en su defecto, firmas legalizadas, de ser el caso, conforme a lo establecido en el literal d) del numeral 69.1 del artículo 69 del Reglamento. La promesa de consorcio debe consignar, como mínimo, lo siguiente:
a) La identificación de los integrantes del consorcio. Se debe precisar el nombre completo o la denominación o razón social de los integrantes del consorcio, según corresponda.
b) La designación del representante común del consorcio.
c) El domicilio común del consorcio.
d) El correo electrónico común del consorcio, al cual se dirigen todas las comunicaciones remitidas por la entidad contratante al consorcio durante el proceso de contratación, siendo éste el único válido para todos los efectos.
e) Las obligaciones que correspondan a cada uno de los integrantes del consorcio.
f) El porcentaje del total de las obligaciones de cada uno de los integrantes respecto del objeto del contrato. Dicho porcentaje debe ser expresado en número entero, sin decimales.
2.3.4 La información contenida en los literales a), e) y f) precedentes no puede ser modificada con ocasión de la suscripción del contrato de consorcio, ni durante la etapa de ejecución contractual. En tal sentido, no cabe variación alguna en la conformación del consorcio, por lo que no es posible que se incorpore, sustituya o separe a un integrante.
2.3.5 El representante común tiene facultades para actuar en nombre y representación del consorcio en todos los actos referidos al procedimiento de selección, suscripción y ejecución del contrato, con poderes suficientes para ejercitar los derechos y cumplir las obligaciones que se deriven de su calidad de postor y de contratista hasta la conformidad o liquidación del contrato, según corresponda. El representante común no debe encontrarse impedido, inhabilitado ni suspendido para contratar con el Estado. Para cambiar al representante común, todos los integrantes del consorcio deben firmar (mediante firmas legalizadas o firmas digitales) el documento en el que conste el acuerdo, el cual surte efectos cuando es notificado a la entidad contratante.
2.3.6 Las declaraciones juradas, formatos o formularios previstos en las bases que conforman la oferta deben estar debidamente firmados por el representante común por todos los integrantes del consorcio o de forma independiente por cada consorciado, según corresponda (firma manuscrita o digital, según la Ley Nº 27269, Ley de Firmas y Certificados Digitales). En el caso de los documentos que deban suscribir todos los integrantes del consorcio, la firma es seguida de la razón social o denominación de cada uno de ellos. Lo mismo aplica en caso deban ser suscritos en forma independiente por cada integrante del consorcio, de acuerdo con lo establecido en los documentos del procedimiento de selección. En el caso de un consorcio integrado por una persona natural, basta que la persona natural indique debajo de su firma sus nombres y apellidos completos.
2.3.7 La acreditación del requisito de calificación de la experiencia del postor se realiza en base a la documentación aportada por los integrantes del consorcio que se hubieran comprometido a ejecutar conjuntamente las obligaciones vinculadas directamente con el objeto materia de la contratación, de acuerdo con lo declarado en la promesa de consorcio. Para ello se debe seguir los siguientes pasos:
a) Primer paso: obtener el monto de facturación por cada integrante del consorcio, el cual se obtiene de la sumatoria de montos facturados por éste que, a criterio del evaluador han sido acreditados conforme a las bases, correspondiente a las contrataciones ejecutadas en forma individual y/o consorcio. En caso un integrante del consorcio presente facturación de contrataciones ejecutadas en consorcio, se considera el monto que corresponda al porcentaje de las obligaciones del referido integrante del consorcio. Este porcentaje debe estar consignado expresamente en la promesa o en el contrato de consorcio, de lo contrario, no se considera la experiencia ofertada en consorcio.
b) Segundo paso: verificar si el integrante del consorcio que acredita la mayor experiencia cumple con un determinado porcentaje de participación. En caso la entidad contratante haya establecido en las bases un porcentaje determinado de participación en la ejecución del contrato, para el integrante del consorcio que acredite mayor experiencia, debe verificarse que éste cumple con dicho parámetro a efectos de considerar su experiencia.
c) Tercer paso: sumatoria de experiencia de los consorciados. Para obtener la experiencia del consorcio se suma el monto de facturación aportado por cada integrante que cumple con lo señalado previamente.
2.3.8 Para calificar la experiencia del postor no se toma en cuenta la documentación presentada por el o los consorciados que asumen las obligaciones referidas a las siguientes actividades: i) actividades de carácter administrativo o de gestión como facturación, financiamiento, aporte de garantías, entre otras; ii) actividades relacionadas con asuntos de organización interna, tales como representación u otros aspectos que no se relacionan con la ejecución de las prestaciones, entre otras.
2.3.9 Los integrantes del consorcio son responsables de que su inscripción en el RNP se encuentre vigente, así como de no estar inhabilitados o suspendidos al registrarse como participantes, en la presentación de ofertas, al otorgamiento de la buena pro y al perfeccionamiento del contrato.
2.3.10 Los integrantes de un consorcio se encuentran obligados solidariamente a responder frente a la entidad contratante por los efectos patrimoniales que ésta sufra como consecuencia de la actuación de dichos integrantes, ya sea individual o conjunta, durante el procedimiento de selección y la ejecución contractual.

CAPÍTULO III
RECURSO DE APELACIÓN

3.1. ACCESO AL EXPEDIENTE DE CONTRATACIÓN
Una vez otorgada la buena pro, la DEC está en la obligación de permitir el acceso de los participantes y postores al expediente de contratación, con excepción de la información calificada como secreta, confidencial o reservada por la normativa de la materia y de aquella correspondiente a las ofertas que no fueron admitidas, a más tardar dentro del día hábil siguiente de haberse solicitado por escrito. A efectos de recoger la información de su interés, los participantes y postores pueden valerse de distintos medios, tales como: (i) la lectura y/o toma de apuntes, (ii) la captura y almacenamiento de imágenes, e incluso (iii) pueden solicitar copia de la documentación obrante en el expediente, siendo que, en este último caso, la entidad contratante debe entregar dicha documentación en el menor tiempo posible, previo pago de la tasa por tal concepto previsto en el Texto Único de Procedimientos Administrativos (TUPA) de la respectiva entidad contratante.

3.2. RECURSO DE APELACIÓN
A través del recurso de apelación se pueden impugnar los actos dictados durante el desarrollo del procedimiento de selección hasta antes del perfeccionamiento del contrato, incluyendo aquellos que declaren la nulidad de oficio, la cancelación del procedimiento de selección y otros actos emitidos por la entidad contratante que afecten la continuidad de este. El recurso de apelación se presenta ante la mesa de partes digital o física del Tribunal de Contrataciones Públicas y es resuelto por éste.

3.3. PLAZOS DE INTERPOSICIÓN DEL RECURSO DE APELACIÓN
La apelación contra el otorgamiento de la buena pro o contra los actos dictados con anterioridad a ella se interpone, como máximo, dentro de los ocho días hábiles siguientes de haberse notificado el otorgamiento de la buena pro a través del SEACE de la Pladicop. En el caso de la apelación contra los actos dictados con posterioridad al otorgamiento de la buena pro, contra la declaración de nulidad, cancelación y declaratoria de desierto del procedimiento de selección, el plazo indicado en el párrafo precedente se contabiliza desde que se toma conocimiento del acto que se desea impugnar. Se considera que se ha tomado conocimiento en el día de la publicación en el SEACE de la Pladicop del acto que se desea impugnar.

CAPÍTULO IV
DEL CONTRATO

4.1. REQUISITOS PARA EL PERFECCIONAMIENTO DEL CONTRATO
Para perfeccionar el contrato, el postor o postores ganadores de la buena pro presentan los siguientes requisitos de conformidad con el artículo 88 del Reglamento:

a) Garantías, salvo casos de excepción.
El postor ganador de la buena pro presenta una garantía de fiel cumplimiento por una suma equivalente al 10% del monto del contrato original. La garantía de fiel cumplimiento puede ser: (i) fideicomiso, solo en caso el plazo de ejecución del contrato supere los noventa días calendario, (ii) carta fianza financiera, (iii) contrato de seguro, o (iv) retención de pago. Asimismo, en la Sección Específica de las bases pueden considerarse la presentación de: i) garantía de fiel cumplimiento de prestaciones accesorias, y ii) garantía por adelantos directos, siempre que se cumplan las condiciones señaladas en el Reglamento. La retención de pago como garantía de fiel cumplimiento o de prestaciones accesorias aplica para contrataciones cuya cuantía adjudicada sea igual o menor a S/ 480 000,00 (cuatrocientos ochenta mil y 00/100 soles). En el caso de las micro y pequeñas empresas estas pueden otorgar como garantía de fiel cumplimiento la retención de pago por parte de la entidad contratante con independencia de la cuantía de la contratación.
Excepciones: conforme a lo dispuesto en el literal a) del artículo 139 del Reglamento, en los contratos de servicios cuyos montos sean menores o iguales a 50 UIT, no corresponde presentar garantía de fiel cumplimiento de contrato ni garantía de fiel cumplimiento por prestaciones accesorias. Esta excepción no aplica cuando la sumatoria de los contratos derivados de procedimientos de selección por relación de ítems, adjudicados a un mismo postor, superen el monto señalado.
(Numerales 61.4 y 61.5 del artículo 61 de la Ley. Literal a) del numeral 88.1 del artículo 88, y los artículos 113, 114, 115, 116, 137, 138 y 139 del Reglamento.)

b) Contrato de consorcio, de ser el caso.
El contrato de consorcio debe cumplir con los siguientes requisitos: a. Contener la información indicada en el numeral 2.3.3 del Capítulo II de la Sección General de las presentes bases. b. Identificar al integrante del consorcio a quien se efectúa el pago y emite la respectiva factura o, en caso de llevar contabilidad independiente, señalar el número de Registro Único de Contribuyente (RUC) del consorcio. c. Consignar las firmas legalizadas ante notario público de cada uno de los integrantes del consorcio, de sus apoderados o de sus representantes legales, según corresponda.
Lo indicado no excluye la información adicional que pueda consignarse en el contrato de consorcio con el objeto de regular su administración interna, como es el régimen y los sistemas de participación en los resultados del consorcio, al que se refiere el artículo 448 de la Ley N° 26887, Ley General de Sociedades. En ningún caso puede aceptarse la presentación de la promesa de consorcio que fue parte de la oferta, independientemente de que dicha promesa contenga firmas legalizadas ante notario público.
(Literal b) del numeral 88.1 del artículo 88 y el artículo 89 del Reglamento.)

c) Código de cuenta interbancaria (CCI) o, en el caso de proveedores no domiciliados, el número de cuenta bancaria y nombre de la entidad bancaria en el exterior.
El CCI es requisito indispensable para realizar una transferencia entre cuentas de bancos diferentes, siendo requerido para efectuar el pago a los proveedores domiciliados en el Perú. Para los proveedores no domiciliados, corresponde el número de cuenta bancaria y nombre de la entidad bancaria en el exterior.
(Artículo 67 de la Ley. El literal c) del numeral 88.1 del artículo 88 del Reglamento.)

d) Documento que acredite que cuenta con facultades para perfeccionar el contrato, cuando corresponda.
Corresponde a la vigencia del poder del representante legal que acredite que cuenta con facultades para perfeccionar el contrato, en caso el postor sea persona jurídica. Adicionalmente, el representante legal presenta copia de su documento de identidad (DNI o carné de extranjería, según corresponda). En el caso de personas naturales, se solicita copia de su documento de identidad (DNI o carné de extranjería, según corresponda). En el caso de consorcios, estos documentos deben ser presentados por cada uno de los integrantes que suscribieron la promesa de consorcio, según corresponda. Asimismo, debe presentarse copia del documento de identidad (DNI o carné de extranjería, según corresponda) del representante común del consorcio.
(Literal d) del numeral 88.1 del artículo 88 del Reglamento.)

e) Institución Arbitral elegida del listado de instituciones arbitrales propuesto por la entidad contratante o propuesta de tres instituciones arbitrales del postor.
Este requisito es obligatorio para todos los contratos que superen las 10 UIT (de conformidad con el numeral 84.1 del artículo 84 de la Ley, el arbitraje puede ser ad hoc solo en los casos en los que el monto de la controversia no supere las 10 UIT). Desde el 1 de enero de 2026, la institución arbitral elegida debe encontrarse inscrita en el Registro de Instituciones Arbitrales y Centros de Administración de Juntas de Prevención y Resolución de Disputas (REGAJU).
(Artículos 77, 83 y 84 de la Ley, así como la Décima Disposición Complementaria Transitoria de la Ley. El literal e) del numeral 88.1 del artículo 88 del Reglamento.)

4.2. PERFECCIONAMIENTO DEL CONTRATO
4.2.1 El postor ganador de la buena pro debe presentar los requisitos para perfeccionar el contrato dentro del plazo de ocho o cinco días hábiles, según corresponda, plazo que se contabiliza desde el día siguiente al registro del consentimiento de la buena pro en el SEACE de la Pladicop o desde que ésta haya quedado administrativamente firme, de conformidad con el procedimiento y plazos dispuestos en los artículos 88, 89, 90 y 91 del Reglamento.
4.2.2. El contrato se suscribe mediante firma digital, siempre que el postor ganador de la buena pro cuente con certificado digital emitido por una entidad de certificación, de acuerdo con la normativa de la materia; caso contrario, se suscribe manualmente.
4.2.3. De conformidad con el numeral 87.3 del artículo 87 del Reglamento, excepcionalmente, la entidad contratante puede sustentar la imposibilidad de suscribir el contrato mediante firma digital, supuesto en el cual la suscripción se realiza manualmente.

4.3. CONSIDERACIONES PARA LOS CONSORCIOS
4.3.1 Las garantías que presenten los consorcios para el perfeccionamiento del contrato durante la ejecución contractual y para la interposición de los recursos impugnativos, además de cumplir con las condiciones establecidas en la Ley y el Reglamento, deben consignar expresamente el nombre completo o la denominación o razón social de los integrantes del consorcio, en calidad de garantizados, de lo contrario no pueden ser aceptadas por las entidades contratantes o el Tribunal de Contrataciones Públicas. No se cumple el requisito antes indicado si se consigna únicamente la denominación del consorcio.
4.3.2 La retención del 10% del monto del contrato original en calidad de garantía de fiel cumplimiento aplica cuando la cuantía adjudicada sea igual o menor a S/ 480 000,00 (Cuatrocientos ochenta mil y 00/100 Soles). En el caso de micro o pequeñas empresas que hayan declarado en su oferta tal condición, no aplica dicho umbral, según lo señalado en el artículo 114 del Reglamento. En caso de consorcio, aplica dicha retención si todos sus integrantes declaran en su oferta la condición de micro o pequeña empresa.

4.4. CONSIDERACIONES PARA LAS GARANTÍAS FINANCIERAS
4.4.1. En caso de garantías financieras, estas deben ser incondicionales, solidarias, irrevocables y de realización automática en el país, al solo requerimiento de la respectiva entidad contratante bajo responsabilidad de las empresas que las emiten. Las empresas que emitan garantías financieras deben encontrarse bajo la supervisión directa de la Superintendencia de Banca, Seguros y Administradoras Privadas de Fondos de Pensiones (en adelante, SBS), contar con clasificación de riesgo B o superior, y deben estar autorizadas para emitir garantías o estar consideradas en la última lista de bancos extranjeros de primera categoría que periódicamente publica el Banco Central de Reserva del Perú.
4.4.2. La clasificadora de riesgo que asigna la clasificación a la empresa que emite la garantía debe encontrarse listada en el portal web de la SBS (http://www.sbs.gob.pe/sistema-financiero/clasificadoras-de-riesgo).
4.4.3. Se debe identificar en la página web de la clasificadora de riesgo respectiva, cuál es la clasificación vigente de la empresa que emite la garantía, considerando la vigencia a la fecha de emisión de la garantía. Para fines de lo establecido en el artículo 61 de la Ley, se requiere la clasificación de riesgo B o superior.
4.4.4. Si la empresa que otorga la garantía cuenta con más de una clasificación de riesgo emitida por distintas empresas listadas en la sede digital de la SBS, basta que en una de ellas cumpla con la clasificación mínima establecida en la Ley.
4.4.5. En caso exista alguna duda sobre la clasificación de riesgo asignada a la empresa emisora de la garantía, se debe consultar a la clasificadora de riesgos respectiva.
4.4.6. Además de cumplir con el requisito referido a la clasificación de riesgo, a efectos de verificar si la empresa emisora se encuentra autorizada por la SBS para emitir garantías, debe revisarse la sede digital de dicha entidad (http://www.sbs.gob.pe/sistema-financiero/relacion-de-empresas-que-se-encuentran-autorizadas-a-emitir-cartas-fianza).

4.5. CONSIDERACIONES PARA LOS DOCUMENTOS EXTENDIDOS EN EL EXTRANJERO
En el caso que los documentos requeridos para el perfeccionamiento del contrato incluyan documentos públicos extendidos en el exterior, que no les sea aplicable el Convenio de la Apostilla, se debe tener en cuenta que, de conformidad con lo previsto en el artículo 137 del Reglamento Consular del Perú, aprobado mediante Decreto Supremo N° 032-2023-RE, para que estos surtan efectos legales en el Perú deben estar legalizados por los funcionarios consulares peruanos competentes, cuyas firmas deben ser autenticadas posteriormente por el área competente del órgano de línea consular, además de cumplir con los requisitos adicionales que contemple la legislación peruana para su validez en el Perú. Cuando se trate de documentos privados extendidos en el exterior, el funcionario consular sólo legaliza las firmas cuando hayan sido suscritas en su presencia o cuando conste de modo indubitable su autenticidad, verificando en ambos casos la identidad de los firmantes, conforme lo requiere el artículo 138 del citado Reglamento.

4.6. DISPOSICIONES FINALES
Todos los demás aspectos del presente procedimiento de selección no contemplados en las bases se rigen por la Ley y su Reglamento, así como por las disposiciones legales vigentes.
`.trim();

// Transcrita a mano leyendo el texto de capa del PDF oficial de "consultoría
// de obra" (actuaciones-preparatorias/bases/7614342-12-bases-estandar-concurso-publico-para-consultor-a-de-obra.pdf),
// mismo método que las anteriores. Misma advertencia de fidelidad.
//
// Segunda variante de VARIANTES_AMBIGUAS (ver lib/bases-plantillas.ts más
// abajo): se registra bajo un nombre propio, no bajo el value ambiguo del
// catálogo, por el mismo motivo que "consultoría en general".
//
// Diferencias reales confirmadas contra bienes/servicios/consultoría en
// general (no asumidas): el requisito de garantía de fiel cumplimiento NO
// incluye "fideicomiso" como opción (solo carta fianza financiera, contrato
// de seguro o retención de pago) y tampoco tiene el párrafo de "Excepciones"
// para contratos ≤ 50 UIT que sí tienen los otros tres tipos — se transcribe
// tal cual, sin agregar esa excepción que aquí no existe.
const SECCION_GENERAL_CONSULTORIA_OBRA = `
CAPÍTULO I
ASPECTOS GENERALES

1.1. REFERENCIAS
Cuando en el presente documento se mencione la palabra "Ley", se entiende que se está haciendo referencia a la Ley N° 32069, Ley General de Contrataciones Públicas, y cuando se mencione la palabra "Reglamento", se entiende que se está haciendo referencia al Reglamento de la Ley N° 32069, Ley General de Contrataciones Públicas, aprobado por Decreto Supremo N° 009-2025-EF. Las referidas normas incluyen sus respectivas modificaciones, de ser el caso.

1.2. ALCANCE
La presente base estándar es utilizada por la entidad contratante para la contratación de servicios de consultoría de obra según la cuantía establecida en la Ley de Presupuesto del Sector Público para el Año Fiscal correspondiente.

CAPÍTULO II
DESARROLLO DEL PROCEDIMIENTO DE SELECCIÓN

2.1 ETAPAS DEL CONCURSO PÚBLICO PARA CONSULTORÍA DE OBRA
Los evaluadores del procedimiento de selección pueden ser comité o jurado: en caso la entidad contratante haya designado un comité para conducir el procedimiento de selección, este se encarga de la evaluación de las ofertas de los postores de forma colegiada, siendo solidariamente responsables por dicha evaluación, salvo que dejen constancia de su voto en discordia en el acta correspondiente con el respectivo sustento. En caso la entidad contratante haya designado un jurado para la evaluación de las ofertas de los postores, la DEC se encarga de la recepción de las ofertas, de la revisión de los documentos para la admisión y los requisitos de calificación de las ofertas; así como de su remisión a cada uno de los expertos que conforman el jurado, quienes realizan individualmente la evaluación técnica y económica de las mismas y remiten los puntajes asignados a la DEC para su publicación y otorgamiento de la buena pro.

Las etapas del presente procedimiento de selección son las siguientes (de conformidad con el numeral 27.1 del artículo 27 de la Ley, la facultad para actuar discrecionalmente se fundamenta en el rigor técnico empleado por los funcionarios y servidores, dependencias y unidades de organización encargadas de las contrataciones públicas para optar por la mejor decisión debidamente sustentada que permita el cumplimiento oportuno de los fines públicos):

a) Convocatoria. Se realiza a través del SEACE de la Pladicop en la fecha señalada en el cronograma. (Artículos 63 y 64 del Reglamento.)

b) Registro de participantes. Aplica lista abierta, por lo que cualquier proveedor puede registrarse como participante en el procedimiento de selección. (Artículos 65 y 94 del Reglamento.)

c) Cuestionamientos a las bases (consultas, observaciones e integración):
1. La presentación de consultas y/u observaciones se realiza en un plazo no menor a siete días hábiles contabilizados desde el día siguiente de la convocatoria.
2. La absolución de los referidos cuestionamientos y la publicación de las bases integradas se realiza en la fecha prevista en el cronograma del procedimiento de selección.
3. El pliego de absolución de consultas y observaciones, así como las bases integradas pueden ser cuestionadas por los participantes, para su elevación ante el OECE, dentro de los tres días hábiles siguientes de publicado el pliego de absolución de consultas y observaciones e integración de bases. La entidad contratante realiza la elevación de conformidad con la directiva del OECE.
4. La entidad contratante solo puede omitir la elevación al OECE del pliego de absolución de consultas y observaciones y las bases integradas en caso se haya utilizado la herramienta de difusión del requerimiento en la interacción con el mercado.
(Artículos 51, 62, 66, 67 y 94 del Reglamento.)

d) Evaluación de ofertas técnicas y económicas:
1. La presentación de ofertas se realiza a través del SEACE de la Pladicop desde las 00:01 hasta las 23:59 horas (hora peruana) de la fecha prevista en el cronograma del procedimiento de selección. Dicha fecha no puede ser fijada en menos de siete días hábiles desde la publicación de la integración de bases o el pronunciamiento con la integración definitiva de bases por parte del OECE.
2. La presentación de ofertas se realiza adjuntando el archivo digitalizado que contenga los documentos que la conforman, según lo requerido en las bases (los formularios electrónicos del SEACE de la Pladicop que los participantes deben registrar para presentar sus ofertas, tienen carácter de declaración jurada).
3. La evaluación de ofertas es SIN PRECALIFICACIÓN y consiste en:
   a. Admisión de las ofertas: los evaluadores o la DEC, según corresponda, revisan que la oferta contenga los documentos señalados en el Capítulo II de la Sección Específica de las bases, caso contrario la oferta se considera no admitida.
   b. Revisión de los requisitos de calificación: los evaluadores o la DEC, según corresponda, califican a los postores verificando que cumplan con los requisitos de calificación detallados en el Capítulo III de la Sección Específica de las bases. Caso contrario la oferta se considera descalificada.
   c. Evaluación de ofertas técnicas: los evaluadores aplican los factores de evaluación previstos en el Capítulo IV de la Sección Específica de las bases a las ofertas que cumplen los requisitos de calificación. En la Sección Específica se prevé un puntaje mínimo en la evaluación técnica para proceder a la evaluación económica de la oferta.
   d. Evaluación de ofertas económicas: esta evaluación es posterior a la evaluación técnica y solo respecto de aquellos proveedores que hubieran obtenido o superado el puntaje mínimo en la evaluación técnica. En los procedimientos de selección de consultoría de obra, la cuantía de la contratación es punto de referencia para las ofertas, aplicándose el método de evaluación de la oferta económica limitada, en la cual la oferta económica de los postores no debe ser menor al 90% de la cuantía de la contratación. Para la determinación de los límites de la cuantía de la contratación, si el límite inferior tiene más de dos (2) decimales, se aumenta en un dígito el valor del segundo decimal, sin efectuar el redondeo matemático. Los evaluadores descalifican las propuestas que no cumplan con el referido límite.
4. Todos los actos se realizan a través del SEACE de la Pladicop, incluyendo la subsanación de ofertas.
(Artículos 68, 70, 71, 72, 73, 74, 75, 78 y 166 del Reglamento.)

Oferta económica de mejor puntaje que supera la cuantía de la contratación: en caso la oferta económica del postor que obtiene el mejor puntaje total supere la cuantía de la contratación, se siguen los siguientes pasos, de conformidad con el artículo 167 del Reglamento:
a) La DEC gestiona la solicitud de la ampliación de la certificación de crédito presupuestario y/o previsión presupuestal correspondiente. De otorgarse la ampliación, se procede a adjudicar la buena pro.
b) De no contar con la ampliación de la certificación de crédito presupuestario y/o previsión presupuestal, los evaluadores negocian con el postor que obtuvo el mejor puntaje total, conforme al numeral 167.1 del artículo 167 del Reglamento, en este orden: i) la reducción de su oferta económica y ii) la reducción de determinadas prestaciones o condiciones del requerimiento, previa no objeción del área usuaria. No pueden negociarse las condiciones que dieron lugar al otorgamiento de puntaje en los factores de evaluación correspondientes a la oferta técnica o aquellos establecidos como no negociables en el requerimiento. La finalidad pública de la contratación no debe ser afectada.
c) En caso el postor con el mejor puntaje no acepte la reducción del monto o la reducción de las prestaciones o condiciones del requerimiento, se procede a negociar con los siguientes postores en el orden de prelación que obtuvieron. Si el postor que sigue en el orden de prelación ofertó un monto igual o menor al de la cuantía de la contratación, se le adjudica la buena pro.
d) En caso el postor que obtuvo el mejor puntaje total reduzca su oferta económica pero la reducción no se encuentre dentro de la cuantía de la contratación, se solicita la ampliación de la certificación de crédito presupuestario y/o previsión presupuestal correspondiente. En caso se otorgue la ampliación, se adjudica la buena pro. Caso contrario, se puede optar por: negociar con los siguientes postores (siempre que hayan obtenido el puntaje mínimo en la evaluación técnica) en el orden de prelación o declarar desierto el procedimiento de selección.
e) Las decisiones adoptadas por los evaluadores en la negociación constan en actas que se publican en el SEACE de la Pladicop y se sustentan en el principio de valor por dinero, priorizando el cumplimiento de la finalidad pública de la contratación.

e) Otorgamiento de la buena pro:
1. Determinada la oferta ganadora, los evaluadores o la DEC, según corresponda, otorgan la buena pro, mediante su publicación en el SEACE de la Pladicop, incluyendo los documentos que sustenten los resultados de la admisión, calificación, evaluación y el otorgamiento de la buena pro.
2. En caso de haber sorteo por desempate, éste se realiza a través del SEACE de la Pladicop.
3. En caso se hayan presentado dos o más ofertas, el consentimiento de la buena pro se produce y registra a través del SEACE de la Pladicop al día siguiente de vencido el plazo correspondiente para interponer recurso de apelación, sin que los postores hayan ejercido el derecho de interponer dicho recurso.
4. En caso de que se haya presentado una sola oferta, el consentimiento de la buena pro se produce el mismo día de la notificación de su otorgamiento y se registra en el SEACE de la Pladicop al día siguiente.
(Artículos 80, 81, 82, 83 y 84 del Reglamento.)

2.2 CONSIDERACIONES PARA TODOS LOS PROVEEDORES:
2.2.1 Para registrarse como participante en un procedimiento de selección convocado por una entidad contratante, es necesario que los proveedores cuenten con inscripción vigente ante el Registro Nacional de Proveedores (RNP) que administra el Organismo Especializado para las Contrataciones Públicas Eficientes (OECE) en el registro correspondiente al objeto del procedimiento de selección. Para obtener mayor información, se puede ingresar a la siguiente dirección electrónica: www.rnp.gob.pe.
2.2.2 Los proveedores que deseen registrar su participación deben ingresar al SEACE de la Pladicop utilizando su certificado (usuario y contraseña).
2.2.3 No pueden formularse consultas ni observaciones respecto del contenido de una ficha técnica o ficha de homologación aprobada, aun cuando el requerimiento haya sido estandarizado parcialmente respecto de las características técnicas y/o requisitos de calificación y/o condiciones de ejecución. Las consultas y observaciones que se formulen sobre el particular se tienen como no presentadas.
2.2.4 Las declaraciones juradas, formatos o formularios previstos en las bases que conforman la oferta deben estar debidamente firmados por el postor (firma manuscrita o digital, según la Ley Nº 27269, Ley de Firmas y Certificados Digitales). No se acepta insertar la imagen de una firma. El postor, el representante legal o común, apoderado o mandatario designado, se hace responsable de la totalidad de los documentos incluidos en la oferta. El postor es responsable de verificar, antes de su envío, que los archivos puedan ser descargados y su contenido sea legible. En caso la información contenida en los documentos que conforman la oferta no coincida con lo declarado a través del SEACE de la Pladicop, prevalece la información declarada en los documentos de la oferta.

Advertencia: en caso el proveedor emplee la firma digital como una única firma en los documentos que conforman la oferta, esta es suficiente para que el documento sea considerado firmado legalmente.

2.2.5 En el caso que al registrarse como participante el proveedor presente una declaración jurada de desafectación del impedimento debido al parentesco establecido en el inciso 2 del numeral 30.1 del artículo 30 de la Ley, debe presentar adicionalmente para la admisión de su oferta la acreditación documental de su condición de desafectación, conforme a lo indicado en el literal f) del numeral 2.2.1.1. del Capítulo II de la Sección Específica de las bases.

2.3 CONSIDERACIONES ADICIONALES PARA LOS CONSORCIOS:
2.3.1 En el caso de consorcios, basta que uno de sus integrantes se haya registrado como participante en el procedimiento de selección, para lo cual dicho integrante debe contar con inscripción vigente en el RNP como consultor de obra. Los demás integrantes del consorcio deben contar con inscripción vigente en el RNP en las demás etapas del procedimiento de selección. Cada integrante del consorcio debe estar inscrito en el RNP como consultor de obra en al menos una de las especialidades requeridas por la entidad contratante, siempre que en conjunto cumplan con todas las especialidades exigidas. No se considera consorcio a la asociación de personas de duración ilimitada o indefinida que, denominándose consorcios, han sido constituidas como personas jurídicas en los Registros Públicos.
2.3.2 Los integrantes de un consorcio no pueden presentar ofertas individuales ni conformar más de un consorcio en un procedimiento de selección, o en un determinado ítem, cuando se trate de procedimientos de selección según relación de ítems. En este segundo supuesto, los integrantes del consorcio pueden participar en ítems distintos a aquel en el que se presentaron en consorcio, sea en forma individual o en consorcio.
2.3.3 Como parte de los documentos de su oferta el consorcio debe presentar la promesa de consorcio con firmas digitales de todos sus integrantes o, en su defecto, firmas legalizadas, de ser el caso, conforme a lo establecido en el literal d) del numeral 69.1 del artículo 69 del Reglamento. La promesa de consorcio debe consignar, como mínimo, lo siguiente:
a) La identificación de los integrantes del consorcio. Se debe precisar el nombre completo o la denominación o razón social de los integrantes del consorcio, según corresponda.
b) La designación del representante común del consorcio.
c) El domicilio común del consorcio.
d) El correo electrónico común del consorcio, al cual se dirigen todas las comunicaciones remitidas por la entidad contratante al consorcio durante el proceso de contratación, siendo éste el único válido para todos los efectos.
e) Las obligaciones que correspondan a cada uno de los integrantes del consorcio.
f) El porcentaje del total de las obligaciones de cada uno de los integrantes respecto del objeto del contrato. Dicho porcentaje debe ser expresado en número entero, sin decimales.
2.3.4 La información contenida en los literales a), e) y f) precedentes no puede ser modificada con ocasión de la suscripción del contrato de consorcio, ni durante la etapa de ejecución contractual. En tal sentido, no cabe variación alguna en la conformación del consorcio, por lo que no es posible que se incorpore, sustituya o separe a un integrante.
2.3.5 El representante común tiene facultades para actuar en nombre y representación del consorcio, en todos los actos referidos al procedimiento de selección, suscripción y ejecución del contrato, con poderes suficientes para ejercitar los derechos y cumplir las obligaciones que se deriven de su calidad de postor y de contratista hasta la conformidad o liquidación del contrato, según corresponda. El representante común no debe encontrarse impedido, inhabilitado ni suspendido para contratar con el Estado. Para cambiar al representante común, todos los integrantes del consorcio deben firmar (mediante firmas legalizadas o firmas digitales) el documento en el que conste el acuerdo, el cual surte efectos cuando es notificado a la entidad contratante.
2.3.6 Las declaraciones juradas, formatos o formularios previstos en las bases que conforman la oferta deben estar debidamente firmados por el representante común, por todos los integrantes del consorcio o de forma independiente por cada consorciado, según corresponda (firma manuscrita o digital, según la Ley Nº 27269, Ley de Firmas y Certificados Digitales). En el caso de los documentos que deban suscribir todos los integrantes del consorcio, la firma es seguida de la razón social o denominación de cada uno de ellos. Lo mismo aplica en caso deban ser suscritos en forma independiente por cada integrante del consorcio, de acuerdo con lo establecido en los documentos del procedimiento de selección. En el caso de un consorcio integrado por una persona natural, basta que la persona natural indique debajo de su firma, sus nombres y apellidos completos.
2.3.7 La acreditación del requisito de calificación de la experiencia del postor se realiza en base a la documentación aportada por los integrantes del consorcio que se hubieran comprometido a ejecutar conjuntamente las obligaciones vinculadas directamente con el objeto materia de la contratación, de acuerdo con lo declarado en la promesa de consorcio. Para ello se debe seguir los siguientes pasos: a) Primer paso: obtener el monto de facturación por cada integrante del consorcio, el cual se obtiene de la sumatoria de montos facturados por éste que, a criterio del evaluador han sido acreditados conforme a las bases, correspondiente a las contrataciones ejecutadas en forma individual y/o consorcio. En caso un integrante del consorcio presente facturación de contrataciones ejecutadas en consorcio, se considera el monto que corresponda al porcentaje de las obligaciones del referido integrante del consorcio. Este porcentaje debe estar consignado expresamente en la promesa o en el contrato de consorcio, de lo contrario, no se considera la experiencia ofertada en consorcio. b) Segundo paso: verificar si el integrante del consorcio que acredita la mayor experiencia cumple con un determinado porcentaje de participación. En caso la entidad contratante haya establecido en las bases un porcentaje determinado de participación en la ejecución del contrato, para el integrante del consorcio que acredite mayor experiencia, debe verificarse que éste cumple con dicho parámetro a efectos de considerar su experiencia. La mayor experiencia que se acredita se refiere a la experiencia en la especialidad requerida. c) Tercer paso: sumatoria de experiencia de los consorciados. Para obtener la experiencia del consorcio se suma el monto de facturación aportado por cada integrante que cumple con lo señalado previamente.
2.3.8 Para calificar la experiencia del postor no se toma en cuenta la documentación presentada por el o los consorciados que asumen las obligaciones referidas a las siguientes actividades: i) actividades de carácter administrativo o de gestión como facturación, financiamiento, aporte de garantías, entre otras; ii) actividades relacionadas con asuntos de organización interna, tales como representación u otros aspectos que no se relacionan con la ejecución de las prestaciones, entre otras.
2.3.9 En los procedimientos de selección por paquete para la elaboración de las fichas técnicas, estudios de preinversión o expedientes técnicos; así como para la supervisión de la elaboración de expedientes técnicos o de la ejecución de obras, los integrantes del consorcio deben contar con inscripción en el RNP como proveedores de servicios o consultores de obra, según la obligación asumida en la promesa de consorcio, conforme a lo siguiente: i) los integrantes del consorcio que se hayan obligado a elaborar la ficha técnica o los estudios de preinversión deben encontrarse inscritos en el RNP como proveedores de servicios o como consultores de obra; ii) los integrantes del consorcio que se hayan obligado a elaborar el expediente técnico de obra deben encontrarse inscritos como consultores de obra en la categoría de "elaboración del expediente técnico de obra" del RNP, asimismo, en atención a la Cuarta Disposición Complementaria Transitoria del Reglamento, cada integrante del consorcio que se obligue a elaborar el expediente técnico debe contar con la especialidad y categoría que corresponda.
2.3.10 Respecto de la categoría es aplicable el primer numeral de la Cuarta Disposición Complementaria Transitoria del Reglamento, según el cual la implementación del proceso para la asignación de las categorías establecidas en el numeral 27.2 de su artículo 27 es progresiva y tiene un plazo de ciento ochenta días contados desde el día siguiente de la entrada en vigencia del Reglamento.
2.3.11 Los integrantes del consorcio son responsables de que su inscripción en el RNP se encuentre vigente, así como de no estar inhabilitados o suspendidos al registrarse como participantes, a la presentación de ofertas, al otorgamiento de la buena pro y al perfeccionamiento del contrato.
2.3.12 Los integrantes de un consorcio se encuentran obligados solidariamente a responder frente a la entidad contratante por los efectos patrimoniales que ésta sufra como consecuencia de la actuación de dichos integrantes, ya sea individual o conjunta, durante el procedimiento de selección y la ejecución contractual.

CAPÍTULO III
RECURSO DE APELACIÓN

3.1. ACCESO AL EXPEDIENTE DE CONTRATACIÓN
Una vez otorgada la buena pro, la DEC está en la obligación de permitir el acceso de los participantes y postores al expediente de contratación, con excepción de la información calificada como secreta, confidencial o reservada por la normativa de la materia y de aquella correspondiente a las ofertas que no fueron admitidas, a más tardar dentro del día hábil siguiente de haberse solicitado por escrito. A efectos de recoger la información de su interés, los participantes y postores pueden valerse de distintos medios, tales como: (i) la lectura y/o toma de apuntes, (ii) la captura y almacenamiento de imágenes, e incluso (iii) pueden solicitar copia de la documentación obrante en el expediente, siendo que, en este último caso, la entidad contratante debe entregar dicha documentación en el menor tiempo posible, previo pago de la tasa por tal concepto previsto en el Texto Único de Procedimientos Administrativos (TUPA) de la respectiva entidad contratante.

3.2. RECURSO DE APELACIÓN
A través del recurso de apelación se pueden impugnar los actos dictados durante el desarrollo del procedimiento de selección hasta antes del perfeccionamiento del contrato, incluyendo aquellos que declaren la nulidad de oficio, la cancelación del procedimiento de selección y otros actos emitidos por la entidad contratante que afecten la continuidad de este. El recurso de apelación se presenta ante la mesa de partes digital o física del Tribunal de Contrataciones Públicas y es resuelto por éste.

3.3. PLAZOS DE INTERPOSICIÓN DEL RECURSO DE APELACIÓN
La apelación contra el otorgamiento de la buena pro o contra los actos dictados con anterioridad a ella se interpone, como máximo, dentro de los ocho días hábiles siguientes de haberse notificado el otorgamiento de la buena pro a través del SEACE de la Pladicop. En el caso de la apelación contra los actos dictados con posterioridad al otorgamiento de la buena pro, contra la declaración de nulidad, cancelación y declaratoria de desierto del procedimiento de selección, el plazo indicado en el párrafo precedente se contabiliza desde que se toma conocimiento del acto que se desea impugnar. Se considera que se ha tomado conocimiento en el día de la publicación en el SEACE de la Pladicop del acto que se desea impugnar.

CAPÍTULO IV
DEL CONTRATO

4.1. REQUISITOS PARA EL PERFECCIONAMIENTO DEL CONTRATO
Para perfeccionar el contrato, el postor o postores ganadores de la buena pro presentan los siguientes requisitos de conformidad con el artículo 88 del Reglamento:

a) Garantías, salvo casos de excepción.
El postor ganador de la buena pro presenta una garantía de fiel cumplimiento por una suma equivalente al 10% del monto del contrato original. La garantía de fiel cumplimiento puede ser: (i) carta fianza financiera, (ii) contrato de seguro, o (iii) retención de pago. Asimismo, en la Sección Específica de las bases pueden considerarse la presentación de: i) garantía de fiel cumplimiento de prestaciones accesorias, y ii) garantía por adelantos directos, siempre que se cumplan las condiciones señaladas en el Reglamento. La retención de pago como garantía de fiel cumplimiento o de prestaciones accesorias aplica para contrataciones cuya cuantía adjudicada sea igual o menor a S/ 480 000,00 (cuatrocientos ochenta mil y 00/100 soles). En el caso de las micro y pequeñas empresas estas pueden otorgar como garantía de fiel cumplimiento la retención de pago por parte de la entidad contratante con independencia de la cuantía de la contratación.
(Numerales 61.4 y 61.5 del artículo 61 de la Ley. Literal a) del numeral 88.1 del artículo 88, y los artículos 113, 114, 115, 116, 137, 139 y 178 del Reglamento.)

b) Contrato de consorcio, de ser el caso.
El contrato de consorcio debe cumplir con los siguientes requisitos: a. Contener la información indicada en el numeral 2.3.3 del Capítulo II de la Sección General de las presentes bases. b. Identificar al integrante del consorcio a quien se efectúa el pago y emite la respectiva factura o, en caso de llevar contabilidad independiente, señalar el número de Registro Único de Contribuyente (RUC) del consorcio. c. Consignar las firmas legalizadas ante notario público de cada uno de los integrantes del consorcio, de sus apoderados o de sus representantes legales, según corresponda.
Lo indicado no excluye la información adicional que pueda consignarse en el contrato de consorcio con el objeto de regular su administración interna, como es el régimen y los sistemas de participación en los resultados del consorcio, al que se refiere el artículo 448 de la Ley N° 26887, Ley General de Sociedades. En ningún caso puede aceptarse la presentación de la promesa de consorcio que fue parte de la oferta, independientemente de que dicha promesa contenga firmas legalizadas ante notario público.
(Literal b) del numeral 88.1 del artículo 88 y el artículo 89 del Reglamento.)

c) Código de cuenta interbancaria (CCI) o, en el caso de proveedores no domiciliados, el número de cuenta bancaria y nombre de la entidad bancaria en el exterior.
El CCI es requisito indispensable para realizar una transferencia entre cuentas de bancos diferentes, siendo requerido para efectuar el pago a los proveedores domiciliados en el Perú. Para los proveedores no domiciliados, corresponde el número de cuenta bancaria y nombre de la entidad bancaria en el exterior.
(Artículo 67 de la Ley. El literal c) del numeral 88.1 del artículo 88 del Reglamento.)

d) Documento que acredite que cuenta con facultades para perfeccionar el contrato, cuando corresponda.
Corresponde a la vigencia del poder del representante legal que acredite que cuenta con facultades para perfeccionar el contrato, en caso el postor sea persona jurídica. Adicionalmente, el representante legal presenta copia de su documento de identidad (DNI o carné de extranjería, según corresponda). En el caso de personas naturales, se solicita copia de su documento de identidad (DNI o carné de extranjería, según corresponda). En el caso de consorcios, estos documentos deben ser presentados por cada uno de los integrantes que suscribieron la promesa de consorcio, según corresponda. Asimismo, debe presentarse copia del documento de identidad (DNI o carné de extranjería, según corresponda) del representante común del consorcio.
(Literal d) del numeral 88.1 del artículo 88 del Reglamento.)

e) Institución Arbitral elegida del listado de instituciones arbitrales propuesto por la entidad contratante o propuesta de tres instituciones arbitrales del postor.
Este requisito es obligatorio para todos los contratos que superen las 10 UIT (de conformidad con el numeral 84.1 del artículo 84 de la Ley, el arbitraje puede ser ad hoc solo en los casos en los que el monto de la controversia no supere las 10 UIT). Desde el 1 de enero de 2026, la institución arbitral elegida debe encontrarse inscrita en el Registro de Instituciones Arbitrales y Centros de Administración de Juntas de Prevención y Resolución de Disputas (REGAJU).
(Artículos 77, 83 y 84 de la Ley, así como la Décima Disposición Complementaria Transitoria de la Ley. El literal e) del numeral 88.1 del artículo 88 del Reglamento.)

4.2. PERFECCIONAMIENTO DEL CONTRATO
4.2.1. El postor ganador de la buena pro debe presentar los requisitos para perfeccionar el contrato dentro del plazo de ocho o cinco días hábiles, según corresponda, plazo que se contabiliza desde el día siguiente del registro del consentimiento de la buena pro en el SEACE de la Pladicop o desde que ésta haya quedado administrativamente firme, de conformidad con el procedimiento y plazos dispuestos en los artículos 88, 89, 90, 91 y 168 del Reglamento.
4.2.2. El contrato se suscribe mediante firma digital, siempre que el postor ganador de la buena pro cuente con certificado digital emitido por una entidad de certificación, de acuerdo con la normativa de la materia; caso contrario, se suscribe manualmente.
4.2.3. De conformidad con el numeral 87.3 del artículo 87 del Reglamento, excepcionalmente, la entidad contratante puede sustentar la imposibilidad de suscribir el contrato mediante firma digital, supuesto en el cual la suscripción se realiza manualmente.

4.3. CONSIDERACIONES PARA LOS CONSORCIOS
4.3.1 Las garantías que presenten los consorcios para el perfeccionamiento del contrato durante la ejecución contractual y para la interposición de los recursos impugnativos, además de cumplir con las condiciones establecidas en la Ley y el Reglamento, deben consignar expresamente el nombre completo o la denominación o razón social de los integrantes del consorcio, en calidad de garantizados, de lo contrario no pueden ser aceptadas por las entidades contratantes o el Tribunal de Contrataciones Públicas. No se cumple el requisito antes indicado si se consigna únicamente la denominación del consorcio.
4.3.2 La retención del 10% del monto del contrato original en calidad de garantía de fiel cumplimiento aplica cuando la cuantía adjudicada sea igual o menor a S/ 480 000,00 (Cuatrocientos ochenta mil y 00/100 Soles). En el caso de micro o pequeñas empresas que hayan declarado en su oferta tal condición, no aplica dicho umbral, según lo señalado en el artículo 114 del Reglamento. En caso de consorcio, aplica dicha retención si todos sus integrantes declaran en su oferta la condición de micro o pequeña empresa.

4.4. CONSIDERACIONES PARA LAS GARANTÍAS FINANCIERAS
4.4.1. En caso de garantías financieras, estas deben ser incondicionales, solidarias, irrevocables y de realización automática en el país, al solo requerimiento de la respectiva entidad contratante bajo responsabilidad de las empresas que las emiten. Las empresas que emitan garantías financieras deben encontrarse bajo la supervisión directa de la Superintendencia de Banca, Seguros y Administradoras Privadas de Fondos de Pensiones, contar con clasificación de riesgo B o superior, y deben estar autorizadas para emitir garantías o estar consideradas en la última lista de bancos extranjeros de primera categoría que periódicamente publica el Banco Central de Reserva del Perú.
4.4.2. La clasificadora de riesgo que asigna la clasificación a la empresa que emite la garantía debe encontrarse listada en el portal web de la SBS (http://www.sbs.gob.pe/sistema-financiero/clasificadoras-de-riesgo).
4.4.3. Se debe identificar en la página web de la clasificadora de riesgo respectiva, cuál es la clasificación vigente de la empresa que emite la garantía, considerando la vigencia a la fecha de emisión de la garantía. Para fines de lo establecido en el artículo 61 de la Ley, se requiere la clasificación de riesgo B o superior.
4.4.4. Si la empresa que otorga la garantía cuenta con más de una clasificación de riesgo emitida por distintas empresas listadas en la sede digital de la SBS, basta que en una de ellas cumpla con la clasificación mínima establecida en la Ley.
4.4.5. En caso exista alguna duda sobre la clasificación de riesgo asignada a la empresa emisora de la garantía, se debe consultar a la clasificadora de riesgos respectiva.
4.4.6. Además de cumplir con el requisito referido a la clasificación de riesgo, a efectos de verificar si la empresa emisora se encuentra autorizada por la SBS para emitir garantías, debe revisarse la sede digital de dicha entidad (http://www.sbs.gob.pe/sistema-financiero/relacion-de-empresas-que-se-encuentran-autorizadas-a-emitir-cartas-fianza).

4.5. CONSIDERACIONES PARA LOS DOCUMENTOS EXTENDIDOS EN EL EXTRANJERO
En el caso que los documentos requeridos para el perfeccionamiento del contrato incluyan documentos públicos extendidos en el exterior, que no les sea aplicable el Convenio de la Apostilla, se debe tener en cuenta que, de conformidad con lo previsto en el artículo 137 del Reglamento Consular del Perú, aprobado mediante Decreto Supremo N° 032-2023-RE, para que estos surtan efectos legales en el Perú deben estar legalizados por los funcionarios consulares peruanos competentes, cuyas firmas deben ser autenticadas posteriormente por el área competente del órgano de línea consular, además de cumplir con los requisitos adicionales que contemple la legislación peruana para su validez en el Perú. Cuando se trate de documentos privados extendidos en el exterior, el funcionario consular sólo legaliza las firmas cuando hayan sido suscritas en su presencia o cuando conste de modo indubitable su autenticidad, verificando en ambos casos la identidad de los firmantes, conforme lo requiere el artículo 138 del citado Reglamento.

4.6. DISPOSICIONES FINALES
Todos los demás aspectos del presente procedimiento de selección no contemplados en las bases se rigen por la Ley y su Reglamento, así como por las disposiciones legales vigentes.
`.trim();

export const PLANTILLAS_BASES: Record<string, PlantillaBases> = {
  "Licitación Pública para bienes": {
    proceso: "Licitación Pública para bienes",
    seccionGeneral: SECCION_GENERAL_BIENES,
    seccionEspecifica: [
      // Nombre y RUC de la entidad contratante: no viven en ningún hito de la
      // fase de contratación, sino en Configuración → Municipalidad
      // (entity_settings.name / entity_settings.ruc). El Task 3 los resuelve
      // desde ahí, igual que ya hacen otros exportables de Fase 1
      // (ver lib/settings-catalog.ts).
      { ruta: "cap1.entidad.nombre", label: "Nombre de la entidad", origen: "entidad" },
      { ruta: "cap1.entidad.ruc", label: "RUC de la entidad", origen: "entidad" },
      // El año fiscal no tiene campo propio en A1 (no existe "anio_fiscal" en
      // sus campos); se deja "libre" hasta confirmar en el Task 3 si conviene
      // derivarlo del año de partición del expediente en vez de inventarlo aquí.
      { ruta: "cap1.anioFiscal", label: "Año fiscal", origen: "libre" },
      { ruta: "cap3.finalidadPublica", label: "Finalidad pública de la contratación", origen: "literal", hito: "A3", campoHito: "finalidad_publica" },
      { ruta: "cap3.descripcionRequerimiento", label: "Descripción general del requerimiento", origen: "literal", hito: "A3", campoHito: "descripcion" },
      // Modalidad de pago y sistema de entrega son los DECIDIDOS por la DEC en
      // la estrategia (A4), no la propuesta del área usuaria en A3.
      { ruta: "cap3.modalidadPago", label: "Modalidad de pago", origen: "literal", hito: "A4", campoHito: "var_h_modalidad_pago" },
      { ruta: "cap3.sistemaEntrega", label: "Sistema de entrega", origen: "literal", hito: "A4", campoHito: "var_i_sistema_entrega" },

      // ===== Task 2: resto del Cap. III "Requerimiento" de la Sección
      // Específica (numerales 3.3.c-j y 3.5), leído del propio PDF de bienes. =====
      { ruta: "cap3.plazoEntrega", label: "Plazo de entrega", origen: "literal", hito: "A3", campoHito: "plazo_dias" },
      { ruta: "cap3.lugarEntrega", label: "Lugar de entrega o de prestación", origen: "literal", hito: "A3", campoHito: "lugar_entrega" },
      { ruta: "cap3.penalidadMora", label: "Penalidad por mora", origen: "literal", hito: "A3", campoHito: "penalidad_mora" },
      { ruta: "cap3.otrasPenalidades", label: "Otras penalidades", origen: "literal", hito: "A3", campoHito: "otras_penalidades" },
      { ruta: "cap3.subcontratacion", label: "Subcontratación", origen: "literal", hito: "A3", campoHito: "subcontratacion" },
      { ruta: "cap3.formulaReajuste", label: "Fórmulas de reajuste", origen: "literal", hito: "A3", campoHito: "formula_reajuste" },
      { ruta: "cap3.solucionControversias", label: "Solución de controversias contractuales", origen: "literal", hito: "A3", campoHito: "solucion_controversias" },
      // 3.5 Requisitos de calificación: el DECIDIDO por la DEC en la estrategia
      // (A4 · f), no la propuesta del área usuaria en A3.
      { ruta: "cap3.requisitosCalificacion", label: "Requisitos de calificación", origen: "literal", hito: "A4", campoHito: "var_f_requisitos_calificacion" },

      // ===== Task 2: Cap. IV "Evaluación" — factores de evaluación (4.1-4.2). =====
      { ruta: "cap4.factoresEvaluacion", label: "Factores de evaluación", origen: "literal", hito: "A4", campoHito: "factores_items" },

      // El Cap. V "Proforma del contrato" queda FUERA de este mapeo: sus datos
      // (postor ganador, DNI/RUC del contratista, fecha de suscripción, monto
      // adjudicado) no vienen de A1-A9 sino del otorgamiento de la buena pro en
      // Fase 2 (B7, ver lib/buena-pro-docx-datos.ts). Se resuelve en el Task 3/4
      // cruzando esos hitos de Fase 2, no aquí.
    ],
  },

  // "Licitación Pública de obras" — mapeo PARCIAL (equivalente al Task 1 de
  // bienes, no al Task 2): la Sección Específica de obras tiene una
  // estructura genuinamente distinta a la de bienes, confirmada leyendo el
  // PDF oficial (7614342-5-bases-estandar-licitacion-publica-de-obras.pdf):
  //
  //   - Su Capítulo III "Requerimiento" existe en DOS variantes completas
  //     (una para el sistema de entrega "diseño y construcción", p. 34-52;
  //     otra para "solo construcción", p. 53-67) — la entidad borra la que no
  //     aplica. Cada variante numera sus "Condiciones de contratación" como
  //     3.5.1-3.5.6+ con contenido propio de obras (consideraciones para el
  //     expediente técnico, responsabilidades del contratista/entidad,
  //     avances), no como el 3.3.a-j de bienes.
  //   - Su Sección Específica llega hasta un CAPÍTULO VI "Proforma del
  //     contrato" (no un Capítulo V): hay un capítulo adicional entre
  //     Evaluación y Proforma cuyo contenido no se pudo extraer de forma
  //     fiable del PDF (páginas 69-88 del documento no devolvieron texto con
  //     el extractor del proyecto — probablemente tablas/gráficos de la guía
  //     de puntuación) y por tanto NO se mapea aquí, para no inventar.
  //
  // Mapear a ciegas los campos obra_a..obra_i (Art. 154, ya capturados en A4)
  // contra esta numeración distinta habría sido adivinar la correspondencia
  // exacta sin haber leído esas páginas con el mismo cuidado que bienes. Se
  // deja para un pase dedicado (mismo molde del Task 2 de bienes), y aquí solo
  // van los campos que SÍ se pudieron confirmar con certeza contra el PDF.
  "Licitación Pública de obras": {
    proceso: "Licitación Pública de obras",
    seccionGeneral: SECCION_GENERAL_OBRAS,
    seccionEspecifica: [
      { ruta: "cap1.entidad.nombre", label: "Nombre de la entidad", origen: "entidad" },
      { ruta: "cap1.entidad.ruc", label: "RUC de la entidad", origen: "entidad" },
      { ruta: "cap1.anioFiscal", label: "Año fiscal", origen: "libre" },
      // 3.1 Finalidad pública: idéntica en ambas variantes del Cap. III
      // (diseño y construcción, p. 34; solo construcción, p. 53).
      { ruta: "cap3.finalidadPublica", label: "Finalidad pública de la contratación", origen: "literal", hito: "A3", campoHito: "finalidad_publica" },
      // 3.2 Descripción general pide el "Código Único de Inversión (CUI), de
      // corresponder" — el mismo dato que A4 ya captura para inversiones.
      { ruta: "cap3.cui", label: "Código Único de Inversión (CUI)", origen: "literal", hito: "A4", campoHito: "cui" },
      // El resto de 3.2 (nombre del proyecto, ubicación, especialidad,
      // subespecialidad, tipología, nivel de estudios de preinversión) es un
      // bloque estructurado propio de obras sin campo equivalente en ACE
      // todavía: no se fuerza contra el `descripcion` genérico de A3, que
      // perdería esa estructura. Queda para el pase dedicado (Cap. II-IV).
    ],
  },

  // "Concurso Público de servicios" — mapeo COMPLETO (mismo alcance que el
  // Task 1+2 de bienes): confirmado leyendo el PDF oficial
  // (7614342-8-bases-estandar-concurso-publico-de-servicios.pdf) que su
  // Capítulo III "Requerimiento" tiene la MISMA estructura 3.1-3.5 (a-j) que
  // bienes — a diferencia de obras, aquí no hay variantes ni numeración
  // propia — así que se reutilizan los mismos campoHito de A3/A4 (son
  // genéricos por objeto, no específicos de bienes).
  "Concurso Público de servicios": {
    proceso: "Concurso Público de servicios",
    seccionGeneral: SECCION_GENERAL_SERVICIOS,
    seccionEspecifica: [
      { ruta: "cap1.entidad.nombre", label: "Nombre de la entidad", origen: "entidad" },
      { ruta: "cap1.entidad.ruc", label: "RUC de la entidad", origen: "entidad" },
      { ruta: "cap1.anioFiscal", label: "Año fiscal", origen: "libre" },
      { ruta: "cap3.finalidadPublica", label: "Finalidad pública de la contratación", origen: "literal", hito: "A3", campoHito: "finalidad_publica" },
      { ruta: "cap3.descripcionRequerimiento", label: "Descripción general del requerimiento", origen: "literal", hito: "A3", campoHito: "descripcion" },
      { ruta: "cap3.modalidadPago", label: "Modalidad de pago", origen: "literal", hito: "A4", campoHito: "var_h_modalidad_pago" },
      { ruta: "cap3.sistemaEntrega", label: "Sistema de entrega", origen: "literal", hito: "A4", campoHito: "var_i_sistema_entrega" },
      // 3.3.c/d: "Plazo de prestación del servicio" y "Lugar de prestación del
      // servicio" — mismo dato que "plazo de entrega"/"lugar de entrega" de
      // bienes (los campos de A3 no son específicos de un objeto).
      { ruta: "cap3.plazoEntrega", label: "Plazo de prestación del servicio", origen: "literal", hito: "A3", campoHito: "plazo_dias" },
      { ruta: "cap3.lugarEntrega", label: "Lugar de prestación del servicio", origen: "literal", hito: "A3", campoHito: "lugar_entrega" },
      { ruta: "cap3.penalidadMora", label: "Penalidad por mora", origen: "literal", hito: "A3", campoHito: "penalidad_mora" },
      { ruta: "cap3.otrasPenalidades", label: "Otras penalidades", origen: "literal", hito: "A3", campoHito: "otras_penalidades" },
      { ruta: "cap3.subcontratacion", label: "Subcontratación", origen: "literal", hito: "A3", campoHito: "subcontratacion" },
      { ruta: "cap3.formulaReajuste", label: "Fórmulas de reajuste", origen: "literal", hito: "A3", campoHito: "formula_reajuste" },
      { ruta: "cap3.solucionControversias", label: "Solución de controversias contractuales", origen: "literal", hito: "A3", campoHito: "solucion_controversias" },
      { ruta: "cap3.requisitosCalificacion", label: "Requisitos de calificación", origen: "literal", hito: "A4", campoHito: "var_f_requisitos_calificacion" },
      { ruta: "cap4.factoresEvaluacion", label: "Factores de evaluación", origen: "literal", hito: "A4", campoHito: "factores_items" },
      // Cap. V "Proforma del contrato" queda fuera, mismo motivo que bienes:
      // depende de datos de Fase 2 (buena pro), no de A1-A9.
    ],
  },

  // "Concurso Público para consultoría en general" — mapeo COMPLETO, mismo
  // alcance que servicios: confirmado leyendo el PDF oficial
  // (7614342-10-bases-estandar-concurso-publico-para-consultoria-en-general.pdf)
  // que su Capítulo III tiene la misma estructura 3.1-3.3(a-j) que bienes y
  // servicios. NO se registra bajo el valor real del catálogo de
  // `lib/procesos-seleccion.ts` — ver la advertencia junto a
  // SECCION_GENERAL_CONSULTORIA_GENERAL más arriba sobre por qué.
  "Concurso Público para consultoría en general": {
    proceso: "Concurso Público para consultoría en general",
    seccionGeneral: SECCION_GENERAL_CONSULTORIA_GENERAL,
    seccionEspecifica: [
      { ruta: "cap1.entidad.nombre", label: "Nombre de la entidad", origen: "entidad" },
      { ruta: "cap1.entidad.ruc", label: "RUC de la entidad", origen: "entidad" },
      { ruta: "cap1.anioFiscal", label: "Año fiscal", origen: "libre" },
      { ruta: "cap3.finalidadPublica", label: "Finalidad pública de la contratación", origen: "literal", hito: "A3", campoHito: "finalidad_publica" },
      { ruta: "cap3.descripcionRequerimiento", label: "Descripción general del requerimiento", origen: "literal", hito: "A3", campoHito: "descripcion" },
      { ruta: "cap3.modalidadPago", label: "Modalidad de pago", origen: "literal", hito: "A4", campoHito: "var_h_modalidad_pago" },
      { ruta: "cap3.sistemaEntrega", label: "Sistema de entrega", origen: "literal", hito: "A4", campoHito: "var_i_sistema_entrega" },
      { ruta: "cap3.plazoEntrega", label: "Plazo de prestación del servicio", origen: "literal", hito: "A3", campoHito: "plazo_dias" },
      { ruta: "cap3.lugarEntrega", label: "Lugar de prestación del servicio", origen: "literal", hito: "A3", campoHito: "lugar_entrega" },
      { ruta: "cap3.penalidadMora", label: "Penalidad por mora", origen: "literal", hito: "A3", campoHito: "penalidad_mora" },
      { ruta: "cap3.otrasPenalidades", label: "Otras penalidades", origen: "literal", hito: "A3", campoHito: "otras_penalidades" },
      { ruta: "cap3.subcontratacion", label: "Subcontratación", origen: "literal", hito: "A3", campoHito: "subcontratacion" },
      { ruta: "cap3.formulaReajuste", label: "Fórmulas de reajuste", origen: "literal", hito: "A3", campoHito: "formula_reajuste" },
      { ruta: "cap3.solucionControversias", label: "Solución de controversias contractuales", origen: "literal", hito: "A3", campoHito: "solucion_controversias" },
      { ruta: "cap3.requisitosCalificacion", label: "Requisitos de calificación", origen: "literal", hito: "A4", campoHito: "var_f_requisitos_calificacion" },
      { ruta: "cap4.factoresEvaluacion", label: "Factores de evaluación", origen: "literal", hito: "A4", campoHito: "factores_items" },
      // Cap. V "Proforma del contrato" queda fuera, mismo motivo que bienes.
    ],
  },

  // "Concurso Público para consultoría de obra" — mapeo PARCIAL, mismo motivo
  // y mismo alcance que "Licitación Pública de obras": confirmado leyendo el
  // PDF oficial que su Capítulo III "Requerimiento" NO tiene la estructura
  // 3.1-3.3(a-j) de bienes/servicios/consultoría en general, sino:
  //
  //   - 3.2 "Descripción general" con un bloque estructurado propio
  //     (proyecto/CUI/ubicación/especialidad/subespecialidad/tipología) MÁS
  //     cuatro tablas alternativas a., b., c., d. según el sistema de entrega
  //     (solo formulación / solo diseño / formulación y diseño / supervisión
  //     de elaboración de expediente técnico) — la entidad usa solo la que
  //     corresponde.
  //   - Las "condiciones de contratación" no están en 3.3 sino en 3.3.5, con
  //     3.3.3 (metodologías colaborativas) y 3.3.4 (gestión de calidad) por
  //     delante, y "modalidad de pago" cita el artículo 161 (no el 130 de
  //     bienes/servicios) — es un artículo genuinamente distinto.
  //
  // Igual que con obras, mapear estos campos contra el `descripcion`/
  // `var_h_modalidad_pago` genéricos habría perdido esa estructura o citado
  // mal la base legal. Se mapea solo lo confirmado con certeza; el resto
  // queda para un pase dedicado.
  "Concurso Público para consultoría de obra": {
    proceso: "Concurso Público para consultoría de obra",
    seccionGeneral: SECCION_GENERAL_CONSULTORIA_OBRA,
    seccionEspecifica: [
      { ruta: "cap1.entidad.nombre", label: "Nombre de la entidad", origen: "entidad" },
      { ruta: "cap1.entidad.ruc", label: "RUC de la entidad", origen: "entidad" },
      { ruta: "cap1.anioFiscal", label: "Año fiscal", origen: "libre" },
      // 3.1 Finalidad pública: idéntica en su literal a la de bienes/obras.
      { ruta: "cap3.finalidadPublica", label: "Finalidad pública de la contratación", origen: "literal", hito: "A3", campoHito: "finalidad_publica" },
      // 3.2 pide "Código Único de Inversión (CUI) o código idea, de
      // corresponder" — mismo dato que A4 ya captura para inversiones.
      { ruta: "cap3.cui", label: "Código Único de Inversión (CUI)", origen: "literal", hito: "A4", campoHito: "cui" },
    ],
  },
};

export function plantillaDeProceso(proceso: string): PlantillaBases | undefined {
  return PLANTILLAS_BASES[proceso];
}

// ── Resolución de procedimientos AMBIGUOS ──────────────────────────────────
//
// Algunos `value` del catálogo (lib/procesos-seleccion.ts) resuelven a MÁS DE
// UN PDF de bases estándar del OECE — hoy solo "Concurso Público para
// consultorías y servicios de mantenimiento vial" (BASES_CONSULTORIA_VIAL:
// consultoría en general / consultoría de obra / mantenimiento vial). ACE no
// tiene un dato que distinga cuál de los tres aplica a un expediente
// concreto, así que ese `value` NUNCA tiene una entrada directa en
// PLANTILLAS_BASES (ver la advertencia junto a SECCION_GENERAL_CONSULTORIA_GENERAL).
// Este mapa conecta el `value` ambiguo con las claves de PLANTILLAS_BASES que
// SÍ identifican una plantilla sin ambigüedad, para que quien elabora las
// bases (o la ruta de exportación) pueda elegir entre ellas en vez de que el
// sistema adivine.
export const VARIANTES_AMBIGUAS: Record<string, string[]> = {
  "Concurso Público para consultorías y servicios de mantenimiento vial": [
    "Concurso Público para consultoría en general",
    "Concurso Público para consultoría de obra",
    // La tercera variante (mantenimiento vial) se agrega aquí en cuanto se
    // transcriba su propia plantilla — no antes. A partir de esta segunda
    // entrada, `resolverPlantillaAmbigua` deja de auto-resolver: con 2+
    // variantes registradas, sin `?variante=` explícito pide elegir (ver el
    // test "cuando hay 2+ variantes..." en tests/bases-plantillas.test.ts).
  ],
};

export function esProcesoAmbiguo(proceso: string): boolean {
  return proceso in VARIANTES_AMBIGUAS;
}

export type ResolucionBases =
  | { ok: true; plantilla: PlantillaBases }
  // No hay plantilla para este procedimiento, ambiguo o no.
  | { ok: false; motivo: "sin_plantilla" }
  // El procedimiento es ambiguo y hace falta que alguien elija cuál de las
  // variantes aplica (`variantes` trae las claves válidas para volver a
  // llamar con `variante`).
  | { ok: false; motivo: "ambiguo"; variantes: string[] }
  // Se pidió una `variante` que no corresponde a ese procedimiento ambiguo.
  | { ok: false; motivo: "variante_invalida"; variantes: string[] };

/**
 * Resuelve la plantilla de un procedimiento, incluidos los ambiguos.
 *
 * - Si `proceso` tiene una plantilla directa (el caso normal, 1 PDF), la
 *   devuelve — `variante` se ignora.
 * - Si `proceso` es ambiguo (varios PDF posibles) y trae exactamente UNA
 *   variante registrada todavía, se usa esa automáticamente: no tiene
 *   sentido pedirle a alguien que "elija" entre una sola opción. En cuanto
 *   se registre una segunda variante, este atajo deja de aplicar solo y
 *   pasa a exigir la elección explícita — no hay que tocar este código
 *   cuando eso ocurra.
 * - Si `proceso` es ambiguo con 2+ variantes: sin `variante`, devuelve
 *   `motivo: "ambiguo"` con la lista para que la UI arme un selector; con
 *   una `variante` que no está en la lista, `motivo: "variante_invalida"`.
 */
export function resolverPlantillaAmbigua(proceso: string, variante?: string | null): ResolucionBases {
  const directa = plantillaDeProceso(proceso);
  if (directa) return { ok: true, plantilla: directa };

  const variantes = VARIANTES_AMBIGUAS[proceso];
  if (!variantes || variantes.length === 0) return { ok: false, motivo: "sin_plantilla" };

  if (variante) {
    if (!variantes.includes(variante)) return { ok: false, motivo: "variante_invalida", variantes };
    const plantilla = plantillaDeProceso(variante);
    if (!plantilla) return { ok: false, motivo: "variante_invalida", variantes };
    return { ok: true, plantilla };
  }

  if (variantes.length === 1) {
    const plantilla = plantillaDeProceso(variantes[0]);
    if (plantilla) return { ok: true, plantilla };
  }

  return { ok: false, motivo: "ambiguo", variantes };
}
