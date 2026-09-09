# Third-party notices

- bpmn-js and bundled viewer/font use the bpmn.io license. Full text: `public/vendor/BPMN-JS-LICENSE.txt`.
- bpmn-js-properties-panel, @bpmn-io/properties-panel, bpmn-js-token-simulation, diagram-js-minimap, bpmn-moddle, bpmnlint and vendor moddle extensions retain licenses included in their npm packages.
- React, Vite, Vinext, Shadcn, Radix, Lucide and other dependencies retain upstream terms. The lockfile records exact versions.
- Cloudflare/TypeScript runtime declarations retain notices in `types/worker.d.ts`.
- Archify viewer template, CSS, JavaScript runtime and helper modules are included under MIT. Copyright (c) 2026 tt-a1i (Archify); Copyright (c) 2025 Cocoon AI. Source: https://github.com/tt-a1i/archify, revision c6519401f7b91b9d43011657880893b0a8955548. Full license: `vendor/archify/LICENSE`; provenance: `vendor/archify/UPSTREAM.md`. The vendored files are unchanged. Generated output substitutes diagram slots, removes remote font links and delays initialization until the BPMN adapter finishes; the original interaction runtime is preserved.

The MIT license applies to newly authored Studio code/documentation, not as replacement terms for third-party content.
- `scripts/check-layout.mjs` lấy ý tưởng kiểm va chạm nhãn từ `verify-geometry.py` của cathrynlavery/diagram-design (MIT). Không sao chép mã; chỉ mượn cách đặt vấn đề.
- `check-layout.mjs` được hiệu chỉnh bằng 54 file BPMN của camunda/camunda-bpm-examples (Apache-2.0) dùng làm bộ đối chứng. Không sao chép file nào vào repo.
