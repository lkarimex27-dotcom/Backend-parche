const env = require('../config/env');

// Colores de la marca (los mismos del front)
const MOSTAZA = '#B68C1C';
const OSCURO = '#1E1C18';
const CREMA = '#FBF6E9';
const TEXTO = '#2B2824';
const SUAVE = '#6B6760';

const escapar = (t) => String(t ?? '').replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

// Correo con la marca de El Parche. Va en tablas y estilos en línea porque así lo pide Gmail/Outlook.
// `contenido` es HTML ya armado (lo que cambia en cada correo); el resto es igual para todos.
const plantilla = ({ titulo, contenido, boton, nota }) => `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapar(titulo)}</title></head>
<body style="margin:0;padding:0;background:#EFE8D6;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EFE8D6;padding:24px 12px">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:${CREMA};border-radius:20px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.08)">
    <tr><td style="background:${OSCURO};padding:22px 28px">
      <div style="font-size:24px;font-weight:900;letter-spacing:1px;color:${MOSTAZA}">EL PARCHE</div>
      <div style="font-size:11px;font-weight:bold;letter-spacing:3px;color:#F4EEDC;opacity:0.8">MINI BURGUER</div>
    </td></tr>
    <tr><td style="height:5px;background:${MOSTAZA}"></td></tr>
    <tr><td style="padding:28px 28px 8px">
      <h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;color:${TEXTO}">${escapar(titulo)}</h1>
      ${contenido}
    </td></tr>
    ${boton ? `<tr><td align="center" style="padding:14px 28px 6px">
      <a href="${escapar(boton.url)}" style="display:inline-block;background:${MOSTAZA};color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:13px 30px;border-radius:999px">${escapar(boton.texto)}</a>
    </td></tr>` : ''}
    ${nota ? `<tr><td style="padding:14px 28px 0;font-size:12px;line-height:1.5;color:${SUAVE}">${nota}</td></tr>` : ''}
    <tr><td style="padding:24px 28px 26px">
      <div style="border-top:1px solid rgba(0,0,0,0.08);padding-top:14px;font-size:11px;line-height:1.6;color:${SUAVE};text-align:center">
        El Parche Mini Burguer · Bello, Antioquia · Desde 2013<br>Este es un correo automático, no hace falta responderlo.
      </div>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;

const parrafo = (html) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:${TEXTO}">${html}</p>`;

// Recuadro destacado para una contraseña o un código
const recuadro = (etiqueta, valor, espaciado) => `
  <div style="margin:18px 0;padding:16px;border:2px dashed ${MOSTAZA};border-radius:16px;background:#ffffff;text-align:center">
    <div style="font-size:11px;font-weight:bold;letter-spacing:2px;color:${SUAVE};text-transform:uppercase">${escapar(etiqueta)}</div>
    <div style="margin-top:6px;font-family:'Courier New',monospace;font-size:28px;font-weight:bold;color:${OSCURO};letter-spacing:${espaciado}px">${escapar(valor)}</div>
  </div>`;

// Lista con viñetas doradas
const lista = (items) => `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 4px">${items
  .map((t) => `<tr><td valign="top" style="padding:4px 10px 4px 0;color:${MOSTAZA};font-weight:bold;font-size:15px">●</td>
    <td style="padding:4px 0;font-size:14px;line-height:1.5;color:${TEXTO}">${t}</td></tr>`)
  .join('')}</table>`;

module.exports = { plantilla, parrafo, recuadro, lista, escapar, urlApp: () => env.appUrl };
