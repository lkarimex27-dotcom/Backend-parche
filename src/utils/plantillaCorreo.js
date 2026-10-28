const env = require('../config/env');

// Colores de la marca (los mismos del front)
const MOSTAZA = '#F2B230';
const OSCURO = '#141210';
const CREMA = '#FBF6EC';
const TEXTO = '#2B2824';
const SUAVE = '#6B6760';

const escapar = (t) => String(t ?? '').replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

// Las imágenes (src/assets/correo) van adjuntas dentro del correo y se usan como cid:<nombre>: Gmail las muestra
// sin depender de un servidor (encabezados con la hamburguesa, franja de brocha y pie).
const img = (nombre, ancho, alto, alt, estilo = '') =>
  `<img src="cid:${nombre}" width="${ancho}"${alto ? ` height="${alto}"` : ''} alt="${escapar(alt)}" style="display:block;border:0;outline:none;${estilo}">`;

// Correo con la marca de El Parche. Va en tablas y estilos en línea porque así lo pide Gmail/Outlook.
// `hero`: encabezado con la hamburguesa ('codigo' | 'provisional' | 'bienvenida'); `contenido`: HTML ya armado.
// ayuda: false quita «Si necesitas ayuda… ¡estamos para ti!»
const plantilla = ({ titulo, hero, contenido, boton, nota, ayuda = true }) => `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapar(titulo)}</title></head>
<body style="margin:0;padding:0;background:#F3EFE6;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3EFE6;padding:20px 10px">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden">
    <tr><td style="background:${OSCURO}">${img(`hero-${hero}`, 600, 0, titulo, 'width:100%;max-width:600px;height:auto')}</td></tr>
    <tr><td style="background:${CREMA};padding:26px 24px 22px;text-align:center">${contenido}</td></tr>
    ${boton ? `<tr><td align="center" style="padding:24px 24px 0">
      <a href="${escapar(boton.url)}" style="display:inline-block;background:${OSCURO};color:${MOSTAZA};text-decoration:none;font-weight:bold;font-size:15px;padding:14px 34px;border-radius:999px">${escapar(boton.texto)}</a>
    </td></tr>` : ''}
    ${ayuda ? `<tr><td align="center" style="padding:26px 24px 8px;font-size:18px;line-height:1.5;color:${TEXTO}">
      Si necesitas ayuda o tienes alguna duda,<br><strong style="color:${OSCURO}">¡estamos para ti!</strong>
    </td></tr>
    <tr><td align="center" style="padding:0 24px 20px">${img('subrayado', 180, 11, '')}</td></tr>` : '<tr><td style="height:20px"></td></tr>'}
    ${nota ? `<tr><td style="padding:0 28px 22px;font-size:12px;line-height:1.5;color:${SUAVE};text-align:center">${nota}</td></tr>` : ''}
    <tr><td>${img('pie', 600, 0, 'El Parche Mini Burguer · ¡Tu antojo sigue en pie!', 'width:100%;max-width:600px;height:auto')}</td></tr>
  </table>
  <div style="max-width:600px;padding:12px 10px 0;font-size:11px;line-height:1.5;color:${SUAVE};text-align:center">Este es un correo automático, no hace falta responderlo.</div>
</td></tr></table>
</body></html>`;

const parrafo = (html) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:${TEXTO}">${html}</p>`;

// Franja amarilla de brocha con una contraseña o un código (el texto es real: se puede copiar)
const recuadro = (etiqueta, valor, espaciado) => `
  <div style="margin:2px 0 8px;font-size:11px;font-weight:bold;letter-spacing:2px;color:${SUAVE};text-transform:uppercase">${escapar(etiqueta)}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 18px">
    <tr>
      <td width="56">${img('brocha-izq', 56, 68, '')}</td>
      <td height="68" bgcolor="${MOSTAZA}" style="background:${MOSTAZA};padding:0 6px;font-family:'Arial Black',Arial,sans-serif;font-weight:900;
        font-size:${String(valor).length > 6 ? 26 : 40}px;letter-spacing:${espaciado}px;color:${OSCURO};white-space:nowrap">${escapar(valor)}</td>
      <td width="56">${img('brocha-der', 56, 68, '')}</td>
    </tr>
  </table>`;

// Lista con viñetas doradas
const lista = (items) => `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:4px auto 6px;text-align:left">${items
  .map((t) => `<tr><td valign="top" style="padding:4px 10px 4px 0;color:${MOSTAZA};font-weight:bold;font-size:15px">●</td>
    <td style="padding:4px 0;font-size:15px;line-height:1.5;color:${TEXTO}">${t}</td></tr>`)
  .join('')}</table>`;

module.exports = { plantilla, parrafo, recuadro, lista, escapar, urlApp: () => env.appUrl };
