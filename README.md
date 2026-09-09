# BPMN Studio · Archify artifacts

Repo tạo **diagram BPMN tương tác bằng chính bộ xem Archify**. Sản phẩm chính là file HTML độc lập có Story, PATH, Journey, MAP, LENS, camera, tìm kiếm và chế độ trình chiếu. Mở ứng dụng là vào thẳng diagram mua hàng.

Mã nguồn viewer được lấy từ [tt-a1i/archify](https://github.com/tt-a1i/archify), revision `c6519401f7b91b9d43011657880893b0a8955548`. bpmn-js giữ ký hiệu BPMN; adapter gắn ID, quan hệ và metadata để runtime Archify tương tác với các phần tử thực. Xem `vendor/archify/UPSTREAM.md`.

## Dùng ngay

- Mở `public/diagrams/purchasing.html` trong trình duyệt. HTML chứa sẵn viewer và BPMN XML.
- **Rê chuột vào một bước**: bước đó cùng các bước nối trực tiếp nổi lên; tín hiệu chạy dọc đường BPMN theo chiều mũi tên. Rời chuột để trở lại tổng quan. Giữ **Live** và thoát Story/PATH/LENS hoặc vùng focus đang chọn để dùng hover.
- **Play story**: xem theo chương, bước và camera tự chuyển.
- **PATH**: chọn bước đầu/cuối, làm nổi đường có hướng rồi duyệt bằng Journey.
- Nhấp node để xem mô tả, vai trò và các bước liên quan; dùng **MAP**, **LENS**, tìm kiếm hoặc legend để khám phá.
- Menu **BPMN ▾**: mở file BPMN khác, tải XML gốc hoặc diagram HTML. Trên bản web, **Chỉnh sửa BPMN** chuyển quy trình đang xem vào editor.
- Trong editor, **Khám phá** tạo diagram Archify từ XML đang chỉnh. **Xuất file → HTML tương tác** đóng gói cùng bộ xem.

## Tương tác trong diagram

| Tương tác Archify | Dữ liệu BPMN được dùng |
|---|---|
| Rê chuột / keyboard focus | Tín hiệu theo đúng hình học của Sequence Flow, Message Flow và Association; không lấy hình đầu mũi tên làm đường chạy |
| Story và chương | Danh sách ID phần tử; có 3 kịch bản mua hàng và các chương mẫu khác |
| Camera, beat, Journey | Vị trí thật từ BPMNDI và bước đang được chọn |
| PATH | Quan hệ có hướng của các node hiện trên plane; giữ nhãn và điều kiện của flow |
| Passport | Tên, loại BPMN, documentation, lane, quan hệ và upstream/downstream |
| LENS và legend | Nhóm theo loại BPMN: User Task, Service Task, Gateway, Event, dữ liệu… |
| MAP và tìm kiếm | Các node thực trong diagram, tìm theo tên/ID |
| Live/Still, theme, preset | Runtime Archify gốc, 4 preset và Light/Dark |
| Export và deep link | Các điều khiển Archify gốc; menu bổ sung đóng gói HTML/XML |

Story không chạy nghiệp vụ. PATH phân tích đồ thị kết nối; không thực thi condition hay chứng minh việc hợp nhất token. Các chương tự sinh tìm một số đường Sequence Flow không lặp; có thể viết chương riêng.

## Editor BPMN

Editor mở qua `/?edit=1`, dùng bpmn-js, properties panel và token simulation.

| Nhóm | Khả năng |
|---|---|
| Ký hiệu | Task và các loại task, event, gateway, pool/lane, subprocess, transaction, call activity, data object/store, group, annotation |
| Chỉnh sửa | Kéo thả, nối theo rule, thay loại theo ngữ cảnh, đổi màu, undo/redo, copy/paste, căn chỉnh/phân bố |
| Thuộc tính | ID, tên, documentation, condition, default flow, timer, message/signal/error/escalation; Camunda 7 |
| Mô phỏng | Module token simulation: bắt đầu, chọn nhánh, pause/reset, tốc độ và log |
| Kiểm tra | Quy tắc riêng kết hợp bpmnlint; kiểm tra trước khi thay XML |
| File | BPMN XML, SVG, PNG, HTML tương tác và Markdown |
| Lưu | Nhiều quy trình, autosave trên trình duyệt hiện tại, nhân bản, đổi tên và 12 mốc phiên bản |

## Tạo artifact từ terminal

Yêu cầu Node.js 22.13+.

```bash
npm ci
npm run bpmn:validate -- examples/bpmn/purchasing.bpmn
npm run bpmn:render -- examples/bpmn/purchasing.bpmn output/purchasing.html "Yêu cầu mua hàng"
```

Không cần chạy website để tạo/xem HTML. Có thể đưa hai lệnh vào pipeline, hoặc để agent tạo BPMN XML + DI rồi validate/render.

```bash
# Tạo lại 6 mẫu XML và HTML
npm run bpmn:examples

# Chạy editor và trang diagram mặc định
npm run dev

# Kiểm tra và build
npm run typecheck
npm run test:bpmn
npm test
```

Script ứng dụng hỗ trợ Linux; Windows dùng WSL. Stack web: React 19, TypeScript, Vinext/Vite, Cloudflare Worker. Không cần API key cho chức năng BPMN.

## Chương riêng

`buildStandaloneHTML()` nhận `views`, cùng schema của Archify:

```js
[{ id: 'approved', label: 'Yêu cầu được duyệt',
   note: 'Theo nhánh approved = true.',
   focus: ['Start_Request', 'Task_Request', 'Task_Review',
           'Gateway_Approved', 'Task_PO', 'Task_Notify', 'End_Request'] }]
```

Các ID phải có trên plane đang hiển thị. Tham khảo `scripts/build-artifacts.mjs`. Không cung cấp chương thì adapter tìm tối đa 3 đường từ Start đến End; nếu không có, tạo chương tổng quan và ghi rõ đây là thứ tự xem.

## Mẫu nghiệp vụ

| Tên file trong `examples/bpmn/` và `public/diagrams/` | Nội dung |
|---|---|
| `purchasing` | Gửi duyệt, bổ sung, tạo đơn mua ERP |
| `warehouse` | Nhập kho, QC, cách ly, put-away |
| `approval` | Hai tác vụ song song và gateway hợp nhất |
| `collaboration` | Message Flow gửi Purchase Order tới nhà cung cấp |
| `timer` | Boundary Timer không ngắt, nhắc sau PT24H |
| `blank` | Start Event để tạo quy trình mới |

Mẫu minh họa, chưa phải đặc tả được phê duyệt để triển khai cho khách hàng. Mẫu trống cố ý có cảnh báo chưa hoàn chỉnh. Sửa vị trí mẫu không tự tái bố trí các file người dùng đã lưu.

## Phạm vi hiện tại

- Tập trung **BPMN 2.0 Process & Collaboration**. Không tuyên bố đủ toàn bộ BPMN 2.0.2. Choreography/Conversation chưa hỗ trợ.
- Adapter xuất hình và tương tác trên plane gốc đang dựng. Chưa điều hướng từ collapsed subprocess sang plane con trong artifact; dùng editor để mở/sửa plane con.
- Cần BPMNDI để giữ bố cục. Chưa có auto-layout tổng quát hoặc sinh BPMN từ ngôn ngữ tự nhiên.
- Token simulation không phải engine: không gọi API, gửi email, chạy Script Task/job worker hay thực thi điều kiện nghiệp vụ.
- Editor chỉ đăng ký Camunda 7, không đăng ký đồng thời Zeebe có thuộc tính trùng tên. Extension không đọc được bị chặn khi nhập editor. HTML giữ XML nguyên bản nhưng không cung cấp properties/engine cho extension.
- Không nhận file hơn 8 MB hoặc DTD/entity. Lưu cục bộ chưa có đồng bộ máy khác hoặc cộng tác thời gian thực.
- Đã QA tương tác desktop. API kiểm thử chưa trả download/file chooser; chưa xác minh thao tác tải/chọn file trên thiết bị thực, mobile hoặc WebM. Chi tiết trong `docs/VALIDATION.md`.

## Cấu trúc repo

| Đường dẫn | Trách nhiệm |
|---|---|
| `public/diagrams/` | 6 HTML độc lập để mở/chia sẻ |
| `lib/bpmn/artifact-runtime.mjs` | Chuyển ký hiệu/DI/quan hệ BPMN sang SVG semantic Archify |
| `lib/bpmn/standalone.mjs` | Đóng gói template, viewer, XML, chương và menu file |
| `public/vendor/archify/template.html` | Template/runtime Archify gốc |
| `vendor/archify/` | Helper upstream, license và revision nguồn |
| `components/bpmn/` | Trang artifact, editor, controller và explorer |
| `scripts/` | CLI validate/render, tạo mẫu, đóng gói source |
| `examples/bpmn/` | 6 file XML có BPMNDI |
| `tests/`, `docs/` | Kiểm tra, kiến trúc, phạm vi QA |

## Mã nguồn và GitHub

ZIP chứa toàn bộ mã nguồn và HTML mẫu, không chứa credential hoặc project ID của bản host. Để xuất bản mã nguồn bằng GitHub CLI đã đăng nhập:

```bash
git init -b main
git add .
git commit -m "Initial interactive BPMN artifacts"
gh repo create bpmn-studio --public --source=. --push
```

### Chia sẻ bằng GitHub Pages

Repo có sẵn workflow `.github/workflows/pages.yml` để xuất bản **diagram HTML tĩnh**. Người xem mở link Pages mà không cần tài khoản ChatGPT. Editor đầy đủ vẫn chạy qua `npm run dev` hoặc môi trường host ứng dụng.

1. Đưa mã nguồn lên nhánh `main` của repo GitHub.
2. Trong repo: **Settings → Pages → Build and deployment → Source → GitHub Actions**.
3. Chạy workflow **Publish interactive BPMN diagrams**, hoặc push commit mới vào `main`.
4. Lấy địa chỉ thực từ lần chạy workflow thành công. Trang gốc mở ngay diagram mua hàng; các mẫu khác nằm ở `diagrams/warehouse.html`, `diagrams/approval.html`, `diagrams/collaboration.html`, `diagrams/timer.html` và `diagrams/blank.html`.

Workflow tạo lại HTML từ mã nguồn, giữ cùng chương và hiệu ứng của bản ứng dụng. Không cần cài các dependency của editor để build Pages. File HTML trên Pages có thể tải về mở độc lập; nút chỉnh sửa chỉ xuất hiện khi có editor đi kèm.

```bash
# Chỉ cần Node.js 22.13+, chạy được trên Windows/macOS/Linux
node scripts/build-pages.mjs
# Kết quả: _site/index.html và _site/diagrams/*
```

Tài liệu chính thức: [GitHub Pages với GitHub Actions](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages). Với GitHub Free, dùng repository public cho Pages; khả năng Pages của repository private tùy gói GitHub.

## Giấy phép

Mã mới: MIT. Archify: MIT, giữ bản quyền upstream và mã viewer nguyên gốc trong repo. bpmn-js giữ license riêng. Xem `THIRD_PARTY_NOTICES.md` và `vendor/archify/LICENSE`.
