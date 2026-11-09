# Universal Grass · vídeo v2 · revisión de fotogramas clave

Estado: **composiciones construidas, pendiente de aprobación antes de animar y exportar.**

## Láminas
- `review/lamina-fotogramas-clave.jpg`: los seis fotogramas pedidos (apertura, servicio, aplicaciones, asesoramiento, presupuesto y cierre).
- `review/lamina-intermedios.jpg`: Terrazas, Junto a la piscina y paso 1.
- `review/lamina-zonas-seguras.jpg`: los mismos fotogramas con la guía de la interfaz de Reels/TikTok.

Todos se renderizan desde `src/UniversalGrassV2.tsx`, la misma composición que se animará (`npm run stills`).

## Pendiente de confirmar
1. **«Suministro e instalación»**: no he encontrado ningún proyecto previo con la descripción de servicios, y la web universalgrass.eu no es accesible desde este entorno. No he podido verificarlo. El texto está en `src/copy.ts` y se cambia en una línea.
2. **Proyecto original**: aquí no había ningún proyecto de vídeo previo. Esta versión es un proyecto nuevo (Remotion). Las cinco imágenes recibidas se conservan sin modificar en `public/originals/`.
3. **Permisos y procedencia de las fotos**: no sé cuáles son instalaciones vuestras. Por eso todas llevan «Imagen de inspiración». Si alguna es una obra realizada por Universal Grass, se quita la etiqueta en esa imagen.
4. **Pocas fotografías**: la de piscina y terraza aparece en tres escenas con encuadres distintos. Con más fotos originales cada espacio tendría la suya.
5. **Apertura**: el guion pide una terraza. He usado la casa con porche y piscina porque la otra foto de terraza ya se usa tres veces.
6. **Muestras reales**: no hay recortes de muestras. En «Te ayudamos a elegir» uso detalles de las fotos (el rollo de césped y el césped junto a la piscina), sin nombres de modelos ni características.
7. **Foto del perro**: no la uso. Podría sugerir «apto para mascotas», que no está confirmado.
8. **Foto de instalación**: es de baja resolución (612 × 408) y en la banda a ancho completo se ve algo blanda. Una versión más grande mejoraría la escena 2.

## Tiempos
| Escena | Segundos | Texto legible en pantalla |
|---|---|---|
| Apertura | 0–3 | completo desde 0,9 s |
| Servicio | 3–7 | ~3 s |
| Terrazas / Jardines / Piscina | 7–12 | ~1,2 s cada palabra, una a la vez |
| Cuéntanos / Te ayudamos | 12–17 | ~1,7 s y ~1,9 s |
| Presupuesto | 17–20 | ~1,7 s |
| Cierre | 20–25 | estable desde 20,9 s → **4,1 s** |
