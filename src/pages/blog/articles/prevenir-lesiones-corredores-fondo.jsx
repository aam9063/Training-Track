import { H2, H3, P, UL, OL, LI, Strong, Blockquote, Img, InternalLink, CTA } from '../components';

export default function Article() {
  return (
    <>
      <P>
        Las <Strong>lesiones en corredores de fondo</Strong> son la principal causa de abandono del
        entrenamiento y de no llegar a la línea de salida en condiciones. Se estima que entre el 50%
        y el 75% de los corredores sufren al menos una lesión al año. La buena noticia: la mayoría
        son prevenibles con una planificación inteligente, trabajo de fuerza y control de la carga.
      </P>

      <Blockquote>
        "La mejor sesión de entrenamiento es la que puedes hacer mañana. Sin salud, no hay
        rendimiento."
      </Blockquote>

      <H2>Las lesiones más frecuentes en running</H2>
      <P>
        Las lesiones por sobreuso representan más del 80% de las lesiones en corredores. Las más
        comunes son:
      </P>
      <OL>
        <LI>
          <Strong>Síndrome de la banda iliotibial (rodilla del corredor):</Strong> Dolor en la parte
          externa de la rodilla, especialmente en bajadas y carreras largas. Causado por debilidad
          de glúteos y aductores.
        </LI>
        <LI>
          <Strong>Fascitis plantar:</Strong> Dolor en la planta del pie, peor al levantarse por la
          mañana. Relacionado con exceso de volumen, calzado inadecuado y falta de movilidad en el
          tobillo.
        </LI>
        <LI>
          <Strong>Tendinopatía aquílea:</Strong> Dolor en el tendón de Aquiles, frecuente al
          aumentar el volumen o la intensidad bruscamente. Responde bien al entrenamiento excéntrico.
        </LI>
        <LI>
          <Strong>Periostitis tibial:</Strong> Dolor en la cara interna de la tibia. Típica en
          principiantes y al cambiar de superficie. Mejora con fortalecimiento de tibial posterior.
        </LI>
        <LI>
          <Strong>Fracturas por estrés:</Strong> La lesión más grave por sobreuso. Afecta a tibia,
          metatarsos y sacro. Requiere semanas de reposo y es señal de que la carga superó
          ampliamente la capacidad de recuperación del hueso.
        </LI>
      </OL>

      {/* IMAGEN: Infografía de lesiones comunes en corredores con zonas del cuerpo */}
      <Img
        src="lesiones-fuerza-gym.png"
        alt="Infografía mostrando las lesiones más comunes en corredores de fondo"
        caption="Las lesiones por sobreuso en running afectan principalmente a rodilla, tobillo y pie."
      />

      <H2>Factores de riesgo principales</H2>
      <P>
        Las lesiones en running rara vez tienen una sola causa. Suelen ser el resultado de la
        combinación de varios factores:
      </P>
      <UL>
        <LI>
          <Strong>Aumento brusco de la carga:</Strong> Es el factor de riesgo número uno. Un{' '}
          <InternalLink to="/blog/como-interpretar-acwr-carga-entrenamiento">
            ACWR superior a 1.3
          </InternalLink>{' '}
          multiplica el riesgo de lesión significativamente.
        </LI>
        <LI>
          <Strong>Déficit de fuerza:</Strong> Glúteos débiles, core inestable y falta de{' '}
          <InternalLink to="/blog/importancia-fuerza-corredores-fondo">
            trabajo de fuerza complementario
          </InternalLink>{' '}
          son la raíz de muchas lesiones biomecánicas.
        </LI>
        <LI>
          <Strong>Historial previo de lesiones:</Strong> Una lesión anterior es el mejor predictor
          de lesiones futuras, especialmente si no se abordó la causa raíz.
        </LI>
        <LI>
          <Strong>Falta de sueño y recuperación:</Strong> El tejido se repara durante el descanso.
          Menos de 7 horas de sueño aumenta significativamente el riesgo.
        </LI>
        <LI>
          <Strong>Superficie y calzado:</Strong> Cambios bruscos de superficie (asfalto a pista,
          por ejemplo) o zapatillas con demasiado o poco drop pueden alterar la biomecánica.
        </LI>
      </UL>

      <H2>Estrategias de prevención: las 5 claves</H2>

      <H3>1. Progresión gradual de la carga</H3>
      <P>
        La regla del 10% sigue siendo válida como guía general: no aumentar más de un 10% el
        volumen semanal. Pero más importante que el porcentaje es monitorizar el ACWR y el TSB.
        Un ACWR mantenido entre 0.8 y 1.3 protege contra lesiones por sobreuso.
      </P>
      <P>
        Incluir semanas de descarga cada 3-4 semanas (reducción del 30-40%) permite la reparación
        tisular y la asimilación de las adaptaciones.
      </P>

      <H3>2. Entrenamiento de fuerza específico</H3>
      <P>
        Mínimo 2 sesiones semanales de fuerza, enfocadas en:
      </P>
      <UL>
        <LI><Strong>Glúteos:</Strong> sentadilla búlgara, hip thrust, step-ups laterales</LI>
        <LI><Strong>Core:</Strong> plancha frontal y lateral, dead bug, pallof press</LI>
        <LI><Strong>Tobillo/pie:</Strong> elevaciones de gemelos (excéntricas), agarre con toalla, equilibrio unipodal</LI>
        <LI><Strong>Isquiotibiales:</Strong> peso muerto rumano, curl nórdico</LI>
      </UL>

      <H3>3. Movilidad y flexibilidad funcional</H3>
      <P>
        No se trata de hacer estiramientos estáticos durante 30 minutos. La movilidad funcional se
        centra en mantener los rangos de movimiento necesarios para correr con buena técnica:
      </P>
      <UL>
        <LI>Movilidad de cadera (flexión, extensión, rotación)</LI>
        <LI>Dorsiflexión de tobillo (mínimo 35-40°)</LI>
        <LI>Extensión torácica (para una buena postura de carrera)</LI>
        <LI>Automasaje con foam roller en cuádriceps, glúteos, gemelos e ITB</LI>
      </UL>

      <H3>4. Escuchar las señales del cuerpo (RPE y bienestar)</H3>
      <P>
        El RPE diario es una herramienta clave de prevención. Si un atleta reporta un RPE de 8 en
        un rodaje suave que normalmente es un 4, es una señal de alarma. En Training Track, el
        entrenador recibe alertas automáticas cuando el RPE de un atleta sube por encima de lo
        esperado durante varios días consecutivos.
      </P>
      <P>
        Otros indicadores a monitorizar: calidad del sueño, estado de ánimo, dolor muscular
        residual (DOMS) y frecuencia cardíaca en reposo. Un aumento de 5-10 latidos en la FC
        matutina suele indicar fatiga acumulada o enfermedad incipiente.
      </P>

      <H3>5. Nutrición e hidratación</H3>
      <P>
        Una dieta insuficiente en calorías o baja en calcio y vitamina D debilita los huesos y
        aumenta el riesgo de fracturas por estrés. La disponibilidad energética relativa (RED-S)
        es especialmente peligrosa en atletas femeninas y corredores que restringen la ingesta.
      </P>
      <UL>
        <LI>Proteína: 1.4-1.8 g/kg/día para la reparación muscular</LI>
        <LI>Calcio: 1000-1300 mg/día (lácteos, verduras de hoja verde, frutos secos)</LI>
        <LI>Vitamina D: exposición solar o suplementación (especialmente en invierno)</LI>
        <LI>Hidratación: 2-3 litros/día + reposición durante sesiones largas</LI>
      </UL>

      <H2>Plan de acción si aparece una molestia</H2>
      <OL>
        <LI><Strong>Día 1-3:</Strong> Reducir volumen e intensidad un 50%. Si el dolor persiste al correr, parar.</LI>
        <LI><Strong>Día 4-7:</Strong> Cross-training sin dolor (bici, natación, elíptica). Aplicar hielo post-ejercicio.</LI>
        <LI><Strong>Si no mejora en 7 días:</Strong> Consultar a un fisioterapeuta deportivo. No esperar a que se cronifique.</LI>
        <LI><Strong>Al volver:</Strong> Empezar al 50% del volumen previo y subir un 10-15% semanal con ACWR controlado.</LI>
      </OL>

      <CTA text="Controla la carga de tus atletas y prevén lesiones con ACWR y RPE en Training Track" />
    </>
  );
}
