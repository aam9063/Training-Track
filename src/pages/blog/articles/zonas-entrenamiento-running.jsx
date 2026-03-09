import { H2, H3, P, UL, OL, LI, Strong, Blockquote, Img, InternalLink, CTA } from '../components';

export default function Article() {
  return (
    <>
      <P>
        Las <Strong>zonas de entrenamiento en running</Strong> son el mapa que guía cada sesión de
        carrera. Sin ellas, entrenas a ciegas: demasiado fuerte en los días suaves, demasiado suave en
        los días de calidad. Definir correctamente tus zonas es el primer paso para que cada kilómetro
        cuente.
      </P>

      <Blockquote>
        "El 80% de tu entrenamiento debería sentirse fácil. Si no defines tus zonas, nunca
        sabrás si estás cumpliendo esta regla."
      </Blockquote>

      <H2>¿Qué son las zonas de entrenamiento?</H2>
      <P>
        Las zonas de entrenamiento son rangos de intensidad definidos por frecuencia cardíaca (FC),
        ritmo (min/km) o percepción del esfuerzo (RPE). Cada zona produce adaptaciones fisiológicas
        diferentes: desde la eficiencia aeróbica hasta la tolerancia al lactato. Un entrenador necesita
        conocer las zonas de cada atleta para prescribir sesiones con precisión.
      </P>

      <H2>Las 5 zonas clásicas del running</H2>
      <P>
        Aunque existen varios modelos (3 zonas, 5 zonas, 7 zonas), el sistema de 5 zonas es el más
        extendido en atletismo de medio fondo y fondo:
      </P>

      <OL>
        <LI>
          <Strong>Zona 1 — Recuperación (50-60% FCmáx):</Strong> Trote muy suave, conversación
          fluida. Regeneración activa, quema de grasa. Se usa en calentamientos, vuelta a la calma
          y días de descarga.
        </LI>
        <LI>
          <Strong>Zona 2 — Base aeróbica (60-70% FCmáx):</Strong> El rodaje clásico. Puedes hablar
          con frases largas. Aquí se construye la base de resistencia, se mejora la capilarización
          muscular y la eficiencia del corazón. El 70-80% de tu volumen semanal debería estar aquí.
        </LI>
        <LI>
          <Strong>Zona 3 — Tempo / Umbral aeróbico (70-80% FCmáx):</Strong> Ritmo sostenido,
          hablar cuesta. Mejora la capacidad de mantener esfuerzos prolongados. Aquí se sitúan los
          ritmos de media maratón y maratón.
        </LI>
        <LI>
          <Strong>Zona 4 — Umbral anaeróbico (80-90% FCmáx):</Strong> Solo puedes decir palabras
          sueltas. Trabajo al ritmo de 10K-15K. Se entrena la tolerancia al lactato y la velocidad
          al umbral. Sesiones tipo: tempo runs, intervalos largos.
        </LI>
        <LI>
          <Strong>Zona 5 — VO2máx y anaeróbico (90-100% FCmáx):</Strong> Esfuerzo máximo, no
          puedes hablar. Series cortas a ritmo de 1500m-3000m. Mejora la potencia aeróbica máxima
          y la velocidad.
        </LI>
      </OL>

      {/* IMAGEN: Tabla visual con las 5 zonas, colores, %FC, RPE y tipo de sesión */}
      <Img
        src="zonas-tabla.png"
        alt="Tabla de zonas de entrenamiento en running con frecuencia cardíaca, ritmo y RPE"
        caption="Las 5 zonas de entrenamiento con sus rangos de frecuencia cardíaca, ritmo y percepción del esfuerzo."
      />

      <H2>Cómo calcular tus zonas de entrenamiento</H2>
      <P>
        Hay varios métodos para establecer las zonas. Cuanto más preciso sea el método, mejor podrás
        individualizar el entrenamiento:
      </P>

      <H3>Método 1: Frecuencia cardíaca máxima (FCmáx)</H3>
      <P>
        La fórmula clásica <Strong>220 - edad</Strong> es solo una estimación general. Mejor
        realizar un test de campo: un esfuerzo progresivo hasta el máximo (por ejemplo, cuestas
        repetidas de 2-3 minutos) y registrar la FC más alta alcanzada. A partir de ahí, se
        calculan los porcentajes para cada zona.
      </P>

      <H3>Método 2: Frecuencia cardíaca de reserva (Karvonen)</H3>
      <P>
        Más preciso que el anterior porque incluye la FC en reposo:
        <Strong> FC zona = FC reposo + % × (FCmáx - FC reposo)</Strong>. Un atleta con FC reposo
        de 45 y FCmáx de 190 tiene una reserva de 145 latidos para repartir entre las zonas.
      </P>

      <H3>Método 3: Test de Conconi / Umbral</H3>
      <P>
        El método más fiable es determinar el{' '}
        <InternalLink to="/blog/test-conconi-ritmos-entrenamiento">
          umbral anaeróbico con el test de Conconi
        </InternalLink>{' '}
        y construir las zonas alrededor de ese punto. Todo lo que está por debajo del umbral es
        aeróbico; por encima, anaeróbico.
      </P>

      <H3>Método 4: Ritmo por kilómetro</H3>
      <P>
        Si no tienes pulsómetro, puedes usar una carrera de referencia (por ejemplo, tu mejor 10K
        reciente) y calcular los ritmos de cada zona con tablas de equivalencia como las de Jack
        Daniels (VDOT) o las tablas de Tinman.
      </P>

      {/* IMAGEN: Atleta corriendo con pulsómetro mirando el reloj */}
      <Img
        src="zonas-pulsometro.png"
        alt="Corredor consultando su pulsómetro durante un entrenamiento"
        caption="El pulsómetro de banda pectoral sigue siendo la herramienta más fiable para controlar las zonas."
      />

      <H2>El error más común: entrenar siempre en zona 3</H2>
      <P>
        La mayoría de corredores populares entrenan demasiado fuerte en los días fáciles y no lo
        suficientemente fuerte en los días de calidad. Este fenómeno se llama <Strong>"zona gris"
        </Strong> o <Strong>"black hole training"</Strong>: correr siempre a una intensidad moderada
        que no es lo bastante suave para recuperar ni lo bastante intensa para mejorar.
      </P>
      <P>
        La distribución ideal sigue el modelo <Strong>polarizado</Strong>: aproximadamente un
        80% del volumen en zona 1-2 y un 20% en zona 4-5, con muy poco tiempo en zona 3. Esta
        distribución, respaldada por décadas de investigación de Stephen Seiler, produce las mayores
        adaptaciones aeróbicas.
      </P>

      <H2>Zonas de entrenamiento y RPE</H2>
      <P>
        La <Strong>percepción del esfuerzo (RPE)</Strong> es un complemento perfecto a la FC. En
        Training Track, los atletas registran su RPE después de cada sesión en una escala de 1 a 10.
        Esto permite al entrenador cruzar los datos de zona (por FC o ritmo) con la percepción
        subjetiva del atleta, detectando desajustes como:
      </P>
      <UL>
        <LI>RPE alto en zona 2 → posible fatiga acumulada o sobreentrenamiento</LI>
        <LI>RPE bajo en zona 4 → el atleta ha mejorado y necesita ajustar ritmos</LI>
        <LI>RPE inconsistente → revisar calidad del sueño, nutrición o estrés externo</LI>
      </UL>

      <H2>Cómo usar las zonas en tu planificación</H2>
      <P>
        Con Training Track, el entrenador puede planificar cada sesión indicando la zona objetivo
        y el tipo de trabajo. El sistema de{' '}
        <InternalLink to="/blog/periodizacion-entrenamiento-medio-fondo">
          periodización por mesociclos
        </InternalLink>{' '}
        permite distribuir las cargas a lo largo de la temporada, asegurando que cada fase tenga
        la proporción correcta de trabajo en cada zona.
      </P>

      <H3>Ejemplo: semana tipo en fase de base</H3>
      <UL>
        <LI><Strong>Lunes:</Strong> Descanso</LI>
        <LI><Strong>Martes:</Strong> 10 km zona 2 + 4×100m progresivos</LI>
        <LI><Strong>Miércoles:</Strong> 8 km zona 1-2 + gimnasio</LI>
        <LI><Strong>Jueves:</Strong> 12 km zona 2 con último 3 km en zona 3</LI>
        <LI><Strong>Viernes:</Strong> 6 km zona 1 (regenerativo)</LI>
        <LI><Strong>Sábado:</Strong> 16 km zona 2 (tirada larga)</LI>
        <LI><Strong>Domingo:</Strong> 8 km zona 1-2 suave</LI>
      </UL>

      <CTA text="Define las zonas de tus atletas y planifica entrenamientos por intensidad con Training Track" />
    </>
  );
}
