# Archify viewer

Source: https://github.com/tt-a1i/archify
Revision: c6519401f7b91b9d43011657880893b0a8955548
Version: 2.17.0-dev.1
License: MIT (see LICENSE).

The template in public/vendor/archify/template.html and the utils/i18n modules
are copied without modification. lib/bpmn/standalone.mjs fills the template and
defers viewer initialization until the BPMN adapter produces the semantic SVG.
lib/bpmn/artifact-runtime.mjs supplies BPMN shapes, stable IDs and authored edges.
It does not replace the Archify interaction runtime.
