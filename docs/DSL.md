# DSL cho BPMN

Viết quy trình thành file văn bản `.flow`, mỗi dòng một lane, một bước hoặc một luồng. `scripts/dsl-to-bpmn.mjs` tự tính toạ độ và sinh file `.bpmn` chuẩn BPMN 2.0 có đủ BPMNDI. File đó mở được bằng BPMN Studio, Camunda Modeler hay bpmn.io.

## Chạy

```bash
node scripts/dsl-to-bpmn.mjs work/nhan-hang.flow work/nhan-hang.bpmn --questions work/cau-hoi.md
node scripts/validate-bpmn.mjs work/nhan-hang.bpmn
node scripts/check-layout.mjs work/nhan-hang.bpmn
node scripts/render-bpmn.mjs work/nhan-hang.bpmn output/nhan-hang.html "Nhận hàng"
```

Lệnh đầu in ra ba nhóm finding:

| Nhóm | Ý nghĩa | File .bpmn |
|---|---|---|
| LỖI | Sai cú pháp, gọi tới bước chưa khai báo, nối sai pool | Không ghi |
| CẦN HỎI LẠI | Chỗ quy trình còn bỏ ngỏ: bước chưa có người làm, chuyển giao không ghi chuyển cái gì, nhánh thiếu điều kiện | Vẫn ghi |
| GỢI Ý | Nhánh mặc định đã tự chọn, bước chưa có mô tả, quy trình quá dài | Vẫn ghi |

`--questions` ghi riêng nhóm CẦN HỎI LẠI ra file markdown, dùng làm danh sách câu hỏi cho buổi khảo sát tiếp theo. `--json` in finding dạng JSON.

## Ví dụ ngắn

```
title "Duyệt đề nghị mua hàng"
lane yc  "Người yêu cầu"
lane duy "Trưởng bộ phận"

yc:  s     start "Phát sinh nhu cầu"
yc:  lap         "Lập đề nghị mua"
duy: xet         "Xem xét đề nghị"
duy: ok    ?     "Duyệt?"
yc:  sua         "Sửa đề nghị"
duy: xong  end   "Đã duyệt"

s > lap > xet "đề nghị mua"
xet > ok
ok > xong "duyệt"
ok > sua "trả lại"
sua ~> xet "đề nghị đã sửa"
```

Ví dụ đủ các cấu trúc (song song, sự kiện hẹn giờ, pool nhà cung cấp) nằm ở `examples/dsl/mua-hang-nhap-kho.flow`.

## Khai báo đầu file

| Dòng | Tác dụng |
|---|---|
| `title "Tên quy trình"` | Tên pool chính và tên process |
| `id MaQuyTrinh` | Id của process. Bỏ trống thì lấy từ title, bỏ dấu |
| `number on` | Đánh số bước `01 · `, `02 · `... theo thứ tự đọc từ trái sang phải |
| `let han "48 giờ"` | Khai báo tham số. Viết `@han` ở bất kỳ dòng nào phía sau, kể cả trong tên bước và thời hạn timer |
| `lane kho "Kho"` | Một lane trong pool hiện tại |
| `pool ncc "Nhà cung cấp"` | Mở một pool mới. Các dòng `lane` sau đó thuộc pool này |
| `lane x "Tên" in ncc` | Gán lane vào pool chỉ định, không phụ thuộc thứ tự dòng |

Lane khai báo trước mọi dòng `pool` thuộc pool chính. Pool không có lane và không có bước sẽ vẽ thành hộp đen (black box), chỉ dùng làm đầu mút cho message flow.

## Bước

```
<lane>: <mã> [loại] "Tên bước" ["Mô tả"] [tuỳ chọn]
```

- `<lane>:` là người thực hiện. Pool có lane mà bước thiếu tiền tố này thì bước được xếp vào lane "(Chưa rõ ai làm)" và bị hỏi lại.
- Mã bước gồm chữ không dấu, số, `_` và `-`. Mã phải là duy nhất, và cũng là id trong file BPMN.
- Chuỗi trong ngoặc kép thứ hai là mô tả, hiện trong Passport khi bấm vào bước. Mô tả dài thì viết thêm dòng `doc <mã> "..."`, các dòng doc nối tiếp nhau.
- Dấu `|` trong tên là xuống dòng.

| Loại | BPMN |
|---|---|
| (bỏ trống), `user` | User Task |
| `service`, `send`, `receive`, `manual`, `script`, `rule` | Service, Send, Receive, Manual, Script, Business Rule Task |
| `task` | Task không phân loại |
| `sub`, `call` | Sub-process thu gọn, Call Activity |
| `?` hoặc `xor` | Exclusive Gateway (chọn một nhánh) |
| `+` hoặc `and` | Parallel Gateway (tách hoặc gộp song song) |
| `o` hoặc `or` | Inclusive Gateway |
| `ev` | Event-based Gateway |
| `start`, `start:timer`, `start:msg`, `start:signal` | Start Event |
| `end`, `end:msg`, `end:error`, `end:terminate`, `end:signal`, `end:escalation` | End Event |
| `timer` | Chờ đến hạn (Intermediate Catch Timer) |
| `msg-in`, `msg-out` | Nhận hoặc gửi message giữa chừng |
| `catch:signal`, `throw:signal`, `event` | Signal, sự kiện trung gian không phân loại |
| `!timer`, `!msg`, `!error`, `!signal`, `!escalation` | Boundary Event gắn lên một task |

