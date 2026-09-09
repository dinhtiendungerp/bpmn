# Xác minh BPMN × Archify — 07/09/2026

Đã đọc mã nguồn và tương tác trực tiếp với diagram mẫu Archify được yêu cầu. Bản BPMN dùng cùng runtime của Archify qua adapter SVG.

## QA trình duyệt

Kiểm tra bằng Chrome trong môi trường kiểm thử, viewport desktop. Đây không phải kiểm tra trên Chrome hoặc iPhone của người dùng.

| Thao tác | Bằng chứng quan sát |
|---|---|
| Mở HTML mua hàng | 8 node và 8 quan hệ; 3 chương có tên; pool/lane, ký hiệu và nhãn BPMN hiện đúng |
| Play story | Chạy từ bước 1/7, đổi bước và camera theo luồng đã chọn |
| PATH | Chọn Lập yêu cầu → Hoàn tất: 6 node, 5 cạnh có hướng; Journey chuyển vị trí và camera |
| Passport | Documentation, vai trò, incoming/outgoing, upstream/downstream theo phần tử thực |
| Điều kiện và default | Quan hệ hiển thị approved = true hoặc nhánh mặc định đúng XML |
| LENS | User Task: 3 phần tử, 5 quan hệ chạm tới nhóm |
| MAP | Radar chứa 8 node, cùng sơ đồ đang xem |
| Theme/preset | Đổi Light/Dark và Flow/Blueprint; SVG dùng màu của theme |
| Bố cục | Kiểm tra ảnh canvas; sửa vị trí nhãn Start, đường quay lại phê duyệt và màu marker Send Task |
| Đóng gói lại XML khác | Dùng thuật toán đóng gói với file timer rồi mở HTML: 6 node, 4 cạnh, tên và chương của quy trình mới |
| Diagram → editor | Mở timer từ menu Chỉnh sửa BPMN: editor nhận Nhắc duyệt quá hạn, 2 tác vụ và 2 vai trò; không mở nhầm quy trình mua hàng đã lưu |
| Editor → diagram | Nhấn Khám phá từ editor: HTML Archify dựng được từ XML hiện tại, có 8 quan hệ và chương tự sinh |

Đã sửa hai lỗi được QA phát hiện khi mở editor trên HTTP: crypto.randomUUID không có trong non-secure context và classnames cần được Vite prebundle. Các source glyph bpmn-js giữ nguyên.

## Giới hạn bằng chứng

- API browser QA không trả sự kiện download và file chooser trong các lần thử. Chưa xác nhận được file thật qua nút tải HTML/XML/SVG hoặc thao tác chọn file của hệ điều hành. Kiểm thử đóng gói lại ở trên không thay thế cho kiểm thử file chooser.
- HTML chứa sẵn viewer, runtime và XML, đã bỏ font/CDN bên ngoài. Chưa kiểm tra trong một phiên Chrome chủ động ngắt mạng.
- Chưa QA cảm ứng iOS/Android, WebM, trình đọc màn hình, quy trình rất lớn hoặc tất cả biến thể BPMN/vendor.

## Kiểm tra tự động

- XML round trip của 6 mẫu, references, condition và BPMNDI.
- Camunda template attributes không xung đột với Zeebe; Parallel Gateway, Boundary Timer, Message Flow, đường đi có vòng lặp.
- Phiên bản cục bộ, quota, ID trên HTTP, escape dữ liệu HTML.
- Tất cả script trong artifact parse được; XML Unicode giữ nguyên khi đóng gói; bản tải lại chỉ giữ một lớp payload.
- Toàn bộ mã tương tác upstream còn nguyên trong HTML sau bước chờ dựng BPMN.
- TypeScript, build production và bộ kiểm tra SSR/UI nền của repo.

## Kiểm tra tiếp khi đưa vào sử dụng

1. Tải HTML và BPMN XML trên thiết bị sẽ dùng; mở HTML khi ngắt mạng.
2. Nhập file BPMN của dự án thực, kiểm tra ký hiệu, bố cục, nhánh và documentation.
3. Kiểm tra các quy trình con có nhiều plane trong editor; adapter hiện xuất plane đang dựng.
4. Kiểm tra token simulation và engine riêng nếu cần thực thi nghiệp vụ. Story/PATH không xác nhận logic đồng bộ token.

## Cập nhật vị trí logo — 08/09/2026

- Đã đo DOM và kiểm tra hình ở desktop 1363 × 936 và iframe 390 × 844 CSS pixels, giao diện Light/Dark: logo trong footer, không nằm trong toolbar, không chồng các nút điều khiển.
- Toolbar tự xuống dòng ở khung hẹp, các nút nằm trong chiều rộng 390 px. Header desktop có đủ khoảng trống cho toolbar.
- Kiểm tra iframe hẹp này xác nhận bố cục responsive, không thay thế QA cảm ứng trên điện thoại thật.

## Sửa hover và chuẩn bị repository chia sẻ — 08/09/2026

- Đối chiếu trực tiếp hover ở Archify gốc: node được chọn cùng các node nối trực tiếp nổi lên; tín hiệu chạy từ source đến target trên hình học đường nối trong khoảng 1,15 giây.
- Tái hiện lỗi trước khi sửa: adapter chọn `path` bên trong `defs/marker` (hình đầu mũi tên `M 1 5 L 11 10 L 1 15 Z`) thay vì đường BPMN. Overlay hover vì vậy nằm trong marker và không chạy giữa các node. Kiểm tra số node/hop trước đây không phát hiện được lỗi hình học này.
- Tách toàn bộ marker definitions khỏi các nhóm semantic trước khi chọn path. Chuẩn hóa màu marker sau khi đã thu thập đủ definitions; bỏ CSS tổng quát từng ghi đè màu tín hiệu của Archify. Không sửa runtime Archify.
- Chrome desktop: hover Lập yêu cầu tạo 1 tín hiệu vào và 1 tín hiệu ra trên đúng đường đến Phê duyệt; gateway có 1 đường vào, 2 đường ra; Bổ sung có đường quay lại đúng Phê duyệt. Kiểm tra computed path, màu, dash offset và ảnh.
- Chế độ Still: hover không chạy animation. PATH Lập yêu cầu → Hoàn tất vẫn có 6 node/5 hop, cả 5 đường overlay dùng hình học BPMN thật. Không còn phần tử semantic trong `defs`.
- Bản build Pages được phục vụ thử ở thư mục con: entry chuyển đúng đến `diagrams/purchasing.html?present=1`, giữ các chương, không lộ link editor không tồn tại. Kiểm tra màu Light/Dark và Message Flow trong mẫu Collaboration.
- Bộ kiểm tra BPMN/artifact: 18/18 pass. Build Pages tạo 6 HTML độc lập và 6 XML; workflow chưa được xác nhận chạy trên GitHub khi chưa có repository đích.
