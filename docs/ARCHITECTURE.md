# Kiến trúc và điểm mở rộng

| Thành phần | Trách nhiệm |
|---|---|
| `ArtifactHome.tsx` | Mở trực tiếp HTML mẫu; `?edit=1` vào editor |
| `artifact-runtime.mjs` | Dựng BPMN bằng Viewer; giữ SVG ký hiệu và DI, ánh xạ node/edge/legend/chapter sang Archify |
| `public/vendor/archify/template.html` | Toàn bộ runtime tương tác upstream, giữ nguyên source |
| `Studio.tsx` | Shell, thư viện ký hiệu, menu, dialog, tìm kiếm, trình bày |
| `useStudio.ts` | Vòng đời Modeler, tài liệu, autosave, chuyển file, version, mode/export |
| `modeler.ts` | Providers, simulation, minimap, chế độ đọc, preflight, tạo ký hiệu |
| `templates.mjs` | Ví dụ có ID/BPMNDI ổn định |
| `graph.mjs` | Cấu trúc, reachability, directed path, danh sách trình bày |
| `lint.mjs` | Quy tắc riêng + bpmnlint bundle khi build |
| `storage.mjs` | Workspace v1 và snapshot cục bộ |
| `standalone.mjs` | HTML offline dùng chung UI/CLI |

## Luồng tạo diagram

`BPMN XML + DI → bpmn-js Viewer → semantic SVG → Archify runtime`.

Runtime Archify chỉ khởi tạo sau promise dựng BPMN. Group node ngoài không có transform để camera `getBBox()` dùng đúng tọa độ SVG; transform nằm ở geometry con. Flow giữ endpoint, waypoint, condition và default marker. Shape, label và BPMN marker được giữ; màu được ánh xạ sang theme Archify.

HTML chứa bản XML gốc và payload HTML gốc một lớp. Tải HTML đóng gói lại source gốc, không lưu DOM đang bị camera/animation biến đổi. Mở BPMN khác thay XML trong source này rồi dựng lại, bỏ chương có ID không còn tồn tại. Link editor dùng sessionStorage cùng origin để chuyển chính quy trình đang xem; editor nhập thành tài liệu mới sau preflight.

Adapter hiện hỗ trợ plane gốc, chưa drill-down qua nhiều subprocess plane. LENS là nhóm loại phần tử, PATH là đồ thị node/quan hệ; Story/Journey không thực hiện ngữ nghĩa token BPMN.

## Dữ liệu

BPMN XML + BPMNDI là định dạng gốc. Workspace JSON giữ ID tài liệu, tên hiển thị, XML, thời gian và revisions. Marker/lens là trạng thái UI. Chỉ đăng ký Camunda 7 moddle. Zeebe có thuộc tính trùng tên nên không đăng ký chung; file chứa extension không hỗ trợ bị chặn. Cảnh báo parser không bị bỏ qua; file đang sửa được giữ nếu nhập thất bại. Không `eval` Script Task hay condition.

## Mở rộng

1. **Nhiều người:** backend lưu phiên bản, optimistic locking, audit và quyền truy cập. Không gọi localStorage là cộng tác.
2. **Engine:** chọn Camunda 7/8, Flowable…; credential phía server; kiểm tra ký hiệu, form/variables, retry/correlation, compensation và worker. Không dùng simulation làm runtime.
3. **Sinh từ mô tả:** sinh XML/DI, validate rồi review. Nếu thêm LLM cần cấu hình model, tài khoản, phí và dữ liệu gửi đi rõ ràng.
4. **Choreography/Conversation:** cần renderer/modeler đủ metamodel, DI, rules, properties và fixtures; không giả bằng task thường.
5. **Auto-layout:** giữ swimlane, boundary attachment và semantics; lưu revision trước khi tái bố trí.
6. **Formal validation:** bổ sung XSD, engine validation và phân tích soundness/deadlock; lint hiện tại không chứng minh soundness tổng quát.

## Hosting

Cloudflare-compatible bundle, kèm adapter Sites/Vinext. BPMN xử lý client, không có backend nghiệp vụ. Site access gate không phân quyền từng tài liệu. HTML xuất chứa đầy đủ quy trình; chỉ chia sẻ cho người cần xem.