Boundary Event cần `on <mã task>`. Thêm `~` sau loại (`!timer~`) để sự kiện không ngắt task đang chạy. Thời hạn timer viết theo ISO 8601: `PT48H` (48 giờ), `P2D` (2 ngày), `R/P1M` (lặp hằng tháng), hoặc một ngày cụ thể `2026-12-31T17:00`.

```
mua: po   service "Tạo và gửi PO"
mua: qh   !timer~ on po "NCC chưa xác nhận sau @han" PT48H
```

## Luồng

| Viết | Nghĩa |
|---|---|
| `a > b "nhãn"` | Sequence flow, nhãn nằm sau bước đích |
| `a > b > c "nhãn" > d` | Nối chuỗi. Nhãn thuộc luồng đứng ngay trước nó |
| `a ~> b "nhãn"` | Luồng làm lại (quay về bước trước). Vẽ vòng ra ngoài, không kéo các bước sau sang phải |
| `a => b "tên thông điệp"` | Message flow giữa hai pool. `b` có thể là mã pool hộp đen |
| `g > b "đạt" if "qty >= po_qty"` | Điều kiện riêng. Bỏ `if` thì điều kiện lấy chính nhãn |
| `g > b "còn lại" default` | Nhánh mặc định của cổng `?` hoặc `o` |

Cổng `?` hoặc `o` có từ hai nhánh ra mà không nhánh nào ghi `default` thì nhánh khai báo sau cùng thành nhánh mặc định, kèm một dòng GỢI Ý để kiểm lại. Nhánh ra từ cổng `+` không được có `if` hay `default`.

Hai bước ở hai pool khác nhau chỉ nối được bằng `=>`. Viết `>` sẽ báo LỖI.

## Script hỏi lại những gì

| Finding | Câu hỏi đặt ra |
|---|---|
| `no-lane` | Ai làm bước này? |
| `handoff` | Task ở lane này chuyển sang task ở lane khác mà luồng không có nhãn: chuyển giao cái gì? |
| `branch-label` | Nhánh ra từ cổng chưa ghi điều kiện: khi nào đi nhánh này? |
| `one-way` | Cổng quyết định chỉ có một lối ra: còn trường hợp nào khác? |
| `fork-no-join` | Nhánh song song không gặp nhau ở cổng `+` nào: có cần chờ tất cả xong không? |
| `implicit-split` | Task có nhiều lối ra mà không qua cổng: đi song song hay chọn một? |
| `dead-end`, `no-incoming`, `unreachable` | Bước bị treo, không có đường vào hoặc không đi tới được |
| `no-start`, `no-end`, `empty-lane` | Thiếu điểm bắt đầu, điểm kết thúc, hoặc có lane không làm gì |
| `timer` | Sự kiện hẹn giờ chưa có thời hạn |
| `msg-name` | Message flow chưa ghi tên thông điệp |

Nhóm GỢI Ý: `auto-default`, `gateway-question` (tên cổng nên là câu hỏi), `mixed-gateway` (cổng vừa gộp vừa tách), `happy-only` (quy trình không có nhánh ngoại lệ nào), `no-doc`, `too-long` (trên 25 bước).

Script không biết các bước viết ra có đúng với thực tế ở kho hay không, cũng không biết một cổng có đủ mọi trường hợp chưa. Nó chỉ đếm nhánh.

## Bố cục được tính thế nào

- Cột là độ dài đường đi dài nhất tính từ sự kiện bắt đầu. Luồng quay lui, dù viết `~>` hay `>`, không đẩy cột.
- Trong mỗi lane, bước nối tiếp chính giữ cùng hàng với bước trước. Nhánh phụ và luồng từ boundary event xuống hàng dưới. Lane tự cao thêm theo số hàng.
- Sự kiện kết thúc mà ô đã có bước khác chiếm thì dời sang cột kế nếu lane đó trống, để lane không phải cao thêm một hàng.
- Đường nối vuông góc. Script thử nhiều cách đi, chọn đường ngắn nhất không cắt qua bước nào, ít cắt và chồng lên đường khác.
- Nhãn đặt tránh bước, tránh nhãn khác, và không ra khỏi lane.

Bố cục tự động không đẹp bằng tay chỉnh ở mọi chỗ. Cần chỉnh thì mở file `.bpmn` trong editor BPMN Studio (`/?edit=1`) hoặc Camunda Modeler kéo lại. Chỉ có điều file `.flow` không nhận lại các chỉnh sửa đó, nên chỉnh tay là bước cuối cùng.
