import { H2, H3, P, UL, LI, Strong, Blockquote, Img, InternalLink, CTA } from '../components';

export default function Article() {
  return (
    <>
      <P>
        El <Strong>entrenamiento de fuerza para corredores de fondo</Strong> ha dejado de ser
        opcional para convertirse en un pilar fundamental del rendimiento. Durante años, muchos
        entrenadores han descuidado el trabajo de gimnasio por miedo a que sus atletas "se pongan
        grandes" o pierdan economía de carrera. La evidencia científica demuestra todo lo contrario:
        la fuerza bien programada es un potenciador del rendimiento en resistencia.
      </P>

      <Blockquote>
        "Los corredores más rápidos no son solo los que más kilómetros hacen, sino los que tienen
        la estructura muscular para sostener esos kilómetros."
      </Blockquote>

      <H2>Beneficios del entrenamiento de fuerza en corredores</H2>
      <P>
        Las investigaciones de los últimos 15 años han demostrado de forma consistente que incluir
        trabajo de fuerza mejora múltiples aspectos del rendimiento:
      </P>
      <UL>
        <LI>
          <Strong>Mejora de la economía de carrera:</Strong> Hasta un 5% de mejora según estudios
          recientes. Esto significa correr a la misma velocidad gastando menos energía.
        </LI>
        <LI>
          <Strong>Prevención de lesiones:</Strong> Fortalecimiento de tendones, ligamentos y
          músculos estabilizadores. Reduce significativamente la incidencia de lesiones comunes
          como fascitis plantar, tendinopatía aquílea y síndrome de banda iliotibial.
        </LI>
        <LI>
          <Strong>Mayor potencia en el sprint final:</Strong> Capacidad neuromuscular mejorada que
          marca la diferencia en los últimos metros de una carrera.
        </LI>
        <LI>
          <Strong>Resistencia a la fatiga:</Strong> Los músculos tardan más en fatigarse, lo que
          permite mantener la técnica de carrera durante más tiempo.
        </LI>
      </UL>

      <Img
        src="fuerza-gimnasio.png"
        alt="Corredor realizando ejercicios de fuerza en gimnasio"
        caption="El trabajo de fuerza bien programado es un potenciador del rendimiento en resistencia."
      />

      <H2>Ejercicios de fuerza clave para fondistas</H2>
      <P>
        No todos los ejercicios de fuerza son iguales para un corredor. Los más efectivos son
        aquellos que trabajan los grupos musculares principales del gesto de carrera:
      </P>

      <H3>Tren inferior</H3>
      <UL>
        <LI>
          <Strong>Sentadilla:</Strong> El rey de los ejercicios para corredores. Trabaja cuádriceps,
          glúteos e isquiotibiales de forma integrada.
        </LI>
        <LI>
          <Strong>Peso muerto:</Strong> Cadena posterior completa. Fundamental para la potencia de
          impulso y la prevención de lesiones en isquiotibiales.
        </LI>
        <LI>
          <Strong>Zancadas:</Strong> Específicas del gesto de carrera. Trabajan la estabilidad
          unilateral y la coordinación.
        </LI>
        <LI>
          <Strong>Step-ups:</Strong> Fuerza unilateral funcional que simula el gesto de subida.
        </LI>
        <LI>
          <Strong>Gemelos (sentado y de pie):</Strong> Prevención de sobrecargas en el tendón de
          Aquiles y mejora de la propulsión.
        </LI>
      </UL>

      <H3>Core y estabilidad</H3>
      <UL>
        <LI><Strong>Planchas frontales y laterales:</Strong> Base de estabilidad del tronco</LI>
        <LI><Strong>Pallof press:</Strong> Anti-rotación funcional para la carrera</LI>
        <LI><Strong>Dead bugs:</Strong> Coordinación y estabilidad lumbo-pélvica</LI>
        <LI><Strong>Bird dogs:</Strong> Activación de glúteo medio y estabilizadores</LI>
      </UL>

      <Img
        src="fuerza-sentadilla.png"
        alt="Atleta realizando sentadilla con barra en rack"
        caption="La sentadilla es el ejercicio rey para el corredor de fondo."
      />

      <H2>¿Cuándo y cuánta fuerza hacer?</H2>
      <P>
        La recomendación general es 2 sesiones semanales de 40-50 minutos. La carga y el volumen
        varían según la fase de la{' '}
        <InternalLink to="/blog/periodizacion-entrenamiento-medio-fondo">
          periodización del entrenamiento
        </InternalLink>:
      </P>
      <UL>
        <LI>
          <Strong>Fase de base:</Strong> Más volumen (3-4 series x 8-12 repeticiones). Se busca
          hipertrofia funcional y adaptación de tendones.
        </LI>
        <LI>
          <Strong>Fase específica:</Strong> Transición a fuerza máxima (3-4 series x 4-6 reps con
          más carga). Se busca reclutamiento de unidades motoras.
        </LI>
        <LI>
          <Strong>Fase competitiva:</Strong> Mantenimiento (2 series x 4-6 reps). El objetivo es
          no perder las ganancias sin acumular fatiga extra.
        </LI>
      </UL>

      <H2>Planificación integrada de carrera y fuerza</H2>
      <P>
        Con Training Track, los entrenadores pueden incluir sesiones de gimnasio dentro del plan
        semanal, seleccionando ejercicios del banco de ejercicios con series, repeticiones y carga
        definidos. Todo integrado en el mismo flujo de planificación junto con las sesiones de
        carrera.
      </P>
      <P>
        Esto permite ver de un vistazo cómo se distribuye la carga total del atleta a lo largo de
        la semana, evitando acumular demasiado estímulo en días consecutivos y optimizando la
        recuperación.
      </P>

      <CTA text="Integra sesiones de fuerza y carrera en un solo plan semanal" />
    </>
  );
}
